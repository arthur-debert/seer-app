User Interface

This document is the design brief for the Arami Application. The User Experience part is covered here [./user-experience.lex].
We will do the Desktop version first, as Arami is a new wave photo editor and many of our hypothesis need user feedback to validate, and Desktop will get us there faster (more in touch with the core domain, easier to iterate). 

Note that, menus and some integration layer aside, this refers to both the Desktop stand alone app and the web client for Desktop devices.

Modern & Clean

  While much of the architecture is user interactions are inspired by high end video effects / 3d / composition software (Maya, Nuke, Substance,  Houdini) this is a photo editing application (not even a generic image editing one like Photoshop), that is still, static.

  That is, we forgo the design language of these application (cluttered, computer hacker neon glow, grids , hard corners) in favor of a clean, minimal but bold design.

  The application will support both Light and Dark modes, and we will tackle Light mode first since it's will be easier not to follow the dark design language of the UX references we have.


  For pallet we will use (initial values)
    - #387DF5, #FF7F17, #F52C2C, #F7DD14, #1DAD3D, #972FDC
    - A regular gray pallet for UI (we can use something close to Svelte's )
  This is a primary color, Mondrian inspired (but with green added, very useful for UIS.)
  - Status Encoding Colors: 
    - #1DAD3D: Ok, success, all good.
    - #F52C2C: Error, issue to be fixed
    - #387DF5: Active
  - These are accents, helpful for giving clarity but do not carry a status meaning:
    - #972FDC
  For borders, when showing the active items, we can use a glow like gradient (like Svelte) turbo flow but with our colors https://svelteflow.dev/examples/styling/turbo-flow. 

Iconography

  Library: Material Symbols (via @iconify-json/material-symbols + unplugin-icons)

  Pipeline Adjustments (10 icons):
      | Key          | Symbol                           | Applied To              |
      | source       | material-symbols/image           | Source node in pipeline  |
      | whiteBalance | material-symbols/wb-auto         | White Balance adjustment |
      | toneCurve    | material-symbols/insights        | Tone Curve adjustment   |
      | colorMixer   | material-symbols/palette         | Color Mixer adjustment  |
      | monochrome   | material-symbols/monochrome-photos | Monochrome adjustment |
      | clahe        | material-symbols/equalizer       | CLAHE adjustment        |
      | denoise      | material-symbols/grain           | Denoise adjustment      |
      | sharpen      | material-symbols/blur-off        | Sharpen adjustment      |
      | clarity      | material-symbols/contrast        | Clarity adjustment      |
      | crop         | material-symbols/crop            | Crop (geometry)         |
  :: table ::

  Zone Kinds (5 icons):
      | Key           | Symbol                      | Applied To              |
      | zoneLuminance | material-symbols/brightness-6 | Luminance zone selector |
      | zoneColor     | material-symbols/colorize   | Color Range zone selector |
      | zoneGradient  | material-symbols/gradient   | Gradient zone selector  |
      | zoneBrush     | material-symbols/brush      | Brush zone selector     |
      | ai            | material-symbols/auto-awesome | Semantic/AI zone selector |
  :: table ::

  Semantic Zone Categories (4 icons):
      | Key           | Symbol                        | Applied To          |
      | segSky        | material-symbols/cloud        | Sky/water/mountains |
      | segPerson     | material-symbols/person       | People              |
      | segVegetation | material-symbols/eco          | Trees/grass/flowers |
      | segStructure  | material-symbols/location-city | Buildings/houses   |
  :: table ::

  UI Chrome (10 icons):
      | Key           | Symbol                         | Applied To                        |
      | undo          | material-symbols/undo          | Viewer toolbar                    |
      | redo          | material-symbols/redo          | Viewer toolbar                    |
      | history       | material-symbols/history       | History panel toggle              |
      | star          | material-symbols/star          | Add tag in history panel          |
      | add           | material-symbols/add           | Add adjustment in junction nodes  |
      | checkCircle   | material-symbols/check-circle  | Adjustment enabled toggle         |
      | circleOutline | material-symbols/circle-outline | Adjustment disabled toggle       |
      | globe         | material-symbols/public        | Full-image zone target            |
      | dragIndicator | material-symbols/drag-indicator | Pipeline drag handle             |
      | arrowRight    | material-symbols/arrow-right-alt | Separator between node and zone |
  :: table ::

  31 icons total across 13 component files (pipeline items, graph nodes, toolbar, history, zone panes).


Node Visual Design

  Nodes are the primary editing surface (see [./user-experience.lex] §4). Their visual design must support three verbosity states while remaining compact enough to keep the graph readable.

  1. Collapsed
    A single row: icon, node title, on/off toggle. No controls visible. Edges (connections to phase boundaries) remain.

  2. Default
    The node card expands to show the most-used controls for that node type. For simple nodes (1–2 parameters), this is all controls. For complex nodes (e.g. Color Mixer), this is a curated subset — typically the gains and saturation, not all 8 hue shifts.

  3. Expanded
    All controls are visible. Reached by clicking an expand affordance on the default card.

  Card Anatomy
    - Header: icon + title + on/off toggle + expand/collapse chevron (when applicable).
    - Body: controls laid out vertically, one per row. Grouped parameters (e.g. hue_shift_0..7) share a group label and are visually indented.
    - Footer (expanded only): reset-to-default action.

  This is driven by the plugin architecture: every plugin declares its parameters via a typed ParamSchema. The host auto-generates the appropriate control for each parameter type. Grouping and default/expanded membership are declared in the schema. Adding a new plugin requires zero UI code.


Controls & Widgets

  Each parameter type maps to a specific control. These are auto-generated from the plugin ParamSchema.

  1. Range Slider
    For f64 and i64 ranges. Displays current value, min/max bounds, and a draggable thumb. Supports optional step snapping.

    Precision: in image editing, numerical ranges are prevalent (0–1, or -1–1 for bidirectional). A naive slider from -180 to 180 with two decimal places means 36,000 values across a small physical range — unusable at the precision end.

    We use a Hybrid Chameleon control (see [./research/value-drag-ui.html]) that adapts drag sensitivity to the current value range. Works on both desktop and mobile.

  2. Toggle
    For boolean parameters. A simple on/off switch.

  3. Select
    For enum parameters.
    - Low cardinality (up to 5 items): inline segmented control.
    - High cardinality: searchable dropdown.

  4. Curve Editor
    For Curve parameters (Tone Curve node). An interactive spline with draggable control points on a 0–1 grid, with per-channel overlays (master, R, G, B).

  5. Color Picker
    RGB color picker with hex input.

  6. Text Input
    For string parameters (e.g. copyright, artist in Metadata node). Single-line text field.

  7. Geometry Controls
    For spatial parameters (points, rectangles, brush strokes). These are primarily manipulated via canvas overlays (see [./user-experience.lex] §7) but also have numeric inputs in the node card for precise values.

  8. Brush Strokes
    For the Brush zone. Canvas-based painting with configurable brush size. The node card shows stroke count and a clear button; actual painting happens on the image canvas.


The Interface

  It is made of two views: 

    1. Photo View
      The full photo display, core to the domain.
      1.1 Image Viewer:
        - mate: a fundamental entity, as having a framing around the image helps visualization and arami has a rich set of configs and rules for it. By default medium gray;.
        - Image: the rendered image
      1.2 Viewer Controls: 
        - Zoom
        - Mate Color
        
      1.3 Document Tool bar
        A set of icon based buttons with document / edit related actions (not graph related), like save, open, undo , redo, etc.

    2. The Pipeline Viewer

      The core editing view. Shows the full pipeline top-down, grouped by phases. Display order is *always* the application order; phases are shown even if empty.

      The five phases, in order: Source, Geometry, Zones, Adjustments, Output.

      2.1 Phases

        Phases are themselves a linear sequence of inputs and outputs, separated by phase boundaries — specific connectors that can be:
          - a condenser (multiple nodes as input, one output),
          - a diffuser (one input, multiple outputs), or
          - a pass-through (one in, one out).

        The first phase (Source) is a condenser, the last (Output) is a diffuser, and the three middle phases (Geometry, Zones, Adjustments) are pass-throughs.

        This means that for the linear (pass-through) phases, nodes should be displayed as a fixed vertical list — there is no branching, so ordering is done by drag and drop. Since these are linear, we can use a puzzle/snap design (Squeak/Automator style).

        For the non-linear phases:
          - Sources are a single node in the vast majority of cases, or 2–3 less often (rarely more).
          - Outputs are likewise: 1 is the norm, 2–3 common, more than that rare.

        Given this, a layout that fits up to 3 nodes side-by-side (for sources and outputs) would make good use of vertical space. Visually, it is clearer when nodes that combine or split sit at the same vertical level. For 4+ nodes, wrapping to multiple rows is fine.

        See the node list, by phase  for more details.

      2.2 Phase Anatomy

        Each phase has:
          - A phase name label.
          - Input/output connectors at its boundaries (the first phase only has its output connector, the last only its input connector). Nodes attach to these connectors — they do not connect directly across phase boundaries.
          - A "+" button that opens a radial menu with the available node types for that phase.

        Phases should be visually light — more like region dividers (a simple line separating areas) than heavy boxed panels. They are regions of the pipeline, not containers.

Notes

  1. Nodes

    Phase 0 — Source (condenser)
      Standard Image (arami.source.standard) — no parameters
      RAW / DNG (arami.source.raw) — no parameters

    Phase 1 — Geometry (pass-through)
      Crop (arami.crop)
        x (X, f64 0–1), y (Y, f64 0–1), width (Width, f64 0–1), height (Height, f64 0–1)
        ratio_w (Ratio W, f64 1–32), ratio_h (Ratio H, f64 1–32), landscape (Landscape, bool), show_thirds (Show Thirds, bool)
      Rotate (arami.rotate)
        angle (Angle, f64 -180–180)
      Perspective (arami.perspective)
        tl_x (Top-Left X, f64 -1–1), tl_y (Top-Left Y, f64 -1–1), tr_x (Top-Right X, f64 -1–1), tr_y (Top-Right Y, f64 -1–1), br_x (Bottom-Right X, f64 -1–1), br_y (Bottom-Right Y, f64 -1–1), bl_x (Bottom-Left X, f64 -1–1), bl_y (Bottom-Left Y, f64 -1–1)

    Phase 2 — Zones (pass-through)
      Luminance (arami.zone.luminance)
        range_low (Range Low, f64 0–1), range_high (Range High, f64 0–1), feather (Feather, f64 0–1)
      Color Range (arami.zone.color-range)
        hue_center (Hue Center, f64 0–360), hue_range (Hue Range, f64 0–180), saturation_min (Sat Min, f64 0–1), saturation_max (Sat Max, f64 0–1), feather (Feather, f64 0–1)
      Gradient (arami.zone.gradient)
        kind (Kind, enum: Linear | Radial), start_x (Start X, f64 0–1), start_y (Start Y, f64 0–1), end_x (End X, f64 0–1), end_y (End Y, f64 0–1)
      Brush (arami.zone.brush)
        strokes (Strokes, BrushStrokes)
      Semantic Segmentation (arami.zone.segmentation) — no parameters (AI-inferred labels: sky, person, vegetation, structure)

    Phase 3 — Adjustments (pass-through)
      White Balance (arami.white-balance)
        temperature (Temperature, f64 2000–12000 K), tint (Tint, f64 -1–1)
      Tone Curve (arami.tone-curve)
        master (Master, Curve), red (Red, Curve), green (Green, Curve), blue (Blue, Curve)
      Color Mixer (arami.color-mixer)
        red_gain (Red Gain, f64 0–2), green_gain (Green Gain, f64 0–2), blue_gain (Blue Gain, f64 0–2), saturation (Saturation, f64 -1–1)
        hue_shift_0..7 (Red/Orange/Yellow/Green/Cyan/Blue/Purple/Magenta Hue Shift, f64 -30–30)
      Monochrome (arami.monochrome)
        red_weight (Red Weight, f64 0–2), green_weight (Green Weight, f64 0–2), blue_weight (Blue Weight, f64 0–2), strength (Strength, f64 0–1)
      CLAHE (arami.clahe)
        clip_limit (Clip Limit, f64 1–10), tile_size (Tile Size, i64 2–32), strength (Strength, f64 0–1)
      Denoise (arami.denoise)
        spatial_sigma (Spatial Sigma, f64 0–5), range_sigma (Range Sigma, f64 0.01–0.5), iterations (Iterations, i64 1–5)
      Sharpen (arami.sharpen)
        radius (Radius, f64 0.1–10), amount (Amount, f64 0–3), threshold (Threshold, f64 0–0.1)
      Clarity (arami.clarity)
        strength (Strength, f64 -1–1)

    Phase 4 — Output (diffuser)
      Output groups, each containing an encoder and optional child nodes.
      Encoders:
        PNG (arami.output.png) — no parameters
        JPEG (arami.output.jpeg) — quality (Quality, i64 1–100)
        WebP (arami.output.webp) — no parameters
        TIFF (arami.output.tiff) — no parameters
        AVIF (arami.output.avif) — quality (Quality, i64 1–100)
      Child nodes (applied before encoding):
        Resize (arami.output-child.resize)
          mode (Mode, enum: Original | Longest Edge | Fit | Fill | Exact), px (Longest Edge px, i64 1–32000), width (Width, i64 1–32000), height (Height, i64 1–32000), label (Label, string)
        Reframe (arami.output-child.reframe)
          aspect_w (Aspect W, f64 0.1–100), aspect_h (Aspect H, f64 0.1–100), gravity (Gravity, enum: Center | N | S | E | W | NE | NW | SE | SW), offset_x (Offset X, f64 -1–1), offset_y (Offset Y, f64 -1–1)
        Metadata (arami.output-child.metadata)
          strip_exif (Strip EXIF, bool), strip_gps (Strip GPS, bool), strip_iptc (Strip IPTC, bool), copyright (Copyright, string), artist (Artist, string)