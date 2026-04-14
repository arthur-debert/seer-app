<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Slot for controls rendered in the header bar (filters, + Add, Run All). */
		actions?: Snippet;
		children: Snippet;
	}

	let { title, actions, children }: Props = $props();
</script>

<div class="space-y-1">
	<div class="bg-surface-header -mx-3 mb-2 flex items-center justify-between px-3 py-1">
		<h3 class="text-text-muted text-xs font-semibold tracking-wide uppercase">{title}</h3>
		{#if actions}
			{@render actions()}
		{/if}
	</div>
	{@render children()}
</div>
