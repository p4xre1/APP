#!/usr/bin/env bash
# Runs the TypeScript compiler in no-emit mode (same check CI runs).
#
# Usage: pnpm run typecheck   (or: bash scripts/typecheck.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pnpm exec tsc --noEmit
