# Local Development Setup

## Prerequisites

| Tool          | Version                                   | Install                                                      |
| ------------- | ----------------------------------------- | ------------------------------------------------------------ |
| **Rust**      | stable (pinned via `rust-toolchain.toml`) | [rustup.rs](https://rustup.rs)                               |
| **wasm-pack** | latest                                    | `cargo install wasm-pack`                                    |
| **Node.js**   | 22+                                       | [nodejs.org](https://nodejs.org)                             |
| **pnpm**      | 10+                                       | `corepack enable && corepack prepare pnpm@latest --activate` |

The `rust-toolchain.toml` at the repo root automatically installs the correct Rust version, the `wasm32-unknown-unknown` target, and the `rustfmt`/`clippy` components via rustup.

## First-time setup

```bash
git clone https://github.com/arthur-debert/seer.git
cd seer
pnpm install              # JS dependencies + lefthook pre-commit hooks
pnpm build:wasm           # compile seer-viewer -> WASM
pnpm build:seer-editor-wasm     # compile seer-editor -> WASM
```

## Development

```bash
pnpm dev              # Vite dev server (browser-only, WASM viewport math)
pnpm tauri dev        # Tauri desktop app (includes Rust backend)
```

## Running checks

The same scripts run locally (via lefthook pre-commit) and in CI:

```bash
bash scripts/check-rust.sh       # fmt, clippy, cargo test, wasm-pack test
bash scripts/check-frontend.sh   # eslint, prettier, wasm build, svelte-check, vitest
```

These are the single source of truth. CI calls these scripts directly — no separate commands that could diverge.

## What the checks cover

| Check                          | Script            | Catches                 |
| ------------------------------ | ----------------- | ----------------------- |
| `cargo fmt`                    | check-rust.sh     | Rust formatting         |
| `cargo clippy` (native + wasm) | check-rust.sh     | Lint warnings           |
| `cargo test --workspace`       | check-rust.sh     | Rust logic + GPU bugs   |
| `wasm-pack test --node`        | check-rust.sh     | WASM serialization bugs |
| ESLint                         | check-frontend.sh | JS/TS lint              |
| Prettier                       | check-frontend.sh | Formatting              |
| `pnpm build:wasm`              | check-frontend.sh | WASM compilation        |
| `pnpm build:seer-editor-wasm`  | check-frontend.sh | Editor WASM compilation |
| `svelte-check`                 | check-frontend.sh | TypeScript type errors  |
| `vitest`                       | check-frontend.sh | Frontend logic bugs     |
