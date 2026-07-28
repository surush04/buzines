#!/bin/sh
set -e
cd "$(dirname "$0")"
npx prisma migrate deploy
node dist/main.js
