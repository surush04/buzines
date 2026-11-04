#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[buzines-api] DATABASE_URL is required" >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"

echo "[buzines-api] PORT=${PORT:-3000}"
echo "[buzines-api] PostgreSQL database configured"

# The first deploy recorded this migration as failed because the SQL file
# ended with a stray "\n". Postgres rolled that transaction back. Remove only
# the unfinished row so the corrected file can be applied.
printf '%s\n' "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20261103220000_init' AND finished_at IS NULL AND rolled_back_at IS NULL;" \
  | npx prisma db execute --stdin \
  || echo "[buzines-api] failed-migration cleanup skipped"

npx prisma migrate deploy
echo "[buzines-api] migrations applied"

exec node dist/src/main.js
