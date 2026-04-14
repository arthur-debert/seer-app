Scene-Referred Color Pipeline

Seer's pipeline moves from display-referred sRGB to a scene-referred Linear Rec. 2020 working space. This document describes the architecture: what changes, what stays, and how the pieces fit together.

The core insight is that both source paths (RAW via libraw and standard images via the `image` crate) already output linear f32 data. The pipeline was treating it as gamma-encoded. This migration makes the linear assumption explicit, widens the gamut to Rec. 2020, and adds a proper Output Device Transform (ODT) to convert scene data to display.


1. Working Space

    The working space is Linear Rec. 2020 — all pixel data inside the pipeline is linear-light, wide-gamut f32 RGB in Rec. 2020 primaries.

    Why Rec. 2020 over sRGB: Rec. 2020 covers 99.9% of visible colors in photography. It is large enough to avoid clipping real-world colors during editing, small enough that standard operations (exposure, convolutions, matrix math) behave predictably without the numerical instability of imaginary primaries.

    Why not ACES: ACES (AP0/AP1) is designed for film production pipelines with OCIO. It introduces complexity (imaginary primaries in AP0, a separate ACES color management framework) that adds engineering cost without benefit for a photo editor using ICC profiles.

    Why not ProPhoto/ROMM RGB: ProPhoto's green and blue primaries are imaginary — they represent colors outside human vision. This causes three problems: per-channel tone mapping produces hue shifts, HSL/color editing tools produce unexpected results, and aggressive edits can generate NaN or negative values. The architecture supports adding ProPhoto later through the `WorkingSpace` trait, but it requires a more complex view transform and gamut-mapping strategy.

    1.1. The WorkingSpace Trait

        The trait abstracts over different working spaces. It supplies the 3x3 matrices for converting to and from CIE XYZ (D65-adapted), luminance weights, and a gamut boundary descriptor for future gamut mapping. [^1]

        The built-in implementation is `LinearRec2020`. A `LinearSrgb` implementation exists for testing and reference. Adding a new working space (e.g., ProPhoto) means implementing this trait and providing the appropriate view transform — the rest of the pipeline is agnostic.

    1.2. Document-Level Configuration

        The working space is a document-level setting, not a per-adjustment choice. It is available to plugins through an extended `AdjustmentContext` that carries a reference to the active `WorkingSpace`. Plugins that need color science constants (luminance weights, XYZ matrices) read them from the context rather than hardcoding values.


2. Pipeline Phases

    The pipeline has six phases, strictly ordered:

    - Source — decode image bytes, convert to Linear Rec. 2020
    - Geometry — crop, rotate, perspective (color-space agnostic)
    - Zones — mask generation (luminance weights updated for Rec. 2020)
    - Adjustments — all tonal and color processing in Linear Rec. 2020
    - ODT — scene-referred to display-referred conversion
    - Output — encode display-ready data to file bytes

    The evaluator remains color-space agnostic. It chains plugins without knowing what color space the pixels are in. Conversions happen at the boundaries: source plugins convert in, the ODT converts out.

    2.1. Source Conversion

        Standard images (JPEG, PNG, TIFF, WebP) are decoded by the `image` crate to linear sRGB f32. The `StandardSourcePlugin` then applies a 3x3 matrix (via kolor-64) to convert from linear sRGB to linear Rec. 2020.

        RAW/DNG files are decoded by libraw-wasm in the browser with `gamm=[1,1]` (linear output) and `useCameraWb=true`. The data arrives in the WASM bridge as linear sRGB f32. The same matrix conversion is applied after `from_rgb_f32()`.

        Both paths produce a `PixelBuffer` tagged as `LinearRec2020`.

    2.2. The ODT

        The Output Device Transform is not a pipeline adjustment. It is a separate transform applied after all adjustments, stored as document-level configuration on the `EditGraph`. Users cannot reorder it relative to adjustments — this prevents accidentally editing display-referred data with scene-referred tools.

        The ODT is consumed in two places: the display path (before `to_rgba_u8()` for screen rendering) and the export path (before encoder `encode()` for file output).


3. Output Device Transform

    The ODT converts unbounded linear scene data into bounded display-ready sRGB. It is implemented as a plugin via the `OdtPlugin` trait. [^2]

    3.1. Sigmoid Tone Mapper

        The core ODT is a sigmoid curve applied in luminance-chromaticity space. The algorithm:

        - Compute luminance Y from Rec. 2020 weights
        - Extract chromaticity ratios (R/Y, G/Y, B/Y), guarding near-zero Y
        - Apply sigmoid compression to Y
        - Reconstruct RGB from compressed Y and original ratios
        - Soft gamut clip to sRGB (desaturate toward achromatic if out-of-gamut)
        - Convert Linear Rec. 2020 to Linear sRGB (3x3 matrix)
        - Apply sRGB EOTF inverse (gamma encoding)

        The luminance-chromaticity decomposition is critical. A naive per-channel sigmoid on wide-gamut data causes massive hue shifts in highlights because it compresses R, G, and B independently. By compressing only luminance and preserving chromaticity ratios, hues stay stable across the full exposure range.

        Parameters: contrast (sigmoid steepness), midgray (pivot point, default 0.18), and highlight rolloff (shoulder shape). The sigmoid function is `Y_out = Y^n / (Y^n + σ^n)` where n controls contrast and σ controls the pivot.

    3.2. Gamut Mapping

        After tone mapping, some pixels may lie outside the sRGB gamut (valid in Rec. 2020 but not representable in sRGB). The gamut mapper uses a binary search in Oklch: it reduces chroma while preserving hue and lightness until the color is in-gamut. This is the CSS Color Module Level 4 algorithm — well-documented, perceptually uniform, and about 50 lines of code.

    3.3. Future ODTs

        The `OdtPlugin` trait allows additional view transforms (filmic, AGX-style) without changing the pipeline. Each ODT is registered in the plugin registry with an ID like `seer.odt.sigmoid` or `seer.odt.filmic`.


4. Per-Tool Color Spaces

    Some tools need to work in a perceptual color space rather than the linear working space. The `ToolColorSpace` trait provides per-pixel conversion between the working space and a tool-specific space. [^3]

    4.1. Oklch for Hue and Saturation

        The Color Mixer and Color Range zone generator need to manipulate hue and saturation. In a linear RGB space, these concepts are not perceptually uniform — a +10 saturation boost looks completely different at different luminance levels and in different parts of the gamut.

        Oklch (the polar form of Oklab) solves this. It separates lightness (L), chroma (C), and hue (h) into perceptually uniform axes. A hue shift of 30 degrees in Oklch produces a visually consistent rotation regardless of brightness or saturation. A chroma boost of 0.05 produces a visually consistent saturation increase across the gamut.

        kolor-64 provides the conversions natively: Rec. 2020 to XYZ to Oklab to Oklch and back. The `OklchToolSpace` implementation wraps these conversions behind the `ToolColorSpace` trait. This means the Color Mixer works in Oklch from day one — no interim sRGB roundtrip hack.

    4.2. Why Not HSL

        HSL (Hue, Saturation, Lightness) was designed for sRGB displays in the 1970s. It has three problems in a wide-gamut linear pipeline:

        - It assumes gamma-encoded input. Applying HSL to linear data produces wrong hue classifications.
        - It is not perceptually uniform. Equal steps in HSL saturation produce wildly different visual changes depending on the hue.
        - "Hue" in HSL depends on which RGB primaries define the space. Red in sRGB and red in Rec. 2020 point to different spectral locations.

        Oklch eliminates all three problems. It works on any input (via XYZ intermediary), it is perceptually uniform by design, and hue is defined in a device-independent color appearance model.


5. Plugin Audit

    Each existing plugin falls into one of three categories.

    5.1. Linear-Safe (No Changes)

        These plugins perform math that works identically in any linear color space:

        - Tone Curve — spline LUT applied per-channel, pure math on values
        - Sharpen — unsharp mask (Gaussian blur + difference), a linear convolution
        - Crop — rectangular extraction, no color math
        - Rotate — affine transform with bilinear interpolation
        - Perspective — projective transform with bilinear interpolation

    5.2. Luminance Weight Updates

        These plugins use hardcoded Rec. 709 luminance weights (0.2126, 0.7152, 0.0722) that must be replaced with Rec. 2020 weights (0.2627, 0.6780, 0.0593):

        - Monochrome — weighted sum for grayscale conversion
        - CLAHE — luminance extraction for histogram equalization
        - Clarity — luminance for midtone detection
        - Zone Luminance — luminance thresholding for mask generation

        CLAHE also needs a log-encoded luminance for histogramming, because scene-referred linear values can exceed 1.0. The log encoding maps the practical scene range (0 to ~16 stops) into [0, 1] for binning.

        Clarity's midtone bell curve needs adjustment for linear domain. In gamma space, midtones center at 0.5. In linear scene data, middle gray is 0.18. The bell curve uses a Reinhard-like compression `x = lum / (lum + 1.0)` before the `4x(1-x)` weighting, which naturally centers around 0.18 in linear space.

    5.3. Color Space Dependent (Rewrite)

        White Balance:
            Applies Bradford adaptation through Rec. 2020-to-XYZ matrices (via kolor-64). No gamma encode/decode — input is already linear. The Bradford math is standard; only the enclosing color space matrices differ from a sRGB pipeline.

        Color Mixer:
            Channel gains (R/G/B multipliers) operate directly in linear Rec. 2020. Hue-range selection, hue shifts, and saturation adjustments operate in Oklch via the `OklchToolSpace`. This is perceptually correct and color-space agnostic.

        Zone Color Range:
            Uses Oklch for hue detection, matching the Color Mixer approach.

        Denoise:
            The bilateral filter's range kernel uses cube root of each channel for range distance (`dr = cbrt(cr) - cbrt(nr)`), which approximates perceptual uniformity in linear scene-referred data. This prevents over-smoothing darks, where absolute RGB differences are much smaller than in highlights. The spatial kernel and blending weights are unchanged.


6. Crate Dependencies

    Three crates are added:

    kolor-64:
        Color space conversions (24 built-in spaces including Rec. 2020, sRGB, ProPhoto, Oklab, Oklch), chromatic adaptation (Bradford, Von Kries, CAT02), raw 3x3 matrix extraction. Supports no_std and WASM. This replaces the hand-rolled matrix math currently in white_balance.rs and provides Oklch for the Color Mixer.

    glam:
        Fast 3x3 matrix math via `DMat3` and `DVec3`. Supports no_std and WASM with SIMD128. kolor-64 already depends on it internally. Used for composing color transforms and the ODT's matrix operations.

    moxcms:
        Pure Rust ICC profile reader/writer. Creates standard profiles (sRGB, Rec. 2020, ProPhoto), reads embedded profiles from images, embeds profiles in output files. Native-side only (Tauri), not WASM. Faster than lcms2 in benchmarks.

    Tone mapping and gamut mapping are written in-house. They are 10-50 lines of math each, and full control over the curve shape matters for an editor's visual identity.


7. PixelBuffer Metadata

    `PixelBuffer` gains an advisory `ColorSpaceTag` field:

    - `LinearRec2020` — default, all pipeline-internal buffers
    - `LinearSrgb` — after source decode, before working space conversion
    - `DisplaySrgb` — after ODT, gamma-encoded, ready for screen or encoder

    The tag is for assertions and debugging. The evaluator does not dispatch on it. It prevents accidental mixing — if a buffer tagged `DisplaySrgb` enters an adjustment plugin, something went wrong.


8. Migration Order (Completed)

    The migration landed in five steps, each keeping tests green except for one coordinated batch.

    (1) Infrastructure — added `color_space.rs` with traits, constants, kolor-64 wrappers, `ColorSpaceTag` on `PixelBuffer`, `OdtPlugin` trait, registry slot.

    (2) ODT plugin — implemented `SigmoidOdtPlugin` with unit tests.

    (3) Source + plugin rewrites (coordinated batch) — source plugins apply sRGB-to-Rec2020 matrix, all color-dependent plugins rewritten simultaneously, tests updated. Landed as one commit.

    (4) Wire ODT — ODT applied in display path (before `to_rgba_u8`) and export path (before `encode`). ODT config stored on `EditGraph`.

    (5) Cleanup — removed dead sRGB gamma functions from processing modules, updated code-walkthrough.lex.


[^1]:

    pub trait WorkingSpace: Send + Sync {
        fn id(&self) -> &str;
        fn name(&self) -> &str;
        fn to_xyz(&self) -> [[f64; 3]; 3];
        fn from_xyz(&self) -> [[f64; 3]; 3];
        fn luminance_weights(&self) -> [f64; 3];
        fn gamut_boundary(&self) -> GamutBoundary;
    }

:: rust ::

[^2]:

    pub trait OdtPlugin: Send + Sync {
        fn id(&self) -> &str;
        fn name(&self) -> &str;
        fn describe(&self) -> ParamSchema;
        fn transform(
            &self,
            input: &PixelBuffer,
            params: &ParamValues,
            working_space: &dyn WorkingSpace,
        ) -> Result<PixelBuffer, String>;
    }

:: rust ::

[^3]:

    pub trait ToolColorSpace: Send + Sync {
        fn id(&self) -> &str;
        fn from_working(&self, pixel: [f64; 3], ws: &dyn WorkingSpace) -> [f64; 3];
        fn to_working(&self, pixel: [f64; 3], ws: &dyn WorkingSpace) -> [f64; 3];
    }

:: rust ::
