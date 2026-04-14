<script lang="ts">
	import type { Component } from 'svelte';
	import Tooltip from './Tooltip.svelte';

	interface Props {
		icon: Component<{ class?: string }>;
		label?: string;
		active?: boolean;
		disabled?: boolean;
		size?: 'sm' | 'md';
		onClick: () => void;
	}

	let {
		icon: Icon,
		label,
		active = false,
		disabled = false,
		size = 'md',
		onClick
	}: Props = $props();

	const sizeClass = $derived(size === 'sm' ? 'h-8 w-8' : 'h-9 w-9');
	const iconSize = $derived(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4');
</script>

{#if label}
	<Tooltip text={label}>
		<button
			class="flex items-center justify-center rounded-full transition-colors
				{sizeClass}
				{active ? 'bg-text-primary text-surface-0 shadow-md' : 'hover:bg-surface-2/50 text-text-secondary'}
				{disabled ? 'pointer-events-none opacity-40' : ''}"
			{disabled}
			title={label}
			onclick={onClick}
		>
			<Icon class={iconSize} />
		</button>
	</Tooltip>
{:else}
	<button
		class="flex items-center justify-center rounded-full transition-colors
			{sizeClass}
			{active ? 'bg-text-primary text-surface-0 shadow-md' : 'hover:bg-surface-2/50 text-text-secondary'}
			{disabled ? 'pointer-events-none opacity-40' : ''}"
		{disabled}
		onclick={onClick}
	>
		<Icon class={iconSize} />
	</button>
{/if}
