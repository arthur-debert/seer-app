<script lang="ts">
	interface Props {
		label: string;
		value: number;
		min?: number;
		max?: number;
		onChange?: (value: number) => void;
	}

	let { label, value, min = 0, max = 100, onChange }: Props = $props();

	const range = $derived(max - min);
	const percentage = $derived(range !== 0 ? ((value - min) / range) * 100 : 0);
	const step = $derived(range !== 0 ? range / 100 : 0);

	let trackEl: HTMLDivElement | undefined = $state();

	function clampAndEmit(v: number) {
		if (!onChange) return;
		onChange(Math.max(min, Math.min(max, v)));
	}

	function onPointerDown(e: PointerEvent) {
		if (!trackEl || !onChange) return;
		trackEl.setPointerCapture(e.pointerId);
		const rect = trackEl.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		onChange(min + ratio * (max - min));
	}

	function onPointerMove(e: PointerEvent) {
		if (!trackEl || !onChange || !(e.buttons > 0)) return;
		const rect = trackEl.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		onChange(min + ratio * (max - min));
	}

	function onKeyDown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				e.preventDefault();
				clampAndEmit(value + step);
				break;
			case 'ArrowLeft':
			case 'ArrowDown':
				e.preventDefault();
				clampAndEmit(value - step);
				break;
			case 'Home':
				e.preventDefault();
				clampAndEmit(min);
				break;
			case 'End':
				e.preventDefault();
				clampAndEmit(max);
				break;
		}
	}
</script>

<div class="flex flex-col gap-1" data-testid="slider-{label.toLowerCase().replace(/\s+/g, '-')}">
	<div class="flex items-center justify-between">
		<span
			class="text-text-secondary text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight select-none"
		>
			{label}
		</span>
		<span class="text-text-secondary text-[9px] font-bold opacity-80" data-testid="slider-value">
			{Math.round(value)}
		</span>
	</div>
	<div
		bind:this={trackEl}
		class="bg-surface-2 relative h-1.5 w-full cursor-pointer touch-none rounded-full"
		role="slider"
		tabindex="0"
		aria-label={label}
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onkeydown={onKeyDown}
		data-testid="slider-track"
	>
		<div
			class="bg-text-primary pointer-events-none absolute top-0 left-0 h-full rounded-full"
			style="width: {percentage}%"
			data-testid="slider-fill"
		></div>
	</div>
</div>
