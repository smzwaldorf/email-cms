#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="$ROOT/db/seed-data.sql"

if [[ ! -f "$SEED" ]]; then
  echo "db/seed-data.sql is missing. It is the vanilla Postgres seed snapshot."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^email-cms-postgres$'; then
  echo "email-cms-postgres is not running. Start it with: npm run db:up"
  exit 1
fi

echo "Loading $SEED..."
docker exec -i email-cms-postgres psql -U email_cms -d email_cms -v ON_ERROR_STOP=1 < "$SEED"
echo "Data loaded."
