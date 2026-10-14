# Revamp board

## Status
| Phase | State | Notes |
|---|---|---|
| 0 Audit | done | AUDIT.md, BRIEF.md, template inventory (digest f351f90b607cfc9a) |
| 1 Foundation | done | design-system. Tokens, fonts, theme, 30 primitives, CONTRACTS.md. tsc, eslint, vitest (45 tests) and build exit 0; ds static gate clean. Awaiting qa-critic pass |
| 2 IA and home | done, awaiting qa-critic | ia-navigation. Public and dashboard shells, `lib/nav.ts`, every page a lazy route (recharts only in the UsagePage chunk), landing and overview on live data, not-found and error routes. `e2e/features/navigation.spec.ts` 36/36 (desktop, mobile); tsc, eslint on owned files, vitest 229/229; static gate clean on owned files |
| 3 Signature features | pending | reader, keys, embed |
| 4 Page migration | pending | page-migration |
| 5 Cross-feature flows | pending | lead |
| 6 Verification | pending | qa-critic |

## Decisions
| Date | Decision | Why | By |
|---|---|---|---|
| 2026-10-14 | Brand is Sacred Dawn (indigo, cream, brown), not the v1.0 orange palette | The live Praytify marketing site and the brand kit's newest exports (`Indigo/`) use it; the portal already uses its indigo and fonts | lead |
| 2026-10-14 | Add a dark theme | Night reading in the public reader; see BRIEF §11 | lead |
| 2026-10-14 | Radix + lucide + self-hosted Fontsource fonts | Template-map defaults; removes render-blocking third-party font CSS | lead |
| 2026-10-14 | `GET /v1/verses?ref=` becomes public | Needed for zero-config embeds; same text as the public chapter route | lead |
| 2026-10-14 | Run without the brief approval stop (`--run-through`) | Owner asked for an uninterrupted run, stopping only for critical security decisions | owner |
| 2026-10-14 | TypeScript 6.0.3, not 7.0.2 | typescript-eslint 8.71.2 (latest) declares `typescript >=4.8.4 <6.1.0`; TS 7 would leave lint unsupported. Revisit when typescript-eslint supports 7 | design-system |
| 2026-10-14 | `@types/node` 22 and `engines.node >=22.13.0` | Types match the Node 22 runtime the Dockerfile ships; 22.13 is ESLint 10's floor | design-system |
| 2026-10-14 | pnpm 12.11.2 with its release-age policy left on; `lucide-react` pinned `^1.56.0` | The policy rejects packages published in the last day (supply-chain guard). 1.57.0 was hours old. Bump once it ages | design-system (lead asked for pnpm 12) |
| 2026-10-14 | Ink ramp: secondary `#66564F` (72%), muted `#74665F` (the spec's 65% secondary), spec 45% kept only as `ink-faint` for decoration | Spec muted (45%) is 2.6:1 on sunken and cannot carry captions; one step down keeps three text levels all at AA | design-system |
| 2026-10-14 | Dark accent fill `#5B53E8` (light keeps `#4F46E5`) | Separates from dark surfaces at 3:1 while white labels keep 5.5:1 | design-system |
| 2026-10-14 | Semantic tokens mapped with `@theme inline` | Utilities resolve at the element, so a subtree can force `data-theme` (embed preview) | design-system |
| 2026-10-14 | Fonts: Fontsource weight axis only, not optical size | Optical-size files add about 150 KB (latin) for a phone-first reader | design-system |
| 2026-10-14 | No virtualisation dependency; SearchSelect caps rendered rows (50) with a "keep typing" status | 1,288 versions filter instantly; capping is accessible and dependency-free | design-system |
| 2026-10-14 | happy-dom for unit tests | Lighter than jsdom and covers what Radix needs; no stubs required | design-system |
| 2026-10-14 | Deprecated `primary-*` colour aliases kept in `index.css` | Unmigrated pages keep rendering; remove with the stock palette after Phase 4 | design-system |
| 2026-10-14 | Favicon PNG and apple-touch-icon rendered from the brand SVGs (96px, 180px opaque), not the 659px PNG export | Right sizes; iOS renders transparent corners black | design-system |
| 2026-10-14 | Keys: the plaintext key is split off inside the create and roll `mutationFn` and handed to page state; those mutations use `gcTime: 0` | TanStack keeps a mutation's resolved value in the MutationCache (visible in devtools, kept after unmount). Must-not-regress 4 covers any cache | keys |
| 2026-10-14 | Keys: one-time reveal is an inline panel above the table, not a modal; focus moves to its heading and dismissing it drops the key | Key, usage snippet and the new row stay visible together; matches the audited banner behaviour | keys |
| 2026-10-14 | Keys: kind is chosen with radio cards (visually hidden native radios; the card carries the focus outline), not Tabs | It is a form value, not a view switch; native radios give arrow-key behaviour and form semantics | keys |
| 2026-10-14 | Keys: client origin validator mirrors the gateway's `normalizeOriginPattern` exactly (including `127.0.0.1`, `[::1]`, and plain http on real hosts, which is accepted with a warning). The gateway's message wins on disagreement | Errors show on the row before a round trip; one rule set, two copies kept in step (`features/keys/origins.ts` names its source) | keys |
| 2026-10-14 | Keys: a blank name is not sent; the gateway applies its default, "Untitled key" | Sentence case matches the brand voice, and one default in one place cannot drift. Supersedes the client-side "Untitled Key" | lead |
| 2026-10-14 | Keys: per-key usage (requests and errors, last 30 days) sits in the table row and links to `/dashboard/usage?keyId=`; no detail drawer | Accounts hold at most 20 keys; one glance beats a click per key | keys |
| 2026-10-14 | Router search params are plain strings: `parseSearchWith((v) => v)` and `stringifySearchWith(JSON.stringify)` | TanStack's default JSON-encodes a value that looks like JSON, so a shared `?v=16` became `?v=%2216%22`. Values now arrive as strings and each route's `validateSearch` narrows them; objects still serialize as JSON | ia-navigation |
| 2026-10-14 | Public pages sit under a pathless layout route `_public`. Full paths are unchanged; route ids become `/_public/...` | One explicit frame per persona instead of pathname checks in a root layout. Pages using `strict: false` are unaffected; typed lookups use `getRouteApi("/_public/read/$version/$book/$chapter")` | ia-navigation |
| 2026-10-14 | Dashboard guard sends `/login?redirect=<path>` with `replace`, validated by page-migration's `validateLoginSearch`. Spinner, redirect and render-nothing states unchanged | Closes AUDIT finding 17 (deep links lost). `replace` avoids a back-button bounce. The location is read once, not subscribed: subscribing nested the redirect while the login chunk loaded (caught by the spec) | ia-navigation |
| 2026-10-14 | Sign-out removes inactive queries after it lands on `/` | The next account on the same tab never sees the previous one's cached keys or usage; public reads stay cached | ia-navigation |
| 2026-10-14 | `defaultPreload: "intent"`, router-level pending and error components; the error page recognises a stale chunk after a deploy and offers a reload | Lazy pages stay instant to navigate; an old tab after a release gets a working path instead of a blank page | ia-navigation |
| 2026-10-14 | Landing counts come from `translations.list()` (shared `["translations"]` key): versions and distinct `languageCode`, nothing rendered until loaded or on error | As briefed. Cost: the home page downloads the whole catalog (1,288 rows in production). `GET /v1/languages` or a catalog `meta.total` would be lighter; lead's call | ia-navigation |
| 2026-10-14 | Dashboard sidebar "Docs" opens `/docs/quickstart` | Same entry point as the public Docs menu; the quick start links on to the reference | ia-navigation |

## Decisions needed
- Terms and Privacy text (BRIEF §11). Working default: remove the claim, list as gated.

## Contract changes
| Date | Change | Affects | By |
|---|---|---|---|
| 2026-10-14 | `lib/api.ts`: `meta?: any` becomes `unknown` (type only, field never read). Pre-existing lint error that blocked `eslint .` | lead | design-system |
| 2026-10-14 | `pages/SettingsPage.tsx`: one `react-hooks/set-state-in-effect` suppression, newly flagged by eslint-plugin-react-hooks 7.1. No behaviour change; the Phase 4 rewrite should remove it with the blank-save fix | page-migration | design-system |
| 2026-10-14 | `components/CodeBlock.tsx` is now a re-export of the ds CodeBlock (same `tabs` prop). Switch imports to `@/components/ds` and delete it | page-migration | design-system |
| 2026-10-14 | `main.tsx` must wrap the app in `<ThemeProvider>` from `@/lib/theme`; `ThemeToggle` and `useTheme()` throw without it | lead | design-system |
| 2026-10-14 | No-flash theme script moved from inline to `public/theme-init.js` so it passes the `script-src 'self'` CSP. Keep any future CSP change compatible with a same-origin classic script in `<head>` | lead (nginx.conf) | design-system |
| 2026-10-14 | ConfirmDialog: optional `onCloseAutoFocus` (requested by keys) so focus can move to a surviving element after roll or revoke removes the trigger row. Additive | keys | design-system |
| 2026-10-14 | SearchSelect (requested by embed): the search clears on close and server-mode callers get `onQueryChange("")`, so reopening never shows stale filtered results; optional `selectedLabel` names the trigger when the selected option is outside the current results. Additive | embed, reader | design-system |
| 2026-10-14 | SearchSelect (requested by reader): `onOpenChange` so the 1,288-version catalog loads only when the picker opens; `dir="auto"` on option text, trigger value and search input so Arabic, Hebrew, Farsi and Urdu names lay out correctly. `selectedLabel` already landed in b8fe7e9. Additive | reader, embed | design-system |
| 2026-10-14 | `src/features/reader/last-read.ts` exists (commit 15cbf0d): `readerHomeTarget(): { version, book, chapter }` (stored location, else WEB/JHN/3; never throws) and `rememberLocation()`. Storage key `pb-reader-last`. The reader page reads `?v=` with `useSearch({ strict: false })`, so the route's `validateSearch` only needs `v?: string` | ia-navigation (`/read` redirect, reader route) | reader |
| 2026-10-14 | **DropdownMenuItem `asChild` throws** ("failed to slot onto its children") when no `icon` is passed: it renders `{icon && <span>}{children}`, so Slot receives two children. Fix: render children alone when `asChild` (or wrap them in `Slot.Slottable`). Workaround in the shell: the Docs menu and user menu navigate in `onSelect`, which loses the href (no open in new tab). Revert once fixed | design-system, then ia-navigation | ia-navigation |
| 2026-10-14 | **Card `committed` should set `--focus` to on-accent.** The global indigo focus outline sits on an indigo fill, so focus is effectively invisible inside committed panels. Workaround: `[--focus:var(--ink-on-accent)]` on the two committed panels (landing decision panel, overview first run) | design-system | ia-navigation |
| 2026-10-14 | Note, no change asked: `cx` does not resolve conflicts, so `className="hidden sm:inline-flex"` on a Button loses to its own `inline-flex` (it overlapped the logo at 390). Put responsive visibility on a wrapper | everyone | ia-navigation |

## Gaps and blockers
- Backend contract in BRIEF §7 is being built on `feat/platform-hardening`; the lead merges it here when green.
- **Docker build not run by design-system.** The Dockerfile's `corepack install` picks up `packageManager: pnpm@12.11.2`, matching CI; a `docker build` (on vdk) has not been run against the new lockfile yet.
- **Bundle:** one 852 kB JS chunk (260 kB gzip), up from the 742 kB baseline measured before the upgrade, mostly Radix and lucide now reached through the CodeBlock shim. Route-level splitting is Phase 2 scope. **Phase 2 result** (production build, 2026-10-14): entry 291 kB (92 kB gzip) plus a shared ds chunk 231 kB (73 kB gzip); first load of `/` is about 182 kB gzip. recharts ships only in the `UsagePage` chunk (362 kB, 104 kB gzip).
- **Static gates, full `src`:** 12 raw hex (LoginPage, UsagePage) and 193 stock palette classes across 11 unmigrated page and layout files. `src/components/ds` is clean. Recommend adding `--primitive-lib radix-ui` to the BRIEF §10 command so pages importing the unified `radix-ui` package directly are caught (the default only matches `@radix-ui/`).
- **Gate script:** does not skip `.pnpm-store/`; keep the pnpm store outside `portal/` or pass `--exclude`.
- **Shared-worktree e2e flake (keys).** `vite dev` full-reloads every open page when any agent edits a shared module (seen for `src/lib/api.ts`), and Playwright's `outputDir` (`portal/e2e/results`) sits inside Vite's watch root, so trace writes also trigger reloads mid-test. Keys ran its spec against a scratch `vite build` served by `vite preview` (`E2E_PORT=5183`, `--output` outside `portal/`). Suggest design-system add `e2e/results` and `playwright-report` to `server.watch.ignored`, or move `outputDir` out of `portal/`.
- **Fixed: gateway 500 on create or roll with an expiry** (postgres.js rejected a `Date` bind). Lead fixed in 85c0fcf; the keys spec's expiring-key case guards it.

- **nginx: hard loads of `/embed` likely miss the SPA** (lead, `portal/nginx.conf`). `location /` uses `try_files $uri $uri/ /index.html`, and `/embed/` is a real directory (`v1.js`), so `$uri/` matches it before the `index.html` fallback. Inference from nginx semantics, not run in a container: a reloaded or shared `/embed` link would get a redirect to `/embed/` and a 404. Client-side navigation is unaffected. Fix: `location = /embed { try_files /index.html =404; }`, or drop `$uri/` from `location /`.
- **GitHub repository returns 404** (`https://github.com/praytify-app/bible-api`, checked 2026-10-14). The header, mobile menu, footer and the landing "Open source" section link to it. BRIEF §11 gates the link on the repository being public at release; every URL lives in `src/lib/nav.ts`. Owner decision.
- **Per-route `document.title`** (AUDIT finding 21) is not done. The router could own it, but the reader wants the passage in its title; needs an owner before qa-critic.

## QA log
| Task | Owner | Result | Screens | Findings |
|---|---|---|---|---|
| Phase 1 self-check: dev gallery at 1440x3600 and 390x6200 (light, dark), ConfirmDialog at 1440x900 (light, dark), Dialog at 390x844 (light, dark) | design-system | pass after fixes | session scratchpad, not committed (qa-critic owns `screens/`); reproduce from `/src/components/ds/gallery/index.html` | Fixed: stacked Table rows looked like cards nested in a Card (now divided rows); stacked cell labels inherited `font-mono`; Dialog focused Close before the first field (Close now last in DOM). Not a bug: overlays look translucent in headless captures mid-animation; opaque with reduced motion |
| Phase 3 key manager self-check: list, create dialog, reveal panel at 1440x900 and 390x844, light and dark | keys | pass, awaiting qa-critic | `screens/keys-{list,create,reveal}-{desktop,mobile}-{light,dark}.png` | e2e `features/keys.spec.ts` 10/10 (desktop and mobile) against the local stack; axe clean in both themes. Fixed during the pass: focus fell back to Create when the reveal and the dialog close landed in one render; reveal footer text wrapped into columns on phones; origins broke mid-host at 1440 when an expiry badge widened the table. Follow-up (lead): must-not-regress 6 now holds through the server, since a blank name creates "Untitled key" with the default applied by the gateway, and the spec asserts it; long origin hosts at 390 break inside the origin text only (`wrap-anywhere`), and the row layout is unchanged |
| Phase 2 shell, nav and homes: `/`, `/dashboard` (first run), not-found, public menu sheet, dashboard menu sheet, docs and user menus at 1440x900 and 390x844, light and dark | ia-navigation | pass after fixes, awaiting qa-critic | `screens/{home,dashboard,not-found}-{1440,390}-{light,dark}.png`, `screens/{menu-open,dashboard-menu-open}-390-{light,dark}.png` | e2e `features/navigation.spec.ts` 36/36 on desktop and mobile: every public route from the header and the sheet with one current item, dashboard sidebar after sign-up, guard round trip with `?redirect=`, sign-out to `/`, theme persists across reload, not-found, skip link, plain `?v=`, recharts absent from public pages, axe light and dark on home and overview. Fixed during the check: dashboard header link overlapped the logo at 390; guard redirect nested itself; ds menu item slot error (worked around, above) |
