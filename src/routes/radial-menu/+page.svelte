<script lang="ts">
	import RadialMenu from '$lib/ui/RadialMenu.svelte';
	import { icons } from '$lib/icons';

	type Edge = 'left' | 'right' | 'top' | 'bottom';

	const testItems = [
		{ id: 'wb', icon: icons.whiteBalance.component, label: 'White Balance' },
		{ id: 'cm', icon: icons.colorMixer.component, label: 'Color Mixer' },
		{ id: 'tc', icon: icons.toneCurve.component, label: 'Tone Curve' },
		{ id: 'sh', icon: icons.sharpen.component, label: 'Sharpen' },
		{ id: 'dn', icon: icons.denoise.component, label: 'Denoise' }
	];

	let activeEdge: Edge | null = $state(null);
	let lastSelected: string | null = $state(null);

	const edges: Edge[] = ['left', 'right', 'top', 'bottom'];

	function openMenu(edge: Edge) {
		activeEdge = edge;
	}
</script>

<main class="bg-surface-0 min-h-screen p-8" data-testid="radial-page">
	<h1 class="text-text-primary mb-2 text-2xl font-semibold">RadialMenu</h1>
	<p class="text-text-muted mb-8 text-sm">
		Arc menu with 45-degree spacing. Click a button to open in that edge orientation.
	</p>

	{#if lastSelected}
		<p class="text-success mb-4 text-sm" data-testid="last-selected">
			Selected: {lastSelected}
		</p>
	{/if}

	<div class="grid grid-cols-2 gap-16 p-16">
		{#each edges as edge (edge)}
			<div class="flex flex-col items-center gap-4">
				<span class="text-text-secondary text-xs font-semibold">edge="{edge}"</span>
				<div class="relative">
					<button
						class="border-border bg-surface-1 text-text-primary hover:bg-surface-2 rounded-lg border px-4 py-2 text-sm transition-colors"
						onclick={() => openMenu(edge)}
						data-testid="trigger-{edge}"
					>
						Open {edge}
					</button>

					{#if activeEdge === edge}
						<div class="absolute" style="left: 50%; top: 50%; --radial-x: 0px; --radial-y: 0px;">
							<RadialMenu
								items={testItems}
								{edge}
								onSelect={(id) => {
									lastSelected = id;
								}}
								onClose={() => {
									activeEdge = null;
								}}
							/>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</main>
