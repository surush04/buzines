#!/bin/sh
set -e
exec npx serve -s dist/frontend/browser -l "tcp://0.0.0.0:${PORT:-8080}"
