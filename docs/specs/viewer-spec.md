# Mirror — Feature Spec

**Component:** Mirror
**Part of:** Arami suite

## What Mirror Does

Mirror lets a photographer compare two renderings of the same image — or two
different images — side by side, with synchronized navigation. Pan one panel and
the other follows. Zoom into star halos at 200% in one panel and the same region
appears at the same magnification in the other. The user never has to manually
align two views.

The typical use: you have exported a color grade and a monochrome conversion of the
same photograph. You want to evaluate them at specific detail regions — skin
texture at full resolution, shadow noise in the background, sharpening artifacts
around edges. Mirror lets you navigate to each area once and see both treatments
simultaneously.

## User Experience

### Two Panels

Mirror opens with two image panels arranged side by side (left and right). Each
panel displays one image at contain-fit. Both panels share the same viewport
state: the same zoom level, the same pan offset, centered on the same image
region.

The divider between panels is a simple vertical line. The panel sizes are equal
(50/50 split). Resizable panels are future work.

### Synchronized Navigation

All navigation is synchronized by default:

- **Zoom** (scroll wheel): zooming in either panel zooms both. The zoom is
  anchored to the cursor position within the active panel, and the other panel
  matches so the same image region is centered.
- **Pan** (click-and-drag): dragging in either panel pans both. The same
  image-space delta applies to both panels.
- **Fit-to-screen** (reset): resetting one panel resets both to contain-fit,
  centered.

The user interacts with whichever panel is under the cursor. The other panel
mirrors the state change. There is no "primary" panel — either one drives
navigation equally.

### Zoom and Pan Behavior

Zoom and pan follow the same model as `arami_viewer::viewer::ViewerState`:

- Zoom is relative to contain-fit (zoom = 1.0 means full image visible).
- Pan is in image-pixel coordinates, stable across canvas resizes.
- Zoom anchoring keeps the point under the cursor fixed.
- Pan is clamped so the image fills the panel (no empty space when zoomed in).

The key difference: Mirror applies the same zoom and pan to both panels. When the
user zooms at position (x, y) in the left panel, the right panel computes its own
anchored zoom to keep the corresponding image region in view.

For images of different dimensions, the zoom level represents the same relative
magnification — zoom = 2.0 means both images are at 2x their contain-fit scale.
The image region in view will correspond when the images depict the same scene.

### Loading Images

Mirror accepts two images. For the initial implementation, images are loaded from
file paths (desktop) or URLs (browser), using the same `loadImage` infrastructure
as the rest of the suite.

In Arami's [Working Vocabulary](../README.md#working-vocabulary), each
panel typically displays a **Rendering** (an editorial treatment) or a **Variant**
(a rendering at a specific crop). Mirror does not distinguish — it receives decoded
pixel data and displays it.

### Canvas Resizing

When the window resizes:

1. Both panels resize to fill their half of the available space.
2. The shared zoom level is preserved.
3. Pan is clamped to the new panel dimensions.
4. Both panels re-render in a single frame — no flash of misaligned content.

## Key Points

A Key Point is a saved viewport state with annotations — a bookmark for a specific
area of interest in the comparison.

### What a Key Point Captures

- **Zoom level and pan offset** — the shared viewport state at the time of saving.
- **Regions of interest (ROIs)** — zero or more named rectangular zones within the
  viewport. These are image-space rectangles marking specific areas (e.g., a star
  halo, a patch of skin texture, an edge artifact).
- **Annotation** — free text describing what to look for (e.g., "halo artifacts
  around bright stars," "shadow noise comparison").

### Using Key Points

The UI presents Key Points as a navigable list. Clicking a Key Point snaps both
panels to the saved viewport state with ROIs highlighted as overlays.

Key Points are the photographer's structured notes for a comparison session. They
answer the question: "what did I want to look at, and what did I see?"

### Persistence

Key Points are stored as JSON alongside the comparison session. The format is a
list of objects:

```json
[
	{
		"id": "kp-1",
		"zoom": 3.5,
		"pan": { "x": 1200, "y": 800 },
		"rois": [
			{
				"label": "star halos",
				"rect": { "origin": { "x": 1100, "y": 700 }, "size": { "width": 200, "height": 200 } }
			}
		],
		"annotation": "Check halo size difference between renderings"
	}
]
```

Key Point IDs are stable across sessions. The model types (`KeyPoint`, `Roi`) live
in `arami-viewer` and serialize via serde.

## Architecture

### Composition, Not Reimplementation

Mirror is composed of two ImageViewer instances with a
shared synchronization layer. Each panel is a full ImageViewer — same WebGPU
renderer, same viewport math, same `ViewerState` on the WASM heap. Mirror adds:

1. **A sync controller** that propagates state changes from one panel to the other.
2. **Key Points model** — data types and persistence.
3. **UI chrome** — panel layout, Key Points list, ROI overlays.

### Sync Controller

The sync controller sits between user input and the two `ViewerState` instances.
When the user interacts with panel A:

```
User event in panel A
  → TS captures (delta, anchor, etc.)
  → ViewerState A: apply interaction, get updated layout
  → ViewerState B: apply same logical interaction, get updated layout
  → Render both panels
```

"Same logical interaction" means:

- **Zoom**: both panels zoom by the same factor. The anchor point is translated
  from panel A's canvas coordinates to the equivalent image-space position, then
  applied to panel B's ViewerState.
- **Pan**: both panels pan by the same image-space delta.
- **Set zoom**: both panels jump to the same zoom level.
- **Reset**: both panels return to zoom = 1.0, pan = (0, 0).

The sync controller does not replace ViewerState — it coordinates two independent
instances. Each ViewerState enforces its own clamping and invariants. If the images
have different dimensions, one panel might clamp pan differently than the other,
which is correct behavior.

### Rust-First Logic

Following project conventions:

- Key Point and ROI types live in `arami-viewer` with serde serialization.
- The sync controller's logic (translating one panel's interaction to the other)
  is a Rust function exposed via WASM.
- TypeScript handles event wiring, panel layout, and rendering.

### Rendering

Each panel has its own WebGPU `Renderer` instance and its own `<canvas>`. The two
renderers are independent — they can use separate GPU textures (different images)
but share the same `GPUDevice` to avoid duplicating device initialization.

Minimap integration is future work. When added, a single minimap will show the
shared viewport state relative to one of the images (user-selectable).

## Relationship to Circe

Mirror can compare any two images, including different Circe pipeline outputs.
The typical use case: compare a color rendering against a monochrome version
(two Circe version branches of the same image), or compare before/after a
specific processing step. Each Mirror panel displays the pipeline output of a
Rendering — Mirror does not need to know about Circe's internals.

## What Mirror Is Not

- **Not a diff tool.** Mirror shows two images side by side. It does not compute
  pixel differences, blend modes, or overlay comparisons. Those are potential
  future features, not the initial scope.
- **Not a multi-image gallery.** Two panels, two images. Extending to N-way
  comparison is future work.
- **Not a crop tool.** Mirror displays images. Per-panel cropping (showing each
  panel at a different Framer-defined variant) is future work described in the
  [vision doc](../README.md).
- **Not a file manager.** Mirror receives image data. How images are selected,
  organized, or grouped is the Catalog's concern.

## Implementation Sequence

1. **Dual-panel layout** — two ImageViewer instances side by side, each loading a
   different image. No synchronization yet.

2. **Synchronized navigation** — zoom, pan, and reset propagated between panels
   via the sync controller.

3. **Key Points model** — Rust types, serialization, and WASM bridge. No UI yet.

4. **Key Points UI** — navigable list, click-to-snap, ROI overlays.

5. **Persistence** — save/load Key Points to JSON.

Each step is independently testable and produces a usable (if incomplete) demo.
