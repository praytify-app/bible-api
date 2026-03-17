# Scale Bible Seeding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all blockers preventing import of all 1,285 eBible.org redistributable translations, then provide export/import scripts for Dokploy deployment.

**Architecture:** Modify the open-bible-api seeder to accept all redistributable translations (not just PD), widen DB columns, wrap version imports in transactions with chunked inserts, add resume support, and create shell scripts for pg_dump/restore to Dokploy's Docker PostgreSQL.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Node.js, Bash

**Spec:** `docs/superpowers/specs/2026-03-16-scale-bible-seeding-design.md`

**Repos touched:**
- `open-bible-api` (seeder code, schema, tests) — sibling repo at `../open-bible-api`
- `praytify-bible` (export/import scripts, spec/plan docs)

---

## Chunk 1: License Filter + Column Widening

### Task 1: Add COPYRIGHTED_REDISTRIBUTABLE license type and update filter

**Files:**
- Modify: `../open-bible-api/src/seeder/catalog.ts:8` (LicenseType), `:32` (classifyLicense), `:186` (filterByLicense)
- Modify: `../open-bible-api/tests/seeder/catalog.test.ts`
- Modify: `../open-bible-api/tests/fixtures/translations-sample.csv`

- [ ] **Step 1: Update test fixture with a Wycliffe-style entry**

Add a new row to `tests/fixtures/translations-sample.csv` — a redistributable, copyrighted Wycliffe translation:

```csv
"aak","aak","Ankave","Ankave","","ebible.org","Ankave NT","Ankave New Testament","True","Copyright © 1990 Wycliffe Bible Translators, Inc.","2024-01-01","https://ebible.org/aak/","0","0","0","27","260","7957","0","0","0","","True","http://eBible.org/study/","aak","","ltr","True","","AAK","","Latin","2024-01-01"
```

- [ ] **Step 2: Write failing tests for new license type**

In `tests/seeder/catalog.test.ts`:

1. Update the existing `parseCatalogCsv` test count (line 96) from 9 to 10:
```typescript
    expect(entries.length).toBe(10);
```

2. Add in the `classifyLicense` describe block:
```typescript
it("classifies Wycliffe copyright as COPYRIGHTED_REDISTRIBUTABLE", () => {
  expect(
    classifyLicense("Copyright © 2011 Wycliffe Bible Translators, Inc.")
  ).toBe("COPYRIGHTED_REDISTRIBUTABLE");
  expect(
    classifyLicense("Copyright © 2024 The Word for the World International")
  ).toBe("COPYRIGHTED_REDISTRIBUTABLE");
});
```

3. Replace the existing `filterByLicense` test with:
```typescript
it("keeps PD, CC_BY, CC_BY_SA, COPYRIGHTED_REDISTRIBUTABLE and excludes OTHER", () => {
  const csv = readFileSync(FIXTURE_PATH, "utf-8");
  const all = parseCatalogCsv(csv);
  const filtered = filterByLicense(all);

  // From 10 redistributable entries: engkjv(PD), engweb(PD), sparvg(CC_BY_SA),
  // fralsg(PD), yorulb(CC_BY), arbnav(PD), zhocuv(OTHER-NC), ibobib(CC_BY_SA),
  // porara(OTHER-ND), aak(COPYRIGHTED_REDISTRIBUTABLE)
  // That's 8 allowed, 2 excluded (zhocuv + porara)
  expect(filtered.length).toBe(8);

  const ids = filtered.map((e) => e.translationId);
  expect(ids).toContain("engkjv");
  expect(ids).toContain("aak");
  expect(ids).not.toContain("zhocuv");
  expect(ids).not.toContain("porara");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd ../open-bible-api && pnpm test -- tests/seeder/catalog.test.ts`
Expected: FAIL — `COPYRIGHTED_REDISTRIBUTABLE` not a valid LicenseType, filter count wrong

- [ ] **Step 4: Implement license type and filter changes**

In `src/seeder/catalog.ts`:

1. Update `LicenseType` union (line 8):
```typescript
export type LicenseType = "PD" | "CC_BY" | "CC_BY_SA" | "COPYRIGHTED_REDISTRIBUTABLE" | "OTHER";
```

2. Update `classifyLicense` — add before the final `return "OTHER"` (line 68):
```typescript
  // Copyrighted but redistributable (eBible.org already filtered for redistributable=true)
  if (lower.includes("copyright")) {
    return "COPYRIGHTED_REDISTRIBUTABLE";
  }
```

3. Update `filterByLicense` (line 187):
```typescript
export function filterByLicense(entries: CatalogEntry[]): CatalogEntry[] {
  const excluded: Set<LicenseType> = new Set(["OTHER"]);
  return entries.filter((entry) => !excluded.has(entry.licenseType));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ../open-bible-api && pnpm test -- tests/seeder/catalog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd ../open-bible-api
git add src/seeder/catalog.ts tests/seeder/catalog.test.ts tests/fixtures/translations-sample.csv
git commit -m "feat(seeder): add COPYRIGHTED_REDISTRIBUTABLE license type, accept all redistributable translations"
```

---

### Task 2: Widen abbreviation and license columns

**Files:**
- Modify: `../open-bible-api/src/db/schema.ts:29,32,90`

- [ ] **Step 1: Verify language codes fit in VARCHAR(3)**

All 1,285 eBible.org entries use ISO 639-3 codes (always exactly 3 chars). Verify with:

```bash
cd ../open-bible-api && node --env-file=.env -e "
const { fetchCatalog } = await import('./src/seeder/catalog.ts');
const all = await fetchCatalog();
const long = all.filter(e => e.languageCode.length > 3);
console.log('Codes > 3 chars:', long.length);
if (long.length > 0) long.slice(0,5).forEach(e => console.log(e.languageCode));
"
```

Expected: `Codes > 3 chars: 0` — no changes needed to `languages.code`.

- [ ] **Step 2: Update schema column widths**

In `src/db/schema.ts`:

```typescript
// versions table — line 29:
abbreviation: varchar("abbreviation", { length: 100 }).unique().notNull(),
// versions table — line 32:
license: text("license"),
// dailyVerses table — line 90:
versionAbbreviation: varchar("version_abbreviation", { length: 100 }).notNull(),
```

- [ ] **Step 3: Apply column changes to local database**

```bash
psql -h localhost -d praytify_bible -U bible -c "
ALTER TABLE public.versions ALTER COLUMN abbreviation TYPE varchar(100);
ALTER TABLE public.versions ALTER COLUMN license TYPE text;
ALTER TABLE public.daily_verses ALTER COLUMN version_abbreviation TYPE varchar(100);
"
```

- [ ] **Step 4: Verify existing data still works**

Run: `cd ../open-bible-api && pnpm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd ../open-bible-api
git add src/db/schema.ts
git commit -m "fix(schema): widen abbreviation to varchar(100) and license to text for long eBible.org values"
```

---

## Chunk 2: Transaction-Per-Version + Chunked Inserts

### Task 3: Wrap seedVersion in a database transaction

**Files:**
- Modify: `../open-bible-api/src/seeder/bulk-insert.ts`

- [ ] **Step 1: Refactor seedVersion to use db.transaction()**

Replace the body of `seedVersion` in `src/seeder/bulk-insert.ts` with:

```typescript
export async function seedVersion(options: SeedVersionOptions & { force?: boolean }): Promise<void> {
  const {
    parsedBooks,
    languageCode,
    languageName,
    languageNativeName,
    languageScript,
    languageDirection = "ltr",
    abbreviation,
    name,
    license,
    sourceUrl,
    attribution,
    attributionUrl,
    licenseType,
    force = false,
  } = options;

  // 1. Upsert language (intentionally outside transaction — idempotent, shared across versions)
  const existingLangs = await db
    .select()
    .from(languages)
    .where(eq(languages.code, languageCode))
    .limit(1);

  let languageId: string;

  if (existingLangs.length > 0) {
    languageId = existingLangs[0].id;
  } else {
    const [inserted] = await db
      .insert(languages)
      .values({
        code: languageCode,
        name: languageName,
        nativeName: languageNativeName ?? null,
        script: languageScript ?? null,
        direction: languageDirection,
      })
      .returning({ id: languages.id });
    languageId = inserted.id;
  }

  // 2. Check version doesn't already exist (unless force mode)
  const existingVersions = await db
    .select()
    .from(versions)
    .where(eq(versions.abbreviation, abbreviation))
    .limit(1);

  if (existingVersions.length > 0) {
    if (!force) {
      console.log(`Version "${abbreviation}" already exists, skipping.`);
      return;
    }
    // Force mode: delete existing version (cascades to books/chapters/verses)
    console.log(`Force mode: deleting existing "${abbreviation}" before re-import...`);
    await db.delete(versions).where(eq(versions.id, existingVersions[0].id));
  }

  // 3. Insert version + all books/chapters/verses inside a transaction
  let totalVerseCount = 0;

  await db.transaction(async (tx) => {
    const [version] = await tx
      .insert(versions)
      .values({
        languageId,
        abbreviation,
        name,
        license: license ?? null,
        sourceUrl: sourceUrl ?? null,
        attribution: attribution ?? null,
        attributionUrl: attributionUrl ?? null,
        licenseType: licenseType ?? "PD",
        verseCount: 0,
      })
      .returning({ id: versions.id });

    const versionId = version.id;

    for (const parsedBook of parsedBooks) {
      const meta = getBookMeta(parsedBook.bookCode);
      if (!meta) {
        console.warn(`Skipping unknown book code: ${parsedBook.bookCode}`);
        continue;
      }

      const [book] = await tx
        .insert(books)
        .values({
          versionId,
          bookCode: meta.code,
          name: parsedBook.bookName || meta.englishName,
          position: meta.position,
          chapterCount: parsedBook.chapters.length,
          testament: meta.testament,
        })
        .returning({ id: books.id });

      for (const parsedChapter of parsedBook.chapters) {
        const [chapter] = await tx
          .insert(chapters)
          .values({
            bookId: book.id,
            number: parsedChapter.number,
            verseCount: parsedChapter.verses.length,
          })
          .returning({ id: chapters.id });

        // Chunk verse inserts at 500 rows to avoid query size limits
        if (parsedChapter.verses.length > 0) {
          const verseRows = parsedChapter.verses.map((v) => ({
            chapterId: chapter.id,
            number: v.number,
            text: v.text,
          }));

          for (let i = 0; i < verseRows.length; i += 500) {
            const chunk = verseRows.slice(i, i + 500);
            await tx.insert(verses).values(chunk);
          }

          totalVerseCount += parsedChapter.verses.length;
        }
      }
    }

    // Update verse count on version
    await tx
      .update(versions)
      .set({ verseCount: totalVerseCount })
      .where(eq(versions.id, versionId));
  });

  console.log(
    `Seeded ${abbreviation}: ${parsedBooks.length} books, ${totalVerseCount} verses`
  );
}
```

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `cd ../open-bible-api && pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd ../open-bible-api
git add src/seeder/bulk-insert.ts
git commit -m "feat(seeder): wrap seedVersion in transaction with chunked verse inserts"
```

---

## Chunk 3: Batch Runner Improvements

### Task 4: Add progress logging and resume support

**Files:**
- Modify: `../open-bible-api/src/seeder/batch-runner.ts`
- Modify: `../open-bible-api/src/seeder/cli.ts`

- [ ] **Step 1: Add progress logging to batch runner**

In `src/seeder/batch-runner.ts`:

1. Add imports at the top of the file (after existing imports):
```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
```

2. Add a helper after imports (and export it):
```typescript
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m${seconds % 60}s`;
  return `${seconds}s`;
}
```

3. Replace the sequential loop in `runBatchImport` (lines 160-172) with:

```typescript
  if (concurrency <= 1) {
    // Sequential mode
    const startTime = Date.now();
    for (let i = 0; i < entries.length; i++) {
      const result = await importSingleTranslation(entries[i], force);
      results.push(result);

      if (onProgress) {
        onProgress(result, i, entries.length);
      }

      // Write progress checkpoint
      const progressPath = join(process.cwd(), ".cache", "seed-progress.json");
      mkdirSync(dirname(progressPath), { recursive: true });
      writeFileSync(progressPath, JSON.stringify({
        lastTranslationId: entries[i].translationId,
        completedIndex: i,
        total: entries.length,
        imported: results.filter(r => r.status === "imported").length,
        skipped: results.filter(r => r.status === "skipped").length,
        failed: results.filter(r => r.status === "failed").length,
        timestamp: new Date().toISOString(),
      }, null, 2));

      if (delay > 0 && i < entries.length - 1) {
        await sleep(delay);
      }
    }
  } else {
```

- [ ] **Step 2: Add memory cleanup in importSingleTranslation**

In `src/seeder/batch-runner.ts`, in the `importSingleTranslation` function, after the `seedVersion` call and verse counting (before the return), add:

```typescript
    // Help GC by clearing parsed data
    parsedBooks.length = 0;
```

- [ ] **Step 3: Add --start-from flag to seed-all CLI command**

In `src/seeder/cli.ts`, find the `seed-all` command and add the option:

```typescript
  .option("--start-from <id>", "Skip translations before this ID in the catalog")
```

Then in the action handler, after `const eligible = filterByLicense(all);`, add:

```typescript
      let toImport = eligible;
      if (opts.startFrom) {
        const startIndex = eligible.findIndex(e => e.translationId === opts.startFrom);
        if (startIndex === -1) {
          console.error(`Translation "${opts.startFrom}" not found in eligible list.`);
          process.exit(1);
        }
        toImport = eligible.slice(startIndex);
        console.log(`Skipping to ${opts.startFrom} (index ${startIndex}), ${toImport.length} remaining...`);
      }
```

Then replace `eligible` with `toImport` in the `runBatchImport` call and logging.

- [ ] **Step 4: Improve progress callback in seed-all CLI**

In `cli.ts`, add `formatElapsed` to the import at the top:

```typescript
import { runBatchImport, createBatchReport, formatElapsed } from "./batch-runner.js";
```

Then in the `seed-all` action handler, declare `batchStart` before the `runBatchImport` call and use it in the options object:

```typescript
      const batchStart = Date.now();

      const results = await runBatchImport(toImport, {
        concurrency: parseInt(opts.concurrency, 10),
        delay: parseInt(opts.delay, 10),
        onProgress: (result, index, total) => {
          const elapsed = formatElapsed(Date.now() - batchStart);
          const pct = Math.round(((index + 1) / total) * 100);
          const avgMs = (Date.now() - batchStart) / (index + 1);
          const estRemaining = formatElapsed(avgMs * (total - index - 1));
          console.log(
            `[${pct}% ${index + 1}/${total}] ${result.translationId}: ${result.status}` +
            `${result.verseCount ? ` (${result.verseCount} verses)` : ""}` +
            `${result.reason ? ` — ${result.reason}` : ""}` +
            `${result.error ? ` — ${result.error}` : ""}` +
            ` | elapsed: ${elapsed} | est remaining: ${estRemaining}`
          );
        },
      });
```

- [ ] **Step 5: Add --max-memory flag to seed-all CLI**

In `cli.ts`, add the option to the `seed-all` command:

```typescript
  .option("--max-memory <mb>", "Pause and force GC when heap exceeds this MB threshold", "2048")
```

In the action handler, after each `runBatchImport` iteration completes, the batch-runner already handles memory cleanup via `parsedBooks.length = 0`. The `--max-memory` flag adds an additional safety check. In `batch-runner.ts`, update the `BatchOptions` interface:

```typescript
  /** Max heap memory in bytes before forcing GC (requires --expose-gc) */
  maxMemory?: number;
```

In the sequential loop, after the progress checkpoint write, add:

```typescript
      // Force GC if memory exceeds threshold (requires node --expose-gc)
      if (options.maxMemory && typeof globalThis.gc === "function") {
        const heapUsed = process.memoryUsage().heapUsed;
        if (heapUsed > options.maxMemory) {
          console.log(`[gc] Heap ${Math.round(heapUsed / 1024 / 1024)}MB > ${Math.round(options.maxMemory / 1024 / 1024)}MB threshold, forcing GC...`);
          globalThis.gc();
        }
      }
```

In the `seed-all` CLI action, pass the option:

```typescript
        maxMemory: parseInt(opts.maxMemory, 10) * 1024 * 1024, // Convert MB to bytes
```

Update the `seed` script in `package.json` to enable GC:

```json
"seed": "tsx --env-file=.env --expose-gc src/seeder/cli.ts",
```

- [ ] **Step 6: Run tests to verify no regression**

Run: `cd ../open-bible-api && pnpm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd ../open-bible-api
git add src/seeder/batch-runner.ts src/seeder/cli.ts package.json
git commit -m "feat(seeder): add progress checkpointing, --start-from, --max-memory, and memory cleanup"
```

---

## Chunk 4: Export/Import Scripts

### Task 5: Create export-bible-data.sh

**Files:**
- Create: `scripts/export-bible-data.sh` (in praytify-bible repo)

- [ ] **Step 1: Create the export script**

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/export-bible-data.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/export-bible-data.sh
git commit -m "feat: add export-bible-data.sh for pg_dump of bible tables"
```

---

### Task 6: Create import-bible-data.sh

**Files:**
- Create: `scripts/import-bible-data.sh` (in praytify-bible repo)

- [ ] **Step 1: Create the import script**

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/import-bible-data.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/import-bible-data.sh
git commit -m "feat: add import-bible-data.sh for restoring bible data into Docker PostgreSQL"
```

---

## Chunk 5: Integration Test + Seed Run

### Task 7: End-to-end verification

- [ ] **Step 1: Run all open-bible-api tests**

```bash
cd ../open-bible-api && pnpm test
```

Expected: All tests PASS

- [ ] **Step 2: Test seed-translation with a known translation**

```bash
cd ../open-bible-api && pnpm seed seed-translation engwebp
```

Expected: Downloads, parses, seeds World English Bible with ~31K verses (or skips if already exists)

- [ ] **Step 3: Test seed discover shows full catalog**

```bash
cd ../open-bible-api && pnpm seed discover
```

Expected: Shows ~1,285 eligible (not 106)

- [ ] **Step 4: Test seed status**

```bash
cd ../open-bible-api && pnpm seed status
```

Expected: Shows imported count vs available count

- [ ] **Step 5: Test export script**

```bash
./scripts/export-bible-data.sh test-export.sql.gz
```

Expected: Creates compressed dump, prints row counts

- [ ] **Step 6: Clean up test export**

```bash
rm -f test-export.sql.gz
```

- [ ] **Step 7: Run the full seed-all (the big one)**

```bash
cd ../open-bible-api && pnpm seed seed-all --delay 2000
```

Expected: Runs for ~2-6 hours. Progress logged to console. Resume with `--start-from <id>` if interrupted.

- [ ] **Step 8: Export final bible data**

```bash
./scripts/export-bible-data.sh bible-data.sql.gz
```

Expected: Compressed dump (~1-2 GB), row counts showing ~32M verses across ~1,285 versions

- [ ] **Step 9: Final commit with any fixes discovered during seeding**

```bash
git add -A && git commit -m "fix: adjustments discovered during full seed run"
```
