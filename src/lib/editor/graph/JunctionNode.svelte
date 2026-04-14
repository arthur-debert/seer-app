<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { NodeProps } from '@xyflow/svelte';
	import type { JunctionNodeData } from './graph-layout';
	import { PHASE_THEMES } from './phase-theme';
	import { icons, addablePlugins, addableGeometry, addableZones } from '$lib/icons';

	let { data }: NodeProps = $props();
	const d = $derived(data as unknown as JunctionNodeData);
	const theme = $derived(PHASE_THEMES[d.phaseBelow]);
	const isCondenser = $derived(d.boundary.topology === 'Condenser');
	const isDiffuser = $derived(d.boundary.topology === 'Diffuser');
	const AddIcon = icons.add.component;

	let dropdownOpen = $state(false);

	const addableItems = $derived.by(
		(): Array<{ pluginId: string; label: string; iconKey?: string }> => {
			switch (d.phaseBelow) {
				case 1:
					return addableGeometry;
				case 2:
					return addableZones;
				case 3:
					return addablePlugins;
				case 4:
					// Output phase: addable exports come from the backend
					return (d.availableExports ?? []).map((e) => ({
						pluginId: e.id,
						label: e.name
					}));
				default:
					return [];
			}
		}
	);

	/** Whether this junction is for each phase (for E2E test data attributes). */
	const isGeometryList = $derived(d.phaseBelow === 1);
	const isZoneList = $derived(d.phaseBelow === 2);
	const isAdjustmentList = $derived(d.phaseBelow === 3);
	const isExportList = $derived(d.phaseBelow === 4);
</script>

<Handle type="target" position={Position.Top} />

<div class="flex items-center gap-2" style="width: 100%;">
	<!-- Left line -->
	<div class="h-px flex-1" style="background: {theme.color}40;"></div>

	<!-- Junction circle -->
	<div
		class="flex h-5 w-5 items-center justify-center rounded-full border-2"
		style="border-color: {theme.color}; background: {isCondenser || isDiffuser
			? theme.color + '30'
			: 'transparent'};"
	>
		{#if isCondenser || isDiffuser}
			<div class="h-1.5 w-1.5 rounded-full" style="background: {theme.color};"></div>
		{/if}
	</div>

	<!-- Phase label -->
	<span class="text-xs font-medium" style="color: {theme.color};">
		{theme.label}
	</span>

	<div class="flex-1"></div>

	<!-- Add button + dropdown (data attrs for E2E tests) -->
	{#if addableItems.length > 0}
		<div
			class="nodrag relative"
			data-geometry-list={isGeometryList ? '' : undefined}
			data-zone-list={isZoneList ? '' : undefined}
			data-adjustment-list={isAdjustmentList ? '' : undefined}
			data-export-list={isExportList ? '' : undefined}
		>
			<button
				class="flex h-5 w-5 items-center justify-center rounded text-xs opacity-60 hover:opacity-100"
				style="color: {theme.color};"
				onclick={(e: MouseEvent) => {
					e.stopPropagation();
					dropdownOpen = !dropdownOpen;
				}}
			>
				<span style="color: {theme.color}"><AddIcon class="h-4 w-4" /></span>
			</button>

			<!-- Dropdown: always rendered for E2E test locators, visually hidden when closed -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="absolute top-6 right-0 z-50 flex gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
				class:invisible={!dropdownOpen}
				class:pointer-events-none={!dropdownOpen}
				onmouseleave={() => (dropdownOpen = false)}
			>
				{#each addableItems as item (item.pluginId)}
					{@const ItemIcon = item.iconKey
						? icons[item.iconKey as keyof typeof icons]?.component
						: null}
					<button
						class="flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
						title={item.label}
						data-plugin-id={item.pluginId}
						onclick={(e: MouseEvent) => {
							e.stopPropagation();
							dropdownOpen = false;
							const el = e.currentTarget as HTMLElement;
							el.dispatchEvent(
								new CustomEvent('nodeadd', {
									detail: { pluginId: item.pluginId, phase: d.phaseBelow },
									bubbles: true
								})
							);
						}}
					>
						{#if ItemIcon}
							<span style="color: {theme.color};"><ItemIcon class="h-4 w-4" /></span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Collapse toggle -->
	<button
		class="nodrag text-xs opacity-60 hover:opacity-100"
		style="color: {theme.color};"
		onclick={(e: MouseEvent) => {
			e.stopPropagation();
			const el = e.currentTarget as HTMLElement;
			el.dispatchEvent(
				new CustomEvent('phasecollapse', {
					detail: { phase: d.phaseBelow },
					bubbles: true
				})
			);
		}}
	>
		{d.collapsed ? '▸' : '▾'}
	</button>

	<!-- Right line -->
	<div class="h-px flex-1" style="background: {theme.color}40;"></div>
</div>

<Handle type="source" position={Position.Bottom} />
