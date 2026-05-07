# Circe — Image Editing Architecture

## Context

Circe is Arami's non-destructive image editing engine. It builds on the
shared infrastructure established by `arami-viewer` — the three-layer
architecture (pure math + stateful controller + thin UI), Rust-first logic,
WASM bridge, GPU rendering — and extends it into a full processing pipeline.

This document covers the design philosophy, pipeline architecture,
adjustment ontology, zones, BW workflow, versioning, and the relationship
to Arami's vocabulary. For implementation details, see the cargo docs on
the `arami-editor` crate modules.

### Design Philosophy

Circe's editing model is built on the principle of **intelligence as
authoring, not as a black box** (see [docs/README.md](../README.md)
for the full vision).

- **Semantic analysis is foundational.** Every image is analyzed by a
  segmentation model at open time. The result is a set of zones (sky,
  person, vegetation, structure) that become first-class document
  objects — visible, editable, persistent.
- **Profiles, not presets.** When an image opens, a profile populates
  the pipeline with adjustments that reference semantic zones.
  The user sees standard editing primitives, not a black box. Each
  adjustment can be inspected, tweaked, or removed.
- **No composite adjustments.** Every pipeline adjustment is one operation
  with one set of parameters and one optional zone. Complexity comes from
  composition (multiple adjustments with different zones), not from deeply
  nested sub-stages within a single adjustment.

### Current State

The core editing engine is feature-complete through the foundation layer:

**Pipeline & Adjustments.** All 8 pixel adjustments implemented and working:
WhiteBalance, ToneCurve, ColorMixer, Monochrome, CLAHE, Denoise, Sharpen,
Clarity. DNG/RAW source decoding via libraw. Pipeline evaluator with
streaming evaluation and per-adjustment f32 caching. See the
`arami-editor` cargo docs and the [execution-interaction](execution-interaction.md)
spec for the async model.

**Zones.** All 5 zone generators (Luminance, ColorRange, Gradient, Brush,
Semantic) plus named compositions with boolean operations (Union, Intersect,
Subtract), cycle detection, and cascade deletion. SegFormer ONNX inference
for semantic segmentation. See [zones.md](zones.md).

**Version Tree.** Unified undo/redo, history navigation, and named versions
via a tree of full `EditGraph` snapshots (~10KB each). Coalescing (30-second
window), tagging, sidecar persistence with legacy migration. See
[versioning.md](versioning.md) and [versioning-status.md](versioning-status.md)
for design and phase tracking.

**Execution Model.** Web Worker pipeline with rAF coalescing. Off-main-thread
evaluation, latest-wins scheduling, direct pixel upload. See
[execution-interaction.md](execution-interaction.md).

**Frontend.** Three-panel Circe editor (zones / canvas / processing+history),
interactive history with fullPath tracking and edit guards, parameter panels
for all adjustment types, tone curve editor, keyboard shortcuts (Cmd+Z,
Cmd+Shift+Z), adjustment reordering, zone assignment UI.

**Test Coverage.** 435 arami-editor tests + 162 arami-viewer tests (597 total),
plus WASM integration tests and E2E tests.

Remaining work: pipeline branching (fork points for Renderings), GPU
acceleration of hot paths, and UX iteration to validate the core editing model.

---

## 1. Pipeline Topology: Linear Chain with Version Branches

A formal graph eliminates the translation cost between mental model, UI, and
implementation. But a full arbitrary DAG (Nuke/Natron-style) is wrong for
photo editing: operations are overwhelmingly sequential, port management is
massive cognitive overhead for adjusting exposure, and caching in an arbitrary
DAG is significantly harder.

**Design: a linear pipeline with two kinds of branching.**

```text
Source -> [Adjustment A] -> [Adjustment B] -> [Adjustment C] -> ...
                                  |
                             Version "BW"
                             [Adjustment D] -> [Adjustment E] -> ...
```

The pipeline is an **ordered list of adjustments**, each receiving the output
of the previous. Two non-linearities:

1. **Version branches** — fork the pipeline at any point, creating an
   independent sequence that inherits everything upstream of the fork point.
   Changes upstream cascade.
2. **Zone sub-graphs** — an adjustment's zone can combine multiple zone
   sources (luminance AND brush, semantic OR gradient). This is a small DAG
   within zone generation, not the main pipeline.

The internal data model is still a graph (adjustments + edges), but the
topology is constrained: one main trunk, version branches, and zone
composition trees. This gives 95% of a DAG's power with dramatically simpler
UX, caching, and implementation.

**On reordering:** users can reorder adjustments freely. The system
re-evaluates the pipeline from the changed point downstream. Rather than
preventing "invalid" orderings, warn about unusual ones (sharpening before
denoising, WB after curves). The only hard constraint: Source must be first.

**Dimensional constraints:** geometric adjustments (crop, rotate) change the
canvas dimensions. Resolution-independent zones (normalized `[0,1]^2`
coordinates, rasterized at evaluation time) solve this — zones survive
dimension changes and pipeline reordering.

---

## 2. Internal Precision: f32

f32 internally, 16-bit for I/O only. Reasons:

- GPU shaders are natively f32 — converting to float for rendering anyway
- f32 in [0, 1] has 23 bits of mantissa — more precision than 16-bit integer
- The Rust imaging stack (`palette`, `pic-scale`) is f32-native
- Extended range: values can exceed [0, 1] during intermediate computation
  (exposure push, HDR recovery) without clipping. Clamp only at output.
- For a niche tool processing one image at a time, the 2x memory cost over
  16-bit is negligible.

---

## 3. Adjustment Ontology

### Category A: Pixel Adjustments

RGB in, RGB out, same dimensions, optional zone.

- **WhiteBalance** — temperature/tint via Bradford chromatic adaptation
- **ToneCurve** — per-channel parametric spline (Master, R, G, B)
- **ColorMixer** — per-channel gain/offset, HSL adjustments, channel matrix
- **Monochrome** — channel-mix BW conversion with photographic filter presets
- **CLAHE** — adaptive local contrast enhancement
- **Sharpen** — unsharp mask (radius, amount, threshold)
- **Clarity** — large-radius midtone local contrast (USM variant)
- **Denoise** — bilateral filter (spatial sigma, range sigma, iterations)

Recommended pipeline order:

```text
Source -> WhiteBalance -> ToneCurve -> ColorMixer -> Denoise -> Sharpen -> Clarity
```

This order exists because: WB first (corrective, establishes neutral), curves
before color (tonal foundation before hue work), denoise before sharpen
(sharpening amplifies noise), sharpen last (sharpen the final image). But
these are conventions, not constraints — the system allows any order.

See the `arami-editor::processing` module cargo docs for algorithm details,
parameter ranges, and per-adjustment documentation.

### Category B: Geometric

No zone, change canvas dimensions. These are the first adjustments that
support direct manipulation on the canvas — see
[canvas-interaction.md](canvas-interaction.md) for the overlay
architecture and [geometry.md](geometry.md) for the full design.

- **Crop** — extract a rect in normalized [0,1]² coordinates; frame-first
  interaction reusing `FramerState` from `arami-viewer`
- **Rotate** — arbitrary angle, canvas grows to contain rotated content;
  bilinear interpolation, black fill for empty corners
- **Perspective** — four-corner projective transform via homography; each
  corner has normalized (x, y) displacements, output canvas is the bounding
  box of the displaced quad

### Category C: Zone Generators

Produce a grayscale zone, no pixel modification.

- **SemanticZone** — AI model segments regions (sky, person, vegetation, etc.)
- **LuminanceZone** — select by brightness range with feathering
- **ColorRangeZone** — select by hue/saturation range
- **BrushZone** — painted strokes (stored as vector data, rasterized at eval)
- **GradientZone** — linear or radial gradient

Zone generators live outside the main pipeline. They're defined once and
referenced by any number of adjustments. See `arami-editor::zone` for the
composition model.

### Category D: Structural

- **Version** (future) — named fork point creating a branch
- **Bypass** — (implicit) every adjustment has an `enabled` flag

**Metadata/IPTC lives outside the pipeline.** IPTC tags, keywords, and
ratings are not image transformations. They belong in the sidecar metadata
alongside the adjustment graph, not inside it.

---

## 4. Zone Architecture

Every Category A adjustment carries an optional zone. Unzoned = full opacity.
Zones are a separate composition tree, not inline in the main pipeline:

- Generators live outside the main pipeline, defined once, referenced by any
  number of adjustments
- One semantic zone can be used by multiple adjustments (curves on sky, color
  shift on foliage)
- Generators can be evaluated independently and cached
- The zone composition tree supports boolean operations (union, intersect,
  subtract) and inversion

**Zone evaluation:** rasterize to f32 grayscale at the current pipeline
resolution. Apply as `output = zone * adjusted + (1 - zone) * input` per
pixel.

**Zone storage:** brush strokes stored as vectors (normalized coordinates).
Rasterized at evaluation time. This keeps sidecars small, supports
resolution-independent reordering, and avoids large bitmap storage.

See `arami-editor::zone` cargo docs for the `ZoneSource` enum and composition
API.

---

## 5. BW Workflow

Full RGB through the entire pipeline. BW conversion is not a mode — it's
adjustments composed with semantic zones.

### Monochrome Adjustment

A dedicated `Monochrome` adjustment handles channel mixing: weighted sum of
R/G/B -> grayscale, blended with original by a strength parameter. Presets
simulate traditional photographic BW filters (Red, Orange, Green, Infrared,
Luminosity).

### Adaptive BW via Profiles

The power of Arami's BW workflow comes from profiles. A Monochrome
profile populates the pipeline with:

```text
Source -> WhiteBalance -> Monochrome (Luminosity)
  -> ToneCurve [zone: Sky]         — pulldown
  -> ToneCurve [zone: Person]      — midtone lift
  -> ToneCurve [zone: Vegetation]  — separation
  -> ToneCurve [zone: Structure]   — contrast push
```

Each adjustment is a standard pipeline entry with a semantic zone. The
"adaptive" behavior — different tonal treatment per image region — emerges
from the composition of standard primitives, not from a black-box composite
adjustment. The photographer can swap presets, adjust per-region curves
independently, delete irrelevant adjustments, or add new ones.

### No Special BW Mode

The pipeline doesn't know or care if the image "is BW" — it's just RGB
values that happen to be neutral after the Monochrome adjustment. This means:

- You can branch: version A is color, version B adds Monochrome + adjustments
- Toning (selenium, sepia, split-tone) is a ColorMixer adjustment after Monochrome
- Any adjustment can appear anywhere in the chain, with or without a zone

---

## 6. Versioning

### Version Tree (implemented)

Undo/redo, history navigation, and named versions share a single data
structure: a tree of `EditGraph` snapshots. Every mutation creates a
restorable node automatically. Users can jump to any point in the session
history, tag states with names ("BW attempt", "warm grade"), and branch
by editing from a non-leaf position.

Key properties:

- Full `EditGraph` snapshot per node (~10KB) — no delta reconstruction
- Coalescing: consecutive same-type parameter changes within 30 seconds
  merge into one node
- Tags: persistent named references to any node
- Sidecar persistence with legacy migration (flat `EditGraph` → single-node tree)

See [versioning.md](versioning.md) for the full design and implementation status.

### Pipeline Branching (future)

A Version entry in the pipeline creates a named fork. Everything upstream is
shared. Everything downstream is independent per version.

```text
Source -> WB -> Curves(A) -> [Version "Color"] -> ColorMixer(warm) -> Sharpen
                                 |
                            [Version "BW"] -> Monochrome -> ToneCurve -> Sharpen
```

**Cascade rule:** modifying Curves(A) affects both "Color" and "BW" — they
share that adjustment. Modifying ColorMixer(warm) only affects "Color".

This is distinct from the version tree (which tracks edit history). Pipeline
branching creates persistent fork points that produce different Renderings
from the same Source.

### Cache Invalidation

Per-adjustment output caching (f32 image buffer). When adjustment N's
parameters change, invalidate N and all downstream caches — re-evaluate only
from N forward. The linear pipeline makes this trivial: invalidation is
"everything after index N."

---

## 7. Sidecar Format

The sidecar contains the full edit state for one image. Stored as a companion
file (e.g., `DSC_4210.arami` next to `DSC_4210.dng`).

**Format:** JSON during development (human-readable, diffable, debuggable).
MessagePack or CBOR for production if size matters.

**CRDT compatibility:** the sidecar structure maps cleanly to CRDTs:

- Pipeline is a List CRDT (ordered, insertable)
- Adjustment parameters are Registers (last-writer-wins per field)
- Versions are a Map CRDT (name -> pipeline)
- Zone definitions are a Map CRDT (id -> generator)

Each edit (add adjustment, change parameter, reorder, create version) is an
operation that can be replayed.

---

## 8. Relationship to Arami Vocabulary

Circe's edit graph IS what produces a **Rendering** in Arami's vocabulary:

- **Source** -> the input image file
- **Rendering** -> the output of a Circe pipeline (a particular version/branch)
- **Variant** -> a Rendering at a specific crop (the Crop adjustment in the
  pipeline, or Framer applied post-pipeline)

A Circe sidecar can contain multiple Renderings (via versions), and each can
have multiple Variants (via different crop adjustments or Framer definitions).

---

## 9. Remaining Work

| Area                      | What                                                                                                          | Status / Depends on                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **UX iteration**          | Validate the editing model: output quality, interaction flow, profile authoring, adjustment parameter tuning  | Current focus                           |
| **Geometric adjustments** | Crop, Rotate, Perspective — dimension-changing operations. Zone generators already use normalized coordinates | Next major feature track                |
| **Pipeline branching**    | Fork points in EditGraph for Renderings (Color vs BW variants), cascade rule, per-version zone registries     | After geometric adjustments             |
| **GPU acceleration**      | WGSL compute shaders for hot-path adjustments (curves, color mix, USM, zone application)                      | When CPU pipeline perf becomes limiting |
| **Version previews**      | Low-res thumbnails for version tree nodes. See [versioning.md](versioning.md) §Visual Previews                | Nice-to-have                            |
