<script lang="ts">
	interface SnapPoint {
		value: number;
		label: string;
	}

	interface Props {
		min: number;
		max: number;
		value: number;
		snapPoints: SnapPoint[];
		/** How close (in slider units) to a snap point before snapping. */
		snapThreshold?: number;
		onChange: (value: number) => void;
		disabled?: boolean;
	}

	let {
		min,
		max,
		value,
		snapPoints,
		snapThreshold = undefined,
		onChange,
		disabled = false
	}: Props = $props();

	const effectiveThreshold = $derived(snapThreshold ?? (max - min) * 0.03);

	function handleInput(e: Event) {
		const raw = parseFloat((e.target as HTMLInputElement).value);
		// Find closest snap point within threshold
		let snapped = raw;
		for (const sp of snapPoints) {
			if (Math.abs(raw - sp.value) <= effectiveThreshold) {
				snapped = sp.value;
				break;
			}
		}
		onChange(snapped);
	}

	// Snap point positions as percentages for tick marks
	const tickPositions = $derived(
		snapPoints.map((sp) => ({
			...sp,
			pct: ((sp.value - min) / (max - min)) * 100
		}))
	);
</script>

<div class="snap-slider" class:disabled>
	<div class="slider-track-container">
		<input
			type="range"
			{min}
			{max}
			step="0.1"
			{value}
			{disabled}
			oninput={handleInput}
			class="slider"
		/>
		<div class="tick-marks">
			{#each tickPositions as tick (tick.value)}
				<div
					class="tick"
					class:active={Math.abs(value - tick.value) < 0.5}
					style:left="{tick.pct}%"
				>
					<div class="tick-line"></div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.snap-slider {
		position: relative;
		width: 100%;
	}

	.snap-slider.disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.slider-track-container {
		position: relative;
		height: 20px;
	}

	.slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		background: var(--border-strong);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		position: absolute;
		z-index: 2;
		margin: 0;
		top: 50%;
		transform: translateY(-50%);
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--text-muted);
		cursor: pointer;
		border: 2px solid var(--border-strong);
		transition: background-color 0.1s;
	}

	.slider::-webkit-slider-thumb:hover {
		background: var(--text-secondary);
	}

	.tick-marks {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 0;
		z-index: 1;
		pointer-events: none;
	}

	.tick {
		position: absolute;
		transform: translateX(-50%);
	}

	.tick-line {
		width: 1px;
		height: 8px;
		background: var(--border-strong);
		transform: translateY(-50%);
	}

	.tick.active .tick-line {
		background: var(--text-muted);
	}
</style>
