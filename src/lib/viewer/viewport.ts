/**
 * Viewport layout — thin WASM bridge over seer_viewer::viewport.
 *
 * Types mirror seer_viewer::geometry — see docs/dev/conventions.md.
 * All math lives in Rust; this module only handles WASM init and call forwarding.
 */

import wasmInit, {
	compute_view_layout as wasmComputeViewLayout,
	ViewerState,
	FramerState
} from '$viewer_wasm/seer_viewer_wasm.js';

export { ViewerState, FramerState };
import wasmUrl from '$viewer_wasm/seer_viewer_wasm_bg.wasm?url';

export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface Rect {
	origin: Point;
	size: Size;
}

export type DisplayMode = 'Contain' | 'Cover';

export interface ViewLayout {
	content_rect: Rect;
	frame_rect: Rect;
	uv_scale: [number, number];
	uv_offset: [number, number];
	mat_bounds: [number, number, number, number];
}

let initialized = false;

/** One-time WASM module initialization. Idempotent — safe to call multiple times. */
export async function initViewportWasm(): Promise<void> {
	if (initialized) return;
	await wasmInit({ module_or_path: wasmUrl });
	initialized = true;
}

/** Compute view layout via WASM. Must call `initViewportWasm()` first. */
export function computeViewLayout(
	content: Size,
	canvas: Size,
	mode: DisplayMode = 'Contain'
): ViewLayout {
	return wasmComputeViewLayout(
		content.width,
		content.height,
		canvas.width,
		canvas.height,
		mode
	) as ViewLayout;
}
