<script lang="ts">
	import type { PhaseInfo } from './phases';
	import type { Snippet } from 'svelte';

	interface Props {
		phase: PhaseInfo;
		children: Snippet;
	}

	let { phase, children }: Props = $props();
</script>

<!--
	Topology-aware phase wrapper. Renders the phase with a data attribute
	indicating its topology, so CSS and future layout logic can dispatch
	on it. The actual phase content is passed as a snippet — each phase
	still owns its own rendering, but the wrapper knows the shape.
-->
{#if phase.index > 0}
	<div class="mt-4" data-phase={phase.name} data-topology={phase.topology}>
		{@render children()}
	</div>
{:else}
	<div data-phase={phase.name} data-topology={phase.topology}>
		{@render children()}
	</div>
{/if}
