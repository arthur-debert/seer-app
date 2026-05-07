Arami Walk-Through

This document is for technical contributors, both human and AI agents. It covers the vision, user needs, design decisions and architecture of Arami. We deliberately include the _why_ behind decisions: without this context, contributors (especially agents) quickly make choices that contradict the project's goals.

  It mixes current state and future plans in one document rather than maintaining two that lose context against each other. Where something is planned but not yet implemented, we say so explicitly.

  It is not a source code reference or API listing. It goes deep enough to convey the conceptual model (web workers, data types, phase ordering) but stops short of implementation detail. For that, see the spec docs under [./specs/].


1. Vision

  Arami is a photo editing application for pro-grade editing, from raw files to final outputs. It is not a drop-in replacement for LightRoom, DarkTable or CaptureOne. It is an opinionated exploration of a different paradigm: a zone-first editing workflow, a portable execution model, and a pluggable pipeline where application order is always explicit.

  1.1 Semantic Editing

    Traditional photo editors are tools-first: pick a tool, then decide where it applies. Photographers think the other way around. They see regions of meaning in the image: the sky needs darkening, the subject needs lifting, the foliage needs separation. The regions come first. The adjustments follow.

    Arami makes this inversion explicit. Zones are the primary organizing concept. An adjustment is a verb applied to a zone, not the other way around. The question is not "which adjustment am I editing?" but "which part of the image am I working on?"

    At the lowest level, zones can be defined by pixel properties: luminance ranges, color ranges, linear gradients, or hand-painted brush strokes. These are useful and familiar. But the distinctive feature is semantic segmentation: Arami runs a neural network (SegFormer, via ONNX) to partition the image into photographic regions (sky, person, vegetation, structure), then lets the photographer target adjustments at those regions directly. A tone curve can apply only to the sky. A different curve can apply only to people. The photographer defines intent; the system handles the pixel-level masking.

    This is not a black box. Arami bridges consumer-grade magic (all-or-nothing AI output) and pro-grade control (manual pixel masks). Semantic zones are a starting point. The photographer can refine them with boolean operations (union, intersect, subtract, invert), combine them with property-based zones, or drop down to brush-level painting. The goal is to automate the tedious parts while keeping full creative control available.

    _Current state:_ segmentation runs in-browser via SegFormer B0 (ONNX). Four photographic categories are produced (sky, person, vegetation, structure), mapped from the 150-class ADE20K model. Adjustments target regions via PartitionLabel zone sources with configurable edge blur. The Adaptive B&W combo demonstrates the full workflow. The broader vision of natural-language-style intent ("burn the background a bit") remains aspirational.

  1.2 Run Anywhere

    Photographers work on a desktop workstation at home, a laptop on a trip, a tablet on a couch. Arami is designed so that the same editing experience is available across devices and form factors: desktop apps, web browser, and eventually mobile.

    Photo libraries are large. A cloud-only storage model makes for a poor experience in the most common case: local work on your own machine. Hence, Arami separates three concerns that traditional editors conflate:

    - Client: the UI rendering and interaction layer.
    - Execution: the Rust backend that runs the pipeline. It can be compiled to WASM and shipped inside the client, or (planned) run as a local server process or remote API.
    - Storage: wher  image files and edit sidecars live. Local disk today, with pluggable cloud backends planned.

    This separation means multiple clients can operate on the same data. That introduces the possibility of conflicts, which is addressed through the version tree and CRDT-compatible data model described in [#2.5].

    _Current state:_ Arami runs as a Tauri desktop app. All Rust computation is WASM-compiled and executed in a web worker inside the browser view. Server mode, mobile clients, and cloud storage are not yet implemented. The architecture supports them but only the Tauri + WASM-in-browser configuration works today.


2. Architecture

  2.1 The 5-Phase Pipeline

    Image processing operations are not commutative. Application order changes results. Most photo editors hide this behind implicit, opaque ordering, forcing the user to guess or experiment. Arami makes order explicit everywhere: in the data model, the serialized sidecar, the evaluator, and the UI.

    The document is a strictly ordered pipeline of five phases:

    0. Source (Condenser): one or more source images with a merge strategy that condenses them into a single pixel buffer. Supports multiple use cases: single image (the common case), astrophotography stacking (multiple exposures integrated via mean/median/sigma-clip), panorama mosaics (positioned tiles stitched into one canvas), and masked composites (a base image with secondary images applied via zone masks). The merge strategy executes at the exit of the phase, producing a single buffer for downstream processing.
    1. Geometry (Linear): spatial transforms that establish the canonical canvas. No downstream phase may alter dimensions. Built-in: crop, rotate, perspective.
    2. Zones (Linear): mask generators and compositions, evaluated on canonical canvas coordinates. Described in detail in [#2.2].
    3. Adjustments (Linear): tonal and color pixel processing, each with a zone mask (the default mask is Full — an identity mask, but the interface is homogeneous). Eight built-in: white balance, tone curve, color mixer, monochrome, CLAHE, denoise, sharpen, clarity.
    4. Output (Diffuser): color profile conversion, scaling, and encoding. One adjusted pixel buffer fans out to multiple independent output groups, each with its own encoder, resize, reframe, and metadata configuration. This lets a photographer produce an Instagram story, a YouTube thumbnail, and a print version from a single edit.

    Within each phase, nodes are user-reorderable. Between phases, ordering is enforced structurally: the EditGraph struct contains typed phase sub-structs, and the evaluator processes them in fixed order. Phase boundary violations are compile-time errors.

    2.1.1 Why a Linear Pipeline

      A general-purpose node graph (DAG) is the obvious alternative. We reject it deliberately. Photo editing is overwhelmingly sequential. A linear pipeline with version branching achieves the vast majority of a DAG's power with dramatically simpler UX, caching, and implementation:

      - The UI maps directly: a vertical list of panes, top to bottom, is the application order. No spaghetti wires.
      - Streaming evaluation is straightforward: one input buffer, one output buffer, O(1) memory relative to pipeline length.
      - Caching is simple: invalidate from the changed node forward.
      - Serialization is a flat list, not a graph with arbitrary topology.

      The pipeline is not a graph. The name EditGraph refers to the document model (which includes zones, versions, and metadata), not to a DAG topology.

    2.1.2 Phase Topology

      While the pipeline is linear overall, individual phases have different connectivity shapes — their _topology_:

      - Condenser (N→1): multiple inputs merge into a single output. Source phase: multiple image files condense into one pixel buffer via a merge strategy.
      - Linear (1→1): one input, one output, nodes applied sequentially. Geometry, Zones, and Adjustments.
      - Diffuser (1→N): one input fans out to multiple independent outputs. Output phase: one adjusted buffer produces multiple renditions.

      Each phase declares its topology via a static PhaseInfo descriptor (index, name, topology). The UI uses this to render phase-appropriate layouts without hardcoding knowledge of specific phases. The topology is fixed per phase type — Source is always Condenser, Output is always Diffuser, the middle three are always Linear.

      _Current state:_ PhaseTopology enum and PHASES constant are defined. The UI wraps each phase in a PhasePane component with data-topology attributes. Future iterations will use topology to drive more sophisticated node-graph-style layouts for Condenser and Diffuser phases.

  2.2 Zones

    Zones are the mechanism that connects the semantic editing vision [#1.1] to the pipeline [#2.1]. They are document-level objects: defined once, stored in the edit graph, and referenceable by any number of adjustments. This is a deliberate separation from the common pattern where masks are owned by individual adjustments.

    Why document-level:

    - Reuse: a "sky" zone can drive a tone curve, a color mixer, and a sharpen adjustment simultaneously. The photographer defines "sky" once.
    - Stability: deleting an adjustment that references "sky" does not delete the zone. Zones belong to the document.
    - Consistency: when two adjustments reference the same zone, they affect the same pixels. No risk of drift between independently painted masks.

    2.2.1 Zone Generators

      Five built-in generators, each a ZoneGeneratorPlugin:

      - Luminance: selects pixels by brightness range with feathering.
      - Color Range: selects by HSL hue and saturation with feathering.
      - Gradient: linear or radial gradient in normalized coordinates.
      - Brush: vector-based painted strokes (points, radius, opacity per stroke).
      - Semantic Segmentation: runs SegFormer inference to produce a multi-label partition (sky, person, vegetation, structure). Individual labels are extracted via PartitionLabel with configurable edge blur.

    2.2.2 Compositions

      Zones compose via a ZoneSource expression tree:

      - Full: adjustment applies everywhere (the default, no masking).
      - Ref: reference a single zone generator.
      - Boolean: union (max), intersect (min), or subtract (clamp(a - b)) of two zone sources.
      - Inverted: one minus the source.
      - PartitionLabel: extract a named label from a partition generator with edge blur.

      Cycle detection prevents circular references. When a zone is deleted, compositions that reference it simplify automatically (e.g. Union(A, deleted) becomes A).

    2.2.3 Evaluation

      Zones are evaluated lazily during the adjustment phase. When an adjustment has a non-Full zone, the evaluator rasterizes the zone source tree into a per-pixel mask, runs the adjustment plugin on the full image, then blends: output = zone * adjusted + (1 - zone) * input.

  2.3 Plugins

    All built-in operations are implemented as plugins using the same trait API available to third parties. The core design is plugin-independent: the evaluator, the history system, the UI, and the serialization layer know nothing about specific adjustments or zone generators. They work with trait objects and parameter maps.

    2.3.1 Extension Types

      Six plugin traits exist today:

      - SourcePlugin: decodes file bytes into a PixelBuffer. Declares which file extensions it handles. Two built-in: standard image formats (PNG, JPEG, etc.) and RAW/DNG via libraw.
      - ZoneGeneratorPlugin: produces a ZoneOutput (single mask or multi-label partition) from a source image and parameters. Five built-in, listed in [#2.2.1].
      - AdjustmentPlugin: transforms a PixelBuffer given parameters and an AdjustmentContext. Declares a category (Color, Tone, Detail, Creative, Correction, AI), whether it accepts zones, and behavioral metadata (identity at defaults, idempotence). Eight built-in.
      - Geometry plugins: use the AdjustmentPlugin trait but are registered separately and live in phase 1. Three built-in: crop, rotate, perspective.
      - OutputPlugin: encodes a PixelBuffer into file bytes (the inverse of SourcePlugin). Declares which file extensions it handles. Five built-in: PNG, JPEG, WebP, TIFF, AVIF.
      - OutputChildPlugin: declarative child nodes within an output group. They declare a ParamSchema so the host auto-generates UI and CLI, but do not process pixels themselves — the host interprets their ParamValues during export. Three built-in: resize, reframe, metadata.

      One additional extension type is designed but not yet implemented:

      - Storage (planned): pluggable blob storage backends (list, read, write, delete, metadata). Would enable S3-compatible cloud, Google Photos, DAM integrations.

    2.3.2 Parameter Schema

      Each plugin declares a ParamSchema: a list of typed parameter descriptors (float with range and step, int, bool, choice, color, curve, 2D point, rectangle, brush strokes, string) with optional visual grouping. The host auto-generates UI controls from this schema. At runtime, parameters are a flat HashMap of ParamValues.

      This decoupling is key to extensibility: a new plugin needs only to declare its schema and implement process() or generate(). The host handles everything else: UI rendering, parameter storage, zone blending, history tracking, serialization, caching.

    2.3.3 Plugin Harness

      A universal test harness validates every registered plugin against a behavioral contract:

      1. Identity: default parameters produce output approximately equal to input.
      2. Determinism: same input and params yield bitwise identical output.
      3. Dimensions preserved: output size matches input (geometry plugins exempt).
      4. Finite values: no NaN or Inf in output.
      5. Range: values within reasonable HDR bounds (-1.0 to 2.0).
      6. Idempotence: applying twice at defaults approximately equals applying once.

      These rules run as standard Rust tests. Every core plugin has a generated harness test. Third-party plugins would run through the same checks.

    2.3.4 Future Integration Models

      Today, the only integration path is implementing a Rust trait and compiling it into the binary. Two additional models are designed but not yet implemented:

      - WASM plugin runtime (planned): third-party plugins as .wasm modules loaded via Wasmtime, with WIT interface contracts per extension type and a .aramiplugin package format. WASM fuel metering would provide timeout guarantees.
      - Native process plugins (planned): C/C++ code running as a sandboxed child process with shared-memory pixel exchange. This lowers the barrier for researchers with existing C implementations. OS-level sandboxing (sandbox-exec on macOS, seccomp-bpf on Linux) and resource limits (RLIMIT_CPU, RLIMIT_AS) would contain untrusted code.

  2.4 Execution Model

    Arami splits the application into two layers with a hard boundary between them:

    - Frontend: Svelte 5 UI. Handles rendering, user interaction, and layout. Contains no image processing logic, no pipeline state, no adjustment math.
    - Backend: Rust crates compiled to WASM. Contains all pipeline logic, all image processing, the version tree, zone evaluation, and plugin dispatch.

    This split serves several goals:

    - Testability: Rust code has comprehensive unit tests (600+ across two core crates). Frontend tests are lightweight E2E checks, not logic tests.
    - Portability: the same Rust backend can target WASM (browser), native (Tauri, server), or mobile. The frontend can be replaced without touching core logic.
    - Stability: framework churn (bundlers, module systems, UI kits) stays contained in the thin frontend layer. The Rust core can be maintained for a decade without framework migration pressure.

    2.4.1 Web Workers and Scheduling

      The pipeline runs in a dedicated web worker, completely off the main thread. The WASM-compiled EditGraph lives in the worker; the main thread never touches it directly.

      Communication follows a typed message protocol. The main thread sends actions (add adjustment, update params, undo, redo). The worker mutates the graph, runs evaluation, and sends back pixel data plus state snapshots.

      The pipeline scheduler on the main thread implements rAF coalescing: when the user drags a slider, rapid parameter updates are batched per animation frame. Only the latest value for each adjustment is sent. If the worker is still evaluating when a new batch arrives, the pending request is queued with latest-wins semantics. This keeps the UI responsive during intensive edits without flooding the worker.

    2.4.2 Frontend Philosophy

      We deliberately keep the frontend lean. Svelte 5 with reactive runes, no external state management library, Tailwind for styling. Component state uses $state and $derived directly. The TypeScript layer is thin glue: it relays user actions to the worker and renders the results.

      This is a balancing act. Frameworks give us much for free and we leverage their power, but we keep framework-dependent code contained so it does not leak into core logic. The goal is that a framework upgrade or replacement is a UI-layer task, not a full rewrite.

    2.4.3 Rust Crates

      The backend is organized as five crates:

      - arami-editor: the 5-phase pipeline, plugin traits and registry, evaluator, version tree, Session API, all processing functions. Pure Rust, no WASM dependencies, compiles to both native and wasm32.
      - arami-viewer: viewport math, pan/zoom, tiled rendering coordinates.
      - arami-editor-wasm: thin wasm-bindgen bridge over arami-editor. Delegates to Session for all mutation and evaluation logic; handles only UUID parsing and JS serialization.
      - arami-viewer-wasm: thin wasm-bindgen bridge over arami-viewer. Exposes ViewerState and FramerState.
      - arami-cli: shell-native CLI binary. Auto-generates subcommands from plugin ParamSchema, pipes VersionTree JSON between stages, delegates to Session for all logic. See [#2.6].

    2.4.4 Rendering

      The edited image is rendered to screen via WebGPU. A Renderer class initializes a GPU device, uploads the evaluated pixel buffer as a texture, and draws it with a fullscreen triangle shader that applies the current viewport transform (pan, zoom). Tiled pyramid rendering is supported for large images.

  2.5 Versioning and Sync

    2.5.1 Version Tree

      Every mutation to the edit graph creates a new node in a version tree. Each node stores a complete snapshot of the EditGraph (typically 5-15 KB) plus a human-readable label describing the action. The tree supports:

      - Undo and redo: linear navigation along the current branch.
      - Branching: editing after an undo creates a new branch. No work is ever lost.
      - Named tags: persistent labels on any node (e.g. "BW attempt", "final crop").
      - Coalescing: rapid parameter updates within a 30-second window merge into a single node, so dragging a slider does not create hundreds of history entries.
      - Jump: click any node in the history pane to restore that state instantly.

    2.5.2 Sidecar Persistence

      The version tree serializes to a .arami JSON sidecar file alongside the source image. The sidecar contains the full tree (all nodes, branches, tags, snapshots). Loading a sidecar restores the complete editing history. The format supports legacy migration from older flat EditGraph sidecars.

    2.5.3 Sync and Conflict Resolution (Planned)

      The version tree is designed with CRDT compatibility in mind, anticipating multi-device sync:

      - Node IDs are UUIDs, avoiding collision across devices.
      - Nodes are immutable once created, forming an append-only, grow-only set.
      - Tags map as LWW (last-writer-wins) registers.
      - The adjustment pipeline maps as a List CRDT, with per-parameter LWW registers.

      Tree convergence works by set union: if device A has nodes {1, 2, 3} and device B has {1, 2, 4}, merging produces {1, 2, 3, 4} with branches preserved.

      The transport layer, device identity, and conflict resolution UI are not yet implemented. When they are, non-conflicting edits will auto-merge (a crop on one device does not invalidate a tone curve on another). Conflicting edits will prompt the user to choose, using the version comparison tool with image previews.

  2.6 CLI and Scripting

    The same engine that powers the GUI is available from the command line. The CLI is not a separate reimplementation — it translates shell arguments into the same EditGraph mutations the GUI makes, then delegates to the same evaluator.

    2.6.1 Session — The Shared Engine API

      Session (arami-editor/src/session.rs) composes all engine state: VersionTree, PipelineEvaluator, PixelBuffer, PluginRegistry, and ClassMap. It provides a pure-Rust API that any frontend uses without touching serialization or framework-specific types.

      The WASM bridge wraps Session with wasm-bindgen methods that parse UUIDs from strings and serialize results to JS objects. The CLI calls Session directly with Rust types. Both go through the same validation and history recording paths. Future adapters (HTTP API, Rhai scripting) would do the same.

      Every mutation method follows the same pattern: validate inputs, mutate the live graph, invalidate the evaluator cache, record a history step. This pattern is enforced once in Session rather than duplicated per frontend.

    2.6.2 Pipe Protocol

      CLI commands pipe a JSON envelope between stages. The envelope carries the protocol version, source image path, and the full VersionTree (identical to sidecar format). No pixel data flows through the pipe — only the editing description (~5-15 KB per stage).

      Evaluation is lazy: intermediate commands (arami-cli white-balance, arami-cli crop) only mutate the graph. The terminal command (arami-cli save) loads the source image, runs the pipeline, and encodes output. This keeps intermediate stages fast (~5ms per invocation).

    2.6.3 Auto-Generated CLI

      Each plugin's describe() method returns a ParamSchema with typed parameter descriptors. The CLI generator (arami-cli/src/cli_gen.rs) walks the PluginRegistry and builds clap subcommands at runtime. Adding a plugin to the registry automatically adds it to the CLI. Parameter types map to typed CLI flags: Float and Int get range-validated numeric args, Bool becomes a flag, Choice gets a constrained value set, and complex types (Color, Curve, Point, Rect) accept comma-separated strings or @file references.

    _Current state:_ The CLI binary (arami-cli) supports the full adjustment and zone pipeline, presets, inline zones, sidecar apply, and composable pipe chains. Daemon mode, Rhai scripting, and HTTP API are planned but not implemented.
