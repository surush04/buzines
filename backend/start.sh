#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[buzines-api] DATABASE_URL is required" >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"

echo "[buzines-api] PORT=${PORT:-3000}"
echo "[buzines-api] PostgreSQL database configured"

npx prisma migrate deploy
echo "[buzines-api] migrations applied"

exec node dist/src/main.js
