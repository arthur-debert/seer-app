<script lang="ts">
	import { MinimapRenderer } from './MinimapRenderer';
	import type { Rect, Size, Point } from '$lib/viewer/viewport';

	interface Props {
		/** Shared GPUDevice from the main renderer. */
		device: GPUDevice;
		/** Shared image texture view from the main renderer. */
		textureView: GPUTextureView;
		/** Image dimensions in content pixels. */
		contentSize: Size;
		/** Width of the minimap in CSS pixels. */
		width: number;
		/** Height of the minimap in CSS pixels. */
		height: number;
		/** Currently visible region in content-pixel coordinates. */
		visibleRect: Rect;
		/** Viewport indicator stroke color. */
		indicatorColor?: string;
		/** Viewport indicator stroke width in CSS pixels. */
		indicatorWidth?: number;
		/** Called when the user drags on the minimap to navigate. */
		onNavigate?: (contentPoint: Point) => void;
	}

	let {
		device,
		textureView,
		contentSize,
		width,
		height,
		visibleRect,
		indicatorColor = 'rgba(255, 255, 255, 0.8)',
		indicatorWidth = 1.5,
		onNavigate
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();
	let rendererRef: MinimapRenderer | undefined = $state();
	let dragging: boolean = $state(false);

	// Map content-pixel rect to minimap CSS-pixel rect for the SVG indicator.
	function mapToMinimap(rect: Rect): { x: number; y: number; w: number; h: number } {
		if (contentSize.width === 0 || contentSize.height === 0) {
			return { x: 0, y: 0, w: width, h: height };
		}

		// Contain-fit the content into the minimap dimensions
		const scaleX = width / contentSize.width;
		const scaleY = height / contentSize.height;
		const scale = Math.min(scaleX, scaleY);

		const offsetX = (width - contentSize.width * scale) / 2;
		const offsetY = (height - contentSize.height * scale) / 2;

		return {
			x: rect.origin.x * scale + offsetX,
			y: rect.origin.y * scale + offsetY,
			w: rect.size.width * scale,
			h: rect.size.height * scale
		};
	}

	// Map a minimap CSS-pixel point to content-pixel coordinates.
	function minimapToContent(clientX: number, clientY: number): Point {
		if (!svgEl || contentSize.width === 0 || contentSize.height === 0) {
			return { x: 0, y: 0 };
		}

		const rect = svgEl.getBoundingClientRect();
		const mx = clientX - rect.left;
		const my = clientY - rect.top;

		const scaleX = width / contentSize.width;
		const scaleY = height / contentSize.height;
		const scale = Math.min(scaleX, scaleY);

		const offsetX = (width - contentSize.width * scale) / 2;
		const offsetY = (height - contentSize.height * scale) / 2;

		return {
			x: (mx - offsetX) / scale,
			y: (my - offsetY) / scale
		};
	}

	// Is the entire content visible? (indicator covers full image)
	function isFullyVisible(): boolean {
		return (
			visibleRect.size.width >= contentSize.width - 1 &&
			visibleRect.size.height >= contentSize.height - 1
		);
	}

	// Drag offset: when starting a drag, record the offset between the
	// pointer and the indicator center so dragging feels anchored.
	let dragOffset: Point = { x: 0, y: 0 };

	function onPointerDown(e: PointerEvent): void {
		if (!onNavigate || e.button !== 0) return;

		const contentPoint = minimapToContent(e.clientX, e.clientY);
		const indicatorCenterX = visibleRect.origin.x + visibleRect.size.width / 2;
		const indicatorCenterY = visibleRect.origin.y + visibleRect.size.height / 2;

		// Check if click is inside the indicator
		const inside =
			contentPoint.x >= visibleRect.origin.x &&
			contentPoint.x <= visibleRect.origin.x + visibleRect.size.width &&
			contentPoint.y >= visibleRect.origin.y &&
			contentPoint.y <= visibleRect.origin.y + visibleRect.size.height;

		if (inside) {
			// Start drag — record offset from indicator center
			dragOffset = {
				x: contentPoint.x - indicatorCenterX,
				y: contentPoint.y - indicatorCenterY
			};
		} else {
			// Click outside — center on click point immediately
			dragOffset = { x: 0, y: 0 };
			onNavigate(contentPoint);
		}

		dragging = true;
		(e.target as Element).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent): void {
		if (!dragging || !onNavigate) return;
		const contentPoint = minimapToContent(e.clientX, e.clientY);
		onNavigate({
			x: contentPoint.x - dragOffset.x,
			y: contentPoint.y - dragOffset.y
		});
	}

	function onPointerUp(): void {
		dragging = false;
	}

	// Initialize the minimap renderer when the canvas is available.
	$effect(() => {
		if (!canvasEl || !device || !textureView) return;

		const renderer = new MinimapRenderer(device);
		renderer.init(canvasEl);
		renderer.resize();
		renderer.setTexture(textureView, contentSize);
		renderer.render();
		rendererRef = renderer;

		const observer = new ResizeObserver(() => {
			renderer.resize();
			renderer.render();
		});
		observer.observe(canvasEl);

		return () => {
			observer.disconnect();
			rendererRef = undefined;
		};
	});

	// Re-render when contentSize or textureView changes.
	$effect(() => {
		if (!rendererRef || !textureView) return;
		rendererRef.setTexture(textureView, contentSize);
		rendererRef.render();
	});

	// Compute indicator position reactively.
	const indicator = $derived(mapToMinimap(visibleRect));
	const showIndicator = $derived(!isFullyVisible());
</script>

<div class="relative" style="width: {width}px; height: {height}px;">
	<canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full"></canvas>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		bind:this={svgEl}
		class="absolute inset-0 h-full w-full"
		class:cursor-grab={!dragging && !!onNavigate}
		class:cursor-grabbing={dragging}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		{#if showIndicator}
			<rect
				x={indicator.x}
				y={indicator.y}
				width={indicator.w}
				height={indicator.h}
				fill="none"
				stroke={indicatorColor}
				stroke-width={indicatorWidth}
			/>
		{/if}
	</svg>
</div>
