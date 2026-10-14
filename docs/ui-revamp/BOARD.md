# Revamp board

## Status
| Phase | State | Notes |
|---|---|---|
| 0 Audit | done | AUDIT.md, BRIEF.md, template inventory (digest f351f90b607cfc9a) |
| 1 Foundation | done | design-system. Tokens, fonts, theme, 30 primitives, CONTRACTS.md. tsc, eslint, vitest (45 tests) and build exit 0; ds static gate clean. Awaiting qa-critic pass |
| 2 IA and home | pending | ia-navigation |
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
| 2026-10-14 | `src/features/reader/last-read.ts` exists (commit 15cbf0d): `readerHomeTarget(): { version, book, chapter }` (stored location, else WEB/JHN/3; never throws) and `rememberLocation()`. Storage key `pb-reader-last`. The reader page reads `?v=` with `useSearch({ strict: false })`, so the route's `validateSearch` only needs `v?: string` | ia-navigation (`/read` redirect, reader route) | reader |

## Gaps and blockers
- Backend contract in BRIEF §7 is being built on `feat/platform-hardening`; the lead merges it here when green.
- **Docker build not run by design-system.** The Dockerfile's `corepack install` picks up `packageManager: pnpm@12.11.2`, matching CI; a `docker build` (on vdk) has not been run against the new lockfile yet.
- **Bundle:** one 852 kB JS chunk (260 kB gzip), up from the 742 kB baseline measured before the upgrade, mostly Radix and lucide now reached through the CodeBlock shim. Route-level splitting is Phase 2 scope.
- **Static gates, full `src`:** 12 raw hex (LoginPage, UsagePage) and 193 stock palette classes across 11 unmigrated page and layout files. `src/components/ds` is clean. Recommend adding `--primitive-lib radix-ui` to the BRIEF §10 command so pages importing the unified `radix-ui` package directly are caught (the default only matches `@radix-ui/`).
- **Gate script:** does not skip `.pnpm-store/`; keep the pnpm store outside `portal/` or pass `--exclude`.

## QA log
| Task | Owner | Result | Screens | Findings |
|---|---|---|---|---|
| Phase 1 self-check: dev gallery at 1440x3600 and 390x6200 (light, dark), ConfirmDialog at 1440x900 (light, dark), Dialog at 390x844 (light, dark) | design-system | pass after fixes | session scratchpad, not committed (qa-critic owns `screens/`); reproduce from `/src/components/ds/gallery/index.html` | Fixed: stacked Table rows looked like cards nested in a Card (now divided rows); stacked cell labels inherited `font-mono`; Dialog focused Close before the first field (Close now last in DOM). Not a bug: overlays look translucent in headless captures mid-animation; opaque with reduced motion |
