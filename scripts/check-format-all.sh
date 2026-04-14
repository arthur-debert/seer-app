#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "=== Prettier ==="
pnpm prettier --check .

echo "=== ESLint ==="
pnpm eslint .
