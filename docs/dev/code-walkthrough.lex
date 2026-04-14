Seer Code Walkthrough

This document walks through every major component of the Seer codebase in dependency order. Each section builds only on what came before. By the end you will understand the full data path: image bytes in, edited pixels out, rendered to screen.

The walkthrough follows the code, not the architecture document. Where readme.lex explains _why_, this document explains _how_ — with file paths, struct names, and function signatures.


1. PixelBuffer — The Universal Currency

  File: seer-editor/src/pixel_buffer.rs

  Every component in the pipeline produces, consumes, or transforms a PixelBuffer. It is the single representation for image data throughout the system.

    pub struct PixelBuffer {
        pub width: u32,
        pub height: u32,
        pub data: Vec<f32>,   // [R, G, B, R, G, B, ...], length = width * height * 3
        pub color_space: ColorSpaceTag,  // advisory metadata: LinearRec2020, LinearSrgb, or DisplaySrgb
    }

  Three channels per pixel, row-major order, f32 precision. The pipeline operates in scene-referred Linear Rec. 2020, where values routinely exceed 1.0 (a sunlit highlight might be 8.0). The ODT (Output Device Transform) compresses scene values into the displayable [0.0, 1.0] range at output boundaries. Clamping to [0, 255] and conversion to u8 happens only in to_rgba_u8(), after the ODT has run.

  ColorSpaceTag is advisory metadata for assertions and debugging — the evaluator does not dispatch on it. Three variants exist: LinearRec2020 (default for all pipeline-internal buffers), LinearSrgb (after source decode, before working-space conversion), and DisplaySrgb (after ODT, gamma-encoded, ready for screen or encoder).

  Why f32: 23-bit mantissa precision (vs 10-bit for f16), extended range for intermediate values, matches GPU native float. The memory cost (12 bytes per pixel) is acceptable for a single-image editor.

  Key methods:

  - new(width, height) — black buffer, all zeros.
  - from_encoded_bytes(bytes) — decodes JPEG/PNG/TIFF via the `image` crate, converts to RGB f32.
  - from_rgb_f32(data, width, height) — wraps pre-decoded data with length validation.
  - to_rgba_u8() — clamps to [0, 255], adds alpha=255. This is the only place f32 becomes u8, and it happens right before GPU texture upload.

  The pipeline never touches integer pixels. Source plugins decode to PixelBuffer, adjustments transform PixelBuffer to PixelBuffer, the evaluator outputs a PixelBuffer, and the WASM bridge calls to_rgba_u8() once to hand bytes to JavaScript.


1b. Color Space Module — The Pipeline's Color Foundation

  File: seer-editor/src/color_space.rs

  The pipeline operates in Linear Rec. 2020 throughout. Source plugins convert input images from sRGB to Rec. 2020 at ingestion. The ODT (Output Device Transform) converts back to display sRGB at output boundaries (screen rendering and file export). No plugin needs to know about sRGB during processing.

  All color space conversions are provided by kolor-64, which supplies 24 built-in color spaces (Rec. 2020, sRGB, Oklab, Oklch, ProPhoto, etc.), chromatic adaptation transforms (Bradford, Von Kries, CAT02), and raw 3x3 matrix extraction. It supports no_std, WASM, and f64 precision.

  Key types:

  - WorkingSpace trait — abstracts over different working spaces. Supplies 3x3 matrices for converting to/from CIE XYZ (D65-adapted), luminance weights, and a gamut boundary descriptor. The built-in implementation is LinearRec2020; a LinearSrgb implementation exists for testing.
  - BulkConversion — wraps kolor-64 matrices for efficient per-pixel conversion (precomputed 3x3 multiply).
  - ColorSpaceTag — advisory enum (LinearRec2020, LinearSrgb, DisplaySrgb) on PixelBuffer for assertions and debugging.


2. Parameter Schema — How Plugins Describe Themselves

  File: seer-editor/src/plugin.rs (lines 35–261)

  Before seeing any plugin trait, understand the self-describing parameter system. It is the contract between plugins and everything else: the UI auto-generates controls from it, serialization stores it, history diffs it.

  2.1 Type Descriptors

    The ParamType enum defines what kind of control a parameter needs:

      enum ParamType {
          Float(FloatParamDesc),    // slider: min, max, default, step
          Int(IntParamDesc),        // stepper: min, max, default
          Bool(BoolParamDesc),      // toggle: default
          Choice(ChoiceParamDesc),  // dropdown: options[], default index
          Color(ColorParamDesc),    // color picker: default [r, g, b]
          Curve(CurveParamDesc),    // spline editor: default control points
          Point(PointParamDesc),    // 2D position: default x, y
          Rect(RectParamDesc),      // rectangle: default [x, y, w, h]
          Strokes(StrokesParamDesc),// brush data: no default (empty vec)
      }

    Each descriptor carries its own range, default value, and step size. The host never needs to know what the parameter means — only its type and constraints.

  2.2 ParamDescriptor and ParamSchema

    A ParamDescriptor bundles a type descriptor with metadata:

      struct ParamDescriptor {
          id: String,          // "temperature", "clip_limit", etc.
          label: String,       // "Temperature", "Clip Limit"
          description: String, // tooltip text
          param_type: ParamType,
          group: Option<String>, // optional visual grouping
      }

    A ParamSchema is the complete description a plugin returns:

      struct ParamSchema {
          params: Vec<ParamDescriptor>,
          groups: Vec<ParamGroup>,       // collapsible UI sections
      }

  2.3 Runtime Values

    At runtime, parameters are a flat map:

      type ParamValues = HashMap<String, ParamValue>;

    ParamValue is the runtime counterpart to ParamType — same variants (Float(f64), Int(i64), Bool(bool), Curve(Vec<ControlPoint>), etc.) with accessor methods (as_float(), as_bool(), as_curve()).

    The function default_params(schema) generates a ParamValues from a ParamSchema by extracting each descriptor's default. This is how the registry produces default parameter sets for new adjustments.


3. Plugin Traits — The Extension Points

  File: seer-editor/src/plugin.rs (lines 263–437)

  Three traits define the plugin API. Built-in operations implement the same traits that third-party plugins would.

  3.1 AdjustmentPlugin

    trait AdjustmentPlugin: Send + Sync {
        fn id(&self) -> &str;                  // "seer.white-balance"
        fn name(&self) -> &str;                // "White Balance"
        fn category(&self) -> AdjustmentCategory;  // Color, Tone, Detail, Creative, Correction, Ai
        fn accepts_zone(&self) -> bool;        // default: true
        fn identity_at_defaults(&self) -> bool;  // default: true
        fn idempotent_at_defaults(&self) -> bool; // default: true
        fn describe(&self) -> ParamSchema;
        fn process(&self, input: &PixelBuffer, params: &ParamValues,
                   ctx: &AdjustmentContext) -> Result<PixelBuffer, String>;
    }

    AdjustmentContext provides source_path, source_width/height, pipeline_index, and pipeline_length. The plugin does not know about zones, history, or the UI — only its input buffer and parameters.

    The behavioral flags (identity_at_defaults, idempotent_at_defaults) let the evaluator and test harness reason about plugin behavior without running them. Most plugins are identity at defaults (e.g. White Balance at 6500K produces no change). A few override to false (Monochrome at strength=1.0, CLAHE at strength=1.0).

  3.2 ZoneGeneratorPlugin

    trait ZoneGeneratorPlugin: Send + Sync {
        fn id(&self) -> &str;
        fn name(&self) -> &str;
        fn describe(&self) -> ParamSchema;
        fn generate(&self, source: &PixelBuffer, params: &ParamValues,
                    ctx: &ZoneContext) -> Result<ZoneOutput, String>;
        fn partition_labels(&self) -> Option<&[&str]>;  // default: None
    }

    generate() returns a ZoneOutput — either a single Mask(ZoneBuffer) for simple generators, or a Partition(ZonePartition) for multi-label generators like semantic segmentation. The partition_labels() method lets the UI show available labels before evaluation runs.

  3.3 SourcePlugin

    trait SourcePlugin: Send + Sync {
        fn id(&self) -> &str;
        fn name(&self) -> &str;
        fn describe(&self) -> ParamSchema;
        fn accepts(&self, extension: &str) -> bool;
        fn decode(&self, bytes: &[u8], params: &ParamValues) -> Result<PixelBuffer, String>;
    }

    Content-based dispatch: the registry iterates sources and calls accepts() to find the right decoder for a file extension.


4. Plugin Registry — The Lookup Table

  File: seer-editor/src/registry.rs

  PluginRegistry holds four HashMaps of boxed trait objects:

    struct PluginRegistry {
        adjustments: HashMap<String, Box<dyn AdjustmentPlugin>>,
        geometry: HashMap<String, Box<dyn AdjustmentPlugin>>,
        zone_generators: HashMap<String, Box<dyn ZoneGeneratorPlugin>>,
        sources: HashMap<String, Box<dyn SourcePlugin>>,
    }

  Geometry plugins share the AdjustmentPlugin trait (same process signature) but are registered separately and execute in Phase 1. They cannot accept zones.

  PluginRegistry::core() creates a registry with all 18 built-in plugins:

    Sources (2):    seer.source.standard (PNG/JPEG/TIFF), seer.source.raw (DNG/RAW)
    Geometry (3):   seer.crop, seer.rotate, seer.perspective
    Adjustments (8): seer.white-balance, seer.tone-curve, seer.color-mixer,
                     seer.monochrome, seer.clahe, seer.denoise, seer.sharpen, seer.clarity
    Zone generators (5): seer.zone.luminance, seer.zone.color-range, seer.zone.gradient,
                         seer.zone.brush, seer.zone.segmentation

  Lookup is by string ID: registry.adjustment("seer.white-balance"). The evaluator dispatches through these lookups at runtime.

  Convenience methods: adjustment_defaults(id) calls describe() then default_params() to produce a ParamValues ready for use. adjustment_schema(id) returns the raw ParamSchema. source_for_extension(ext) iterates sources to find one that accepts().


5. Concrete Plugins — How Processing Works

  Files: seer-editor/src/plugins/*.rs, seer-editor/src/processing/*.rs

  Every plugin follows the same pattern: a thin wrapper in plugins/ that implements the trait, delegating actual computation to a pure function in processing/. This separation keeps the trait implementation clean and the processing function independently testable.

  5.1 White Balance — The Simplest Example

    Plugin: plugins/white_balance.rs (73 lines)
    Processing: processing/white_balance.rs (441 lines)

    The plugin declares two Float params (temperature: 2000–12000K, tint: -1 to +1) and delegates to process_white_balance().

    The processing function:
    1. Short-circuits at defaults (6500K, tint 0) — returns input.clone().
    2. Builds a 3x3 color matrix: Rec. 2020 → XYZ → Bradford chromatic adaptation (target illuminant → D65) → XYZ → Rec. 2020. Temperature maps to CIE xy chromaticity via Planckian locus (< 4000K) or CIE daylight series (>= 4000K). Tint offsets the y chromaticity. kolor-64 provides the matrices and adaptation.
    3. Per pixel: matrix multiply. Values may exceed [0, 1] — input is already linear, so no gamma encode/decode is needed.

    The matrix is computed once per invocation, not per pixel.

  5.2 Plugin Pattern Summary

    All 8 adjustment plugins follow this pattern:

    - describe() returns a ParamSchema with typed descriptors.
    - process() extracts parameters via params.get("name").and_then(|v| v.as_float()).unwrap_or(default), builds any needed state (matrices, LUTs, kernels), then iterates pixels.
    - The processing function takes &PixelBuffer and a typed params struct, returns PixelBuffer.

    Notable differences:
    - Monochrome overrides identity_at_defaults() → false (strength=1.0 is visibly not identity).
    - CLAHE overrides both identity_at_defaults() and idempotent_at_defaults() → false.
    - Crop (geometry plugin) also overrides accepts_zone() → false and may change output dimensions.
    - ColorMixer uses ParamGroup to organize 11 parameters into collapsible UI sections.


6. Adjustment — The Pipeline Node

  File: seer-editor/src/adjustment.rs

  An Adjustment is the data structure that lives in the pipeline. It pairs a plugin_id with runtime state:

    struct Adjustment {
        id: AdjustmentId,     // UUID
        plugin_id: String,    // "seer.white-balance"
        name: String,         // "White Balance"
        params: ParamValues,  // HashMap<String, ParamValue>
        enabled: bool,
        zone: ZoneSource,     // default: Full
    }

  This is deliberately not an enum. The plugin_id is a string that references a registered plugin. Adding a new adjustment type requires no changes to this struct.

  AdjustmentId is a UUID, allowing stable references across serialization, undo/redo, and (future) multi-device sync.


7. Zone System — Masks and Compositions

  File: seer-editor/src/zone.rs

  Zones are the mechanism connecting semantic editing to the pipeline. They are document-level objects, not owned by individual adjustments.

  7.1 Zone Source — The Expression Tree

    Every adjustment carries a ZoneSource that determines where its effect applies:

      enum ZoneSource {
          Full,                                    // apply everywhere (default)
          Ref(ZoneId),                            // reference a generator or composition
          Boolean { op, left, right },            // Union (max), Intersect (min), Subtract (clamp(a-b))
          Inverted(Box<ZoneSource>),              // 1 - source
          PartitionLabel(ZoneId, String, f32),    // extract named label from partition, edge blur sigma
      }

    This is a recursive tree. A single adjustment can reference an arbitrarily complex combination of zones: Inverted(Boolean { Union, Ref(sky), Intersect(Ref(highlights), Ref(gradient)) }).

  7.2 Zone Entries — Generators and Compositions

    The zone registry (part of ZonePhase) holds ZoneEntry values:

      enum ZoneEntry {
          Generator { plugin_id, name, params },
          Composition(ZoneComposition { name, source: ZoneSource }),
      }

    Generators are backed by zone generator plugins. Compositions are named ZoneSource trees that reference other entries. This two-level structure lets a photographer define "sky highlights" once (a composition intersecting the sky partition with a luminance zone) and reference it from multiple adjustments.

  7.3 Zone Buffers

    ZoneBuffer is an f32 grayscale mask — one value per pixel, range [0, 1]. ZonePartition is a multi-label partition — u8 label indices plus a label name vector. extract_mask(label, edge_blur) converts a partition label to a ZoneBuffer with optional Gaussian blur on edges.

  7.4 Zone Evaluation

    evaluate_zone(source, zones, image, registry, class_map) recursively evaluates a ZoneSource tree:

    - Full: returns a buffer of all 1.0s.
    - Ref(id): looks up the ZoneEntry. For generators, dispatches through the registry to run the plugin's generate(). For compositions, recursively evaluates the composition's source.
    - Boolean: evaluates left and right, combines per-pixel (Union = max, Intersect = min, Subtract = max(a - b, 0)).
    - Inverted: evaluates inner, computes 1.0 - v per pixel.
    - PartitionLabel: evaluates the referenced generator (must produce a Partition), extracts the named label, applies Gaussian edge blur.

  7.5 Zone Blending

    blend_with_zone(input, adjusted, zone) combines an adjusted image with its input using the zone mask:

      output[i] = zone[i] * adjusted[i] + (1.0 - zone[i]) * input[i]

    This is called by the evaluator for every adjustment that has a non-Full zone.

  7.6 Safety — Cycles and Deletion

    would_cycle(target_id, proposed_source, zones) prevents circular composition references. simplify_after_deletion(source, deleted_id) rewrites a ZoneSource tree to remove references to a deleted zone: Union(A, deleted) becomes A, Ref(deleted) becomes None (caller falls back to Full).


8. Zone Generator Plugins — Producing Masks

  Files: seer-editor/src/zone_plugins/*.rs

  Five built-in generators, each implementing ZoneGeneratorPlugin:

  8.1 Luminance (zone_plugins/luminance.rs)

    Selects pixels by brightness. Params: range_low, range_high (0–1), feather (0–1). Per pixel: compute luminance using Rec. 2020 weights (0.2627R + 0.6780G + 0.0593B). Luminance is perceptually encoded via lum/(lum+1) before thresholding so that range_low/range_high feel uniform in scene-referred space. Apply Hermite smoothstep at both edges for soft falloff. Returns ZoneOutput::Mask.

  8.2 Color Range (zone_plugins/color_range.rs)

    Selects by hue and saturation. Params: hue_center (0–360), hue_range (0–180), saturation_min/max (0–1), feather. Converts to Oklch (via kolor-64), measures Oklch hue distance with wrapping (avoids discontinuity at 360 degrees), applies soft selection on chroma. Returns Mask.

  8.3 Gradient (zone_plugins/gradient.rs)

    Linear or radial gradient in normalized coordinates. Params: kind (Linear/Radial), start_x/y, end_x/y (0–1). Linear: project pixel onto start→end line. Radial: distance from midpoint. Pure geometry, does not read pixel values. Returns Mask.

  8.4 Brush (zone_plugins/brush.rs)

    Painted strokes stored as vector data. Params: strokes (Vec<BrushStroke>). Each stroke has points (x, y, pressure), radius (fraction of image diagonal), opacity. Rasterization: for each point, draw a soft circle with quadratic falloff (1 - (dist/r)^2), blend additively. Returns Mask.

  8.5 Semantic Segmentation (zone_plugins/semantic.rs)

    The AI zone generator. Returns ZoneOutput::Partition with four labels: sky, person, vegetation, structure. Maps the 150-class ADE20K model to these four photographic categories. If no ClassMap is available (segmentation has not run yet), falls back to a full-opacity mask.

    partition_labels() returns Some(&["sky", "person", "vegetation", "structure"]), allowing the UI to show these labels before inference runs.


9. EditGraph — The 5-Phase Document Model

  File: seer-editor/src/graph/mod.rs

  EditGraph is the central data structure. It composes five typed phase sub-structs:

    struct EditGraph {
        source_phase: SourcePhase,       // Phase 0 (Condenser): source entries + merge strategy
        geometry_phase: GeometryPhase,   // Phase 1 (Linear): ordered GeometryNodes
        zone_phase: ZonePhase,           // Phase 2 (Linear): zone registry
        adjustment_phase: AdjustmentPhase, // Phase 3 (Linear): ordered Adjustments
        output_phase: OutputPhase,       // Phase 4: output groups with child nodes
    }

  Phase ordering is structural: the evaluator accesses geometry_pipeline() before pipeline(). There is no way to run adjustments before geometry.

  9.1 Phase Sub-Structs

    Each phase module (graph/source_phase.rs through graph/output_phase.rs) defines a struct with:
    - A collection of nodes (HashMap<Id, Node> for random access)
    - An ordered pipeline (Vec<Id> for execution order)
    - CRUD methods: add, remove, reorder

    SourcePhase is a Condenser: it holds a Vec of SourceEntry (each with id, plugin_id, path, width, height) and a MergeStrategy enum (Single, Integrate, Mosaic, MaskedOverlay). Each merge strategy carries its own per-source geometry: MosaicPlacement has translate/scale/rotation for tile alignment, IntegrationEntry has sub-pixel translate and rotation for jitter correction, and OverlaySpec has full affine transform fields for positioning inserts. For the common single-source case, entries has one element and merge is Single (no per-source geometry needed). Convenience methods (plugin_id(), path(), width(), height()) delegate to the primary (first) entry.

    Phase topology metadata is defined in graph/phase_topology.rs. A PhaseTopology enum (Condenser, Linear, Diffuser) and a static PHASES constant describe the connectivity shape of each phase. The UI uses this to render topology-appropriate layouts.

  9.2 Cross-Phase Operations

    EditGraph provides methods that span phases:

    - set_adjustment_zone(adjustment_id, zone_source): links an adjustment (Phase 3) to a zone (Phase 2).
    - remove_zone(id): removes from ZonePhase, then cascades — simplifies all compositions and adjustment zone sources that referenced it.
    - zone_dependents(zone_id): finds all adjustments and compositions that reference a zone, transitively through composition chains.

  9.3 Combos

    add_adaptive_bw(registry) is a compound operation that demonstrates the full model. It creates:

    1. A seer.zone.segmentation zone generator
    2. Monochrome adjustment (BW conversion, weighted luminance)
    3. CLAHE adjustment (local contrast)
    4. ToneCurve with S-curve (global contrast)
    5. Three region-specific ToneCurves, each zoned via PartitionLabel to sky (darken), person (lift), vegetation (brighten)

    This single method call creates 6 adjustments and 1 zone generator, with three of the adjustments referencing the zone via PartitionLabel with edge blur=5.0.

  9.4 Serialization

    EditGraph derives Serialize/Deserialize. A typical snapshot is 5–15 KB of JSON. The version tree stores one complete snapshot per node.


10. Pipeline Evaluator — Streaming Execution

  File: seer-editor/src/evaluate.rs

  PipelineEvaluator is the bridge between the declarative document model and imperative processing.

    struct PipelineEvaluator {
        last_output: Option<PixelBuffer>,
        dirty: bool,
    }

  10.1 Evaluation Flow

    evaluate(graph, source_buffer, registry, class_map) runs the full pipeline:

    Phase 1 — Geometry:

      Iterates graph.geometry_pipeline(). For each enabled node, dispatches through the registry: plugin.process(input, params, ctx). Disabled nodes pass through. Output becomes the "canonical canvas" — all downstream operations work on these dimensions.

    Phase 3 — Adjustments:

      Iterates graph.pipeline(). For each enabled adjustment:

      1. Dispatch: plugin = registry.adjustment(adj.plugin_id). Call plugin.process(input, params, ctx).
      2. Zone blending: if adj.zone is not Full, evaluate the zone source tree into a ZoneBuffer, then blend: output = zone * adjusted + (1 - zone) * input.
      3. The output becomes the input for the next adjustment.

    Streaming: only the current node's input and output buffers are alive at once. O(1) memory relative to pipeline length.

  10.2 Error Handling

    Fail-fast: the first plugin error breaks the pipeline. The EvalResult contains:
    - output: the partial result up to the failed node (so the UI can display something).
    - error: Some((AdjustmentId, String)) identifying which adjustment failed and why.

    Failed evaluations are not cached. After fixing the problem and calling invalidate(), the next evaluate() recomputes from scratch.

  10.3 Caching

    Simple dirty-flag caching: last_output stores the final result. invalidate(graph, adjustment_id) or invalidate_all() set dirty=true. The next evaluate() recomputes; subsequent calls return the cached output.


11. Version Tree — History with Branching

  File: seer-editor/src/versioning/version_tree.rs

  Every mutation to the edit graph creates a new node in a version tree.

  11.1 Data Model

    struct VersionTree {
        nodes: HashMap<NodeId, VersionNode>,
        head: NodeId,
        redo_path: Vec<NodeId>,
        tags: HashMap<String, NodeId>,
        pending_group: Option<PendingGroup>,
    }

    struct VersionNode {
        id: NodeId,           // UUID
        parent: Option<NodeId>,
        children: Vec<NodeId>,
        label: String,        // "Adjust White Balance", "Add Monochrome", etc.
        snapshot: EditGraph,   // complete document state at this point
        steps: Vec<HistoryStep>,
        timestamp_ms: f64,
    }

    Each node holds a full EditGraph snapshot. This makes undo/redo/jump O(1): just swap the head pointer and restore the snapshot. The cost is ~5–15 KB per node, which is negligible for editing history.

  11.2 Group Lifecycle

    Mutations happen inside groups:

    1. begin_group(label, timestamp) — opens a pending group.
    2. record_step(mutation, label, snapshot, timestamp) — adds a step. Within a group, rapid parameter updates coalesce (same adjustment, same mutation type, within 30 seconds).
    3. end_group() — closes the group. Creates a tree node (or coalesces with the current head if conditions match).

    This prevents slider drags from creating hundreds of history entries. A continuous drag produces one node: "Adjust White Balance".

  11.3 Undo, Redo, Branching

    - Undo: moves head to its parent. Pushes the current node onto redo_path.
    - Redo: pops the last node from redo_path and moves head there.
    - Edit after undo: creates a new child of the current head, starting a new branch. Clears redo_path. No work is ever lost — the old branch remains in the tree.
    - Jump: moves head to any node directly.

  11.4 Tags

    Named bookmarks on any node. Stored as a HashMap<String, NodeId>. Tags are LWW registers designed for CRDT compatibility.

  11.5 Sidecar Persistence

    File: seer-editor/src/versioning/sidecar.rs

    The version tree serializes to a .seer JSON file alongside the source image. Loading a sidecar restores the complete history including all branches, tags, and snapshots.


12. Plugin Test Harness — The Behavioral Contract

  File: seer-editor/src/plugin_harness.rs

  A universal test framework validates every registered plugin against six contract rules:

    1. Identity: default parameters produce output approximately equal to input (when identity_at_defaults() is true).
    2. Determinism: same input and params yield bitwise identical output.
    3. Dimensions preserved: output size matches input (geometry plugins exempt).
    4. Finite values: no NaN or Inf in output.
    5. Range: values within [-1.0, 2.0] (reasonable HDR bounds).
    6. Idempotence: applying twice at defaults approximately equals applying once (when idempotent_at_defaults() is true).

  Macros generate individual #[test] functions per plugin (harness_white_balance, harness_tone_curve, etc.). The test image is a small 4x4 gradient with values in [0.1, 0.9] to avoid edge-case clamping. Schema validation checks that every parameter has a default and every group reference is valid.


13. WASM Bridge — Crossing the Boundary

  Files: seer-editor-wasm/src/lib.rs, seer-viewer-wasm/src/lib.rs

  13.1 Editor Bridge

    The WASM EditGraph struct wraps a single Session:

      struct EditGraph {
          session: Session,
      }

    Session (seer-editor/src/session.rs) composes VersionTree, PipelineEvaluator, PixelBuffer, PluginRegistry, and ClassMap. All mutation logic, validation, and history recording live in Session. The WASM bridge is a thin layer that:

    1. Parses UUID strings into typed IDs (WASM receives strings from JS).
    2. Delegates to the corresponding Session method.
    3. Converts the Rust result to a JsValue via serde-wasm-bindgen.

    DTO structs (AdjustmentInfo, ZoneInfo, VersionNodeInfo, etc.) and presentation helpers (humanize_zone_kind, capitalize) remain in the bridge — they are JS serialization concerns, not engine logic.

    History group lifecycle is managed by the JS caller via history_begin_group() / history_end_group(). Serialization uses serde-wasm-bindgen: Rust structs serialize directly to JS objects (not JSON strings), avoiding parse overhead.

  13.2 Viewer Bridge

    seer-viewer-wasm exposes ViewerState (pan/zoom controller) and a stateless compute_view_layout() function. ViewerState methods return ViewLayout objects with uv_scale and uv_offset arrays that the GPU shader consumes directly.


14. Viewer Math — Viewport, Pan, Zoom

  Files: seer-viewer/src/viewport.rs, viewer.rs, framer.rs, geometry.rs

  14.1 Geometry Primitives

    Point { x: f64, y: f64 }, Size { width: f64, height: f64 }, Rect { origin: Point, size: Size }. Top-left origin, +X right, +Y down. All f64 internally.

  14.2 Viewport Layout

    The key output is ViewLayout:

      struct ViewLayout {
          content_rect: Rect,        // where the image renders in canvas pixels
          frame_rect: Rect,          // full canvas area
          uv_scale: [f32; 2],        // shader parameter: how much of the texture is visible
          uv_offset: [f32; 2],       // shader parameter: where the visible region starts
      }

    compute_view_layout(content, canvas, zoom, pan) calculates the layout. At zoom=1 (contain-fit), the image fills the canvas with letterboxing. Panning offsets the content_rect. The uv_scale and uv_offset values map screen coordinates to texture UV coordinates in the fragment shader.

  14.3 ViewerState

    Stateful controller that enforces invariants:

      struct ViewerState {
          zoom: f64,        // relative to contain-fit
          pan: Point,       // in content-pixel coords
          content: Size,
          canvas: Size,
      }

    Methods: pan(dx, dy), zoom(delta, anchor_x, anchor_y), set_zoom(zoom), resize_canvas(w, h). Each returns a ViewLayout. Zoom is anchored to the mouse position. Pan is clamped to keep the image visible.

  14.4 FramerState

    Crop interaction controller. Defines a crop rectangle on the canvas, maps to content coordinates. Active when the user is in crop mode; otherwise ViewerState handles all interaction.


15. Web Worker — The Thread Boundary

  Files: src/lib/editor/pipeline-worker.ts, pipeline-worker-protocol.ts

  All WASM state lives in a dedicated web worker. The main thread never touches the EditGraph.

  15.1 Initialization

    The worker loads the WASM module at startup:

      wasmInit({ module_or_path: wasmUrl }).then(() => post({ type: 'ready' }));

    The main thread waits for the 'ready' message before sending any other commands.

  15.2 Message Protocol

    Two message types:

    Main → Worker:
      - init { imageBytes, path, timestamp } — create EditGraph from encoded image.
      - init-f32 { data, width, height, path, timestamp } — create from raw f32 data.
      - perform { label, actions[], seq } — mutation group.
      - undo / redo / jump-to { nodeId } — history navigation.
      - set-class-map { data, width, height } — segmentation result.
      - tag / untag { name } — version bookmarks.
      - attach-log { level, component, message, timestamp } — forward log entries.

    Worker → Main:
      - ready — WASM initialized.
      - state { source, pipeline, geometry, schemas, versionNodes, ... } — complete state snapshot.
      - pixels { data: Uint8Array, width, height, seq, error? } — evaluated image.
      - error { message } — unrecoverable error.

  15.3 The perform Flow

    The worker's perform handler is the central mutation path:

      graph.history_begin_group(label, timestamp);
      for (const action of actions) {
          applyAction(action, timestamp);  // add, remove, update, toggle, reorder, etc.
      }
      graph.history_end_group();
      sendState();           // broadcast updated pipeline, zones, history
      evaluateAndSend(seq);  // run pipeline, send pixel output

    applyAction() is a switch over 17 action types (add-adjustment, remove-adjustment, update-params, toggle, reorder-adjustment, add-geometry, set-zone, add-zone, apply-adaptive-bw, etc.), each calling the corresponding WASM method.


16. Pipeline Scheduler — rAF Coalescing & Latest-Wins

  File: src/lib/editor/pipeline-scheduler.ts

  PipelineScheduler sits between the UI and the Worker. It solves two problems: batching rapid slider updates and dropping obsolete requests.

  16.1 rAF Coalescing

    When the user drags a slider, parameter updates fire at mouse-move frequency (60–120 Hz). The scheduler batches them:

      private pending: Map<string, Action> = new Map();  // keyed by adjustment ID

      perform(label, actions): void {
          if (all actions are update-params) {
              for (const action of actions)
                  this.pending.set(action.id, action);  // latest value per adjustment
              if (this.rafId === null)
                  this.rafId = requestAnimationFrame(() => this.flush());
              return;
          }
          // Non-coalescable: flush immediately
          const flushed = this.cancelPending();
          this.sendPerform(label, [...flushed, ...actions]);
      }

    On the next animation frame, flush() collects all pending actions and sends a single perform message to the Worker. Non-update actions (add, remove, reorder) flush immediately to ensure correct ordering.

  16.2 Latest-Wins Queueing

    Three-state machine: idle → evaluating → queued.

      sendPerform(label, actions): void {
          if (this.evalState === 'evaluating' || this.evalState === 'queued') {
              this.queued = { label, actions };  // replaces any prior queued request
              this.evalState = 'queued';
              return;
          }
          this.evalState = 'evaluating';
          this.seq++;
          this.send({ type: 'perform', label, actions, seq: this.seq });
      }

    When pixels arrive, the scheduler checks for a queued request and sends it. If a newer request has already been queued, the intermediate result is used for display but the next evaluation uses the latest parameters.

  16.3 Stale Result Filtering

    Each perform message carries a sequence number. When pixels arrive, the scheduler discards results with seq < this.seq — they were superseded by a newer request.

  16.4 History Operations

    Undo, redo, and jump bypass coalescing entirely: they cancel any pending rAF, clear the queue, and send directly to the Worker. This ensures history navigation is immediate.


17. WebGPU Renderer — Pixels to Screen

  Files: src/lib/viewer/renderer.ts, src/lib/viewer/shaders.ts

  17.1 GPU Pipeline Setup

    Renderer.init(canvas) requests a WebGPU adapter and device, configures the canvas context with format 'rgba8unorm', and creates:

    - A viewport uniform buffer (16 bytes: 2x vec2f for uv_scale and uv_offset).
    - A sampler with linear filtering.
    - A bind group layout with three entries: sampler, texture, uniform buffer.
    - A render pipeline using the vertex and fragment shaders.

  17.2 Shaders

    Vertex shader: fullscreen triangle technique. Three vertices at (-1,-1), (3,-1), (-1,3) cover the entire clip space; the GPU clips the excess. No vertex buffer needed — vertex positions are computed from vertex_index.

    Fragment shader: remaps screen UV to image UV using the viewport uniform:

      let image_uv = (uv - viewport.uv_offset) / viewport.uv_scale;

    Samples the texture at clamped coordinates. Pixels outside the image region render as black background.

  17.3 Texture Upload

    loadPixels(data, width, height) receives the Uint8Array (RGBA u8) from the evaluated pipeline output. Creates a GPU texture and uploads via writeTexture(). Handles downsampling if the image exceeds GPU max texture dimensions (typically 16384x16384).

  17.4 Render Loop

    render() creates a command encoder, begins a render pass (clear to black), draws 3 vertices (the fullscreen triangle), and submits. The bind group provides the sampler, texture, and viewport uniform.

    updateViewportUniform(layout) writes the ViewLayout's uv_scale and uv_offset to the GPU buffer, positioning the image on screen according to the current pan/zoom state.

  17.5 Device Sharing

    getDevice() and getTextureView() let the minimap renderer share the same GPU device and texture, avoiding duplicate GPU resources.


18. Editor UI — Svelte 5 Orchestration

  File: src/lib/editor/Editor.svelte

  The editor is a three-panel layout: zones (left), canvas (center), processing + history (right).

  18.1 Setup Flow

    On mount, setup() runs:

    1. Create Renderer, initialize WebGPU.
    2. Create PipelineScheduler (spawns Web Worker).
    3. Wait for Worker readiness (WASM module loaded).
    4. Send image bytes to Worker via scheduler.init().
    5. Worker decodes image, evaluates empty pipeline, sends back state + pixels.
    6. Main thread loads pixels to GPU via renderer.loadPixels().
    7. Initialize ViewerState (viewport WASM) with content and canvas dimensions.
    8. Render first frame.

  18.2 State Management

    No external state management library. Svelte 5 runes ($state, $derived) hold all UI state directly. The scheduler callbacks (onState, onPixels) update reactive state, triggering UI re-renders automatically.

    onState() receives the complete pipeline, zones, history, and schemas from the Worker. onPixels() receives the evaluated image as a Uint8Array, uploads to GPU, and re-renders.

  18.3 Event Handling

    All user actions route through scheduler.perform():

    - Slider change → perform('Adjust', [{ type: 'update-params', id, params }])
    - Toggle adjustment → perform('Toggle', [{ type: 'toggle', id, enabled }])
    - Add adjustment → perform('Add', [{ type: 'add-adjustment', pluginId }])
    - Reorder → perform('Reorder', [{ type: 'reorder-adjustment', id, newIndex }])

    Pan/zoom events are handled locally by ViewerState (no Worker round-trip needed). When crop mode is active, events route to FramerState instead.

  18.4 Keyboard Shortcuts

    Ctrl+Z / Cmd+Z: scheduler.undo(). Ctrl+Shift+Z / Cmd+Shift+Z: scheduler.redo().


19. Segmentation Pipeline — AI Meets Manual Control

  File: src/lib/editor/segmentation.ts

  Semantic segmentation runs once after the first pipeline output arrives.

  19.1 Inference

    Uses SegFormer B0 via onnxruntime-web. The model is lazy-loaded from a static asset path. Input is resized to 512x512 for inference (the model's native resolution). Output is a low-resolution class map (typically 128x128).

  19.2 Class Map Delivery

    The class map (Uint8Array of ADE20K label indices) is sent to the Worker via scheduler.setClassMap(data, width, height). The Worker stores it in the WASM EditGraph. On next evaluation, zone generators that need semantic data receive it through ZoneContext.class_map.

  19.3 Upscaling

    The 128x128 class map is upscaled to full image resolution in Rust (bilinear_resize in zone.rs). This avoids allocating a 60 MB buffer (for a 60 MP image) in JavaScript.

  19.4 Integration with Zones

    When an adjustment has a PartitionLabel zone source (e.g. PartitionLabel(seg_id, "sky", 5.0)), the evaluator calls the semantic zone generator, which produces a ZonePartition from the class map. extract_mask("sky", 5.0) creates a binary mask for the "sky" label with 5.0-sigma Gaussian edge blur. The adjustment applies only where this mask is non-zero.


20. End-to-End Data Flow

  To tie everything together, here is the complete path from user action to rendered pixel:

  1. User drags a White Balance temperature slider.

  2. Svelte event handler calls scheduler.perform('Adjust', [{ type: 'update-params', id: wbId, params: { temperature: { Float: 7500 } } }]).

  3. Scheduler sees this is a coalescable update-params. Stores in pending map keyed by wbId. Requests rAF if not already pending.

  4. Next animation frame: scheduler.flush() collects all pending actions. Calls sendPerform(). Since evalState is 'idle', sends perform message to Worker with seq=N.

  5. Worker receives perform message. Calls graph.history_begin_group("Adjust", ts). Calls graph.update_adjustment_params(wbId, params, ts) — records a HistoryMutation::UpdateParams step with before/after parameter diff. Calls graph.history_end_group() — coalesces with previous slider moves within 30-second window.

  6. Worker calls graph.evaluate(). The PipelineEvaluator iterates the pipeline:
     a. For each enabled adjustment, dispatches through PluginRegistry.
     b. WhiteBalancePlugin.process() builds a Bradford adaptation matrix for 7500K and applies it per-pixel.
     c. If the WB adjustment has a zone, evaluates the zone and blends.
     d. Passes output to the next adjustment.

  7. Worker sends two messages:
     - state: complete pipeline, zones, history, schemas.
     - pixels: Uint8Array (RGBA u8 from to_rgba_u8()), width, height, seq=N.

  8. Main thread handlePixels() checks seq >= this.seq (not stale). Calls onPixels callback.

  9. onPixels calls renderer.loadPixels(data, width, height) — creates GPU texture, uploads via writeTexture.

  10. renderer.updateViewportUniform(layout) — writes current pan/zoom uv_scale/uv_offset.

  11. renderer.render() — clears canvas to black, draws fullscreen triangle. Fragment shader samples texture at viewport-transformed UV coordinates. Image appears on screen.

  The user sees the warmer image.


21. CLI — Shell-Native Pipeline

  Files: seer-cli/src/

  The CLI binary provides the same editing capabilities as the GUI via composable shell commands. It delegates all logic to Session.

  21.1 Architecture

    The CLI has four layers:

    - cli_gen.rs: builds the complete clap Command tree at runtime from the PluginRegistry. Static commands (open, save, inspect, plugins) are hand-coded; plugin subcommands are auto-generated from ParamSchema.
    - param_parse.rs: converts clap ArgMatches into typed ParamValues. Each ParamType maps to a parsing strategy: Float/Int via clap's built-in parsers, Bool via flag presence, Choice via label-to-value mapping, and complex types (Color, Curve, Point, Rect) via comma-separated string parsing.
    - pipe.rs: the PipeEnvelope — a JSON object with protocol version, source path, and serialized VersionTree. read_envelope() and write_envelope() handle serialization and call post_load() to restore ephemeral VersionTree state.
    - commands/: one module per command (open, save, inspect, plugins, apply_plugin, apply_sidecar, zone, presets). Each takes parsed args + reader/writer and returns Result, making them testable without process spawning.

  21.2 Pipe Flow

    seer-cli open photo.png | seer-cli white-balance --temperature 7500 | seer-cli save result.jpg

    1. open: decodes the image via Session::open(), closes the "Open Image" group, writes PipeEnvelope JSON to stdout.
    2. white-balance: reads envelope from stdin, creates Session from VersionTree, calls add_adjustment + update_adjustment_params within a history group, writes updated envelope.
    3. save: reads envelope, creates Session, calls evaluate(), encodes to PNG/JPEG via PixelBuffer::encode_to_png/jpeg(), writes the file.

    Between stages, only the VersionTree JSON flows (~10-100 KB). The source image is decoded once by save, not by intermediate stages.

  21.3 Plugin Dispatch

    When clap matches a subcommand that is not a static command (open, save, etc.), main.rs dispatches to apply_plugin::dispatch(). This function:

    1. Resolves the command name to a plugin ID (e.g. "white-balance" to "seer.white-balance").
    2. Looks up the plugin's ParamSchema.
    3. If --preset was given, loads the preset as a base ParamValues.
    4. Parses explicit CLI flags via args_to_param_values(), merging over the preset.
    5. If --zone or --zone-inline was given, binds the adjustment to a zone.
    6. Writes the updated envelope.

  21.4 Presets

    Built-in presets are hardcoded in presets.rs (e.g. white-balance: tungsten at 3200K, daylight at 5600K). User presets are JSON files in ~/.config/seer/presets/<plugin-name>/. User presets shadow built-in presets of the same name.

    Preset resolution: load base ParamValues from preset, then overlay any explicit CLI flags. This means --preset tungsten --tint 0.1 starts from 3200K and adds tint.

  21.5 Zones in CLI

    Zone generators are added via seer-cli zone <generator> --name <name>. Compositions use seer-cli zone compose --op union --left a --right b --name c. Adjustments reference zones by name via --zone <name>.

    For one-off zones, --zone-inline luminance:range_low=0.7,range_high=1.0 creates an anonymous zone and binds it to the adjustment in a single command.
