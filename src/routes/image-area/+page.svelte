<script lang="ts">
	import { resolve } from '$app/paths';
	import SnapSlider from '$lib/image-area/SnapSlider.svelte';
	import ViewControls from '$lib/image-area/ViewControls.svelte';
	import ImageArea from '$lib/image-area/ImageArea.svelte';
	import { logger } from '$lib/log';
	import { loadImage } from '$lib/loader';

	const log = logger('page:image-area');
	const IMAGE_PATH = '/sample-images/sky-scrapper-beach.jpg';

	// Demo state for standalone sliders
	let sliderValue = $state(100);
	let frameValue = $state(10);

	// Demo state for ViewControls
	let demoZoom = $state(50);
	let demoIsFit = $state(false);
	let demoFrame = $state(10);
	let demoColor = $state('#404040');

	// Live ImageArea
	let imageBytes: ArrayBuffer | undefined = $state();
	let imageError: string | undefined = $state();
	let loading: boolean = $state(true);

	$effect(() => {
		log.info('loading image', { path: IMAGE_PATH });
		loadImage({ kind: 'url', url: IMAGE_PATH })
			.then((bytes) => {
				imageBytes = bytes;
				log.info('image bytes received', { bytes: bytes.byteLength });
			})
			.catch((e: unknown) => {
				const msg = e instanceof Error ? e.message : String(e);
				imageError = msg;
				log.error('image load failed', { error: msg });
			})
			.finally(() => {
				loading = false;
			});
	});

	const magnificationSnaps = [
		{ value: 25, label: '25%' },
		{ value: 50, label: '50%' },
		{ value: 100, label: '100%' },
		{ value: 200, label: '200%' },
		{ value: 400, label: '400%' }
	];

	const frameSnaps = [
		{ value: 0, label: '0%' },
		{ value: 5, label: '5%' },
		{ value: 10, label: '10%' },
		{ value: 20, label: '20%' },
		{ value: 50, label: '50%' }
	];
</script>

<main class="min-h-screen bg-neutral-950 p-8">
	<div class="mx-auto max-w-3xl">
		<h1 class="text-2xl font-semibold text-neutral-100">ImageArea</h1>
		<p class="mt-1 text-sm text-neutral-500">
			Image viewer with mat/frame and magnification controls.
			<a href={resolve('/')} class="text-blue-400 hover:underline">Back</a>
		</p>

		<!-- SnapSlider standalone demos -->
		<section class="mt-8">
			<h2 class="mb-4 text-lg font-medium text-neutral-200">SnapSlider</h2>
			<p class="mb-4 text-sm text-neutral-500">
				Generic slider with sticky snap points. Dragging near a snap point snaps to it.
			</p>

			<div class="space-y-4">
				<div class="rounded-lg border border-neutral-800 p-4">
					<div class="mb-2 flex items-baseline gap-2">
						<span class="text-xs font-semibold text-neutral-300">Magnification</span>
						<span class="text-[10px] text-neutral-600"
							>Snaps at 25%, 50%, 100%, 200%, 400% — current: {Math.round(sliderValue)}%</span
						>
					</div>
					<div class="rounded bg-neutral-900 p-3">
						<SnapSlider
							min={5}
							max={400}
							value={sliderValue}
							snapPoints={magnificationSnaps}
							onChange={(v) => (sliderValue = v)}
						/>
					</div>
				</div>

				<div class="rounded-lg border border-neutral-800 p-4">
					<div class="mb-2 flex items-baseline gap-2">
						<span class="text-xs font-semibold text-neutral-300">Frame</span>
						<span class="text-[10px] text-neutral-600"
							>Snaps at 0%, 5%, 10%, 20%, 50% — current: {Math.round(frameValue)}%</span
						>
					</div>
					<div class="rounded bg-neutral-900 p-3">
						<SnapSlider
							min={0}
							max={50}
							value={frameValue}
							snapPoints={frameSnaps}
							onChange={(v) => (frameValue = v)}
						/>
					</div>
				</div>

				<div class="rounded-lg border border-neutral-800 p-4">
					<div class="mb-2 flex items-baseline gap-2">
						<span class="text-xs font-semibold text-neutral-300">Disabled</span>
						<span class="text-[10px] text-neutral-600">Slider in disabled state</span>
					</div>
					<div class="rounded bg-neutral-900 p-3">
						<SnapSlider
							min={0}
							max={100}
							value={50}
							snapPoints={[{ value: 50, label: '50%' }]}
							onChange={() => {}}
							disabled={true}
						/>
					</div>
				</div>
			</div>
		</section>

		<!-- ViewControls standalone demo -->
		<section class="mt-10">
			<h2 class="mb-4 text-lg font-medium text-neutral-200">ViewControls</h2>
			<p class="mb-4 text-sm text-neutral-500">
				Bottom toolbar with magnification and frame controls. Contains two SnapSliders, a Fit
				toggle, and a color picker.
			</p>

			<div class="rounded-lg border border-neutral-800 p-4">
				<div class="mb-2 flex items-baseline gap-2">
					<span class="text-xs font-semibold text-neutral-300">Default state</span>
					<span class="text-[10px] text-neutral-600"
						>Zoom: {demoIsFit ? 'Fit' : `${Math.round(demoZoom)}%`} | Frame: {Math.round(
							demoFrame
						)}% | Color: {demoColor}</span
					>
				</div>
				<div class="rounded bg-neutral-900">
					<ViewControls
						zoomPercentage={demoZoom}
						isFit={demoIsFit}
						fitPercentage={30}
						framePercentage={demoFrame}
						matColor={demoColor}
						onZoomChange={(pct) => {
							demoZoom = pct;
							demoIsFit = false;
						}}
						onFitToggle={() => {
							demoIsFit = !demoIsFit;
						}}
						onFrameChange={(pct) => (demoFrame = pct)}
						onMatColorChange={(c) => (demoColor = c)}
					/>
				</div>
			</div>
		</section>

		<!-- Live ImageArea -->
		<section class="mt-10">
			<h2 class="mb-4 text-lg font-medium text-neutral-200">ImageArea (live)</h2>
			<p class="mb-4 text-sm text-neutral-500">
				Full component: image viewer + mat/frame + controls. Scroll to zoom, drag to pan.
			</p>

			<div class="rounded-lg border border-neutral-800 p-1">
				<div class="h-[600px] overflow-hidden rounded bg-neutral-900">
					{#if loading}
						<div class="flex h-full items-center justify-center text-neutral-500">
							<p>Loading image...</p>
						</div>
					{:else if imageError}
						<div class="flex h-full items-center justify-center text-red-400">
							<p>{imageError}</p>
						</div>
					{:else if imageBytes}
						<ImageArea {imageBytes} />
					{/if}
				</div>
			</div>
		</section>
	</div>
</main>
