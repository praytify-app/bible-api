# Deploying Praytify Bible

Production is `docker-compose.prod.yml` on the netcup VPS, managed by Dokploy (project `praytify-bible`). Dokploy redeploys the compose when `main` changes, pulling the image tags pinned in the file. So the order is always: build and push images, set any new secrets, then merge the compose change.

## Release 0.5.0 checklist

This release changes the gateway's database schema, adds a shared secret, and changes the portal's runtime user. Do the steps in order.

### 1. Build and push images

From a clean `main` after the release branches are merged, with the engine repository checked out next to this one at the matching commit:

```bash
scripts/deploy.sh 0.5.0-$(git rev-parse --short HEAD)
```

The script builds `linux/amd64` images for the engine, gateway, and portal and pushes them to Docker Hub. Note the tag.

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

### 4. Pin the new tags and merge

Update the three `image:` tags in `docker-compose.prod.yml` to the tag from step 1 in the same commit that merges the release. The hardened portal service (read-only root, no capabilities) only works with the new unprivileged portal image, so the compose change and the new portal tag must ship together.

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

Re-pin the previous tags (`gateway 0.4.0-17ea66f`, `engine 1.4.0-b0835ca`, `portal 0.4.1-c167e10`) and restore the previous `docker-compose.prod.yml`. The previous portal image needs the old compose: it runs nginx as root and cannot start under the hardened settings. Migration 0001 only adds columns and an index, so the old gateway runs against the migrated schema unchanged.

## After the release

- Move Praytify off `MASTER_API_KEY` as described in [integrations/praytify.md](integrations/praytify.md), then remove the variable.
- Optional: a publishable key restricted to `https://praytify.bible`, passed to the portal build as `VITE_PUBLIC_SEARCH_KEY`, turns on search in the reader.
- Optional: run Redis and set `REDIS_URL` before running more than one gateway replica.
- Point uptime monitoring at `https://api.praytify.bible/health/ready`, which returns `503` when the database is unreachable.
