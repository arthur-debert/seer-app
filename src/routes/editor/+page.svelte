<script lang="ts">
	import { logger } from '$lib/log';
	import { loadImage, type ImageSource } from '$lib/loader';
	import Editor from '$lib/editor/Editor.svelte';

	const log = logger('page:editor');
	const DEFAULT_PATH = '/sample-images/sky-scrapper-beach.jpg';

	let imageBytes: ArrayBuffer | undefined = $state();
	let imagePath: string | undefined = $state();
	let error: string | undefined = $state();
	let loading: boolean = $state(true);

	$effect(() => {
		const srcParam = new URLSearchParams(window.location.search).get('src');
		const source: ImageSource = { kind: 'url', url: srcParam ?? DEFAULT_PATH };

		imagePath = source.url;

		log.info('loading image', { source });

		loadImage(source)
			.then((bytes) => {
				imageBytes = bytes;
				log.info('file loaded', { bytes: imageBytes.byteLength });
			})
			.catch((e: unknown) => {
				const msg = e instanceof Error ? e.message : String(e);
				error = msg;
				log.error('file load failed', { error: msg });
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

<main class="h-screen w-screen bg-neutral-950">
	{#if loading}
		<div class="flex h-full items-center justify-center">
			<p class="text-neutral-500">Loading...</p>
		</div>
	{:else if error}
		<div class="flex h-full items-center justify-center">
			<p class="text-red-400">{error}</p>
		</div>
	{:else if imageBytes}
		<Editor {imageBytes} {imagePath} />
	{/if}
</main>
