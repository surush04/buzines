#!/bin/sh
set -e
exec npx serve -s frontend/dist/frontend/browser -l "${PORT:-8080}"
