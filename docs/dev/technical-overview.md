# Seer — Technical Overview

Seer is a suite of tools for photographers, built primarily in Rust.
This document covers the architectural principles and technical stack shared
across all Seer tools (Editor, Mirrors, Framer).

See [README.md](README.md) for the project vision and vocabulary.

---

## Guiding Principles

### Rust-First

All math, logic, and image processing live in Rust. TypeScript handles DOM
events, WebGPU pipeline management, and UI chrome.

Each tool's logic lives in a Rust library crate that compiles to both native
(for Tauri desktop) and `wasm32-unknown-unknown` (for browser). This is the
durable, portable asset. The frontend can be swapped without touching the core.

Why this matters:

- **Testability.** Core logic is tested with `cargo test` — no browser, no
  JSDOM, no framework. Fast, deterministic, comprehensive.
- **Portability.** Any future client (native app, CLI tool, PDF exporter) gets
  all logic for free.
- **Performance.** Rust on WASM is fast enough for real-time image processing.
  Hot paths can move to GPU compute shaders without changing the API boundary.

### Maximize Rust, Minimize Frontend

The frontend framework is the thinnest, most replaceable layer. Rust decides
what happens; TypeScript decides when and how to present it. Concretely:

| Rust (seer-editor, seer-viewer)                     | TypeScript (Svelte)                         |
| --------------------------------------------------- | ------------------------------------------- |
| All math: zoom, pan, layout, clamping, anchoring    | DOM event capture, forwarding deltas        |
| Pipeline evaluation, adjustment processing, history | UI chrome: toolbars, panels, settings       |
| Zone generation, composition, semantic analysis     | WebGPU pipeline management, shader dispatch |
| Sidecar serialization, data model                   | State display, user interaction feedback    |

### Three-Layer Architecture

All interactive components (ImageViewer, Framer, Mirror) follow the same
pattern:

**Layer 1 — Pure Math (Rust).** Stateless pure functions: `(inputs) -> output`.
No side effects, no mutation. Exhaustively testable with `cargo test`. This is
where zoom anchoring, pan clamping, layout computation, and coordinate
transforms live.

**Layer 2 — Stateful Controller (Rust).** Holds mutable state, enforces
invariants, caches derived values. UI-agnostic — shared across web and native.
Exposed to WASM as a live heap object (TypeScript holds a reference and calls
methods). Examples: `ViewerState`, `FramerState`, `EditGraph`.

**Layer 3 — UI Widget (Svelte/TS).** Thin glue: translates platform events
into Layer 2 calls, applies returned data to GPU uniforms, redraws. No logic
beyond event capture and display.

This separation means: Layer 1 functions can be reused across components
(Framer uses the same zoom math as ImageViewer). Layer 2 controllers can be
tested without a browser. Layer 3 can be replaced (e.g., a future Rust UI
framework) without touching Layers 1 or 2.

---

## Compute Topology

Code execution falls into three tiers, independent of where data lives:

| Tier                  | What runs here                                            | Why here                                                  |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **In-process, local** | Viewport math, zoom/pan, interactive state, GPU rendering | Latency-critical — must respond within ~16ms frame budget |
| **Local, async**      | Pipeline evaluation, image decoding, file I/O             | Too slow for synchronous calls, but no network dependency |
| **Remote (future)**   | AI models, large-batch processing, shared catalog ops     | Compute that cannot live on every client                  |

The Rust core crates are the portable logic layer. They compile to native
(Tauri desktop) and `wasm32` (browser), sharing all logic across platforms.
The client should not need to know whether a response came from a local
computation or a remote one — the same async API boundary serves both.

Pipeline evaluation runs in a Web Worker (off main thread) to keep the UI
responsive during expensive image processing. See
[specs/execution-interaction.md](specs/execution-interaction.md) for the
async model.

---

## Sync Model (Future)

Seer targets a local-first, offline-first architecture. The typical
scenario is one photographer across multiple devices, occasionally sharing
with an editor or client.

**Three data tiers with different sync strategies:**

| Tier                    | Examples                                             | Sync strategy                                   |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| **Image blobs**         | JPEG, TIFF, PNG, DNG                                 | Content-addressed (hash). Lazy fetch on demand. |
| **Structured metadata** | Edit sidecars, catalog entries, crop definitions     | CRDTs for conflict-free merge across clients.   |
| **Derived data**        | Thumbnails, cached pipeline outputs, preview renders | Never synced. Regenerated locally.              |

This is design intent, not implemented infrastructure. The architectural
choices that matter now: structured metadata stored as operation logs (not
snapshots), all reads/writes through an async API boundary, and image blobs
referenced by content hash from the start.

---

## Stack

### Architecture

```
Rust core crates (per-tool logic, image processing, color science)
  +-- native build -> Tauri backend (desktop)
  +-- wasm32 build -> browser WASM module (web)

Svelte 5 frontend (shared UI chrome)
  +-- in Tauri webview (desktop)
  +-- served by Axum (web)

WGSL shaders (rendering)
  +-- via WebGPU/WebGL2 in webview and browser
```

### Why This Stack

**Rendering — wgpu + WGSL shaders, not Canvas 2D or `<img>` elements.**
Photographer tools need control over interpolation (Lanczos, bicubic),
sharpening, color space conversions (sRGB/Display P3/ProPhoto), and float
internal processing. Canvas 2D offers none of this. wgpu compiles to
Vulkan/Metal/DX12 natively and WebGPU/WebGL2 in browsers. Shaders written
once in WGSL, Naga translates to all backends.

**Desktop — Tauri v2, not Electron.**
2-10MB installer vs 80-120MB. 30-40MB idle RAM vs 200-300MB. Rust backend
with native filesystem, multi-threading, full performance. Tauri does not
produce a web build — web deployment is a separate path via Axum.

**Frontend — Svelte 5, not React/Vue/Solid.**
Compiler-based: almost zero runtime shipped (~3KB gzipped). The framework
manages toolbars, panels, settings — actual image rendering is wgpu shaders
on `<canvas>`, not framework code.

**Web server — Axum, not Node.js.**
Same language as the rest of the suite. The Rust core crate compiles to WASM
for in-browser processing. Axum serves the static frontend and optionally
handles server-side processing for large images.

### Alternatives Evaluated and Rejected

| Option                   | Reason rejected                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **egui (pure Rust GUI)** | No CSS layout, utilitarian styling. UI-heavy features require extensive manual work.  |
| **Dioxus**               | Not yet 1.0. Blitz native renderer is experimental. wgpu canvas integration unmerged. |
| **Iced**                 | Web support has reliability issues across browser/platform combos.                    |
| **Slint**                | No custom GPU shader access — fatal for rendering requirements.                       |
| **Electron**             | Bundle size, memory, ecosystem dependency bloat.                                      |
| **Canvas 2D**            | No custom scaling, no shaders, no compute, no HDR. Insufficient for photography.      |

### Known Risks and Mitigations

**Tauri IPC for large images is slow on Windows.**
Mitigation: serve images via Tauri's asset protocol (URL-based fetch).

**WebKit rendering on macOS/Linux differs from Chromium on Windows.**
Mitigation: image rendering is wgpu shaders on canvas, not CSS. Test across
platforms.

**Two languages (Rust + TS), two build systems.**
Mitigation: the JS layer is thin UI chrome. All logic lives in Rust. If a
Rust UI framework matures, the frontend can go full Rust without changing
the core crates or shaders.

### Frontend Stack

```
pnpm
+-- SvelteKit (adapter-static, SSR disabled)
|   +-- Svelte 5 (runes, scoped <style>)
|   +-- TypeScript
|   +-- Tailwind CSS 4 (@tailwindcss/vite plugin)
|   +-- Bits UI (headless accessible primitives)
+-- Vite
+-- ESLint 9 + eslint-plugin-svelte
+-- Prettier + prettier-plugin-svelte
+-- Tauri v2
    +-- tauri.conf.json -> Vite dev server + static build output
    +-- src-tauri/ (Rust backend, Cargo workspace)
```

**CSS — Tailwind CSS 4.** Utility classes with CSS-first configuration via
`@theme` directives. The tools in this suite use fewer components with deeper
customization — utility classes give full control without fighting a design
system's opinions.

**UI primitives — Bits UI.** Headless accessible primitives (~40 components)
with zero styling. We style directly with Tailwind on the primitives rather
than copying pre-styled component libraries.

**Package manager — pnpm.** Strict dependency resolution, fast, disk-efficient.

### Future Path

When a Rust UI framework reaches production maturity with stable wgpu canvas
integration, the Svelte frontend can be replaced — the core crates and WGSL
shaders are unchanged. The architecture is designed so the frontend is the
thinnest, most replaceable layer.

---

## Crate Structure

```
src-tauri/
+-- Cargo.toml              (workspace root)
+-- seer-editor/             Pure Rust image processing pipeline
|   +-- src/
|       +-- graph/          EditGraph: 5-phase document model
|       |   +-- mod.rs          EditGraph struct and cross-phase operations
|       |   +-- source_phase.rs SourcePhase: multi-entry sources + MergeStrategy
|       |   +-- geometry_phase.rs GeometryPhase: ordered spatial transforms
|       |   +-- zone_phase.rs   ZonePhase: zone generator/composition registry
|       |   +-- adjustment_phase.rs AdjustmentPhase: ordered pixel adjustments
|       |   +-- output_phase.rs OutputPhase: output groups with child nodes
|       |   +-- phase_topology.rs PhaseTopology enum + static PHASES descriptors
|       +-- merge.rs        Source merging: condenses N buffers into one
|       +-- adjustment.rs   Adjustment: plugin_id + ParamValues
|       +-- evaluate.rs     Phase-ordered streaming evaluation
|       +-- plugin.rs       Plugin traits (Adjustment, Zone, Source, Output, OutputChild)
|       +-- registry.rs     PluginRegistry: adjustment, geometry, zone, source, output, output-child
|       +-- zone.rs         ZoneSource, generators, composition
|       +-- pixel_buffer.rs f32 image buffer
|       +-- session.rs      Session: shared engine API for all frontends
|       +-- versioning/     Version tree, history, sidecar serialization
|       +-- plugins/        Built-in adjustment, geometry, source, and output plugins
|       +-- zone_plugins/   5 zone generator plugins
|       +-- processing/     Per-plugin processing functions
+-- seer-editor-wasm/             WASM bridge for seer-editor
+-- seer-viewer/           Pure geometry/viewport math
|   +-- src/
|       +-- geometry.rs     Point, Size, Rect
|       +-- viewport.rs     DisplayMode, ViewLayout, contain-fit
|       +-- viewer.rs       ViewerState, zoom/pan Layer 1+2
|       +-- framer.rs       FramerState, crop Layer 1+2
|       +-- render_config.rs SamplingFilter, RenderConfig
+-- seer-viewer-wasm/           WASM bridge for seer-viewer
```

Each `-core` crate is pure Rust with no WASM dependencies. Each `-wasm` crate
is a thin bridge wrapping the core via `wasm-bindgen` and
`serde-wasm-bindgen`. Core crates carry the cargo doc — see module-level
`//!` comments for architecture, algorithm details, and API contracts.
