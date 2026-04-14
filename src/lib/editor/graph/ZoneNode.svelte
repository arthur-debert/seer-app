<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { NodeProps } from '@xyflow/svelte';
	import type { ZoneNodeData } from './graph-layout';
	import { getZoneIcons } from '$lib/icons';
	import { PHASE_THEMES } from './phase-theme';

	let { data, id }: NodeProps = $props();
	const d = $derived(data as unknown as ZoneNodeData);
	const theme = $derived(PHASE_THEMES[d.phase]);
	const zoneIconComponents = $derived(getZoneIcons(d.zone.kind, d.zone.name));
</script>

<Handle type="target" position={Position.Top} />

<div
	class="group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm"
	style="border-left: 4px solid {theme.color}; background: {theme.bg};"
>
	<!-- Zone icon(s) -->
	{#each zoneIconComponents as ZoneIcon, i (i)}
		<span style="color: {theme.color}"><ZoneIcon class="h-4 w-4" /></span>
	{/each}

	<!-- Name -->
	<span class="flex-1 truncate font-medium">
		{d.zone.name}
	</span>

	<!-- Delete button -->
	<button
		class="nodrag flex-shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
		onclick={(e: MouseEvent) => {
			e.stopPropagation();
			const el = e.currentTarget as HTMLElement;
			el.dispatchEvent(
				new CustomEvent('noderemove', { detail: { id, kind: 'zone' }, bubbles: true })
			);
		}}
	>
		&#10005;
	</button>
</div>

<Handle type="source" position={Position.Bottom} />
