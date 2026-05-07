# Zones — Design & Vision

## The Central Role of Zones

Traditional photo editors treat masking as a secondary concern — a tab
buried inside an adjustment panel, something you reach for after the
"real" editing decisions are made. This reflects a tools-first mental
model: pick a tool, then decide where it applies.

Photographers think the other way around: _what_ is in the image, then
what to do about it. "The sky needs darkening. The subject needs
lifting. The foliage needs separation." The regions come first. The
adjustments follow.

Arami makes zones the primary organizing concept. The question is not
"which adjustment am I editing?" but "which part of the image am I
working on?" Adjustments are verbs applied to zones, not the other way
around.

This inversion has consequences across the data model, the UI, and the
interaction design.

---

## 1. Data Model

### 1.1 Zones Are Document-Level, Not Adjustment-Level

A zone is a first-class object in the document — defined once, stored in
the edit graph, referenced by any number of adjustments. This is already
the case in the current `EditGraph`: zones live in a `HashMap<ZoneId,
ZoneGenerator>`, separate from the adjustment pipeline.

This separation is foundational and deliberate:

- **Reuse.** A "sky" zone can drive a ToneCurve, a ColorMixer, and a
  Sharpen adjustment simultaneously. The photographer defines "sky" once.
- **Stability.** Deleting an adjustment that references "sky" does not
  delete the zone. The zone survives because it belongs to the document,
  not to any single adjustment.
- **Consistency.** When two adjustments reference the same zone, they
  affect the same pixels. There is no risk of drift between two
  independently painted masks that were supposed to match.

### 1.2 Zone Lifecycle

Zones have a lifecycle independent of adjustments:

| Event                                  | Effect on zones            | Effect on adjustments                    |
| -------------------------------------- | -------------------------- | ---------------------------------------- |
| **Create zone**                        | New entry in zone registry | None — no adjustment uses it yet         |
| **Adjustment references zone**         | Zone gains a dependent     | Adjustment's `ZoneSource` points to zone |
| **Edit zone** (repaint, adjust params) | Zone definition updates    | All referencing adjustments re-evaluate  |
| **Delete adjustment**                  | Zone is unaffected         | Reference removed                        |
| **Delete zone**                        | Zone removed from registry | See §1.3 below                           |

This lifecycle means zones can exist before any adjustment uses them —
the photographer can build up a region vocabulary ("sky", "subject",
"background foliage") and later decide what adjustments to apply.

### 1.3 Zone Deletion and Cascade

Deleting a zone that is referenced by adjustments requires a decision.
The options:

1. **Revert to full.** Referencing adjustments lose their zone and
   become full-image. The adjustment survives but its spatial targeting
   is gone.
2. **Cascade delete.** Adjustments that _only_ reference this zone are
   removed. Adjustments that reference it as part of a Boolean
   combination have that branch replaced with `Full` (effectively
   removing the deleted zone from the expression).

The right behavior is **inform, then act**: show the user which
adjustments are affected, distinguish between "will lose zone" and "will
be removed entirely", and require confirmation. The default action is
revert-to-full (non-destructive), with cascade as an explicit choice.

For Boolean zone expressions that reference the deleted zone: remove
the deleted branch, keeping the other operand. `Union(A, deleted)` →
`A`. `Intersect(A, deleted)` → `A`. `Subtract(A, deleted)` → `A`
(nothing to subtract). `Subtract(deleted, B)` → `Full` (base gone, safe
fallback). If both sides are deleted the expression collapses to `Full`.

### 1.4 Zones Live in the Version Graph

Zone definitions are mutable — you can repaint a brush zone or adjust
a luminance range. When you do, every adjustment that references the
zone sees the change. This is the correct behavior: the zone represents
"the sky", and if you refine what "the sky" means, all sky-targeted
adjustments should follow.

Zones live inside the version graph, not beside it. When a pipeline
forks into versions ("Color" and "BW"), each version gets its own copy
of the zone registry. This follows from a key insight: zones are not
purely geometric facts about an image — they are authored to serve
adjustments. We don't segment every possible thing, only the things we
want to isolate for editing. Different editorial directions may need
different regions.

A BW rendering might want a tighter sky zone (to avoid haloing in the
monochrome conversion), while the color rendering keeps the original
looser selection. A portrait version might split the subject into face
and body, while a landscape crop of the same image doesn't need that
distinction. Zones and adjustments co-evolve during editing; forcing
them into a separate parallel graph creates more problems than it solves.

**Single graph, copy tools.** Rather than maintaining two synchronized
registries (zones shared vs. zones per-version), zones simply travel
with the version they belong to. Cross-version zone work is handled
through explicit user actions, not automatic synchronization:

- **Copy zone to version.** Right-click a zone → "Copy to version: BW".
  Creates an independent copy in the target version. Edits to either
  copy are independent from that point on.
- **Update zone from version.** Right-click a zone → "Update from
  version: Color". Replaces the zone's definition with the one from the
  source version. A one-shot pull, not a persistent link.
- **Clone zone.** Duplicate a zone within the same version (for
  creating a variant — "sky-tight" alongside "sky").

This keeps the data model simple (one zone registry per version, no
cross-version references) while giving the photographer the tools to
propagate zone edits when they choose to. The decision of _when_ to
sync is the photographer's, not the system's.

---

## 2. Zone Composition: Parts and Scenes

### 2.1 The Problem

A semantic analysis of a landscape might produce: sky, trees, grass,
road, house, person. These are **parts** — concrete segments of the
image.

But photographers think in terms of **scenes** — compositional roles
that group parts semantically:

- "Background" = trees + grass + road + house
- "Subject" = person
- "Environment" = sky + trees + grass
- "Foreground" = road + person

The same part (trees) can appear in multiple scenes (Background and
Environment). The photographer wants to apply a ToneCurve to
"Background" and have it affect trees, grass, road, and house. If the
"trees" zone is later refined (edge blur adjusted, area corrected), the
change should propagate to every scene that includes trees.

### 2.2 Two Layers: Parts and Scenes

The zone model has two conceptual layers:

**Parts** are zone generators — concrete image segments. They are the
atomic building blocks: a semantic region, a brush stroke, a luminance
range, a gradient. Each has a `ZoneId` and a `ZoneGenerator`. Parts are
not further decomposable within the zone system.

**Scenes** are zone compositions — Boolean combinations of parts (and
other scenes). They are expressed as `ZoneSource` trees. A scene is not
a new generator type; it is a named `ZoneSource` expression that
references parts by their `ZoneId`.

```
Parts (generators):              Scenes (compositions):
  sky                              Background = Union(trees, grass, road, house)
  trees                            Subject = person
  grass                            Environment = Union(sky, trees, grass)
  road
  house
  person
```

When an adjustment targets "Background", its `ZoneSource` is
`Union(Union(trees, grass), Union(road, house))`. Editing the "trees"
generator changes the rasterized zone for every scene that includes it.

### 2.3 Named Compositions

The current `ZoneSource` enum is anonymous — it is a tree of operations,
not a named entity. To support scenes, the model needs **named zone
compositions**: a `ZoneSource` expression stored in the zone registry
alongside generators, with its own `ZoneId`.

This means the zone registry stores two kinds of entries:

- **Generators** — produce a zone buffer from image data (Luminance,
  ColorRange, Gradient, Brush, Semantic)
- **Compositions** — produce a zone buffer by combining other zones
  (Boolean operations on generators and/or other compositions)

Both are referenceable by `ZoneId`. Both can be used in adjustment
`ZoneSource` fields. The distinction is in how they produce their
buffer: generators rasterize from parameters, compositions evaluate
their expression tree.

This naturally supports nesting: a composition can reference other
compositions. "Background" can include "Foliage" which itself is
`Union(trees, grass)`. Editing "trees" propagates through "Foliage" to
"Background" to every adjustment targeting any of them.

### 2.4 Avoiding Circularity

Compositions referencing other compositions can create cycles:
A includes B, B includes A. The system must reject this. On any
composition edit, walk the reference graph and reject if a cycle would
be introduced. This is a simple DAG check — the zone reference graph
must be acyclic.

---

## 3. Interaction Model

### 3.1 Zone-First Workflow

The primary interaction flow is:

1. **See the image.** Zones are overlaid as semi-transparent colored
   regions. The photographer sees the image segmented into its parts.
2. **Select a zone.** Click a region in the image, or select from the
   Parts/Scenes panels. The selected zone highlights on the image, and
   matching adjustments highlight in the pipeline.
3. **Edit within context.** The pipeline shows all adjustments with the
   selected zone's highlighted. Add new adjustments (pre-assigned to
   the selected zone), tweak parameters, or drag-reorder to change
   execution position.

This inverts the traditional flow (select adjustment → optionally add
mask) into: select zone → see and work on its adjustments in pipeline
context.

Deselecting all zones (or selecting "Full Image") removes the
highlighting — the full pipeline is shown without filtering. This is
not a special mode; it is the same view with no zone filter active.

### 3.2 Three-Way Binding

Three UI elements stay synchronized for the selected zone:

1. **Image overlay.** The zone's extent is shown on the image — a
   colored tint, a boundary line, a heatmap. The overlay responds to
   hover and selection.
2. **Zone panels.** The Parts and Scenes panels (see §3.3). Selecting a
   zone here highlights it on the image and filters the adjustment
   pipeline.
3. **Adjustment pipeline.** The full pipeline list (see §3.5). Matching
   adjustments highlight, non-matching ones dim. The pipeline is always
   fully visible — filtering is visual, not structural.

Clicking any of the three selects the same zone across all three.
Changes in any view are immediately reflected in the others.

### 3.3 Two Panels: Parts and Scenes

The zone sidebar is split into two panels rather than a single nested
tree. This avoids the visual complexity of showing the same part under
multiple scenes and makes the shared-reference relationship explicit.

**Parts panel.** A flat list of all zone generators — the atomic
building blocks. Each entry shows the zone's name, type icon (semantic,
brush, luminance, gradient, color range), and a thumbnail preview of its
extent. Selecting a part highlights it on the image and filters the
adjustment panel.

```
Parts
  sky            [semantic]
  trees          [semantic]
  grass          [semantic]
  road           [semantic]
  house          [semantic]
  person         [semantic]
  highlight wash [brush]
  vignette       [gradient]
```

**Scenes panel.** A list of named compositions, each expandable to show
which parts it includes. Parts are shown as references (tags/chips),
not as nested sub-items. Clicking a part reference within a scene
selects that part in the Parts panel and highlights it on the image.

```
Scenes
  Background     [trees, grass, road, house]
  Subject         [person]
  Environment     [sky, trees, grass]
```

This two-panel design makes the relationship clear: parts are the
atoms, scenes are groupings that reference them. "Trees" appears as a
tag in both Background and Environment — visually obvious that it's the
same thing, without the ambiguity of tree-nesting. Selecting "trees" in
either panel highlights it everywhere.

### 3.4 Zone Creation

Zone creation is prominent — not buried in a menu. The workspace offers
direct creation paths:

- **AI analysis** (automatic at image open): populates parts from
  semantic segmentation. The photographer starts with a segmented image,
  not a blank canvas.
- **Brush** painting directly on the image.
- **Luminance / Color range** pickers from image sampling.
- **Gradient** drawn on the image.
- **Scene composition** from existing parts via the zone tree.

The AI-generated zones are not special. They are standard zone
generators (Semantic type) and can be edited, combined, or deleted like
any user-created zone.

### 3.5 The Adjustment Pipeline Panel

The adjustment panel always shows the full pipeline as a flat, ordered
list. This is the execution order — what runs first, what runs last.
Each adjustment displays its zone as a colored badge alongside its name.

```
Pipeline
  1. WhiteBalance        [full]
  2. ToneCurve           [sky]
  3. ColorMixer          [full]
  4. ToneCurve           [vegetation]
  5. Sharpen             [sky]
  6. Clarity             [full]
```

**Drag-drop reordering.** Adjustments can be reordered by dragging them
to a new position in the list. The semantics are unambiguous: you are
moving to a specific pipeline position, and you can see exactly what
will run before and after it.

**Zone filtering.** When a zone is selected in the Parts or Scenes
panel, the pipeline list highlights matching adjustments and dims the
rest. Non-matching adjustments remain visible — they show the pipeline
context (what runs between the zone's adjustments). This is a visual
filter, not a structural change.

**Adding adjustments.** New adjustments are appended to the pipeline.
If a zone is selected, the new adjustment is pre-assigned to that zone.
The photographer can then drag it to the desired pipeline position.

**Zone editing.** Selecting an adjustment that carries a zone shows both
the adjustment's parameters and a link to the zone's editing controls
(repaint brush, adjust luminance range, etc.) in the inspector.

### 3.6 Zone Deletion UX

When the user deletes a zone:

1. The system identifies all adjustments that reference it (directly or
   through compositions).
2. A confirmation dialog lists:
   - Adjustments that will lose their zone (revert to full-image)
   - Adjustments that exist _only_ because of this zone and may no
     longer make sense
   - Scenes that include this zone (their composition will be updated)
3. The user confirms or cancels.
4. On confirmation: the zone is removed, referencing adjustments revert
   to `Full`, compositions are simplified.

No silent data loss. The user always sees what will change before it
changes.

---

## 4. How This Relates to the Current Architecture

The current `arami-editor` implementation provides the foundation:

| Current                                                | Extension needed                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `ZoneGenerator` enum (5 types)                         | No change — these are parts                                                                    |
| `ZoneSource` enum (Full, Generator, Boolean, Inverted) | Add named compositions as a storable entity                                                    |
| `EditGraph.zones: HashMap<ZoneId, ZoneGenerator>`      | Extend to store compositions alongside generators; zone registry travels with version branches |
| `EditGraph.set_adjustment_zone()`                      | No change — compositions are just `ZoneSource` values                                          |
| Linear pipeline with per-adjustment `zone: ZoneSource` | No change to pipeline topology                                                                 |

The pipeline model does not change. Adjustments remain a linear chain.
Zones remain a separate registry. The extensions are:

1. **Named compositions** in the zone registry (a `ZoneSource` stored
   with a `ZoneId`, referenceable like a generator).
2. **Per-version zone registries.** When versions fork, zones fork with
   them. Cross-version copy/update as explicit user actions.
3. **Cycle detection** on composition edits.
4. **Cascade logic** for zone deletion (which adjustments are affected,
   how to simplify Boolean expressions).
5. **UI state** for zone selection, overlay rendering, and contextual
   panel filtering — all in the frontend layer, not in `arami-editor`.

---

## 5. Open Questions

**Composition editing UX.** How does a user build a scene composition?
Drag parts into a scene? A Boolean expression builder? Select multiple
parts and "group"? The interaction model for composition creation is
underspecified and needs prototyping. Revisit when the core zone model
is implemented and testable.

---

## 6. Implementation Status

The zone backend is implemented; the zone-specific frontend UI is not.

**Done** (see `arami-editor::zone` and `arami-editor::zone_plugins` cargo docs):

- All 5 zone generators (Luminance, ColorRange, Gradient, Brush, Semantic)
- Zone evaluation, blending, boolean operations, inversion
- Named compositions with cycle detection and cascade deletion
- SegFormer ONNX inference, sidecar persistence, undo/redo tracking
- All zone types use resolution-independent coordinates

**Not done:**

- Frontend zone UI (Parts/Scenes panels, zone badges, image overlays,
  zone selection/highlighting) — Phases II–III below
- Per-version zone registries (depends on pipeline branching)

### Planned Phases

| Phase                                      | What                                                                                          | Status      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------- |
| **I. Named compositions**                  | Done — `ZoneComposition` in registry, cycle detection, cascade deletion                       | Done        |
| **II. Zone UI — pipeline integration**     | Zone badges, zone selection state, highlight/dim matching adjustments                         | Not started |
| **III. Zone UI — Parts and Scenes panels** | Parts panel, Scenes panel, zone creation controls, image overlays                             | Not started |
| **IV. Geometric adjustments**              | Crop, Rotate, Perspective — dimension-changing operations (separate track, see `geometry.md`) | Not started |
