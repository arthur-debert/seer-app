<script lang="ts">
	import { icons, getZoneIcons } from '$lib/icons';

	const semanticZones = [
		{ kind: 'AI', name: 'Sky', label: 'AI + Sky' },
		{ kind: 'AI', name: 'Person', label: 'AI + Person' },
		{ kind: 'AI', name: 'Vegetation', label: 'AI + Vegetation' },
		{ kind: 'AI', name: 'Structure', label: 'AI + Structure' }
	];
</script>

<main class="min-h-screen bg-neutral-950 p-8">
	<div class="mx-auto max-w-3xl">
		<h1 class="text-2xl font-semibold text-neutral-100">Icons</h1>
		<p class="mt-1 text-sm text-neutral-500">
			All icons registered in <code class="text-neutral-400">$lib/icons.ts</code> — this page updates
			automatically.
		</p>

		<div class="mt-8 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
			{#each Object.entries(icons) as [key, entry] (key)}
				<div
					class="flex flex-col items-center gap-2 rounded-lg border border-neutral-800 px-3 py-4"
				>
					<entry.component class="h-6 w-6 text-neutral-200" />
					<span class="text-xs font-medium text-neutral-300">{entry.label}</span>
					<code class="text-[10px] text-blue-400">{key}</code>
					<code class="text-[10px] text-neutral-500">{entry.iconId}</code>
					<span class="text-center text-[10px] leading-tight text-neutral-600">{entry.usage}</span>
				</div>
			{/each}
		</div>

		<h2 class="mt-12 text-lg font-semibold text-neutral-100">AI Zone Compounds</h2>
		<p class="mt-1 text-sm text-neutral-500">
			Semantic zones show the AI icon paired with their category icon.
		</p>
		<div class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
			{#each semanticZones as zone (zone.name)}
				{@const zoneIcons = getZoneIcons(zone.kind, zone.name)}
				<div
					class="flex flex-col items-center gap-2 rounded-lg border border-neutral-800 px-3 py-4"
				>
					<span class="flex items-center gap-1">
						{#each zoneIcons as ZoneComp, i (i)}
							<ZoneComp class="h-6 w-6 text-neutral-200" />
						{/each}
					</span>
					<span class="text-xs font-medium text-neutral-300">{zone.label}</span>
					<span class="text-center text-[10px] leading-tight text-neutral-600"
						>Semantic zone: {zone.name}</span
					>
				</div>
			{/each}
		</div>
	</div>
</main>
