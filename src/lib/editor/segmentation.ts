/**
 * JS-side SegFormer B0 (ADE20K) inference via onnxruntime-web.
 *
 * Runs segmentation once per source image, producing a class_map (Uint8Array)
 * that is passed to WASM for per-region semantic tone adjustments.
 */

import * as ort from 'onnxruntime-web';

const MODEL_PATH = '/models/segformer-b0-ade-512.onnx';
const MODEL_INPUT_SIZE = 512;

// ImageNet normalization constants
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

// Point onnxruntime-web to the WASM binaries copied into static/ort-wasm/
ort.env.wasm.wasmPaths = '/ort-wasm/';
// Suppress harmless ORT warnings (cpuid in WASM, EP fallback for shape ops)
ort.env.logSeverityLevel = 3;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/** Lazy-load the ONNX model (cached globally). */
export function loadSegformerModel(): Promise<ort.InferenceSession> {
	if (!sessionPromise) {
		sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
			executionProviders: ['webgpu', 'wasm']
		}).catch((err) => {
			sessionPromise = null;
			throw err;
		});
	}
	return sessionPromise;
}

export interface SegmentationResult {
	data: Uint8Array;
	width: number;
	height: number;
}

/**
 * Run SegFormer inference on an ImageData.
 *
 * 1. Resize to 512x512
 * 2. Normalize with ImageNet mean/std
 * 3. Run inference → logits [1, 150, 128, 128]
 * 4. Argmax per pixel
 * 5. Nearest-neighbor upscale to original dimensions
 */
export async function runSegmentation(imageData: ImageData): Promise<SegmentationResult> {
	const session = await loadSegformerModel();

	const origW = imageData.width;
	const origH = imageData.height;

	// Resize to model input size using OffscreenCanvas
	const resizeCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
	const ctx = resizeCanvas.getContext('2d')!;

	// Draw imageData onto a temporary canvas first, then draw scaled
	const srcCanvas = new OffscreenCanvas(origW, origH);
	const srcCtx = srcCanvas.getContext('2d')!;
	srcCtx.putImageData(imageData, 0, 0);
	ctx.drawImage(srcCanvas, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

	const resized = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

	// Convert to float32 CHW tensor with ImageNet normalization
	const pixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
	const inputData = new Float32Array(3 * pixels);

	for (let i = 0; i < pixels; i++) {
		const base = i * 4; // RGBA
		for (let c = 0; c < 3; c++) {
			inputData[c * pixels + i] =
				(resized.data[base + c] / 255.0 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
		}
	}

	const inputTensor = new ort.Tensor('float32', inputData, [
		1,
		3,
		MODEL_INPUT_SIZE,
		MODEL_INPUT_SIZE
	]);

	// Run inference
	const results = await session.run({ pixel_values: inputTensor });

	// Extract logits — shape [1, 150, outH, outW] (typically 128x128 for SegFormer B0)
	const logits = results.logits;
	if (!logits) {
		throw new Error('Model did not return logits tensor');
	}

	const logitsData = logits.data as Float32Array;
	const [, numClasses, outH, outW] = logits.dims;

	// Argmax per pixel on the logits grid
	const classMapSmall = new Uint8Array(outH * outW);
	for (let i = 0; i < outH * outW; i++) {
		let maxVal = -Infinity;
		let maxIdx = 0;
		for (let c = 0; c < numClasses; c++) {
			const val = logitsData[c * outH * outW + i];
			if (val > maxVal) {
				maxVal = val;
				maxIdx = c;
			}
		}
		classMapSmall[i] = maxIdx;
	}

	// Return at model output resolution — the Rust zone code handles
	// resizing to image dimensions with bilinear interpolation.
	// Avoids allocating a full-resolution class map (e.g., 60MP = 60 MB)
	// which would cause WASM OOM during zone evaluation.
	return { data: classMapSmall, width: outW, height: outH };
}
