<script lang="ts">
	import { logger } from '$lib/log';
	import { loadImage } from '$lib/loader';
	import ImageViewer from '$lib/viewer/ImageViewer.svelte';

	const log = logger('page:viewer');

	const IMAGE_PATH = '/sample-images/sky-scrapper-beach.jpg';

	let imageBytes: ArrayBuffer | undefined = $state();
	let error: string | undefined = $state();
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
		<ImageViewer {imageBytes} />
	{/if}
</main>
