<script lang="ts">
	import PopupSelect from '$lib/ui/PopupSelect.svelte';

	const aspectOptions = [
		{ value: '1:1', label: '1:1' },
		{ value: '4:3', label: '4:3' },
		{ value: '3:2', label: '3:2' },
		{ value: '16:9', label: '16:9' }
	];

	let selected = $state('4:3');
</script>

<main
	class="bg-surface-0 flex min-h-screen items-start justify-center p-8"
	data-testid="popup-select-page"
>
	<div class="bg-surface-1 w-64 rounded-xl p-4">
		<h1 class="text-text-primary mb-4 text-lg font-semibold">PopupSelect Demo</h1>
		<PopupSelect
			label="Aspect"
			value={selected}
			options={aspectOptions}
			onChange={(v) => {
				selected = v;
			}}
		/>
		<p class="text-text-muted mt-4 text-xs">
			Selected: <span data-testid="selected-value">{selected}</span>
		</p>
	</div>
</main>
