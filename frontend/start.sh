#!/bin/sh
set -e
exec npx serve -s dist/frontend/browser -l "${PORT:-8080}"
