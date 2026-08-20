#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/db/schema.sql"

if [[ ! -f "$SCHEMA" ]]; then
  echo "db/schema.sql is missing. It is the source of truth for custom Postgres."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^email-cms-postgres$'; then
  echo "email-cms-postgres is not running. Start it with: npm run db:up"
  exit 1
fi

echo "Applying $SCHEMA..."
docker exec email-cms-postgres psql -U email_cms -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'email_cms' AND pid <> pg_backend_pid();" >/dev/null
docker exec email-cms-postgres psql -U email_cms -d postgres -c "DROP DATABASE IF EXISTS email_cms;"
docker exec email-cms-postgres psql -U email_cms -d postgres -c "CREATE DATABASE email_cms;"
docker exec -i email-cms-postgres psql -U email_cms -d email_cms -v ON_ERROR_STOP=1 < "$SCHEMA"
echo "Schema applied."
