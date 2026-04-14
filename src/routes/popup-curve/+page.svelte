<script lang="ts">
	import PopupCurve from '$lib/ui/PopupCurve.svelte';

	interface ControlPoint {
		x: number;
		y: number;
	}

	let points: ControlPoint[] = $state([
		{ x: 0, y: 0 },
		{ x: 25, y: 25 },
		{ x: 50, y: 50 },
		{ x: 75, y: 75 },
		{ x: 100, y: 100 }
	]);

	function handleChange(newPoints: ControlPoint[]) {
		points = newPoints;
	}
</script>

<div
	data-testid="popup-curve-page"
	class="bg-surface-0 flex min-h-screen items-center justify-center p-8"
>
	<div class="bg-surface-1 w-64 rounded-xl p-4">
		<PopupCurve label="Tone Curve" {points} onChange={handleChange} scale={100} />
	</div>
</div>
