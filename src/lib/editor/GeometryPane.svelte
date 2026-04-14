<script lang="ts">
	import type { GeometryInfo, EvalError } from './editor-bridge';
	import { icons, addableGeometry } from '$lib/icons';
	import PipelineItem from './PipelineItem.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import type { DndEvent } from 'svelte-dnd-action';

	interface Props {
		geometry: GeometryInfo[];
		selectedId: string | null;
		evalError: EvalError | null;
		onSelect: (id: string) => void;
		onToggle: (id: string, enabled: boolean) => void;
		onAddGeometry: (pluginId: string) => void;
		onRemoveGeometry: (id: string) => void;
		onReorder: (id: string, newIndex: number) => void;
	}

	let {
		geometry,
		selectedId,
		evalError,
		onSelect,
		onToggle,
		onAddGeometry,
		onRemoveGeometry,
		onReorder
	}: Props = $props();

	let dndItems: GeometryInfo[] = $derived([...geometry]);

	function handleConsider(e: CustomEvent<DndEvent<GeometryInfo>>): void {
		dndItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<GeometryInfo>>): void {
		dndItems = e.detail.items;
		for (let i = 0; i < dndItems.length; i++) {
			const original = geometry.findIndex((g) => g.id === dndItems[i].id);
			if (original !== i) {
				onReorder(dndItems[i].id, i);
				return;
			}
		}
	}
</script>

<Panel title="Geometry">
	<div class="space-y-1" data-geometry-list>
		<div class="mb-2 flex flex-wrap gap-1">
			{#each addableGeometry as plugin (plugin.pluginId)}
				{@const Icon = icons[plugin.iconKey].component}
				<Tooltip text={plugin.label}>
					<button
						class="bg-surface-2 text-text-muted hover:bg-selected hover:text-text-secondary flex h-6 w-6 items-center justify-center rounded transition-colors"
						data-plugin-id={plugin.pluginId}
						onclick={() => onAddGeometry(plugin.pluginId)}
					>
						<Icon class="h-4 w-4" />
					</button>
				</Tooltip>
			{/each}
		</div>

		<div
			use:dndzone={{ items: dndItems, flipDurationMs: 150, type: 'geometry' }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
			class="space-y-0.5"
		>
			{#each dndItems as node, index (node.id)}
				<PipelineItem
					adjustment={{ ...node, zone: 'Full' }}
					{index}
					isSelected={selectedId === node.id}
					isSource={false}
					isDimmed={false}
					hasError={evalError?.adjustmentId === node.id}
					errorMessage={evalError?.adjustmentId === node.id ? evalError.error : null}
					zoneIcons={null}
					onSelect={() => onSelect(node.id)}
					onToggle={(enabled) => onToggle(node.id, enabled)}
					onRemove={() => onRemoveGeometry(node.id)}
				/>
			{/each}
		</div>
	</div>
</Panel>
