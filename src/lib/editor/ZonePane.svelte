<script lang="ts">
	import type { ZoneInfo } from './editor-bridge';
	import { icons, addableZones } from '$lib/icons';
	import Panel from '$lib/ui/Panel.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';

	interface Props {
		zones: ZoneInfo[];
		selectedZoneId: string | null;
		onSelectZone: (id: string | null) => void;
		onAddZone: (pluginId: string) => void;
		onRemoveZone: (id: string) => void;
	}

	let { zones, selectedZoneId, onSelectZone, onAddZone, onRemoveZone }: Props = $props();

	/** Filter to only show generator zones (not compositions or partition labels). */
	let generators = $derived(zones.filter((z) => z.kind !== 'Composition' && !z.partition_of));
</script>

<Panel title="Analysis">
	<div data-zone-list class="space-y-1">
		<div class="mb-2 flex flex-wrap gap-1">
			{#each addableZones as plugin (plugin.pluginId)}
				{@const Icon = icons[plugin.iconKey].component}
				<Tooltip text={plugin.label}>
					<button
						class="bg-surface-2 text-text-muted hover:bg-selected hover:text-text-secondary flex h-6 w-6 items-center justify-center rounded transition-colors"
						data-plugin-id={plugin.pluginId}
						onclick={() => onAddZone(plugin.pluginId)}
					>
						<Icon class="h-4 w-4" />
					</button>
				</Tooltip>
			{/each}
		</div>

		{#each generators as zone (zone.id)}
			{@const kindKey =
				zone.kind === 'AI'
					? 'ai'
					: zone.kind === 'Luminance'
						? 'zoneLuminance'
						: zone.kind === 'Color'
							? 'zoneColor'
							: zone.kind === 'Gradient'
								? 'zoneGradient'
								: zone.kind === 'Brush'
									? 'zoneBrush'
									: null}
			{@const ZoneIcon = kindKey ? icons[kindKey].component : null}
			<div
				class="group flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors {selectedZoneId ===
				zone.id
					? 'bg-selected text-selected-text'
					: 'text-text-muted hover:bg-surface-2 hover:text-text-secondary'}"
				role="button"
				tabindex="0"
				onclick={() => onSelectZone(zone.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') onSelectZone(zone.id);
				}}
			>
				{#if ZoneIcon}
					<span class="bg-surface-2 flex h-6 w-6 shrink-0 items-center justify-center rounded">
						<ZoneIcon class="h-4 w-4" />
					</span>
				{/if}
				<span class="truncate">{zone.name}</span>
				<span class="flex-1"></span>
				<Tooltip text="Remove zone">
					<button
						class="text-text-faint hover:bg-surface-2 hover:text-text-secondary flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] opacity-0 group-hover:opacity-100"
						onclick={(e) => {
							e.stopPropagation();
							onRemoveZone(zone.id);
						}}
					>
						&#10005;
					</button>
				</Tooltip>
			</div>
		{/each}
	</div>
</Panel>
