# Seer Extensibility Design

## Premise

Photo editing applications are typically hermetic: every algorithm, format handler,
and export path is built-in. This leaves a wealth of focused innovation stranded —
novel demosaicing algorithms, AI-powered retouching, specialized storage integrations,
niche output formats — because the only way to deliver them is to build an entire
editing application around them.

Seer's workflow scaffold — pipeline sequencing, zone-based selective editing, version
history, async evaluation, responsive UI — has significant standalone value. If third
parties can plug into this scaffold at well-defined points, distributing image
processing ideas becomes dramatically easier.

But "allow unlimited extensibility" is not a goal. We are guardians of an opinionated,
consistent experience. The design must:

1. **Define clear boundaries** — what third parties can and cannot do
2. **Provide a rich environment** — declarative UI, helper libraries, testing tools
3. **Eat our own dog food** — core adjustments use the same plugin interfaces
4. **Sandbox by default** — third-party code cannot compromise the host

---

## Extension Points

Six categories of functionality can be opened to plugins, ordered by value and
feasibility:

### 1. Pixel Adjustments (Primary)

The most valuable extension point. A plugin receives pixel data, applies a
transformation, returns pixel data.

**Examples**: film emulation, AI denoising, frequency separation, HDR tone mapping,
skin retouching, lens correction, chromatic aberration removal.

**Contract**:

- **Input**: `PixelBuffer` (f32 RGB interleaved, row-major, 0–1 nominal range,
  values may exceed [0,1] during pipeline processing)
- **Output**: `PixelBuffer` (same dimensions as input)
- **Context**: source metadata (EXIF, file type, dimensions), pipeline position,
  optional semantic class map access
- **Invariant**: the plugin processes the full image; zone blending is handled by
  the host. Plugins never see or handle zone masks.

**Categories** (for workflow wizards and user-configurable pipeline ordering):

- `color` — white balance, color grading, color space transforms
- `tone` — curves, levels, exposure, highlights/shadows
- `detail` — sharpening, denoising, clarity, texture
- `creative` — film emulation, color lookup, split toning
- `correction` — lens correction, chromatic aberration, perspective
- `ai` — AI-powered operations (upscale, generative fill, object removal)

Categories are metadata for organization. They do not constrain what the adjustment
does — a `creative` plugin can manipulate any pixel it wants.

### 2. Zone Generators

Custom mask/selection generation. Extends the 5 built-in generators (Luminance,
ColorRange, Gradient, Brush, Semantic) with arbitrary mask logic.

**Examples**: depth-map zones (from AI monocular depth), face/eye detection zones,
edge-aware selections, frequency-domain zones, texture-based zones.

**Contract**:

- **Input**: `PixelBuffer` (source image) + parameters + optional `ClassMap`
- **Output**: `ZoneBuffer` (f32 grayscale, one value per pixel, [0, 1])
- **Invariant**: zones compose via the host's Boolean operations (Union, Intersect,
  Subtract, Invert). Plugins produce a single mask.

### 3. Source Decoders

RAW processing and format decoding. A decoder receives file bytes and produces a
linearized, demosaiced PixelBuffer.

**Examples**: custom RAW processors (alternative demosaicing algorithms, noise
profiles), specialized scientific imaging formats (FITS, DICOM), HDR formats
(OpenEXR, Radiance HDR).

**Contract**:

- **Input**: raw file bytes + file path/extension hint
- **Output**: `PixelBuffer` + `SourceMetadata` (dimensions, color profile,
  EXIF, orientation, bit depth)
- **Declaration**: list of supported file extensions and MIME types
- **Negotiation**: host queries decoders by extension; first match wins (user
  can override decoder preference per format)

### 4. Export Targets

Output encoding and delivery. Goes beyond "save as JPEG" to structured output
pipelines.

**Examples**: AVIF/WebP/JPEG XL encoding with quality control, social media
format packages (Instagram carousel, story dimensions), print-ready TIFF with
ICC profile embedding, contact sheet generation, web gallery export.

**Contract**:

- **Input**: `PixelBuffer` (final processed image) + `ExportParams` (declared
  by plugin) + `SourceMetadata`
- **Output**: encoded bytes + MIME type, or side effect (write to path)
- **Declaration**: output format name, file extension, configurable parameters

### 5. Storage Backends

Blob storage abstraction. Seer's image catalog can read from and write to
arbitrary storage systems.

**Examples**: local filesystem (built-in), S3-compatible object storage, Google
Photos API, Adobe Lightroom catalog bridge, DAM system integration.

**Contract**:

Distinguishes between "content-addressed blob storage" (immutable) and "catalog synchronizers" (mutable metadata, authentication, destructive uploads). At a basic level:

```
list(prefix: string) -> Vec<BlobEntry>
read(id: string) -> bytes
write(id: string, bytes) -> Result
delete(id: string) -> Result
metadata(id: string) -> BlobMetadata
```

### 6. Color Profiles

Custom color space and profile handling. Lower priority — ICC profiles cover
most needs.

**Examples**: custom working spaces, device-specific profiles, print simulation
profiles.

**Contract**: Deferred to a later design phase. ICC profile support is sufficient
for initial extensibility.

---

## Plugin Runtime & Trust Model

### What Users Actually Care About

A user installing a plugin doesn't think about memory isolation or type safety.
They think:

- **Will this break my editing session?** (crash, freeze, corrupt my image)
- **Is this plugin any good?** (reviews, ratings, author reputation)
- **Is someone watching the store?** (curation, vetting, a marketplace that
  filters garbage)

The trust model should serve these concerns, not our internal preferences
about type systems. Rust's borrow checker is invisible to end users — what's
visible is whether the plugin works reliably or not.

### What Plugin Authors Actually Need

A computer graphics researcher with a novel tone mapping algorithm in C
doesn't want to learn WASM toolchains. A PixInsight script author comfortable
in JavaScript doesn't want to learn Rust. The plugin author population is:

- **Graphics programmers** comfortable with C/C++/GLSL who think in byte
  streams and pointers
- **Research engineers** prototyping from papers, often with reference C code
- **Rust enthusiasts** who already live in this ecosystem
- **Hobbyists** comfortable with scripting languages

The runtime must not demand that all of them become WASM build system experts.

### The Real Isolation Question

The first draft over-indexed on WASM as a silver bullet. Let's be honest about
what each isolation level actually buys us:

| Threat                       | Impact          |       WASM        |    Process isolation     |   Native dylib   |
| ---------------------------- | --------------- | :---------------: | :----------------------: | :--------------: |
| Plugin corrupts host memory  | Crash/data loss |     Prevented     |        Prevented         |   **Possible**   |
| Plugin infinite loops        | UI freeze       | Timeout kills it  |         SIGKILL          |  Must watchdog   |
| Plugin leaks memory          | Host OOM        | Linear memory cap |      rlimit/cgroup       |  Must watchdog   |
| Plugin reads user files      | Privacy         |     Prevented     |     Sandbox profile      |   **Possible**   |
| Plugin calls network         | Exfiltration    |     Prevented     |     Sandbox profile      |   **Possible**   |
| Plugin produces wrong pixels | Bad edit        |  Not detectable   |      Not detectable      |  Not detectable  |
| Plugin is slow               | Poor UX         |  Not detectable   |      Not detectable      |  Not detectable  |
| Plugin panics                | Crash           | Trapped as error  | Process dies, host lives | **Host crashes** |

The critical insight: **no isolation model can detect bad pixels or slow code**.
A plugin that "works" but produces ugly results, or takes 10 seconds for a
simple operation, is a quality problem, not a security problem. That's solved
by curation, reviews, and testing harnesses — not by sandboxing technology.

What isolation _does_ solve is the hard failure modes: memory corruption,
crashes, freezes, and data exfiltration. Those are the ones where the choice
of runtime matters.

### The Pragmatic Architecture: WASM-Primary, Not WASM-Only

**WASM is the primary runtime** — for the same reasons listed before (Seer
already lives in WASM, cross-platform binaries, ecosystem momentum). But we
acknowledge two things:

1. **WASM is not the only way to prevent host corruption.** Process isolation
   with shared memory achieves the same safety with zero compute overhead and
   full native SIMD. The cost is ~5 us per invocation for signaling.

2. **The C research paper scenario is real.** A novel demosaicing algorithm
   published with reference C code shouldn't require the author to set up
   `wasi-sdk`. If we provide a thin Rust shim (~20 lines) that wraps C via
   FFI, the same code can compile to both native and WASM targets. But making
   the native path a first-class option (for authors who find it easier)
   broadens the contributor pool.

The architecture supports **three execution modes**, hidden behind the same
`AdjustmentPlugin` trait:

| Mode                         | When                                  | Overhead                    | Isolation       | Plugin author writes  |
| ---------------------------- | ------------------------------------- | --------------------------- | --------------- | --------------------- |
| **Native (compiled-in)**     | Core seer.\* adjustments              | Zero                        | Full trust      | Rust, same repo       |
| **WASM (in-process)**        | Default for third-party               | ~1.1x on ARM, ~1.5x on x86  | Memory sandbox  | Rust/C/C++ → .wasm    |
| **Process (out-of-process)** | Escape hatch for heavy/native plugins | ~5 us signal + native speed | Process sandbox | Any language → binary |

The third mode (process isolation) is the "C research paper" answer. A plugin
ships as a native binary instead of `.wasm`. Seer spawns it as a child process,
maps shared memory for pixel data exchange (zero-copy on both macOS and Linux),
and applies OS-level sandboxing (`sandbox-exec` on macOS, `seccomp-bpf` +
namespaces on Linux). The plugin reads pixels from shared memory, writes output,
signals completion. If it crashes, the host process survives.

**But WASM is the recommended path** and the only one with a streamlined
developer experience (derive macros, single-file output, cross-platform). The
process mode exists for specific needs, not as the default.

### Trust Through Curation, Not Through Type Systems

The user-facing trust model is a **layered curation system**, independent of
the runtime:

**Tier 1: Seer Core** (`seer.*`)

- Ships with Seer. Tested as part of CI. Fully trusted. No installation.
- These are the built-in adjustments, zones, decoders.

**Tier 2: Verified** (`verified.*`)

- Reviewed by Seer team or trusted reviewers.
- Passes automated test suite (see Plugin Test Harness below).
- Listed in the Seer plugin directory with a "Verified" badge.
- User sees: "This plugin has been reviewed and tested."

**Tier 3: Community** (`contrib.*`)

- Published by community members. Not reviewed by Seer team.
- Must pass automated test harness (determinism, no NaN, dimensions preserved,
  reasonable output range, completes within timeout).
- User reviews and ratings visible.
- User sees: "Community plugin — not officially reviewed. 4.2 stars, 127 installs."

**Tier 4: Local / Developer** (any namespace)

- Sideloaded from disk. No vetting.
- User sees: "This plugin was installed manually and has not been reviewed."
- Developer mode for plugin authors testing their own code.

The point: **the user's trust comes from social proof and curation**, not from
whether the plugin runs in WASM or a subprocess. Both WASM and process-isolated
plugins can be Verified or Community. The trust tier is orthogonal to the
execution mode.

### Plugin Test Harness

Every plugin — regardless of execution mode — must pass a standard test suite
before being listed in any tier above Local:

```
1. Identity test: at default params, output ≈ input (within ε)
2. Determinism: same input + params → same output (bitwise)
3. Dimensions: output dimensions = input dimensions
4. No NaN/Inf: output contains no NaN or Inf values
5. Range: output values within [-1.0, 2.0] (reasonable HDR range)
6. Performance: completes within timeout (configurable, default 30s for 24MP)
7. Memory: peak memory usage within limit (default 512 MB)
8. Idempotence: applying twice with same params ≈ applying once (for applicable categories)
```

The harness runs automatically on submission to the plugin directory. Plugin
authors can run it locally via `seer-sdk test`. Failed tests produce clear
diagnostics ("test 3 failed: output is 1920x1080 but input was 6000x4000").

This is the real safety net. A WASM plugin that passes all 8 tests is trustworthy
in the ways users care about. A native plugin that passes all 8 tests is equally
trustworthy. The harness catches the problems isolation can't: wrong output,
slow processing, dimension mismatches.

### Runtime Recovery

Even with testing, plugins can misbehave in production (different image content,
edge cases). The host must recover gracefully:

- **Timeout**: if `process()` doesn't return within the limit, the host kills it
  (WASM: fuel exhaustion; process: SIGKILL) and shows "Plugin X timed out" in
  the adjustment list. The adjustment is auto-disabled. The user can re-enable
  to retry, or remove it.

- **Crash**: WASM traps and process crashes are caught. The adjustment shows
  an error badge. The pipeline continues without it (passes input through as
  output). The user's edit session is not interrupted.

- **Bad output**: if the output contains NaN or Inf values, the host detects
  this and substitutes the input (identity passthrough). Shows a warning.

- **Memory exceeded**: WASM linear memory cap or process rlimit triggers. Same
  recovery as crash.

The key UX principle: **a bad plugin degrades its own step, never the whole
pipeline**. The user can always undo, disable, or remove a problematic plugin
and continue editing.

### Interface Definition: WIT

Regardless of execution mode, the host-plugin contract is defined using WIT
(WebAssembly Interface Types). For WASM plugins, this generates bindings
directly. For process-isolated plugins, it defines the shared-memory message
schema:

```wit
package seer:plugin@1.0.0;

/// The core pixel buffer type passed between host and plugins.
/// Data is f32 RGB interleaved, row-major. Length = width * height * 3.
/// Values are nominally [0, 1] but may exceed this range during processing.
record pixel-buffer {
    width: u32,
    height: u32,
    data: list<float32>,
}

/// Grayscale mask buffer. Length = width * height.
record zone-buffer {
    width: u32,
    height: u32,
    data: list<float32>,
}

/// Semantic segmentation class map. ADE20K class IDs (0–149).
record class-map {
    width: u32,
    height: u32,
    data: list<u8>,
}

/// Metadata about the source image.
record source-metadata {
    path: string,
    width: u32,
    height: u32,
    file-type: string,
    color-profile: option<string>,
    exif: list<tuple<string, string>>,
}

/// Context provided to pixel adjustments during evaluation.
record adjustment-context {
    source-metadata: source-metadata,
    pipeline-index: u32,
    pipeline-length: u32,
    class-map: option<class-map>,
}

/// Context provided to zone generators during evaluation.
record zone-context {
    source-metadata: source-metadata,
    class-map: option<class-map>,
}
```

Plugin extension points are defined as separate worlds:

```wit
/// A pixel adjustment plugin.
world adjustment {
    /// Return the plugin's parameter schema.
    export describe: func() -> param-schema;

    /// Upgrades parameters from an older version of this plugin to the current schema.
    /// Enables non-destructive sidecar upgrades across plugin versions.
    export migrate: func(
        from-version: string,
        old-params: param-values,
    ) -> result<param-values, string>;

    /// Process pixels. Called by the host during pipeline evaluation.
    /// The host handles zone blending — this function always processes
    /// the full image.
    export process: func(
        input: pixel-buffer,
        params: param-values,
        ctx: adjustment-context,
    ) -> result<pixel-buffer, string>;
}

/// A zone generator plugin.
world zone-generator {
    export describe: func() -> param-schema;

    export migrate: func(
        from-version: string,
        old-params: param-values,
    ) -> result<param-values, string>;

    export generate: func(
        source: pixel-buffer,
        params: param-values,
        ctx: zone-context,
    ) -> result<zone-buffer, string>;
}

/// A source decoder plugin.
world source-decoder {
    /// Which file extensions this decoder handles.
    export supported-extensions: func() -> list<string>;

    /// Decode raw file bytes into a pixel buffer.
    export decode: func(
        bytes: list<u8>,
        path: string,
    ) -> result<tuple<pixel-buffer, source-metadata>, string>;
}

/// An export target plugin.
world export-target {
    export describe: func() -> param-schema;

    /// Encode a pixel buffer to the target format.
    export encode: func(
        image: pixel-buffer,
        params: param-values,
        metadata: source-metadata,
    ) -> result<list<u8>, string>;

    /// File extension for this export format.
    export file-extension: func() -> string;
}
```

---

## Parameter Schema & Declarative UI

The most impactful design decision for the extensibility UX. Inspired by OpenFX's
parameter negotiation and GEGL's automatic dialog generation: **plugins declare
parameters, the host generates all UI**.

Plugin authors never write UI code. They describe what they need, and Seer renders
professional, consistent controls — sliders, dropdowns, curve editors, color
pickers — that match the rest of the application.

### Schema Types

```wit
/// A parameter descriptor.
variant param-type {
    /// Continuous floating-point value with range and optional step.
    float-param(float-param-desc),
    /// Integer value with range and optional step.
    int-param(int-param-desc),
    /// Boolean toggle.
    bool-param(bool-param-desc),
    /// Selection from enumerated options.
    choice-param(choice-param-desc),
    /// RGB color value.
    color-param(color-param-desc),
    /// Editable spline curve (control points).
    curve-param(curve-param-desc),
    /// Spatial point on the image canvas (normalized 0.0-1.0).
    point-param(point-param-desc),
    /// Rectangle/bounding box on the canvas (normalized coordinates).
    rect-param(rect-param-desc),
    /// User-drawn path or brush stroke on the canvas.
    path-param(path-param-desc),
}

record float-param-desc {
    min: float64,
    max: float64,
    default-val: float64,
    step: option<float64>,
    unit: option<string>,     // "K", "°", "px", "%", "σ", "EV"
    ui-hint: option<ui-hint>,
}

record int-param-desc {
    min: s64,
    max: s64,
    default-val: s64,
    step: option<s64>,
    unit: option<string>,
    ui-hint: option<ui-hint>,
}

record bool-param-desc {
    default-val: bool,
}

record choice-param-desc {
    options: list<choice-option>,
    default-index: u32,
    ui-hint: option<ui-hint>,
}

record choice-option {
    id: string,
    label: string,
    description: option<string>,
}

record color-param-desc {
    default-r: float32,
    default-g: float32,
    default-b: float32,
}

record curve-param-desc {
    default-points: list<control-point>,
    /// Number of curve channels (1 = master only, 4 = master + RGB).
    channels: u32,
}

record control-point {
    x: float32,
    y: float32,
}

record point-param-desc {
    default-x: float32,
    default-y: float32,
}

record rect-param-desc {
    default-x: float32,
    default-y: float32,
    default-width: float32,
    default-height: float32,
}

record path-param-desc {
    // Paths default to empty
}

/// UI rendering hints. The host uses these to pick the best widget.
/// If absent, the host picks based on param-type (float → slider, etc.)
enum ui-hint {
    slider,
    knob,
    color-wheel,
    curve-editor,
    toggle,
    dropdown,
    button-group,
    hidden,
}

record param-descriptor {
    id: string,
    label: string,
    description: option<string>,
    param-type: param-type,
    /// Group ID for visual organization (params with same group
    /// render under a shared header).
    group: option<string>,
}

record param-group {
    id: string,
    label: string,
    /// Collapsed by default?
    collapsed: bool,
}

record param-schema {
    params: list<param-descriptor>,
    groups: list<param-group>,
}

/// Runtime parameter values, keyed by param ID.
/// The host validates types and ranges before calling process().
type param-values = list<tuple<string, param-value>>;

variant param-value {
    float-val(float64),
    int-val(s64),
    bool-val(bool),
    choice-val(u32),
    color-val(tuple<float32, float32, float32>),
    curve-val(list<control-point>),
    point-val(tuple<float32, float32>),
    rect-val(tuple<float32, float32, float32, float32>),
    path-val(list<tuple<float32, float32>>),
}
```

### UI Generation Flow

1. Plugin loaded → host calls `describe()` → receives `param-schema`
2. Host builds UI panel from schema:
   - `float-param` → range slider (or knob if `ui-hint = knob`)
   - `int-param` with small range → stepper; large range → slider
   - `bool-param` → toggle switch
   - `choice-param` → dropdown (many options) or button group (2–4 options)
   - `color-param` → color well + color picker popover
   - `curve-param` → CurveEditor component (reusing Seer's built-in)
   - `point-param` / `rect-param` / `path-param` → host intercepts spatial interactions on the `<canvas>`, converts to normalized `[0.0, 1.0]` coordinates.
3. User interacts → host validates value (clamp to range, coerce type)
4. Host debounces via rAF coalescing (same as built-in adjustments)
5. Host calls `process()` with validated `param-values`

The plugin author's experience:

```rust
use seer_sdk::*;

#[derive(Params)]
struct FilmEmulationParams {
    #[param(label = "Film Stock", options = [
        ("portra400", "Portra 400", "Warm tones, low contrast"),
        ("ektar100", "Ektar 100", "High saturation, fine grain"),
        ("trix400", "Tri-X 400", "Classic B&W contrast"),
        ("hp5", "HP5 Plus", "Versatile B&W"),
    ])]
    stock: Choice,

    #[param(label = "Intensity", min = 0.0, max = 1.0, default = 0.8)]
    intensity: f32,

    #[param(label = "Grain", min = 0.0, max = 1.0, default = 0.3,
            group = "texture")]
    grain: f32,

    #[param(label = "Grain Size", min = 0.5, max = 3.0, default = 1.0,
            unit = "px", group = "texture")]
    grain_size: f32,

    #[param(label = "Halation", min = 0.0, max = 1.0, default = 0.1,
            group = "optical")]
    halation: f32,

    #[param(label = "Vignette", min = -1.0, max = 1.0, default = 0.2,
            group = "optical")]
    vignette: f32,

    #[param(label = "Tone Curve", channels = 4, group = "advanced")]
    curve: Curve,
}

#[seer_plugin(
    id = "com.filmdev.emulation",
    name = "Film Emulation",
    category = "creative",
    version = "1.2.0",
    author = "FilmDev Labs",
)]
impl Adjustment for FilmEmulation {
    type Params = FilmEmulationParams;

    fn process(input: &PixelBuffer, params: &Self::Params, ctx: &AdjustmentContext)
        -> Result<PixelBuffer, String>
    {
        let lut = load_stock_lut(params.stock);
        let mut output = apply_lut(input, &lut, params.intensity);
        if params.grain > 0.0 {
            add_film_grain(&mut output, params.grain, params.grain_size);
        }
        if params.halation > 0.0 {
            add_halation(&mut output, params.halation);
        }
        if params.vignette.abs() > 0.001 {
            apply_vignette(&mut output, params.vignette);
        }
        apply_tone_curve(&mut output, &params.curve);
        Ok(output)
    }
}
```

This compiles to a single `.wasm` file. The `#[derive(Params)]` macro generates
the `describe()` implementation. The `#[seer_plugin]` macro generates the WASM
entry points and plugin manifest.

The resulting UI in Seer — with no UI code from the plugin author:

```
┌─ Film Emulation ──────────────────────┐
│                                       │
│  Film Stock    [▼ Portra 400      ]   │
│  Intensity     ──────────●──── 0.80   │
│                                       │
│  ▸ Texture                            │
│    Grain       ──●──────────── 0.30   │
│    Grain Size  ──●──────────── 1.0 px │
│                                       │
│  ▸ Optical                            │
│    Halation    ●────────────── 0.10   │
│    Vignette    ─────●──────── 0.20    │
│                                       │
│  ▾ Advanced                           │
│    ┌──────────────────────────────┐   │
│    │  Tone Curve  [M] R G B      │   │
│    │      ╭──────────╮           │   │
│    │     ╱            ╲          │   │
│    │   ╱                ╲        │   │
│    │  ╱                  ╲       │   │
│    │ ╱                    ╲      │   │
│    └──────────────────────────────┘   │
└───────────────────────────────────────┘
```

### What This Means for the Host

The host (Seer's Svelte frontend) replaces the current per-adjustment `{#if}`
chain in `ParamPanel.svelte` with a generic schema renderer:

```
ParamPanel receives param-schema
  → for each param-group, render collapsible section
    → for each param in group, render widget by type
      → float → Slider component
      → choice → Dropdown or ButtonGroup
      → curve → CurveEditor
      → point/rect/path → Hook into viewport canvas interaction manager
      → etc.
  → on change, validate, coalesce via rAF, call process()
```

Core adjustments (WhiteBalance, ToneCurve, etc.) also declare their params
through the same schema, so `ParamPanel` becomes a single generic component
rather than 8 hand-coded branches.

---

## Contextual Data & Capabilities

### What Plugins See

| Data              | Adjustments | Zone Generators | Source Decoders | Export Targets |
| ----------------- | :---------: | :-------------: | :-------------: | :------------: |
| Input pixels      |      ✓      |   ✓ (source)    |        —        |   ✓ (final)    |
| Own parameters    |      ✓      |        ✓        |        —        |       ✓        |
| Source metadata   |      ✓      |        ✓        |    produces     |       ✓        |
| Class map         |   ✓ (opt)   |     ✓ (opt)     |        —        |       —        |
| Pipeline position |      ✓      |        —        |        —        |       —        |
| Report progress   |   ✓ (opt)   |     ✓ (opt)     |     ✓ (opt)     |    ✓ (opt)     |
| ML Inference API  |   ✓ (opt)   |     ✓ (opt)     |        —        |       —        |
| Zone mask         |      —      |        —        |        —        |       —        |
| Other adjustments |      —      |        —        |        —        |       —        |
| Version history   |      —      |        —        |        —        |       —        |
| Filesystem        |      —      |        —        |        —        |       —        |
| Network           |      —      |        —        |        —        |       —        |

Key restrictions:

- **No zone mask access for adjustments** — the host applies zone blending.
  This ensures consistent blend behavior and prevents plugins from subverting
  the zone system.
- **No access to other adjustments' parameters** — each plugin is isolated.
  A film emulation plugin cannot read the current white balance settings.
- **No filesystem or network** — plugins are pure functions over pixel data.
  If a plugin needs external resources (LUT files, model weights), they must
  be bundled into the `.wasm` binary or provided through a host-mediated
  resource system (see Resources section below).

### Class Map Access

Plugins that want semantic awareness can query the class map:

```wit
/// Query which ADE20K class a pixel belongs to.
/// Returns class ID (0–149) or none if no class map available.
import seer:host/classmap.{
    has-classmap: func() -> bool,
    class-at: func(x: u32, y: u32) -> option<u8>,
    class-name: func(id: u8) -> string,
}
```

This is an opt-in import — plugins that don't need semantic data don't import
it and avoid the overhead. But a skin retouching plugin can query whether a
pixel is classified as "person" and adjust its behavior accordingly.

### Host-Provided Capabilities

Plugins that require host-level features can use opt-in imports to access them.

#### Progress Reporting

For heavy workloads (e.g., AI denoising) that take several seconds, plugins should report progress so the host can update the UI:

```wit
/// Report execution progress back to the host.
import seer:host/progress.{
    /// Emit progress (0.0 to 1.0)
    report-progress: func(percent: float32),
}
```

#### Shared ML Inference

Bundling entire ML runtimes (ONNX/TensorFlow) and duplicate model weights into individual plugins creates massive bloat. Instead, plugins can offload tensor operations to the host's native, GPU-accelerated ML stack:

```wit
import seer:host/inference.{
    /// Load a model from a plugin's resources or remote URL.
    /// Returns an opaque handle.
    load-model: func(path: string) -> u32,

    /// Execute a tensor graph on the host machine.
    /// Tensors are multi-dimensional floats describing inputs/outputs.
    run-inference: func(model: u32, input: list<float32>) -> list<float32>,
}
```

This keeps `.wasm` plugins small and lightweight while taking full advantage of the user's hardware.

### Plugin Resources

For plugins that need bundled data (LUT files, neural network weights, lookup
tables):

```wit
/// Read a resource bundled with the plugin.
/// Resources are files in the plugin's package, read-only.
import seer:host/resources.{
    read-resource: func(path: string) -> result<list<u8>, string>,
    resource-exists: func(path: string) -> bool,
}
```

Plugin packages are zip archives containing:

```
com.filmdev.emulation-1.2.0.seerplugin
├── plugin.wasm          (compiled WASM binary)
├── manifest.toml        (metadata)
├── resources/
│   ├── luts/
│   │   ├── portra400.cube
│   │   ├── ektar100.cube
│   │   └── trix400.cube
│   └── grain/
│       └── film_grain_pattern.bin
└── icon.png             (optional, 64x64)
```

---

## Plugin Development Kit (seer-sdk)

A Rust crate that makes writing Seer plugins ergonomic. Published to crates.io,
usable by anyone.

### Core Components

```
seer-sdk/
├── src/
│   ├── lib.rs            — Re-exports, top-level docs
│   ├── pixel_buffer.rs   — PixelBuffer type + utility methods
│   ├── zone_buffer.rs    — ZoneBuffer type
│   ├── params.rs         — Parameter schema types
│   ├── context.rs        — AdjustmentContext, ZoneContext types
│   ├── macros.rs         — #[derive(Params)], #[seer_plugin]
│   └── helpers/
│       ├── color.rs      — Color space conversions (sRGB↔linear, XYZ, Lab, HSL)
│       ├── convolution.rs — Gaussian blur, box blur, custom kernels
│       ├── lut.rs        — 1D/3D LUT loading and application (.cube format)
│       ├── histogram.rs  — Histogram computation and equalization
│       ├── interpolation.rs — Bilinear, bicubic, spline interpolation
│       └── math.rs       — Clamp, lerp, smoothstep, common math
├── tests/
│   ├── test_images/      — Standard test images (gradient, color checker, etc.)
│   └── helpers.rs        — assert_pixels_equal, generate_test_buffer, etc.
└── Cargo.toml
```

### Helper Library Highlights

**Color space conversions** (matching seer-editor's built-in math):

```rust
use seer_sdk::helpers::color;

let linear = color::srgb_to_linear(srgb_value);
let xyz = color::linear_to_xyz(linear);
let lab = color::xyz_to_lab(xyz);
let hsl = color::srgb_to_hsl(srgb_value);
```

**Convolution** (common for detail adjustments):

```rust
use seer_sdk::helpers::convolution;

let blurred = convolution::gaussian_blur(input, sigma);
let sharpened = convolution::unsharp_mask(input, radius, amount, threshold);
let edges = convolution::sobel(input);
```

**LUT application** (common for film emulation):

```rust
use seer_sdk::helpers::lut;

let cube = lut::load_cube_lut(resource_bytes)?;
let output = lut::apply_3d_lut(input, &cube, intensity);
```

**Pixel iteration** (ergonomic access patterns):

```rust
use seer_sdk::pixel_buffer::PixelBuffer;

let mut output = input.clone();
output.for_each_pixel_mut(|x, y, r, g, b| {
    // Modify in place
    *r = (*r).powf(gamma);
    *g = (*g).powf(gamma);
    *b = (*b).powf(gamma);
});

// Or functional style
let output = input.map_pixels(|x, y, r, g, b| {
    (r.powf(gamma), g.powf(gamma), b.powf(gamma))
});
```

### Testing Utilities

```rust
use seer_sdk::testing::*;

#[test]
fn test_identity() {
    let input = test_gradient(256, 256); // Standard gradient test image
    let params = MyParams::default();
    let ctx = test_context();

    let output = MyAdjustment::process(&input, &params, &ctx).unwrap();
    assert_pixels_equal(&input, &output, 1e-6); // At default params, identity
}

#[test]
fn test_non_destructive() {
    let input = test_color_checker(256, 256);
    let params = MyParams { intensity: 1.0, ..Default::default() };
    let ctx = test_context();

    let output = MyAdjustment::process(&input, &params, &ctx).unwrap();
    assert_dimensions_equal(&input, &output); // Never changes size
    assert_no_nan(&output);                    // No NaN pixels
    assert_in_range(&output, -0.5, 1.5);      // Reasonable HDR range
}
```

---

## Core-as-Plugins: Eating Our Own Dog Food

### Current State

Today, adjustments are defined as variants of the `AdjustmentKind` enum in
`seer-editor/src/adjustment.rs`:

```rust
pub enum AdjustmentKind {
    Source(SourceParams),
    Monochrome(MonochromeParams),
    CLAHE(CLAHEParams),
    ToneCurve(ToneCurveParams),
    WhiteBalance(WhiteBalanceParams),
    ColorMixer(ColorMixerParams),
    Denoise(DenoiseParams),
    Sharpen(SharpenParams),
    Clarity(ClarityParams),
}
```

Each variant's processing is dispatched in `Adjustment::process()` via pattern
matching. Adding a new adjustment requires modifying the enum, the match arms,
the WASM bridge, and writing per-adjustment UI in Svelte.

### Target State

Core adjustments implement the same `AdjustmentPlugin` trait that third-party
plugins target:

```rust
/// The trait that all adjustments implement, core and third-party alike.
pub trait AdjustmentPlugin {
    /// Unique identifier (reverse-domain for third-party, seer.* for core).
    fn id(&self) -> &str;

    /// Human-readable name.
    fn name(&self) -> &str;

    /// Category for pipeline organization.
    fn category(&self) -> AdjustmentCategory;

    /// Parameter schema for automatic UI generation.
    fn describe(&self) -> ParamSchema;

    /// Process pixels.
    fn process(
        &self,
        input: &PixelBuffer,
        params: &ParamValues,
        ctx: &AdjustmentContext,
    ) -> Result<PixelBuffer, String>;
}
```

The `AdjustmentKind` enum is replaced by a plugin registry:

```rust
pub struct PluginRegistry {
    /// Core plugins (compiled in, zero overhead).
    core: HashMap<String, Box<dyn AdjustmentPlugin>>,
    /// WASM plugins (loaded at runtime, sandboxed).
    wasm: HashMap<String, WasmPlugin>,
}
```

The `EditGraph` stores adjustment instances as:

```rust
pub struct Adjustment {
    pub id: AdjustmentId,
    pub plugin_id: String,       // e.g., "seer.white-balance" or "com.filmdev.emulation"
    pub params: ParamValues,     // Typed parameter values
    pub enabled: bool,
    pub zone: ZoneSource,
}
```

### Migration Path

This is an incremental migration, not a big-bang rewrite:

**Phase 1: Define the trait and SDK**

- Define `AdjustmentPlugin` trait in seer-editor
- Define `ParamSchema`, `ParamValues`, and related types
- Build the `seer-sdk` crate with helpers and macros
- Build the generic `ParamPanel` in Svelte

**Phase 2: Wrap core adjustments**

- Implement `AdjustmentPlugin` for each built-in adjustment
- Each wraps its existing `process_*` function
- Each declares its params via `ParamSchema`
- Register all core adjustments in `PluginRegistry`
- Remove per-adjustment `{#if}` branches from `ParamPanel.svelte`

**Phase 3: WASM plugin loading**

- Integrate Wasmtime (or similar) as WASM runtime
- Define the WIT contracts
- Build the WASM host bindings
- Load `.seerplugin` packages at startup
- Register loaded plugins in `PluginRegistry`

**Phase 4: Process-isolated native plugins**

- Shared memory infrastructure (`shm_open` + `mmap`)
- Message protocol over shared memory (pixel buffer exchange)
- OS sandbox profiles (macOS `sandbox-exec`, Linux `seccomp-bpf`)
- Resource limits (`RLIMIT_CPU`, `RLIMIT_AS`, watchdog timer)
- Recovery on child process crash/timeout

**Phase 5: Trust & distribution**

- Plugin test harness (automated validation suite)
- Trust tiers (Core / Verified / Community / Local)
- Plugin directory and installation UX
- Version compatibility checking
- User reviews and ratings (future)

### Namespace Convention

```
seer.source         — built-in source decoder
seer.white-balance  — built-in white balance
seer.tone-curve     — built-in tone curve
seer.color-mixer    — built-in color mixer
seer.monochrome     — built-in monochrome
seer.clahe          — built-in CLAHE
seer.denoise        — built-in denoise
seer.sharpen        — built-in sharpen
seer.clarity        — built-in clarity
seer.zone.luminance — built-in luminance zone
seer.zone.brush     — built-in brush zone
seer.zone.segmentation — built-in semantic segmentation zone

com.filmdev.emulation       — third-party film emulation
org.astro.stacking          — third-party image stacking
io.denoiselab.ai-denoise    — third-party AI denoiser
```

---

## Pipeline Integration

### How Plugins Fit in the Pipeline

The linear pipeline model remains unchanged. A plugin-backed adjustment sits
at a position in the pipeline just like a core adjustment:

```
Source → [seer.white-balance] → [seer.tone-curve] → [com.filmdev.emulation] → [seer.sharpen]
```

The evaluator doesn't know or care whether an adjustment is core or plugin:

```rust
impl PipelineEvaluator {
    pub fn evaluate(&mut self, graph: &EditGraph, registry: &PluginRegistry, ...) -> EvalResult {
        for adj_id in graph.pipeline() {
            let adj = graph.adjustment(adj_id);
            let plugin = registry.get(&adj.plugin_id);

            // Same path for core and WASM plugins
            let result = plugin.process(&current, &adj.params, &ctx)?;

            // Zone blending handled by host (same as today)
            if adj.zone != ZoneSource::Full {
                let zone = evaluate_zone(&adj.zone, ...);
                current = blend_with_zone(&current, &result, &zone);
            } else {
                current = result;
            }
        }
    }
}
```

### Versioning & History

Plugin adjustments record history mutations using the same `HistoryMutation` enum.
The mutation stores the plugin_id and parameter values (which are self-describing
via the schema), making history fully transparent:

```rust
HistoryMutation::UpdateParams {
    adjustment_id,
    plugin_id: "com.filmdev.emulation".to_string(),
    adjustment_name: "Film Emulation".to_string(),
    before: ParamValues { ... },
    after: ParamValues { ... },
}
```

Sidecars serialize plugin_id + params. If a sidecar references a plugin that
isn't installed, the adjustment is marked as `unavailable` in the pipeline
(shown greyed out, skipped during evaluation, params preserved for when the
plugin is installed).

### Recommended Pipeline Order

Categories help Seer suggest pipeline ordering:

```
source → color → tone → detail → creative → correction → ai
```

Plugins declare their category. Users can reorder freely (with a warning if
the order deviates from recommendations). Wizards and templates can compose
pipelines from plugins by category: "I want AI denoising for my detail step
instead of bilateral filter."

---

## Security & Resource Control

### Hard Guarantees (Non-Negotiable)

These apply to all third-party plugins regardless of execution mode:

1. **Cannot corrupt host memory** — WASM: linear memory isolation. Process:
   separate address space.

2. **Cannot outlive their welcome** — timeout enforcement. WASM: fuel-based
   execution limits. Process: SIGKILL on timeout.

3. **Cannot exhaust host memory** — WASM: linear memory cap. Process:
   `RLIMIT_AS` / `RLIMIT_DATA`.

4. **Cannot access filesystem or network** — unless explicitly granted via
   capabilities in the manifest, approved by the user at install time.

5. **Cannot crash the host** — WASM: traps are caught as errors. Process:
   child death doesn't kill parent. In both cases the pipeline continues.

### Capability Grants

Plugins that need more than pure pixel processing declare capabilities
in their manifest. The user approves at install time:

```toml
[capabilities]
# Storage backend plugins need filesystem access
filesystem = { read = ["~/.seer/models/"], write = [] }
# Export plugins that upload need network
network = { allowed_hosts = ["api.example.com"] }
```

WASM plugins get capabilities via host-provided imports. Process plugins get
them via OS-level sandbox profiles (macOS `sandbox-exec`, Linux `seccomp-bpf`)
that whitelist only declared paths and hosts.

### The Control Spectrum: What Can We Enforce, How?

The spectrum from "total control" to "hope for the best" is not binary. Here's
what's concretely enforceable at each level, and the mechanisms:

```
Full Rust type safety       ←  only for core seer.* (compiled-in)
        │
WASM memory sandbox         ←  linear memory, no raw pointers, traps on OOB
        │
Process isolation           ←  separate address space, shared memory for pixels
        │
OS resource limits          ←  enforceable for BOTH wasm and process modes
        │
Output validation           ←  host checks output after plugin returns
        │
Social/curation trust       ←  reviews, test harness, verified badges
```

The key insight is that **OS resource limits apply regardless of the execution
model**. Even a WASM plugin (which runs in-process inside Wasmtime) can have
its thread's resources limited. Here are the concrete mechanisms:

#### CPU Time Limits

| Mechanism        | Scope               | How it works                                                                                                                                                                     | Platform      |
| ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| WASM fuel        | WASM only           | Wasmtime decrements a counter per instruction. When fuel runs out, execution traps with a recoverable error. Host catches it, reports timeout.                                   | All           |
| `RLIMIT_CPU`     | Process mode        | `setrlimit(RLIMIT_CPU, soft, hard)` on the child process. Kernel sends SIGXCPU at soft limit (plugin can catch and exit gracefully), SIGKILL at hard limit.                      | macOS + Linux |
| Watchdog thread  | Any mode            | Host spawns a timer thread. If `process()` hasn't returned in N seconds, the host: for WASM, sets an interrupt flag via `Store::interrupt_handle()`; for process, sends SIGKILL. | All           |
| `pthread_cancel` | In-process fallback | For native dylib plugins (if we ever allow them), the host can cancel the plugin's thread. Risky (resource leaks) but prevents infinite loops.                                   | POSIX         |

**Practical setup**: WASM plugins get fuel-based limits (precise, no OS dependency).
Process plugins get `RLIMIT_CPU` + a watchdog. Both modes: default 30s for 24MP,
scaling with image size.

#### Memory Limits

| Mechanism              | Scope        | How it works                                                                                                                                  | Platform              |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| WASM linear memory max | WASM only    | `Memory::new(store, MemoryType::new(min_pages, Some(max_pages)))`. Attempts to grow beyond max trap immediately. 512 MB default = 8192 pages. | All                   |
| `RLIMIT_AS`            | Process mode | Limits total virtual address space of child process. `malloc` returns NULL / `mmap` returns MAP_FAILED beyond limit.                          | macOS + Linux         |
| `RLIMIT_DATA`          | Process mode | Limits heap (data segment) growth specifically.                                                                                               | Linux (macOS ignores) |
| cgroups `memory.max`   | Process mode | Hard memory cap at the kernel level. OOM killer targets the plugin process, not the host.                                                     | Linux only            |

**Practical setup**: WASM gets linear memory cap. Process mode gets `RLIMIT_AS`
on both platforms (512 MB default). On Linux, additionally use cgroups for
airtight enforcement.

#### The "Won't Blow Up Your Computer" Guarantee

This is the line that matters for user confidence. Here's what we can
**concretely promise** across all execution modes:

1. **Plugin cannot freeze your OS** — CPU limits (fuel or RLIMIT_CPU) ensure
   the plugin stops executing within a bounded time. The host's main thread
   and event loop are never blocked (plugins run in a Web Worker / background
   thread / child process).

2. **Plugin cannot OOM your system** — memory limits ensure the plugin can
   allocate at most N MB. The host and other applications are unaffected.

3. **Plugin cannot crash Seer** — WASM traps are caught as Result::Err.
   Process crashes are caught via `waitpid`. In both cases, the pipeline
   continues with the plugin's adjustment showing an error state.

4. **Plugin cannot corrupt your files** — no filesystem access unless
   explicitly granted in manifest and approved by user.

5. **Plugin cannot spy on you** — no network access unless explicitly granted.

What we **cannot promise**:

- "The plugin produces good results" — only the test harness and curation
  can address this.
- "The plugin is fast" — we enforce a ceiling (timeout) but can't force
  efficiency within it.

This gives us the split you described: a bad plugin is **"a pain" (produces
wrong output, is slow, gets auto-disabled)** not **"your computer will blow
up" (freeze, OOM, crash, corrupt)**. The OS-level enforcement makes the
catastrophic outcomes impossible, and the graceful recovery makes the annoying
outcomes manageable.

### What We Explicitly Don't Guarantee

- **Correctness of output** — a plugin can produce ugly, wrong, or nonsensical
  pixels. This is a quality problem addressed by the test harness and curation
  tiers, not by the runtime.
- **Performance** — a plugin can be slow. The test harness enforces a timeout,
  but within that window we can't force efficiency. Curation and user reviews
  handle this.
- **Aesthetic quality** — we generate professional UI from the param schema,
  but the algorithm's visual quality is the author's responsibility.

---

## Plugin Manifest

Every plugin ships with a `manifest.toml`:

```toml
[plugin]
id = "com.filmdev.emulation"
name = "Film Emulation"
version = "1.2.0"
seer-api = "1.0"                    # minimum Seer API version
description = "Authentic film stock emulations with grain, halation, and color science"
author = "FilmDev Labs"
license = "MIT"
homepage = "https://filmdev.com/seer-plugins"

[plugin.type]
kind = "adjustment"
category = "creative"

# Optional: declare multiple extension points in one package
# [[plugin.extensions]]
# kind = "zone-generator"
# entry = "depth_zone"

[capabilities]
# This plugin needs no special capabilities — pure pixel processing

[resources]
# Bundled data files
include = ["resources/**/*"]

[limits]
# Override defaults if the plugin legitimately needs more.
# Users see these at install time: "This plugin requests 1 GB memory."
# Absent values use Seer defaults (30s timeout, 512 MB memory).
# timeout_s = 60       # seconds, for 24MP (scales with image size)
# memory_mb = 1024     # MB max allocation
```

---

## Distribution & Discovery

### Package Format

`.seerplugin` — a zip archive containing `manifest.toml`, `plugin.wasm`,
optional `resources/` directory, and optional `icon.png`.

### Installation

- **Manual**: drag `.seerplugin` onto Seer window, or place in
  `~/.seer/plugins/`
- **Repository**: Seer settings → Plugins → Browse → search/install from
  a community repository (future, post-MVP)
- **Developer mode**: point Seer at a local directory for rapid iteration
  during plugin development

### Version Compatibility

The `seer-api` field in the manifest declares the minimum API version. Seer
checks compatibility at load time and refuses to load incompatible plugins
with a clear error message.

API versioning follows semver:

- Patch: bug fixes, no contract changes
- Minor: new optional features, new param types, new context fields — all
  backwards compatible
- Major: breaking changes to the plugin contract (rare, with migration guides)

---

## Comparison with Existing Ecosystems

| Aspect                | PixInsight        | darktable           | GIMP/GEGL               | OpenFX           | **Seer**                                    |
| --------------------- | ----------------- | ------------------- | ----------------------- | ---------------- | ------------------------------------------- |
| Plugin language       | C++ / JS          | C (compile-in)      | C / Python / Scheme     | C                | **Any (WASM primary, native escape hatch)** |
| Isolation             | None              | N/A                 | Process isolation       | None             | **WASM + process isolation**                |
| UI generation         | Manual            | Manual (Bauhaus)    | Auto from introspection | Auto from params | **Auto from schema**                        |
| Param declaration     | Class hierarchy   | Comment annotations | Macros + ui_meta        | Property suites  | **Derive macros + WIT**                     |
| Data format           | Proprietary view  | Planar float        | GEGL buffers            | OFX image        | **f32 RGB interleaved**                     |
| Core = plugins?       | Partially         | No                  | GEGL ops yes            | N/A              | **Yes (same trait)**                        |
| Cross-platform binary | No                | No                  | GEGL ops yes            | Yes              | **Yes (WASM path)**                         |
| Trust model           | Author reputation | Core team only      | Repo + reviews          | Host ecosystem   | **Tiered curation + test harness**          |

Seer's approach combines GEGL's automatic UI generation, OpenFX's declarative
parameter negotiation, PixInsight's dual-tier extensibility (native + scripted),
and mobile app stores' layered trust model — while avoiding the compile-in
limitation of darktable and the "trust everyone equally" model of PixInsight
and OpenFX.

---

## Open Questions

### 1. GPU Compute in Plugins

Should plugins be able to provide WebGPU/compute shader implementations?
This would dramatically accelerate pixel processing but adds complexity:

- Shader code validation and sandboxing is harder than WASM
- Buffer management between CPU and GPU
- Fallback path if GPU is unavailable

**Recommendation**: defer to post-MVP. Start with CPU-only plugins. When GPU
acceleration lands for core adjustments, evaluate extending the plugin API
with an optional `process_gpu()` entry point. This could allow plugins to
return a WGSL snippet instead of a `process()` function for applicable
operations, letting Seer inject them directly into the main rendering pass for
native GPU performance without leaving the WASM sandbox.

### 2. Inter-Plugin Communication

Should plugins be able to share data? For example, an AI segmentation plugin
producing a refined class map that other plugins can use.

**Recommendation**: no direct inter-plugin communication. Instead, specific
data sharing happens through the host:

- A zone generator plugin produces a mask → stored in zone registry → any
  adjustment can reference it via ZoneSource
- A source decoder plugin produces metadata → available to all downstream
  adjustments via AdjustmentContext

This maintains isolation while enabling composition.

### 3. Scripting / Workflow Automation

Beyond pixel-processing plugins, should Seer support scriptable workflows
(like PixInsight's PJSR)? Examples: "apply these 5 adjustments with these
settings to all images in this folder" or "if sky area > 30%, apply sky
darkening preset."

**Recommendation**: yes, but as a separate extension point (not covered in
this spec). A future `seer.script` world could provide:

- Access to the pipeline API (add/remove/configure adjustments)
- Batch processing over multiple images
- Conditional logic based on metadata or zone coverage

This is a higher-level concern and should be designed after the core plugin
system is validated.

### 4. Plugin Presets

Should plugins be able to ship presets (pre-configured parameter sets)?

**Recommendation**: yes. Since params are declared via `ParamSchema` and stored
as `ParamValues`, presets are just named `ParamValues` bundles:

```toml
# In the plugin package
[[presets]]
name = "Portra 400 - Warm"
description = "Classic Portra look with warm tones"
[presets.values]
stock = 0
intensity = 0.9
grain = 0.4
halation = 0.15
```

The host manages preset UI (save, load, browse) — plugins just declare default
presets in their package.

### 5. Real-time Preview vs. Full Resolution

During slider drag, should plugins receive downsampled input for faster preview?

**Recommendation**: yes, but this is a host optimization, not a plugin concern.
The host can call `process()` with a downsampled `PixelBuffer` during
interaction and full-resolution on release. Plugins should be resolution-
independent by design (operate on normalized coordinates, not absolute pixels).
The `AdjustmentContext` can include a `preview_scale: f32` field so plugins
that need it can adjust behavior (e.g., skip grain at preview scale).

---

## Summary

The extensibility design centers on four principles:

1. **Declarative over imperative** — plugins describe parameters, the host
   generates UI. Plugins process pixels, the host handles zones, history,
   and scheduling.

2. **Same interface, multiple execution modes** — core adjustments and
   third-party plugins implement the same `AdjustmentPlugin` trait, with
   the same parameter schema, the same UI generation, and the same pipeline
   integration. The execution mode (native, WASM, process) is an
   implementation detail hidden behind the trait.

3. **Isolation protects the host, curation protects the user** — WASM and
   process isolation prevent hard failures (crashes, memory corruption,
   freezes). But the user's actual trust comes from tiered curation, a
   standardized test harness, reviews, and graceful runtime recovery. No
   isolation technology can detect bad pixels — that's a quality problem
   solved by social and testing infrastructure.

4. **A bad plugin degrades itself, never the pipeline** — timeouts, crashes,
   and bad output are caught and contained per-adjustment. The user's editing
   session continues. They can undo, disable, or remove the plugin and move on.

The primary plugin author experience: write a Rust function, annotate parameters
with a derive macro, compile to WASM, ship a `.seerplugin` zip. No UI code,
no framework knowledge, no platform-specific builds. For authors with existing
C/C++ code or specific performance needs, a native process-isolated path exists
as an alternative.
