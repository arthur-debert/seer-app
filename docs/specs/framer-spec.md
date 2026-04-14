# Framer — Feature Spec

**Component:** Framer
**Part of:** Seer suite, Mirror subsystem

## What Framer Does

Framer lets a user crop an image by choosing a target ratio, then panning and zooming
to select which part of the image fills that ratio. The output is a crop rectangle
in image-pixel coordinates.

The interaction model is deliberately **frame-first**: the crop frame dominates the
viewport and the image moves behind it, rather than the more common approach of
showing the full image with a draggable rectangle on top. This means the user always
sees exactly what will be kept — nothing outside the frame competes for attention.

Think of it as looking through a window that matches the target ratio. You drag the
image to reposition it, pinch (or scroll) to zoom, and the window stays put.

## User Experience

### The Frame

When the user selects a ratio (say 16:9), the viewport draws a frame as large as
possible within the available screen area. The frame matches the chosen ratio;
whichever viewport dimension would cause overflow is the one that gets letterboxed.
The remaining "dead zone" outside the frame is a neutral background — it is not
image content.

If the viewport itself happens to match the ratio, the frame fills the entire screen.

### Panning

Click-and-drag (desktop) or touch-and-drag (mobile) moves the image behind the
frame. The image cannot be dragged so far that empty space appears inside the frame —
the frame is always 100 % filled with image pixels.

### Zooming

Scroll-wheel (desktop) or pinch (mobile) scales the image. Zoom is anchored to the
cursor/pinch midpoint so the point under the user's finger stays fixed.

**Scale limits:**

- **Minimum zoom:** the image must completely cover the frame — no empty pixels
  inside the frame, ever.
- **Maximum zoom:** 1:1 pixel mapping (100 %). Zooming past native resolution would
  produce upscaled/blurry pixels, so we clamp there.

These two limits depend on the relationship between image size, frame size, and
current pan position. The minimum zoom is the familiar "cover" fit for the chosen
ratio; the maximum is the scale at which one image pixel equals one screen pixel.

### Choosing a Ratio

For the initial implementation, a dropdown offers a fixed set of presets:

| Label  | Ratio |
| ------ | ----- |
| 1 : 1  | 1:1   |
| 4 : 3  | 4:3   |
| 3 : 2  | 3:2   |
| 16 : 9 | 16:9  |
| 5 : 4  | 5:4   |
| 7 : 5  | 7:5   |

Custom ratio entry is a follow-up feature and out of scope here.

#### Landscape / Portrait Toggle

Each ratio can be applied in landscape or portrait orientation via a toggle next to
the dropdown. "16:9 + Portrait" produces a 9:16 frame. The user thinks in terms of
the ratio name (always the wider-first label) plus an orientation — this is a UI
convenience.

**Data model:** there is no orientation flag. The model stores only the resolved ratio
with the correct axis order. 16:9 landscape is `(16, 9)`, 16:9 portrait is `(9, 16)`.
The UI translates between the human-friendly "name + toggle" and the canonical pair.
This keeps all downstream math free of conditional axis swaps.

### Viewport Resizing

When the browser window (or Tauri shell) resizes, the frame is recomputed to fill the
new viewport as much as possible while keeping the chosen ratio. The image position
and zoom level are preserved (clamped if necessary so the frame remains fully
covered).

## Output

In Seer's [Working Vocabulary](../README.md#working-vocabulary), Framer turns
a **Rendering** (an editorial treatment of an image) into a **Variant** (that rendering
at a specific crop and output ratio). The input is the pixel data of a rendering; the
output is a crop definition that specifies the variant.

Concretely, Framer produces a `Rect` (as defined in `seer-viewer::geometry`) in
**image-pixel coordinates**. This rectangle describes the visible crop: where in the
rendering the frame lands, at what size. Downstream consumers — export, further
processing, Key Points — receive this rect and don't need to know about viewports or
screen sizes.

A convenience `Rect::aspect_ratio()` method should be added to `Rect` (delegating to
`Size::aspect_ratio()`) so consumers can cheaply verify the crop ratio.

## Architecture Constraints

These follow from the project's existing conventions (see `docs/dev/conventions.md`).

### Rust-first logic

All layout math, clamping, and state management live in `seer-viewer`. The
TypeScript/Svelte side captures raw input events (drag deltas, scroll deltas, resize
events) and forwards them to Rust. Rust returns the updated layout; TypeScript applies
it to the GPU renderer.

The pattern, for reference:

```
User event → TS captures (dx, dy, scroll delta, new viewport size)
           → Rust computes new FramerState
           → TS receives updated crop rect + display layout
           → TS writes GPU uniforms and redraws
```

### Input-agnostic API

The Rust API accepts abstract deltas — `pan(dx, dy)`, `zoom(delta, anchor_x,
anchor_y)`, `set_ratio(w, h)`, `resize_viewport(w, h)` — not device-specific events.
Whether panning comes from a mouse drag, a touch gesture, or a keyboard shortcut is
the TypeScript layer's concern.

### Desktop-first for initial testing

The first testable build targets desktop (Tauri / browser window):

- **Pan:** mouse drag
- **Zoom:** scroll wheel
- **Ratio selection:** dropdown + landscape/portrait toggle

Mobile gestures and keyboard shortcuts are future work.

### Existing types to use

- `Point`, `Size`, `Rect` from `seer-viewer::geometry`
- `ViewLayout` from `seer-viewer::viewport` for the display-side layout
- The WASM bridge (`seer-viewer-wasm`) for browser-mode access to Rust logic

## Key Behaviors to Get Right

1. **Frame is always full.** At no point during pan or zoom should any pixel inside
   the frame be empty. Clamping must be applied before rendering, not after.

2. **Zoom anchoring.** Zooming should feel natural: the point under the cursor stays
   fixed. This means zoom changes both the scale and the pan offset simultaneously.

3. **Smooth resize.** Window resize recomputes the frame and adjusts the image
   position in a single frame — no flash of misaligned content.

4. **Ratio change preserves center.** When switching ratios, the new frame should be
   centered on the same image region that was centered before, zoom-adjusted to cover
   the new frame.

## Relationship to Circe

Framer operates independently of Circe's editing pipeline. Circe's future Crop
node (Category B geometric node) handles in-pipeline cropping — changing canvas
dimensions mid-pipeline. Framer handles post-pipeline cropping: given a
rendered output, what region and ratio should be exported?

The two are complementary: a Circe pipeline produces a Rendering, and Framer
turns that Rendering into a Variant at a specific crop. Both can coexist on
the same image.

## What Framer Is Not

- **Not an export pipeline.** Framer determines the crop rectangle. Actually writing
  cropped pixels to a file is a separate concern.
- **Not a multi-crop tool.** One image, one frame, one ratio at a time.
- **Not a rotation tool.** Rotation (straightening, 90-degree flips) is out of scope.
