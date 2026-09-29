#!/usr/bin/env bash
# Type-checks then builds the production bundle into dist/.
#
# Usage: bash scripts/build.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pnpm run typecheck
pnpm run build
