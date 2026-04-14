# Geometry in Source: Pre-Merge Spatial Transforms

**Component:** `seer-editor::source` (Phase 0), `seer-editor::geometry` (Phase 1)
**Part of:** Circe image editing engine

## 1. Motivation

Historically, Seer defined "Geometry" (crop, rotate, perspective) as a pipeline phase (Phase 1) that occurred _after_ the Condenser (Phase 0) merged all source inputs. This assumes a single coordinate space.

However, in multi-source workflows, every image arrives in its own coordinate space. By forcing geometry to happen post-merge, we completely lose the ability to spatially manipulate individual inputs before they are flattened together.

- You cannot align star jitter.
- You cannot trim a panorama tile's lens hood before stitching.
- You cannot scale and position a composited graphic insert independently of the background.

**The shift:** When multiple sources merge, each merge strategy carries its own geometric parameters appropriate to that strategy. Phase 1 Geometry remains the global spatial transform on the canonical canvas.

## 2. Scenarios

Three primary multi-source workflows require per-source spatial transforms:

1. **Mosaic & Panorama Stitching:**
   Multiple source images overlap. Before the Condenser merges them into a massive canvas, each source needs a local `Crop` (to remove edge vignettes or artifacts) and a `Translate/Rotate` (to align the overlap). The final canonical canvas dimension is derived from the union of these placed tiles.

2. **Integration (Astrophotography, Focus Stacking):**
   Multiple exposures of the exact same scene. The canonical canvas dimensions match the base reference image. Secondary inputs require sub-pixel `Translate` and slight `Rotate` to correct for camera jitter before running the mean/median/sigma-clip merge strategy.

3. **Masks & Overlays (Compositing):**
   A base image and a secondary graphical insert (e.g., a logo overlay or graphic element). The insert requires `Scale`, `Translate`, and `Rotate` to position it on the base image. All of this must happen to the secondary graphic _before_ it is blended.

## 3. Per-Strategy Geometry (Not Universal)

Each merge strategy has fundamentally different geometric needs. Rather than attaching a universal `LocalGeometry` struct to every `SourceEntry`, geometric parameters live **inside each merge strategy's own data structures**:

- **Single:** No per-source geometry needed. Phase 1 handles everything.
- **Integrate:** Sub-pixel translate + slight rotation for jitter correction. Perspective and scale are meaningless here — all exposures are the same scene at the same focal length.
- **Mosaic:** Translate, scale, rotation for tile placement. `MosaicPlacement` already has `x, y, scale` — extend with `rotation`.
- **MaskedOverlay:** Affine transform (scale, translate, rotate) on `OverlaySpec` to fit inserts onto the base image.

This avoids a lowest-common-denominator abstraction that either carries fields irrelevant to some strategies or is too limited for others. The geometry is part of the merge semantics, not a property of the source image itself.

## 4. The Canonical Canvas

By moving per-source geometry into merge strategies, the **Condenser (Phase 0) becomes the Canvas Asserter** for multi-source workflows:

- **Single Source (Common Case):** The Condenser's dimensions are implicitly bound to the single input. Phase 1 Geometry then establishes the canonical canvas as it does today.
- **Multi-Source:** The Condenser evaluates per-source geometry within the merge strategy and produces a merged buffer. For Mosaic, the canvas is the union of placed tiles. For Integrate, it matches the reference image. Phase 1 Geometry then operates on that merged result.

### Phase 1 Stays as Geometry

Phase 1 retains its full role as **global spatial transforms** on the canonical canvas — crop, rotate, perspective. This is not merely "framing" or "artboard trimming." A photographer straightening a stitched panorama's horizon is doing global rotation, not framing. The only change is that Phase 1's input may now come from a merge that already applied per-source transforms.

## 5. Design Tradeoffs: The Compositing Conflict

When dealing with **Overlays** (Scenario 3), a tension exists between Phase 0 (Condensers) and Phase 2 (Zones).

In a true node-based compositor (a DAG like Nuke or Blender), you can load an overlay, load a background, use an AI mask generator to isolate a foreground actor, and mix them precisely. Seer relies on a strict **Linear Pipeline**: _Merge Pixels (0) → Geometry (1) → Cut Masks (2) → Adjust Pixels (3)_.

If an overlay (a color graphic) is merged onto the base photo in Phase 0, it flattens the pixels. A Phase 2 Semantic Zone (SegFormer) can no longer identify the actor to pull them cleanly in front of the graphic — because the graphic has already overwritten the background.

### Model B: Image Files as Masks & Early Alphas (Chosen)

We rigorously enforce the Linear sequence:

- The Condenser (Phase 0) merges all color data into the final canonical canvas. Overlays must bring their own Alpha channels (e.g., transparent PNGs) if they need isolation upon merge.
- **Image masks** (depth maps, graphic mattes, dirt textures) are handled by a new Zone Generator Plugin: `ImageFileZone`, living in Phase 2. This is an **orthogonal feature** — see the separate ImageFileZone spec.
- **Tradeoff:** You cannot use SegFormer to implicitly mask out objects obscuring a Phase 0 overlay. The architectural simplicity is worth it: the pipeline remains strictly linear, mathematically predictable, and free of cross-phase routing.

### Why Not Model A (DAG-in-a-Line)?

Model A would keep overlay assets isolated as side-layers through Phase 0, give Phase 2 Zones a `source_target` attribute to analyze specific layers, and let Phase 3 Adjustments do the final compositing. This is extremely powerful but embeds DAG routing inside a linear UI — complexity that infects every downstream decision. Rejected.

## 6. Implementation Plan

### Phase I: Rotate & Perspective in Phase 1 Geometry

Fill the existing gaps in the geometry phase:

1. Implement `RotatePlugin` as an `AdjustmentPlugin` in the geometry phase, with angle parameter and canvas-expanding rotation logic.
2. Implement `PerspectivePlugin` with four-corner displacement parameters and projective transform processing.
3. Register both in `PluginRegistry::geometry()`.

This is immediately useful for the single-source workflow that exists today.

### Phase II: Per-Strategy Geometry in Merge Structs

When implementing specific merge strategies, extend their data structures:

1. Add `rotation: f64` to `MosaicPlacement`.
2. Add `translate_x: f64, translate_y: f64, rotation: f64` to an `IntegrationEntry` struct within `MergeStrategy::Integrate`.
3. Add affine fields (`scale_x, scale_y, translate_x, translate_y, rotation`) to `OverlaySpec`.
4. Update `merge_sources()` to apply per-source transforms before merging.

### Phase III: Condenser Canvas Assertion

Needed when Mosaic lands:

1. Modify the merge evaluator to compute explicit `(width, height)` from the union of placed, transformed tiles.
2. Ensure single-source continues to pass through unchanged.
3. Update the `Session` evaluator to allocate the canonical f32 buffer based on the Condenser's output dimensions.

### Phase IV: ImageFileZone Generator (Separate Spec)

Orthogonal to geometry-in-source. To be specified and implemented independently:

1. New `ZoneGeneratorPlugin`: `ImageFileZone`.
2. Schema: `file_path`, placement geometry (to align the matte relative to the canonical canvas), `invert`.
3. Evaluator: decode file, apply transforms, convert to single-channel grayscale f32, blend into `ZoneOutput`.
