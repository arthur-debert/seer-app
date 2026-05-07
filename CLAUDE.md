# Arami App — Project Conventions

## What This Repo Is

SvelteKit frontend for the Arami image editor. Consumes pre-built WASM packages from
[arami-core](https://github.com/arthur-debert/arami-core) releases.

**Stack:** Svelte 5, TypeScript, Tailwind CSS, Vite, Playwright

## Design Principles

- NO backwards compatibility, adapters, deprecated APIs, or fallbacks unless explicitly requested
- All math in Rust (via WASM); TypeScript is thin UI glue
- Top-left origin, +X right, +Y down

## WASM Dependency

WASM version is pinned in `wasm.config.json`. Packages are fetched automatically
by `scripts/fetch-wasm.sh` (called via `pnpm fetch:wasm`, runs before dev/build).

```bash
# Update to a new arami-core release
# Edit wasm.config.json → set "version" to the new tag
pnpm fetch:wasm

# Local dev against a local arami-core checkout
ARAMI_WASM_PATH=../arami-core pnpm dev
```

## Branching

Branch naming: `{type}/{issue-number}-{slug}`

- type: feature | bug | refactor | epic
- issue-number: the GH issue number this work belongs to
- slug: 2-4 words, hyphen-separated

Commit format: `{type}(#{issue}): {description}`

PR bodies always include `Closes #NN` so the issue closes on merge.

## Implementation

1. Create the branch before writing any code.
2. Run tests after implementing. Do not open a PR if tests fail.
3. Open PRs as draft. Do not remove draft status yourself.
4. Keep commits atomic. One logical change per commit.
5. Never commit with failing tests.

## Testing

### Commands

- **Frontend check:** `pnpm svelte-kit sync && pnpm svelte-check --tsconfig ./tsconfig.json --threshold warning`
- **Frontend unit tests:** `pnpm vitest run --passWithNoTests`
- **E2E tests:** `npx playwright test`
- **Format check:** `bash scripts/check-format-all.sh`
- **Full frontend check:** `bash scripts/check-frontend.sh`

### Rules

- Never commit with failing tests
- If tests fail after your changes, fix them before proceeding

## Code Review Criteria

When reviewing code (as reviewer or self-check):

1. **Adherence** — Does the code follow the task/goal/PR description in spirit?
2. **Completeness** — Does the code implement all proposed/expected functionality?
3. **Correctness** — Does the output match high-level expectations?
4. **Code Quality** — Right abstractions, follows codebase naming/organization conventions. All logic lives in the Rust backend; UI only collects input and displays results.
5. **Testing** — See Testing section above.

## Allowed Commands in CI

- `git`, `gh`, standard POSIX tools
- `pnpm`, `npx`
- Test runners and linters listed above

Do NOT run: `rm -rf`, `curl` to external URLs not in the project, `docker` commands.
