<script lang="ts">
	import type { Component } from 'svelte';
	import type { AdjustmentInfo } from './editor-bridge';
	import { icons, pluginIconMap } from '$lib/icons';
	import Tooltip from '$lib/ui/Tooltip.svelte';

	const CheckCircle = icons.checkCircle.component;
	const CircleOutline = icons.circleOutline.component;
	const ArrowRightIcon = icons.arrowRight.component;
	const GlobeIcon = icons.globe.component;

	function getNodeIcon(pluginId: string) {
		const key = pluginIconMap[pluginId];
		return key ? icons[key].component : null;
	}

	interface Props {
		adjustment: AdjustmentInfo;
		index: number;
		isSelected: boolean;
		isSource: boolean;
		isDimmed: boolean;
		hasError: boolean;
		errorMessage: string | null;
		zoneIcons: { components: Component[]; count: number } | null;
		onSelect: () => void;
		onToggle: (enabled: boolean) => void;
		onRemove: () => void;
	}

	let {
		adjustment,
		index,
		isSelected,
		isSource,
		isDimmed,
		hasError,
		errorMessage,
		zoneIcons,
		onSelect,
		onToggle,
		onRemove
	}: Props = $props();

	const NodeIcon = $derived(getNodeIcon(adjustment.plugin_id));
</script>

<div
	class="group flex w-full items-center gap-0 rounded text-left text-xs transition-colors {isSelected
		? 'bg-selected text-selected-text'
		: 'text-text-muted hover:bg-surface-2 hover:text-text-secondary'}"
	class:opacity-30={isDimmed}
	role="button"
	tabindex="0"
	data-adj-index={index}
	onclick={onSelect}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') onSelect();
	}}
>
	<div class="flex flex-1 items-center gap-1.5 px-2 py-1.5">
		<!-- Toggle -->
		<button
			class="flex h-4 w-4 shrink-0 items-center justify-center {adjustment.enabled
				? 'text-accent'
				: 'text-text-faint'}"
			onclick={(e) => {
				e.stopPropagation();
				onToggle(!adjustment.enabled);
			}}
		>
			{#if adjustment.enabled}
				<CheckCircle class="h-3.5 w-3.5" />
			{:else}
				<CircleOutline class="h-3.5 w-3.5" />
			{/if}
		</button>

		<!-- Error dot -->
		{#if hasError}
			<Tooltip text={errorMessage ?? 'Error'}>
				<span class="bg-danger h-2 w-2 shrink-0 rounded-full"></span>
			</Tooltip>
		{/if}

		<!-- Node icon -->
		{#if NodeIcon}
			<Tooltip text={adjustment.name}>
				<span
					class="bg-surface-2 flex h-6 w-6 shrink-0 items-center justify-center rounded"
					class:opacity-40={!adjustment.enabled}
				>
					<NodeIcon class="h-4 w-4" />
				</span>
			</Tooltip>
		{/if}

		<!-- Arrow separator -->
		<span class="text-text-faint flex shrink-0 items-center">
			<ArrowRightIcon class="h-3.5 w-3.5" />
		</span>

		<!-- Zone targets -->
		<span class="text-text-muted flex shrink-0 items-center gap-0.5">
			{#if zoneIcons && zoneIcons.components.length > 0}
				{#each zoneIcons.components as ZoneComp, i (i)}
					<ZoneComp class="h-3.5 w-3.5" />
				{/each}
				{#if zoneIcons.count > 1}
					<span class="text-text-muted text-[10px]">+{zoneIcons.count - 1}</span>
				{/if}
			{:else}
				<GlobeIcon class="h-3.5 w-3.5" />
			{/if}
		</span>

		<!-- Delete (hover only, not for Source) -->
		{#if !isSource}
			<span class="flex-1"></span>
			<Tooltip text="Remove adjustment">
				<button
					class="text-text-faint hover:bg-surface-2 hover:text-text-secondary flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] opacity-0 group-hover:opacity-100"
					title="Remove adjustment"
					onclick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
				>
					&#10005;
				</button>
			</Tooltip>
		{/if}
	</div>
</div>
