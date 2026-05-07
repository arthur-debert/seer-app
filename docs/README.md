# Arami — Vision

## The Problem with Professional Photo Editing

Professional image editing tools are iterations on 1980s-viable approaches.
Every major editor — Lightroom, Capture One, Darktable — presents the same
interaction model: open an image, stare at a blank slate of sliders, and
manually figure out what each region of the image needs. The photographer
already knows: the sky needs darkening, the skin needs lifting, the foliage
needs separation. This is basic craft. The tedious part is identifying the
regions and dialing in starting points.

These tools have added AI features, but as consumer-oriented "magic buttons" —
opaque transforms that produce new pixels with no insight into what changed or
why. A professional who needs to refine the result is back to manual work,
often fighting the AI's decisions rather than building on them.

And outside the editor, a deeper problem persists: **photography tools conflate
images with files.** One image, one file, one set of metadata. This assumption
is baked into every major application and it breaks in practice.

A portrait of your grandmother might exist as a color rendering and a
monochrome rendering (two editorial directions), multiple iterations within
each rendering, and a 3:2 master alongside a 16:9 crop for web headers and a
4:5 crop for Instagram. Each of those is a separate file. The editing
application treats them as unrelated entities. The photographer knows they are
the same image.

## Arami's Position

Arami rethinks the technical professional and enthusiast editing experience
by leveraging state of the art — AI, modern image processing algorithms, and
computational photography — not for a consumer auto button, but in a pro-grade
experience that adds value while preserving fine-grained control.

The core principle: **intelligence as authoring, not as a black box.**

When Arami applies AI analysis to an image, the output is not new pixels.
It is editable graph primitives — zones, adjustments, curves — expressed
in the same vocabulary the photographer already uses. The AI automates the
tedious parts (region identification, starting-point estimation) and exposes
the result for professional refinement.

## How This Works in Practice

### Semantic Analysis as Foundation

Every image opened in Arami is analyzed by a semantic segmentation model.
The result is a set of zones — sky, person, vegetation, structure — that become
first-class objects in the document. These zones are:

- Visible in the editing UI alongside user-created zones
- Editable with the standard zone tools (brush, refine, combine)
- Used by the system to apply intelligent starting adjustments
- Persistent in the sidecar — part of the processing pipeline, not ephemeral

The semantic analysis is not optional. It is a foundational capability that the
editing experience is built around. Without it, the user would be better served
by a traditional tool.

### Profiles: Intelligent Starting Points

When an image is opened, Arami applies a profile — a set of adjustments
pre-configured with semantic zones. A Monochrome profile might produce:

```text
Source
-> Monochrome (Luminosity preset)
-> ToneCurve [masked: Sky]         — slight pulldown
-> ToneCurve [masked: Vegetation]  — midtone separation
-> ToneCurve [masked: Structure]   — contrast push
-> AutoLevels                      — black/white point stretch
```

The user sees five adjustments in the Processing panel. Each is a standard
editing primitive — inspectable, tweakable, deletable, reorderable. The
photographer can swap the Sky curve for something more dramatic, delete the
Structure adjustment entirely, or add a new one with a Person zone. The
profile is a populated graph, not a different mode.

This is fundamentally different from Lightroom's adaptive presets, which are
opaque: they produce pixels and you adjust sliders that re-run the black box.
Arami decomposes the intelligence into the same primitives the user works
with directly.

### Adjustment-Based Editing

All image transformations are adjustments in a linear pipeline. Each
adjustment:

- Takes RGB input, produces RGB output
- Carries an optional zone describing where the adjustment applies
- Has parameters that default to identity (no visible change)
- Is independently toggleable, reorderable, and removable

There are no composite adjustments with internal sub-stages or hidden
checkboxes. Every operation is one adjustment, one set of parameters, one
optional zone. The complexity comes from composition, not from deeply nested
settings within a single control.

See [specs/edit-pipeline.md](specs/edit-pipeline.md) for the pipeline architecture,
design principles, and adjustment ontology.

## Working Vocabulary

Arami's data model is built on the principle that **images are not files**:

| Term          | Meaning                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Image**     | The photographer's unit of work. A portrait, a landscape. Not a file — a concept that may span many files.                            |
| **Rendering** | One editorial treatment of an image: a color grade, a monochrome conversion, a particular tonal direction.                            |
| **Variant**   | A rendering at a specific crop and output ratio. A 3:2 master and a 4:5 Instagram crop of the same rendering are two variants.        |
| **Source**    | A file that contributes to an image. Usually one (a RAW or exported TIFF), but potentially many (panorama tiles, focus-stack frames). |

An image has one or more renderings. Each rendering has one or more variants.
Each variant maps back to one or more sources.

```
Image
 +-- Rendering: "color, warm grade"
 |    +-- Variant: 3:2 master
 |    +-- Variant: 4:5 Instagram crop
 +-- Rendering: "monochrome, high contrast"
 |    +-- Variant: 3:2 master
 |    +-- Variant: 16:9 web banner
 +-- Sources: [DSC_4210.NEF]
```

Circe's edit graph is what produces a **Rendering**. A Rendering at a specific
crop becomes a **Variant** (via the Crop adjustment in the pipeline, or Framer
applied post-pipeline).

## Arami Suite

Arami is a suite of tools for the photographic workflow:

- **Circe** — non-destructive image editing with a semantic-intelligence-driven
  pipeline. The core editing engine. See [specs/edit-pipeline.md](specs/edit-pipeline.md).
- **Mirrors** — synchronized dual-panel image comparison with shared zoom/pan
  and saved viewpoints. See [specs/mirror-spec.md](specs/mirror-spec.md).
- **Framer** — crop and output variant management with a frame-first
  interaction model. See [specs/framer-spec.md](specs/framer-spec.md).

See [technical-overview.md](dev/technical-overview.md) for the shared technical
architecture.
