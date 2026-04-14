<script lang="ts">
	import { slide } from 'svelte/transition';
	import { contrastColor, contrastBorder } from './utils';
	import ColorSwatch from './ColorSwatch.svelte';

	import Settings from '~icons/material-symbols/settings';
	import Close from '~icons/material-symbols/close';

	interface Props {
		matColor: string;
		matSize: number;
		borderWidth: number;
		borderColor: string;
		onMatColorChange: (color: string) => void;
		onMatSizeChange: (size: number) => void;
		onBorderWidthChange: (width: number) => void;
		onBorderColorChange: (color: string) => void;
	}

	let {
		matColor,
		matSize,
		borderWidth,
		borderColor,
		onMatColorChange,
		onMatSizeChange,
		onBorderWidthChange,
		onBorderColorChange
	}: Props = $props();

	let isOpen = $state(false);
	const textClass = $derived(contrastColor(matColor));
	const borderStyle = $derived(contrastBorder(matColor));

	const matColors = [
		{ color: '#000000', label: 'Black' },
		{ color: '#ffffff', label: 'White' },
		{ color: '#262626', label: 'Gray' }
	];

	const borderSizes = [
		{ label: 'P', value: 2 },
		{ label: 'M', value: 4 },
		{ label: 'G', value: 16 }
	];

	const borderColors = [
		{ color: '#ffffff', label: 'White' },
		{ color: '#000000', label: 'Black' },
		{ color: '#404040', label: 'Gray' },
		{ color: 'transparent', label: 'None' }
	];
</script>

<div
	class="flex items-center gap-1 overflow-hidden rounded-full border p-1 shadow-lg backdrop-blur-xl transition-colors duration-300 {textClass}"
	style="background-color: {matColor}cc; border-color: {borderStyle}"
	data-testid="view-settings-toolbar"
>
	<!-- Toggle button -->
	<button
		class="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
		onclick={() => {
			isOpen = !isOpen;
		}}
		aria-label="View settings"
	>
		{#if isOpen}
			<Close class="h-4 w-4" />
		{:else}
			<Settings class="h-4 w-4" />
		{/if}
	</button>

	{#if isOpen}
		<div
			class="flex shrink-0 items-center gap-6 overflow-hidden px-2 py-1 pr-4 whitespace-nowrap"
			transition:slide={{ axis: 'x', duration: 400 }}
		>
			<!-- Divider after toggle -->
			<div class="mx-1 h-4 w-px shrink-0 bg-current opacity-20"></div>

			<!-- Zoom -->
			<div
				class="flex items-center gap-2 border-r pr-4"
				style="border-color: {matColor === '#ffffff' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'}"
			>
				<span
					class="text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight opacity-60 select-none"
					>Zoom</span
				>
				<div
					class="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5"
					style="border-color: {matColor === '#ffffff'
						? 'rgba(0,0,0,0.05)'
						: 'rgba(255,255,255,0.1)'}; background: {matColor === '#ffffff'
						? 'rgba(0,0,0,0.05)'
						: 'rgba(255,255,255,0.1)'}"
				>
					<span class="text-[9px] font-bold">100%</span>
					<svg class="h-2.5 w-2.5 opacity-40" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
			</div>

			<!-- Mat color -->
			<div class="flex items-center gap-2">
				<span
					class="text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight opacity-60 select-none"
					>Mat</span
				>
				<div class="flex gap-1">
					{#each matColors as mc (mc.color)}
						<ColorSwatch
							color={mc.color}
							selected={matColor === mc.color}
							size="sm"
							onClick={() => onMatColorChange(mc.color)}
						/>
					{/each}
				</div>
			</div>

			<!-- Size (mat size slider) -->
			<div
				class="flex min-w-[100px] items-center gap-3 border-r pr-4"
				style="border-color: {matColor === '#ffffff' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'}"
			>
				<span
					class="text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight opacity-60 select-none"
					>Size</span
				>
				<input
					type="range"
					min="5"
					max="30"
					step="1"
					class="h-1 w-20 rounded-full {matColor === '#ffffff'
						? 'bg-black/10 accent-neutral-900'
						: 'bg-white/20 accent-white'}"
					value={matSize}
					oninput={(e) => onMatSizeChange(parseInt((e.target as HTMLInputElement).value))}
				/>
				<span class="text-[8px] font-bold opacity-60">{matSize}%</span>
			</div>

			<!-- Border -->
			<div class="flex items-center gap-3">
				<span
					class="text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight opacity-60 select-none"
					>Border</span
				>
				<div
					class="flex gap-0.5 rounded-full p-0.5"
					style="background: {matColor === '#ffffff'
						? 'rgba(0,0,0,0.05)'
						: 'rgba(255,255,255,0.1)'}"
				>
					{#each borderSizes as bs (bs.label)}
						<button
							class="rounded-full px-1.5 py-0.5 text-[8px] font-bold transition-colors
								{borderWidth === bs.value
								? matColor === '#ffffff'
									? 'bg-neutral-900 text-white'
									: 'bg-white text-neutral-900'
								: 'opacity-60 hover:opacity-100'}"
							onclick={() => onBorderWidthChange(bs.value)}
						>
							{bs.label}
						</button>
					{/each}
				</div>
				<div class="ml-1 flex gap-1">
					{#each borderColors as bc (bc.label)}
						<button
							class="h-3.5 w-3.5 rounded-sm border border-white shadow-sm transition-transform hover:scale-110
								{borderColor === bc.color ? 'ring-2 ring-blue-500' : ''}"
							style="background-color: {bc.color === 'transparent' ? 'transparent' : bc.color}"
							onclick={() => onBorderColorChange(bc.color)}
							title={bc.label}
						></button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
