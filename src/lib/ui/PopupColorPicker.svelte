<script lang="ts">
	import { scale } from 'svelte/transition';
	import Portal from './Portal.svelte';
	import Slider from './Slider.svelte';
	import { hexToHsb, hsbToHex } from './utils';

	interface Props {
		label: string;
		color: string;
		onChange: (hex: string) => void;
		showRecents?: boolean;
		showSliders?: boolean;
		recentColors?: { h: number; s: number; b: number }[];
	}

	let {
		label,
		color,
		onChange,
		showRecents = false,
		showSliders = false,
		recentColors = []
	}: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let popupTop = $state(0);
	let popupRight = $state(0);
	let dragging = $state(false);
	let wheelEl: HTMLDivElement | undefined = $state();

	const hsb = $derived(hexToHsb(color));

	function openPopup() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		popupTop = rect.top - 20;
		popupRight = window.innerWidth - rect.left + 16;
		open = true;
	}

	function close() {
		open = false;
	}

	$effect(() => {
		if (!open) return;
		function onEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') close();
		}
		window.addEventListener('keydown', onEscape);
		return () => window.removeEventListener('keydown', onEscape);
	});

	function updateFromWheel(clientX: number, clientY: number) {
		if (!wheelEl) return;
		const rect = wheelEl.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const radius = rect.width / 2;

		const dx = clientX - cx;
		const dy = clientY - cy;
		const dist = Math.sqrt(dx * dx + dy * dy);

		let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
		const hue = (angleDeg + 90 + 360) % 360;
		const saturation = Math.min(100, (dist / radius) * 100);

		// Magnetic snapping to recent colors
		if (showRecents && recentColors.length > 0) {
			const snapThreshold = 0.15; // 15% of radius
			for (const rc of recentColors) {
				const rcAngle = (rc.h - 90) * (Math.PI / 180);
				const rcDist = (rc.s / 100) * radius;
				const rcX = cx + rcDist * Math.cos(rcAngle);
				const rcY = cy + rcDist * Math.sin(rcAngle);
				const snapDist = Math.sqrt((clientX - rcX) ** 2 + (clientY - rcY) ** 2);
				if (snapDist < radius * snapThreshold) {
					onChange(hsbToHex(rc.h, rc.s, hsb.b));
					return;
				}
			}
		}

		onChange(hsbToHex(hue, saturation, hsb.b));
	}

	function onWheelPointerDown(e: PointerEvent) {
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		updateFromWheel(e.clientX, e.clientY);
	}

	function onWheelPointerMove(e: PointerEvent) {
		if (!dragging) return;
		updateFromWheel(e.clientX, e.clientY);
	}

	function onWheelPointerUp() {
		dragging = false;
	}

	// Dot positioning for the selection indicator
	function dotStyle(h: number, s: number, size: number = 12): string {
		const angleRad = (h - 90) * (Math.PI / 180);
		const radiusPct = (s / 100) * 50;
		const offset = size / 2;
		const left = `calc(50% + ${radiusPct * Math.cos(angleRad)}% - ${offset}px)`;
		const top = `calc(50% + ${radiusPct * Math.sin(angleRad)}% - ${offset}px)`;
		return `left: ${left}; top: ${top};`;
	}
</script>

<div class="flex w-full items-center justify-between gap-2" data-testid="popup-color-picker">
	<span
		class="text-text-secondary text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight opacity-60 select-none"
	>
		{label}
	</span>
	<button
		bind:this={triggerEl}
		class="border-border h-4 w-4 rounded-full border shadow-sm"
		style="background-color: {color}"
		onclick={openPopup}
		aria-label="Pick color for {label}"
		data-testid="popup-color-trigger"
	></button>
</div>

{#if open}
	<Portal>
		<div
			class="fixed inset-0 z-50"
			onclick={close}
			onwheel={close}
			role="presentation"
			data-testid="popup-color-backdrop"
		></div>
		<div
			class="bg-card-bg/95 border-card-border fixed z-50 min-w-[140px] rounded-3xl border p-3 shadow-xl backdrop-blur-2xl"
			style="top: {popupTop}px; right: {popupRight}px;"
			transition:scale={{ duration: 150, start: 0.9 }}
			data-testid="popup-color-popup"
		>
			<!-- Color wheel -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={wheelEl}
				class="border-border relative aspect-square w-full rounded-full border shadow-inner"
				style="
				background: conic-gradient(from 90deg at 50% 50%, red, yellow, lime, aqua, blue, magenta, red);
			"
				onpointerdown={onWheelPointerDown}
				onpointermove={onWheelPointerMove}
				onpointerup={onWheelPointerUp}
				data-testid="popup-color-wheel"
			>
				<!-- Desaturation overlay -->
				<div
					class="pointer-events-none absolute inset-0 rounded-full"
					style="background: radial-gradient(circle closest-side, white 0%, transparent 100%);"
				></div>
				<!-- Brightness overlay -->
				<div
					class="pointer-events-none absolute inset-0 rounded-full"
					style="background: black; opacity: {1 - hsb.b / 100};"
				></div>

				<!-- Recent color dots -->
				{#if showRecents}
					{#each recentColors as rc (rc.h + '-' + rc.s + '-' + rc.b)}
						<div
							class="pointer-events-none absolute h-2 w-2 rounded-full border border-white/60 shadow-sm"
							style="{dotStyle(rc.h, rc.s, 8)} background-color: {hsbToHex(rc.h, rc.s, rc.b)};"
							data-testid="popup-color-recent-dot"
						></div>
					{/each}
				{/if}

				<!-- Selection indicator -->
				<div
					class="pointer-events-none absolute h-3 w-3 rounded-full border-2 border-white shadow-md"
					style="{dotStyle(hsb.h, hsb.s)} background-color: {color};"
					data-testid="popup-color-indicator"
				></div>
			</div>

			<!-- Sliders -->
			{#if showSliders}
				<div class="border-border mt-2 border-t pt-1">
					<Slider
						label="H"
						value={hsb.h}
						min={0}
						max={360}
						onChange={(v) => onChange(hsbToHex(v, hsb.s, hsb.b))}
					/>
					<Slider
						label="S"
						value={hsb.s}
						min={0}
						max={100}
						onChange={(v) => onChange(hsbToHex(hsb.h, v, hsb.b))}
					/>
					<Slider
						label="B"
						value={hsb.b}
						min={0}
						max={100}
						onChange={(v) => onChange(hsbToHex(hsb.h, hsb.s, v))}
					/>
				</div>
			{/if}
		</div>
	</Portal>
{/if}
