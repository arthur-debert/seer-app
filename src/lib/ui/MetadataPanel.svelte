<script lang="ts">
	import { fly } from 'svelte/transition';

	interface ImageMetadata {
		filename: string;
		dateAdded?: string;
		dateModified?: string;
		title?: string;
		caption?: string;
		location?: string;
		camera?: string;
		lens?: string;
		aperture?: string;
		shutter?: string;
		iso?: string;
		ev?: string;
	}

	interface Props {
		visible: boolean;
		metadata: ImageMetadata;
	}

	let { visible, metadata }: Props = $props();
</script>

{#if visible}
	<div
		class="border-border bg-card-bg absolute right-0 bottom-0 left-0 z-50 border-t p-4 shadow-2xl backdrop-blur-xl"
		transition:fly={{ y: 300, duration: 300 }}
		data-testid="metadata-panel"
	>
		<div class="grid grid-cols-3 gap-6">
			<!-- Column 1: File info -->
			<div class="flex flex-col gap-2">
				<h3
					class="text-text-muted text-[length:var(--text-caption)] font-bold tracking-wider uppercase"
				>
					File
				</h3>
				<p class="text-text-primary text-sm font-medium">{metadata.filename}</p>
				{#if metadata.dateAdded}
					<p class="text-text-muted text-[length:var(--text-caption)]">
						Added {metadata.dateAdded}
					</p>
				{/if}
				{#if metadata.dateModified}
					<p class="text-text-muted text-[length:var(--text-caption)]">
						Modified {metadata.dateModified}
					</p>
				{/if}
			</div>

			<!-- Column 2: Title / Caption / Location -->
			<div class="flex flex-col gap-2">
				{#if metadata.title}
					<h3 class="text-text-primary text-[length:var(--text-label)] font-bold tracking-tighter">
						{metadata.title}
					</h3>
				{/if}
				{#if metadata.caption}
					<p class="text-text-secondary text-[length:var(--text-caption)] leading-relaxed">
						{metadata.caption}
					</p>
				{/if}
				{#if metadata.location}
					<p class="text-text-muted text-[length:var(--text-caption)]">
						{metadata.location}
					</p>
				{/if}
			</div>

			<!-- Column 3: EXIF data -->
			<div class="flex flex-col gap-1">
				<h3
					class="text-text-muted text-[length:var(--text-caption)] font-bold tracking-wider uppercase"
				>
					Camera
				</h3>
				{#if metadata.camera}
					<p class="text-text-secondary text-[length:var(--text-caption)]">{metadata.camera}</p>
				{/if}
				{#if metadata.lens}
					<p class="text-text-secondary text-[length:var(--text-caption)]">{metadata.lens}</p>
				{/if}
				<div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
					{#if metadata.aperture}
						<span class="text-text-muted text-[length:var(--text-caption)]">Aperture</span>
						<span class="text-text-primary text-[length:var(--text-caption)]"
							>{metadata.aperture}</span
						>
					{/if}
					{#if metadata.shutter}
						<span class="text-text-muted text-[length:var(--text-caption)]">Shutter</span>
						<span class="text-text-primary text-[length:var(--text-caption)]"
							>{metadata.shutter}</span
						>
					{/if}
					{#if metadata.iso}
						<span class="text-text-muted text-[length:var(--text-caption)]">ISO</span>
						<span class="text-text-primary text-[length:var(--text-caption)]">{metadata.iso}</span>
					{/if}
					{#if metadata.ev}
						<span class="text-text-muted text-[length:var(--text-caption)]">EV</span>
						<span class="text-text-primary text-[length:var(--text-caption)]">{metadata.ev}</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
