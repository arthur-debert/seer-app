/**
 * TypeScript ↔ WASM bridge tests.
 *
 * These verify that the wasm-pack output loads in a JS environment and
 * that computeViewLayout returns the expected structure. They catch:
 * WASM init failures, JS↔WASM type mismatches, module resolution bugs.
 *
 * The math itself is tested exhaustively in Rust (cargo test).
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Import directly from the wasm-pack output (not through $wasm alias)
// to avoid SvelteKit alias resolution in vitest's Node environment.
import {
	initSync,
	compute_view_layout,
	ViewerState
} from '../../../wasm/seer-viewer-wasm/pkg/seer_viewer_wasm.js';

beforeAll(() => {
	const wasmPath = resolve(
		__dirname,
		'../../../wasm/seer-viewer-wasm/pkg/seer_viewer_wasm_bg.wasm'
	);
	const wasmBytes = readFileSync(wasmPath);
	initSync({ module: wasmBytes });
});

describe('WASM bridge — computeViewLayout', () => {
	test('returns expected fields for Contain mode', () => {
		const result = compute_view_layout(1920, 1280, 1200, 800, 'Contain');

		expect(result).toHaveProperty('content_rect');
		expect(result).toHaveProperty('frame_rect');
		expect(result).toHaveProperty('uv_scale');
		expect(result).toHaveProperty('uv_offset');

		expect(result.content_rect).toHaveProperty('origin');
		expect(result.content_rect).toHaveProperty('size');
		expect(result.content_rect.origin).toHaveProperty('x');
		expect(result.content_rect.origin).toHaveProperty('y');
		expect(result.content_rect.size).toHaveProperty('width');
		expect(result.content_rect.size).toHaveProperty('height');
	});

	test('exact fit produces full UV coverage', () => {
		// 3:2 image in 3:2 canvas — perfect fit, no letterbox
		const result = compute_view_layout(1920, 1280, 1200, 800, 'Contain');

		expect(result.uv_scale[0]).toBeCloseTo(1.0, 4);
		expect(result.uv_scale[1]).toBeCloseTo(1.0, 4);
		expect(result.uv_offset[0]).toBeCloseTo(0.0, 4);
		expect(result.uv_offset[1]).toBeCloseTo(0.0, 4);
	});

	test('pillarbox produces x offset for portrait in landscape', () => {
		const result = compute_view_layout(800, 1200, 1200, 800, 'Contain');

		expect(result.uv_scale[0]).toBeLessThan(1.0);
		expect(result.uv_scale[1]).toBeCloseTo(1.0, 4);
		expect(result.uv_offset[0]).toBeGreaterThan(0);
		expect(result.uv_offset[1]).toBeCloseTo(0.0, 4);
	});

	test('Cover mode fills canvas', () => {
		const result = compute_view_layout(800, 1200, 1200, 800, 'Cover');

		expect(result.content_rect.size.width).toBeGreaterThanOrEqual(1200 - 0.001);
		expect(result.content_rect.size.height).toBeGreaterThanOrEqual(800 - 0.001);
	});

	test('invalid mode throws', () => {
		expect(() => compute_view_layout(100, 100, 100, 100, 'Stretch')).toThrow();
	});
});

describe('WASM bridge — ViewerState', () => {
	test('constructor returns object with expected methods', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		expect(typeof vs.pan).toBe('function');
		expect(typeof vs.zoom).toBe('function');
		expect(typeof vs.set_zoom).toBe('function');
		expect(typeof vs.resize_canvas).toBe('function');
		expect(typeof vs.set_display_mode).toBe('function');
		expect(typeof vs.reset).toBe('function');
		expect(typeof vs.layout).toBe('function');
		expect(typeof vs.zoom_level).toBe('function');
		expect(typeof vs.zoom_percentage).toBe('function');
		expect(typeof vs.max_zoom).toBe('function');
		expect(typeof vs.free).toBe('function');
		vs.free();
	});

	test('initial layout matches compute_view_layout Contain result', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const layout = vs.layout();
		const direct = compute_view_layout(1920, 1280, 1200, 800, 'Contain');

		expect(layout.uv_scale[0]).toBeCloseTo(direct.uv_scale[0], 4);
		expect(layout.uv_scale[1]).toBeCloseTo(direct.uv_scale[1], 4);
		expect(layout.uv_offset[0]).toBeCloseTo(direct.uv_offset[0], 4);
		expect(layout.uv_offset[1]).toBeCloseTo(direct.uv_offset[1], 4);
		vs.free();
	});

	test('zoom_level starts at 1.0', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		expect(vs.zoom_level()).toBeCloseTo(1.0, 4);
		vs.free();
	});

	test('zoom_percentage reflects contain scale', () => {
		// 6000×4000 in 1200×800: contain_scale = min(1200/6000, 800/4000) = 0.2 → 20%
		const vs = new ViewerState(6000, 4000, 1200, 800);
		expect(vs.zoom_percentage()).toBeCloseTo(20.0, 0);
		vs.free();
	});

	test('max_zoom returns expected value', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		expect(vs.max_zoom()).toBeGreaterThan(1.0);
		vs.free();
	});

	test('pan returns valid ViewLayout', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const layout = vs.pan(10, 20);
		expect(layout).toHaveProperty('uv_scale');
		expect(layout).toHaveProperty('uv_offset');
		expect(layout).toHaveProperty('content_rect');
		expect(layout).toHaveProperty('frame_rect');
		vs.free();
	});

	test('zoom changes uv_scale', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const before = vs.layout();
		// Zoom at center — verify layout changes
		vs.zoom(100, 600, 400);
		const after = vs.layout();
		expect(after.uv_scale[0]).not.toBeCloseTo(before.uv_scale[0], 2);
		vs.free();
	});

	test('set_zoom / zoom_level roundtrip', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const max = vs.max_zoom();
		const target = Math.min(1.5, max);
		vs.set_zoom(target);
		expect(vs.zoom_level()).toBeCloseTo(target, 4);
		vs.free();
	});

	test('set_zoom clamps below 1.0', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		vs.set_zoom(0.5);
		expect(vs.zoom_level()).toBeCloseTo(1.0, 4);
		vs.free();
	});

	test('set_zoom clamps above max_zoom', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const max = vs.max_zoom();
		vs.set_zoom(max + 100);
		expect(vs.zoom_level()).toBeCloseTo(max, 4);
		vs.free();
	});

	test('resize_canvas returns updated layout', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const layout = vs.resize_canvas(800, 600);
		expect(layout).toHaveProperty('uv_scale');
		expect(layout).toHaveProperty('uv_offset');
		vs.free();
	});

	test('reset returns to initial state', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		const initial = vs.layout();
		vs.zoom(200, 600, 400);
		vs.pan(50, 50);
		const resetLayout = vs.reset();
		expect(resetLayout.uv_scale[0]).toBeCloseTo(initial.uv_scale[0], 4);
		expect(resetLayout.uv_scale[1]).toBeCloseTo(initial.uv_scale[1], 4);
		expect(resetLayout.uv_offset[0]).toBeCloseTo(initial.uv_offset[0], 4);
		expect(resetLayout.uv_offset[1]).toBeCloseTo(initial.uv_offset[1], 4);
		vs.free();
	});

	test('pan at zoom > 1 changes offset', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		vs.set_zoom(2.0);
		const before = vs.layout();
		vs.pan(50, 50);
		const after = vs.layout();
		// At least one offset should have changed
		const offsetChanged =
			Math.abs(after.uv_offset[0] - before.uv_offset[0]) > 1e-6 ||
			Math.abs(after.uv_offset[1] - before.uv_offset[1]) > 1e-6;
		expect(offsetChanged).toBe(true);
		vs.free();
	});

	test('free does not throw', () => {
		const vs = new ViewerState(1920, 1280, 1200, 800);
		expect(() => vs.free()).not.toThrow();
	});

	test('visible_rect returns full content at zoom 1', () => {
		const vs = new ViewerState(6000, 4000, 1200, 800);
		const vr = vs.visible_rect();
		expect(vr.size.width).toBeCloseTo(6000, 0);
		expect(vr.size.height).toBeCloseTo(4000, 0);
		vs.free();
	});

	test('visible_rect shrinks when zoomed in', () => {
		const vs = new ViewerState(6000, 4000, 1200, 800);
		vs.set_zoom(2.0);
		const vr = vs.visible_rect();
		expect(vr.size.width).toBeCloseTo(3000, 0);
		expect(vr.size.height).toBeCloseTo(2000, 0);
		vs.free();
	});

	test('center_on returns valid layout', () => {
		const vs = new ViewerState(6000, 4000, 1200, 800);
		vs.set_zoom(2.0);
		const layout = vs.center_on(3000, 2000);
		expect(layout).toHaveProperty('uv_scale');
		expect(layout).toHaveProperty('content_rect');
		vs.free();
	});
});
