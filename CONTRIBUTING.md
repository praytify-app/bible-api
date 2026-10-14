# Contributing

Thanks for helping make scripture easier to build with. This guide covers how to get set up, what a good change looks like here, and how it gets merged.

## Setup

- Node 24 and pnpm 12 (`corepack enable` picks up the pinned version from `packageManager`).
- Postgres 16 or newer for integration tests and the local stack.
- A clone of [open-bible-api](https://github.com/praytify-app/open-bible-api) next to this repository if you want to run the engine locally.

```bash
pnpm install
cp .env.example .env
scripts/dev-stack.sh up
pnpm test
```

Each package (`portal/`, `packages/sdk`, `packages/embed`) installs and tests on its own: run `pnpm install && pnpm test` inside it.

## What a good change looks like

- **One concern per pull request.** A bug fix and a refactor are two PRs.
- **Tests with the change.** Gateway behaviour is tested through `createApp` with a stubbed engine (`tests/app.test.ts`); anything that touches SQL also gets a case in `tests/integration`. The portal uses Vitest for components and Playwright for journeys.
- **Security boundaries stay put.** Public reads never send credentials; secret keys never reach a browser; dashboard routes always go through `requireSession` and scope queries by user. If your change needs to move one of these, open an issue first.
- **Honest UI.** No placeholder numbers, no controls that do nothing, no claims the code does not back. Every limit shown in the portal comes from `GET /api/dashboard/plan`.
- **Attribution survives.** Anything that renders scripture shows the translation's attribution.
- **Comments explain why.** The code says what it does; a comment earns its place by saying why it does it that way.
- **Big design changes get an ADR** in `docs/adr/`: the options, the trade-offs, and why one wins.

## Commits and pull requests

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `feat(gateway): …`, `fix(portal): …`, `docs: …`. Use the body to explain why when it is not obvious, and mark breaking changes with `!` and a `BREAKING CHANGE:` footer.

A pull request description states the problem, the approach, the trade-offs, and how you verified it. CI must be green: typecheck, lint, unit and integration tests, the dependency audit, and the Docker builds.

## Scripture data

The text comes from openly licensed sources, mostly [eBible.org](https://ebible.org), through the engine's seeder. Do not add a translation whose licence does not allow redistribution, and keep its licence and attribution fields accurate. Problems with a translation's text belong in the engine repository.

## Conduct and security

This project follows the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), never in a public issue.
