<script lang="ts">
	import PopupColorPicker from '$lib/ui/PopupColorPicker.svelte';

	let basicColor = $state('#3b82f6');
	let recentsColor = $state('#ef4444');
	let slidersColor = $state('#10b981');

	const recentColors = [
		{ h: 0, s: 80, b: 90 },
		{ h: 120, s: 60, b: 80 },
		{ h: 240, s: 70, b: 85 },
		{ h: 45, s: 90, b: 95 }
	];
</script>

<main
	class="bg-surface-0 flex min-h-screen items-start justify-center gap-8 p-8"
	data-testid="popup-color-page"
>
	<div class="bg-surface-1 w-64 rounded-xl p-4">
		<h1 class="text-text-primary mb-4 text-lg font-semibold">Basic</h1>
		<PopupColorPicker
			label="Accent"
			color={basicColor}
			onChange={(v) => {
				basicColor = v;
			}}
		/>
		<p class="text-text-muted mt-4 text-xs">
			Color: <span data-testid="basic-color-value">{basicColor}</span>
		</p>
	</div>

	<div class="bg-surface-1 w-64 rounded-xl p-4">
		<h1 class="text-text-primary mb-4 text-lg font-semibold">With Recents</h1>
		<PopupColorPicker
			label="Highlight"
			color={recentsColor}
			onChange={(v) => {
				recentsColor = v;
			}}
			showRecents={true}
			{recentColors}
		/>
		<p class="text-text-muted mt-4 text-xs">
			Color: <span data-testid="recents-color-value">{recentsColor}</span>
		</p>
	</div>

	<div class="bg-surface-1 w-64 rounded-xl p-4">
		<h1 class="text-text-primary mb-4 text-lg font-semibold">With Sliders</h1>
		<PopupColorPicker
			label="Tint"
			color={slidersColor}
			onChange={(v) => {
				slidersColor = v;
			}}
			showSliders={true}
		/>
		<p class="text-text-muted mt-4 text-xs">
			Color: <span data-testid="sliders-color-value">{slidersColor}</span>
		</p>
	</div>
</main>
