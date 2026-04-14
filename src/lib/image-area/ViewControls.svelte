<script lang="ts">
	import SnapSlider from './SnapSlider.svelte';

	interface Props {
		/** Current magnification percentage (e.g. 100 = 1:1). */
		zoomPercentage: number;
		/** Whether magnification is in "fit" mode. */
		isFit: boolean;
		/** The percentage at contain-fit. */
		fitPercentage: number;
		/** Current frame/mat percentage (0–50). */
		framePercentage: number;
		/** Current mat color as CSS color string. */
		matColor: string;
		onZoomChange: (percentage: number) => void;
		onFitToggle: () => void;
		onFrameChange: (percentage: number) => void;
		onMatColorChange: (color: string) => void;
	}

	let {
		zoomPercentage,
		isFit,
		fitPercentage,
		framePercentage,
		matColor,
		onZoomChange,
		onFitToggle,
		onFrameChange,
		onMatColorChange
	}: Props = $props();

	const magnificationSnaps = [
		{ value: 25, label: '25%' },
		{ value: 50, label: '50%' },
		{ value: 100, label: '100%' },
		{ value: 200, label: '200%' },
		{ value: 400, label: '400%' }
	];

	const frameSnaps = [
		{ value: 0, label: '0%' },
		{ value: 5, label: '5%' },
		{ value: 10, label: '10%' },
		{ value: 15, label: '15%' },
		{ value: 20, label: '20%' },
		{ value: 30, label: '30%' },
		{ value: 50, label: '50%' }
	];

	const zoomLabel = $derived(isFit ? 'Fit' : `${Math.round(zoomPercentage)}%`);
</script>

<div class="view-controls">
	<div class="control-row">
		<span class="control-label">Magnification</span>
		<div class="control-input">
			<SnapSlider
				min={5}
				max={400}
				value={isFit ? fitPercentage : zoomPercentage}
				snapPoints={magnificationSnaps}
				onChange={onZoomChange}
			/>
		</div>
		<button class="fit-button" class:active={isFit} onclick={onFitToggle} title="Fit to view">
			{zoomLabel}
		</button>
	</div>
	<div class="control-row">
		<span class="control-label">Frame</span>
		<div class="control-input">
			<SnapSlider
				min={0}
				max={50}
				value={framePercentage}
				snapPoints={frameSnaps}
				onChange={onFrameChange}
			/>
		</div>
		<label class="color-swatch-wrapper" title="Mat color">
			<div class="color-swatch" style:background-color={matColor}></div>
			<input
				type="color"
				value={matColor}
				oninput={(e) => onMatColorChange((e.target as HTMLInputElement).value)}
				class="color-input"
			/>
		</label>
	</div>
</div>

<style>
	.view-controls {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 12px;
		background: var(--surface-1);
		border-top: 1px solid var(--border-color);
	}

	.control-row {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 24px;
	}

	.control-label {
		font-size: 11px;
		color: var(--text-muted);
		width: 80px;
		flex-shrink: 0;
		user-select: none;
	}

	.control-input {
		flex: 1;
		min-width: 0;
	}

	.fit-button {
		font-size: 11px;
		color: var(--text-secondary);
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: 3px;
		padding: 1px 8px;
		cursor: pointer;
		min-width: 44px;
		text-align: center;
		user-select: none;
		transition:
			background-color 0.1s,
			border-color 0.1s;
	}

	.fit-button:hover {
		background: var(--selected);
		border-color: var(--border-strong);
	}

	.fit-button.active {
		color: var(--text-primary);
		background: var(--accent-strong);
		border-color: var(--accent);
	}

	.color-swatch-wrapper {
		position: relative;
		cursor: pointer;
		flex-shrink: 0;
	}

	.color-swatch {
		width: 20px;
		height: 20px;
		border-radius: 3px;
		border: 1px solid var(--border-strong);
	}

	.color-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
</style>
