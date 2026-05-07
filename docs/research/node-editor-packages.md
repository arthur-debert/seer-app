# Node Editor Package Evaluation

Evaluation of Svelte-compatible node editor libraries for Arami's pipeline UI.
Conducted March 2026.

## Candidates

Three libraries evaluated. A fourth (BaklavaJS) was excluded as Vue-only.
LiteGraph.js (Canvas2D engine powering ComfyUI) was excluded because its
rendering model makes embedding Svelte components inside nodes impractical.

|                      | Svelte Flow                  | Svelvet                               | Rete.js                         |
| -------------------- | ---------------------------- | ------------------------------------- | ------------------------------- |
| Package              | `@xyflow/svelte`             | `svelvet`                             | `rete` + `rete-svelte-plugin`   |
| GitHub stars         | ~35,900 (xyflow monorepo)    | ~2,765                                | ~11,970                         |
| Latest version       | 1.5.2 (Mar 2026)             | 11.0.5 (Feb 2025)                     | 2.1.1 (Jun 2025, Svelte plugin) |
| Last commit          | Mar 27, 2026                 | Feb 13, 2025                          | Mar 29, 2026 (core)             |
| npm weekly downloads | ~12,700                      | Low (ecosystem signals)               | Moderate                        |
| License              | MIT                          | MIT                                   | MIT                             |
| Backing              | xyflow GmbH (funded, Berlin) | OSLabs accelerator (rotating cohorts) | Solo maintainer + community     |

## Svelte 5 Compatibility — Critical Filter

Arami uses Svelte 5 with runes. This is a hard requirement.

- **Svelte Flow**: YES. v1.0 (May 2025) was a ground-up rewrite for Svelte 5
  runes. Peer dep requires `svelte ^5.25.0`. No Svelte 4 legacy.
- **Svelvet**: NO. Peer dep is `svelte >=3.59.2 || ^4.0.0` — explicitly
  excludes Svelte 5. No visible migration work. **Eliminates Svelvet.**
- **Rete.js**: YES. Dedicated `rete-svelte-plugin/5` import path for Svelte 5.
  Peer dep `svelte >= 3.54.0 < 6`.

## Detailed Comparison: Svelte Flow vs Rete.js

(Svelvet eliminated above. Included in summary table for completeness.)

### Custom Node Model

**Svelte Flow**: Nodes are standard Svelte 5 components. You receive typed
`NodeProps` via `$props()` and render whatever you want. Registration is
declarative via `nodeTypes` prop on `<SvelteFlow>`. This is the natural
Svelte pattern — a node _is_ a component.

**Rete.js**: Nodes are class instances extending `ClassicPreset.Node`. Rendering
is handled by a plugin layer: you write `customize.node` handlers that
conditionally return Svelte components. Controls are another class-based
abstraction mapped to components via `customize.control`. The indirection is
significant — you're working with Rete's object model first, Svelte second.

**Verdict**: Svelte Flow. Its component-first model is a direct match for
embedding rich editing controls (sliders, curve editors, color pickers) inside
nodes. With Rete, every control needs a class wrapper before it becomes a
Svelte component.

### Collapsed / Default / Expanded Node Views

**Svelte Flow**: Built-in `<NodeResizer>` and `<NodeResizeControl>` components
handle dynamic node sizing. Since nodes are plain Svelte components, switching
between verbosity states is just conditional rendering (`{#if expanded}`) with
the node's bounding box updating automatically. No special API needed.

**Rete.js**: No explicit resize support documented. Dynamic node sizing would
require manual size tracking and feeding it back to the layout engine.

**Verdict**: Svelte Flow. The three-state verbosity model (collapsed / default /
expanded) maps directly to Svelte's reactive rendering with zero framework
friction.

### Rich Controls Inside Nodes

**Svelte Flow**: Any HTML/Svelte component works inside a node. Interactive
elements (sliders, inputs, dropdowns) use the `nodrag` CSS class to prevent
drag conflicts. This is documented and standard practice.

**Rete.js**: Possible but indirect. Each interactive control needs a Rete
`Control` subclass, then a Svelte component mapping. The abstraction layer
between "I want a slider here" and "the slider renders" is thicker.

**Verdict**: Svelte Flow. Embedding Arami's ParamSchema-driven controls (float
sliders, curve editors, color pickers, toggles, dropdowns) is trivially natural.

### Auto-Layout

**Svelte Flow**: No built-in layout engine. Documented integrations with:

- **Dagre** — tree/hierarchical layouts (lightweight)
- **Elk.js** — full-featured layout engine (supports many algorithms)
- **D3-Force** — physics-based layouts

You run the layout externally and set node positions. This is the right
architecture for Arami: the layout algorithm choice (top-to-bottom pipeline
with phase grouping) is domain-specific and shouldn't be locked to the
library's built-in.

**Rete.js**: `rete-auto-arrange-plugin` provides layout via Elk.js under the
hood. More batteries-included, but less control over the algorithm choice.

**Verdict**: Tie. Both use Elk.js. Svelte Flow's external approach gives more
control; Rete's plugin is more turnkey.

### Edge Customization (Colors, Styles, Phase Semantics)

**Svelte Flow**: Custom edges are Svelte components receiving `EdgeProps` with
source/target coordinates. Use `<BaseEdge>` with path utilities or full custom
SVG. Per-edge types, colors, styles are all straightforward. Edge types map
well to Arami's phase topology (Condenser, Linear, Diffuser).

**Rete.js**: Custom connection components via `customize.connection`. Same
capability, more indirection.

**Verdict**: Svelte Flow. Slightly simpler path to per-phase colored connections.

### Interaction Quality

|                 | Svelte Flow                                                   | Rete.js                     |
| --------------- | ------------------------------------------------------------- | --------------------------- |
| Pan/zoom        | Smooth, hardware-accelerated (shared `@xyflow/system` engine) | Smooth (`rete-area-plugin`) |
| Touch/mobile    | Supported via `@xyflow/system`                                | Not explicitly documented   |
| Keyboard nav    | Built-in: Tab through nodes, arrow keys to move               | Not built-in                |
| Connection drag | Click-to-connect + drag-to-connect + reconnect anchors        | Port-to-port drag           |
| Snap-to-grid    | `snapToGrid` + `snapGrid` props                               | Not documented              |

**Verdict**: Svelte Flow. More interaction primitives out of the box, especially
keyboard navigation and touch support.

### Theming and Customizability

**Svelte Flow**: Three-layer system:

1. CSS variables (`--xy-node-background-color-default`, `--xy-edge-stroke-default`, etc.)
2. CSS class overrides (`.svelte-flow__node`, `.selected`, etc.)
3. Tailwind integration documented. Scoped Svelte styles work naturally.

Base styles required (`base.css`), default styles optional (`style.css`).

**Rete.js**: Requires `sass` as peer dependency. Styling via component
overrides rather than a CSS variable system.

**Verdict**: Svelte Flow. CSS variables and Tailwind integration align with
Arami's existing frontend stack (Tailwind for styling). No additional build
deps.

### Performance at Scale

**Svelte Flow**: Selective re-rendering (only changed nodes update). Docs
recommend `$state.raw` for node/edge arrays to avoid deep reactivity overhead.
React Flow (same engine) handles thousands of nodes in production.

**Rete.js**: Documented LOD (Level of Detail) optimization — replaces distant
nodes with simple rectangles at low zoom. Historical performance issues with
40-50+ nodes (2018 report, likely improved since).

**Verdict**: Svelte Flow for typical Arami pipelines (10-50 nodes). Rete's LOD
would matter only at much larger scales.

### Built-in Components

| Component               | Svelte Flow        | Rete.js      |
| ----------------------- | ------------------ | ------------ |
| MiniMap                 | Yes                | Yes (plugin) |
| Controls (zoom/fit)     | Yes                | No           |
| Background (dots/lines) | Yes                | No           |
| Node Toolbar            | Yes                | No           |
| Edge Toolbar            | Yes                | No           |
| Node Resizer            | Yes                | No           |
| Context Menu            | No (easy to build) | Yes (preset) |
| Viewport Portal         | Yes                | No           |

### Documentation and Ecosystem

**Svelte Flow**: Excellent docs at svelteflow.dev. Full tutorial, API reference,
interactive examples. Migration guide for v1.0. Benefits from React Flow's
massive ecosystem of examples and patterns (concepts transfer directly).

**Rete.js**: Good docs at retejs.org with Svelte-specific guides. But the
Svelte renderer is one of six (React, Vue, Angular, Lit, Svelte) and may lag
behind the React renderer in features and examples.

## Summary Evaluation

Criteria rated 1-5 (5 = best).

| Criterion                            | Svelte Flow | Svelvet     | Rete.js |
| ------------------------------------ | ----------- | ----------- | ------- |
| Svelte 5 native                      | 5           | 0 (blocked) | 4       |
| Project health / momentum            | 5           | 1           | 4       |
| Custom node views (collapse/expand)  | 5           | 3           | 3       |
| Rich controls in nodes               | 5           | 4           | 3       |
| Auto-layout support                  | 4           | 1           | 4       |
| Edge customization (colors, types)   | 5           | 2           | 4       |
| Interaction quality (pan/zoom/touch) | 5           | 3           | 3       |
| Simplicity (no new tooling)          | 5           | 4           | 2       |
| Customizability / theming            | 5           | 2           | 3       |
| Documentation quality                | 5           | 3           | 4       |
| **Total**                            | **49**      | **23**      | **34**  |

## Recommendation

**Svelte Flow (`@xyflow/svelte`) is the clear choice.**

It wins on every criterion that matters for Arami:

1. **Svelte 5 native**: Ground-up rewrite for runes. No compatibility shims.
2. **Component-first nodes**: A node is a Svelte component. Embedding
   ParamSchema-driven controls (sliders, curves, color pickers, toggles) is
   the natural pattern, not a workaround.
3. **Collapse/expand**: `<NodeResizer>` + conditional rendering gives us the
   three-state verbosity model (collapsed/default/expanded) with zero
   framework friction.
4. **Funded, active team**: xyflow GmbH ships monthly releases. React Flow
   (same codebase) powers Stripe and Typeform in production.
5. **Tailwind + CSS variables**: Matches Arami's existing frontend stack.
6. **Touch + keyboard**: Built-in, not afterthoughts.

The one area where work is needed is auto-layout (external via Dagre or Elk.js),
but this is actually preferable: Arami's top-to-bottom phased pipeline layout is
domain-specific and should not be constrained by a library's built-in algorithm.

Svelvet is eliminated: no Svelte 5 support, stale for 13+ months, cohort-driven
development with no continuity.

Rete.js is a credible alternative but introduces unnecessary complexity: its
class-based node model, plugin indirection, and Sass dependency add friction
that Svelte Flow avoids entirely.
