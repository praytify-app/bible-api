#!/bin/sh
# First-boot hook for the postgres image (mounted into /docker-entrypoint-initdb.d).
# Creates the bible_engine and bible_gateway roles from scripts/db-roles.sql.
set -eu
: "${ENGINE_DB_PASSWORD:?set ENGINE_DB_PASSWORD (16+ characters, no spaces)}"
: "${GATEWAY_DB_PASSWORD:?set GATEWAY_DB_PASSWORD (16+ characters, no spaces)}"
PGOPTIONS="-c bible.engine_password=${ENGINE_DB_PASSWORD} -c bible.gateway_password=${GATEWAY_DB_PASSWORD}" \
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /opt/praytify/db-roles.sql
