# UI revamp brief: Praytify Bible portal

## 1. Objective and scope

The Praytify Bible portal (`portal/`, served at praytify.bible) is rebuilt on a design system the project owns, adapted from the Core 2 dashboard template and the Praytify "Sacred Dawn" brand. In scope: every route in `AUDIT.md` (13), plus three new surfaces: a public embed builder (`/embed`), a reader that supports verse selection, sharing, and reading settings, and a key manager for publishable and secret keys. Out of scope: the gateway (`src/`), the engine (`../open-bible-api`), and the SDK and embed packages (`packages/`), which the lead changes on `feat/platform-hardening`. Branch: `ui/core2-revamp` in `.worktrees/core2-revamp`.

## 2. Stack and dependency policy

App dir `portal/`. Vite 8, React 19, TanStack Router (code-based routes) and TanStack Query, Tailwind 4 via `@tailwindcss/vite`, pnpm (always `pnpm install --ignore-workspace`; a stray `~/pnpm-workspace.yaml` breaks plain `pnpm`). Source `portal/src`. Design-system directory `portal/src/components/ds`.

| Need | Use | Why |
|---|---|---|
| Primitives (dialog, dropdown, tabs, tooltip, switch, select, popover) | `radix-ui` | Target has none; Radix is the template-map default and handles focus and ARIA |
| Icons | `lucide-react` | Target has 16 hand-pasted SVGs; lucide is the default and tree-shakes |
| Class merging | a 10-line `cx()` helper in `ds/` | Not worth a dependency |
| Charts | `recharts` (already present), lazy-loaded on the usage route only | Keeps it off public pages |
| Fonts | `@fontsource-variable/plus-jakarta-sans`, `@fontsource-variable/source-serif-4` (roman and italic) | Self-hosted: removes the render-blocking Google Fonts request and the third-party call |
| Theme | a small `ThemeProvider` setting `data-theme` on `<html>`, persisted in `localStorage`, defaulting to the OS | Template uses `next-themes`; this is Vite |
| Tests | `vitest` + `@testing-library/react` (unit), `@playwright/test` + `@axe-core/playwright` (e2e, a11y) | Portal has zero tests today |
| Embed preview | the built `packages/embed/dist/embed.js`, copied to `portal/public/embed/v1.js` at build time | The builder must preview the real widget |

**Forbidden:** `next`, `next-themes`, `@headlessui/react` (Radix instead), `framer-motion` and `react-animate-height` (CSS transitions), `@tiptap/*`, `emoji-picker-react`, `react-datepicker`, `date-fns` (use `Intl`), `swiper`, `react-slider`, `react-tagsinput`, `react-number-format` and `millify` (use `Intl.NumberFormat`), `react-use`, `react-tooltip`, `sharp`, any CSS-in-JS. Anything else needs a line in `BOARD.md` Decisions first.

## 3. Sources

| Source | Path | Used for |
|---|---|---|
| Template | `/Users/jkolade/sireskay/core-2-dashboard-builder-react-efu`, inventory digest `f351f90b607cfc9a` (`docs/ui-revamp/template-inventory.md`) | Structure and markup |
| Brand (current) | `/Users/jkolade/sireskay/github/praytify/DESIGN.md` (Sacred Dawn spec), exports in `/Users/jkolade/sireskay/github/praytify/Praytify-brand/Indigo/` | Colour, type, logo, voice |
| Brand (v1.0, retired palette) | `/Users/jkolade/sireskay/github/praytify/Praytify-brand/BRAND_GUIDELINES.md` | Accessibility rules (§7), tone of voice (§8), logo misuse rules (§2). Its orange palette is not used |
| Audit | `docs/ui-revamp/AUDIT.md` | Route list, findings, the 16 must-not-regress behaviours |
| Gap reports | `docs/GAP-EVAL-2026-07-10.md` (main checkout), `docs/GAP-EVAL-2026-10-14.md` when written | Product context |
| ADRs | `docs/adr/0001-publishable-and-secret-api-keys.md`, `0002-stateless-gateway-and-read-caching.md` (on `feat/platform-hardening`) | Key model the key manager implements |

## 4. Brand and tokens

Sacred Dawn: warm cream paper, deep brown ink, one saturated indigo that carries meaning. Light values from `DESIGN.md`: surface base `#FAF6F1`, raised `#FFFFFF`, sunken `#F4EEE6`, ink `#2C1810`, ink secondary `rgba(44,24,16,0.65)` (check AA on cream; use a solid equivalent if it fails), muted `rgba(44,24,16,0.45)` (large text and decoration only), accent `#4F46E5`, accent text `#4338CA`, accent deep `#1E1B4B`, praise `#F59E0B` (answered-prayer moments only, so effectively unused here), warm `#D4A574`, hairline `rgba(44,24,16,0.08)`. Neutrals tint toward brown; no pure grey, white-on-page, or black.

Dark theme is new scope (the marketing site is light only). The reader needs it for night reading, so design-system derives a dark set: brown-black surfaces, cream ink, a lighter indigo for text and focus. Every pair is checked for AA when it is defined.

Type: Source Serif 4 (display, usually italic 500; also the scripture face), Plus Jakarta Sans (UI and body). Space Grotesk and IBM Plex Mono are in the brand but not needed; eyebrows may use Plus Jakarta Sans small caps tracking instead of adding a fourth font. Radii: 9999 pills, 28 panels, 20 cards, 12 inputs. The signature two-voice headline (bold sans line, italic serif line) is for page-level headlines only.

Logos: `Indigo/wordmark-indigo.svg` (light), `Indigo/wordmark-white.svg` (dark), `Indigo/favicon-indigo-white.svg` and `.png` (favicon, touch icon), `Indigo/icon-white.svg`. Copy only these into `portal/public/brand/`. Banned (from `DESIGN.md`): three-up icon card grids, `background-clip: text` gradients, coloured side-stripe borders, hero-metric templates, glassmorphism, invented content.

## 5. Information architecture

Personas:
- **Reader** (anonymous): wants to read a chapter now, on a phone, in their language. Home is `/read`.
- **Integrator** (developer at a church, ministry, or app studio, including the Praytify team): wants a key, a working first call, an embed snippet, and proof of usage. Home is `/dashboard`.
- **Visitor** evaluating the platform: wants to know what it is, see it work, and find the docs and source. Home is `/`.

Public navigation: Read, Embed, Docs (Quick start, API reference, Translations), GitHub (external), Sign in or Dashboard. Mobile: a menu button opening a sheet with the same items.
Dashboard navigation (sidebar, collapsible to a sheet on mobile): Overview, API keys, Usage, Embed, Settings, then Docs and Sign out.

| Current route | New route | Owner |
|---|---|---|
| `/` | `/` | ia-navigation |
| `/login` | `/login` | page-migration |
| `/docs` | `/docs` (API reference) | page-migration |
| `/docs/quickstart` | `/docs/quickstart` | page-migration |
| `/docs/translations` | `/docs/translations` | page-migration |
| `/read` | `/read` (redirect kept, last-read location wins when stored) | feature-builder: reader |
| `/read/$version/$book/$chapter` | same, plus `?v=16` or `?v=16-18` to select verses | feature-builder: reader |
| `/dashboard` | `/dashboard` | ia-navigation |
| `/dashboard/keys` | `/dashboard/keys` | feature-builder: keys |
| `/dashboard/usage` | `/dashboard/usage` | page-migration |
| `/dashboard/settings` | `/dashboard/settings` | page-migration |
| (new) | `/embed` (public builder) and `/dashboard/embed` (same component in the shell) | feature-builder: embed |
| (new) | `/privacy`, `/terms` only if the owner supplies text (see §11) | page-migration |

## 6. Signature features

1. **Reader** (frame: `templates/Products/OverviewPage` content column with `components/Tabs` and `components/Select` for pickers). Version picker with search, book and chapter picker, prev and next across books, keyboard shortcuts (left and right arrows for chapters), RTL, attribution. New: tap or click verses to select a range, then copy (text plus reference plus attribution), copy a share link (`?v=`), or copy an embed snippet; `?v=` deep links scroll to and highlight the verses; reading settings (text size, theme, verse numbers on or off) persisted locally; last-read location stored and used by `/read`; switching version keeps the book and chapter when the new version has them. Works end to end when a visitor opens a shared link, sees the verses highlighted, changes the theme, reloads, and the setting persists. Optional search box shown only when `VITE_PUBLIC_SEARCH_KEY` is set (a publishable key restricted to the portal's origin); absent otherwise.
2. **Key manager** (frame: `templates/Customers/CustomerList` table plus `components/Modal`). Create a secret or publishable key, set allowed origins for publishable keys (validated as `https://host` or `https://*.host`, plus `http://localhost:*` for development), rename, roll (issue a replacement and revoke the old one in one action), revoke with a confirmation naming the key, copy the key once with honest copy feedback. Shows kind, prefix, origins, tier, created, last used, expiry. Works end to end when a key is created, used against the API, its last-used time updates, and after reload the list shows it; revoking removes it after reload.
3. **Embed builder** (frame: `templates/Products/NewProductPage` two-column form and preview). Inputs: reference, version (searchable), theme, attribution on or off (with a licence warning when turned off), link on or off, widget type (passage or daily verse). Live preview renders the real `<praytify-verse>` from `/embed/v1.js`. Output: copyable HTML snippet and an SDK snippet. Public at `/embed`, also inside the dashboard. Works end to end when the snippet pasted into a blank HTML file renders the same passage.

## 7. Backend change policy

The UI team does not edit `src/`, `packages/`, or the engine. The lead implements the contract below on `feat/platform-hardening` and merges it into `ui/core2-revamp`; build against this contract and log any mismatch in `BOARD.md`.

Dashboard API (credentialed `fetchAPI`, session cookie):
- `GET /api/dashboard/keys` → `{ keys: Key[] }` where `Key = { id, name, kind: "secret" | "publishable", prefix, allowedOrigins: string[], tier: "free" | "partner" | "internal", createdAt, lastUsedAt: string | null, expiresAt: string | null }`
- `POST /api/dashboard/keys` body `{ name, kind, allowedOrigins?: string[], expiresInDays?: number }` → `201 { key: Key & { key: string } }`. Publishable keys require at least one origin (`400` otherwise).
- `PATCH /api/dashboard/keys/:id` body `{ name?, allowedOrigins? }` → `{ key: Key }`
- `POST /api/dashboard/keys/:id/roll` → `201 { key: Key & { key: string }, revokedId: string }`
- `DELETE /api/dashboard/keys/:id` → `{ revoked: true, id }`
- `GET /api/dashboard/usage?days=30[&keyId=]` → `{ period: { days, from, to }, daily: { date, requests, errors, avgResponseTimeMs }[] }` (dates are UTC `YYYY-MM-DD`; the page zero-fills missing days and formats in UTC)
- `GET /api/dashboard/usage/summary` → `{ summary: { totalRequests, totalErrors, avgResponseTimeMs, requestsToday, activeKeys, periodDays } }`
- `GET /api/dashboard/usage/keys?days=30` → `{ keys: { keyId, name, kind, requests, errors }[] }`
- `GET /api/dashboard/plan` → `{ tier, limits: { secret: { perMinute, perDay }, publishable: { perMinute, perDay }, anonymous: { perMinute } } }`. All plan and limit copy comes from here.
- `GET/PUT /api/dashboard/profile`. `PUT` is now a partial update (only fields sent change). A failed `GET` must still block the form (fixes the blank-save finding).
- `GET /api/auth-methods` (public, no credentials needed) → `{ github, google, emailPassword }`. The login page renders only the methods that are `true`. When `emailPassword` is true, show an email and password form (sign in and sign up) using the BetterAuth client (`signIn.email`, `signUp.email`; minimum 12 characters). When every method is false, show an honest "sign-in is not configured on this server" state.

Errors: new envelope `{ error: { code, message } }`. `lib/api.ts` (lead, done) throws `ApiError` with `status`, `code`, and `retryAfter`, and parses both envelopes. It also exposes `keys.update/roll`, `usage.byKey`, `plan.get`, `authMethods.get`, `bible.passage/daily/search/languages`, and `PUBLIC_SEARCH_KEY`. Build against those functions; do not call `fetch` from pages.

Public API (anonymous `fetchPublic`, never credentials): all current public routes, plus `GET /v1/verses?ref=&version=` which becomes public. Its `data` gains `bookCode` and `chapter`. `GET /v1/search` needs a key (a publishable key works from an allowed origin). Responses carry `ETag` and `Cache-Control`; rate-limited responses are `429` with `Retry-After`.

Protections that must not be weakened: everything in `AUDIT.md` "Must not regress", especially the credential split in `lib/api.ts` (item 3) and show-once keys (item 4).

## 8. Team and file ownership

| Role | Owns (paths, relative to `portal/` unless noted) |
|---|---|
| design-system | `package.json` and `pnpm-lock.yaml` (dependency changes for everyone), `index.html`, `src/index.css`, `src/components/ds/**`, `src/lib/theme.tsx`, `public/brand/**`, `public/favicon*`, `vite.config.ts`, `vitest.config.ts`, `docs/ui-revamp/CONTRACTS.md` (repo-relative) |
| ia-navigation | `src/router.tsx`, `src/components/shell/**` (replaces `RootLayout.tsx`, `DashboardLayout.tsx`), `src/lib/nav.ts`, `src/pages/LandingPage.tsx`, `src/pages/DashboardOverview.tsx` |
| feature-builder: reader | `src/pages/ReadPage.tsx`, `src/features/reader/**` |
| feature-builder: keys | `src/pages/ApiKeysPage.tsx`, `src/features/keys/**` |
| feature-builder: embed | `src/pages/EmbedPage.tsx`, `src/features/embed/**`, `public/embed/**`, `scripts/copy-embed.mjs` |
| page-migration | `src/pages/LoginPage.tsx`, `DocsPage.tsx`, `QuickStartPage.tsx`, `TranslationsPage.tsx`, `UsagePage.tsx`, `SettingsPage.tsx`, `src/components/CodeBlock.tsx` (moves to `ds/` via design-system), any legal pages |
| lead | `src/lib/api.ts`, `src/lib/auth.ts`, `src/main.tsx`, `Dockerfile`, `docs/ui-revamp/BRIEF.md`, `BOARD.md` |
| qa-critic | `e2e/**`, `playwright.config.ts`, `docs/ui-revamp/screens/**`, `docs/ui-revamp/REVIEW.md` |

Agents commit only their own paths with explicit pathspecs (`git add <paths> && git commit -m … -- <paths>`), never `git add -A` or `git commit -a`, because several agents share this worktree.

## 9. Phases

0. Audit (done): `AUDIT.md`, this brief, `BOARD.md`.
1. Foundation (design-system, alone): upgrade portal dependencies to current majors and verify the build; tokens (light and dark, AA-checked); fonts; theme provider; logo; favicon and meta; primitives: Button, IconButton, Field, TextArea, Select (Radix), Checkbox, Switch, Tabs, Dialog, ConfirmDialog, DropdownMenu, Tooltip, Card, Table, Badge, Alert, EmptyState, Spinner, Skeleton, CopyButton (honest success and failure), CodeBlock, Sheet (mobile nav), Eyebrow, Stat; `CONTRACTS.md`. Vitest set up with primitive tests.
2. IA and home (ia-navigation, after CONTRACTS token table and Button, Sheet, DropdownMenu exist): public shell with mobile menu and theme toggle; dashboard shell with sidebar and mobile sheet; landing page with a live daily verse and real catalog counts; dashboard overview with real summary and first-run state; route-level code splitting (lazy routes) for everything except the shell.
3. Signature features (three feature-builders in parallel, after Phase 1): reader, key manager, embed builder. The key manager waits for the lead's backend merge before its end-to-end test, not before building.
4. Page migration (page-migration, parallel with 3).
5. Cross-feature flows (lead): reader to embed builder (embed snippet from a selection), translations list to reader, dashboard quick start to keys, keys to usage per key.
6. Verification (qa-critic): e2e per persona, axe light and dark, screenshots of every route at 1440x900 and 390x844, static gates, `REVIEW.md`.

## 10. Done definition

```
type-check:  cd portal && ./node_modules/.bin/tsc -b
lint:        cd portal && ./node_modules/.bin/eslint .
unit tests:  cd portal && ./node_modules/.bin/vitest run
build:       cd portal && ./node_modules/.bin/vite build   (must also emit dist/embed/v1.js)
e2e:         start the local stack with `scripts/dev-stack.sh up` from the repo root (native Postgres, engine, gateway with a sample of public-domain translations), then
             cd portal && ./node_modules/.bin/playwright test
static:      python3 ~/.claude/skills/core2-revamp/scripts/check_gates.py --root portal --src src --ds src/components/ds --identity "Core 2" --identity UI8
axe pages:   /, /read/WEB/JHN/3, /embed, /docs/quickstart, /docs/translations, /dashboard, /dashboard/keys, /dashboard/usage, /dashboard/settings (light and dark)
```

## 11. Owner decisions

- **Terms of Service and Privacy Policy text.** The login page promises both; neither exists. Default: remove the sentence until real documents exist, and list it as gated in `REVIEW.md`. Drafting them is a separate legal task.
- **Public search key for the reader.** Default: search box hidden unless `VITE_PUBLIC_SEARCH_KEY` is configured at build time. Creating that publishable key in production is an operator step.
- **GitHub link target.** Default: `https://github.com/praytify-app/bible-api`, shown only if the repository is public at release time.
- **Dark theme on a light-only brand.** Default: ship it (the reader needs night reading); the marketing site's light-only rule applies to marketing pages, which default to light here too unless the OS prefers dark.
