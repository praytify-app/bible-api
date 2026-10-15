-- Load-test targets for scripts/perf/k6-load.js, drawn from the database
-- under test so every request names something that exists:
--   psql -At -f scripts/perf/targets.sql > targets.json
-- Chapters with no verses (partial translations) and abbreviations that
-- cannot sit in a URL path segment or a comma-separated list are left out.
SELECT json_build_object(
  'hot', (SELECT json_agg(json_build_array(v, b, c))
          FROM (VALUES ('WEB'), ('KJV')) vv(v),
               (VALUES ('JHN', 3), ('PSA', 23), ('GEN', 1), ('ROM', 8), ('MAT', 5),
                       ('1CO', 13), ('PSA', 91), ('ISA', 53), ('JHN', 1), ('PRO', 3)) bc(b, c)),
  'cold', (SELECT json_agg(json_build_array(v.abbreviation, b.book_code, c.number))
           FROM (SELECT * FROM chapters c
                 WHERE EXISTS (SELECT 1 FROM verses x WHERE x.chapter_id = c.id)
                 ORDER BY random() LIMIT 50000) c
           JOIN books b ON b.id = c.book_id JOIN versions v ON v.id = b.version_id
           WHERE v.abbreviation !~ '[/?#%]' AND v.abbreviation = btrim(v.abbreviation)),
  'refs', (SELECT json_agg(json_build_array(v.abbreviation,
             CASE WHEN r < 0.33 THEN b.book_code || ' ' || c.number
                  WHEN r < 0.66 THEN b.book_code || ' ' || c.number || ':' || s.number
                  ELSE b.book_code || ' ' || c.number || ':' || s.number || '-' || (s.number + 4) END))
           FROM (SELECT chapter_id, number, random() r FROM verses TABLESAMPLE SYSTEM (0.15) LIMIT 20000) s
           JOIN chapters c ON c.id = s.chapter_id JOIN books b ON b.id = c.book_id
           JOIN versions v ON v.id = b.version_id
           WHERE v.abbreviation !~ '[/?#%,]' AND v.abbreviation = btrim(v.abbreviation)),
  'languages', (SELECT json_agg(DISTINCT l.code) FROM versions v JOIN languages l ON l.id = v.language_id),
  'downloads', (SELECT json_agg(abbreviation)
                FROM (SELECT abbreviation FROM versions
                      WHERE verse_count > 30000 AND abbreviation !~ '[/?#%]' AND abbreviation = btrim(abbreviation)
                      ORDER BY random() LIMIT 200) d)
);
