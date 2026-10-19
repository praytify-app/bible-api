# Deploying Praytify Bible

Production is `docker-compose.prod.yml` on the netcup VPS, managed by Dokploy (project `praytify-bible`). Dokploy redeploys the compose when `main` changes, pulling the image tags pinned in the file. So the order is always: build and push images, set any new secrets, then merge the compose change.

## Release 0.5.0 checklist

**Deployed 2026-10-16 04:15 UTC** (`main` `dc096a6`, images `0.5.0-f229baf`). The first auto-deploy, on the merge, failed at image pull on a never-pushed portal pin and changed nothing. Pre-release backups of the `platform` schema and the auth tables are on the Postgres volume at `/var/lib/postgresql/data/pre-release-backups/`. Every check in step 5 passed. Next: the least-privilege roles below, then moving Praytify to an internal-tier key.

This release changes the gateway's database schema, adds a shared secret, and changes the portal's runtime user. Do the steps in order.

### 1. Build and push images

Merging this repository's `main` is the deploy, so build the images before that merge, from the reviewed head of the release branch. Merge the engine's release PR first: the engine's `main` deploys nothing (its CI builds an image without pushing it). Then, with `../open-bible-api` on its updated `main` and this repository on the release branch head:

```bash
scripts/deploy.sh 0.5.0-$(git rev-parse --short HEAD)
```

The script builds `linux/amd64` images for the engine, gateway, and portal and pushes them to Docker Hub. It does not edit `docker-compose.prod.yml`. Note the tag.

### 2. Add the new secret in Dokploy

In the compose environment, add:

```
GATEWAY_TOKEN=<openssl rand -hex 32>
```

The same value is passed to the gateway and the engine. Without it the gateway still starts and logs a warning, and the engine applies its own per-IP limit on top of the gateway's.

### 3. Back up the platform schema

The gateway migrates on boot (`MIGRATE_ON_BOOT=true`). The first boot baselines the hand-built schema at migration 0000 and applies 0001 (adds `kind`, `allowed_origins`, `expires_at` to `platform.api_keys`, plus an index). The migration is additive and idempotent, but take a backup first:

```bash
ssh netcup-server 'docker exec <postgres-container> pg_dump -U bible -d praytify_bible -n platform -Fc' > platform-$(date +%F).dump
```

### 3b. Check the engine's migration journal

The engine does not migrate on boot in production. Before deploying, check its journal:

```bash
ssh netcup-server 'docker exec <postgres-container> psql -U bible -d praytify_bible -c "SELECT id, created_at FROM drizzle.__drizzle_migrations"'
```

Two rows means the schema is current. If the table is missing or empty, `pnpm db:migrate` from the engine (or one boot with `MIGRATE_ON_BOOT=true`) baselines the restored schema and applies nothing else. If only one row exists while the `versions.license_type` column is present, insert the 0001 record by hand before migrating, because 0001 is not idempotent.

### 4. Pin the new tags and merge

On the release branch, update the three `image:` tags in `docker-compose.prod.yml` to the tag from step 1, commit, push, and merge the PR. Never merge the release with the old tags pinned. The hardened portal service (read-only root, no capabilities) only works with the new unprivileged portal image, so the compose change and the new portal tag must ship together.

### 5. Verify

```bash
curl -s https://api.praytify.bible/health/ready
# {"ready":true,"database":"connected"}

curl -sI 'https://api.praytify.bible/v1/chapters/WEB/JHN/3/verses' -H 'accept-encoding: br' \
  | grep -iE 'etag|cache-control|content-encoding|x-cache|strict-transport'

curl -s 'https://api.praytify.bible/v1/verses?ref=John%203:16&version=WEB' | head -c 300   # public now
curl -s -o /dev/null -w '%{http_code}\n' 'https://api.praytify.bible/v1/search?q=love'      # 401 without a key
curl -s https://api.praytify.bible/v1/openapi.json | grep -c '"/v1/'                         # paths under /v1
curl -sI https://praytify.bible/embed/v1.js | grep -i access-control-allow-origin            # *
```

Open https://api.praytify.bible/docs and https://praytify.bible/docs and confirm the reference renders. Sign in, create a publishable key for `https://praytify.bible`, and confirm it works from the portal and is refused elsewhere.

In the gateway logs, the first boot should show `baselined existing gateway schema at migration 0000` and `gateway migrations complete`.

### 6. Rollback

Restore `docker-compose.prod.yml` from `4672eea` (the last pre-release `main`), which pins the previous tags: `gateway 0.4.0-17ea66f`, `engine 1.4.0-b0835ca`, `portal 0.4.1-e043cc9`. The previous portal image needs the old compose: it runs nginx as root and cannot start under the hardened settings. Migration 0001 only adds columns and an index, so the old gateway runs against the migrated schema unchanged.

## Least-privilege database roles

**Rolled out in production 2026-10-16:** the gateway connects as `bible_gateway` and the engine as `bible_engine` (`GATEWAY_DATABASE_URL`, `ENGINE_DATABASE_URL`), each owning only its own tables. A full backup was taken first (`pre-release-backups/full-2026-10-16.dump` on the Postgres volume).

Today the gateway and engine share one superuser. `scripts/db-roles.sql` gives each service its own role that owns only its own tables, so a compromised engine cannot read developer sessions, OAuth tokens, or keys, and a compromised gateway cannot alter scripture. It is idempotent and transfers ownership of existing tables; `tests/integration/db-roles.int.test.ts` proves the isolation and the migration of a shared-superuser database.

1. Back up the whole database (`pg_dump -Fc`), not just `platform`.
2. Generate two passwords (`openssl rand -hex 24`) and run, as the superuser:
   ```bash
   ssh netcup-server 'docker exec -i -e PGOPTIONS="-c bible.engine_password=<engine> -c bible.gateway_password=<gateway>" <postgres-container> psql -U bible -d praytify_bible -v ON_ERROR_STOP=1 -f -' < scripts/db-roles.sql
   ```
3. In Dokploy, add `ENGINE_DATABASE_URL=postgresql://bible_engine:<engine>@bible-db:5432/praytify_bible` and `GATEWAY_DATABASE_URL=postgresql://bible_gateway:<gateway>@bible-db:5432/praytify_bible`, then redeploy. The compose file prefers these over the shared `DATABASE_URL`.
4. Verify `/health/ready` on the gateway and a chapter read through the API. To roll back, remove the two variables and redeploy; the superuser still owns nothing it needs, because superusers bypass ownership checks.

Self-hosted installs from `docker-compose.yml` get these roles automatically on first boot (`ENGINE_DB_PASSWORD`, `GATEWAY_DB_PASSWORD`).

## Performance notes

`docs/PERFORMANCE.md` has the production-scale measurements. The deploy-relevant points: Postgres now runs with memory settings sized for its 2 GB container (applied on the next Postgres restart); full-Bible downloads are limited to two concurrent builds per engine (`DOWNLOAD_CONCURRENCY`); building the full search infrastructure takes about an hour on a fresh database, dominated by the 48-minute trigram index, so run it off-peak and drop existing search indexes before a bulk re-vectorize.

## After the release

- Rotate the three production credentials that remain in git history: [runbooks/rotate-production-secrets.md](runbooks/rotate-production-secrets.md). Do it before any repository goes public.
- Done 2026-10-19: Praytify moved off `MASTER_API_KEY` ([integrations/praytify.md](integrations/praytify.md)) and the variable is unset in production. Self-hosters should leave it unset and give each first-party app an internal-tier secret key.
- Optional: a publishable key restricted to `https://praytify.bible`, passed to the portal build as `VITE_PUBLIC_SEARCH_KEY`, turns on search in the reader.
- Optional: run Redis and set `REDIS_URL` before running more than one gateway replica.
- HSTS is sent as `max-age=31536000; includeSubDomains` from the gateway and portal. Adding `preload` and submitting praytify.bible to hstspreload.org would protect even first visits, but it is hard to reverse and binds every subdomain to HTTPS; decide it deliberately. Decided 2026-10-19: not now. The header stays without `preload`; revisit once every praytify.bible subdomain is known to serve HTTPS.
- Point uptime monitoring at `https://api.praytify.bible/health/ready`, which returns `503` when the database is unreachable.
