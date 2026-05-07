# Conventions

Project-wide conventions for Arami. When in doubt, check here first.

## Vocabulary

Arami defines a vocabulary that separates the photographer's concept of an
image from the files on disk. See the [vision doc](README.md) for the full
definitions. In brief:

| Term          | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| **Image**     | The photographer's unit of work. A concept, not a file.                 |
| **Rendering** | One editorial treatment of an image (a color grade, a mono conversion). |
| **Variant**   | A rendering at a specific crop and output ratio.                        |
| **Source**    | A file that contributes to an image (a RAW, an exported TIFF).          |

**In the current codebase**, the viewer infrastructure operates below this
vocabulary: it displays visual content on a canvas. The `image` parameter in
viewport functions (e.g., `contain_scale(image, canvas)`) refers to the pixel
dimensions of whatever is being displayed — which could be a Rendering, a
Variant, or a Source. It is not the Arami "Image" concept.

## Coordinate System

| Property | Convention                                                                           |
| -------- | ------------------------------------------------------------------------------------ |
| Origin   | Top-left `(0, 0)`                                                                    |
| Axes     | +X right, +Y down                                                                    |
| Units    | Physical pixels (post-DPR) for GPU work. CSS pixels for DOM layout. Always explicit. |

UV coordinates `[0, 1]` are shader-internal. The public API speaks pixel space.

The vertex shader flips Y when mapping to clip space — that's the shader's
job, not the API's.

## Geometry Types

Rust is the source of truth. TypeScript mirrors exactly. All coordinates are
`f64`. Truncation to GPU precision (`f32`) happens at the shader boundary,
nowhere else. See `arami-viewer::geometry` cargo docs for the full API.

## Display Modes

Two modes only: **Contain** (fit inside canvas, letterbox/pillarbox) and
**Cover** (fill canvas, crop edges). No Stretch — distorted images have no
use case in photography tooling. See `arami-viewer::viewport::DisplayMode`.

## Client / Server Boundary

**Principle:** maximize Rust.

Rust is easier to test (no browser variations, no GPU needed for math), can
serve non-browser targets (PDF export, CLI tools), and is the preferred
language. See [technical-overview.md](technical-overview.md) for the full
Rust-vs-TypeScript responsibility split.

### Rust (arami-editor, arami-viewer)

- All geometry math: viewport fit, coordinate transforms, layout computation
- Image processing: pipeline evaluation, adjustment processing, zone generation
- History tracking, sidecar serialization
- Key Points model and serialization
- Comparison logic (sync state)

### TypeScript

- WebGPU pipeline management (device, context, shaders, command encoding)
- DOM event wiring (ResizeObserver, mouse, keyboard)
- UI components and state
- WGSL shader source

### The Pattern

Rust computes a **layout** — given image dimensions, canvas dimensions, display
mode, zoom level, and pan offset, it returns the exact rectangles and shader
parameters. TypeScript receives the layout and feeds it to the GPU.

The shader doesn't know about display modes. It gets UV parameters.

```
[User event] -> [TS: capture canvas size, mouse pos, etc.]
             -> [Rust: compute layout]
             -> [TS: write uniforms, submit draw]
```

## Documentation

| Kind                    | Where                              | Example                                           |
| ----------------------- | ---------------------------------- | ------------------------------------------------- |
| Design docs (the "why") | `docs/`                            | `conventions.md`, `testing.md`, `imaging.md`      |
| API docs (the "what")   | In-code, Rust doc comments (`///`) | `arami_viewer::viewport::compute_view_layout`     |
| Inline rationale        | Comments at non-obvious points     | `// Y-flipped because texture origin is top-left` |

Rust doc comments are canonical for shared logic. TypeScript that wraps Rust
calls references the Rust docs rather than duplicating.

## Naming

| Context              | Style        | Example                             |
| -------------------- | ------------ | ----------------------------------- |
| Rust types           | `PascalCase` | `ViewLayout`, `DisplayMode`         |
| Rust functions       | `snake_case` | `compute_view_layout`               |
| TypeScript types     | `PascalCase` | `ViewLayout`, `DisplayMode`         |
| TypeScript functions | `camelCase`  | `computeViewLayout`                 |
| WGSL structs/vars    | `snake_case` | `uv_scale`, `Viewport`              |
| Tauri commands       | `snake_case` | `compute_view_layout`               |
| WebGPU labels        | `kebab-case` | `viewport-uniform`, `image-sampler` |
| Logger components    | `kebab-case` | `logger('renderer')`                |

## Testing

See [testing.md](testing.md) for the full strategy. Summary: math tested in
Rust (`cargo test`), WASM bridge tested via `wasm-pack test` and vitest, GPU
rendering tested via headless wgpu, introspection (logging + readback + export)
for the running app.
