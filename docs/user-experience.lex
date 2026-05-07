The Arami User Experience

This document covers the principles, motivation and guidelines for the Arami editing experience. It is not a technical document on implementation, frameworks or other concrete code aspects. For research supporting these ideas, see [./research/node-based-ui.md] and [./research/direct-manipulation.md].


1. The Status Quo

    The user experience in photo editing incumbents is hard to understand, opaque to advanced users, expensive to write and maintain and often disregards some 30 years of shared knowledge from medium to high complexity professional media applications.

    Most editors are in the Photoshop/Light room era of layers and panel dumps. Even Dark table, which has a solid node-based architecture underneath, is a UI mess. These interfaces muddle, at best, the pipeline processing order (which is key for complex image editing) and often confuse or misdirect users toward bad results.

    The fundamental failure is _split attention_: the editing result lives in the canvas, the editing controls live in a distant sidebar, and the editing structure lives in yet another panel. Users labor mentally, visually and mechanically through a disconnected interface where the three representations of the same work are never co-located.


2. The Arami Perspective

    The blueprint for the user experience is a by-product of the decades of accumulated knowledge in high complexity applications in the general imaging domain, as well as a tight interplay with the technical design: the linear pipeline, the plugin architecture and the parameter schema system (see [./readme.lex]). That is, it bridges users' needs and mental model first, ergonomics second and software engineering specifics third, in the hope of achieving something that is easy to learn, powerful to extend and cheap to implement (hence reliable and robust).

    Where incumbents separate _what_ (parameters), _where_ (graph structure) and _result_ (canvas) into three disconnected panes, Arami collapses them: the node graph _is_ the editing interface, the canvas provides direct feedback, and transient overlays connect the two.


3. Node / Pipeline Based UI

    Instead of multiple panes and columns beside the image area, the UI is the node pipeline itself. This has several benefits:

    - Makes the application order of nodes explicit: which is key in image processing where operations are not commutative.
    - Greatly lowers the mismatch between mental model, architecture (pipeline, phases, nodes), the user's experience and UI code.
    - Eliminates the peripheral properties panel, reclaiming screen real estate for the canvas and graph.
    - Leverages spatial memory: users remember _where_ an adjustment lives in the graph faster than they can scan text labels in a scrolling sidebar.


4. Node-In-Place Editing

    Nodes are edited in the node graph itself, not in a segregated properties panel. The node's visual representation in the graph _is_ its editing surface.

    In order to accommodate this with good ergonomics and visual clarity, nodes have three verbosity states:

    1. Collapsed: Only the node's title, on/off toggle and edges are visible.
    2. Default: Shows the core editing controls for that node.
    3. Expanded: Shows all controls.

    For most nodes there is no need for the expanded form, as the node has one or two parameters. For others (e.g. Color Mixer with 11+ parameters), the default state shows the most common controls and expansion reveals the rest. This keeps the graph clean without hiding functionality.

    For the concrete visual design of nodes and their controls, see [./user-interface.lex].


5. Bidirectional Contextual Highlighting

    The relationship between the image canvas and the node graph should be explicitly investigatory in both directions.

    5.1 Graph to Canvas

        Hovering or selecting a node in the graph temporarily overlays a visualization on the image showing where that node's effect is concentrated. For zone-masked adjustments, this means highlighting the zone's spatial extent over the image.

    5.2 Canvas to Graph

        Interacting with a region of the image can highlight the nodes responsible for its current state: which adjustments are active there, which zones cover it. This provenance link transforms the editor from a passive tool into an analytical instrument where artists can trace visual results back to processing causes.

    5.3 Zone Highlighting

        Hovering or clicking a zone highlights both its visual mask over the image area and the nodes that reference it. For multi-source images, the source under the pointer can be identified.


6. Gestural Marking Menus and Transient HUDs

    With persistent panels removed, discoverability and rapid tool access come from transient interfaces that appear at the cursor location on demand.

    The primary mechanism is a cursor-centered command palette: a search bar with contextual suggestions, summoned via a keyboard shortcut over the graph or canvas. This replaces the traditional node library sidebar or filters menu.

    - Type-ahead filtering for rapid node creation (e.g. typing "Gau" highlights "Gaussian Blur").
    - Frequently used nodes in consistent positions for muscle-memory access.
    - Context-sensitive: the available options depend on what is selected and where the cursor is.

    Creating new nodes from the image canvas can pre-select the zone application based on cursor position over semantic regions.


7. Image Canvas Direct Manipulation

    For routine, highly visual adjustments the user should be able to bypass the graph entirely and interact directly with the image. Direct manipulation means clicking, dragging or gesturing on the canvas while the software autonomously updates the corresponding node parameters.

    This applies naturally to several categories of editing:

    - Spatial parameters (points, rectangles, gradients) that have a direct geometric correspondence on the canvas.
    - Tonal adjustments where click-and-drag on a region can drive the underlying curve or level for that tonal range.
    - Zone refinement where brush strokes on the canvas refine the zone mask.

    On-canvas handles and overlays are transient: they appear only during active manipulation and for the currently selected node, keeping the image clean by default. This is complementary to in-node editing, not a replacement: the graph remains the authoritative representation of the edit.


8. Tailored Controls

    Each parameter type requires a control matched to its ergonomics. The full catalog of control types and their visual specifications lives in the UI brief (see [./user-interface.lex], "Controls & Widgets").
