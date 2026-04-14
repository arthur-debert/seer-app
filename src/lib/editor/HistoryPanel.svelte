<script lang="ts">
	import type { VersionNode, VersionStep, HistoryMutation } from './editor-bridge';
	import type { TagEntry } from './editor-bridge';
	import { icons, pluginIconMap, getZoneIcons } from '$lib/icons';
	import Panel from '$lib/ui/Panel.svelte';
	const StarIcon = icons.star.component;

	function autoFocus(node: HTMLElement) {
		node.focus();
	}

	interface Props {
		nodes: VersionNode[];
		headNodeId: string;
		tags: TagEntry[];
		onJumpTo: (nodeId: string) => void;
		onTag: (name: string) => void;
		onUntag: (name: string) => void;
	}

	let { nodes, headNodeId, tags, onJumpTo, onTag, onUntag }: Props = $props();

	let filter: 'all' | 'named' = $state('all');
	let tagInput: string = $state('');
	let showTagInput: boolean = $state(false);
	import { SvelteSet } from 'svelte/reactivity';
	let expandedNodes = new SvelteSet<string>();

	let taggedNodeIds = $derived(new Set(tags.map((t) => t.nodeId)));

	let displayNodes = $derived.by(() => {
		const reversed = [...nodes].reverse();
		if (filter === 'named') {
			return reversed.filter((n) => taggedNodeIds.has(n.id));
		}
		return reversed;
	});

	let tagsByNodeId = $derived.by(() => {
		const obj: Record<string, string[]> = {};
		for (const t of tags) {
			if (obj[t.nodeId]) {
				obj[t.nodeId].push(t.name);
			} else {
				obj[t.nodeId] = [t.name];
			}
		}
		return obj;
	});

	let headIndex = $derived(nodes.findIndex((n) => n.id === headNodeId));

	let baseTimestamp = $derived.by(() => {
		for (const n of nodes) {
			if (n.timestamp_ms > 0) return n.timestamp_ms;
		}
		return 0;
	});

	function formatRelative(ts: number): string {
		if (ts === 0) return '';
		const delta = Math.max(0, Math.floor((ts - baseTimestamp) / 1000));
		if (delta < 60) return `${delta}s`;
		const mins = Math.floor(delta / 60);
		const secs = delta % 60;
		if (mins < 60) return `${mins}m ${String(secs).padStart(2, '0')}s`;
		const hrs = Math.floor(mins / 60);
		const remMins = mins % 60;
		return `${hrs}h ${String(remMins).padStart(2, '0')}m`;
	}

	function isAfterHead(node: VersionNode): boolean {
		const idx = nodes.findIndex((n) => n.id === node.id);
		return idx > headIndex;
	}

	function toggleExpand(nodeId: string): void {
		if (expandedNodes.has(nodeId)) {
			expandedNodes.delete(nodeId);
		} else {
			expandedNodes.add(nodeId);
		}
	}

	/** Extract plugin kind from a mutation (for icon lookup). */
	function mutationKind(m: HistoryMutation): string | null {
		if ('AddAdjustment' in m) return m.AddAdjustment.kind;
		if ('RemoveAdjustment' in m) return m.RemoveAdjustment.kind;
		if ('UpdateParams' in m) return nameToKind(m.UpdateParams.adjustment_name);
		if ('SetSource' in m) return 'source';
		return null;
	}

	/** Best-effort map from human name to plugin kind for UpdateParams mutations. */
	function nameToKind(name: string): string | null {
		const lower = name.toLowerCase().replace(/\s+/g, '-');
		const candidate = `seer.${lower}`;
		if (candidate in pluginIconMap) return candidate;
		return null;
	}

	const zoneNameToKindLabel: Record<string, [string, string]> = {
		Sky: ['AI', 'Sky'],
		Person: ['AI', 'Person'],
		Vegetation: ['AI', 'Vegetation'],
		Structure: ['AI', 'Structure'],
		'Luminance Zone': ['Luminance', 'Luminance Zone'],
		'Brush Zone': ['Brush', 'Brush Zone'],
		'Gradient Zone': ['Gradient', 'Gradient Zone'],
		'Color Range Zone': ['Color', 'Color Range Zone']
	};

	function zoneMutationIcon(m: HistoryMutation) {
		const name =
			('AddZone' in m && m.AddZone.kind) || ('RemoveZone' in m && m.RemoveZone.kind) || null;
		if (!name) return null;
		const entry = zoneNameToKindLabel[name];
		if (!entry) return null;
		const zoneIcons = getZoneIcons(entry[0], entry[1]);
		return zoneIcons.length > 0 ? zoneIcons[0] : null;
	}

	function nodeIcon(node: VersionNode) {
		for (const step of node.steps) {
			const kind = mutationKind(step.mutation);
			if (kind) {
				const key = pluginIconMap[kind];
				if (key) return icons[key].component;
			}
			const zi = zoneMutationIcon(step.mutation);
			if (zi) return zi;
		}
		return null;
	}

	function stepIcon(step: VersionStep) {
		const kind = mutationKind(step.mutation);
		if (kind) {
			const key = pluginIconMap[kind];
			if (key) return icons[key].component;
		}
		return zoneMutationIcon(step.mutation);
	}

	function handleTagSubmit(): void {
		const name = tagInput.trim();
		if (name) {
			onTag(name);
		}
		tagInput = '';
		showTagInput = false;
	}

	function handleTagKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			handleTagSubmit();
		} else if (e.key === 'Escape') {
			tagInput = '';
			showTagInput = false;
		}
	}
</script>

<Panel title="History">
	{#snippet actions()}
		<div class="flex gap-1">
			<button
				class="rounded px-1.5 py-0.5 text-xs"
				class:bg-selected={filter === 'all'}
				class:text-text-secondary={filter === 'all'}
				class:text-text-muted={filter !== 'all'}
				onclick={() => (filter = 'all')}
			>
				All
			</button>
			<button
				class="rounded px-1.5 py-0.5 text-xs"
				class:bg-selected={filter === 'named'}
				class:text-text-secondary={filter === 'named'}
				class:text-text-muted={filter !== 'named'}
				onclick={() => (filter = 'named')}
			>
				Named
			</button>
		</div>
	{/snippet}
	<div class="space-y-0.5">
		{#each displayNodes as node (node.id)}
			{@const isHead = node.id === headNodeId}
			{@const afterHead = isAfterHead(node)}
			{@const nodeTags = tagsByNodeId[node.id]}
			{@const isCompound = node.steps.length > 1}
			{@const isExpanded = expandedNodes.has(node.id)}
			{@const NodeIcon = nodeIcon(node)}
			<div
				class="group rounded {isHead ? 'bg-accent-muted' : ''} {!isHead && !afterHead
					? 'hover:bg-surface-2'
					: ''}"
			>
				<!-- Main row -->
				<div
					class="flex items-center gap-1 py-1 pr-2 pl-1 {!isHead ? 'cursor-pointer' : ''}"
					role="button"
					tabindex="0"
					onclick={() => {
						if (!isHead) onJumpTo(node.id);
					}}
					onkeydown={(e) => {
						if (!isHead && (e.key === 'Enter' || e.key === ' ')) onJumpTo(node.id);
					}}
				>
					<!-- Expand/collapse or head indicator -->
					{#if isCompound}
						<button
							class="text-text-muted hover:text-text-secondary flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs"
							aria-label={isExpanded ? 'Collapse' : 'Expand'}
							onclick={(e) => {
								e.stopPropagation();
								toggleExpand(node.id);
							}}
						>
							{#if isExpanded}&#x25BE;{:else}&#x25B8;{/if}
						</button>
					{:else}
						<span class="flex h-5 w-5 shrink-0 items-center justify-center text-xs">
							{#if isHead}
								<span class="text-accent">&#x25B8;</span>
							{/if}
						</span>
					{/if}

					<!-- Node type icon -->
					{#if NodeIcon}
						<span
							class="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
							class:text-selected-alt-text={isHead}
							class:text-text-muted={!isHead && !afterHead}
							class:text-text-faint={afterHead}
						>
							<NodeIcon class="h-3.5 w-3.5" />
						</span>
					{/if}

					<!-- Label -->
					<span
						class="min-w-0 flex-1 truncate text-xs"
						class:text-selected-alt-text={isHead}
						class:text-text-secondary={!isHead && !afterHead}
						class:text-text-faint={afterHead}
						class:line-through={afterHead}
						title={node.label}
					>
						{node.label}
					</span>

					<!-- Tags (inline) -->
					{#if nodeTags && nodeTags.length > 0}
						{#each nodeTags as tagName (tagName)}
							<span
								class="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0 text-[10px]"
								class:bg-warning-muted={!afterHead}
								class:text-warning={!afterHead}
								class:bg-surface-2={afterHead}
								class:text-text-muted={afterHead}
							>
								{tagName}
								<button
									class="hover:text-text-primary"
									aria-label="Remove tag {tagName}"
									onclick={(e) => {
										e.stopPropagation();
										onUntag(tagName);
									}}
								>
									x
								</button>
							</span>
						{/each}
					{/if}

					<!-- Star (add tag) button -->
					{#if isHead && !showTagInput}
						<button
							class="text-accent hover:text-selected-alt-text flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100"
							aria-label="Add tag"
							onclick={(e) => {
								e.stopPropagation();
								showTagInput = true;
							}}
						>
							<StarIcon class="h-3 w-3" />
						</button>
					{/if}

					<!-- Timestamp -->
					{#if formatRelative(node.timestamp_ms)}
						<span class="text-text-faint shrink-0 text-[10px]"
							>{formatRelative(node.timestamp_ms)}</span
						>
					{/if}
				</div>

				<!-- Tag input -->
				{#if isHead && showTagInput}
					<div class="px-1 pb-1">
						<input
							type="text"
							class="border-border-strong bg-surface-1 text-text-secondary focus:border-accent w-full rounded border px-2 py-0.5 text-xs outline-none"
							placeholder="Tag name..."
							bind:value={tagInput}
							onkeydown={handleTagKeydown}
							onblur={handleTagSubmit}
							use:autoFocus
						/>
					</div>
				{/if}

				<!-- Expanded child steps -->
				{#if isCompound && isExpanded}
					<div class="space-y-0.5 pb-1 pl-6">
						{#each node.steps as step, i (i)}
							{@const StepIcon = stepIcon(step)}
							<div class="flex items-center gap-1 text-xs">
								{#if StepIcon}
									<span
										class="flex h-3 w-3 shrink-0 items-center justify-center"
										class:text-selected-alt-text={isHead}
										class:text-text-faint={!isHead}
									>
										<StepIcon class="h-3 w-3" />
									</span>
								{/if}
								<span
									class="min-w-0 flex-1 truncate"
									class:text-selected-alt-text={isHead}
									class:text-text-muted={!isHead && !afterHead}
									class:text-text-faint={afterHead}
								>
									{step.label}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</Panel>
