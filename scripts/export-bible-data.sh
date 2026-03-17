#!/bin/bash
set -euo pipefail

# Dumps public schema bible tables (not auth/platform tables) to compressed SQL.
# WARNING: Uses --clean --if-exists which generates DROP TABLE statements.
#          Restore is destructive — it replaces all bible data, not additive.
#
# Usage: ./scripts/export-bible-data.sh [output-file]
# Example: ./scripts/export-bible-data.sh bible-data-2026-03-16.sql.gz

OUTPUT=${1:-"bible-data.sql.gz"}
DATABASE_URL=${DATABASE_URL:-"postgresql://bible:bible@localhost:5432/praytify_bible"}

echo "Exporting bible data from: $DATABASE_URL"
echo "Tables: languages, versions, books, chapters, verses, daily_verses"

pg_dump "$DATABASE_URL" \
  --table=public.languages \
  --table=public.versions \
  --table=public.books \
  --table=public.chapters \
  --table=public.verses \
  --table=public.daily_verses \
  --clean --if-exists \
  --no-owner --no-privileges \
  | gzip > "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Exported to $OUTPUT ($SIZE)"

# Print row counts for verification
echo ""
echo "Row counts:"
psql "$DATABASE_URL" -t -c "
  SELECT 'languages' AS tbl, count(*) FROM public.languages
  UNION ALL SELECT 'versions', count(*) FROM public.versions
  UNION ALL SELECT 'books', count(*) FROM public.books
  UNION ALL SELECT 'chapters', count(*) FROM public.chapters
  UNION ALL SELECT 'verses', count(*) FROM public.verses
  UNION ALL SELECT 'daily_verses', count(*) FROM public.daily_verses
  ORDER BY tbl;
"
