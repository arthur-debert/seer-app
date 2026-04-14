<script lang="ts">
	import type { Component } from 'svelte';
	import type { AdjustmentInfo, EvalError, ZoneInfo, ZoneSource } from './editor-bridge';
	import { icons, getZoneIcons, addablePlugins } from '$lib/icons';
	import PipelineItem from './PipelineItem.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import type { DndEvent } from 'svelte-dnd-action';

	interface Props {
		adjustments: AdjustmentInfo[];
		selectedId: string | null;
		evalError: EvalError | null;
		selectedZoneId: string | null;
		zoneInfoMap: Map<string, ZoneInfo>;
		onSelect: (id: string) => void;
		onToggle: (id: string, enabled: boolean) => void;
		onAddAdjustment: (kind: string) => void;
		onRemoveAdjustment: (id: string) => void;
		onReorder: (id: string, newIndex: number) => void;
	}

	let {
		adjustments,
		selectedId,
		evalError,
		selectedZoneId,
		zoneInfoMap,
		onSelect,
		onToggle,
		onAddAdjustment,
		onRemoveAdjustment,
		onReorder
	}: Props = $props();

	/** Collect all zone IDs referenced in a ZoneSource tree. */
	function zoneSourceRefs(source: ZoneSource): string[] {
		if (source === 'Full') return [];
		if (typeof source === 'object' && 'Ref' in source) return [source.Ref];
		if (typeof source === 'object' && 'PartitionLabel' in source) {
			const [zoneId, label] = source.PartitionLabel;
			return [`${zoneId}:${label}`];
		}
		if (typeof source === 'object' && 'Boolean' in source) {
			return [...zoneSourceRefs(source.Boolean.left), ...zoneSourceRefs(source.Boolean.right)];
		}
		if (typeof source === 'object' && 'Inverted' in source) {
			return zoneSourceRefs(source.Inverted);
		}
		return [];
	}

	function computeZoneIcons(zone: ZoneSource): { components: Component[]; count: number } | null {
		if (zone === 'Full') return null;
		const refs = zoneSourceRefs(zone);
		if (refs.length === 0) return null;
		const info = zoneInfoMap.get(refs[0]);
		if (!info) return null;
		const components = getZoneIcons(info.kind, info.name);
		if (components.length === 0) return null;
		return { components, count: refs.length };
	}

	function isDimmed(adjustment: AdjustmentInfo, index: number): boolean {
		if (!selectedZoneId) return false;
		if (index === 0) return false;
		return !zoneSourceRefs(adjustment.zone).includes(selectedZoneId);
	}

	// --- DnD via svelte-dnd-action ---
	// The source item (index 0) is not draggable. We keep a local mutable copy for DnD.
	let draggableItems: AdjustmentInfo[] = $derived(adjustments.slice(1));

	function handleConsider(e: CustomEvent<DndEvent<AdjustmentInfo>>): void {
		draggableItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<AdjustmentInfo>>): void {
		draggableItems = e.detail.items;
		// Find which item moved and commit the reorder
		for (let i = 0; i < draggableItems.length; i++) {
			const originalIndex = adjustments.findIndex((a) => a.id === draggableItems[i].id);
			if (originalIndex !== i + 1) {
				onReorder(draggableItems[i].id, i + 1);
				return;
			}
		}
	}
</script>

<Panel title="Adjustments">
	<div class="space-y-1" data-adjustment-list>
		<div class="mb-2 flex flex-wrap gap-1">
			{#each addablePlugins as plugin (plugin.pluginId)}
				{@const Icon = icons[plugin.iconKey].component}
				<Tooltip text={plugin.label}>
					<button
						class="bg-surface-2 text-text-muted hover:bg-selected hover:text-text-secondary flex h-6 w-6 items-center justify-center rounded transition-colors"
						data-plugin-id={plugin.pluginId}
						onclick={() => onAddAdjustment(plugin.pluginId)}
					>
						<Icon class="h-4 w-4" />
					</button>
				</Tooltip>
			{/each}
		</div>

		<!-- Source item (not draggable) -->
		{#if adjustments.length > 0}
			<PipelineItem
				adjustment={adjustments[0]}
				index={0}
				isSelected={selectedId === adjustments[0].id}
				isSource={true}
				isDimmed={false}
				hasError={evalError?.adjustmentId === adjustments[0].id}
				errorMessage={evalError?.adjustmentId === adjustments[0].id ? evalError.error : null}
				zoneIcons={null}
				onSelect={() => onSelect(adjustments[0].id)}
				onToggle={() => {}}
				onRemove={() => {}}
			/>
		{/if}

		<!-- Draggable adjustments -->
		<div
			use:dndzone={{ items: draggableItems, flipDurationMs: 150, type: 'adjustments' }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
			class="space-y-0.5"
		>
			{#each draggableItems as adjustment, i (adjustment.id)}
				{@const index = i + 1}
				<PipelineItem
					{adjustment}
					{index}
					isSelected={selectedId === adjustment.id}
					isSource={false}
					isDimmed={isDimmed(adjustment, index)}
					hasError={evalError?.adjustmentId === adjustment.id}
					errorMessage={evalError?.adjustmentId === adjustment.id ? evalError.error : null}
					zoneIcons={computeZoneIcons(adjustment.zone)}
					onSelect={() => onSelect(adjustment.id)}
					onToggle={(enabled) => onToggle(adjustment.id, enabled)}
					onRemove={() => onRemoveAdjustment(adjustment.id)}
				/>
			{/each}
		</div>
	</div>
</Panel>
