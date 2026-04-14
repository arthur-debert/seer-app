<!--
  CropOverlay — Visual-only SVG overlay for the Crop adjustment.

  Renders dimming mask, crop frame border, and rule-of-thirds grid.
  All interaction (pan/zoom) is handled by Editor's dual-path handlers.
  Crop controls (ratio, orientation, thirds) live in ParamPanel.
-->
<script lang="ts">
	import type { OverlayProps } from './canvas-overlay';
	let { params, layout }: OverlayProps = $props();

	// Extract show_thirds from crop params (flat ParamValues)
	let showThirds = $derived.by(() => {
		if (params && 'show_thirds' in params) {
			const v = params.show_thirds as { Bool: boolean } | undefined;
			return v?.Bool ?? false;
		}
		return false;
	});

	// Frame rect in CSS screen pixels (for visual rendering).
	// layout.frame_rect is in canvas-pixel (DPR-scaled) coordinates.
	let frameScreen = $derived.by(() => {
		const dpr = window.devicePixelRatio;
		const fr = layout.frame_rect;
		return {
			x: fr.origin.x / dpr,
			y: fr.origin.y / dpr,
			width: fr.size.width / dpr,
			height: fr.size.height / dpr
		};
	});
</script>

<svg class="pointer-events-none absolute inset-0 h-full w-full" data-testid="crop-overlay">
	<!-- Dimming mask: darken everything outside crop frame -->
	<defs>
		<mask id="crop-mask">
			<rect width="100%" height="100%" fill="white" />
			<rect
				x={frameScreen.x}
				y={frameScreen.y}
				width={frameScreen.width}
				height={frameScreen.height}
				fill="black"
			/>
		</mask>
	</defs>
	<rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />

	<!-- Crop frame border -->
	<rect
		x={frameScreen.x}
		y={frameScreen.y}
		width={frameScreen.width}
		height={frameScreen.height}
		fill="none"
		stroke="white"
		stroke-width="1.5"
	/>

	<!-- Rule of thirds grid -->
	{#if showThirds}
		{@const cx = frameScreen.x}
		{@const cy = frameScreen.y}
		{@const cw = frameScreen.width}
		{@const ch = frameScreen.height}
		<line
			x1={cx + cw / 3}
			y1={cy}
			x2={cx + cw / 3}
			y2={cy + ch}
			stroke="rgba(255,255,255,0.3)"
			stroke-width="0.5"
		/>
		<line
			x1={cx + (2 * cw) / 3}
			y1={cy}
			x2={cx + (2 * cw) / 3}
			y2={cy + ch}
			stroke="rgba(255,255,255,0.3)"
			stroke-width="0.5"
		/>
		<line
			x1={cx}
			y1={cy + ch / 3}
			x2={cx + cw}
			y2={cy + ch / 3}
			stroke="rgba(255,255,255,0.3)"
			stroke-width="0.5"
		/>
		<line
			x1={cx}
			y1={cy + (2 * ch) / 3}
			x2={cx + cw}
			y2={cy + (2 * ch) / 3}
			stroke="rgba(255,255,255,0.3)"
			stroke-width="0.5"
		/>
	{/if}
</svg>
