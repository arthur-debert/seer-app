#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "=== fetch:wasm ==="
pnpm fetch:wasm

echo "=== svelte-check ==="
pnpm svelte-kit sync && pnpm svelte-check --tsconfig ./tsconfig.json --threshold warning

echo "=== vitest ==="
pnpm vitest run --passWithNoTests
