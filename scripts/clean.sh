#!/usr/bin/env bash
# Removes installed dependencies, build output, and local caches.
# Run scripts/setup.sh (or pnpm run setup) afterwards to reinstall.
#
# Usage: pnpm run clean   (or: bash scripts/clean.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

rm -rf node_modules dist .vite
find . -maxdepth 1 -name "*.tsbuildinfo" -delete

echo "Cleaned node_modules, dist, .vite, and *.tsbuildinfo"
