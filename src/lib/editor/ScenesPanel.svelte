<script lang="ts">
	import type { ZoneInfo } from './editor-bridge';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		scenes: ZoneInfo[];
		selectedZoneId: string | null;
		onSelectZone: (id: string | null) => void;
		onAddComposition: () => void;
		onRemoveComposition: (id: string) => void;
		onRenameComposition: (id: string, name: string) => void;
	}

	let {
		scenes,
		selectedZoneId,
		onSelectZone,
		onAddComposition,
		onRemoveComposition,
		onRenameComposition
	}: Props = $props();

	let editingId: string | null = $state(null);
	let editingName: string = $state('');

	function startRename(id: string, currentName: string): void {
		editingId = id;
		editingName = currentName;
	}

	function commitRename(): void {
		if (editingId && editingName.trim()) {
			onRenameComposition(editingId, editingName.trim());
		}
		editingId = null;
		editingName = '';
	}

	function cancelRename(): void {
		editingId = null;
		editingName = '';
	}

	function focusOnMount(node: HTMLElement): void {
		node.focus();
	}
</script>

<Panel title="Scenes">
	{#snippet actions()}
		<button
			class="text-text-muted hover:bg-surface-2 hover:text-text-secondary rounded px-1.5 py-0.5 text-xs"
			aria-label="Add composition"
			onclick={onAddComposition}
		>
			+ Add
		</button>
	{/snippet}
	{#each scenes as scene (scene.id)}
		{@const isSelected = scene.id === selectedZoneId}
		<div
			class="group rounded px-3 py-1.5 text-sm {isSelected
				? 'bg-selected-alt text-selected-alt-text'
				: 'text-text-muted hover:bg-surface-2 hover:text-text-secondary'}"
			role="button"
			tabindex="0"
			onclick={() => onSelectZone(isSelected ? null : scene.id)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onSelectZone(isSelected ? null : scene.id);
			}}
		>
			<div class="flex items-center gap-2">
				{#if editingId === scene.id}
					<input
						class="border-text-faint bg-surface-2 text-text-secondary focus:border-accent flex-1 rounded border px-1.5 py-0.5 text-sm outline-none"
						value={editingName}
						oninput={(e) => (editingName = (e.target as HTMLInputElement).value)}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitRename();
							if (e.key === 'Escape') cancelRename();
						}}
						onblur={commitRename}
						onclick={(e) => e.stopPropagation()}
						use:focusOnMount
					/>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span
						class="flex-1 truncate"
						ondblclick={(e) => {
							e.stopPropagation();
							startRename(scene.id, scene.name);
						}}
					>
						{scene.name}
					</span>
				{/if}
				<button
					class="text-text-faint hover:text-danger shrink-0 opacity-0 group-hover:opacity-100"
					aria-label="Remove composition"
					onclick={(e) => {
						e.stopPropagation();
						onRemoveComposition(scene.id);
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
			</div>
		</div>
	{:else}
		<p class="px-3 text-xs text-text-faint italic">No scenes</p>
	{/each}
</Panel>
