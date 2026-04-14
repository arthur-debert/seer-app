<script lang="ts">
	interface Props {
		direction?: 'horizontal' | 'vertical';
	}

	let { direction = 'horizontal' }: Props = $props();
</script>

{#if direction === 'vertical'}
	<div class="bg-border h-4 w-px"></div>
{:else}
	<div class="bg-border h-px w-full"></div>
{/if}
