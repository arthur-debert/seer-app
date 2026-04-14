<script lang="ts">
	import type { OutputGroupInfo, OutputPath } from './pipeline-worker-protocol';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		group: OutputGroupInfo;
		onNameChange: (id: string, name: string) => void;
		onSuffixChange: (id: string, suffix: string) => void;
		onPathChange: (id: string, path: OutputPath) => void;
	}

	let { group, onNameChange, onSuffixChange, onPathChange }: Props = $props();

	let pathMode = $derived(
		typeof group.path === 'string'
			? group.path
			: group.path && 'Custom' in group.path
				? 'Custom'
				: 'SameAsSource'
	);

	function onPathModeChange(e: Event): void {
		const mode = (e.target as HTMLSelectElement).value;
		if (mode === 'Custom') {
			onPathChange(group.id, { Custom: '' });
		} else {
			onPathChange(group.id, 'SameAsSource');
		}
	}
</script>

<Panel title="Output Group">
	<div class="space-y-4">
		<!-- Name -->
		<div class="space-y-1">
			<label for="output-group-name" class="text-text-muted block text-[10px] uppercase">Name</label
			>
			<input
				id="output-group-name"
				type="text"
				class="bg-surface-2 text-text-secondary focus:ring-accent w-full rounded px-2 py-1 text-xs outline-none focus:ring-1"
				value={group.name}
				onchange={(e) => onNameChange(group.id, (e.target as HTMLInputElement).value)}
			/>
		</div>

		<!-- Suffix -->
		<div class="space-y-1">
			<label for="output-group-suffix" class="text-text-muted block text-[10px] uppercase"
				>Filename Suffix</label
			>
			<input
				id="output-group-suffix"
				type="text"
				class="bg-surface-2 text-text-secondary focus:ring-accent w-full rounded px-2 py-1 text-xs outline-none focus:ring-1"
				value={group.suffix}
				placeholder="_web, _print, etc."
				onchange={(e) => onSuffixChange(group.id, (e.target as HTMLInputElement).value)}
			/>
		</div>

		<!-- Path -->
		<div class="space-y-1">
			<label for="output-group-path" class="text-text-muted block text-[10px] uppercase"
				>Output Path</label
			>
			<select
				id="output-group-path"
				class="bg-surface-2 text-text-secondary focus:ring-accent w-full rounded px-2 py-1 text-xs outline-none focus:ring-1"
				value={pathMode}
				onchange={onPathModeChange}
			>
				<option value="SameAsSource">Same as source</option>
				<option value="Custom">Custom path</option>
			</select>
			{#if pathMode === 'Custom' && typeof group.path === 'object' && group.path !== null && 'Custom' in group.path}
				<input
					type="text"
					class="bg-surface-2 text-text-secondary focus:ring-accent mt-1 w-full rounded px-2 py-1 text-xs outline-none focus:ring-1"
					value={group.path.Custom}
					placeholder="/path/to/output/directory"
					onchange={(e) => onPathChange(group.id, { Custom: (e.target as HTMLInputElement).value })}
				/>
			{/if}
		</div>
	</div>
</Panel>
