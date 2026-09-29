#!/usr/bin/env bash
# Starts the local dev server, running setup first if node_modules is missing.
#
# Usage: bash scripts/dev.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -d node_modules ]; then
  echo "==> node_modules not found, running setup first"
  bash scripts/setup.sh
fi

pnpm run dev
