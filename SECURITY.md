# Security policy

Praytify Bible runs a public API and handles developer accounts and API keys. We take reports seriously and fix confirmed issues before anything else.

## Reporting a vulnerability

Report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Please do not open a public issue, pull request, or discussion for a suspected vulnerability.

Include what you can of:

- the affected endpoint, file, or deployment (`api.praytify.bible`, `praytify.bible`, or a self-hosted version and commit),
- steps to reproduce, and what you expected versus what happened,
- the impact as you understand it.

We will confirm receipt, keep you updated while we investigate, and credit you in the release notes unless you ask us not to.

## Scope

In scope: the gateway (`src/`), the portal (`portal/`), the SDK (`packages/sdk/`), the Bible engine (`praytify-app/open-bible-api`), and the production deployment at `praytify.bible` and `api.praytify.bible`.

Out of scope: denial of service by volume, findings that need a compromised device or browser, missing headers with no demonstrated impact, and scripture text accuracy (please open a normal issue for those).

Testing against production must not degrade service for others or touch accounts and keys that are not yours.

## Supported versions

Security fixes land on `main` and ship in the next release. Self-hosters should track the latest release.

## Design notes for reviewers

- API keys are stored as SHA-256 hashes; the plaintext is shown once at creation. See `docs/adr/0001-publishable-and-secret-api-keys.md`.
- Publishable keys (`pb_pk_…`) are origin-restricted and read-only. Origin checks bind browsers, not scripts, so publishable keys are treated as public identifiers with quotas, not as secrets.
- The engine is never exposed directly; only the gateway is internet-facing.
