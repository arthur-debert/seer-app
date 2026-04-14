<script lang="ts">
	import { logger } from '$lib/log';
	import { loadImage } from '$lib/loader';
	import Framer from '$lib/framer/Framer.svelte';
	import Minimap from '$lib/minimap/Minimap.svelte';
	import type { Rect, Size, Point } from '$lib/viewer/viewport';

	const log = logger('page');

	const IMAGE_PATH = '/sample-images/sky-scrapper-beach.jpg';

	let imageBytes: ArrayBuffer | undefined = $state();
	let error: string | undefined = $state();
	let loading: boolean = $state(true);

	// Minimap state — populated by Framer callbacks
	let gpuDevice: GPUDevice | undefined = $state();
	let gpuTextureView: GPUTextureView | undefined = $state();
	let contentSize: Size = $state({ width: 0, height: 0 });
	let visibleRect: Rect = $state({
		origin: { x: 0, y: 0 },
		size: { width: 0, height: 0 }
	});
	let navigateHandler: ((point: Point) => void) | undefined = $state();

	function onGpuReady(resources: {
		device: GPUDevice;
		textureView: GPUTextureView;
		contentSize: Size;
	}): void {
		gpuDevice = resources.device;
		gpuTextureView = resources.textureView;
		contentSize = resources.contentSize;
	}

	function onViewChange(rect: Rect): void {
		visibleRect = rect;
	}

	function onNavigateRequest(handler: (point: Point) => void): void {
		navigateHandler = handler;
	}

	function onMinimapNavigate(point: Point): void {
		navigateHandler?.(point);
	}

	$effect(() => {
		log.info('loading image', { path: IMAGE_PATH });

		loadImage({ kind: 'url', url: IMAGE_PATH })
			.then((bytes) => {
				imageBytes = bytes;
				log.info('image bytes received', { bytes: bytes.byteLength });
			})
			.catch((e: unknown) => {
				const msg = e instanceof Error ? e.message : String(e);
				error = msg;
				log.error('image load failed', { error: msg });
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

<main class="h-screen w-screen bg-neutral-950">
	{#if loading}
		<div class="flex h-full items-center justify-center text-neutral-500">
			<p>Loading...</p>
		</div>
	{:else if error}
		<div class="flex h-full items-center justify-center text-red-400">
			<p>{error}</p>
		</div>
	{:else if imageBytes}
		<Framer {imageBytes} {onGpuReady} {onViewChange} {onNavigateRequest} />

		{#if gpuDevice && gpuTextureView && contentSize.width > 0}
			<div class="absolute top-16 left-4">
				<Minimap
					device={gpuDevice}
					textureView={gpuTextureView}
					{contentSize}
					width={250}
					height={250}
					{visibleRect}
					onNavigate={onMinimapNavigate}
				/>
			</div>
		{/if}
	{/if}
</main>
