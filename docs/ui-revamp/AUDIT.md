# UI audit: Praytify Bible portal

Audited: 2026-10-14, branch ui/core2-revamp, commit 4672eea

## Stack

- **Framework:** Vite 8 + React 19.2 SPA. TanStack Router 1.167 with code-based routes (`portal/src/router.tsx`), TanStack Query 5.90 (defaults `staleTime: 30_000`, `retry: 1`, `main.tsx:8-15`), better-auth 1.5 React client (`lib/auth.ts`), TypeScript 5.9.
- **Package manager:** pnpm. There is no `packageManager` field; `portal/Dockerfile` pins pnpm 9.15.0 through corepack. Output is static files served by nginx with an SPA fallback (`Dockerfile:31`, `public/_redirects`).
- **Tailwind:** 4.2 via `@tailwindcss/vite`, with no `tailwind.config`. All tokens sit in one `@theme` block (`index.css:3-20`): 11 indigo `primary-*` colors and 2 font families. There are no semantic tokens (surface, ink, border, danger, success).
- **UI dependencies:** `recharts` 3.8, used only by UsagePage. There is no component library, no headless primitives, no icon package and no class-merge helper. The only shared primitive is `components/CodeBlock.tsx`. Buttons, cards, inputs, tables, alerts and spinners are rewritten inline on each page.
- **Styling:** utilities only. 13 of 15 `.tsx` files carry 341 `className` attributes. CSS is 1 file of 31 lines (27 non-blank, 16 of them token declarations). Inline `style` appears twice: skeleton widths (`ReadPage.tsx:152`) and the recharts tooltip (`UsagePage.tsx:123-128`).
- **Icons:** 16 inline `<svg>` literals in 7 files. They are hand-pasted Heroicons v1 outline paths plus the GitHub and Google marks, with path strings kept in data arrays (`DashboardLayout.tsx:5-10`, `LandingPage.tsx:51-82`). None has `aria-hidden`.
- **Fonts:** a Google Fonts CSS2 `<link>` in `index.html:9-11`, with preconnect, `display=swap` and render-blocking. Plus Jakarta Sans loads 400/500/600/700. Source Serif 4 loads 400/600/700 roman only, with no `ital` axis. Fonts are not self-hosted.
- **Theme:** light only. There are no `dark:` variants, no `prefers-color-scheme` handling and no toggle, and the shell hardcodes `bg-white` (`RootLayout.tsx:14`). The template does dark mode through `[data-theme=dark]` and `next-themes`, so dark mode would be new scope, not a port.
- **Tests:** none for the portal. The root `tests/` covers `db` and `middleware` only.
- **Dead assets:** `src/assets/hero.png` (45 KB), `src/assets/react.svg`, `src/assets/vite.svg` and `public/icons.svg` have no references. They are leftovers from the Vite scaffold.

## Routes

`router.tsx` defines 13 routes: 2 layouts, 10 pages and 1 redirect. Template paths below are relative to `/Users/jkolade/sireskay/core-2-dashboard-builder-react-efu/` and were confirmed with `ls`.

| Route | Purpose | Data source | Inert or fake controls | Closest template match | Status |
|---|---|---|---|---|---|
| `__root__` (`RootLayout`) | Header, top nav, footer | `useSession()` | Nav links are `hidden md:flex` with no mobile menu (`RootLayout.tsx:23`). "Sign in" shows while the session is pending (`:51`) | `components/Header`, `components/Layout` | pending |
| `/` (`LandingPage`) | Marketing page, code samples, CTAs | Static constants, no fetch | Stats "600+ / 100+ / Free / 1K" are hardcoded (`LandingPage.tsx:84-89`). Code copy gives no feedback (`CodeBlock.tsx:34`) | `templates/UpgradeToProPage` (Pricing + Faq; the template has no public landing page) | pending |
| `/login` (`LoginPage`) | GitHub and Google OAuth | `signIn.social` | "Terms of Service and Privacy Policy" is plain text with no link or route (`LoginPage.tsx:79`) | `components/Login/SignIn` | migrated by page-migration, e2e and axe green; awaiting qa-critic |
| `/docs` (`DocsPage`) | Embeds the engine's Scalar reference | iframe `${API_URL}/docs` (`DocsPage.tsx:7`) | No load or error state; a dead API shows a blank frame | `components/Layout` (the template has no docs page) | migrated by page-migration, e2e and axe green; awaiting qa-critic |
| `/docs/quickstart` (`QuickStartPage`) | 4-step guide and endpoint list | Static; `VITE_API_URL` | Says all 8 endpoints need a key (`QuickStartPage.tsx:94`); 5 are public | `templates/SettingsPage` (side `Menu` + anchored section cards) | migrated by page-migration, e2e and axe green; awaiting qa-critic |
| `/docs/translations` (`TranslationsPage`) | Searchable translation catalog | `translations.list()` -> `fetchPublic('/v1/versions?limit=2000')` | Abbreviations are not links to the reader | `templates/Customers/CustomerList/CustomerListPage` | migrated by page-migration, e2e and axe green; awaiting qa-critic |
| `/read` (redirect) | Sends to `/read/WEB/JHN/3` with `replace` | None | n/a | n/a (redirect, no UI) | pending |
| `/read/$version/$book/$chapter` (`ReadPage`) | Public Bible reader | `bible.version/books/chapterVerses/versions` (all `fetchPublic`) | None inert. Switching version resets to chapter 1 (`ReadPage.tsx:125`) | `components/Select` + `components/Search` (no reader template) | pending |
| `/dashboard` (`DashboardLayout`) | Auth guard and sidebar | `useSession()` | Sidebar is `hidden md:block` with no mobile alternative (`DashboardLayout.tsx:39`) | `components/Sidebar` + `components/Layout` | pending |
| `/dashboard/` (`DashboardOverview`) | Summary cards and quick start | `usage.summary()`, `keys.list()` | Shows "0" while loading (`DashboardOverview.tsx:43,49,55`). Shows the "Create your first API key" CTA while keys are loading or failed (`:75-87`) | `templates/HomePage` (Overview) | pending |
| `/dashboard/keys` (`ApiKeysPage`) | Create, list and revoke keys | `keys.list/create/revoke` (`fetchAPI`, credentialed) | Dismiss X has no label (`ApiKeysPage.tsx:98`). "Copied!" shows even when the copy failed (`:40-44`) | `templates/Customers/CustomerList/CustomerListPage` + `components/Modal` + `components/Table` | pending |
| `/dashboard/usage` (`UsagePage`) | 4 stat cards and a 30-day line chart | `usage.daily(30)`, `usage.summary()` | Chart dates are off by one west of UTC (finding 3) | `templates/Income/EarningPage` | migrated by page-migration, e2e and axe green; awaiting qa-critic |
| `/dashboard/settings` (`SettingsPage`) | App profile form and plan | `profile.get/update` | Plan badge and limits are hardcoded and ignore `profile.tier` (`SettingsPage.tsx:126-131`) | `templates/SettingsPage` (`ProfileInformation`) | migrated by page-migration, e2e and axe green; awaiting qa-critic |

## Findings

Severity: **P1** breaks a task or misleads the user. **P2** is an accessibility, correctness or performance gap. **P3** is brand or consistency drift.

### P1

1. **No mobile navigation anywhere.** The header links are `hidden md:flex` (`RootLayout.tsx:23`) and the dashboard sidebar is `hidden md:block` (`DashboardLayout.tsx:39`). Nothing replaces either one. Below 768px, a signed-in developer cannot navigate to Keys, Usage or Settings, and a visitor cannot reach Docs, Quick Start or Translations from the header.
2. **Fake empty and zero states remain on three data paths.**
   - The keys list query has no `isError` branch (`ApiKeysPage.tsx:12-15`). A failed fetch therefore renders "No API keys yet" plus a create CTA (`:204-222`).
   - The Overview shows "0" while loading and shows the first-key CTA while keys are loading or failed (see the Routes table).
   - **Data loss:** the Settings profile query has no loading or error state (`SettingsPage.tsx:23-26`). If it fails, the form renders blank, and "Save Changes" PUTs empty strings over the stored profile (`:37`).
   - Error coverage: 8 of 11 `useQuery` calls show their errors. The 3 that don't are the keys list, the profile, and the reader's `versionDetail` (`ReadPage.tsx:25-29`). 2 of 3 mutations have no `onError`: revoke (`ApiKeysPage.tsx:33-38`) and profile save (`SettingsPage.tsx:36-43`). Both fail silently.
3. **The usage chart misstates the data.**
   - The gateway returns only days that have rows (`src/routes/usage.ts:25-35`). The client zero-fills only when the array is empty (`UsagePage.tsx:36-38`), although the comment at `:34` promises to fill sparse data. A sparse month draws a straight line across the missing days.
   - Dates are parsed with `new Date("YYYY-MM-DD")`, which gives UTC midnight, then rendered with local `getMonth/getDate` (`UsagePage.tsx:113-116`, `:134`). For viewers west of UTC, every tick and tooltip is one day early.
   - The cards show totals over all retained history, because the summary query has no date filter. The subtitle says "last 30 days" (`UsagePage.tsx:55`). Totals come from the hourly rollup while "Requests Today" reads raw logs, so on the Overview the total can briefly be lower than today's count.
4. **Copy that the code does not back up.**
   - Quick Start says every listed endpoint "require[s] a valid API key" (`QuickStartPage.tsx:94`). 5 of the 8 are public (`src/index.ts:82-89`: languages, versions, books, chapters, daily).
   - The translation count is "600+" in 5 places (`index.html:8`; `LandingPage.tsx:53,54,85,106`) and "1,200+" in the reader (`ReadPage.tsx:300`). Production holds 1,288 versions, per the 2026-07-11 addendum to the July gap report (`docs/GAP-EVAL-2026-07-10.md`). The real language count is [METRIC NEEDED].
   - "track your application's performance in real time" (`LandingPage.tsx:69`) is not accurate: the dashboard shows daily rollups.
   - The login page refers to Terms and Privacy pages that don't exist (`LoginPage.tsx:79`).
   - "Every translation is redistributable" (`LandingPage.tsx:79`) cannot be checked from the portal. The reader renders attribution only when it is present (`ReadPage.tsx:171`), which suggests some versions have none. [VERIFY against engine data]
   - The Settings plan copy matches the limiter today (`src/middleware/rate-limit.ts:134-135`). It is hardcoded, though, so it goes stale as soon as a second tier exists (`api.ts:101` already carries `tier`).
   - "Star on GitHub" and the footer link point to `github.com/praytify` (`LandingPage.tsx:209`, `RootLayout.tsx:106`). Whether a public repository exists there is [UNVERIFIED].
5. **Copy feedback is wrong on the one screen where it matters.** `handleCopy` ignores the promise from `writeText` and always sets "Copied!" (`ApiKeysPage.tsx:40-44`). The key is shown only once, so a silent clipboard failure (insecure context, denied permission) loses it. CodeBlock's copy button has no feedback and no error handling at all (`CodeBlock.tsx:34`).
6. **The reader silently drops attribution and RTL.** `versionDetail` has no error handling (`ReadPage.tsx:25-29`). When it fails, `dir` falls back to `ltr` (`:83`) and the attribution block disappears (`:171`). The `license` (`api.ts:147`) and `licenseUrl` (`api.ts:127`) fields are never rendered anywhere.

### P2: accessibility

7. **Labels:** 4 `<label>` elements have no `htmlFor`/`id` pairing (`ApiKeysPage.tsx:117`; `SettingsPage.tsx:61,74,87`). 3 controls have no label at all, only placeholders: the translations search and language select (`TranslationsPage.tsx:49,57`) and the reader's version search (`ReadPage.tsx:295`, which also sets `autoFocus`).
8. **Focus:** the codebase has no `focus-visible` styles. Buttons and links fall back to the browser outline. Seven inputs replace it with `focus:outline-none focus:ring-2 focus:ring-primary/30`. That ring is 30% alpha and barely visible, so the 1px `border-primary` is the only real focus indicator.
9. **Icon-only controls:** the new-key dismiss button has no accessible name (`ApiKeysPage.tsx:98-105`). The code copy button is named only by `title` (`CodeBlock.tsx:33-36`). `ChapterArrow` is labelled correctly (`ReadPage.tsx:256`). 16 decorative SVGs lack `aria-hidden`.
10. **Disclosure widgets:**
    - The version and book picker toggles have no `aria-expanded` or `aria-controls`. Escape and outside clicks don't close them, and focus doesn't return to the toggle (`ReadPage.tsx:91-106,124-134`).
    - Book rows have no `aria-expanded` (`:366`).
    - CodeBlock tabs are plain buttons, with no `tablist` role or `aria-selected` (`CodeBlock.tsx:13-26`).
11. **Landmarks and headings:**
    - ReadPage renders a `<main>` (`ReadPage.tsx:138`) inside RootLayout's `<main>` (`RootLayout.tsx:79`).
    - Dashboard pages have two unlabelled `<nav>` regions (`RootLayout.tsx:17`, `DashboardLayout.tsx:40`), and the header `<nav>` also wraps the logo and auth controls. There is no skip link.
    - ApiKeysPage jumps from h1 to h3 (`:113`, `:211`). ReadPage has an h1 only after a successful load (`:157`).
    - Inference, check in a browser: TanStack `Link` probably sets `aria-current` with fuzzy matching, while the visual active state uses exact matching (`DashboardLayout.tsx:42`). If so, "Overview" reports itself as current on every dashboard child page.
12. **Language:** scripture renders under `<html lang="en">` with only `dir` set (`ReadPage.tsx:138`). Screen readers read non-English translations in an English voice. A `lang={languageCode}` attribute is missing.
13. **Contrast:**
    - `text-gray-400` (#9CA3AF, 2.54:1 on white) is used 12 times. That includes license attribution (`ReadPage.tsx:172`), the ".bible" wordmark (`RootLayout.tsx:21`) and endpoint descriptions (`QuickStartPage.tsx:259`). The chart ticks use the same hex (`UsagePage.tsx:112,119`).
    - Revamp trap: `text-gray-500` (38 uses) passes on white at 4.83:1, but on cream #FAF6F1 it drops to 4.49:1, just under AA. Brown ink #2C1810 on cream measures 15.67:1.
14. **Motion:** 6 `animate-*` uses, including an endless pulse on the landing badge (`LandingPage.tsx:98`). There are no `motion-reduce` variants.

### P2: robustness and performance

15. **No code splitting.** All 10 page modules are imported statically (`router.tsx:9-18`), so recharts (`UsagePage.tsx:2-10`) ships to anonymous landing and reader visitors. Bundle size was not measured because the worktree has no `node_modules`. Record a `pnpm build` baseline before migrating.
16. **No router-level fallbacks.** There is no `notFoundComponent`, `errorComponent` or pending UI (`router.tsx:21-23,124`), so unknown URLs and render errors fall through to TanStack's defaults.
17. **Auth flow gaps.**
    - The guard runs in a component effect (`DashboardLayout.tsx:17-21`), not in `beforeLoad`.
    - Deep links are lost: the redirect carries no return path, and the OAuth `callbackURL` is fixed to `/dashboard` (`LoginPage.tsx:18,22`).
    - The OAuth buttons have no pending state, and OAuth errors are never shown (`LoginPage.tsx:17-23`).
18. **No `<form>` elements.** Pressing Enter does not submit Create Key or Settings, and App URL has no validation (`SettingsPage.tsx:78`).
19. **Translations catalog.**
    - `limit=2000` is a hard cap (`api.ts:133,170`), so anything past 2,000 versions is silently dropped.
    - All ~1,288 rows render with no pagination (`TranslationsPage.tsx:115-132`).
    - `translations.list` and `bible.versions("")` fetch the same payload under two query keys.
    - `Translation` types `language` as non-null (`api.ts:124`), while `BibleVersion` types the same field as nullable (`api.ts:143`). `t.language.toLowerCase()` (`TranslationsPage.tsx:27`) throws if it is ever null.
20. **Layout edge cases.**
    - BookPicker shows "Loading..." forever when the book list is empty (`ReadPage.tsx:360-361`).
    - `min-h-screen` (`:86`) and `sticky top-16` (`:88`) hardcode the 64px header height.
    - The Docs iframe uses `h-[calc(100vh-4rem)]` (`DocsPage.tsx:5`), which ignores the footer and produces a double scrollbar.
21. **No per-route `document.title` or meta.** Every page, including every scripture passage, is titled "Praytify Bible - Open Bible API for Developers" (`index.html:7`). The reader's comment claims passages are "shareable and crawlable" (`ReadPage.tsx:9-10`). They are shareable, but there is no prerender, so the crawlable part doesn't hold.

### P3: brand and consistency

22. **Sacred Dawn is not implemented.**
    - Cream #FAF6F1 and brown ink #2C1810 are never used. Surfaces are `bg-white` (32 uses) and ink is `text-gray-900`.
    - Stock-palette classes total 254. By file: ApiKeysPage 42, ReadPage 40, RootLayout 25, QuickStartPage 24, TranslationsPage 23, DashboardOverview 21, UsagePage 20, LandingPage 19, SettingsPage 16, CodeBlock 11, LoginPage 10, DashboardLayout 3.
    - By family: `text-gray` 138, `border-gray` 48, `bg-gray` 24, red 21, green 16, amber 4, `divide-gray` 3.
    - There are no `bg-indigo-*` or `text-indigo-*` classes; indigo always goes through `primary-*` (78 uses).
23. **Hex values in TSX: 12.**
    - UsagePage has 8 (`UsagePage.tsx:109-156`): grid #f0f0f0, ticks #9ca3af x2, tooltip border #e5e7eb, line #4F46E5 x2, errors #ef4444 x2. All duplicate existing tokens.
    - LoginPage has 4 (`LoginPage.tsx:58-70`). These are the Google mark's required colors and should stay.
24. **Typography.**
    - `font-serif` is used on only 3 elements (`LandingPage.tsx:101`, `ReadPage.tsx:157,161`). The brand's Source Serif 4 italic display style is never used, and the italic face isn't loaded.
    - `font-extrabold` (800) is used twice (`LandingPage.tsx:101,145`), but the heaviest loaded weight is 700.
    - The brand calls for #4338CA on text. The 22 `text-primary` uses render #4F46E5 instead. It passes AA (6.29:1 on white, 5.84:1 on cream) but is off-spec.
25. **Inconsistent examples and leftovers.**
    - The Overview sample uses `YOUR_API_KEY` (`DashboardOverview.tsx:70`); every other sample uses `pb_your_api_key`.
    - The API base fallback is `http://localhost:3200` in the libraries (`api.ts:1`, `auth.ts:3`) but the production URL in the samples (`QuickStartPage.tsx:5-6`).
    - CodeBlock accepts a `language` prop but never highlights anything (`CodeBlock.tsx:4`).
    - The "Use Case" select writes to `description` (`SettingsPage.tsx:90-92`).

## Must not regress

None of the behaviour below has an automated test. Add Playwright smoke coverage for items 1 to 9 before the first page migrates.

1. **Auth guard** (`DashboardLayout.tsx:17-33`). It redirects to `/login` only after the session resolves empty (`:17-21`), shows a spinner while pending (`:23-29`), and renders `null` while unauthenticated so protected content never flashes (`:31-33`). Moving the guard into `beforeLoad` is fine if all three states hold.
2. **Login bounce and callback.** Signed-in users are sent to `/dashboard` (`LoginPage.tsx:9-13`). `callbackURL` is built from `window.location.origin`, the portal's origin, not the API's (`:15-23`).
3. **Credentialed and public fetches stay separate.**
   - `fetchAPI` sends `credentials: "include"` to `/api/dashboard/*` (`api.ts:3-11`). This pairs with the gateway's origin-pinned, credentialed CORS (`src/index.ts:25-31`).
   - `fetchPublic` sends no credentials and no Content-Type (`api.ts:21-37`). `/v1/*` answers with a wildcard origin (`src/index.ts:34`), and browsers reject credentialed requests against a wildcard. Leaving out Content-Type also skips the preflight.
   - Every `translations.*` and `bible.*` call must stay on `fetchPublic` (`api.ts:130-135,167-187`). No shared wrapper or query default may add credentials or headers globally. This exact regression was fixed in c167e10.
4. **API key shown once.** The banner renders only from the create response (`ApiKeysPage.tsx:73`), warns "It will not be shown again" (`:84`), and clears when dismissed (`:99`). The list shows only the prefix (`:180-182`; `api.ts:44`). Never put the full key in the query cache, browser storage, or a toast that outlives the banner.
5. **Revoke confirmation** (`ApiKeysPage.tsx:189-193`). A `components/Modal` replacement that names the key and shows pending and error states is welcome. A one-click revoke is not.
6. **Create-key error is shown** (`ApiKeysPage.tsx:28-30,66-70`). The default name stays "Untitled Key" (`:130`).
7. **Reader.**
   - **URL contract:** `/read/$version/$book/$chapter` (`router.tsx:70-74`) and the `/read` redirect to WEB/JHN/3 with `replace` (`router.tsx:58-68`). These links are shared outside the app.
   - **RTL:** `dir` comes from `textDirection` (`ReadPage.tsx:83,138`), and navigation is pinned to `ltr` (`:193,216`).
   - **License attribution** with its source link (`ReadPage.tsx:171-188`).
   - **Cross-book prev/next** (`ReadPage.tsx:63-81`). It drives the labelled, end-disabled toolbar arrows (`:109-120,253-257`) and the bottom links (`:193-214`).
   - **Error and loading states:** the chapter error names book, chapter and version (`:139-148`), and a skeleton shows while loading (`:149-154`).
   - **Search and caching:** version search is server-side and debounced by 250 ms (`:281-290`). Scripture queries use `staleTime: Infinity` (`:28,37,47`).
8. **Translations browser error state.** It has its own error panel (`TranslationsPage.tsx:81-89`), hides the count on error (`:73-77`), and keeps a separate no-match empty state (`:137-142`).
9. **Usage page never fabricates zeros.** Errors render a banner and "--", never 0 (`UsagePage.tsx:59-64,71-89`). The chart checks for an error before checking loading (`:97-100`). Zero-fill happens only after a successful response (`:34-48`). The Overview follows the same rule (`DashboardOverview.tsx:31-36,43-55`). Fixing finding 3 should extend this rule, not replace it.
10. **Active key counts exclude revoked keys.** Both the list and the summary filter on `revoked = false` (`src/routes/keys.ts:25`; usage summary). The Overview prefers `keyList.length` (`DashboardOverview.tsx:55`).
11. **Plan numbers must be real.** The rate-limit copy matches the limiter (`SettingsPage.tsx:130` vs `src/middleware/rate-limit.ts:134-135`). If the revamp borrows `templates/UpgradeToProPage/Pricing`, every number must trace back to the limiter or to `profile.tier`.
12. **No template data.** None of the template's `mocks/` may ship. Every number on screen comes from `lib/api.ts`, and the query defaults (`main.tsx:8-15`) stay.
13. **Deployment.**
    - The SPA fallback stays in place (`public/_redirects`, nginx `try_files` at `Dockerfile:31`).
    - `VITE_API_URL` remains a build argument (`Dockerfile:12-13`).
    - Split chunks must stay under `/assets/` so the 1-year immutable cache rule still applies (`Dockerfile:35-36`).
14. **External links and the docs iframe.** Keep `rel="noopener noreferrer"` on every external link (`RootLayout.tsx:92,108`; `LandingPage.tsx:211`; `ReadPage.tsx:180`). Keep the docs iframe's `sandbox` (`DocsPage.tsx:10`).
15. **Sign out** returns to `/` (`RootLayout.tsx:8-11`).
16. **Router stays TanStack.** Keep TanStack Router with code-based routes. The template's `next/link`, `next/image` and `next-themes` imports (in Header, Sidebar, Logo, Button, Image, NavLink and ThemeButton) must become TanStack `Link` and plain elements. Don't add `next` as a dependency.
