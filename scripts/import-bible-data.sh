#!/bin/bash
set -euo pipefail

# Restores bible data dump into a Docker PostgreSQL container.
# WARNING: This is a DESTRUCTIVE restore — it drops and recreates bible tables.
# Run this ON THE SERVER where the Docker container is running (after scp/upload).
#
# Usage: ./scripts/import-bible-data.sh <container-name> <dump-file> [db-name] [db-user]
# Example: ./scripts/import-bible-data.sh praytify-postgres bible-data.sql.gz praytify_bible bible

CONTAINER=${1:-""}
DUMP_FILE=${2:-""}
DB_NAME=${3:-"praytify_bible"}
DB_USER=${4:-"bible"}

if [ -z "$CONTAINER" ] || [ -z "$DUMP_FILE" ]; then
  echo "Usage: ./scripts/import-bible-data.sh <container> <dump-file> [db-name] [db-user]"
  echo ""
  echo "Arguments:"
  echo "  container   Docker container name or ID running PostgreSQL"
  echo "  dump-file   Path to the gzipped SQL dump (bible-data.sql.gz)"
  echo "  db-name     Database name (default: praytify_bible)"
  echo "  db-user     Database user (default: bible)"
  echo ""
  echo "Example:"
  echo "  ./scripts/import-bible-data.sh praytify-postgres /tmp/bible-data.sql.gz"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: Dump file not found: $DUMP_FILE"
  exit 1
fi

# Verify container is running
if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
  echo "Error: Container '$CONTAINER' not found or not running"
  exit 1
fi

echo "=== Bible Data Import ==="
echo "Container: $CONTAINER"
echo "Dump file: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
echo "Database:  $DB_NAME"
echo "User:      $DB_USER"
echo ""
echo "WARNING: This will DROP and recreate all bible tables (languages, versions, books, chapters, verses, daily_verses)"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring..."
gunzip -c "$DUMP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet

echo ""
echo "Verifying row counts..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
  SELECT 'languages' AS tbl, count(*) FROM public.languages
  UNION ALL SELECT 'versions', count(*) FROM public.versions
  UNION ALL SELECT 'books', count(*) FROM public.books
  UNION ALL SELECT 'chapters', count(*) FROM public.chapters
  UNION ALL SELECT 'verses', count(*) FROM public.verses
  UNION ALL SELECT 'daily_verses', count(*) FROM public.daily_verses
  ORDER BY tbl;
"

echo ""
echo "Restore complete."
