# Direct Manipulation and Bidirectional Highlighting

Research into direct manipulation techniques where users interact with the
output canvas to drive changes in the underlying node graph, and bidirectional
highlighting that connects visual results to their processing causes.

## The Core Idea

Direct manipulation is an interaction paradigm where objects of interest are
modified through physical, reversible actions — clicking, dragging, pinching
directly on the object — rather than through disconnected sliders or numerical
inputs. In a node-based image editor, this means interacting directly with
pixels, zones, or geometry in the main viewer while the software autonomously
updates the corresponding node parameters in the graph.

## On-Image Color and Tonal Control

### Capture One: Direct Color Editor

Instead of locating a color segment in a side panel, the user selects a target
tool, clicks directly on a colored region in the photograph, and holds the
mouse button:

- **Vertical drag** → adjusts saturation of that color range
- **Horizontal drag** → shifts the hue
- **Alt + horizontal drag** → changes lightness

During this operation, the standard interface disappears from cognitive load.
The photographer keeps eyes entirely on the image while making gestural
changes to the underlying color data.

### Lightroom: On-Image Target Adjustment

For tone curves and color mixing, the user clicks a shadow/midtone/highlight
directly on the canvas. Dragging up/down dynamically bends the underlying
curve in real time. The image canvas physically acts as a tactile control
surface for mathematical parameters hidden in the graph.

Professional users note that seeing curves of different channels adjust
simultaneously via direct canvas interaction vastly reduces the cognitive
effort of balancing additive color mixing.

## Spatial Warping and On-Canvas Nodal Controls

### Darktable: Liquify Module

Manipulation doesn't happen in a side panel or expanded node — interactive
control nodes are placed directly on the image canvas. The user draws a curve
over the image consisting of linked nodes defining a distortion path:

- Drag a node's center point to warp the underlying pixels
- Scroll wheel adjusts the radius of the distortion effect
- The mathematical control structure (nodes + connecting splines) overlays
  the visual output, merging the two workspaces into one

### Shapr3D: Full In-Canvas Modeling

Operating on tablets and spatial computing devices (Apple Vision Pro), Shapr3D
uses entirely in-canvas controls. A contextual engine predicts user intent
based on the selected geometry, surfacing only relevant tools (extrude,
chamfer, fillet) directly next to the cursor. This removes the historical
node graph from the user's immediate view during modeling, allowing continuous
creative flow.

## The Nuke Viewer: Bridging Nodes and Output

Foundry's Nuke (industry standard for VFX compositing) demonstrates
sophisticated direct manipulation through its Viewer nodes:

- On-screen controls for navigation, display wipes, bounding boxes, and
  transforms — all as draggable handles over the composite image
- **Viewer Processes**: Temporary node graphs applied exclusively to the
  viewer (e.g., color space transforms for cinema display preview) that are
  independent of the main rendering pipeline, keeping base data pristine
- Hybrid 2D/3D capability: Compositors manipulate 3D cameras, lighting,
  and geometry directly over a 2D background plate without opening a
  separate viewport

## Bidirectional Contextual Highlighting

The relationship between the image canvas and the node graph can be made
explicitly investigatory in both directions.

### Canvas → Graph (Provenance Tracking)

Clicking a specific area of the image triggers a reverse-lookup through the
processing graph, identifying every operation that contributed to that pixel's
current state. The UI visually highlights the responsible nodes and their
connecting wires.

For example: in a heavily composited image with atmospheric effects, color
grading, and sharpening, clicking a bright highlight on a subject's face
would illuminate the specific Levels, Luminosity Curve, or Screen Blend
nodes responsible for that luminance value.

This transforms the editor from a passive tool into an analytical instrument
that lets artists debug complex visual outputs by tracing results back to
causes.

### Graph → Canvas (Effect Visualization)

Hovering over a node in the graph temporarily overlays a semi-transparent
mask on the image viewer, highlighting the exact regions being modified by
that operation. This shows not just _that_ a node is active, but _where_ its
effect is concentrated.

Combined with zone visualization (hovering a zone highlights its spatial
extent over the image), this creates a fully bidirectional link between the
processing graph and the visual result.

## Design Principles

From the surveyed tools, several principles emerge:

1. **Eyes on canvas**: The most effective direct manipulation keeps the user's
   gaze on the image. Controls appear at or near the cursor; the graph
   updates silently in the background.

2. **Gestural vocabulary**: Directional drags (vertical vs. horizontal) and
   modifier keys (Alt, Shift) provide axis-separated control without
   additional UI elements.

3. **Overlay, don't replace**: On-canvas handles and highlights are transient
   overlays. The image remains the primary view; controls appear only during
   active manipulation.

4. **Provenance is power**: Reverse-mapping from pixel to processing chain
   is a differentiating capability that no mainstream photo editor currently
   offers as a first-class feature.

## Sources and Prior Art

- Capture One Pro: Direct Color Editor (click-drag on image for hue/sat/lum)
- Adobe Lightroom: On-image target adjustment tool for curves/color mixing
- Darktable: Liquify module with on-canvas control nodes
- Shapr3D: Full in-canvas contextual modeling controls
- Foundry Nuke: Viewer nodes, viewer processes, hybrid 2D/3D manipulation
