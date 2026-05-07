<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { NodeProps } from '@xyflow/svelte';
	import type { PipelineNodeData } from './graph-layout';
	import type { ParamValues, ParamValue } from '../editor-bridge';
	import { icons, pluginIconMap } from '$lib/icons';
	import { PHASE_THEMES } from './phase-theme';
	import InlineParamControls from '../InlineParamControls.svelte';

	let { data, id }: NodeProps = $props();
	const d = $derived(data as unknown as PipelineNodeData);
	const theme = $derived(PHASE_THEMES[d.phase]);
	const iconKey = $derived(pluginIconMap[(d.item as { plugin_id: string }).plugin_id]);
	const IconComponent = $derived(iconKey ? icons[iconKey]?.component : null);
	const CheckCircle = icons.checkCircle.component;
	const CircleOutline = icons.circleOutline.component;

	/** E2E data attributes for the phase list this node belongs to. */
	const isSourceList = $derived(d.isSource);
	const isGeometryList = $derived(!d.isSource && d.phase === 1);
	const isAdjustmentList = $derived(d.phase === 3);

	/** Verbosity: collapsed (header only), default (core controls), expanded (all controls). */
	type Verbosity = 'collapsed' | 'default' | 'expanded';
	let verbosity: Verbosity = $state('default');

	function cycleVerbosity(): void {
		if (verbosity === 'collapsed') verbosity = 'default';
		else if (verbosity === 'default') verbosity = 'expanded';
		else verbosity = 'collapsed';
		// Notify the graph to relayout after height change
		requestAnimationFrame(() => {
			const el = document.getElementById(`node-${id}`);
			el?.dispatchEvent(new CustomEvent('noderesized', { bubbles: true }));
		});
	}

	// --- Local param state for inline editing ---
	let localParams: ParamValues = $state({});

	$effect(() => {
		if (d.item.params) {
			localParams = { ...d.item.params };
		}
	});

	function handleUpdateParam(paramId: string, value: ParamValue): void {
		localParams = { ...localParams, [paramId]: value };
		const el = document.getElementById(`node-${id}`);
		el?.dispatchEvent(
			new CustomEvent('nodeparamchange', {
				detail: { id, params: $state.snapshot(localParams) },
				bubbles: true
			})
		);
	}
</script>

<Handle type="target" position={Position.Top} />

<div
	id="node-{id}"
	data-source-list={isSourceList ? '' : undefined}
	data-geometry-list={isGeometryList ? '' : undefined}
	data-adjustment-list={isAdjustmentList ? '' : undefined}
>
	<div
		class="group flex flex-col rounded-lg border shadow-sm"
		style="border-left: 4px solid {theme.color}; background: {theme.bg}; min-width: 220px;"
	>
		<!-- Header row -->
		<div
			class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
			data-adj-index={d.index}
			role="button"
			tabindex="0"
			onclick={() => {
				const el = document.getElementById(`node-${id}`);
				el?.dispatchEvent(new CustomEvent('nodeselect', { detail: { id }, bubbles: true }));
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					const el = document.getElementById(`node-${id}`);
					el?.dispatchEvent(new CustomEvent('nodeselect', { detail: { id }, bubbles: true }));
				}
			}}
		>
			<!-- Toggle -->
			<button
				class="nodrag flex-shrink-0 opacity-60 hover:opacity-100"
				onclick={(e: MouseEvent) => {
					e.stopPropagation();
					const el = e.currentTarget as HTMLElement;
					el.dispatchEvent(
						new CustomEvent('nodetoggle', {
							detail: { id, enabled: !d.item.enabled },
							bubbles: true
						})
					);
				}}
			>
				{#if d.item.enabled}
					<span style="color: {theme.color}"><CheckCircle class="h-4 w-4" /></span>
				{:else}
					<span class="text-gray-400"><CircleOutline class="h-4 w-4" /></span>
				{/if}
			</button>

			<!-- Icon -->
			{#if IconComponent}
				<span style="color: {theme.color}"><IconComponent class="h-4 w-4" /></span>
			{/if}

			<!-- Name -->
			<span class="flex-1 truncate font-medium" class:opacity-50={!d.item.enabled}>
				{d.item.name}
			</span>

			<!-- Error indicator -->
			{#if d.hasError}
				<span
					class="h-2 w-2 flex-shrink-0 rounded-full bg-red-500"
					title={d.errorMessage ?? 'Error'}
				></span>
			{/if}

			<!-- Verbosity toggle (not for source) -->
			{#if !d.isSource && d.schema}
				<button
					class="nodrag flex-shrink-0 text-xs opacity-40 hover:opacity-100"
					onclick={(e: MouseEvent) => {
						e.stopPropagation();
						cycleVerbosity();
					}}
					title={verbosity === 'collapsed'
						? 'Show controls'
						: verbosity === 'default'
							? 'Show all controls'
							: 'Collapse'}
				>
					{verbosity === 'collapsed' ? '▸' : '▾'}
				</button>
			{/if}

			<!-- Delete button -->
			{#if !d.isSource}
				<button
					class="nodrag flex-shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
					title="Remove adjustment"
					onclick={(e: MouseEvent) => {
						e.stopPropagation();
						const el = e.currentTarget as HTMLElement;
						el.dispatchEvent(new CustomEvent('noderemove', { detail: { id }, bubbles: true }));
					}}
				>
					&#10005;
				</button>
			{/if}
		</div>

		<!-- Inline controls (default or expanded). Crop has special Edit Pane UI. -->
		{#if verbosity !== 'collapsed' && d.schema && !d.isSource && (d.item as { plugin_id: string }).plugin_id !== 'arami.crop'}
			<div class="border-t border-gray-200/30 px-3 py-2 dark:border-gray-700/30">
				<InlineParamControls
					schema={d.schema}
					{localParams}
					onUpdateParam={handleUpdateParam}
					{verbosity}
					compact={true}
				/>
			</div>
		{/if}
	</div>
</div>

<Handle type="source" position={Position.Bottom} />
