<script lang="ts">
	import { Renderer } from '$lib/viewer/renderer';
	import { initViewportWasm, ViewerState } from '$lib/viewer/viewport';
	import type { ViewLayout } from '$lib/viewer/viewport';
	import ViewControls from './ViewControls.svelte';

	interface Props {
		imageBytes: ArrayBuffer;
	}

	let { imageBytes }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let error: string | undefined = $state();
	let dragging: boolean = $state(false);

	// Viewer internals exposed for controls
	let viewerRef: ViewerState | undefined = $state();
	let rendererRef: Renderer | undefined = $state();

	// View controls state
	let framePercentage: number = $state(10);
	let matColor: string = $state('#404040');
	let zoomPercentage: number = $state(100);
	let isFit: boolean = $state(true);
	let fitPercentage: number = $state(100);

	/** Parse a CSS hex color to linear [r, g, b, a] floats for the shader. */
	function hexToLinear(hex: string): [number, number, number, number] {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		return [r, g, b, 1];
	}

	function applyLayout(layout: ViewLayout): void {
		rendererRef?.updateViewportUniform(layout);
		rendererRef?.render();
	}

	function syncZoomState(): void {
		if (!viewerRef) return;
		zoomPercentage = viewerRef.zoom_percentage();
		isFit = viewerRef.is_fit();
		fitPercentage = viewerRef.fit_percentage();
	}

	$effect(() => {
		if (!canvasEl || !imageBytes) return;

		const renderer = new Renderer();
		let viewerState: ViewerState | undefined;
		let alive = true;

		async function setup(): Promise<void> {
			await Promise.all([initViewportWasm(), renderer.init(canvasEl!)]);

			const dims = await renderer.loadImage(imageBytes);
			renderer.resize();

			viewerState = new ViewerState(dims.width, dims.height, canvasEl!.width, canvasEl!.height);
			viewerState.set_zoom_limits(5.0, 400.0);
			viewerState.set_mat_fraction(framePercentage / 100);

			// Set initial mat color on shader
			const [r, g, b, a] = hexToLinear(matColor);
			renderer.setBgColor(r, g, b, a);

			rendererRef = renderer;
			viewerRef = viewerState;

			if (import.meta.env.DEV) {
				(window as unknown as Record<string, unknown>).__imageAreaState = viewerState;
			}

			syncZoomState();
			applyLayout(viewerState.layout());
		}

		setup().catch((e: unknown) => {
			if (!alive) return;
			error = e instanceof Error ? e.message : String(e);
		});

		// --- Wheel zoom ---
		function onWheel(e: WheelEvent): void {
			if (!viewerState) return;
			e.preventDefault();
			const dpr = window.devicePixelRatio;
			const rect = canvasEl!.getBoundingClientRect();
			const x = (e.clientX - rect.left) * dpr;
			const y = (e.clientY - rect.top) * dpr;
			applyLayout(viewerState.zoom(-e.deltaY, x, y));
			syncZoomState();
		}

		// --- Pointer drag (pan) ---
		let lastX = 0;
		let lastY = 0;

		function onPointerDown(e: PointerEvent): void {
			if (!viewerState || e.button !== 0) return;
			dragging = true;
			lastX = e.clientX;
			lastY = e.clientY;
			canvasEl!.setPointerCapture(e.pointerId);
		}

		function onPointerMove(e: PointerEvent): void {
			if (!viewerState || !dragging) return;
			const dpr = window.devicePixelRatio;
			const dx = (e.clientX - lastX) * dpr;
			const dy = (e.clientY - lastY) * dpr;
			lastX = e.clientX;
			lastY = e.clientY;
			applyLayout(viewerState.pan(dx, dy));
		}

		function onPointerUp(): void {
			dragging = false;
		}

		// --- ResizeObserver on canvas ---
		const canvasObserver = new ResizeObserver(() => {
			if (!viewerState) return;
			renderer.resize();
			applyLayout(viewerState.resize_canvas(canvasEl!.width, canvasEl!.height));
			syncZoomState();
		});
		canvasObserver.observe(canvasEl);

		canvasEl.addEventListener('wheel', onWheel, { passive: false });
		canvasEl.addEventListener('pointerdown', onPointerDown);
		canvasEl.addEventListener('pointermove', onPointerMove);
		canvasEl.addEventListener('pointerup', onPointerUp);
		canvasEl.addEventListener('pointercancel', onPointerUp);

		return () => {
			alive = false;
			rendererRef = undefined;
			viewerRef = undefined;
			canvasObserver.disconnect();
			canvasEl!.removeEventListener('wheel', onWheel);
			canvasEl!.removeEventListener('pointerdown', onPointerDown);
			canvasEl!.removeEventListener('pointermove', onPointerMove);
			canvasEl!.removeEventListener('pointerup', onPointerUp);
			canvasEl!.removeEventListener('pointercancel', onPointerUp);
			if (import.meta.env.DEV) {
				delete (window as unknown as Record<string, unknown>).__imageAreaState;
			}
			viewerState?.free();
			renderer.destroy();
		};
	});

	function handleZoomChange(pct: number) {
		if (!viewerRef) return;
		applyLayout(viewerRef.set_zoom_percentage(pct));
		syncZoomState();
	}

	function handleFitToggle() {
		if (!viewerRef) return;
		applyLayout(viewerRef.reset());
		syncZoomState();
	}

	function handleFrameChange(pct: number) {
		framePercentage = pct;
		if (!viewerRef) return;
		applyLayout(viewerRef.set_mat_fraction(pct / 100));
		syncZoomState();
	}

	function handleMatColorChange(color: string) {
		matColor = color;
		if (!rendererRef || !viewerRef) return;
		const [r, g, b, a] = hexToLinear(color);
		rendererRef.setBgColor(r, g, b, a);
		applyLayout(viewerRef.layout());
	}
</script>

{#if error}
	<div class="flex h-full items-center justify-center bg-neutral-950 text-red-400">
		<p>{error}</p>
	</div>
{:else}
	<div class="image-area">
		<canvas
			bind:this={canvasEl}
			class="image-canvas"
			class:cursor-grab={!dragging}
			class:cursor-grabbing={dragging}
		></canvas>
		<ViewControls
			{zoomPercentage}
			{isFit}
			{fitPercentage}
			{framePercentage}
			{matColor}
			onZoomChange={handleZoomChange}
			onFitToggle={handleFitToggle}
			onFrameChange={handleFrameChange}
			onMatColorChange={handleMatColorChange}
		/>
	</div>
{/if}

<style>
	.image-area {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.image-canvas {
		flex: 1;
		min-height: 0;
		width: 100%;
	}
</style>
