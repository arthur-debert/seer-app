<script lang="ts">
	import { Renderer } from '$lib/viewer/renderer';
	import { initViewportWasm, FramerState } from '$lib/viewer/viewport';
	import type { ViewLayout, Rect, Size, Point } from '$lib/viewer/viewport';

	interface GpuResources {
		device: GPUDevice;
		textureView: GPUTextureView;
		contentSize: Size;
	}

	interface Props {
		imageBytes: ArrayBuffer;
		/** Called when GPU resources are ready (for shared-device minimap). */
		onGpuReady?: (resources: GpuResources) => void;
		/** Called on every view change with the current visible rect. */
		onViewChange?: (visibleRect: Rect) => void;
		/** Called when minimap navigation requests centering on a content point. */
		onNavigateRequest?: (handler: (point: Point) => void) => void;
	}

	let { imageBytes, onGpuReady, onViewChange, onNavigateRequest }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let error: string | undefined = $state();
	let dragging: boolean = $state(false);
	let cropInfo: string = $state('');

	// Refs for cross-scope access (event handlers ↔ effect)
	let framerRef: FramerState | undefined = $state();
	let rendererRef: Renderer | undefined = $state();

	const RATIOS = [
		{ label: '1:1', w: 1, h: 1 },
		{ label: '4:3', w: 4, h: 3 },
		{ label: '3:2', w: 3, h: 2 },
		{ label: '16:9', w: 16, h: 9 },
		{ label: '5:4', w: 5, h: 4 },
		{ label: '7:5', w: 7, h: 5 }
	];

	let selectedRatioIndex: number = $state(3); // default 16:9
	let landscape: boolean = $state(true);

	function resolvedRatio(): { w: number; h: number } {
		const r = RATIOS[selectedRatioIndex];
		return landscape ? { w: r.w, h: r.h } : { w: r.h, h: r.w };
	}

	function applyLayout(layout: ViewLayout): void {
		if (!rendererRef) return;
		rendererRef.updateViewportUniform(layout);
		const fr = layout.frame_rect;
		rendererRef.render({
			x: Math.round(fr.origin.x),
			y: Math.round(fr.origin.y),
			width: Math.round(fr.size.width),
			height: Math.round(fr.size.height)
		});
		if (framerRef) {
			const crop = framerRef.crop_rect() as Rect;
			const pct = framerRef.zoom_percentage();
			cropInfo = `${Math.round(crop.size.width)}\u00d7${Math.round(crop.size.height)} @ ${pct.toFixed(1)}%`;
			onViewChange?.(framerRef.visible_rect() as Rect);
		}
	}

	function onRatioSelect(e: Event): void {
		selectedRatioIndex = (e.target as HTMLSelectElement).selectedIndex;
		if (!framerRef) return;
		const r = resolvedRatio();
		applyLayout(framerRef.set_ratio(r.w, r.h) as ViewLayout);
	}

	function onOrientationToggle(): void {
		landscape = !landscape;
		if (!framerRef) return;
		const r = resolvedRatio();
		applyLayout(framerRef.set_ratio(r.w, r.h) as ViewLayout);
	}

	$effect(() => {
		if (!canvasEl || !imageBytes) return;

		const renderer = new Renderer();
		rendererRef = renderer;
		let alive = true;

		async function setup(): Promise<void> {
			await Promise.all([initViewportWasm(), renderer.init(canvasEl!)]);

			const dims = await renderer.loadImage(imageBytes);
			renderer.resize();

			const r = resolvedRatio();
			const fs = new FramerState(
				dims.width,
				dims.height,
				canvasEl!.width,
				canvasEl!.height,
				r.w,
				r.h
			);
			framerRef = fs;

			if (import.meta.env.DEV) {
				(window as unknown as Record<string, unknown>).__framerState = fs;
			}

			const tv = renderer.getTextureView();
			if (tv) {
				onGpuReady?.({
					device: renderer.getDevice(),
					textureView: tv,
					contentSize: { width: dims.width, height: dims.height }
				});
			}

			onNavigateRequest?.((point: Point) => {
				if (!framerRef) return;
				applyLayout(framerRef.center_on(point.x, point.y) as ViewLayout);
			});

			applyLayout(fs.layout() as ViewLayout);
		}

		setup().catch((e: unknown) => {
			if (!alive) return;
			error = e instanceof Error ? e.message : String(e);
		});

		// --- Wheel zoom ---
		function onWheel(e: WheelEvent): void {
			if (!framerRef) return;
			e.preventDefault();
			const dpr = window.devicePixelRatio;
			const rect = canvasEl!.getBoundingClientRect();
			const x = (e.clientX - rect.left) * dpr;
			const y = (e.clientY - rect.top) * dpr;
			applyLayout(framerRef.zoom(-e.deltaY, x, y) as ViewLayout);
		}

		// --- Pointer drag (pan) ---
		let lastX = 0;
		let lastY = 0;

		function onPointerDown(e: PointerEvent): void {
			if (!framerRef || e.button !== 0) return;
			dragging = true;
			lastX = e.clientX;
			lastY = e.clientY;
			canvasEl!.setPointerCapture(e.pointerId);
		}

		function onPointerMove(e: PointerEvent): void {
			if (!framerRef || !dragging) return;
			const dpr = window.devicePixelRatio;
			const dx = (e.clientX - lastX) * dpr;
			const dy = (e.clientY - lastY) * dpr;
			lastX = e.clientX;
			lastY = e.clientY;
			applyLayout(framerRef.pan(dx, dy) as ViewLayout);
		}

		function onPointerUp(): void {
			dragging = false;
		}

		// --- ResizeObserver ---
		const observer = new ResizeObserver(() => {
			if (!framerRef) return;
			renderer.resize();
			applyLayout(framerRef.resize_viewport(canvasEl!.width, canvasEl!.height) as ViewLayout);
		});
		observer.observe(canvasEl);

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
				delete (window as unknown as Record<string, unknown>).__framerState;
			}
			framerRef?.free();
			framerRef = undefined;
			rendererRef = undefined;
			renderer.destroy();
		};
	});
</script>

{#if error}
	<div class="flex h-full items-center justify-center bg-neutral-950 text-red-400">
		<p>{error}</p>
	</div>
{:else}
	<div class="relative h-full w-full">
		<canvas
			bind:this={canvasEl}
			class="h-full w-full"
			class:cursor-grab={!dragging}
			class:cursor-grabbing={dragging}
		></canvas>

		<!-- Ratio controls overlay -->
		<div class="absolute top-4 left-4 flex items-center gap-2">
			<select
				class="rounded bg-neutral-800/80 px-2 py-1 text-sm text-neutral-200 backdrop-blur"
				onchange={onRatioSelect}
			>
				{#each RATIOS as ratio, i (ratio.label)}
					<option value={i} selected={i === selectedRatioIndex}>{ratio.label}</option>
				{/each}
			</select>

			<button
				class="rounded bg-neutral-800/80 px-2 py-1 text-sm text-neutral-200 backdrop-blur"
				onclick={onOrientationToggle}
			>
				{landscape ? 'Landscape' : 'Portrait'}
			</button>

			{#if cropInfo}
				<span class="rounded bg-neutral-800/80 px-2 py-1 text-xs text-neutral-400 backdrop-blur">
					{cropInfo}
				</span>
			{/if}
		</div>
	</div>
{/if}
