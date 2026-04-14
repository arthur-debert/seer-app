<script lang="ts">
	import { icons, combos, pluginIconMap } from '$lib/icons';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		onApplyCombo: (comboId: string) => void;
	}

	let { onApplyCombo }: Props = $props();
</script>

<Panel title="Combos">
	{#each combos as combo (combo.id)}
		{@const uniquePlugins = [...new Set(combo.pluginIds)]}
		<button
			class="text-text-muted hover:bg-surface-2 hover:text-text-secondary flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors"
			onclick={() => onApplyCombo(combo.id)}
		>
			<span class="truncate font-medium">{combo.label}</span>
			<span class="flex items-center gap-0.5">
				{#each uniquePlugins as pluginId (pluginId)}
					{@const iconKey = pluginIconMap[pluginId]}
					{#if iconKey}
						{@const Icon = icons[iconKey].component}
						<Icon class="text-text-muted h-3.5 w-3.5" />
					{/if}
				{/each}
			</span>
		</button>
	{/each}
</Panel>
