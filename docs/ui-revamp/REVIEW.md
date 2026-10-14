# Revamp review: Praytify Bible portal

Branch `ui/core2-revamp` at `300366d`, 2026-10-14. Static gates and e2e ran on `b4c8730`; the two later commits (`ad5a696`, `300366d`) change only `portal/nginx.conf`, which the final container check covers. The final e2e run (22:22 UTC) started after the lead's last engine (21:18 UTC, version 1.5.0) and gateway (21:50 UTC) restarts. Reviewer: qa-critic (Phase 6).

Every result below was produced on this branch's final tree against the real local stack (gateway `:3200`, engine `:3100`, Postgres with WEB, KJV and AVD seeded; anonymous limit raised to 1,000 a minute for local runs). Commands run from `portal/` unless noted.

## Gate results

| Gate | Command | Result |
|---|---|---|
| Clean state | `git status`; removed `portal/e2e/results`, `portal/dist` (no `playwright-report` or `test-results` present) | clean before and after |
| Type-check | `./node_modules/.bin/tsc -b` | exit 0. Covers `e2e/**` through `tsconfig.node.json` |
| Lint | `./node_modules/.bin/eslint .` | exit 0, no output |
| Unit | `./node_modules/.bin/vitest run` | exit 0. 24 files, 237 tests |
| Build | `./node_modules/.bin/vite build` | exit 0. `dist/embed/v1.js` present (10,710 bytes). Entry 291.29 kB (93.61 kB gzip); no `data:` fonts in the output; recharts only in the `UsagePage` chunk (361.28 kB, 105.55 kB gzip) |
| First-load JS, `/` | Chromium on the preview build, every script requested until network idle, gzip with Node's zlib default | 6 scripts, 567,035 bytes, **180,898 bytes gzip**. Baseline 219,722 bytes gzip (one 741,753-byte bundle, `docs/GAP-EVAL` October 2026): **38,824 bytes smaller (-17.7%)**. Excludes CSS and fonts |
| Contrast | `node scripts/contrast-check.mjs` | exit 0. All 57 gated token pairs meet WCAG AA in light and dark |
| Static gates | from the repo root: `python3 ~/.claude/skills/core2-revamp/scripts/check_gates.py --root portal --src src --ds src/components/ds --primitive-lib radix-ui --identity "Core 2" --identity UI8` | exit 0. identity 0, raw-hex 0, palette 0, primitives 0. `public/` checked by hand: brand SVGs, favicons, `theme-init.js`, `_redirects`, `embed/v1.js`; no template sample assets |
| e2e | `E2E_MODE=preview E2E_OUTPUT_DIR=<scratch> VITE_PUBLIC_SEARCH_KEY=<publishable key> ./node_modules/.bin/playwright test` (both projects, whole suite, one run) | exit 0. **216 passed, 0 failed, 0 flaky, 78 skipped** in 3.4 min. Skips: 76 are the opt-in screens spec, 2 are the reader's keyboard-only cases on mobile. An earlier run on this branch had 6 failures (defects 1 and 2 below); this is the run after both fixes |
| Axe | serious or critical violations, WCAG 2.1 A and AA tags, light and dark, desktop and mobile | **0 serious or critical** in 28 axe tests per project: `/`, `/read/WEB/JHN/3` (bare and with a selection), `/read/AVD/JHN/3`, `/embed`, `/docs` (inside the Scalar frame too), `/docs/quickstart`, `/docs/translations`, `/login`, not-found, `/dashboard`, `/dashboard/keys` (empty, create dialog, reveal), `/dashboard/usage`, `/dashboard/embed`, `/dashboard/settings`, each in light and dark. Covers every page in BRIEF §10 |
| Container | `docker build -f portal/Dockerfile -t praytify-bible-portal:qa --build-arg VITE_API_URL=http://localhost:3200 .` (repo root), run read-only with `--cap-drop ALL --security-opt no-new-privileges` | build exit 0 on `300366d`; every check passed, see below |
| Gateway image | `docker build -t praytify-bible-gateway:qa .`; `docker run --rm --entrypoint id` | build exit 0; `uid=100(app) gid=101(app)` |
| Docs and screens | `QA_SCREENS=1 ... playwright test e2e/qa/screens.spec.ts` | 80 captures in `docs/ui-revamp/screens/`, every one examined, see below |
| Git state | `git status` | clean after the QA commits |

### e2e by spec file

Passed / failed / skipped, desktop (1440x900) and mobile (Pixel 7, 390x844).

| Spec | Desktop | Mobile |
|---|---|---|
| `features/embed.spec.ts` | 10 / 0 / 0 | 10 / 0 / 0 |
| `features/keys.spec.ts` | 5 / 0 / 0 | 5 / 0 / 0 |
| `features/navigation.spec.ts` | 20 / 0 / 0 | 20 / 0 / 0 |
| `features/pages.spec.ts` | 31 / 0 / 0 | 31 / 0 / 0 |
| `features/reader.spec.ts` | 10 / 0 / 0 | 8 / 0 / 2 |
| `qa/axe.spec.ts` | 8 / 0 / 0 | 8 / 0 / 0 |
| `qa/inert-controls.spec.ts` | 16 / 0 / 0 | 16 / 0 / 0 |
| `qa/must-not-regress.spec.ts` | 6 / 0 / 0 | 6 / 0 / 0 |
| `qa/reader-search.spec.ts` | 2 / 0 / 0 | 2 / 0 / 0 |
| `qa/screens.spec.ts` | 0 / 0 / 38 | 0 / 0 / 38 |
| `smoke.spec.ts` | 1 / 0 / 0 | 1 / 0 / 0 |

### Container check

Run four times: mid-pass, on `b4c8730` after the font fixes, on `ad5a696` after the redirect fix, and on `300366d` after HSTS `preload` was dropped; the table is the final state. Image built on the remote dev daemon (linux/amd64), run with `-p 18080:80 --read-only --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run --cap-drop ALL --security-opt no-new-privileges --sysctl net.ipv4.ip_unprivileged_port_start=0`, forwarded to `localhost:8080` (a local process already held 18080, and 8080 is an origin the dev gateway trusts for CORS and `frame-ancestors`).

| Check | Result |
|---|---|
| `GET /` | 200, `Cache-Control: no-cache`, CSP (`default-src 'self'`, `connect-src 'self' http://localhost:3200`, `frame-src http://localhost:3200`, `frame-ancestors 'none'`), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| Hard loads | `/embed`, `/read/WEB/JHN/3`, `/dashboard/keys`, `/no-such-page`: 200 with the app shell. `/embed/` answers 301 with `Location: /embed`, both plainly and with `Host: praytify.bible` (defect 5, fixed) |
| `/embed/v1.js` | 200, `Access-Control-Allow-Origin: *`, `Content-Type: application/javascript`, 1 hour cache with stale-while-revalidate |
| `/assets/*` | `Cache-Control: public, max-age=31536000, immutable`; `Content-Encoding: gzip` with `Vary: Accept-Encoding`. A missing asset is a 404, not `index.html` |
| `/health` | 200 `ok`; Docker health status `healthy` |
| User | `uid=101(nginx)`; nginx logged no errors |
| In the browser | On `b4c8730`, Chromium rendered all 13 routes from the container on both projects, dashboard signed in, the Scalar frame on `/docs` included: zero console errors, zero failed fonts. Rechecked on `300366d` for `/`, `/read/WEB/JHN/3`, `/embed`, `/docs` and `/dashboard`: same result. The mid-pass run had found defects 3 and 4 here |

Containers, images and the forward were removed afterwards (`docker rm -f`, `docker rmi`, `vdk forward --stop`).

### Screens

`docs/ui-revamp/screens/<route-slug>-<width>-<theme>.png`: `home`, `login`, `docs`, `quickstart`, `translations`, `embed`, `read`, `read-rtl` (AVD), `read-selection`, `not-found`, `dashboard-first-run`, `dashboard`, `keys`, `usage`, `dashboard-embed`, `settings` at 1440 and 390, light and dark; plus `menu-open` and `dashboard-menu-open` (390), `keys-create`, `keys-reveal` and `read-search`. Mobile files are 1024 px wide because the Pixel 7 profile renders at 2.625x. `docs` and `read-selection` are viewport captures: a full-page capture stretches the cross-origin Scalar frame before it repaints and drags sticky bars to mid-page.

Examined: brand (Sacred Dawn cream and brown ink, indigo accent, serif italic display line) holds on every route in both themes; no template names, sample data or stock imagery; RTL text runs right to left while chapter navigation stays left to right. The dashboard shows the local stack's raised anonymous limit (1,000 a minute) because it reads the live plan. Nits, not defects: on short pages (not-found) the footer sits mid-viewport with page background below it.

## Must not regress

| # | Item | Verified by | Result |
|---|---|---|---|
| 1 | Auth guard: spinner while pending, redirect only after an empty session, no flash of protected content | `qa/must-not-regress` "1: ..." (session held open, MutationObserver confirms no dashboard nav ever mounts); `navigation` guard round trip | pass |
| 2 | Login bounce and callback | `qa/must-not-regress` "2: ..." (signed-in `/login` goes to `/dashboard`); `pages` redirect tests; `callbackURL` is `${window.location.origin}${returnPath}` (`LoginPage.tsx:39`), read in code because OAuth buttons must not be clicked locally | pass (callback by code read) |
| 3 | Public reads never send credentials or Content-Type | `qa/must-not-regress` "3: ..." reads the headers Chromium actually sent for every `/v1` GET across home, reader, catalog, embed builder and docs while signed in, and proves the cookie does reach `/api/dashboard/*`; `smoke` | pass. Reader search adds only `Authorization: Bearer pb_pk_...`, never the cookie (`qa/reader-search`) |
| 4 | API key shown once, never stored | `keys` "secret key: create, copy, use, last used, roll, revoke" (checks local and session storage) | pass |
| 5 | Revoke confirmation names the key | `keys` (alert dialog names the key and prefix) | pass |
| 6 | Create-key error shown; default name | `qa/must-not-regress` "6: ..." (gateway message in the open dialog, no reveal); `keys` axe test checks the gateway default "Untitled key" | pass |
| 7 | Reader URL contract, RTL, attribution, cross-book prev/next, error and loading states, search and caching | `reader` spec (all eight cases), `qa/axe` AVD, `qa/inert-controls` on GEN 1 and REV 22 (end-disabled arrows); debounce 250 ms (`VersionPicker.tsx:7`) and `staleTime: Infinity` (4 scripture queries) by code read | pass |
| 8 | Translations error state | `pages` "a failed catalog load shows an error and no count" | pass |
| 9 | No fabricated zeros | `pages` usage "a failed summary shows dashes, never zeros"; `qa/must-not-regress` "9: ..." for the overview | pass |
| 10 | Revoked keys excluded from active counts | `qa/must-not-regress` "10: ..." (two keys, one revoked: overview says 1, table lists 1) | pass |
| 11 | Plan numbers are real | `navigation` "plan limits come from the API"; `pages` "quick start shows the signed-in developer's own plan" | pass for signed-in pages. Public pages quote README defaults, see partial features |
| 12 | No template data | static gates; `navigation` "catalog counts are the API's own numbers"; no `mocks`, faker or lorem in `src` | pass |
| 13 | Deployment: SPA fallback, `VITE_API_URL` build arg, chunks under `/assets/` with immutable cache | container check | pass |
| 14 | `rel="noopener noreferrer"` on external links; docs iframe sandbox | `qa/inert-controls` (every external anchor on every route); `pages` sandboxed frame test | pass after defect 1 was fixed (4126739) |
| 15 | Sign out returns to `/` | `navigation` "sign out returns to the home page and ends the session" | pass |
| 16 | TanStack Router, no `next` | `package.json` has `@tanstack/react-router` and no `next` or `next-themes`; no `from "next...` import in `src` | pass |

## Inert controls

**Zero inert controls in shipped UI.** `qa/inert-controls` passes 16 of 16 routes on both projects in the final run.

How it was checked: `e2e/qa/inert-controls.spec.ts` visits 16 routes on both projects: 11 public routes (`/`, `/login`, `/docs`, `/docs/quickstart`, `/docs/translations`, `/embed`, `/read/WEB/JHN/3`, `/read/AVD/JHN/3`, `/read/WEB/GEN/1`, `/read/WEB/REV/22`, and an unknown address) and the 5 dashboard routes signed in with a key in the table. On phones it also opens the menu sheet. For every link and button it fails on: an anchor with no real `href` (missing, `#`, `javascript:`); an in-page `#id` with no target; an internal link that renders the not-found page (each internal target is loaded); an external link without `noopener noreferrer`; an enabled button or link with no accessible name (Playwright's accessible-name computation); a disabled control with no description, title, or reviewed reason. The only disabled controls in shipped default states are the chapter arrows at Genesis 1 and Revelation 22, which must-not-regress 7 requires; the h1 and the pickers beside them name the chapter. It does not click every button: actions are covered by the feature specs. The Scalar reference inside `/docs` is the gateway's page and is covered by axe only.

## Defects found in this pass

| # | Defect | Where | Owner | Severity | Status |
|---|---|---|---|---|---|
| 1 | Widget links use `rel="noopener"` without `noreferrer` | `packages/embed/src/embed.ts:281`, `:296` | lead | low (P3; must-not-regress 14, sends the integrator's page URL as Referer) | fixed in 4126739, verified (final run, and `noopener noreferrer` in the container's `/embed/v1.js`) |
| 2 | Skip-link test presses Tab before the app renders (2 of 16 loads had no anchors at the load event); 3 of 10 isolated runs failed, 16 of 16 passed with a wait for the h1. Harness race, not a product bug | `portal/e2e/features/navigation.spec.ts:209` | ia-navigation | harness | fixed in 363e2a6, verified (final run) |
| 3 | Vite inlines the 1,716-byte Plus Jakarta Sans cyrillic-ext subset as a `data:` font; the portal CSP (`font-src 'self'`) blocks it on every page | `portal/vite.config.ts` (no `assetsInlineLimit`), CSP at `portal/nginx.conf:17`, `:52` | design-system | low (one unicode range falls back; console CSP error on every page) | fixed in b4c8730, verified (rebuilt container: zero CSP and font errors on 13 routes, both projects) |
| 4 | Scalar loads its fonts from `https://fonts.scalar.com`, which the gateway's `fontSrc` does not allow | `src/app.ts:100` | lead | low (cosmetic, 14 CSP errors on `/docs`) | fixed in 4de785b, verified (running gateway serves Scalar with `withDefaultFonts: false`; zero CSP errors on `/docs`) |
| 5 | `/embed/` redirects with nginx's default `absolute_redirect on`, so `Location` is built from the container's scheme and port: `http://localhost/embed` behind `-p 8080:80` (wrong port), `http://praytify.bible/embed` behind the TLS proxy (an http hop). Introduced by the `/embed/` fix (ebe1d48) | `portal/nginx.conf:35-36` | lead | low (trailing-slash URL only) | fixed in ad5a696, verified (`Location: /embed` from the rebuilt container) |


## Gated or partial features

| Feature | State | Reason | What it needs |
|---|---|---|---|
| Terms of Service and Privacy Policy | gated | BRIEF §11: neither document exists, so the login page no longer mentions them (no "terms" or "privacy" text in `src`) | Real documents (a separate legal task), then a route and a link on `/login` |
| Source links (header, footer, hero) | gated on `VITE_SOURCE_URL` | The repository returned 404 on 2026-10-14. Copy still says "open source" and "MIT licensed" without a link | Make the repository public and set the build argument |
| Reader search | gated on `VITE_PUBLIC_SEARCH_KEY` | BRIEF §11. Verified end to end locally with a publishable key restricted to `http://localhost:5199`: results, empty state, result links that open and select the verse, Bearer key without the cookie | An operator creates a production publishable key restricted to the portal origin and passes it as a build argument |
| GitHub and Google sign-in | partial | Buttons follow `/api/auth-methods`. The OAuth round trip cannot complete locally and must not be clicked | A run against staging with real OAuth apps |
| Anonymous limits on public pages | partial | Quick start and other signed-out pages quote README defaults (`features/docs/published-limits.ts`: 120 a minute, 20,000 a day); signed-in pages read `GET /api/dashboard/plan`. If `ANON_RATE_PER_MINUTE` or `ANON_RATE_PER_DAY` changes in production, the public copy drifts | A public limits endpoint, or a release check that compares the constant with production config |
| Reader fallback on a version switch to a translation without the book | partial | WEB, KJV and AVD share all 66 books, so it cannot happen with the seeded stack; unit-tested in `chapter-nav.test.ts`, the missing-book page is covered in e2e via `/read/WEB/TOB/1` | A seeded translation with a partial canon |

## Open owner decisions

- **Terms and Privacy text** (BRIEF §11, BOARD "Decisions needed"). Working default holds: no claim on the login page.
- **Production search key** (BRIEF §11): create the publishable key and pass `VITE_PUBLIC_SEARCH_KEY` at build time.
- **Public repository** (BRIEF §11): make it public and set `VITE_SOURCE_URL`, or keep the source links hidden.
- **HSTS `preload`** (raised in this pass): the lead dropped `preload` in `300366d`; the portal now sends `max-age=31536000; includeSubDomains`. Adding it back and submitting to the preload list is the owner's call, recorded in `docs/DEPLOY.md`.

## Not verified

- OAuth sign-in with GitHub or Google (instructed not to click locally).
- Browsers other than Chromium: no Firefox, WebKit or Safari runs, and no real phones. "Mobile" is Chromium with the Pixel 7 profile.
- Screen readers: no VoiceOver or NVDA pass. Accessibility evidence is axe plus the keyboard paths the specs drive (skip link, verse selection, translation picker, dialogs).
- Production conditions: TLS, HSTS over HTTPS, the production CSP origin, 1,288 translations in the catalog and pickers (the local stack has 3), and the production rate limits (local anonymous limit is raised to 1,000 a minute).
- Pre-revamp comparison: no pre-revamp captures were stored, so the screens were judged against the brand and the AUDIT route table, not pixel-compared with the old UI.
- The widget's dark rendering on a dark OS: headless Chromium reports a light colour scheme, so "Match the visitor's device" was only seen in light.
- Clipboard behaviour on real devices and in browsers that deny clipboard access.
