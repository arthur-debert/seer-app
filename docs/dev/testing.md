# Testing & Introspection

## Philosophy

Unit tests are the foundation. They test pure functions with no I/O, no GPU, no
timing dependencies. Climbing the integration ladder makes tests slower and more
brittle — only go higher when the lower layer can't cover what matters.

For a photography tool, visual correctness matters too. But "visual correctness"
decomposes into testable layers: the math that decides where pixels go
(unit-testable), the GPU pipeline that puts them there (snapshot-testable), and
the full app experience (introspectable).

**Principle:** If a rendering bug can be caught by testing the math that drives
the rendering, test the math. Don't reach for a screenshot.

## Layer 1: Unit Tests

Pure functions tested in Rust (`cargo test`) and TypeScript (`pnpm test`). No
GPU, no Tauri, no browser.

**What lives here:**

### arami-viewer

- Viewport math — `compute_fit`, `compute_view_layout`, zoom/pan functions
  (`src-tauri/arami-viewer/src/viewport.rs`, `viewer.rs`). Protected by `proptest` for mathematical invariant fuzzing.
- Geometry primitives — `Point`, `Size`, `Rect`
  (`src-tauri/arami-viewer/src/geometry.rs`)
- Framer layout — cover-fit, pan clamping, crop computation
  (`src-tauri/arami-viewer/src/framer.rs`)
- Serialization — ViewLayout JSON structure matches frontend expectations
  (`src-tauri/arami-viewer/tests/serialization.rs`)

### arami-editor

- Pipeline evaluation — adjustment processing, cache invalidation
  (`src-tauri/arami-editor/src/evaluate.rs`)
- History — coalescing, group lifecycle, log attachment
  (`src-tauri/arami-editor/src/history.rs`)
- Processing adjustments — each adjustment module has unit tests for identity defaults,
  parameter ranges, and algorithm correctness
  (`src-tauri/arami-editor/src/processing/`)
- Zone composition — boolean operations, blending
  (`src-tauri/arami-editor/src/zone.rs`)
- Graph operations — add/remove/reorder adjustments, sidecar round-trip
  (`src-tauri/arami-editor/src/graph.rs`, `sidecar.rs`)

### WASM bridge

- `arami-viewer-wasm` — JS-to-WASM type fidelity, module loading
  (`src-tauri/arami-viewer-wasm/tests/wasm_roundtrip.rs` via `wasm-pack test --node`)
- `arami-editor-wasm` — EditGraph construction, mutation methods, history integration
  (`src-tauri/arami-editor-wasm/tests/wasm_roundtrip.rs` via `wasm-pack test --node`)

### TypeScript

- WASM bridge — vitest loads compiled WASM in Node, verifies return structures
  (`src/lib/viewer/viewport.test.ts`)

**Run:** `cargo test --workspace` (all Rust), `wasm-pack test --node` (WASM
bridges), `pnpm test` (TypeScript)

## Layer 2: GPU Snapshot Tests

Render to a texture headlessly, read back pixels, compare against a reference
image.

**How it works:**

A Rust `#[test]` function uses `wgpu` with `compatible_surface: None` for
headless rendering:

1. Create a wgpu device (Metal on macOS, lavapipe Vulkan on Linux CI)
2. Generate synthetic procedural test targets in-memory (e.g., `generate_checkerboard`) or load test images.
3. Set up the pipeline, map the image, and render to a texture
4. Read back pixels via `copy_texture_to_buffer` + `map_async`
5. Compare against a stored reference PNG

**Image comparison (two-tier):**

| Check         | Crate                                | What it catches                                                    | Threshold             |
| ------------- | ------------------------------------ | ------------------------------------------------------------------ | --------------------- |
| **Fast gate** | `image_hasher` (dHash, 64-bit)       | Catastrophic failures: black screen, wrong image, inverted colors  | Hamming distance < 10 |
| **Detailed**  | `image-compare` (hybrid MSSIM + RMS) | Subtle issues: wrong aspect ratio, color shift, sampling artifacts | Score > 0.90          |

**Visual Regression Reporting:**
On SSIM failure (`score <= 0.90`), the test suite automatically generates a local HTML report in the system temporary directory. File names are keyed by PID and thread ID (`<pid>_<tid>`) so parallel test runs cannot clobber each other's artifacts:

- `test_report_<pid>_<tid>.html`: visually side-by-sides the Reference image, the broken Rendered output, and the highlighted Diff Map for immediate inspection.
- `procedural_report_<pid>_<tid>.html`: same three-panel layout for the procedural checkerboard snapshot test.

Both files are written just before the test panics so you can open them in a browser to inspect failures locally. All `<img src>` paths use proper `file://` URLs.

**Robustness:** Perceptual hashing and SSIM are inherently tolerant of
antialiasing differences, minor GPU driver variations, and DPR changes.
Pixel-exact comparison is deliberately avoided.

If no GPU adapter is available, tests skip gracefully. On CI,
`mesa-vulkan-drivers` provides lavapipe for software Vulkan.

## Layer 3: Introspection

Commands and APIs that expose internal state for automated verification. Works
in the running app (Tauri dev mode).

### Structured Logging

Every significant event is logged via `$lib/log.ts`. Create a logger with
`logger('component-name')`. Methods: `log.info()`, `log.warn()`, `log.error()`,
`log.debug()`. Set minimum level with `setLogLevel('debug')`. See the source
file for the full API.

### Canvas Readback

`Renderer.readback()` extracts the current canvas contents as raw RGBA pixels
via WebGPU `copyTextureToBuffer` + `mapAsync`. The canvas context is configured
with `COPY_SRC` to enable this.

### Render Export

Save the rendered output to a PNG file via a Tauri command (`export_render`).
Gated behind `#[cfg(debug_assertions)]` — exists in dev builds, stripped from
release builds.

## Platform Constraints

| Approach                   | macOS              | Linux                      | CI         |
| -------------------------- | ------------------ | -------------------------- | ---------- |
| Unit tests (Vitest)        | Yes                | Yes                        | Yes        |
| wgpu headless (Rust)       | Yes (Metal)        | Yes (Vulkan)               | Yes        |
| tauri-driver (WebDriver)   | **No**             | Yes                        | Linux only |
| Playwright + Tauri webview | **No**             | **No**                     | **No**     |
| Headless Chrome + WebGPU   | **No** (no canvas) | Partial (needs Vulkan GPU) | Partial    |

The wgpu headless path is the reliable cross-platform option for GPU rendering
tests.

## Dev-Dependencies

**Rust** (`src-tauri/Cargo.toml`):

- `wgpu` — headless GPU rendering for snapshot tests
- `pollster` — async runtime for wgpu in `#[test]`
- `image-compare` — SSIM, hybrid compare, diff map generation
- `image_hasher` — perceptual hashing (dHash, pHash, aHash)

**JS** (`package.json`):

- `vitest` — unit test runner
- `@webgpu/types` — TypeScript types for WebGPU API
