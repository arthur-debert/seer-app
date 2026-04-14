# Output Mode Specification

## Overview

An image can have multiple **output groups** — distinct export configurations that each
produce a file from the same edited pipeline result. Examples: an archival TIFF, a web
JPEG, an Instagram Story crop.

Each output group is a **node group** containing ordered child nodes. This maintains
Seer's 1:1 contract: every concern is a node with a declarative `ParamSchema`, and
clicking any node shows its ParamPanel in the edit pane.

## Data Model

### OutputGroup (replaces the old monolithic Output)

```rust
struct OutputGroup {
    id: OutputGroupId,           // UUID
    name: String,                // "Instagram Story"
    enabled: bool,
    suffix: String,              // "_story" → "photo_story.jpg"
    path: OutputPath,            // SameAsSource | Custom(String)

    // Ordered child nodes
    child_pipeline: Vec<OutputChildId>,
    children: HashMap<OutputChildId, OutputChildNode>,
}

struct OutputChildNode {
    id: OutputChildId,           // UUID
    plugin_id: String,           // "seer.output-child.resize" or "seer.output.jpeg"
    params: ParamValues,         // schema-driven
    enabled: bool,
}
```

### Child Node Types

| Plugin ID                                                 | Role             | ParamSchema                                                     | Required?               |
| --------------------------------------------------------- | ---------------- | --------------------------------------------------------------- | ----------------------- |
| `seer.output.jpeg` / `.png` / `.webp` / `.tiff` / `.avif` | Encoder (anchor) | Format-specific (e.g. quality)                                  | Yes — cannot be removed |
| `seer.output-child.resize`                                | Resize transform | mode (Choice), px/width/height (Int), label (String)            | No                      |
| `seer.output-child.reframe`                               | Aspect crop      | aspect_w/h (Float), gravity (Choice), offset_x/offset_y (Float) | No                      |
| `seer.output-child.metadata`                              | EXIF policy      | strip_exif/gps/iptc (Bool), copyright/artist (String)           | No                      |

### Group-level vs Child-level Config

- **Group-level**: `name`, `suffix`, `path`, `enabled` — belong to the group, not any child node
- **Child-level**: each child has its own `plugin_id`, `params`, `enabled` — editable via ParamPanel

### Default Children

When creating a new group (e.g. `+ JPEG`), it starts with:

1. Resize child (mode: Original)
2. Metadata child (keep all)
3. Encoder child (e.g. JPEG quality 92)

Users can add optional children (Reframe) or remove non-encoder children.

## Export Plugins

| Format | Plugin ID          | Params                      | Extensions  |
| ------ | ------------------ | --------------------------- | ----------- |
| JPEG   | `seer.output.jpeg` | quality (1–100, default 92) | .jpg, .jpeg |
| PNG    | `seer.output.png`  | —                           | .png        |
| WebP   | `seer.output.webp` | — (lossless)                | .webp       |
| TIFF   | `seer.output.tiff` | — (uncompressed)            | .tiff, .tif |
| AVIF   | `seer.output.avif` | quality (1–100, default 80) | .avif       |

## Pipeline Execution

`Session::run_export(group_id)` walks the group's children in order:

```
Phase 0–3 (evaluate) → PixelBuffer
  → for each enabled child in group.child_pipeline:
      seer.output-child.reframe → apply_reframe(buffer, params)
      seer.output-child.resize  → apply_resize(buffer, params)
      seer.output-child.metadata → collect MetadataPolicy from params
      seer.output.*              → plugin.encode(buffer, params, ctx)
  → return encoded bytes
```

Disabled children are skipped. The encoder child is always last (enforced by insertion order).

## UI

### Processing Pane (OutputPane)

Groups render as collapsible containers:

```
▼ JPEG  Web Export           [▶ Run] [●] [×]
    ├─ Resize                (click → ParamPanel)
    ├─ Metadata              (click → ParamPanel)
    └─ JPEG                  (click → ParamPanel, not removable)
    + reframe

▼ TIFF  Print                [▶ Run] [●] [×]
    ├─ Resize
    ├─ Metadata
    └─ TIFF
```

### Edit Pane

- Click group header → OutputGroupSettings (name, suffix, path)
- Click child node → ParamPanel with the child's plugin schema
- The 1:1 node → edit panel contract is preserved

## Session API

### Group operations

- `add_export_group(encoder_plugin_id, ts)` → creates group with encoder + resize + metadata
- `remove_export_group(id, ts)`
- `reorder_export_group(id, new_index, ts)`
- `set_export_enabled(id, enabled, ts)`

### Group settings

- `set_group_name(id, name, ts)`
- `set_group_suffix(id, suffix, ts)`
- `set_group_path(id, path, ts)`

### Child operations

- `add_group_child(group_id, plugin_id, ts)` → adds child to group
- `remove_group_child(group_id, child_id, ts)` → fails if encoder
- `toggle_group_child(group_id, child_id, enabled, ts)`
- `update_group_child_params(group_id, child_id, params, ts)`
