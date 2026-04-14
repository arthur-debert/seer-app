<script lang="ts">
	interface Props {
		label: string;
		active: boolean;
		onToggle: (value: boolean) => void;
	}

	let { label, active, onToggle }: Props = $props();
</script>

<button
	class="flex w-full items-center justify-between gap-2"
	role="switch"
	aria-checked={active}
	onclick={() => onToggle(!active)}
>
	<span
		class="text-text-secondary text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight select-none"
	>
		{label}
	</span>
	<div
		class="relative h-3 w-6 rounded-full transition-colors duration-200 {active
			? 'bg-text-primary'
			: 'bg-text-faint'}"
	>
		<div
			class="absolute top-[2px] h-2 w-2 rounded-full bg-white shadow-sm transition-[left] duration-200"
			style="left: {active ? '14px' : '2px'}"
		></div>
	</div>
</button>
