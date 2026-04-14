# Canvas Interaction — Direct Manipulation Architecture

**Component:** frontend overlay system
**Part of:** Circe image editing engine

## Context

Circe's canvas has been a passive viewport: pan with drag, zoom with
scroll. Geometric adjustments (see [geometry.md](geometry.md)) are the
first to require direct manipulation — but the same need applies to
white balance eyedroppers, tone curve sampling, brush zone painting,
and gradient placement. Rather than building one-off canvas handlers
per adjustment, this document defines a three-layer architecture that
makes any adjustment's canvas interaction composable and consistent.

---

## 1. Three Layers

```
Layer 2: Adjustment Overlays
  CropOverlay, RotateOverlay, EyedropperOverlay, BrushOverlay, ...
  Concrete Svelte components. Compose primitives for a specific
  adjustment. Own configuration (sample radius, snap angles, etc).

Layer 1: Interaction Primitives
  Eyedropper, DragRegion, BrushStroke, HandleDrag, AngleDrag, ...
  Reusable behaviors. Not tied to any adjustment. Emit raw spatial
  data (position, delta, stroke path). Parameterized but generic.

Layer 0: Canvas Interaction Protocol
  Props contract, coordinate mapping, event routing, coalescing.
  The bare reactive bridge between canvas and edit panel. No
  adjustment-specific knowledge.
```

Each layer depends only on the one below it. An adjustment overlay
composes interaction primitives; interaction primitives use the
canvas protocol. Nothing reaches across layers.

---

## 2. Layer 0: Canvas Interaction Protocol

The protocol is a **prop interface** and a set of conventions. There is
no base class, no framework, no runtime. Overlay components are plain
Svelte components that follow these conventions.

### 2.1 Standard Props

Every overlay component receives:

```typescript
interface OverlayProps {
	/** Current adjustment parameters. Read to render; write via onParamChange. */
	params: AdjustmentParams;

	/** Viewport transform: maps image coordinates ↔ screen coordinates. */
	layout: ViewLayout;

	/** Input image dimensions in pixels (for normalized ↔ pixel conversion). */
	imageSize: Size;

	/** Emit parameter updates. Feeds into the pipeline scheduler. */
	onParamChange: (params: AdjustmentParams) => void;
}
```

These four props are the entire contract. The CirceEditor mounts an
overlay component for the selected adjustment and passes these props.
The overlay component handles everything else internally.

### 2.2 Coordinate Mapping

Overlays need to convert between three coordinate spaces:

| Space           | Origin   | Units                 | Used for                                    |
| --------------- | -------- | --------------------- | ------------------------------------------- |
| **Normalized**  | Top-left | [0, 1] × [0, 1]       | Adjustment params (CropParams, zone coords) |
| **Image pixel** | Top-left | Pixels of input image | Display readouts, hit testing               |
| **Screen**      | Top-left | CSS pixels of canvas  | SVG overlay positioning, pointer events     |

Conversions use `ViewLayout.content_rect` (image-in-canvas position and
size):

```
image_px  = normalized × imageSize
screen_px = content_rect.origin + (image_px / imageSize) × content_rect.size
```

The reverse is used for pointer events:

```
image_px  = ((screen_px - content_rect.origin) / content_rect.size) × imageSize
normalized = image_px / imageSize
```

A shared utility (`coordMap(layout, imageSize)`) provides these
conversions. Overlay components call it; they don't reimplement the math.

### 2.3 Event Routing

The CirceEditor wraps the canvas in a container div. The overlay SVG
sits on top with `pointer-events: none` by default. Individual SVG
elements that need interaction set `pointer-events: auto` (handles,
interactive areas). Events that don't hit an interactive SVG element
fall through to the canvas for viewport navigation.

For overlays that capture the entire canvas area (crop mode, brush
painting), the overlay sets `pointer-events: auto` on a full-size
rect and handles all events, optionally delegating viewport navigation
for specific gestures (e.g., scroll → zoom).

### 2.4 Mounting and Lifecycle

```svelte
<!-- CirceEditor.svelte -->
{#if selectedAdjustment && canvasOverlay}
	<svelte:component
		this={canvasOverlay}
		params={selectedAdjustment.params}
		layout={currentLayout}
		{imageSize}
		onParamChange={(p) => handleParamChange(selectedAdjustment.id, p)}
	/>
{/if}
```

The overlay registry:

```typescript
const CANVAS_OVERLAYS: Partial<Record<string, Component>> = {
	Crop: CropOverlay,
	Rotate: RotateOverlay
	// WhiteBalance: EyedropperOverlay,
	// ToneCurve: LuminanceSamplerOverlay,
};
```

No overlay entry → navigate mode. Mount → overlay active. Unmount
(deselect adjustment) → back to navigate. No explicit mode management.

### 2.5 Pre-Adjustment Preview

Some overlays need the canvas to show the **pre-adjustment image** (e.g.,
Crop needs the full uncropped image to frame against). The overlay
signals this via an additional prop or by the registry entry carrying
metadata:

```typescript
const CANVAS_OVERLAYS = {
	Crop: { component: CropOverlay, preview: 'pre-adjustment' },
	Rotate: { component: RotateOverlay, preview: 'pre-adjustment' },
	WhiteBalance: { component: EyedropperOverlay, preview: 'current' }
};
```

`preview: 'pre-adjustment'` tells the CirceEditor to evaluate the
pipeline up to (but not including) the selected adjustment and display
that result. `preview: 'current'` (default) shows the normal full
pipeline output.

---

## 3. Layer 1: Interaction Primitives

Interaction primitives are reusable Svelte components or functions that
encapsulate a specific spatial behavior. They emit raw spatial data —
positions, deltas, paths — without knowing what adjustment will consume
it.

### 3.1 Primitives Catalog

| Primitive        | Input                    | Output                        | Used by                  |
| ---------------- | ------------------------ | ----------------------------- | ------------------------ |
| **Eyedropper**   | Click on canvas          | Image-pixel position + color  | WhiteBalance, ColorMixer |
| **DragRegion**   | Drag to define a rect    | Normalized rect               | Crop (free ratio)        |
| **BrushStroke**  | Pointer drag path        | Array of normalized points    | Brush zones              |
| **HandleDrag**   | Drag a positioned handle | Normalized position delta     | Perspective corners      |
| **AngleDrag**    | Horizontal drag          | Angle in degrees              | Rotate                   |
| **GradientDrag** | Drag a line/point        | Normalized start + end points | Gradient zones           |
| **FramerDrag**   | Pan/zoom behind frame    | Normalized crop rect          | Crop (locked ratio)      |

Each primitive is parameterized:

- **Eyedropper:** `sampleRadius` (1 = single pixel, 5 = 5×5 average),
  `averaging` ('center' | 'mean')
- **AngleDrag:** `sensitivity` (degrees per full-canvas drag),
  `snapAngles` (array of snap targets), `snapThreshold` (degrees)
- **BrushStroke:** `minSpacing` (normalized distance between points),
  `pressure` (boolean — use pressure if available)
- **FramerDrag:** wraps `FramerState` from WASM, outputs crop rect

### 3.2 Primitive Interface

Primitives are Svelte components that render into the overlay SVG and
emit events:

```svelte
<Eyedropper
  layout={layout}
  imageSize={imageSize}
  sampleRadius={3}
  averaging="mean"
  onSample={(pos, color) => { ... }}
/>
```

Or for stateful primitives like FramerDrag:

```svelte
<FramerDrag
  layout={layout}
  imageSize={imageSize}
  ratio={{ w: 3, h: 2 }}
  onCropChange={(rect) => { ... }}
/>
```

Primitives handle their own pointer capture, cursor changes, and SVG
rendering (handles, crosshairs, brush cursor). They don't know about
adjustments or the pipeline.

---

## 4. Layer 2: Adjustment Overlays

Adjustment overlays are concrete Svelte components that compose Layer 1
primitives and translate their output into `onParamChange` calls.

### 4.1 Example: CropOverlay

```svelte
<script>
	// Layer 0: standard props
	let { params, layout, imageSize, onParamChange }: OverlayProps = $props();

	// Overlay-specific state
	let ratio = $state({ w: 3, h: 2 });
	let showThirds = $state(true);

	function handleCropChange(rect: NormalizedRect) {
		onParamChange({ ...params, Crop: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
	}
</script>

<!-- Layer 1: interaction primitive -->
<FramerDrag {layout} {imageSize} {ratio} onCropChange={handleCropChange}>
	<!-- Layer 2: adjustment-specific visuals -->
	{#if showThirds}
		<ThirdsGrid rect={cropScreenRect} />
	{/if}
	<CropInfo rect={cropScreenRect} dimensions={cropPixelDimensions} />
</FramerDrag>
```

The overlay:

- Composes `FramerDrag` (Layer 1) for interaction
- Adds adjustment-specific UI: rule-of-thirds grid, crop info display
- Translates the primitive's output (normalized rect) to adjustment
  params (CropParams) via `onParamChange`
- Manages its own UI state (selected ratio, grid toggle)

### 4.2 Example: EyedropperOverlay (future)

```svelte
<script>
	let { params, layout, imageSize, onParamChange }: OverlayProps = $props();

	function handleSample(pos: Point, color: RGB) {
		const { temperature, tint } = colorToWhiteBalance(color);
		onParamChange({ ...params, WhiteBalance: { temperature, tint } });
	}
</script>

<Eyedropper {layout} {imageSize} sampleRadius={5} averaging="mean" onSample={handleSample} />
```

The overlay:

- Composes `Eyedropper` (Layer 1) with specific config (5px radius,
  mean averaging)
- Translates color sample → WhiteBalance temperature/tint via a
  conversion function
- Emits via `onParamChange` — same path as the temperature slider

### 4.3 What Each Layer Owns

| Concern                      | Layer 0 (Protocol) | Layer 1 (Primitive) | Layer 2 (Overlay) |
| ---------------------------- | ------------------ | ------------------- | ----------------- |
| Prop interface               | ✓                  |                     |                   |
| Coordinate mapping           | ✓                  |                     |                   |
| Event routing (SVG layering) | ✓                  |                     |                   |
| Pointer capture, cursors     |                    | ✓                   |                   |
| Spatial computation          |                    | ✓                   |                   |
| SVG handle rendering         |                    | ✓                   |                   |
| Adjustment-specific config   |                    |                     | ✓                 |
| Param translation            |                    |                     | ✓                 |
| Composition guide overlays   |                    |                     | ✓                 |
| Edit panel integration       |                    |                     | ✓                 |

---

## 5. Data Flow

Both the edit panel and the canvas overlay write through the same path:

```
Edit panel slider           Canvas overlay drag
       │                           │
       ▼                           ▼
  onParamChange(params)      onParamChange(params)
       │                           │
       └──────────┬────────────────┘
                  ▼
      scheduler.perform('Adjust', [
        { type: 'update-params', id, params }
      ])
                  │
                  ▼
           rAF coalesce
                  │
                  ▼
         Worker: apply to EditGraph
                  │
                  ▼
         Worker: evaluate pipeline
                  │
                  ▼
        onState → update reactive state
                  │
          ┌───────┴────────┐
          ▼                ▼
    Edit panel           Canvas overlay
    re-renders           re-renders
```

Symmetry is the key property: adding canvas interaction to any
adjustment means writing a Layer 2 component that composes Layer 1
primitives. No changes to the CirceEditor, scheduler, worker, or
protocol.

---

## 6. Implementation Notes

**Build Layer 0 first.** The coordinate mapping utility, overlay
container in CirceEditor, and registry are small — perhaps 50 lines
total. This unlocks all subsequent work.

**Build primitives on demand.** Don't pre-build all Layer 1 primitives.
Build `FramerDrag` for Crop, `AngleDrag` for Rotate, and add others
(Eyedropper, BrushStroke) when those features are implemented.

**Primitives are thin.** A `FramerDrag` primitive wraps `FramerState`
(WASM) and renders the dimming overlay + frame. An `AngleDrag` captures
horizontal pointer delta and applies sensitivity. An `Eyedropper`
captures a click and reads canvas pixels. Each is 50–150 lines.

**No premature abstraction.** If two overlays need slightly different
behaviors, let them diverge. Extract a shared primitive only when a
clear pattern emerges across three or more uses.
