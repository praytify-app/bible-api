# Rotate production secrets

Three production credentials were committed inline to `docker-compose.prod.yml` and remain in main's git history: `BETTER_AUTH_SECRET` and `ADMIN_TOKEN` (commit `7559415`, 2026-03-24) and the `bible` Postgres role's password (`b67c4b0` in `DATABASE_URL`, `740483f` as `POSTGRES_PASSWORD`). The July purge removed `.env.production` but not these. The decision (2026-10-15) is to rotate all three and leave history as is: once rotated, the values in it are dead. The repositories stay private until this runbook is done.

**Done 2026-10-16.** The `bible` password was rotated after the services moved to their own roles (so no service was affected), Dokploy holds the new value, and the leaked value is refused. All three credentials in git history are now dead. The steps below remain for any future rotation.

When verifying a database password, connect over the container's network address, not `127.0.0.1`: the official Postgres image trusts loopback connections without checking the password (`pg_hba.conf`), so a loopback test accepts any value.

**Status, checked 2026-10-15 by comparing SHA-256 hashes of the Dokploy values with the leaked ones (no values printed):** `BETTER_AUTH_SECRET` and `ADMIN_TOKEN` were already rotated (Dokploy deployments titled "Rotate exposed Praytify Bible credentials", 2026-08-23). The `bible` Postgres password is still the leaked value in both `POSTGRES_PASSWORD` and `DATABASE_URL`. Only the database steps below remain: 1, the password line of 2, 3, 5, and 6. Rotating it does not sign anyone out.

Allow 20 minutes. Every signed-in portal user is signed out once. API keys keep working: they are stored as SHA-256 hashes and never signed with any of these secrets.

## What each secret does, and what rotating it breaks

| Secret | Used by | Rotating it |
|---|---|---|
| `BETTER_AUTH_SECRET` | Gateway (BetterAuth): signs session cookies and the OAuth `state` cookie | Signs everyone out; sign-ins in progress fail and are retried. Nothing stored is encrypted with it: `src/auth/index.ts` enables neither `cookieCache` nor `encryptOAuthTokens`, so there is nothing to re-encrypt |
| `ADMIN_TOKEN` | Engine only (`src/middleware/admin-auth.ts`), guarding `/api/v1/admin/{stats,versions,seed}` | Nothing outside the engine uses it. The engine has no public port and the gateway never forwards `Authorization` |
| `bible` password | Postgres superuser. Gateway and engine connect with it until the least-privilege roles are rolled out | New connections need the new password. `POSTGRES_PASSWORD` is read only when the data volume is first initialized, so changing the variable alone changes nothing |

If the least-privilege roles (`DEPLOY.md`, "Least-privilege database roles") are already live, the services no longer connect as `bible`, and step 3 touches only the superuser.

## Before you start

- SSH to the server (`ssh netcup-server`) and edit access to the `praytify-bible` compose in Dokploy.
- Find the container names (Dokploy prefixes them with the project):
  ```bash
  ssh netcup-server 'docker ps --format "{{.Names}}" | grep -i bible'
  ```
- Note the current values somewhere private until step 6 passes, so you can roll back. Do not paste them into a ticket or chat.
- Check what else connects as `bible` with a password: Dokploy database backups, BI tools, scripts on other machines. `[TBD: owner to confirm; none are known in this repository]`. The repo's own scripts use `docker exec`, which needs no password.

## 1. Back up

```bash
ssh netcup-server 'docker exec <postgres-container> pg_dump -U bible -d praytify_bible -Fc' > praytify-bible-$(date +%F).dump
```

## 2. Generate the new values

On your machine. Hex avoids characters that need escaping in a URL.

```bash
openssl rand -hex 32   # BETTER_AUTH_SECRET
openssl rand -hex 32   # ADMIN_TOKEN (or skip it: see step 4)
openssl rand -hex 24   # bible password
```

## 3. Stage the environment, then change the database password

Order matters: Postgres accepts only the new password the moment it changes, so have the new environment ready before you change it.

1. In Dokploy, edit the compose environment and save **without deploying**:
   ```
   BETTER_AUTH_SECRET=<new>
   POSTGRES_PASSWORD=<new bible password>
   DATABASE_URL=postgresql://bible:<new bible password>@bible-db:5432/praytify_bible
   ```
   Keep the host `bible-db`, never `postgres` (shared-network DNS collision; see the compose file). Leave `ENGINE_DATABASE_URL` and `GATEWAY_DATABASE_URL` alone if they are set.
2. Change the password in Postgres. `printf` is a shell builtin, so the password does not appear in the process list:
   ```bash
   printf "ALTER ROLE bible WITH PASSWORD '%s';\n" '<new bible password>' \
     | ssh netcup-server 'docker exec -i <postgres-container> psql -U bible -d praytify_bible -v ON_ERROR_STOP=1'
   ```
   Open connections stay authenticated; only new ones need the new password. Go straight to step 5.

## 4. ADMIN_TOKEN: rotate or remove

If nobody calls the engine's admin routes in production, remove `ADMIN_TOKEN` from the Dokploy environment. An unset token locks the admin surface, which is the safer state. Otherwise set it to the new value. Either way, save without deploying.

## 5. Deploy

Deploy the compose from Dokploy once, so the gateway and engine restart with the new values together.

## 6. Verify

```bash
curl -s https://api.praytify.bible/health/ready        # {"ready":true,"database":"connected"}
curl -s -H "Authorization: Bearer <a live API key>" https://api.praytify.bible/v1/versions | head -c 120
```

- Sign in at https://praytify.bible with GitHub or Google; the dashboard loads.
- The old admin token is refused (expect `401`):
  ```bash
  ssh netcup-server "docker exec <engine-container> node -e \"fetch('http://127.0.0.1:3100/api/v1/admin/stats',{headers:{authorization:'Bearer '+process.argv[1]}}).then(r=>console.log(r.status))\" '<old admin token>'"
  ```
- Clear the sessions signed with the old secret. They no longer validate, so this changes nothing users see; it just removes dead rows:
  ```bash
  echo 'DELETE FROM public.session;' | ssh netcup-server 'docker exec -i <postgres-container> psql -U bible -d praytify_bible -v ON_ERROR_STOP=1'
  ```

Then destroy the old values you noted.

## Rollback

If the gateway or engine cannot reach the database after step 5, the environment and the role disagree. Set `DATABASE_URL` and `POSTGRES_PASSWORD` in Dokploy back to the old password and redeploy, or repeat step 3.2 with the old password. Restoring the old `BETTER_AUTH_SECRET` would bring back the leaked value, so fix forward instead.

## Afterwards

- The repositories can go public (decision of 2026-10-15: public after rotation). History still holds the dead values; that is accepted.
- Rotate the client secrets of the two development OAuth apps leaked in July (GitHub client `Ov23liotoe2Y5NnvvoE2`, Google client `251143011998-…`) in the GitHub and Google consoles and update local `.env` files. Whether that already happened cannot be checked from the repository.
- Record the rotation date in `docs/GAP-EVAL-2026-10-14.md` under "Still open".
