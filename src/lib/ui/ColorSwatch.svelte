<script lang="ts">
	interface Props {
		color: string;
		selected: boolean;
		onClick: () => void;
		size?: 'sm' | 'md';
	}

	let { color, selected, onClick, size = 'md' }: Props = $props();

	const sizeClass = $derived(size === 'sm' ? 'h-5 w-5' : 'h-6 w-6');
</script>

<button
	class="rounded-full border transition-shadow {sizeClass}
		{selected ? 'ring-accent ring-offset-surface-0 ring-2 ring-offset-1' : ''}
		{color === '#ffffff' || color === '#f5f5f5' ? 'border-border' : 'border-transparent'}"
	style="background-color: {color}"
	aria-label="Color {color}"
	onclick={onClick}
></button>
