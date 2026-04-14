# Extending Seer — Plugin Author Guide

This guide covers how to write plugins for Seer's image editing pipeline. Seer's
core adjustments use the exact same plugin interface as third-party plugins — there
are no special code paths. Everything documented here is what the built-in White
Balance, Tone Curve, Sharpen, etc. actually use.

## Table of Contents

- [The Plugin Model](#the-plugin-model)
- [Writing a Pixel Adjustment Plugin](#writing-a-pixel-adjustment-plugin)
- [Writing a Zone Generator Plugin](#writing-a-zone-generator-plugin)
- [ParamSchema Reference](#paramschema-reference)
- [Testing Your Plugin](#testing-your-plugin)
- [Packaging](#packaging)
- [Trust Tiers](#trust-tiers)
- [Complete Example: Film Emulation](#complete-example-film-emulation)

---

## The Plugin Model

Seer plugins follow a **declare-process** model:

1. **Declare parameters** — Your plugin returns a `ParamSchema` describing what
   controls the UI should render (sliders, toggles, dropdowns, curve editors, etc.)
2. **Process pixels** — Your plugin receives a `PixelBuffer` (f32 RGB) and a
   `ParamValues` map, then returns a new `PixelBuffer`.

The host handles everything else:

- UI rendering (auto-generated from your schema)
- Parameter storage and serialization
- Zone blending (selective adjustments)
- History tracking (undo/redo)
- Pipeline evaluation and caching
- rAF coalescing for responsive slider interaction

You never write UI code. You never handle zones. You never manage state.

### What the Host Provides

| Capability            | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| Auto-generated UI     | Sliders, toggles, dropdowns, curve editors — all from your schema |
| Zone blending         | Your plugin processes the full image; the host applies zone masks |
| History integration   | Parameter changes are tracked automatically                       |
| Pipeline caching      | Unchanged adjustments aren't re-evaluated                         |
| Sidecar serialization | Your params are saved/loaded with the edit session                |
| Error recovery        | If your plugin fails, the pipeline continues without it           |

### Plugin IDs

Every plugin has a unique reverse-domain ID:

```
seer.white-balance       — built-in (reserved seer.* namespace)
com.filmdev.emulation    — third-party
org.astro.stacking       — third-party
```

The `seer.*` namespace is reserved for built-in plugins. Third-party plugins
use reverse-domain notation.

---

## Writing a Pixel Adjustment Plugin

A pixel adjustment receives the output of the previous pipeline step and produces
a new image. Here's the minimal structure:

### The `AdjustmentPlugin` Trait

```rust
use seer_editor::pixel_buffer::PixelBuffer;
use seer_editor::plugin::*;

pub struct InvertPlugin;

impl AdjustmentPlugin for InvertPlugin {
    fn id(&self) -> &str {
        "com.example.invert"
    }

    fn name(&self) -> &str {
        "Invert"
    }

    fn category(&self) -> AdjustmentCategory {
        AdjustmentCategory::Creative
    }

    fn describe(&self) -> ParamSchema {
        ParamSchema {
            params: vec![
                ParamDescriptor {
                    id: "strength".into(),
                    label: "Strength".into(),
                    description: "How much to invert (0 = no change, 1 = full invert)".into(),
                    param_type: ParamType::Float(FloatParamDesc {
                        min: 0.0,
                        max: 1.0,
                        default: 1.0,
                        step: 0.01,
                    }),
                    group: None,
                },
            ],
            groups: vec![],
        }
    }

    fn process(
        &self,
        input: &PixelBuffer,
        params: &ParamValues,
        _ctx: &AdjustmentContext,
    ) -> Result<PixelBuffer, String> {
        let strength = params
            .get("strength")
            .and_then(|v| v.as_float())
            .unwrap_or(1.0) as f32;

        let data: Vec<f32> = input
            .data
            .iter()
            .map(|&v| v * (1.0 - strength) + (1.0 - v) * strength)
            .collect();

        Ok(PixelBuffer {
            width: input.width,
            height: input.height,
            data,
        })
    }
}
```

### Key Concepts

**PixelBuffer format:**

- f32 RGB interleaved, row-major: `[R, G, B, R, G, B, ...]`
- Nominal range [0, 1], but values may exceed this during pipeline processing
- `data.len() == width * height * 3`
- Your output must have the same dimensions as the input

**ParamValues:**

- A `HashMap<String, ParamValue>` keyed by parameter ID
- Always use `.get("id").and_then(|v| v.as_float())` with a fallback default
- Values are validated by the host before reaching your plugin

**AdjustmentContext:**

- `source_path` — path to the original image file
- `source_width`, `source_height` — original image dimensions
- `pipeline_index` — this adjustment's position (0-based)
- `pipeline_length` — total pipeline size
- `class_map` — optional semantic segmentation data (ADE20K classes)

**Categories:**

- `Source` — source image input (reserved for `seer.source`)
- `Color` — white balance, color grading, color space transforms
- `Tone` — curves, levels, exposure, highlights/shadows
- `Detail` — sharpening, denoising, clarity, texture
- `Creative` — film emulation, color lookup, split toning
- `Correction` — lens correction, perspective, chromatic aberration
- `Ai` — AI-powered operations

Categories are metadata for UI grouping and pipeline ordering suggestions.
They don't constrain what your plugin does.

### Registering Your Plugin

For compiled-in plugins (same repo), register in `PluginRegistry::core()`:

```rust
// In seer-editor/src/registry.rs
reg.register_adjustment(Box::new(my_plugin::InvertPlugin));
```

For third-party WASM plugins, registration happens automatically when the
`.seerplugin` package is loaded.

---

## Writing a Zone Generator Plugin

Zone generators produce grayscale masks that control where adjustments are applied.
The host handles zone composition (boolean union, intersection, subtraction, inversion)
and blending.

### The `ZoneGeneratorPlugin` Trait

```rust
use seer_editor::pixel_buffer::PixelBuffer;
use seer_editor::plugin::*;
use seer_editor::zone::ZoneBuffer;

pub struct EdgeDetectZonePlugin;

impl ZoneGeneratorPlugin for EdgeDetectZonePlugin {
    fn id(&self) -> &str {
        "com.example.edge-detect-zone"
    }

    fn name(&self) -> &str {
        "Edge Detect Zone"
    }

    fn describe(&self) -> ParamSchema {
        ParamSchema {
            params: vec![
                ParamDescriptor {
                    id: "threshold".into(),
                    label: "Threshold".into(),
                    description: "Edge detection threshold".into(),
                    param_type: ParamType::Float(FloatParamDesc {
                        min: 0.0,
                        max: 1.0,
                        default: 0.1,
                        step: 0.01,
                    }),
                    group: None,
                },
            ],
            groups: vec![],
        }
    }

    fn generate(
        &self,
        source: &PixelBuffer,
        params: &ParamValues,
        _ctx: &ZoneContext,
    ) -> Result<ZoneBuffer, String> {
        let threshold = params
            .get("threshold")
            .and_then(|v| v.as_float())
            .unwrap_or(0.1) as f32;

        let w = source.width as usize;
        let h = source.height as usize;
        let mut mask = vec![0.0f32; w * h];

        // Simple Sobel-like edge detection
        for y in 1..h - 1 {
            for x in 1..w - 1 {
                let idx = |x: usize, y: usize| (y * w + x) * 3;
                let lum = |i: usize| {
                    source.data[i] * 0.2126 + source.data[i + 1] * 0.7152 + source.data[i + 2] * 0.0722
                };

                let gx = lum(idx(x + 1, y)) - lum(idx(x - 1, y));
                let gy = lum(idx(x, y + 1)) - lum(idx(x, y - 1));
                let magnitude = (gx * gx + gy * gy).sqrt();

                mask[y * w + x] = if magnitude > threshold { 1.0 } else { 0.0 };
            }
        }

        Ok(ZoneBuffer {
            width: source.width,
            height: source.height,
            data: mask,
        })
    }
}
```

### Key Concepts

**ZoneBuffer format:**

- f32 grayscale, one value per pixel: `[M, M, M, ...]`
- Range [0, 1] — 0 means "don't apply adjustment here", 1 means "fully apply"
- `data.len() == width * height`

**ZoneContext:**

- `source_width`, `source_height` — source image dimensions
- `class_map` — optional semantic segmentation data

**Zone composition** is handled entirely by the host. Your generator produces
a single mask. Users combine masks using boolean operations (union, intersection,
subtraction) and inversion in the zone editor.

---

## ParamSchema Reference

The `ParamSchema` describes what controls the host should render. Each parameter
has a type, constraints, and optional grouping.

### Parameter Types

#### Float

Continuous floating-point value. Renders as a slider.

```rust
ParamType::Float(FloatParamDesc {
    min: 0.0,
    max: 1.0,
    default: 0.5,
    step: 0.01,    // slider step size
})
```

Runtime: `ParamValue::Float(f64)` — extract with `v.as_float()`

#### Int

Integer value. Renders as a slider or stepper.

```rust
ParamType::Int(IntParamDesc {
    min: 1,
    max: 100,
    default: 8,
})
```

Runtime: `ParamValue::Int(i64)` — extract with `v.as_int()`

#### Bool

Boolean toggle. Renders as a checkbox or switch.

```rust
ParamType::Bool(BoolParamDesc {
    default: true,
})
```

Runtime: `ParamValue::Bool(bool)` — extract with `v.as_bool()`

#### Choice

Selection from a fixed list. Renders as a dropdown.

```rust
ParamType::Choice(ChoiceParamDesc {
    options: vec![
        ChoiceOption { value: 0, label: "Linear".into() },
        ChoiceOption { value: 1, label: "Radial".into() },
    ],
    default: 0,
})
```

Runtime: `ParamValue::Choice(u32)` — extract with `v.as_choice()`

#### Color

RGB color value. Renders as a color picker.

```rust
ParamType::Color(ColorParamDesc {
    default: [1.0, 0.5, 0.0],  // f32 RGB
})
```

Runtime: `ParamValue::Color(f32, f32, f32)`

#### Curve

Editable spline curve (control points). Renders as a curve editor.

```rust
use seer_editor::processing::tone_curve::ControlPoint;

ParamType::Curve(CurveParamDesc {
    default: vec![
        ControlPoint { x: 0.0, y: 0.0 },
        ControlPoint { x: 1.0, y: 1.0 },
    ],
})
```

Runtime: `ParamValue::Curve(Vec<ControlPoint>)` — extract with `v.as_curve()`

#### Point

2D position (normalized coordinates 0–1). Renders as a draggable point on the canvas.

```rust
ParamType::Point(PointParamDesc {
    default_x: 0.5,
    default_y: 0.5,
})
```

Runtime: `ParamValue::Point(f32, f32)`

#### Rect

Axis-aligned rectangle (normalized coordinates). Renders as a draggable rectangle.

```rust
ParamType::Rect(RectParamDesc {
    default: [0.0, 0.0, 1.0, 1.0],  // x, y, width, height
})
```

Runtime: `ParamValue::Rect(f32, f32, f32, f32)`

#### Strokes

Brush stroke data. Used by the brush zone generator for painted selections.

```rust
ParamType::Strokes(StrokesParamDesc)
```

Runtime: `ParamValue::Strokes(Vec<BrushStroke>)` — extract with `v.as_strokes()`

### Parameter Groups

Group related parameters under collapsible headers:

```rust
ParamSchema {
    params: vec![
        ParamDescriptor {
            id: "intensity".into(),
            label: "Intensity".into(),
            description: "Overall effect strength".into(),
            param_type: ParamType::Float(FloatParamDesc {
                min: 0.0, max: 1.0, default: 0.8, step: 0.01,
            }),
            group: None,  // ungrouped — appears at top level
        },
        ParamDescriptor {
            id: "grain".into(),
            label: "Grain".into(),
            description: "Film grain amount".into(),
            param_type: ParamType::Float(FloatParamDesc {
                min: 0.0, max: 1.0, default: 0.3, step: 0.01,
            }),
            group: Some("texture".into()),
        },
        ParamDescriptor {
            id: "grain_size".into(),
            label: "Grain Size".into(),
            description: "Grain particle size".into(),
            param_type: ParamType::Float(FloatParamDesc {
                min: 0.5, max: 3.0, default: 1.0, step: 0.1,
            }),
            group: Some("texture".into()),
        },
    ],
    groups: vec![
        ParamGroup {
            id: "texture".into(),
            label: "Texture".into(),
            collapsed: false,
        },
    ],
}
```

This renders as:

```
Intensity     ──────────●──── 0.80

▸ Texture
  Grain       ──●──────────── 0.30
  Grain Size  ──●──────────── 1.0
```

---

## Testing Your Plugin

Every plugin should pass these standard tests:

### 1. Identity Test

At default parameters, output should approximately equal input:

```rust
#[test]
fn identity_at_defaults() {
    let input = PixelBuffer {
        width: 4,
        height: 4,
        data: vec![0.5; 4 * 4 * 3],
    };
    let params = default_params(&MyPlugin.describe());
    let ctx = AdjustmentContext {
        source_path: "test.png",
        source_width: 4,
        source_height: 4,
        pipeline_index: 1,
        pipeline_length: 2,
        class_map: None,
    };

    let output = MyPlugin.process(&input, &params, &ctx).unwrap();
    assert_eq!(output.width, input.width);
    assert_eq!(output.height, input.height);
    // At default params, output should be close to input
    for (a, b) in input.data.iter().zip(output.data.iter()) {
        assert!((a - b).abs() < 1e-6, "identity violated: {} vs {}", a, b);
    }
}
```

### 2. Dimensions Preserved

Output dimensions must always match input:

```rust
#[test]
fn preserves_dimensions() {
    let input = PixelBuffer {
        width: 100,
        height: 50,
        data: vec![0.3; 100 * 50 * 3],
    };
    let params = /* non-default params */;
    let output = MyPlugin.process(&input, &params, &ctx).unwrap();
    assert_eq!(output.width, 100);
    assert_eq!(output.height, 50);
    assert_eq!(output.data.len(), 100 * 50 * 3);
}
```

### 3. No NaN/Inf

Output must contain no NaN or infinity values:

```rust
#[test]
fn no_nan_or_inf() {
    let output = MyPlugin.process(&input, &params, &ctx).unwrap();
    for (i, &v) in output.data.iter().enumerate() {
        assert!(v.is_finite(), "NaN/Inf at pixel index {}: {}", i / 3, v);
    }
}
```

### 4. Determinism

Same input + params must produce bitwise identical output:

```rust
#[test]
fn deterministic() {
    let output1 = MyPlugin.process(&input, &params, &ctx).unwrap();
    let output2 = MyPlugin.process(&input, &params, &ctx).unwrap();
    assert_eq!(output1.data, output2.data);
}
```

### 5. Reasonable Output Range

For well-behaved plugins, output should stay within a reasonable HDR range:

```rust
#[test]
fn output_in_range() {
    let output = MyPlugin.process(&input, &params, &ctx).unwrap();
    for &v in &output.data {
        assert!(v >= -1.0 && v <= 2.0, "value out of range: {}", v);
    }
}
```

### Running Tests

```bash
cargo test -p seer-editor
```

For the built-in plugins, all tests live alongside the plugin implementations
and the processing functions they delegate to.

---

## Packaging

Third-party plugins are distributed as `.seerplugin` packages — zip archives
containing:

```
com.example.my-plugin-1.0.0.seerplugin
├── manifest.toml        # Plugin metadata
├── plugin.wasm          # Compiled WASM binary
├── resources/           # Optional bundled data
│   └── luts/
│       └── my-lut.cube
└── icon.png             # Optional icon (64x64)
```

### manifest.toml

```toml
[plugin]
id = "com.example.my-plugin"
name = "My Plugin"
version = "1.0.0"
seer-api = "1.0"
description = "Does something cool with pixels"
author = "Your Name"
license = "MIT"

[plugin.type]
kind = "adjustment"     # or "zone-generator"
category = "creative"   # color, tone, detail, creative, correction, ai

[capabilities]
# Most plugins need no special capabilities
# filesystem = { read = ["~/.seer/models/"], write = [] }
# network = { allowed_hosts = ["api.example.com"] }

[resources]
include = ["resources/**/*"]
```

### Installation

- **Manual**: Place the `.seerplugin` file in `~/.seer/plugins/`
- **Developer mode**: Point Seer at a local directory for rapid iteration

---

## Trust Tiers

Seer uses a layered trust model:

| Tier          | Namespace    | Vetting                    | Description                                 |
| ------------- | ------------ | -------------------------- | ------------------------------------------- |
| **Core**      | `seer.*`     | CI-tested, ships with Seer | Built-in adjustments and zones              |
| **Verified**  | `verified.*` | Reviewed by Seer team      | Passes automated test suite + manual review |
| **Community** | `contrib.*`  | Automated tests only       | Community-published, user reviews visible   |
| **Local**     | any          | None                       | Sideloaded from disk, developer use         |

The test harness validates:

1. Identity test (default params produce identity)
2. Determinism (same input → same output)
3. Dimensions preserved
4. No NaN/Inf in output
5. Output values in reasonable range
6. Completes within timeout (default 30s for 24MP)
7. Peak memory within limit (default 512 MB)
8. Idempotence (applying twice ≈ applying once, where applicable)

---

## Complete Example: Film Emulation

A full adjustment plugin that applies film stock color grading with grain.

```rust
use seer_editor::pixel_buffer::PixelBuffer;
use seer_editor::plugin::*;

/// Film emulation with stock-specific color grading and grain.
pub struct FilmEmulationPlugin;

impl AdjustmentPlugin for FilmEmulationPlugin {
    fn id(&self) -> &str {
        "com.filmdev.emulation"
    }

    fn name(&self) -> &str {
        "Film Emulation"
    }

    fn category(&self) -> AdjustmentCategory {
        AdjustmentCategory::Creative
    }

    fn describe(&self) -> ParamSchema {
        ParamSchema {
            params: vec![
                ParamDescriptor {
                    id: "stock".into(),
                    label: "Film Stock".into(),
                    description: "Which film stock to emulate".into(),
                    param_type: ParamType::Choice(ChoiceParamDesc {
                        options: vec![
                            ChoiceOption { value: 0, label: "Portra 400".into() },
                            ChoiceOption { value: 1, label: "Ektar 100".into() },
                            ChoiceOption { value: 2, label: "Tri-X 400".into() },
                        ],
                        default: 0,
                    }),
                    group: None,
                },
                ParamDescriptor {
                    id: "intensity".into(),
                    label: "Intensity".into(),
                    description: "Overall effect strength".into(),
                    param_type: ParamType::Float(FloatParamDesc {
                        min: 0.0,
                        max: 1.0,
                        default: 0.8,
                        step: 0.01,
                    }),
                    group: None,
                },
                ParamDescriptor {
                    id: "grain".into(),
                    label: "Grain".into(),
                    description: "Film grain intensity".into(),
                    param_type: ParamType::Float(FloatParamDesc {
                        min: 0.0,
                        max: 1.0,
                        default: 0.3,
                        step: 0.01,
                    }),
                    group: Some("texture".into()),
                },
                ParamDescriptor {
                    id: "vignette".into(),
                    label: "Vignette".into(),
                    description: "Edge darkening".into(),
                    param_type: ParamType::Float(FloatParamDesc {
                        min: -1.0,
                        max: 1.0,
                        default: 0.2,
                        step: 0.01,
                    }),
                    group: Some("optical".into()),
                },
            ],
            groups: vec![
                ParamGroup {
                    id: "texture".into(),
                    label: "Texture".into(),
                    collapsed: false,
                },
                ParamGroup {
                    id: "optical".into(),
                    label: "Optical".into(),
                    collapsed: true,
                },
            ],
        }
    }

    fn process(
        &self,
        input: &PixelBuffer,
        params: &ParamValues,
        _ctx: &AdjustmentContext,
    ) -> Result<PixelBuffer, String> {
        let stock = params.get("stock").and_then(|v| v.as_choice()).unwrap_or(0);
        let intensity = params.get("intensity").and_then(|v| v.as_float()).unwrap_or(0.8) as f32;
        let grain = params.get("grain").and_then(|v| v.as_float()).unwrap_or(0.3) as f32;
        let vignette = params.get("vignette").and_then(|v| v.as_float()).unwrap_or(0.2) as f32;

        // Film stock color adjustments (simplified)
        let (r_mul, g_mul, b_mul) = match stock {
            0 => (1.05, 1.00, 0.95),  // Portra: warm
            1 => (1.10, 1.05, 0.90),  // Ektar: saturated warm
            2 => (1.00, 1.00, 1.00),  // Tri-X: neutral (will be B&W)
            _ => (1.00, 1.00, 1.00),
        };

        let w = input.width as usize;
        let h = input.height as usize;
        let cx = w as f32 / 2.0;
        let cy = h as f32 / 2.0;
        let max_dist = (cx * cx + cy * cy).sqrt();

        let mut data = Vec::with_capacity(input.data.len());

        for y in 0..h {
            for x in 0..w {
                let i = (y * w + x) * 3;
                let mut r = input.data[i];
                let mut g = input.data[i + 1];
                let mut b = input.data[i + 2];

                // Apply stock color grading (blended by intensity)
                r = r * (1.0 - intensity) + r * r_mul * intensity;
                g = g * (1.0 - intensity) + g * g_mul * intensity;
                b = b * (1.0 - intensity) + b * b_mul * intensity;

                // Simple vignette
                if vignette.abs() > 0.001 {
                    let dx = x as f32 - cx;
                    let dy = y as f32 - cy;
                    let dist = (dx * dx + dy * dy).sqrt() / max_dist;
                    let v = 1.0 - dist * dist * vignette;
                    r *= v;
                    g *= v;
                    b *= v;
                }

                // Simple grain (deterministic pseudo-random)
                if grain > 0.0 {
                    let hash = ((x * 73856093) ^ (y * 19349663)) as f32 / u32::MAX as f32;
                    let noise = (hash - 0.5) * grain * 0.1;
                    r += noise;
                    g += noise;
                    b += noise;
                }

                data.push(r);
                data.push(g);
                data.push(b);
            }
        }

        Ok(PixelBuffer {
            width: input.width,
            height: input.height,
            data,
        })
    }
}
```

The host automatically generates this UI from the schema:

```
┌─ Film Emulation ──────────────────────┐
│                                       │
│  Film Stock    [▼ Portra 400      ]   │
│  Intensity     ──────────●──── 0.80   │
│                                       │
│  ▸ Texture                            │
│    Grain       ──●──────────── 0.30   │
│                                       │
│  ▸ Optical (collapsed)                │
│    Vignette    ─────●──────── 0.20    │
└───────────────────────────────────────┘
```

The plugin gets automatic undo/redo, zone blending, sidecar serialization,
pipeline caching, and rAF-coalesced slider updates — all for free.
