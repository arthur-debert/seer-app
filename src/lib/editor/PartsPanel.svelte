<script lang="ts">
	import type { ZoneInfo } from './editor-bridge';
	import { getZoneIcons } from '$lib/icons';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		parts: ZoneInfo[];
		selectedZoneId: string | null;
		onSelectZone: (id: string | null) => void;
		onRemoveZone: (id: string) => void;
	}

	let { parts, selectedZoneId, onSelectZone, onRemoveZone }: Props = $props();
</script>

<Panel title="Parts">
	{#each parts as part (part.id)}
		{@const isSelected = part.id === selectedZoneId}
		{@const zoneIconList = getZoneIcons(part.kind, part.name)}
		{@const isPartitionLabel = !!part.partition_of}
		<div
			class="group flex items-center gap-2 rounded px-3 py-1.5 text-sm {isSelected
				? 'bg-selected-alt text-selected-alt-text'
				: 'text-text-muted hover:bg-surface-2 hover:text-text-secondary'}"
			role="button"
			tabindex="0"
			onclick={() => onSelectZone(isSelected ? null : part.id)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onSelectZone(isSelected ? null : part.id);
			}}
		>
			{#if zoneIconList.length > 0}
				<span class="flex shrink-0 items-center gap-0.5" title={part.kind}>
					{#each zoneIconList as ZoneComp, i (i)}
						<ZoneComp class="h-4 w-4" />
					{/each}
				</span>
			{:else}
				<span class="bg-selected/50 text-text-muted shrink-0 rounded px-1.5 py-0.5 text-xs"
					>{part.kind}</span
				>
			{/if}
			<span class="flex-1 truncate">{part.name}</span>
			{#if !isPartitionLabel}
				<button
					class="text-text-faint hover:text-danger shrink-0 opacity-0 group-hover:opacity-100"
					aria-label="Remove zone"
					onclick={(e) => {
						e.stopPropagation();
						onRemoveZone(part.id);
					}}
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path d="M4 4l8 8M12 4l-8 8" />
					</svg>
				</button>
			{/if}
		</div>
	{:else}
		<p class="px-3 text-xs text-text-faint italic">No parts</p>
	{/each}
</Panel>
