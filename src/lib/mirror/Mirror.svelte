<script lang="ts">
	import { logger } from '$lib/log';
	import { Renderer } from '$lib/viewer/renderer';
	import { initViewportWasm, ViewerState } from '$lib/viewer/viewport';
	import type { ViewLayout } from '$lib/viewer/viewport';

	interface Props {
		leftImageBytes: ArrayBuffer;
		rightImageBytes: ArrayBuffer;
	}

	let { leftImageBytes, rightImageBytes }: Props = $props();

	const log = logger('mirror');

	let leftCanvas: HTMLCanvasElement | undefined = $state();
	let rightCanvas: HTMLCanvasElement | undefined = $state();
	let error: string | undefined = $state();
	let dragging: boolean = $state(false);

	$effect(() => {
		if (!leftCanvas || !rightCanvas || !leftImageBytes || !rightImageBytes) return;

		const leftRenderer = new Renderer();
		const rightRenderer = new Renderer();
		let leftState: ViewerState | undefined;
		let rightState: ViewerState | undefined;
		let alive = true;

		function applyLayouts(leftLayout: ViewLayout, rightLayout: ViewLayout): void {
			leftRenderer.updateViewportUniform(leftLayout);
			leftRenderer.render();
			rightRenderer.updateViewportUniform(rightLayout);
			rightRenderer.render();
		}

		/** After interacting with the active panel, sync the other panel to match. */
		function syncFromTo(source: ViewerState, target: ViewerState): ViewLayout {
			const zoom = source.zoom_level();
			target.set_zoom(zoom);
			const vr = source.visible_rect();
			const centerX = vr.origin.x + vr.size.width / 2;
			const centerY = vr.origin.y + vr.size.height / 2;
			return target.center_on(centerX, centerY);
		}

		async function setup(): Promise<void> {
			await initViewportWasm();

			// Init first renderer to get GPU device, share it with second
			await leftRenderer.init(leftCanvas!);
			const sharedDevice = leftRenderer.getDevice();
			await rightRenderer.init(rightCanvas!, sharedDevice);

			const [leftDims, rightDims] = await Promise.all([
				leftRenderer.loadImage(leftImageBytes),
				rightRenderer.loadImage(rightImageBytes)
			]);

			leftRenderer.resize();
			rightRenderer.resize();

			leftState = new ViewerState(
				leftDims.width,
				leftDims.height,
				leftCanvas!.width,
				leftCanvas!.height
			);
			rightState = new ViewerState(
				rightDims.width,
				rightDims.height,
				rightCanvas!.width,
				rightCanvas!.height
			);

			if (import.meta.env.DEV) {
				(window as unknown as Record<string, unknown>).__mirrorState = {
					left: leftState,
					right: rightState
				};
			}

			log.info('mirror initialized', {
				left: leftDims,
				right: rightDims
			});

			applyLayouts(leftState.layout(), rightState.layout());
		}

		setup().catch((e: unknown) => {
			if (!alive) return;
			error = e instanceof Error ? e.message : String(e);
			log.error('mirror setup failed', { error });
		});

		// --- Determine which panel is active ---
		function getActivePanel(target: EventTarget | null): 'left' | 'right' | null {
			if (target === leftCanvas) return 'left';
			if (target === rightCanvas) return 'right';
			return null;
		}

		// --- Wheel zoom ---
		function onWheel(e: WheelEvent): void {
			if (!leftState || !rightState) return;
			e.preventDefault();

			const panel = getActivePanel(e.target);
			if (!panel) return;

			const dpr = window.devicePixelRatio;
			const canvas = panel === 'left' ? leftCanvas! : rightCanvas!;
			const rect = canvas.getBoundingClientRect();
			const x = (e.clientX - rect.left) * dpr;
			const y = (e.clientY - rect.top) * dpr;

			const active = panel === 'left' ? leftState : rightState;
			const other = panel === 'left' ? rightState : leftState;

			const activeLayout = active.zoom(-e.deltaY, x, y);
			const otherLayout = syncFromTo(active, other);

			if (panel === 'left') {
				applyLayouts(activeLayout, otherLayout);
			} else {
				applyLayouts(otherLayout, activeLayout);
			}
		}

		// --- Pointer drag (pan) ---
		let lastX = 0;
		let lastY = 0;
		let activePanel: 'left' | 'right' | null = null;

		function onPointerDown(e: PointerEvent): void {
			if (!leftState || !rightState || e.button !== 0) return;
			const panel = getActivePanel(e.target);
			if (!panel) return;

			dragging = true;
			activePanel = panel;
			lastX = e.clientX;
			lastY = e.clientY;
			const canvas = panel === 'left' ? leftCanvas! : rightCanvas!;
			canvas.setPointerCapture(e.pointerId);
		}

		function onPointerMove(e: PointerEvent): void {
			if (!leftState || !rightState || !dragging || !activePanel) return;
			const dpr = window.devicePixelRatio;
			const dx = (e.clientX - lastX) * dpr;
			const dy = (e.clientY - lastY) * dpr;
			lastX = e.clientX;
			lastY = e.clientY;

			const active = activePanel === 'left' ? leftState : rightState;
			const other = activePanel === 'left' ? rightState : leftState;

			const activeLayout = active.pan(dx, dy);
			const otherLayout = syncFromTo(active, other);

			if (activePanel === 'left') {
				applyLayouts(activeLayout, otherLayout);
			} else {
				applyLayouts(otherLayout, activeLayout);
			}
		}

		function onPointerUp(): void {
			dragging = false;
			activePanel = null;
		}

		// --- ResizeObserver ---
		const observer = new ResizeObserver(() => {
			if (!leftState || !rightState) return;
			leftRenderer.resize();
			rightRenderer.resize();

			const leftLayout = leftState.resize_canvas(leftCanvas!.width, leftCanvas!.height);
			const rightLayout = rightState.resize_canvas(rightCanvas!.width, rightCanvas!.height);
			applyLayouts(leftLayout, rightLayout);
		});
		observer.observe(leftCanvas);
		observer.observe(rightCanvas);

		// Wire events on both canvases
		for (const canvas of [leftCanvas, rightCanvas]) {
			canvas.addEventListener('wheel', onWheel, { passive: false });
			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('pointermove', onPointerMove);
			canvas.addEventListener('pointerup', onPointerUp);
			canvas.addEventListener('pointercancel', onPointerUp);
		}

		return () => {
			alive = false;
			if (import.meta.env.DEV) {
				delete (window as unknown as Record<string, unknown>).__mirrorState;
			}
			observer.disconnect();
			for (const canvas of [leftCanvas!, rightCanvas!]) {
				canvas.removeEventListener('wheel', onWheel);
				canvas.removeEventListener('pointerdown', onPointerDown);
				canvas.removeEventListener('pointermove', onPointerMove);
				canvas.removeEventListener('pointerup', onPointerUp);
				canvas.removeEventListener('pointercancel', onPointerUp);
			}
			leftState?.free();
			rightState?.free();
			rightRenderer.destroy();
			leftRenderer.destroy();
		};
	});
</script>

{#if error}
	<div class="flex h-full items-center justify-center bg-neutral-950 text-red-400">
		<p>{error}</p>
	</div>
{:else}
	<div class="flex h-full w-full">
		<canvas
			bind:this={leftCanvas}
			class="h-full min-w-0 flex-1"
			class:cursor-grab={!dragging}
			class:cursor-grabbing={dragging}
		></canvas>
		<div class="w-px bg-neutral-700"></div>
		<canvas
			bind:this={rightCanvas}
			class="h-full min-w-0 flex-1"
			class:cursor-grab={!dragging}
			class:cursor-grabbing={dragging}
		></canvas>
	</div>
{/if}
