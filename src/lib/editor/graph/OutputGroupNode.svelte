<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { NodeProps } from '@xyflow/svelte';
	import type { OutputGroupNodeData } from './graph-layout';
	import { PHASE_THEMES } from './phase-theme';

	let { data, id }: NodeProps = $props();
	const d = $derived(data as unknown as OutputGroupNodeData);
	const theme = $derived(PHASE_THEMES[d.phase]);
	const group = $derived(d.group);

	let expanded = $state(true);
</script>

<Handle type="target" position={Position.Top} />

<div
	class="rounded-lg border shadow-sm"
	style="border-left: 4px solid {theme.color}; background: {theme.bg};"
>
	<!-- Group header -->
	<div class="flex items-center gap-2 px-3 py-2 text-sm">
		<!-- Toggle -->
		<button
			class="nodrag flex-shrink-0 text-xs opacity-60 hover:opacity-100"
			onclick={(e: MouseEvent) => {
				e.stopPropagation();
				const ev = new CustomEvent('nodetoggle', {
					detail: { id, enabled: !group.enabled, kind: 'output-group' },
					bubbles: true
				});
				(e.currentTarget as HTMLElement).dispatchEvent(ev);
			}}
		>
			{group.enabled ? '●' : '○'}
		</button>

		<!-- Name -->
		<span class="flex-1 truncate font-medium" class:opacity-50={!group.enabled}>
			{group.name || 'Output Group'}
		</span>

		<!-- Expand/collapse children -->
		<button
			class="nodrag text-xs opacity-60 hover:opacity-100"
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? '▾' : '▸'}
		</button>

		<!-- Delete -->
		<button
			class="nodrag flex-shrink-0 text-xs opacity-0 transition-opacity hover:text-red-500"
			onclick={(e: MouseEvent) => {
				e.stopPropagation();
				const ev = new CustomEvent('noderemove', {
					detail: { id, kind: 'output-group' },
					bubbles: true
				});
				(e.currentTarget as HTMLElement).dispatchEvent(ev);
			}}
		>
			&#10005;
		</button>
	</div>

	<!-- Children (inline, not separate nodes) -->
	{#if expanded && group.children.length > 0}
		<div class="border-t border-gray-200/50 px-3 py-1.5 dark:border-gray-700/50">
			{#each group.children as child (child.id)}
				<button
					class="nodrag flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-white/30 dark:hover:bg-gray-700/30"
					onclick={(e: MouseEvent) => {
						e.stopPropagation();
						const ev = new CustomEvent('nodeselect', {
							detail: { id: child.id, groupId: group.id },
							bubbles: true
						});
						(e.currentTarget as HTMLElement).dispatchEvent(ev);
					}}
				>
					<span class:opacity-50={!child.enabled}>
						{child.plugin_id
							.replace('arami.output-child.', '')
							.replace('arami.output.', '')
							.toUpperCase()}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	div:hover button {
		opacity: 1;
	}
</style>
