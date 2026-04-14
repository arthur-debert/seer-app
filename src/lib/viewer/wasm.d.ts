declare module '$viewer_wasm/seer_viewer_wasm.js' {
	export interface WasmViewLayout {
		content_rect: {
			origin: { x: number; y: number };
			size: { width: number; height: number };
		};
		frame_rect: {
			origin: { x: number; y: number };
			size: { width: number; height: number };
		};
		uv_scale: [number, number];
		uv_offset: [number, number];
		mat_bounds: [number, number, number, number];
	}

	export interface WasmRect {
		origin: { x: number; y: number };
		size: { width: number; height: number };
	}

	export class ViewerState {
		constructor(
			content_width: number,
			content_height: number,
			canvas_width: number,
			canvas_height: number
		);
		free(): void;
		pan(dx: number, dy: number): WasmViewLayout;
		zoom(delta: number, anchor_x: number, anchor_y: number): WasmViewLayout;
		set_zoom(zoom: number): WasmViewLayout;
		resize_canvas(width: number, height: number): WasmViewLayout;
		set_display_mode(mode: string): WasmViewLayout;
		reset(): WasmViewLayout;
		layout(): WasmViewLayout;
		zoom_level(): number;
		zoom_percentage(): number;
		max_zoom(): number;
		visible_rect(): WasmRect;
		center_on(content_x: number, content_y: number): WasmViewLayout;
		set_zoom_limits(min_pct: number, max_pct: number): WasmViewLayout;
		set_zoom_percentage(percentage: number): WasmViewLayout;
		fit_percentage(): number;
		is_fit(): boolean;
		set_mat_fraction(fraction: number): WasmViewLayout;
		mat_fraction(): number;
	}

	export class FramerState {
		constructor(
			image_width: number,
			image_height: number,
			viewport_width: number,
			viewport_height: number,
			ratio_w: number,
			ratio_h: number
		);
		free(): void;
		pan(dx: number, dy: number): WasmViewLayout;
		zoom(delta: number, anchor_x: number, anchor_y: number): WasmViewLayout;
		set_ratio(ratio_w: number, ratio_h: number): WasmViewLayout;
		resize_viewport(width: number, height: number): WasmViewLayout;
		reset(): WasmViewLayout;
		layout(): WasmViewLayout;
		frame_rect(): WasmRect;
		crop_rect(): WasmRect;
		zoom_level(): number;
		zoom_percentage(): number;
		max_zoom(): number;
		visible_rect(): WasmRect;
		center_on(content_x: number, content_y: number): WasmViewLayout;
	}

	export default function init(
		input?: string | URL | Request | { module_or_path: string | URL | Request }
	): Promise<void>;

	export function initSync(input: { module: BufferSource | WebAssembly.Module }): void;

	export function compute_view_layout(
		content_width: number,
		content_height: number,
		canvas_width: number,
		canvas_height: number,
		mode: string
	): WasmViewLayout;
}

declare module '$viewer_wasm/seer_viewer_wasm_bg.wasm?url' {
	const url: string;
	export default url;
}
