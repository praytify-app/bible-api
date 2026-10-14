# Revamp board

## Status
| Phase | State | Notes |
|---|---|---|
| 0 Audit | done | AUDIT.md, BRIEF.md, template inventory (digest f351f90b607cfc9a) |
| 1 Foundation | pending | design-system |
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

## Decisions needed
- Terms and Privacy text (BRIEF §11). Working default: remove the claim, list as gated.

## Contract changes
(none yet)

## Gaps and blockers
- Backend contract in BRIEF §7 is being built on `feat/platform-hardening`; the lead merges it here when green.

## QA log
| Task | Owner | Result | Screens | Findings |
|---|---|---|---|---|
