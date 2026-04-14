# Geometry — Crop and Rotate

**Component:** seer-editor::adjustment (Category B), canvas overlay system
**Part of:** Circe image editing engine

## Context

Geometric adjustments are the first pipeline adjustments that change canvas
dimensions. They are also the first adjustments that require **direct
manipulation on the canvas** — panning, zooming, dragging — rather than
editing parameters in a sidebar panel.

This makes geometry a two-part problem:

1. **Pipeline:** new adjustment types that take RGB input at one resolution
   and produce RGB output at a different resolution.
2. **Canvas interaction:** the viewer, which has been a passive pan/zoom
   viewport, becomes bidirectional — user actions on the canvas update
   adjustment parameters, and parameter changes update the canvas overlay.

The canvas interaction pattern established here is general. It will be
reused by brush zone painting, gradient placement, white balance
eyedropper, tone curve sampling, and any future adjustment that benefits
from spatial interaction on the canvas. Section 8 covers the generic
design.

**Scope:** Crop and Rotate are covered here. Perspective is implemented
(see `processing/perspective.rs`) but its canvas interaction UX is not
yet designed — the same overlay pattern established here will apply.

---

## 1. The Two Geometric Adjustments

### 1.1 Crop

Extracts a rectangular region from the input image.

**Parameters:**

```rust
struct CropParams {
    /// Top-left X in normalized [0, 1] coordinates of the input image.
    x: f64,
    /// Top-left Y in normalized [0, 1] coordinates.
    y: f64,
    /// Width as a fraction of input width.
    width: f64,
    /// Height as a fraction of input height.
    height: f64,
}
```

Normalized coordinates make Crop independent of the input resolution —
the same crop applies whether the input is the full-res source or a
scaled preview. Default: `(0, 0, 1, 1)` (full image, identity).

**Output dimensions:** `(input_width * width, input_height * height)`,
rounded to integer pixels.

**Ratio locking:** The ratio constraint lives in the UI layer, not in
the params. When the user selects a ratio (e.g., 3:2), the UI enforces
`width / height = ratio` during interaction. The stored params are
always a plain rect — no ratio field, no orientation field. This follows
the Framer principle: ratio is a UI convenience that resolves to a
canonical rect.

### 1.2 Rotate

Rotates the image by an arbitrary angle. The output canvas grows to
contain the full rotated content (no clipping).

**Parameters:**

```rust
struct RotateParams {
    /// Rotation angle in degrees, clockwise. Range: [-180, 180].
    angle: f64,
}
```

Default: `0.0` (identity).

**Output dimensions:** the bounding box of the rotated input rectangle.
For small straightening angles (±5°), the size increase is minor. Empty
corners are filled with black (or transparent if the pipeline supports
alpha in the future).

**Common pairing:** Rotate followed by Crop to remove the empty corners.
This is not a special mode — it's two separate adjustments composed in
the pipeline, per the "no composite adjustments" principle.

---

## 2. Canvas Interaction Model

### 2.1 The New Pattern: Canvas Modes

Today the canvas has one mode: **navigate** (pan with drag, zoom with
scroll). Geometric adjustments introduce **canvas modes** — the canvas
behavior changes based on the selected adjustment.

| Selected adjustment     | Canvas mode  | Drag behavior                  | Scroll behavior |
| ----------------------- | ------------ | ------------------------------ | --------------- |
| None / pixel adjustment | **Navigate** | Pan viewport                   | Zoom viewport   |
| Crop                    | **Crop**     | Pan image behind frame         | Zoom crop       |
| Rotate                  | **Rotate**   | Adjust angle (Shift: 15° snap) | Zoom viewport   |

**Scroll always zooms the viewport** in navigate and rotate modes. In
crop mode, scroll zooms the crop (same as Framer — zooming changes how
much of the image is visible through the frame).

**Escape from mode:** Deselecting the adjustment (clicking another
adjustment or clicking the pipeline background) returns to navigate mode.
There is no confirm/cancel — geometric params are live, like all other
adjustments. Undo reverts the last change.

### 2.2 Crop Mode — Frame-First (Same as Framer)

Crop uses the **same interaction model as Framer**: a fixed frame
dominates the viewport; the image moves behind it. The user always sees
exactly what will be kept.

When the Crop adjustment is selected, the canvas shows:

1. **The pre-crop image** — the pipeline evaluated up to (but not
   including) the Crop adjustment. This lets the user see the full image
   context.
2. **The crop frame** — contain-fitted to the viewport at the selected
   ratio. Everything inside the frame is at full brightness; everything
   outside is dimmed (~50% opacity).
3. **Crop info** — dimensions, ratio, and zoom percentage displayed near
   the frame.

**Interaction — identical to Framer:**

| Gesture            | Action                                              |
| ------------------ | --------------------------------------------------- |
| Drag               | Pan the image behind the frame (grab semantics)     |
| Scroll             | Zoom the image behind the frame, anchored at cursor |
| Ratio selector     | Change frame ratio; frame resizes, image re-covers  |
| Orientation toggle | Swap landscape ↔ portrait                           |

**Invariant:** the image always completely covers the frame. No empty
pixels inside the frame, ever. Pan and zoom are clamped to enforce this
— exactly as in Framer.

**Output:** the crop rectangle in normalized image coordinates, computed
from the frame's view of the image (same as `FramerState::crop_rect()`
but normalized to [0,1]²).

**Why frame-first:** This reuses the entire Framer interaction model
and math — `FramerState`, `cover_scale`, `framer_clamp_pan`, ratio
resolution. The Crop adjustment in the pipeline is driven by the same
state controller that drives the standalone Framer tool.

**Edit panel controls:**

- Ratio: dropdown (Free, 1:1, 4:3, 3:2, 16:9, 5:4, 7:5) — same
  presets as Framer
- Orientation: landscape/portrait toggle
- Position readout: crop rect in image pixels (read-only, informational)
- Overlay toggles: see §2.4

**Keyboard:**

- R: cycle through ratio presets
- X: swap orientation (landscape ↔ portrait)

### 2.3 Rotate Mode

When the Rotate adjustment is selected, the canvas shows:

1. **The image rotated by the current angle** — rendered with the
   enlarged bounding box. Empty corners visible.
2. **Rotation guide:** a horizontal reference line across the image
   center, and the current angle displayed.
3. **Angle indicator:** a subtle arc showing the rotation amount.

**Drag interaction:**

| Gesture                   | Action                                        |
| ------------------------- | --------------------------------------------- |
| Drag horizontally         | Adjust angle continuously. Right = clockwise. |
| Shift + drag horizontally | Snap to 15° increments                        |

The sensitivity is calibrated so that dragging across the full canvas
width produces ~15° of rotation — enough for straightening without
overshooting.

**Straighten tool:** The user can draw a line along an edge that should
be horizontal (or vertical). The system calculates the angle to make
that line level. This is a single drag gesture: press, drag along the
reference edge, release — the angle snaps to straighten. Activated via
a "Straighten" toggle in the edit panel.

**Edit panel:** angle slider (range -45° to +45° for typical use, with
text input accepting -180° to 180°) and a "Straighten" toggle.

**Keyboard:**

- Left/Right arrows: nudge angle by 0.1° (1° with Shift).

### 2.4 Canvas Overlays

Canvas overlays are composition guides rendered on top of the image
during adjustment editing. Overlays are toggled in the edit panel and
persist per adjustment type.

**Initial overlay: Rule of Thirds**

When enabled, a 3×3 grid is drawn inside the crop frame (thin lines,
low opacity). This is the first overlay; the toggle system supports
adding others in the future (golden ratio, diagonal, center cross).

**Overlay toggle** appears in the edit panel when a geometric adjustment
is selected. Each overlay is independently toggleable.

---

## 3. Edit Preview: Showing Pre-Adjustment State

Geometric adjustments require seeing the **pre-adjustment input** to make
editing decisions. You cannot frame a crop if you can only see the
already-cropped result.

When a geometric adjustment is selected for editing:

1. The viewer switches from showing the **full pipeline output** to
   showing the **pipeline evaluated up to the adjustment before the
   selected one**.
2. The overlay renders the geometric operation's effect (crop frame,
   rotation guide).
3. When the user deselects the geometric adjustment, the viewer returns
   to showing the full pipeline output.

**Implementation note:** the pipeline evaluator already caches per-
adjustment output buffers. The "pre-adjustment" view is simply the
cached output of the preceding adjustment in the pipeline — no extra
evaluation needed.

**For Rotate:** the pre-adjustment input is shown, with the rotation
applied as a visual transform (CSS or GPU), not as a pipeline
re-evaluation. This lets the user see the rotation result without
waiting for full evaluation on every drag frame. The pipeline evaluates
on drag end or after rAF coalescing settles.

---

## 4. Overlay Rendering

Canvas overlays (crop frame, dimming, grid, rotation guide) are rendered
as an **HTML/SVG layer on top of the WebGPU canvas**, not in the GPU
pipeline itself.

**Rationale:**

- Guides, grids, and text labels are UI elements — they need hit
  testing, cursor changes, and styling. SVG provides all of this
  natively.
- The overlay doesn't need to be pixel-perfect with the image — it
  needs to be aligned to the image coordinates, which requires the
  same `ViewLayout` transform the renderer uses.
- Separating overlay from rendering keeps the GPU pipeline clean and
  avoids adding overlay-specific shader passes.

**Coordinate mapping:**

The overlay layer uses the `ViewLayout` (uv_scale, uv_offset,
content_rect) to map between:

- **Image coordinates** (normalized [0,1]² or pixel) — where the crop
  rect, guides, etc. are defined.
- **Canvas coordinates** (screen pixels) — where the SVG elements are
  positioned.

This mapping updates on every viewport change (pan, zoom, resize).

**Overlay structure:**

```
<div class="canvas-container" style="position: relative">
  <canvas> <!-- WebGPU image rendering --> </canvas>
  <svg class="overlay" style="position: absolute; inset: 0; pointer-events: none">
    <!-- Crop: dimming rects, crop frame, composition grid -->
    <!-- Rotate: reference line, angle arc -->
  </svg>
</div>
```

In crop mode, pointer events go directly to the canvas (which drives
the FramerState). The SVG overlay is purely visual (`pointer-events:
none`) — it doesn't capture events. This is different from a handle-
based model; in frame-first mode, the entire frame area is the
interaction target.

---

## 5. Event Routing

In crop mode, events route through the same path as the standalone
Framer: pointer events on the canvas drive `FramerState.pan()` and
`FramerState.zoom()`. The resulting crop rect is written back to the
Crop adjustment's params via the standard `update-params` action.

In rotate mode, pointer events on the canvas are captured by the
overlay component, which computes angle deltas and emits param updates.

In navigate mode (no geometric adjustment selected), events route to
the ViewerState as they do today.

**Coalescing:** drag updates use the same `update-params` action type
as slider changes, and benefit from the same rAF coalescing in the
pipeline scheduler. A fast drag produces one pipeline evaluation per
frame, not one per mouse event.

---

## 6. Pipeline Integration

### 6.1 Dimension Changes

Geometric adjustments are the first to change output dimensions:

```
Source (6000×4000)
  → WhiteBalance (6000×4000)
  → Crop(x=0.1, y=0.1, w=0.6, h=0.75) → output: 3600×3000
  → Sharpen (3600×3000)
```

The pipeline evaluator must handle varying dimensions between
adjustments. Currently all adjustments produce same-size output;
geometric adjustments break this assumption.

**Required evaluator change:** pass the actual input buffer dimensions
to each adjustment's process function rather than assuming they match
the source. This is already structurally true (each adjustment receives
the previous output), but needs verification that no code assumes
fixed dimensions.

### 6.2 Zone Behavior

Zone generators already use normalized `[0,1]²` coordinates and
rasterize at evaluation time. This means:

- Zones survive dimension changes. A luminance zone defined on the
  6000×4000 input rasterizes correctly when applied to the 3600×3000
  post-crop output.
- Zones survive reordering. Moving Crop before or after a pixel
  adjustment changes the resolution at which zones rasterize, but the
  zone definitions are unchanged.

**Geometric adjustments do not accept zones.** They operate on the full
image — it doesn't make sense to "crop only part of the image" based on
a luminance range.

### 6.3 Cache Invalidation

Same rule as pixel adjustments: when Crop params change, invalidate the
Crop adjustment's cache and everything downstream. The linear pipeline
makes this trivial.

### 6.4 Evaluation During Drag

When the user pans/zooms in crop mode, the system needs responsive
visual feedback. The crop frame overlay updates immediately (SVG). The
pipeline re-evaluates with rAF coalescing — at most one evaluation per
display frame, same as slider drags today.

For crop specifically, the pre-crop image is static during interaction
(it's the cached output of the previous adjustment). Only the crop rect
changes, so re-evaluation is fast: extract the rect from the cached
buffer, then run downstream adjustments.

---

## 7. Relationship to Framer

Crop-in-pipeline and Framer-post-pipeline serve different purposes:

| Aspect          | Crop (in-pipeline)                          | Framer (post-pipeline)                 |
| --------------- | ------------------------------------------- | -------------------------------------- |
| **Purpose**     | Remove unwanted content, change composition | Select output region/ratio for export  |
| **When**        | Part of the Rendering                       | Produces a Variant from a Rendering    |
| **Affects**     | Downstream adjustments see cropped image    | No pipeline effect                     |
| **Persistence** | Stored in EditGraph as an adjustment        | Stored separately (Variant definition) |
| **Interaction** | Frame-first, same as Framer                 | Frame-first                            |

They coexist naturally: a pipeline can have a Crop (removing a
distracting edge element) and the output can be Framed at different
ratios (3:2 master + 4:5 Instagram crop).

**Code reuse:** Crop's canvas interaction is driven by `FramerState`
from `seer-viewer`. The same Rust controller, the same WASM bindings,
the same pan/zoom/clamp/ratio math. The only difference is where the
crop rect goes: Framer writes it to a Variant definition; Crop writes
it as normalized params to the EditGraph adjustment.

---

## 8. Canvas Interaction Architecture

The canvas ↔ edit panel connection is a general pattern that applies
beyond geometry. See [canvas-interaction.md](canvas-interaction.md) for
the full three-layer architecture: protocol (Layer 0), interaction
primitives (Layer 1), and adjustment overlays (Layer 2).

Crop uses the `FramerDrag` primitive (Layer 1) wrapping `FramerState`
from `seer-viewer`. Rotate uses `AngleDrag`. Both are concrete overlay
components (Layer 2) that follow the standard `OverlayProps` interface
(Layer 0).

---

## 9. Recommended Pipeline Order

Geometric adjustments have a natural position in the pipeline:

```
Source → WhiteBalance → ToneCurve → ColorMixer
  → Rotate → Crop
  → Denoise → Sharpen → Clarity
```

Rotate before Crop: straighten first, then crop to remove empty corners.
Denoise/Sharpen after geometry: sharpen the final composition.

As with pixel adjustments, this is convention, not constraint. The
system allows any order and warns about unusual placements.
