#!/usr/bin/env bash
# Local Praytify Bible stack without Docker: Postgres, the engine, and the
# gateway as native processes, with a small public-domain sample corpus.
#
#   scripts/dev-stack.sh up       start everything (initialises and seeds on first run)
#   scripts/dev-stack.sh down     stop everything
#   scripts/dev-stack.sh status   show what is running
#   scripts/dev-stack.sh seed     (re)seed the sample translations
#   scripts/dev-stack.sh psql     open psql on the dev database
#   scripts/dev-stack.sh logs     tail engine and gateway logs
#   scripts/dev-stack.sh reset    stop and delete all local state
#
# Environment overrides: ENGINE_DIR (default ../open-bible-api), DEV_STACK_DIR
# (default .dev), PG_PORT (55432), ENGINE_PORT (3100), GATEWAY_PORT (3200),
# PG_BIN (directory holding initdb/pg_ctl/psql; newest Homebrew or PATH install
# by default), PNPM (command used to run pnpm).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="${DEV_STACK_DIR:-$ROOT/.dev}"
ENGINE_DIR="${ENGINE_DIR:-$ROOT/../open-bible-api}"
PG_PORT="${PG_PORT:-55432}"
ENGINE_PORT="${ENGINE_PORT:-3100}"
GATEWAY_PORT="${GATEWAY_PORT:-3200}"
PNPM="${PNPM:-pnpm}"
DB_NAME="praytify_bible"
DB_URL="postgresql://postgres@127.0.0.1:${PG_PORT}/${DB_NAME}"
GATEWAY_TOKEN="${GATEWAY_TOKEN:-dev-gateway-token-change-me}"

say() { printf '\033[1m%s\033[0m %s\n' "▸" "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

find_pg_bin() {
  if [[ -n "${PG_BIN:-}" ]]; then echo "$PG_BIN"; return; fi
  local v
  for v in 18 17 16; do
    for prefix in /opt/homebrew/opt /usr/local/opt; do
      if [[ -x "$prefix/postgresql@$v/bin/initdb" ]]; then echo "$prefix/postgresql@$v/bin"; return; fi
    done
    if [[ -x "/usr/lib/postgresql/$v/bin/initdb" ]]; then echo "/usr/lib/postgresql/$v/bin"; return; fi
  done
  command -v initdb >/dev/null 2>&1 && dirname "$(command -v initdb)" && return
  die "Postgres 16+ not found. Install it (brew install postgresql@18) or set PG_BIN."
}

PGB="$(find_pg_bin)"
PGDATA="$STATE/pg"
psql_admin() { PGOPTIONS="-c client_min_messages=warning" "$PGB/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

pg_running() { "$PGB/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; }

start_postgres() {
  mkdir -p "$STATE"
  if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
    say "initialising Postgres in $PGDATA ($("$PGB/postgres" --version))"
    "$PGB/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null
  fi
  if ! pg_running; then
    say "starting Postgres on 127.0.0.1:$PG_PORT"
    "$PGB/pg_ctl" -D "$PGDATA" -l "$STATE/postgres.log" -w \
      -o "-p $PG_PORT -k $STATE -c listen_addresses=127.0.0.1" start </dev/null >/dev/null
  fi
  if [[ "$(psql_admin -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")" != "1" ]]; then
    psql_admin -d postgres -c "CREATE DATABASE $DB_NAME"
  fi
  psql_admin -d "$DB_NAME" -f "$ROOT/scripts/init-db.sql" >/dev/null
}

ensure_deps() {
  local dir="$1"
  if [[ ! -d "$dir/node_modules" ]]; then
    say "installing dependencies in $dir"
    (cd "$dir" && $PNPM install --frozen-lockfile)
  fi
}

ENGINE_ENV=(DATABASE_URL="$DB_URL" PORT="$ENGINE_PORT" GATEWAY_TOKEN="$GATEWAY_TOKEN"
  ADMIN_TOKEN="dev-admin-token" RATE_LIMIT_MAX=100000 NODE_ENV=development)

# Explicit values below win over the gateway's .env: Node's --env-file never
# overrides variables that are already set.
GATEWAY_ENV=(DATABASE_URL="$DB_URL" PORT="$GATEWAY_PORT" BIBLE_API_URL="http://127.0.0.1:$ENGINE_PORT"
  GATEWAY_TOKEN="$GATEWAY_TOKEN" BETTER_AUTH_URL="http://localhost:$GATEWAY_PORT"
  PUBLIC_API_URL="http://localhost:$GATEWAY_PORT" PORTAL_URL="${PORTAL_URL:-http://localhost:5173,http://127.0.0.1:5173}"
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-dev-secret-change-me-dev-secret-change-me}"
  EMAIL_PASSWORD_AUTH="${EMAIL_PASSWORD_AUTH:-true}" NODE_ENV=development)

engine_tsx() { (cd "$ENGINE_DIR" && env "${ENGINE_ENV[@]}" ./node_modules/.bin/tsx "$@"); }
gateway_tsx() { (cd "$ROOT" && env "${GATEWAY_ENV[@]}" ./node_modules/.bin/tsx --env-file-if-exists=.env "$@"); }

seed_engine() {
  [[ -d "$ENGINE_DIR" ]] || die "engine not found at $ENGINE_DIR (clone praytify-app/open-bible-api there or set ENGINE_DIR)"
  ensure_deps "$ENGINE_DIR"
  say "migrating engine schema"
  engine_tsx src/db/migrate.ts
  if grep -q '"seed-sample"' "$ENGINE_DIR/src/seeder/cli.ts" 2>/dev/null; then
    say "seeding sample translations, daily verses, and search indexes"
    engine_tsx src/seeder/cli.ts seed-sample
  elif [[ -x "$ENGINE_DIR/scripts/seed-sample.sh" ]]; then
    say "seeding sample translations (engine scripts/seed-sample.sh)"
    (cd "$ENGINE_DIR" && env "${ENGINE_ENV[@]}" ./scripts/seed-sample.sh)
  else
    say "seeding World English Bible, daily verses, and search indexes"
    engine_tsx src/seeder/cli.ts seed -s ebible -t engwebp -l eng -a WEB -n "World English Bible" \
      --license "Public Domain" --lang-name English --lang-native English --lang-script Latin
    engine_tsx src/seeder/cli.ts seed-daily
    engine_tsx scripts/build-search-infra.ts
  fi
}

# start_bg NAME DIR CMD...: CMD runs under nohup, so it must be a program
# (env, node, ...), never a shell function.
start_bg() {
  local name="$1" dir="$2"; shift 2
  local pidfile="$STATE/$name.pid"
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then return; fi
  say "starting $name"
  # `cd` is its own statement: in `cd && nohup ... &` the & would background
  # the whole list, leaving a subshell that holds the caller's stdout open and
  # recording that subshell's PID instead of the server's.
  (
    cd "$dir" || exit 1
    nohup "$@" </dev/null >"$STATE/$name.log" 2>&1 &
    echo $! >"$pidfile"
  )
}

wait_for() {
  local name="$1" url="$2"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then say "$name ready at $url"; return; fi
    sleep 1
  done
  die "$name did not become ready; see $STATE/$name.log"
}

stop_bg() {
  local pidfile="$STATE/$1.pid"
  if [[ -f "$pidfile" ]]; then
    local pid; pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      say "stopping $1"
      kill "$pid" 2>/dev/null || true
      # tsx spawns the real node process as a child.
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

cmd_up() {
  start_postgres
  local versions
  versions="$(psql_admin -d "$DB_NAME" -c "SELECT to_regclass('public.versions') IS NOT NULL AND EXISTS (SELECT 1 FROM versions)" 2>/dev/null || echo f)"
  if [[ "$versions" != "t" ]]; then seed_engine; else ensure_deps "$ENGINE_DIR"; fi

  ensure_deps "$ROOT"
  say "migrating gateway schema"
  gateway_tsx src/db/migrate.ts

  start_bg engine "$ENGINE_DIR" env "${ENGINE_ENV[@]}" ./node_modules/.bin/tsx src/index.ts
  wait_for engine "http://127.0.0.1:$ENGINE_PORT/api/v1/health"
  start_bg gateway "$ROOT" env "${GATEWAY_ENV[@]}" ./node_modules/.bin/tsx --env-file-if-exists=.env src/index.ts
  wait_for gateway "http://127.0.0.1:$GATEWAY_PORT/health/ready"

  cat <<EOF

  Postgres  $DB_URL
  Engine    http://127.0.0.1:$ENGINE_PORT  (internal)
  Gateway   http://localhost:$GATEWAY_PORT  (API reference: http://localhost:$GATEWAY_PORT/docs)

  Portal:   cd portal && VITE_API_URL=http://localhost:$GATEWAY_PORT pnpm dev
  Try:      curl 'http://localhost:$GATEWAY_PORT/v1/verses?ref=John%203:16&version=WEB'
EOF
}

cmd_down() {
  stop_bg gateway
  stop_bg engine
  if pg_running; then say "stopping Postgres"; "$PGB/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null; fi
}

cmd_status() {
  pg_running && echo "postgres  running ($DB_URL)" || echo "postgres  stopped"
  for n in engine gateway; do
    if [[ -f "$STATE/$n.pid" ]] && kill -0 "$(cat "$STATE/$n.pid")" 2>/dev/null; then echo "$n  running (pid $(cat "$STATE/$n.pid"))"; else echo "$n  stopped"; fi
  done
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  seed) start_postgres; seed_engine ;;
  psql) exec "$PGB/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d "$DB_NAME" ;;
  logs) exec tail -n 50 -f "$STATE/engine.log" "$STATE/gateway.log" ;;
  reset) cmd_down; rm -rf "$STATE"; say "removed $STATE" ;;
  *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
