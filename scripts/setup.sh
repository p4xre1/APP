#!/usr/bin/env bash
# One-time (or repeatable) project bootstrap:
#   - activates the exact pnpm version pinned in package.json ("packageManager")
#     via Corepack, so everyone (and CI) installs with the same pnpm
#   - installs dependencies with `pnpm install`
#
# Usage: pnpm run setup   (or: bash scripts/setup.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js is not installed. Install Node 22+ first (see .mise.toml)." >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "error: corepack was not found alongside node. Node 22 ships with it;" >&2
  echo "       if it's missing, run: npm install -g corepack" >&2
  exit 1
fi

PM_SPEC="$(node -pe "require('./package.json').packageManager || ''")"
if [ -z "$PM_SPEC" ]; then
  echo "error: package.json has no \"packageManager\" field to pin a pnpm version." >&2
  exit 1
fi

echo "==> Activating ${PM_SPEC} via corepack"
corepack enable
corepack prepare "$PM_SPEC" --activate

echo "==> Installing dependencies"
pnpm install

echo
echo "Done. Next: pnpm run dev"
