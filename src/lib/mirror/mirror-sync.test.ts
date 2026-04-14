/**
 * Unit tests for Mirror synchronization logic.
 *
 * The core of Mirror is syncFromTo: given a "source" ViewerState that was just
 * interacted with, copy its zoom level and visible center to a "target"
 * ViewerState.  All math lives in the Rust ViewerState — these tests verify
 * that the JS-side orchestration wires it correctly.
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { initSync, ViewerState } from '../../../src-tauri/seer-viewer-wasm/pkg/seer_viewer_wasm.js';
import type { WasmViewLayout } from '$viewer_wasm/seer_viewer_wasm.js';

beforeAll(() => {
	const wasmPath = resolve(
		__dirname,
		'../../../src-tauri/seer-viewer-wasm/pkg/seer_viewer_wasm_bg.wasm'
	);
	const wasmBytes = readFileSync(wasmPath);
	initSync({ module: wasmBytes });
});

/**
 * Replicates Mirror.svelte's syncFromTo — extracted here so the
 * tests exercise the exact same algorithm without needing Svelte.
 */
function syncFromTo(source: ViewerState, target: ViewerState): WasmViewLayout {
	const zoom = source.zoom_level();
	target.set_zoom(zoom);
	const vr = source.visible_rect();
	const centerX = vr.origin.x + vr.size.width / 2;
	const centerY = vr.origin.y + vr.size.height / 2;
	return target.center_on(centerX, centerY);
}

describe('Mirror sync — same-size images', () => {
	test('initial state: syncing two identical states is a no-op', () => {
		const a = new ViewerState(1920, 1280, 1200, 800);
		const b = new ViewerState(1920, 1280, 1200, 800);

		const layoutBefore = b.layout();
		syncFromTo(a, b);
		const layoutAfter = b.layout();

		expect(layoutAfter.uv_scale[0]).toBeCloseTo(layoutBefore.uv_scale[0], 4);
		expect(layoutAfter.uv_scale[1]).toBeCloseTo(layoutBefore.uv_scale[1], 4);
		expect(layoutAfter.uv_offset[0]).toBeCloseTo(layoutBefore.uv_offset[0], 4);
		expect(layoutAfter.uv_offset[1]).toBeCloseTo(layoutBefore.uv_offset[1], 4);

		a.free();
		b.free();
	});

	test('zoom propagates from source to target', () => {
		// Use a large image so max_zoom > 2.0 (6000x4000 in 1200x800 → max_zoom = 5)
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(6000, 4000, 1200, 800);

		a.set_zoom(2.0);
		syncFromTo(a, b);

		expect(b.zoom_level()).toBeCloseTo(2.0, 4);
		a.free();
		b.free();
	});

	test('pan + sync makes target show same region', () => {
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(6000, 4000, 1200, 800);

		// Zoom in and pan source
		a.set_zoom(3.0);
		a.pan(200, 150);
		syncFromTo(a, b);

		const vrA = a.visible_rect();
		const vrB = b.visible_rect();

		// Centers should match closely
		const centerAx = vrA.origin.x + vrA.size.width / 2;
		const centerAy = vrA.origin.y + vrA.size.height / 2;
		const centerBx = vrB.origin.x + vrB.size.width / 2;
		const centerBy = vrB.origin.y + vrB.size.height / 2;

		expect(centerBx).toBeCloseTo(centerAx, 0);
		expect(centerBy).toBeCloseTo(centerAy, 0);
		expect(b.zoom_level()).toBeCloseTo(3.0, 4);

		a.free();
		b.free();
	});

	test('repeated syncs converge (A→B then B→A is stable)', () => {
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(6000, 4000, 1200, 800);

		a.set_zoom(2.5);
		a.pan(100, -80);

		syncFromTo(a, b);
		syncFromTo(b, a);

		// After round-trip, both should agree
		expect(a.zoom_level()).toBeCloseTo(b.zoom_level(), 4);

		const vrA = a.visible_rect();
		const vrB = b.visible_rect();
		expect(vrA.origin.x).toBeCloseTo(vrB.origin.x, 0);
		expect(vrA.origin.y).toBeCloseTo(vrB.origin.y, 0);
		expect(vrA.size.width).toBeCloseTo(vrB.size.width, 0);
		expect(vrA.size.height).toBeCloseTo(vrB.size.height, 0);

		a.free();
		b.free();
	});
});

describe('Mirror sync — different-size images', () => {
	test('zoom level propagates even with different image dimensions', () => {
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(3000, 2000, 1200, 800);

		a.set_zoom(2.0);
		syncFromTo(a, b);

		expect(b.zoom_level()).toBeCloseTo(2.0, 4);
		a.free();
		b.free();
	});

	test('visible center aligns when source center is within target bounds', () => {
		// Both images share the same canvas, different content sizes.
		// Position source center at (1500, 1000) — within the 3000×2000 target.
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(3000, 2000, 1200, 800);

		a.set_zoom(2.0);
		a.center_on(1500, 1000);
		syncFromTo(a, b);

		const vrA = a.visible_rect();
		const vrB = b.visible_rect();

		const centerAx = vrA.origin.x + vrA.size.width / 2;
		const centerAy = vrA.origin.y + vrA.size.height / 2;
		const centerBx = vrB.origin.x + vrB.size.width / 2;
		const centerBy = vrB.origin.y + vrB.size.height / 2;

		// When source center is within target bounds, centers should agree
		expect(centerBx).toBeCloseTo(centerAx, 0);
		expect(centerBy).toBeCloseTo(centerAy, 0);

		a.free();
		b.free();
	});

	test('center_on clamps when source center exceeds target bounds', () => {
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(3000, 2000, 1200, 800);

		// Default center of 6000×4000 at zoom 2 is (3000, 2000) — beyond 3000×2000
		a.set_zoom(2.0);
		syncFromTo(a, b);

		const vrB = b.visible_rect();
		const centerBx = vrB.origin.x + vrB.size.width / 2;
		const centerBy = vrB.origin.y + vrB.size.height / 2;

		// Target should clamp to its own content bounds
		expect(centerBx).toBeLessThanOrEqual(3000);
		expect(centerBy).toBeLessThanOrEqual(2000);
		expect(centerBx).toBeGreaterThanOrEqual(0);
		expect(centerBy).toBeGreaterThanOrEqual(0);

		a.free();
		b.free();
	});

	test('different canvas sizes: zoom syncs but visible rect differs', () => {
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(6000, 4000, 600, 400);

		a.set_zoom(2.0);
		a.pan(100, 50);
		syncFromTo(a, b);

		// Zoom levels match
		expect(b.zoom_level()).toBeCloseTo(2.0, 4);

		// Centers match
		const vrA = a.visible_rect();
		const vrB = b.visible_rect();
		const centerAx = vrA.origin.x + vrA.size.width / 2;
		const centerAy = vrA.origin.y + vrA.size.height / 2;
		const centerBx = vrB.origin.x + vrB.size.width / 2;
		const centerBy = vrB.origin.y + vrB.size.height / 2;

		expect(centerBx).toBeCloseTo(centerAx, 0);
		expect(centerBy).toBeCloseTo(centerAy, 0);

		a.free();
		b.free();
	});
});

describe('Mirror sync — edge cases', () => {
	test('sync at zoom 1.0 (fit-to-canvas)', () => {
		const a = new ViewerState(1920, 1280, 1200, 800);
		const b = new ViewerState(1920, 1280, 1200, 800);

		// No zoom change — should still sync cleanly
		syncFromTo(a, b);

		expect(b.zoom_level()).toBeCloseTo(1.0, 4);
		a.free();
		b.free();
	});

	test('sync at max zoom', () => {
		const a = new ViewerState(1920, 1280, 1200, 800);
		const b = new ViewerState(1920, 1280, 1200, 800);

		const max = a.max_zoom();
		a.set_zoom(max);
		syncFromTo(a, b);

		expect(b.zoom_level()).toBeCloseTo(max, 4);
		a.free();
		b.free();
	});

	test('sync after resize_canvas', () => {
		const a = new ViewerState(6000, 4000, 1200, 800);
		const b = new ViewerState(6000, 4000, 1200, 800);

		a.set_zoom(2.0);
		a.pan(100, 100);

		// Simulate a canvas resize on the target
		b.resize_canvas(800, 600);
		syncFromTo(a, b);

		// Zoom should still propagate
		expect(b.zoom_level()).toBeCloseTo(2.0, 4);

		a.free();
		b.free();
	});

	test('bidirectional: zoom left then zoom right produces consistent state', () => {
		const left = new ViewerState(6000, 4000, 1200, 800);
		const right = new ViewerState(6000, 4000, 1200, 800);

		// User zooms left panel
		left.zoom(200, 600, 400);
		syncFromTo(left, right);

		// User then zooms right panel
		right.zoom(-100, 600, 400);
		syncFromTo(right, left);

		// Both should have the same zoom
		expect(left.zoom_level()).toBeCloseTo(right.zoom_level(), 4);

		left.free();
		right.free();
	});
});
