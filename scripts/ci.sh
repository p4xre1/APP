#!/usr/bin/env bash
# Local equivalent of .github/workflows/deploy.yml's build job:
# frozen-lockfile install, typecheck, build. Useful to run before pushing.
#
# Usage: pnpm run ci   (or: bash scripts/ci.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Installing (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Type-checking"
pnpm exec tsc --noEmit

echo "==> Building"
pnpm run build

echo
echo "CI checks passed."
