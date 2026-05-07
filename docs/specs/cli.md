# Arami CLI & Scripting Engine

## Motivation

Arami's core strength is its architecture: a declarative plugin system, a lightweight
serializable document model (`EditGraph`), and a pure evaluation function that takes a
graph and source pixels and produces output pixels. The GUI is one consumer of this
engine. But photographers and studios also need:

- **Batch processing**: apply the same edits to hundreds of images overnight.
- **Automation**: conditional logic (denoise more aggressively for high-ISO shots),
  templated workflows, integration with scripts and CI pipelines.
- **Reproducibility**: a text-based, version-controllable representation of an editing
  pipeline that can be diffed, shared, and applied programmatically.
- **Interoperability**: other tools (DAM systems, web services, custom scripts) should be
  able to drive Arami's engine without a GUI.

A CLI is the natural first adapter. It should feel native to the shell, compose with
Unix tools, and be generated from the same plugin schemas that drive the GUI.

## Design Principles

1. **The engine is the product, frontends are adapters.** The CLI does not reimplement
   logic. It translates shell arguments into the same `EditGraph` mutations the GUI
   makes, then delegates to the same evaluator.

2. **The VersionTree is the pipe token.** Between pipe stages, what flows is not pixel
   data (too large, binary, meaningless without an encoder) but the serialized version
   tree — the same structure persisted in `.arami` sidecar files. Each pipe stage creates
   a version node, just like a GUI mutation. This means `arami save --sidecar` produces a
   proper sidecar with full editing history. Evaluation is lazy: only the final output
   command decodes the source image and runs the pipeline.

3. **The CLI is generated from ParamSchema.** Each plugin's `describe()` method produces
   a `ParamSchema` with typed parameter descriptors. The CLI generator turns these into
   `clap` subcommands with typed flags, help text, defaults, and range validation. Adding
   a plugin to the registry automatically adds it to the CLI. No hand-written argument
   parsing per plugin.

4. **Shell-native, not magic-shell.** Each operation is a separate command that reads
   stdin and writes stdout. Standard Unix piping, `xargs`, `parallel`, `for` loops,
   `tee`, and `jq` all work. No custom REPL, no JSON-in-JSON-out black box.

5. **Phases are for later.** The daemon and scripting engine are valuable but not needed
   to ship a useful CLI. The design accounts for them without requiring them upfront.

## Architecture

### Crate Structure

```
arami-editor/            (existing, minor addition)
  src/session.rs        Session struct extracted from WASM bridge

arami-cli/               (new crate, the CLI binary)
  src/main.rs           entry point, dispatch
  src/cli_gen.rs        ParamSchema -> clap::Command generation
  src/pipe.rs           session JSON serialization, pipe detection
  src/commands/         open, save, inspect, apply, plugins, zone subcommands

arami-editor-wasm/       (existing, refactored to delegate to Session)
```

### Session: The Shared Engine Entry Point

The WASM bridge currently composes the core types inline:

```rust
// current: arami-editor-wasm/src/lib.rs
pub struct EditGraph {
    versions: VersionTree,
    evaluator: PipelineEvaluator,
    source_buffer: PixelBuffer,
    registry: PluginRegistry,
    class_map: Option<ClassMap>,
}
```

This struct is the engine's session, but it lives inside the WASM crate where only the
browser can use it. The refactor extracts it into `arami-editor` as a first-class type:

```rust
// arami-editor/src/session.rs
pub struct Session {
    pub versions: VersionTree,
    pub evaluator: PipelineEvaluator,
    pub source_buffer: PixelBuffer,
    pub registry: PluginRegistry,
    pub class_map: Option<ClassMap>,
}

impl Session {
    /// Decode an image file and create a session with an empty pipeline.
    pub fn open(path: &str) -> Result<Self, SessionError> { ... }

    /// Create from a pre-decoded pixel buffer.
    pub fn from_buffer(buffer: PixelBuffer, path: &str) -> Self { ... }

    /// Restore from a serialized VersionTree (e.g. .arami sidecar or pipe JSON).
    pub fn from_versions(versions: VersionTree, source_path: &str) -> Result<Self, SessionError> { ... }

    /// Add an adjustment node with validated parameters.
    pub fn add_adjustment(&mut self, plugin_id: &str, params: ParamValues) -> Result<AdjustmentId, SessionError> { ... }

    /// Add a geometry node.
    pub fn add_geometry(&mut self, plugin_id: &str, params: ParamValues) -> Result<GeometryNodeId, SessionError> { ... }

    /// Add a zone generator with a user-assigned name.
    pub fn add_zone(&mut self, plugin_id: &str, name: &str, params: ParamValues) -> Result<ZoneId, SessionError> { ... }

    /// Bind a named zone to an adjustment.
    pub fn set_zone(&mut self, adjustment_id: AdjustmentId, zone_name: &str) -> Result<(), SessionError> { ... }

    /// Run the pipeline. Decodes source image if not already loaded.
    pub fn evaluate(&mut self) -> Result<&PixelBuffer, SessionError> { ... }

    /// Evaluate and encode to an output format.
    pub fn save(&mut self, path: &str, quality: Option<u8>) -> Result<(), SessionError> { ... }

    /// Get the current EditGraph (for serialization/piping).
    pub fn graph(&self) -> &EditGraph { ... }
}
```

The WASM bridge becomes a thin `#[wasm_bindgen]` wrapper over `Session`. The CLI binary
uses `Session` directly. Future adapters (HTTP API, daemon) do the same.

### Pipe Protocol

Each CLI command checks whether stdin/stdout are pipes (`isatty()`) to determine its
role in a chain:

| stdin    | stdout   | Role                                                     |
| -------- | -------- | -------------------------------------------------------- |
| terminal | pipe     | **Start of chain**: create session, write JSON to stdout |
| pipe     | pipe     | **Middle**: read JSON, mutate graph, write JSON          |
| pipe     | terminal | **End of chain**: read JSON, evaluate, display/write     |
| terminal | terminal | **Standalone**: do everything in-process                 |

The JSON envelope piped between stages:

```json
{
  "v": 1,
  "source": "/absolute/path/to/photo.dng",
  "versions": { ... }
}
```

- `v`: protocol version, for future compatibility.
- `source`: absolute path to the source image file. Resolved at `arami open` time.
- `versions`: the serialized `VersionTree`, identical in format to `.arami` sidecar
  content. The current `EditGraph` is the head node's snapshot
  (`versions.nodes[head].snapshot`), so there is no separate `graph` field.

Each pipe stage creates one version node (e.g. "Add White Balance", "Add Crop"). A
10-stage pipe produces ~10 nodes at 5-15 KB each — around 100 KB total. Trivially
pipeable. No image data flows through the pipe.

**Why lazy evaluation works:** The `EditGraph` stores the source file path, not the
pixels. Intermediate commands (`arami white-balance`, `arami crop`, etc.) only manipulate
the graph description. Only the terminal command (`arami save`) needs to load the image,
instantiate the registry, and run the evaluator. This keeps intermediate stages fast
(~5ms per invocation for a Rust binary: parse args, read JSON, mutate, write JSON).

## CLI Commands

### Core Commands

```
arami open <path>
```

Create a new session from a source image. Detects the file type, sets the source phase,
initializes an empty pipeline. Outputs session JSON if stdout is a pipe; prints image
metadata if stdout is a terminal.

```
arami save <path> [--quality N] [--format png|jpg|tiff] [--sidecar]
```

Evaluate the pipeline and write the result. Reads session from stdin. Decodes the source
image, runs the full pipeline, encodes the output. Prints a summary to stderr
(`Wrote result.jpg (2400x1600, 1.2 MB, 3 adjustments)`). If the output path is `-`,
writes encoded bytes to stdout (opt-in for further piping to tools like `convert`).

With `--sidecar`, also writes a `.arami` file alongside the output containing the full
`VersionTree` with editing history. This produces the same sidecar format that the GUI
creates, enabling round-trip: edit via CLI, refine in GUI, re-apply via CLI.

```
arami inspect [--json]
```

Pretty-print the current pipeline state. Reads session from stdin, prints the pipeline
to stderr (human-readable by default, `--json` for machine-readable), and forwards the
session JSON to stdout unchanged. This means `inspect` can be inserted anywhere in a
pipe chain for debugging without breaking the flow.

```
arami plugins [<plugin-id>]
```

Without arguments: list all registered plugins with their IDs, names, and categories.
With a plugin ID: print the full parameter schema (names, types, ranges, defaults).

```
arami presets [<plugin-id>]
```

Without arguments: list all available presets across all plugins. With a plugin ID: list
presets for that plugin, showing the preset name and a one-line description. See the
Presets section below for details.

```
arami apply <sidecar.arami> [--source <path>] [-o <path>]
```

Apply a `.arami` sidecar to an image. If `--source` is omitted, uses the source path
stored in the sidecar. This is the bridge between GUI and CLI: edit in the GUI, apply
the same edits to other images from the command line.

### Plugin Commands (Auto-Generated)

Every registered plugin becomes a subcommand. The name is derived from the plugin ID
by stripping the `arami.` prefix and the phase prefix:

| Plugin ID             | CLI Command           |
| --------------------- | --------------------- |
| `arami.crop`          | `arami crop`          |
| `arami.white-balance` | `arami white-balance` |
| `arami.tone-curve`    | `arami tone-curve`    |
| `arami.monochrome`    | `arami monochrome`    |
| `arami.clahe`         | `arami clahe`         |
| `arami.color-mixer`   | `arami color-mixer`   |
| `arami.denoise`       | `arami denoise`       |
| `arami.sharpen`       | `arami sharpen`       |
| `arami.clarity`       | `arami clarity`       |

Each subcommand accepts `--<param_id>` flags generated from the plugin's `ParamSchema`.
Parameters not specified on the command line use the schema's defaults.

Every adjustment subcommand also accepts:

- `--zone <name>` to bind the adjustment to a named zone (see Zone Commands below).
- `--zone-inline <spec>` to create an anonymous zone inline (see Inline Zones below).
- `--preset <name>` to load a named parameter preset (see Presets below). Explicit flags
  override preset values, so `--preset tungsten --tint 0.1` starts from the tungsten
  preset but overrides the tint.

#### Parameter Type Mapping

| ParamType | CLI syntax                       | Example                      |
| --------- | -------------------------------- | ---------------------------- |
| Float     | `--name <value>`                 | `--temperature 7500`         |
| Int       | `--name <value>`                 | `--tile-size 8`              |
| Bool      | `--name` (flag, presence = true) | `--preserve-luminosity`      |
| Choice    | `--name <option>`                | `--kind linear`              |
| Color     | `--name <r,g,b>`                 | `--tint-color 0.8,0.3,0.2`   |
| Point     | `--name <x,y>`                   | `--center 0.5,0.5`           |
| Rect      | `--name <x,y,w,h>`               | `--region 0.1,0.1,0.8,0.8`   |
| Curve     | `--name <x,y;x,y;...>`           | `--curve "0,0;0.25,0.3;1,1"` |
| Curve     | `--name @<file>`                 | `--curve @s-curve.json`      |
| Strokes   | `--name @<file>`                 | `--strokes @mask.json`       |

Complex types (Curve, Strokes) accept inline syntax for simple cases and `@file` syntax
for complex data loaded from a JSON file. Validation against the schema's ranges and
constraints happens before the graph is mutated; errors print to stderr with the
parameter name, expected range, and actual value.

### Zone Commands

```
arami zone luminance --low 0.6 --high 1.0 [--feather 0.1] --name <name>
arami zone color-range --hue 200 --hue-range 30 --name <name>
arami zone gradient --kind linear --start-x 0 --start-y 0 --end-x 0 --end-y 1 --name <name>
arami zone compose --op union|intersect|subtract --left <name> --right <name> --name <name>
arami zone invert --source <name> --name <name>
```

Zone commands add zone generators or compositions to the graph's zone phase. The
`--name` flag assigns a human-readable name that other commands reference via `--zone`.

Zone generator subcommands are auto-generated from `ZoneGeneratorPlugin` schemas, just
like adjustment subcommands. Brush and segmentation zones are omitted from the CLI
(brush requires interactive painting; segmentation requires model inference) but their
results can be referenced from `.arami` sidecars created in the GUI.

## CLI Generation: ParamSchema to clap

The `cli_gen` module walks the `PluginRegistry` at startup and builds the full
`clap::Command` tree:

```rust
pub fn build_cli(registry: &PluginRegistry) -> clap::Command {
    let mut root = clap::Command::new("arami")
        .about("Arami image processing pipeline")
        .subcommand(cmd_open())
        .subcommand(cmd_save())
        .subcommand(cmd_inspect())
        .subcommand(cmd_plugins())
        .subcommand(cmd_apply())
        .subcommand(cmd_zone(registry));

    // Auto-generate subcommands for geometry plugins
    for (id, plugin) in registry.geometry_iter() {
        root = root.subcommand(plugin_to_subcommand(id, plugin));
    }

    // Auto-generate subcommands for adjustment plugins
    for (id, plugin) in registry.adjustment_iter() {
        let mut sub = plugin_to_subcommand(id, plugin);
        // Every adjustment gets --preset
        sub = sub.arg(
            Arg::new("preset").long("preset")
                .help("Named parameter preset (see `arami presets`)")
        );
        if plugin.accepts_zone() {
            sub = sub.arg(
                Arg::new("zone").long("zone")
                    .help("Named zone to restrict this adjustment")
            ).arg(
                Arg::new("zone-inline").long("zone-inline")
                    .help("Inline zone spec: <type>:<param=val,...>")
                    .conflicts_with("zone")
            );
        }
        root = root.subcommand(sub);
    }

    root
}

fn plugin_to_subcommand(id: &str, plugin: &dyn AdjustmentPlugin) -> clap::Command {
    let name = id.strip_prefix("arami.").unwrap_or(id);
    let schema = plugin.describe();
    let mut cmd = clap::Command::new(name).about(plugin.name());

    for param in &schema.params {
        cmd = cmd.arg(param_descriptor_to_arg(param));
    }
    cmd
}

fn param_descriptor_to_arg(desc: &ParamDescriptor) -> Arg {
    let mut arg = Arg::new(&desc.id)
        .long(&desc.id)
        .help(&desc.description);

    match &desc.param_type {
        ParamType::Float(d) => {
            arg = arg.value_parser(clap::value_parser!(f64))
                .default_value(d.default.to_string());
        }
        ParamType::Bool(_) => {
            arg = arg.action(ArgAction::SetTrue);
        }
        ParamType::Choice(d) => {
            let options: Vec<String> = d.options.iter()
                .map(|o| o.value.clone())
                .collect();
            arg = arg.value_parser(options);
        }
        // ... other types
    }
    arg
}
```

This means adding a new plugin to the registry is sufficient to make it available in the
CLI. No hand-written command code per plugin.

## Validation

Parameter validation is centralized, not per-frontend. The flow:

1. CLI parses raw strings into typed values using `clap` + schema-driven parsers.
2. Values are assembled into a `ParamValues` map.
3. A shared `validate_params(schema, values)` function in `arami-editor` checks ranges,
   required parameters, and type correctness.
4. On success, the graph is mutated. On failure, a structured error names the parameter,
   the constraint, and the offending value.

The same `validate_params` function is called by the WASM bridge, the CLI, and any
future adapter. Error messages are consistent across all frontends.

## Presets

Presets are named parameter sets for a plugin. They reduce verbosity for common
operations and provide discoverable starting points for complex parameters like curves.

### Lookup Order

When `--preset <name>` is specified, the CLI resolves it in order:

1. **User presets**: `~/.config/arami/presets/<plugin-name>/<name>.json`
2. **Built-in presets**: compiled into the binary, shipped with the CLI.

User presets shadow built-in presets of the same name, allowing customization.

### Preset File Format

A preset is a JSON file containing a partial `ParamValues` map:

```json
{
	"name": "tungsten",
	"description": "Warm tungsten / incandescent light correction",
	"params": {
		"temperature": { "Float": 3200.0 },
		"tint": { "Float": 0.05 }
	}
}
```

Only parameters present in the file are set; the rest use schema defaults. Explicit CLI
flags override preset values: `--preset tungsten --tint 0.1` loads the tungsten preset
but replaces its tint with 0.1.

### Built-in Presets

A small set of presets ships with the binary. These cover common operations that would
otherwise require memorizing numeric values or verbose curve point syntax:

| Plugin        | Preset         | Description                               |
| ------------- | -------------- | ----------------------------------------- |
| white-balance | tungsten       | 3200K warm correction                     |
| white-balance | fluorescent    | 4200K with green tint offset              |
| white-balance | daylight       | 5600K neutral daylight                    |
| white-balance | cloudy         | 6500K cool overcast correction            |
| tone-curve    | s-curve-gentle | Mild contrast S-curve                     |
| tone-curve    | s-curve-strong | Punchy contrast S-curve                   |
| tone-curve    | fade           | Lifted blacks for matte film look         |
| monochrome    | high-contrast  | Dramatic BW with strong red/yellow weight |
| monochrome    | soft           | Low-contrast BW, even channel mix         |

Presets are the primary "sugar" for complex parameter types. Rather than inventing a
per-type mini-DSL (e.g. `mid:0.6` for curves), presets provide named, discoverable
shortcuts that generalize across all plugins and all parameter types.

### Discovery

```bash
arami presets                     # list all presets across all plugins
arami presets tone-curve          # list presets for tone-curve
arami plugins tone-curve          # show full parameter schema (for manual values)
```

## Inline Zones

For one-off regional edits, defining a named zone in a separate pipe stage is verbose:

```bash
arami zone luminance --low 0.7 --high 1.0 --name highlights \
  | arami tone-curve --highlights -25 --zone highlights
```

The `--zone-inline` flag creates an anonymous zone directly on the adjustment command:

```bash
arami tone-curve --highlights -25 --zone-inline luminance:low=0.7,high=1.0
```

### Syntax

```
--zone-inline <generator-type>:<param=value,...>
```

The generator type is the zone plugin name (the same names used with `arami zone`). The
parameters use `key=value` pairs separated by commas, matching the plugin's
`ParamSchema` parameter IDs. Omitted parameters use schema defaults.

```bash
# Luminance zone with feathering
--zone-inline luminance:low=0.6,high=1.0,feather=0.15

# Linear gradient
--zone-inline gradient:kind=linear,start_y=0,end_y=0.4

# Color range targeting blue sky
--zone-inline color-range:hue_center=210,hue_range=40,feather=0.1
```

### Behavior

The CLI parses the inline spec, creates an anonymous `ZoneEntry::Generator` in the
graph's zone phase (with an auto-generated name like `_inline_1`), and sets the
adjustment's `ZoneSource::Ref` to it. The anonymous zone is a normal graph entry — it
appears in `arami inspect` output and is preserved in sidecar files.

### Limitations

Inline zones cover the simple single-generator case. For compositions (intersect two
zones, invert, subtract), use explicit `arami zone` commands to define named zones.
`--zone-inline` and `--zone` are mutually exclusive on the same command.

## Examples

### Basic editing pipeline

```bash
arami open photo.dng \
  | arami crop --x 100 --y 50 --width 1800 --height 1200 \
  | arami white-balance --temperature 5800 \
  | arami tone-curve --shadows 15 --highlights -10 \
  | arami clarity --amount 0.3 \
  | arami save result.jpg --quality 92
```

### Presets and inline zones

```bash
# Preset provides named parameter sets — no need to memorize numeric values
arami open photo.dng \
  | arami white-balance --preset tungsten \
  | arami tone-curve --preset s-curve-gentle \
  | arami save result.jpg --quality 92

# Inline zone for one-off regional edit (no separate zone command needed)
arami open landscape.dng \
  | arami tone-curve --highlights -25 --zone-inline luminance:low=0.7,high=1.0 \
  | arami save landscape-edited.jpg

# Preset + override: start from preset, tweak one param
arami open photo.dng \
  | arami white-balance --preset cloudy --tint 0.1 \
  | arami save result.jpg
```

### Zone-based selective editing

```bash
# Composed zones for complex targeting (use named zones when reusing or composing)
arami open landscape.dng \
  | arami zone luminance --low 0.7 --high 1.0 --feather 0.15 --name highlights \
  | arami zone gradient --kind linear --start-y 0 --end-y 0.4 --name sky-grad \
  | arami zone compose --op intersect --left highlights --right sky-grad --name bright-sky \
  | arami tone-curve --highlights -25 --zone bright-sky \
  | arami white-balance --temperature 5200 \
  | arami save landscape-edited.jpg --quality 95
```

### Batch processing with shell tools

```bash
# Apply the same edits to every DNG in a folder
for f in raw/*.dng; do
  arami open "$f" \
    | arami white-balance --temperature 7200 \
    | arami monochrome --strength 0.9 \
    | arami save "output/$(basename "${f%.dng}.jpg")" --quality 90
done
```

```bash
# Parallel batch with GNU parallel
find raw/ -name '*.dng' | parallel -j4 \
  'arami open {} | arami white-balance --temperature 7200 | arami save output/{/.}.jpg'
```

### Apply GUI edits to other images

```bash
# The photographer edits one image in the GUI, producing photo-001.arami
# Apply those same edits to the rest of the series
for f in photo-{002..050}.dng; do
  arami apply photo-001.arami --source "$f" -o "edited/${f%.dng}.jpg"
done
```

### Debugging a pipeline

```bash
arami open photo.dng \
  | arami white-balance --temperature 7500 \
  | arami inspect \
  | arami monochrome --strength 0.8 \
  | arami inspect \
  | arami save result.jpg
```

`inspect` prints the pipeline state to stderr at each point, while forwarding the
session JSON through stdout. Output on stderr:

```
Pipeline (2 nodes):
  1. [crop]           arami.crop            x=100 y=50 w=1800 h=1200
  2. [white-balance]  arami.white-balance   temperature=7500 tint=0

Pipeline (3 nodes):
  1. [crop]           arami.crop            x=100 y=50 w=1800 h=1200
  2. [white-balance]  arami.white-balance   temperature=7500 tint=0
  3. [monochrome]     arami.monochrome      strength=0.8 ...
```

### Saving sidecars for GUI round-trip

```bash
# Edit via CLI, produce a sidecar with full version history
arami open photo.dng \
  | arami white-balance --temperature 7500 \
  | arami tone-curve --preset s-curve-gentle \
  | arami save result.jpg --sidecar
# Writes result.jpg AND result.arami (with 3 version nodes: open, WB, curve)

# Later: open result.arami in the GUI, refine, then re-apply via CLI
arami apply result.arami --source photo.dng -o final.jpg
```

### Composing with jq

Since the pipe token is JSON, standard JSON tools work:

```bash
# Extract the current version tree as JSON for external processing
arami open photo.dng \
  | arami white-balance --temperature 7500 \
  | jq '.versions'

# Inspect just the current graph state
arami open photo.dng \
  | arami white-balance --temperature 7500 \
  | jq '.versions.nodes[.versions.head].snapshot'
```

## Future Phases

### Phase 2: Watch Mode and Bulk Apply

**Watch mode.** A `arami watch photo.dng` command that spawns a lightweight window
(using winit + wgpu or Tauri webview) and listens to EditGraph changes via stdin or a
socket. The user tweaks parameters via piped CLI commands and sees the result rendered on
GPU in real time, without discrete save/open cycles.

**Bulk apply.** Extend `arami apply` to accept directories as input:

```bash
arami apply photo-001.arami --input raw/ --output edited/
```

In this mode, arami handles iterating over supported file types, dispatching to the
engine with rayon-based parallelism. This is faster and more portable than shell loops
with GNU parallel, and friendlier for Windows users (cmd/PowerShell).

### Phase 3: Daemon Mode

For batch workloads where per-invocation image decoding is a bottleneck, an auto-managed
daemon avoids redundant work. Design follows the ssh-agent pattern:

```bash
# Auto-start: first piped command starts the daemon if ARAMI_SOCK is unset
# Explicit start also supported:
eval $(arami daemon start)
# Sets ARAMI_SOCK=/tmp/arami-XXXX.sock and ARAMI_PID=NNNNN

# Commands detect ARAMI_SOCK and become thin clients:
# instead of JSON-pipe mode, each connects to the socket,
# sends its operation, and the daemon holds state in memory.
arami open photo.dng | arami white-balance --temperature 7500 | arami save result.jpg

# Daemon auto-exits after idle timeout (default: 2 minutes)
# Or explicit:
arami daemon stop
```

The daemon holds decoded `PixelBuffer` instances in an LRU cache, the `PluginRegistry`,
and optionally the SegFormer ONNX model. This eliminates per-image decode overhead for
batch operations on the same source.

The CLI interface does not change. When `ARAMI_SOCK` is set, commands connect to the
daemon instead of doing JSON-pipe mode. Same commands, same flags, different execution
strategy.

Protocol: length-prefixed MessagePack over a Unix domain socket. Each message is a
command/response pair matching the `Session` API. The daemon manages sessions by ID,
allowing concurrent processing of different images.

### Phase 4: Embedded Scripting (Rhai)

For automation that exceeds what shell scripting offers (typed variables, conditionals
over image metadata, plugin-aware loops), an embedded scripting language provides a
richer environment without leaving the Arami ecosystem.

Rhai is the candidate: it embeds naturally in Rust, is sandboxed by default, supports
WASM, and has familiar syntax.

```rhai
// arami script process-portfolio.rhai
let files = arami::glob("raw/*.dng");

for path in files {
    let s = arami::open(path);

    s.white_balance(temperature: 6500);

    // Conditional logic based on image metadata
    if s.metadata().iso > 3200 {
        s.denoise(luminance: 0.6, color: 0.4);
    }

    s.tone_curve(shadows: 10, highlights: -15);
    s.save(path.replace(".dng", ".jpg"), quality: 92);
}
```

Rhai types would be registered directly from `Session` methods and plugin schemas,
mirroring the CLI generation pattern. The scripting engine would use the same `Session`
API as the CLI and WASM bridge.

### Phase 5: HTTP API

A REST/WebSocket adapter over `Session` for integration with web services, DAM systems,
and remote processing. Same command protocol, HTTP transport. Out of scope for this
document.

## Relationship to Existing Architecture

The CLI design does not introduce new concepts. It reuses what exists:

| CLI Concept          | Existing Architecture Equivalent                      |
| -------------------- | ----------------------------------------------------- |
| Session              | WASM bridge's EditGraph struct (to be extracted)      |
| Pipe JSON            | `.arami` sidecar format (same serialized VersionTree) |
| Plugin subcommands   | `PluginRegistry` iteration + `ParamSchema`            |
| Parameter validation | Same `ParamSchema` constraints used by GUI            |
| Zone names           | `ZoneEntry` names in `ZonePhase`                      |
| Inline zones         | Anonymous `ZoneEntry::Generator` in `ZonePhase`       |
| Presets              | Partial `ParamValues` files (CLI-layer convenience)   |
| Evaluation           | `PipelineEvaluator::evaluate()`                       |
| `arami apply`        | Sidecar deserialization (existing in versioning)      |

The new code is translation: shell arguments to `ParamValues`, session JSON
serialization, pipe detection, preset resolution, and inline zone parsing. The engine,
plugins, evaluator, and document model are unchanged.
