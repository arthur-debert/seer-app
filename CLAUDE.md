# Seer App — Project Conventions

## What This Repo Is

SvelteKit frontend for the Seer image editor. Consumes WASM packages from
[seer-core](https://github.com/arthur-debert/seer-core) via a git submodule at `src-tauri/`.

**Stack:** Svelte 5, TypeScript, Tailwind CSS, Vite, Playwright
**Desktop:** Tauri v2 (Rust shell lives in the submodule)

## Design Principles

- NO backwards compatibility, adapters, deprecated APIs, or fallbacks unless explicitly requested
- All math in Rust (via WASM); TypeScript is thin UI glue
- Top-left origin, +X right, +Y down

## Submodule Workflow

```bash
# First clone
git clone --recurse-submodules https://github.com/arthur-debert/seer-app.git

# Update submodule to latest seer-core
git submodule update --remote src-tauri
git add src-tauri && git commit -m "chore: update seer-core submodule"

# Local dev with seer-core changes (build WASM from submodule)
cd src-tauri && wasm-pack build seer-editor-wasm --target web --out-dir pkg
cd src-tauri && wasm-pack build seer-viewer-wasm --target web --out-dir pkg --no-typescript
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
- `pnpm`, `npx`, `wasm-pack`
- Test runners and linters listed above

Do NOT run: `rm -rf`, `curl` to external URLs not in the project, `docker` commands.
