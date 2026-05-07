# Core Imaging Algorithms — Library Picks

> **Decision record (Feb 2026).** This document captures library evaluations
> at a point in time. Specific library versions and statuses may have changed.
> Verify against crates.io before adopting.

Arami's imaging stack: Tauri v2 + wgpu shaders (WGSL), pure-Rust preferred, MIT/BSD/Apache licensing only.

---

## 1. Color Space Conversions

sRGB, Linear RGB, Lab, XYZ, ProPhoto RGB, Display P3, Oklab, chromatic adaptation.

| Library        | License          | Pure Rust | Role                                                                                                                                                                                                                                                                                                            |
| -------------- | ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`kolor-64`** | MIT / Apache-2.0 | Yes       | **Primary.** 24 built-in color spaces (Rec. 2020, sRGB, Oklab, Oklch, ProPhoto, Display P3, etc.). Chromatic adaptation (Bradford, Von Kries, CAT02). Raw 3x3 matrix extraction. no_std + WASM support, f64 precision. Arami's `color_space.rs` wraps kolor-64 with `BulkConversion` for per-pixel performance. |

For ICC profile handling (embedded camera/monitor profiles):

| Library      | License                | Pure Rust  | Role                                                                                                              |
| ------------ | ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| **`moxcms`** | BSD-3 / Apache-2.0     | Yes (SIMD) | **Pure-Rust ICC engine.** AVX2/SSE/NEON. Actively developed. Handles RGB-RGB, CMYK-RGB, Lab-RGB via ICC profiles. |
| **`lcms2`**  | MIT (bindings + C lib) | No (C)     | **Fallback.** Gold-standard ICC engine. Thread-safe. Consider only if `moxcms` hits a gap.                        |

---

## 2. Image Scaling / Resampling

High-quality resize with 30+ filter options, color-space-aware scaling, sharpening integration.

| Library                 | License            | Pure Rust  | Role                                                                                                                                                                                                                                                |
| ----------------------- | ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pic-scale`**         | BSD-3 / Apache-2.0 | Yes (SIMD) | **Primary.** 30+ resampling filters (Lanczos, Mitchell, CatmullRom, Hermite, etc.). Can scale in Lab, Oklab, Linear, Sigmoidal — dramatically improves downscaling quality vs naive sRGB scaling. AVX-512/AVX2/SSE/NEON/WASM SIMD. 8-bit, f16, f32. |
| **`fast_image_resize`** | MIT / Apache-2.0   | Yes (SIMD) | **Speed-only cases.** Fastest pure-Rust resizer, but no color-space-aware scaling. Good for thumbnails where perceptual quality is less critical.                                                                                                   |

The `image` crate's built-in `imageops::resize` is adequate for basic presets but not for Mirrors' pixel-peeping use case.

---

## 3. Pixel Snapping / Subpixel Handling

Precise subpixel sampling for zoom/pan, geometric transforms, coordinate rounding strategies.

No dedicated crate. Handled by:

- **wgpu shaders** — WGSL shaders with configurable interpolation (nearest for pixel-peeping, bilinear/bicubic for smooth pan). This is the right place.
- **`imageproc`** (MIT, pure Rust) — Affine/projective transforms with configurable interpolation for CPU-side operations.
- **`pic-scale`** — Handles subpixel precision internally in its resampling pipeline.

No extra dependency needed.

---

## 4. Tone Mapping / Curve Adjustments

Parametric curves (like Lightroom), HDR-to-SDR tone mapping, exposure/contrast/highlights/shadows.

| Library         | License            | Pure Rust | Role                                                                                                                                         |
| --------------- | ------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **`gainforge`** | BSD-3 / Apache-2.0 | Yes       | **HDR tone mapping.** Ultra HDR / ISO 21496-1 Gain Map, ICC CICP tags.                                                                       |
| **`splines`**   | BSD-3              | Yes       | **Custom parametric curves.** Piecewise spline interpolation with mixed types per section. Build Lightroom-style tone curves on top of this. |

Basic parametric adjustments (exposure in f-stops, contrast, gamma) are trivial per-pixel math in `kolor-64`'s linear-light space. A tone curve is a 1D LUT lookup after spline evaluation.

---

## 5. White Balance

Per-channel gain multiplication + chromatic adaptation transforms.

No dedicated crate needed. The algorithm is:

1. Read R/G/B multipliers from RAW metadata (or user-selected white point)
2. Apply channel gains in linear space
3. Optionally apply Bradford chromatic adaptation (already in `kolor-64`)

Trivially implementable. `kolor-64` provides the Bradford matrix.

---

## 6. Demosaicing (Debayering) — RAW Files

Convert Bayer-pattern sensor data to full-color images.

This is the biggest licensing pain point:

| Library          | License           | Pure Rust | Status                                                                               |
| ---------------- | ----------------- | --------- | ------------------------------------------------------------------------------------ |
| **`rawkit`**     | Apache-2.0        | Yes       | Only Sony ARW. GSoC project from Graphite editor. Actively expanding.                |
| `rawler`         | **LGPL-2.1**      | Yes       | Broad camera support (Canon, Nikon, Sony, Fuji, Panasonic, Olympus). Part of dnglab. |
| `rawloader`      | **LGPL-2.1**      | Yes       | Low activity since ~2020.                                                            |
| `imagepipe`      | **LGPL-3.0**      | Yes       | Full pipeline but LGPL.                                                              |
| LibRaw (`rsraw`) | **LGPL-2.1/CDDL** | No (C++)  | 400+ cameras, gold standard.                                                         |

Options:

- **If RAW is not needed yet**: Skip entirely, work with decoded formats (JPEG/TIFF/PNG/HEIF from camera or Lightroom exports).
- **If RAW is needed**: `rawler` via dynamic linking (LGPL allows this) is the most pragmatic path for broad camera support. Alternatively, contribute to `rawkit` to expand camera support.
- **DNG as intermediate**: Use Adobe DNG Converter (free) as a pre-processing step, then parse DNG (TIFF-based, handled by the `image` crate).

---

## 7. Lens Corrections

Geometric distortion, vignetting, chromatic aberration (CA).

Complete gap in the Rust ecosystem. No crate or bindings exist.

| Approach                      | License          | Effort                                                                                                                                                |
| ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Custom implementation**     | N/A              | Medium. Brown-Conrady polynomial distortion model is ~50 lines. Vignetting is a radial gain. CA is per-channel geometric shift. Well-documented math. |
| **lensfun** via FFI           | LGPL-3.0 (C)     | Low effort, but LGPL. Huge correction database for real lenses.                                                                                       |
| **OpenCV** via `opencv` crate | Apache-2.0 + MIT | Very heavy dependency for just lens correction.                                                                                                       |

Recommendation: custom implementation. For Mirrors, assume images arrive already corrected (most RAW processors apply lens corrections).

---

## 8. Noise Reduction

Bilateral, NLMeans, wavelet denoising.

| Library               | License                 | Pure Rust | Role                                           |
| --------------------- | ----------------------- | --------- | ---------------------------------------------- |
| **`zune-imageprocs`** | MIT / Apache-2.0 / Zlib | Yes       | Bilateral filter (edge-preserving).            |
| **`imageproc`**       | MIT                     | Yes       | Gaussian blur, median filter. Building blocks. |

Gap: no NLMeans, BM3D, or wavelet denoising exists in Rust with a liberal license.

Path forward: bilateral filter from `zune-imageprocs` covers the common case. NLMeans (~200 lines, parallelizes well with rayon) as custom implementation later. GPU compute shader in wgpu for performance.

---

## 9. Sharpening

Unsharp mask (USM), local contrast / clarity, edge-aware sharpening.

| Library          | License          | Pure Rust | Role                                                                                                                                                                   |
| ---------------- | ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`sharpy`**     | MIT              | Yes       | **Primary.** Unsharp mask (configurable radius/strength/threshold), high-pass sharpen, edge enhancement (Sobel/Prewitt), clarity (local contrast). Rayon parallelized. |
| `image` built-in | MIT / Apache-2.0 | Yes       | `imageops::unsharpen` — basic, adequate for basic use cases.                                                                                                           |

For deconvolution sharpening (Richardson-Lucy): no crate exists. Would require `rustfft` (MIT / Apache-2.0) + custom implementation.

For Mirrors: sharpening lives in WGSL shaders (unsharp mask as a post-process pass). `sharpy` is for CPU-side batch processing.

---

## 10. HDR / Exposure Blending

Merge bracketed exposures, tone-map HDR to SDR.

| Library         | License            | Pure Rust | Role                                                      |
| --------------- | ------------------ | --------- | --------------------------------------------------------- |
| **`gainforge`** | BSD-3 / Apache-2.0 | Yes       | HDR-to-SDR tone mapping, Ultra HDR gain maps.             |
| **`image-hdr`** | MIT                | Yes       | Bracket merging via Poisson noise estimator. Early stage. |

Not a priority currently, but `gainforge` is the right pick when needed.

---

## Recommended Core Stack

```
kolor-64         — Color math (24 spaces, chromatic adaptation, f64, WASM)
moxcms           — ICC profile handling (pure Rust)
pic-scale        — High-quality, color-space-aware image scaling
sharpy           — Unsharp mask, clarity, edge sharpening (CPU)
imageproc        — Geometric transforms, filters, convolutions
gainforge        — HDR tone mapping
splines          — Parametric curve interpolation
rustfft          — FFT building block (future deconvolution/NR)
image            — Codec I/O (already in use)
```

All MIT / BSD-3 / Apache-2.0. All pure Rust (no C dependencies).

---

## Known Gaps

| Gap                          | Severity                                | Path Forward                                                                                  |
| ---------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| **RAW demosaicing**          | Low (Mirrors works with decoded images) | `rawler` via dynamic linking (LGPL), or DNG as intermediate format, or expand `rawkit`        |
| **Lens corrections**         | Low (assume pre-corrected images)       | Custom Brown-Conrady + radial vignette + per-channel CA when needed                           |
| **Advanced noise reduction** | Medium                                  | Bilateral filter now; NLMeans custom implementation later; GPU compute shader for performance |
| **Deconvolution sharpening** | Low                                     | `rustfft` + custom Richardson-Lucy when needed                                                |

---

## Notable: the `awxkee` ecosystem

The `awxkee` author maintains `pic-scale`, `colorutils-rs`, `moxcms`, and `gainforge` — all BSD-3/Apache-2.0, all SIMD-optimized, all actively maintained with hundreds of commits. This is effectively a coherent imaging toolkit and the closest thing to a "liberally-licensed darktable algorithms" collection in Rust.
