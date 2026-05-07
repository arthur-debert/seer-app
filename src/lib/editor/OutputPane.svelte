<script lang="ts">
	import type { OutputGroupInfo, OutputChildInfo } from './pipeline-worker-protocol';
	import Panel from '$lib/ui/Panel.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import type { DndEvent } from 'svelte-dnd-action';

	interface Props {
		exportGroups: OutputGroupInfo[];
		availableExports: Array<{ id: string; name: string }>;
		selectedId: string | null;
		onSelect: (id: string) => void;
		onToggleGroup: (id: string, enabled: boolean) => void;
		onAddGroup: (pluginId: string) => void;
		onRemoveGroup: (id: string) => void;
		onReorderGroup: (id: string, newIndex: number) => void;
		onRunExport: (id: string) => void;
		onAddChild: (groupId: string, pluginId: string) => void;
		onRemoveChild: (groupId: string, childId: string) => void;
		onToggleChild: (groupId: string, childId: string, enabled: boolean) => void;
	}

	let {
		exportGroups,
		availableExports,
		selectedId,
		onSelect,
		onToggleGroup,
		onAddGroup,
		onRemoveGroup,
		onReorderGroup,
		onRunExport,
		onAddChild,
		onRemoveChild,
		onToggleChild
	}: Props = $props();

	/** Extract the encoder format badge from a group's children. */
	function encoderLabel(group: OutputGroupInfo): string {
		const encoder = group.children.find(
			(c) =>
				c.plugin_id.startsWith('arami.output.') && !c.plugin_id.startsWith('arami.output-child.')
		);
		if (!encoder) return '?';
		return encoder.plugin_id.replace('arami.output.', '').toUpperCase();
	}

	/** Friendly name for a child plugin. */
	function childLabel(child: OutputChildInfo): string {
		if (child.plugin_id === 'arami.output-child.resize') return 'Resize';
		if (child.plugin_id === 'arami.output-child.reframe') return 'Reframe';
		if (child.plugin_id === 'arami.output-child.metadata') return 'Metadata';
		// Encoder
		return child.plugin_id.replace('arami.output.', '').toUpperCase();
	}

	/** Whether a child is the encoder (anchor — not removable). */
	function isEncoder(child: OutputChildInfo): boolean {
		return (
			child.plugin_id.startsWith('arami.output.') &&
			!child.plugin_id.startsWith('arami.output-child.')
		);
	}

	/** Which optional children are not yet in the group. */
	function missingChildren(group: OutputGroupInfo): string[] {
		const existing = new Set(group.children.map((c) => c.plugin_id));
		const optional = [
			'arami.output-child.resize',
			'arami.output-child.reframe',
			'arami.output-child.metadata'
		];
		return optional.filter((id) => !existing.has(id));
	}

	function runAll(): void {
		for (const g of exportGroups) {
			if (g.enabled) onRunExport(g.id);
		}
	}

	// DnD for group reordering
	let dndItems: OutputGroupInfo[] = $derived([...exportGroups]);

	function handleConsider(e: CustomEvent<DndEvent<OutputGroupInfo>>): void {
		dndItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<DndEvent<OutputGroupInfo>>): void {
		dndItems = e.detail.items;
		for (let i = 0; i < dndItems.length; i++) {
			const original = exportGroups.findIndex((g) => g.id === dndItems[i].id);
			if (original !== i) {
				onReorderGroup(dndItems[i].id, i);
				return;
			}
		}
	}

	// Collapsible state per group
	import { SvelteSet } from 'svelte/reactivity';
	let collapsedGroups = new SvelteSet<string>();

	function toggleCollapse(groupId: string): void {
		if (collapsedGroups.has(groupId)) {
			collapsedGroups.delete(groupId);
		} else {
			collapsedGroups.add(groupId);
		}
	}
</script>

<Panel title="Output">
	{#snippet actions()}
		{#if exportGroups.some((g) => g.enabled)}
			<Tooltip text="Export all enabled groups">
				<button
					class="bg-success-muted text-success hover:bg-success-muted/80 rounded px-2 py-0.5 text-xs"
					onclick={runAll}
				>
					Run All
				</button>
			</Tooltip>
		{/if}
	{/snippet}
	<div class="space-y-1" data-export-list>
		<div class="mb-2 flex flex-wrap gap-1">
			{#each availableExports as plugin (plugin.id)}
				<Tooltip text="Add {plugin.name} output">
					<button
						class="bg-surface-2 text-text-muted hover:bg-selected hover:text-text-secondary rounded px-2 py-0.5 text-xs"
						data-plugin-id={plugin.id}
						onclick={() => onAddGroup(plugin.id)}
					>
						+ {plugin.name}
					</button>
				</Tooltip>
			{/each}
		</div>

		{#if exportGroups.length === 0}
			<p class="text-text-faint text-xs italic">No outputs</p>
		{:else}
			<div
				use:dndzone={{ items: dndItems, flipDurationMs: 150, type: 'output-groups' }}
				onconsider={handleConsider}
				onfinalize={handleFinalize}
				class="space-y-1"
			>
				{#each dndItems as group (group.id)}
					{@const isCollapsed = collapsedGroups.has(group.id)}
					{@const isGroupSelected = selectedId === group.id}
					{@const missing = missingChildren(group)}
					<div
						class="group rounded border text-xs transition-colors {isGroupSelected
							? 'border-accent bg-surface-2'
							: 'border-border bg-surface-1 hover:border-border-strong'} {!group.enabled
							? 'opacity-50'
							: ''}"
					>
						<!-- Group header -->
						<div
							class="flex items-center gap-1.5 px-2 py-1.5"
							role="button"
							tabindex="0"
							onclick={() => onSelect(group.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onSelect(group.id);
								}
							}}
						>
							<!-- Collapse toggle -->
							<button
								class="text-text-muted hover:text-text-secondary flex h-4 w-4 shrink-0 items-center justify-center text-[10px]"
								aria-label={isCollapsed ? 'Expand output group' : 'Collapse output group'}
								onclick={(e) => {
									e.stopPropagation();
									toggleCollapse(group.id);
								}}
							>
								{#if isCollapsed}&#x25B8;{:else}&#x25BE;{/if}
							</button>

							<!-- Format badge -->
							<span
								class="bg-selected text-text-secondary inline-block rounded px-1 py-0.5 text-[10px] leading-none font-bold"
							>
								{encoderLabel(group)}
							</span>

							<!-- Name -->
							<span class="text-text-secondary flex-1 truncate">{group.name}</span>

							<!-- Actions -->
							<div class="flex items-center gap-1">
								<Tooltip text="Run export">
									<button
										class="text-text-muted hover:text-success rounded p-0.5"
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											onRunExport(group.id);
										}}
									>
										&#9654;
									</button>
								</Tooltip>
								<Tooltip text={group.enabled ? 'Disable' : 'Enable'}>
									<button
										class="text-text-muted hover:text-text-secondary rounded p-0.5"
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											onToggleGroup(group.id, !group.enabled);
										}}
									>
										{group.enabled ? '&#9679;' : '&#9675;'}
									</button>
								</Tooltip>
								<Tooltip text="Remove">
									<button
										class="text-text-muted hover:text-danger rounded p-0.5 opacity-0 group-hover:opacity-100"
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											onRemoveGroup(group.id);
										}}
									>
										&#10005;
									</button>
								</Tooltip>
							</div>
						</div>

						<!-- Children (when expanded) -->
						{#if !isCollapsed}
							<div class="border-border space-y-0.5 border-t px-2 py-1">
								{#each group.children as child (child.id)}
									{@const isChildSelected = selectedId === child.id}
									<div
										class="flex items-center gap-1.5 rounded px-1.5 py-1 {isChildSelected
											? 'bg-selected text-selected-text'
											: 'text-text-muted hover:bg-surface-2 hover:text-text-secondary'}"
										role="button"
										tabindex="0"
										onclick={() => onSelect(child.id)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												onSelect(child.id);
											}
										}}
									>
										<span class="flex-1 truncate text-[11px]">{childLabel(child)}</span>
										{#if !child.enabled}
											<span class="text-text-faint text-[9px] italic">off</span>
										{/if}
										<div class="flex items-center gap-0.5">
											{#if !isEncoder(child)}
												<Tooltip text={child.enabled ? 'Disable' : 'Enable'}>
													<button
														class="text-text-faint hover:text-text-secondary rounded p-0.5 text-[10px]"
														onclick={(e: MouseEvent) => {
															e.stopPropagation();
															onToggleChild(group.id, child.id, !child.enabled);
														}}
													>
														{child.enabled ? '&#9679;' : '&#9675;'}
													</button>
												</Tooltip>
												<Tooltip text="Remove">
													<button
														class="text-text-faint hover:text-danger rounded p-0.5 text-[10px]"
														onclick={(e: MouseEvent) => {
															e.stopPropagation();
															onRemoveChild(group.id, child.id);
														}}
													>
														&#10005;
													</button>
												</Tooltip>
											{/if}
										</div>
									</div>
								{/each}
								<!-- Add optional children -->
								{#if missing.length > 0}
									<div class="flex flex-wrap gap-1 pt-0.5">
										{#each missing as pluginId (pluginId)}
											{@const label = pluginId.replace('arami.output-child.', '')}
											<button
												class="text-text-faint hover:text-text-muted text-[10px]"
												onclick={(e) => {
													e.stopPropagation();
													onAddChild(group.id, pluginId);
												}}
											>
												+ {label}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Panel>
