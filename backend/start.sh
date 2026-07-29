#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:./prod.db}"
export NODE_ENV="${NODE_ENV:-production}"

echo "[buzines-api] PORT=${PORT:-3000}"
echo "[buzines-api] DATABASE_URL=$DATABASE_URL"

npx prisma migrate deploy
echo "[buzines-api] migrations applied"

exec node dist/main.js
