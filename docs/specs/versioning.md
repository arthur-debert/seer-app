# Versioning — Unified History, Undo/Redo, and Version Management

**Component:** seer-editor::versioning (new), seer-editor::history (extended)
**Part of:** Circe image editing engine

## Context

Seer's editing pipeline is non-destructive: adjustments are stacked, not
baked. Versioning extends this by making the edit state itself navigable,
restorable, and branchable.

Versioning is the umbrella term for several related capabilities that
share a common data model:

| Capability              | Status      | What it gives the user                                 |
| ----------------------- | ----------- | ------------------------------------------------------ |
| **Undo/Redo**           | Done        | Step backward/forward through recent actions           |
| **History navigation**  | Done        | Jump to any point in the session log                   |
| **Named versions**      | Done        | Label a state ("BW attempt", "warm grade") for recall  |
| **Sidecar persistence** | Done        | Save/restore full version tree in `.seer` file         |
| **Visual previews**     | Planned     | Low-res thumbnails that make versions recognizable     |
| **Pipeline branching**  | Planned     | Fork the pipeline at a point to explore two directions |
| **CRDT sync**           | Design only | Merge edit histories across devices without conflicts  |

These are not independent features bolted together — they are views onto
the same underlying structure: a tree of edit states, where each node
captures a complete pipeline snapshot.

---

## Goals

1. **Unified tree model.** One data structure powers undo/redo, history
   navigation, named versions, and pipeline branching. No parallel
   bookkeeping systems that can drift out of sync.

2. **Automatic versioning.** Every mutation creates a restorable state
   without user action. Users can restore any moment in time with no
   prior setup — naming a version is a convenience, not a prerequisite.

3. **Rust-first.** Tree construction, traversal, diffing, snapshot
   restoration, and undo computation all live in `seer-editor`. The
   frontend renders data that Rust produces.

4. **Minimal memory footprint.** Full pipeline snapshots are cheap (the
   `EditGraph` is a small data structure — kilobytes, not megabytes).
   Image buffer caches are separate and managed independently.

5. **CRDT-compatible operations.** Every state transition is recorded as
   a replayable operation. The tree structure is designed so that
   concurrent edits from multiple devices can be merged.

---

## User Mental Model

### Three concepts, one panel

Users encounter versioning through three lenses — all presented through
the **History panel**, which is the single UI for navigating, tagging,
and filtering the version tree:

**Undo/Redo** — "I just did something wrong. Go back." Operates on the
current branch, moves a cursor backward/forward through recent steps.
Ephemeral, session-scoped. The bread-and-butter interaction.

**History** — "Show me everything I did." The chronological log of
actions, now interactive: click an entry to jump there. The History panel
is a linearized view of the current branch in the tree.

**Named versions** — "This is my BW direction." A label attached to a
tree node, displayed inline in the History panel. Like a git tag: a
pointer to a specific state, not a copy. Multiple names can point to the
same node. Names are persistent (saved in sidecar). A "+" button on each
history entry lets users create a tag; a filter toggles between showing
all entries or only named ones.

### What users should not need to know

Users should not need to understand tree data structures. The system
presents:

- Undo/Redo as Cmd-Z/Cmd-Shift-Z (linear, familiar)
- History as a flat list with jump-to-state on click
- Named versions as tag badges on history entries, with a filter toggle
- Branching as "I went back and made a different choice"

The tree structure is an implementation detail that makes all of this
work correctly.

---

## Data Model

### The Version Tree

The edit history forms a tree (not a list) because undo-then-edit
creates a branch:

```
[A] → [B] → [C] → [D]        ← user was here
                ↘
                 [E] → [F]    ← user undid to C, then made different edits
```

Each node is a **Snapshot**: a complete, self-contained edit state that
can be restored without replaying history from the beginning.

```rust
struct VersionTree {
    nodes: HashMap<NodeId, VersionNode>,
    root: NodeId,
    head: NodeId,         // current working state
    redo_tip: Option<NodeId>,  // for linear redo navigation
}

struct VersionNode {
    id: NodeId,
    parent: Option<NodeId>,
    children: Vec<NodeId>,
    snapshot: EditGraph,       // complete pipeline state
    mutation: HistoryMutation, // what changed from parent
    label: String,             // user-facing action description
    timestamp_ms: f64,
    tags: Vec<String>,         // named version labels (empty = unnamed)
    preview: Option<Preview>,  // low-res visual thumbnail
}
```

**Why store full snapshots, not deltas:**

- `EditGraph` is small. A pipeline with 20 adjustments, 10 zones, and
  their parameters serializes to ~5-15 KB of JSON. Storing 1000 undo
  states costs ~10 MB — trivial.
- Restoration is O(1): just clone the snapshot. No replay chain.
- Diffing for display ("what changed?") uses the `HistoryMutation`
  recorded on each node — the diff is pre-computed at mutation time.
- Deltas would save memory but add complexity (replay chains, corruption
  risk, performance cliffs on deep undo). Not worth it at these sizes.

### NodeId

```rust
type NodeId = Uuid;
```

UUIDs, not sequential integers. Required for CRDT merge: two devices
creating nodes independently must not collide.

### Head and Redo

`head` points to the node representing the current working state. Every
mutation creates a new child of `head` and advances `head` to it.

`redo_tip` tracks the "old future" when the user undoes: if the user is
at node C and undoes to B, `redo_tip` remembers C so that redo can walk
back to it. If the user makes a new edit at B (creating E), `redo_tip`
is cleared — the old future is abandoned (but C still exists in the tree
and can be reached through history navigation).

### Coalescing at the Tree Level

The existing `HistoryManager` coalescing (30-second window for rapid
parameter updates) continues to operate, but now it determines whether
a mutation creates a new tree node or updates the current one in place:

- **Coalesced mutations** update the current `head` node's snapshot and
  `mutation.after` value. No new node is created. This prevents a slider
  drag from creating 60 tree nodes.
- **Non-coalesced mutations** create a new child node of `head`.

The coalescing rules are unchanged from the existing history system:
same adjustment, same `UpdateParams` type, within 30-second window,
no intervening actions of a different kind.

### Groups in the Tree

Multi-step groups ("Apply Adaptive BW" = 6 adjustment additions) map
to a single tree node whose `mutation` is a `Group` variant containing
the individual steps. This preserves the two-level nesting in the UI
while keeping the tree node count manageable.

```rust
enum TreeMutation {
    Single(HistoryMutation),
    Group {
        label: String,
        steps: Vec<HistoryMutation>,
    },
}
```

---

## Named Versions (Tags)

A named version is a tag on a tree node — a `(String, NodeId)` pair.
Like git tags: the name points to a node, it does not copy or fork
anything.

```rust
struct VersionTree {
    // ...
    tags: HashMap<String, NodeId>,
}
```

**Operations:**

| Action        | Effect                                         |
| ------------- | ---------------------------------------------- |
| Name current  | `tags.insert("BW attempt", head)`              |
| Rename        | `tags.remove(old); tags.insert(new, node_id)`  |
| Delete name   | `tags.remove(name)` — node stays in tree       |
| Jump to named | `head = tags[name]`                            |
| Name any node | Tag can be placed on any node, not just `head` |

**History panel integration:** Tags are displayed inline on history
entries as badges. Each untagged entry has a "+" button to create a tag.
A filter toggle at the top of the panel switches between "all entries"
and "named only". Clicking a tagged entry jumps `head` to that node
(same as clicking any history entry). Right-click on a tag badge to
rename or delete it.

**Persistence:** Tags are saved in the sidecar alongside the tree.

---

## Visual Previews (Planned)

Each tree node can have a visual preview: a low-resolution rendering
that helps users identify versions visually.

```rust
struct Preview {
    width: u32,
    height: u32,
    pixels: Vec<u8>,    // RGBA, 8-bit per channel
}
```

**Generation policy:**

- Generated lazily on first request (not at every mutation)
- Resolution: max 300px on longest side, aspect-ratio constrained
- Computed by evaluating the node's `EditGraph` snapshot at reduced
  resolution
- Stored in-memory; optionally cached to disk for named versions

**When previews are generated:**

- When a tag is created (the user has signaled this state is important)
- When the history panel is visible (on-demand for visible entries)
- On idle after coalesced mutations settle (background, low priority)

**What previews are NOT:**

- Not full-resolution cached renders (see Image Buffer Caches below)
- Not mandatory — a node without a preview shows a placeholder

---

## Image Buffer Caches (Planned — Design Only)

Full-resolution or display-size cached renders of pipeline outputs. These
are an optimization for fast switching between versions — skip
re-evaluation when jumping to a previously-computed state.

**Two tiers:**

| Tier         | Size            | Use case                         |
| ------------ | --------------- | -------------------------------- |
| Display-size | Max 4K (~32 MB) | Fast version switching in viewer |
| Full-res     | Up to ~500 MB   | Export without re-evaluation     |

**Constraints:**

- WASM memory is limited (typically 2-4 GB). A 60MP image at f32 RGBA
  is ~900 MB. Caching more than 2-3 full-res states is impractical.
- Display-size caches are more viable: ~32 MB each, can hold ~30 states
  in 1 GB.
- Disk-based caches (temp directory) extend capacity for long sessions.

**Implementation is deferred.** The version tree's snapshot-based design
means caches are a pure optimization: the system works correctly without
them (just slower to switch). They can be added later without changing
the data model.

**Cache invalidation:** Moving `head` to a different node does not
invalidate caches for other nodes. Caches are keyed by `NodeId` and
invalidated only when a node's snapshot is modified (coalescing).

---

## Undo/Redo

### Mechanics

**Undo** moves `head` to its parent node in the tree:

```
head = nodes[head].parent
```

The previous `head` becomes `redo_tip` (if it was the most recent child).

**Redo** moves `head` forward along `redo_tip`:

```
head = redo_tip
redo_tip = next child along the same path (if any)
```

**New edit after undo** creates a branch:

```
Before undo:   A → B → C → D (head)
After undo:    A → B → C (head)    D (redo_tip)
New edit:      A → B → C → E (head)
                        ↘ D (orphaned from redo, but still in tree)
```

### Redo strategy: linear

When there are multiple children (branches), redo follows the path that
`redo_tip` was set to — the "last undone" direction. This gives users
simple Cmd-Z / Cmd-Shift-Z behavior without branch selection UI.

Navigating to branches that redo can't reach (e.g., node D above) is
done through the History panel or Named Versions panel, not redo.

### Applying undo/redo

Restoring a state means replacing the live `EditGraph` (in the WASM
bridge) with the snapshot from the target node. Since snapshots are
complete, this is a clone operation — no delta replay.

The pipeline evaluator sees a new `EditGraph` and re-evaluates from the
first changed adjustment (which it determines by comparing the old and
new pipelines — this is the existing cache invalidation logic).

### Keyboard shortcuts

| Action | macOS       | Windows/Linux |
| ------ | ----------- | ------------- |
| Undo   | Cmd-Z       | Ctrl-Z        |
| Redo   | Cmd-Shift-Z | Ctrl-Shift-Z  |

---

## Pipeline Branching (Planned)

Pipeline branching (forking the pipeline at a point to create independent
editing directions) is **orthogonal** to the version tree. It is a
feature of the `EditGraph` topology, not of the undo/redo system:

- The version tree captures _temporal_ branching: "I went back and made
  different choices."
- Pipeline branching captures _structural_ branching: "I want both a
  color and BW direction from this image, simultaneously."

Pipeline branching is described in `edit-pipeline.md` §6 and involves
extending `EditGraph` to support fork points. It is a separate
implementation track with its own dependencies (geometric adjustments,
per-version zone registries). The version tree described here will
automatically capture pipeline-branched states in its snapshots — when a
user adds a pipeline branch, that mutation creates a new tree node
containing the branched `EditGraph`.

---

## Tree Walking and Navigation API

### Core operations

```rust
impl VersionTree {
    // Navigation
    fn undo(&mut self) -> Option<&EditGraph>;
    fn redo(&mut self) -> Option<&EditGraph>;
    fn jump_to(&mut self, node_id: NodeId) -> Option<&EditGraph>;

    // Mutation (called by the editing pipeline)
    fn commit(&mut self, graph: EditGraph, mutation: TreeMutation,
              label: &str, timestamp_ms: f64) -> NodeId;
    fn coalesce(&mut self, graph: EditGraph, mutation: TreeMutation,
                label: &str, timestamp_ms: f64);

    // Tags
    fn tag(&mut self, name: &str, node_id: NodeId);
    fn untag(&mut self, name: &str);
    fn tags(&self) -> &HashMap<String, NodeId>;

    // Queries
    fn head(&self) -> &VersionNode;
    fn node(&self, id: NodeId) -> Option<&VersionNode>;
    fn ancestors(&self, id: NodeId) -> AncestorIter;   // walk to root
    fn children(&self, id: NodeId) -> &[NodeId];
    fn branch_history(&self) -> Vec<&VersionNode>;     // linear path: root → head

    // Serialization
    fn to_sidecar(&self) -> SidecarVersionData;
    fn from_sidecar(data: SidecarVersionData) -> Self;
}
```

### History panel (unified UI)

The History panel is the single interface for version navigation and
tag management. It shows the full timeline (root to furthest known
leaf), with a chevron (`▸`) marking the current head position.

**Navigation:** Click any entry to jump to that state via
`jump_to(node_id)`. The head entry is highlighted in blue. Entries
after head (future states reached by navigating back) remain visible
but are dimmed and struck through — clicking them jumps forward. The
frontend maintains a `fullPath` state that remembers forward nodes when
navigating backward; it is replaced when a new edit creates a divergent
branch.

**Edit guard:** Editing at a non-leaf position (where forward history
exists) triggers a confirmation dialog: "This will discard edits after
this point. Continue?" Dismissing blocks the edit; accepting proceeds
and discards the forward history.

**Tags:** The head entry shows a "+" button to create a tag (inline
text input, Enter to confirm). Tagged entries display amber badges with
an "x" button to delete. A filter toggle at the top switches between
"All" and "Named" (tagged-only) views.

**Previews (future):** When visual previews are implemented, tagged
entries show a small thumbnail beside the tag badge.

---

## Sidecar Persistence

The sidecar (`.seer` file) stores the version tree for session
restoration:

```json
{
  "version_tree": {
    "root": "uuid-root",
    "head": "uuid-head",
    "nodes": {
      "uuid-root": {
        "parent": null,
        "children": ["uuid-1"],
        "snapshot": { /* EditGraph JSON */ },
        "mutation": { "SetSource": { ... } },
        "label": "Open Image",
        "timestamp_ms": 1709500000000,
        "tags": []
      },
      "uuid-1": {
        "parent": "uuid-root",
        "children": ["uuid-2", "uuid-3"],
        "snapshot": { /* EditGraph JSON */ },
        "mutation": { "AddAdjustment": { ... } },
        "label": "Add Monochrome",
        "timestamp_ms": 1709500001000,
        "tags": ["BW attempt"]
      }
    },
    "tags": { "BW attempt": "uuid-1" }
  }
}
```

**Pruning:** Unnamed, non-branching, non-head nodes older than a
configurable threshold can be pruned to keep the sidecar compact. Only
leaf chains are prunable — branch points and tagged nodes are retained.

**Migration:** The existing sidecar format stores a flat `EditGraph`.
When loading a legacy sidecar, the system wraps it in a single-node
tree (root = head = the legacy graph). No special migration code beyond
a version check.

---

## CRDT Compatibility (Planned — Design Only)

The version tree is designed for future CRDT-based sync, though sync
is not implemented now:

**Each tree node is an immutable fact.** Once created, a node's
`snapshot`, `mutation`, and `parent` never change (coalescing is the
one exception, and only on the current `head`). This makes nodes safe
to replicate — they are append-only.

**Node IDs are UUIDs.** Two devices creating nodes independently never
collide.

**The tree structure is a grow-only CRDT.** Nodes can be added but never
removed (pruning is a local-only optimization, not replicated). The tree
converges by union: if device A has nodes {1,2,3} and device B has
nodes {1,2,4}, merging produces {1,2,3,4}.

**Tags are LWW (last-writer-wins) registers.** If two devices tag
different nodes with the same name, the later timestamp wins.

**`head` is per-device.** Each device has its own `head` cursor — it is
not a replicated value.

The mapping to the existing CRDT design in `edit-pipeline.md` §7:

- Version tree nodes → append-only Set CRDT
- Tags → LWW Map CRDT (name → NodeId)
- Pipeline (within snapshot) → List CRDT
- Adjustment params → LWW Register per field

---

## Relationship to Existing History System

The `HistoryManager` in `seer-editor::history` is well-implemented and
well-tested. Its role changes but it is not discarded:

**What stays:**

- `HistoryMutation` enum — used as `TreeMutation::Single` variant
- Coalescing logic — determines whether to create a new tree node or
  update the current one
- Label generation and `changed_params_summary()` — used for node labels
- Log attachment — logs attach to the current tree node's step record
- Groups — map to `TreeMutation::Group`

**What changes:**

- `HistoryManager` becomes internal to `VersionTree` rather than being
  a standalone component at the WASM bridge level
- `groups: Vec<HistoryGroup>` is replaced by the tree's
  `branch_history()` — the tree is now the source of truth
- The WASM bridge composes `VersionTree` instead of `HistoryManager`

**What is added:**

- `VersionTree` struct with tree operations
- Undo/redo methods
- Tag management
- Snapshot storage per node
- Sidecar persistence for the tree

---

## Implementation Status

The core versioning system is implemented end-to-end. The dependency
chain below shows what is done and what remains:

```
VersionTree core (tree, undo/redo, snapshots)   ✅ done
  → Tag management                              ✅ done
  → Sidecar persistence (version_tree envelope)  ✅ done
  → WASM bridge (VersionTree replaces HistoryManager)  ✅ done
    → Keyboard shortcuts (Cmd-Z / Cmd-Shift-Z)  ✅ done
    → Interactive history panel (jump, tags, filter, edit guard)  ✅ done
      → Visual previews                         planned

Image buffer caches — independent, deferred until profiling shows need
CRDT sync — independent, deferred until sync infrastructure exists
Pipeline branching — separate track, depends on geometric transforms
```

**Key implementation decisions:**

- `HistoryManager` is internal to `VersionTree`, not a standalone struct.
  Its coalescing and group logic is preserved; ownership changed.
- The WASM bridge composes `VersionTree` instead of `HistoryManager`.
  Mutation methods route through `VersionTree`; `history_groups()` was
  replaced by `version_history()`.
- The frontend maintains a `fullPath` state that remembers forward nodes
  when navigating backward, enabling the dimmed-future-entries UX.

---

## What Versioning Is Not

- **Not auto-save.** The sidecar is written on explicit save or at
  session boundaries. The version tree is in-memory during editing.
- **Not git.** There are no commits, staging areas, remotes, or merge
  resolution UIs. The tree is implicit — users interact through undo,
  history clicks, and named versions.
- **Not infinite.** The tree will be pruned to keep memory and sidecar
  size bounded. The pruning policy preserves branch points, tagged nodes,
  and the current head path.
- **Not collaborative editing UI.** CRDT compatibility means the data
  model supports sync, not that there is a multi-cursor, real-time
  collaborative editing experience.
- **Not a timeline.** No scrubbing, no playback, no animation. Jumping
  to a state is instant, not interpolated.
