# Node-Based UI: Panel-Less Interfaces and In-Node Editing

Research into node-based professional interfaces, focusing on how to replace
traditional sidebar/panel layouts with node-centric editing and spatial graph
interaction.

## The Problem with Tri-Pane Layouts

The standard creative software layout — central canvas, node graph or layer
stack, and a dense properties panel — introduces significant cognitive friction
for expert users:

- **Split attention**: Eyes must constantly travel between the canvas (where
  results are evaluated) and a distant properties panel (where values are
  changed). This disrupts flow state across thousands of daily interactions.

- **Drawer-open syndrome**: Properties panels display every possible parameter
  regardless of current task, demanding users filter irrelevant visual noise.

- **Broken spatial mapping**: When the node is physically separated from its
  parameters by the width of the monitor, users must context-switch between
  the topological map of the project and the configuration of its variables.

## The Panel-Less Alternative

The radical alternative: eradicate the right-hand properties panel entirely.
The interface reduces to its two essential components — the output viewer and
the interactive node graph. Configuration happens directly within or upon the
node itself, leveraging spatial memory (users remember _where_ an adjustment
lives in 2D space faster than they can scan text labels in a scrolling sidebar).

### Zoomable User Interfaces (ZUI)

Grasshopper (Rhino's visual programming interface) pioneered dynamic
zoom-dependent UI. Components modify their visible interface based on zoom
level:

- **Zoomed out**: Only data flow and macro-routing are visible
- **Zoomed in**: Granular options, input ports, and configuration tools fade
  into existence

The node graph becomes a topographically rich map where physical proximity
dictates detail level. This concept applies directly to a panel-less editor:
the same graph serves both as high-level overview and as detailed editing
surface depending on how closely the user is looking.

### Node-as-Panel: Expandable In-Place Editing

When a user clicks a node, it physically expands within the graph to reveal
its configuration controls — sliders, curves, dropdowns, toggles — embedded
directly in its border. Key design requirements:

- **Auto-layout**: Expanding a node must push neighbors outward smoothly,
  maintaining connection integrity (physics-based or auto-routing)
- **Auto-collapse**: Clicking away or selecting another node collapses the
  previous one back to compact state
- **Thumbnail previews**: Compact nodes show a live thumbnail of their output
  state (following Substance Designer's approach)

This solves the one-to-one mapping requirement: the ordering, application,
and magnitude of each edit are centralized in one visual entity.

### Verbosity States

Not all nodes need full expansion. A graduated approach:

1. **Collapsed**: Title, on/off toggle, and edges only
2. **Default**: Core editing controls visible
3. **Expanded**: All controls visible

Most nodes have one or two parameters and never need the expanded form. For
complex nodes (e.g., Color Mixer with 11+ parameters), default shows the
primary controls; expansion reveals the rest. This keeps the graph clean
without hiding functionality.

## Embedded Parameters in Practice

### Web Frameworks

Modern node-graph libraries treat nodes as full UI components, not static
graphics. Each node can embed arbitrary controls:

| Technology | Library                    | Key Advantage                                                                     |
| ---------- | -------------------------- | --------------------------------------------------------------------------------- |
| JS/TS      | React Flow / Svelte Flow   | Nodes are standard stateful web components; any HTML/CSS control embeds naturally |
| JS/TS      | Rete.js / Baklava.js       | Modular architecture designed for visual programming without external sidebars    |
| C# / .NET  | NodeNetwork / STNodeEditor | Deep data binding between node UI and execution engine                            |
| Rust       | egui_node_graph            | Immediate-mode GUI, fast execution, ideal for embedded config                     |

### ComfyUI (Generative AI)

ComfyUI is the strongest existing example of the fully panel-less approach.
All inputs — text fields, float sliders, dropdown menus, boolean toggles —
render directly inside the node body. No external attribute editor exists.

The key to its success: strict mapping between the visual node and its
underlying code class. Developers define inputs/outputs in a Python dictionary;
the front end automatically translates them into inline widgets. This
eliminates the need to manually build and maintain separate configuration
panels — exactly the declare-process model Seer already uses with ParamSchema.

### Cables.gl (Interactive Web Graphics)

Cables.gl demonstrates two relevant patterns:

- **Inline parameter jumping**: Clicking a connected operator's name next to
  the parameter it feeds instantly navigates to the source node
- **Collapsible areas**: Complex sub-routines collapse into color-coded blocks,
  keeping the primary graph clean without needing a separate tree-view panel

### Tokens Studio (Design Systems)

Proves that node-based panel-less architectures work for abstract structural
logic, not just pixel manipulation. A single graph accepts a brand color as
input and generates entire color palettes, typography adjustments, and
accessibility compliance through embedded node logic.

## Graph Orientation and Visual Feedback

### Flow Direction

| Origin Domain                                 | Orientation  | Rationale                                                                  |
| --------------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| Programming / logic (Blueprints, Grasshopper) | Left → Right | Mimics text reading; suits sequential function application                 |
| VFX / compositing (Nuke, Natron)              | Top → Bottom | "Tree root" metaphor; multiple sources converge downward into final output |

For an image editor, top-to-bottom flow makes the hierarchical depth and
blending order instantly legible. Multiple image elements enter at the top,
converge through processing nodes, and produce output at the bottom.

### Node Abstraction Levels

- **Houdini**: Deep nesting — top-level nodes contain entire sub-networks.
  Infinite complexity without cluttering the top-level view. Downside:
  minimal graphical representation, visually monotonous at scale.

- **Substance Designer**: Live thumbnail previews on every node. For
  image-based workflows this is critical — artists debug the graph by
  scanning thumbnails to see where a texture broke or a color degraded.

For Seer, live thumbnails on nodes provide immediate visual feedback about
the state of the image at any pipeline point.

## Transient Interfaces: HUDs, Hotboxes, Marking Menus

With persistent panels removed, discoverability and rapid tool access must
come from transient interfaces that appear at the cursor location on demand.

### Marking Menus (Maya)

Radial, context-sensitive menus appearing at the cursor on right-click. Expert
users don't read the options — they perform rapid directional "flicks" based
on muscle memory. This is grounded in Fitts's Law:

- Travel distance to target ≈ zero (menu appears at cursor)
- Target width ≈ infinite (wedge-shaped slices extend to screen edge)
- Result: gesture flicks execute in fractions of a second

Menus are context-sensitive: the options change based on what's selected,
showing only operations that are valid for the current state.

### Hotbox (Maya Spacebar)

Holding spacebar summons the entire menu system centered at the cursor,
overlaying the viewport. Eliminates traveling to the menu bar. Professional
users customize it to show only relevant modules.

### Application to Seer

A spacebar-triggered HUD over the graph area could replace the traditional
"Node Library" sidebar or "Filters" menu:

- Search bar + contextual radial menu at the pointer location
- Type-ahead filtering (e.g., "Gau" → "Gaussian Blur")
- Commonly used nodes in consistent radial positions for muscle-memory flicks

This is the same pattern as Nuke's tab-search (floating auto-completing text
box at cursor on Tab press) and Blender's pie menus.

## Sources and Prior Art

- Grasshopper (Rhino): ZUI, dynamic node expansion
- ComfyUI: Fully panel-less, declare-to-UI mapping
- Cables.gl: Inline parameter jumping, collapsible areas
- Substance Designer: Live node thumbnails
- Houdini: Deep nesting, sub-networks
- Nuke: Tab-search, viewer processes
- Maya: Marking menus, hotbox
- Blender: Pie menus, Python-based radial menus
- Tokens Studio: Node-based logic for abstract design systems
- React Flow, Svelte Flow, Rete.js, Baklava.js, egui_node_graph: Frameworks
