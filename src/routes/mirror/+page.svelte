<script lang="ts">
	import { logger } from '$lib/log';
	import { loadImage } from '$lib/loader';
	import Mirror from '$lib/mirror/Mirror.svelte';

	const log = logger('page:mirror');

	const LEFT_IMAGE = '/sample-images/peter.jpg';
	const RIGHT_IMAGE = '/sample-images/sky-scrapper-beach.jpg';

	let leftImageBytes: ArrayBuffer | undefined = $state();
	let rightImageBytes: ArrayBuffer | undefined = $state();
	let error: string | undefined = $state();
	let loading: boolean = $state(true);

	$effect(() => {
		log.info('loading mirror images');

		Promise.all([
			loadImage({ kind: 'url', url: LEFT_IMAGE }),
			loadImage({ kind: 'url', url: RIGHT_IMAGE })
		])
			.then(([left, right]) => {
				leftImageBytes = left;
				rightImageBytes = right;
				log.info('both images loaded', {
					left: left.byteLength,
					right: right.byteLength
				});
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
	{:else if leftImageBytes && rightImageBytes}
		<Mirror {leftImageBytes} {rightImageBytes} />
	{/if}
</main>
