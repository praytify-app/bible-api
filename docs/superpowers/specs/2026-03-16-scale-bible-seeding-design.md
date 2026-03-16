# Scale Bible Seeding to 1,285+ Versions

**Date:** 2026-03-16
**Status:** Approved
**Scope:** open-bible-api seeder + praytify-bible export/import scripts

## Problem

The current seeding infrastructure can only import 106 Public Domain translations from eBible.org. We need to import all 1,285 redistributable translations, seed them locally, and deploy the data to production via pg_dump/pg_restore through Dokploy's Docker setup.

### Blockers Identified

1. **License filter too restrictive** — `filterByLicense` rejects 1,179 translations that eBible.org marks as redistributable+downloadable. These are copyrighted (mostly Wycliffe) but explicitly permitted for redistribution.
2. **`abbreviation` column is VARCHAR(20)** — 61 translations have abbreviations up to 35 chars. Inserts will fail. `daily_verses.version_abbreviation` is also VARCHAR(20) and needs widening.
3. **Row-by-row book/chapter inserts** — books and chapters are inserted one at a time; verses are already batched per chapter but not chunked for large chapters. For ~40M total verses across 1,285 translations, this is slow.
4. **No transaction per version** — version row is inserted first, then books/chapters/verses follow without a transaction. A failure mid-import leaves an incomplete version row (verseCount: 0) with orphaned books/chapters/verses and no cleanup.
5. **No resume on restart** — batch runner re-downloads and re-parses translations it already checked.
6. **Memory pressure** — parsed USFM data for all books held in memory across the full batch run.
7. **No export/import tooling** — no scripts exist to dump seeded data and restore on Dokploy.

## Design

### 1. Remove license filter — trust eBible.org's redistributable flag

**File:** `open-bible-api/src/seeder/catalog.ts`

The eBible.org catalog parser already filters for `redistributable=true` and `downloadable=true` before entries reach our code. All 1,285 entries that pass this filter are legally redistributable.

**Changes:**
- Add a new `licenseType` classification: `"COPYRIGHTED_REDISTRIBUTABLE"` for entries that don't match PD/CC but are in the catalog
- Change `filterByLicense` to accept all redistributable entries (PD + CC + COPYRIGHTED_REDISTRIBUTABLE) rather than only PD/CC
- The `attribution` and `license` fields already store the copyright text for proper credit
- Update CLI `discover` command output to reflect the new totals

### 2. Widen column constraints

**Files:** `open-bible-api/src/db/schema.ts`, migration SQL applied directly

**Changes:**
- `versions.abbreviation`: VARCHAR(20) → VARCHAR(100)
- `versions.license`: VARCHAR(100) → TEXT (some copyright strings are long)
- `daily_verses.version_abbreviation`: VARCHAR(20) → VARCHAR(100)
- `languages.code`: confirm all 1,285 entries fit in VARCHAR(3) — ISO 639-3 is always 3 chars, but verify eBible.org doesn't use extended codes. If any exceed 3, widen to VARCHAR(10).
- Apply via direct `ALTER TABLE` statements (no drizzle migration needed for local seed workflow)

### 3. Transaction-per-version with chunked inserts

**File:** `open-bible-api/src/seeder/bulk-insert.ts`

Current flow (per version):
```
INSERT version → returning id           (outside any transaction)
for each book:
  INSERT 1 book → returning id
  for each chapter:
    INSERT 1 chapter → returning id
    INSERT all verses for chapter        (already batched)
UPDATE version verse_count
```

New flow:
```
Upsert language (intentionally outside transaction — idempotent)
Check if version abbreviation exists (skip if so)
BEGIN TRANSACTION
  INSERT version → returning id
  for each book:
    INSERT 1 book → returning id
    for each chapter:
      INSERT 1 chapter → returning id
      INSERT verses in chunks of 500
  UPDATE version verse_count
COMMIT (or ROLLBACK on any error — no orphaned data)
```

Key changes:
- **Move version insert inside the transaction** so a rollback leaves no trace
- Language upsert stays outside the transaction (idempotent, shared across versions)
- Chunk verse inserts at 500 rows per INSERT to avoid query size limits
- On any error, the full transaction rolls back — no orphaned partial data
- The existing duplicate-check (`versions.abbreviation` exists → skip) still works correctly since a rolled-back version won't be in the DB

### 4. Resume support in batch runner

**File:** `open-bible-api/src/seeder/batch-runner.ts`

The existing `importSingleTranslation` already checks `versions.abbreviation` in the DB before importing. Restarts naturally skip already-imported translations via this DB check.

**Modifications to existing commands:**
- Add `--start-from <translationId>` flag to existing `seed-all` command to skip ahead in the catalog
- Improve progress logging: `[42/1285] imported aak (31102 verses) | elapsed: 2m | est remaining: 4h`
- Write `.cache/seed-progress.json` with last completed translationId and timestamp
- Existing `--force` flag: when used with transactions, force mode will DELETE the existing version row (cascading to books/chapters/verses) inside the transaction before re-importing

### 5. Memory management between translations

**File:** `open-bible-api/src/seeder/batch-runner.ts`

After each translation is seeded:
- The `parsedBooks` array goes out of scope naturally in `importSingleTranslation`
- Add explicit `parsedBooks.length = 0` before returning to help GC
- Add `--max-memory` flag that pauses and forces GC via `global.gc()` if `process.memoryUsage().heapUsed` exceeds threshold (requires `--expose-gc` node flag)

### 6. Export/Import scripts for Dokploy deployment

**New files:**
- `scripts/export-bible-data.sh` — dumps bible tables from local PostgreSQL
- `scripts/import-bible-data.sh` — restores dump into Dokploy's Docker PostgreSQL

#### export-bible-data.sh
```bash
#!/bin/bash
# Dumps public schema bible tables (not auth/platform tables) to compressed SQL
# WARNING: Uses --clean --if-exists which generates DROP TABLE statements.
#          Restore is destructive — it replaces all bible data, not additive.
# Usage: ./scripts/export-bible-data.sh [output-file]

OUTPUT=${1:-"bible-data.sql.gz"}
DATABASE_URL=${DATABASE_URL:-"postgresql://bible:bible@localhost:5432/praytify_bible"}

pg_dump "$DATABASE_URL" \
  --schema=public \
  --table=languages \
  --table=versions \
  --table=books \
  --table=chapters \
  --table=verses \
  --table=daily_verses \
  --clean --if-exists \
  --no-owner --no-privileges \
  | gzip > "$OUTPUT"

echo "Exported to $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
```

#### import-bible-data.sh
```bash
#!/bin/bash
# Restores bible data dump into a Docker PostgreSQL container.
# WARNING: This is a DESTRUCTIVE restore — it drops and recreates bible tables.
# Run this ON THE SERVER where the Docker container is running (after scp).
# Usage: ./scripts/import-bible-data.sh <container-name> <dump-file> [db-name] [db-user]

CONTAINER=$1
DUMP_FILE=$2
DB_NAME=${3:-"praytify_bible"}
DB_USER=${4:-"bible"}

if [ -z "$CONTAINER" ] || [ -z "$DUMP_FILE" ]; then
  echo "Usage: ./scripts/import-bible-data.sh <container> <dump-file> [db-name] [db-user]"
  exit 1
fi

echo "WARNING: This will replace ALL bible data in $CONTAINER/$DB_NAME"
echo "Restoring $DUMP_FILE..."
gunzip -c "$DUMP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "Restore complete."
```

### 7. Size estimates

- ~1,285 translations × ~25K avg verses = ~32M verses
- PostgreSQL data on disk: ~8-12 GB
- Compressed SQL dump: ~1-2 GB (gzipped)
- Local `.cache/ebible/` (USFM zips): ~3-5 GB
- Total local disk needed: ~15-20 GB
- Server disk needed during restore: ~10-14 GB (dump + restored data)

## What's NOT changing

- **open-bible-api routes/middleware** — API layer is untouched
- **praytify-bible gateway** — proxy, auth, rate limiting unchanged
- **Portal frontend** — no changes needed
- **Database schema structure** — same tables, just wider columns
- **Docker compose** — no changes to service definitions

## Deployment workflow

1. Fix all code (this spec)
2. Run `pnpm seed seed-all` locally (~2-6 hours depending on network)
3. Run `./scripts/export-bible-data.sh` → produces `bible-data.sql.gz` (~1-2 GB)
4. Copy dump to server: `scp bible-data.sql.gz user@server:/tmp/`
5. **On the server:** `./scripts/import-bible-data.sh <postgres-container> /tmp/bible-data.sql.gz`
6. Verify: hit `https://api.praytify.bible/v1/versions` and confirm count

## Future work (not in this spec)

- Add HelloAO importer (1,000+ additional translations)
- Add scrollmapper/bible_databases importer (140+ translations, pre-made SQL)
- Incremental sync: detect new eBible.org translations and import only those
