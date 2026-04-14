/**
 * Canvas overlay infrastructure — Layer 0 of the three-layer architecture.
 *
 * Provides the prop contract, coordinate mapping, and overlay registry.
 * See docs/specs/canvas-interaction.md for the full design.
 */

import type { Component } from 'svelte';
import type { ViewLayout, Size } from '$lib/viewer/viewport';
import type { ParamValues } from './editor-bridge';
import CropOverlay from './CropOverlay.svelte';

// ---------------------------------------------------------------------------
// Standard overlay props (Layer 0 contract)
// ---------------------------------------------------------------------------

/** Standard props passed to every canvas overlay component. */
export interface OverlayProps {
	/** Current adjustment parameters. */
	params: ParamValues;
	/** Viewport transform: maps image coords ↔ screen coords. */
	layout: ViewLayout;
	/** Input image dimensions in pixels. */
	imageSize: Size;
	/** Emit parameter updates (same path as edit panel sliders). */
	onParamChange: (params: ParamValues) => void;
}

// ---------------------------------------------------------------------------
// Coordinate mapping
// ---------------------------------------------------------------------------

/** Bidirectional mapping between normalized, image-pixel, and CSS screen spaces. */
export interface CoordMap {
	/** Convert normalized [0,1] image coords to CSS pixels relative to canvas. */
	normalizedToScreen(nx: number, ny: number): { x: number; y: number };
	/** Convert CSS pixels (relative to canvas) to normalized [0,1] image coords. */
	screenToNormalized(sx: number, sy: number): { x: number; y: number };
	/** Image area in CSS pixels relative to the canvas element. */
	imageScreenRect: { x: number; y: number; width: number; height: number };
}

/**
 * Create a coordinate mapper from viewport layout.
 *
 * ViewLayout.content_rect is in canvas-pixel (DPR-scaled) coordinates.
 * Overlay SVG uses CSS pixels, so we divide by DPR.
 */
export function coordMap(layout: ViewLayout): CoordMap {
	const dpr = window.devicePixelRatio;
	const cr = layout.content_rect;

	const cssX = cr.origin.x / dpr;
	const cssY = cr.origin.y / dpr;
	const cssW = cr.size.width / dpr;
	const cssH = cr.size.height / dpr;

	return {
		normalizedToScreen(nx: number, ny: number) {
			return { x: cssX + nx * cssW, y: cssY + ny * cssH };
		},
		screenToNormalized(sx: number, sy: number) {
			return { x: (sx - cssX) / cssW, y: (sy - cssY) / cssH };
		},
		imageScreenRect: { x: cssX, y: cssY, width: cssW, height: cssH }
	};
}

// ---------------------------------------------------------------------------
// Overlay registry
// ---------------------------------------------------------------------------

/** Registry entry for a canvas overlay. */
export interface OverlayEntry {
	/** The Svelte component to mount. */
	component: Component<OverlayProps>;
	/** Whether to show pre-adjustment or current pipeline output. */
	preview: 'pre-adjustment' | 'current';
}

/**
 * Canvas overlay registry, keyed by adjustment display name.
 *
 * Layer 2 overlay implementations register here. When the user selects
 * an adjustment with an entry, Editor mounts the overlay component
 * over the canvas with standard OverlayProps.
 */
export const CANVAS_OVERLAYS: Record<string, OverlayEntry> = {
	Crop: { component: CropOverlay, preview: 'pre-adjustment' }
};
