<script lang="ts">
	import { Renderer } from './renderer';
	import { initViewportWasm, ViewerState } from './viewport';
	import type { ViewLayout } from './viewport';
	import { getTestBridge, emitTestEvent, setTestReady } from '$lib/test-bridge';

	interface Props {
		imageBytes: ArrayBuffer;
	}

	let { imageBytes }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let error: string | undefined = $state();
	let dragging: boolean = $state(false);

	$effect(() => {
		if (!canvasEl || !imageBytes) return;

		const renderer = new Renderer();
		let viewerState: ViewerState | undefined;
		let alive = true;

		function applyLayout(layout: ViewLayout): void {
			renderer.updateViewportUniform(layout);
			renderer.render();
		}

		async function setup(): Promise<void> {
			await Promise.all([initViewportWasm(), renderer.init(canvasEl!)]);
			emitTestEvent('wasm:loaded');
			setTestReady('wasm', true);

			const dims = await renderer.loadImage(imageBytes);
			renderer.resize();

			viewerState = new ViewerState(dims.width, dims.height, canvasEl!.width, canvasEl!.height);

			if (import.meta.env.DEV) {
				getTestBridge();
				(window as unknown as Record<string, unknown>).__viewerState = viewerState;
			}

			applyLayout(viewerState.layout());
			emitTestEvent('viewer:rendered');
			setTestReady('viewer', true);
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

		// --- ResizeObserver ---
		const observer = new ResizeObserver(() => {
			if (!viewerState) return;
			renderer.resize();
			applyLayout(viewerState.resize_canvas(canvasEl!.width, canvasEl!.height));
		});
		observer.observe(canvasEl);

		// Use addEventListener for passive: false on wheel
		canvasEl.addEventListener('wheel', onWheel, { passive: false });
		canvasEl.addEventListener('pointerdown', onPointerDown);
		canvasEl.addEventListener('pointermove', onPointerMove);
		canvasEl.addEventListener('pointerup', onPointerUp);
		canvasEl.addEventListener('pointercancel', onPointerUp);

		return () => {
			alive = false;
			observer.disconnect();
			canvasEl!.removeEventListener('wheel', onWheel);
			canvasEl!.removeEventListener('pointerdown', onPointerDown);
			canvasEl!.removeEventListener('pointermove', onPointerMove);
			canvasEl!.removeEventListener('pointerup', onPointerUp);
			canvasEl!.removeEventListener('pointercancel', onPointerUp);
			if (import.meta.env.DEV) {
				delete (window as unknown as Record<string, unknown>).__viewerState;
			}
			viewerState?.free();
			renderer.destroy();
		};
	});
</script>

{#if error}
	<div class="flex h-full items-center justify-center bg-neutral-950 text-red-400">
		<p>{error}</p>
	</div>
{:else}
	<canvas
		bind:this={canvasEl}
		class="h-full w-full"
		class:cursor-grab={!dragging}
		class:cursor-grabbing={dragging}
	></canvas>
{/if}
