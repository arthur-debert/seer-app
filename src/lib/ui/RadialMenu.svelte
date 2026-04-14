<script lang="ts">
	import type { Component } from 'svelte';
	import { scale } from 'svelte/transition';

	interface RadialMenuItem {
		id: string;
		icon: Component<{ class?: string }>;
		label: string;
	}

	interface Props {
		items: RadialMenuItem[];
		onSelect: (id: string) => void;
		onClose: () => void;
		edge: 'left' | 'right' | 'top' | 'bottom';
	}

	let { items, onSelect, onClose, edge }: Props = $props();

	const STEP_DEG = 45;
	const RADIUS = 65;
	const BG_SIZE = 160;

	/**
	 * Compute the center angle (in radians) of the 180-degree arc based on
	 * which edge the menu is deployed against. The arc opens AWAY from the edge.
	 */
	function arcCenter(e: Props['edge']): number {
		switch (e) {
			case 'right':
				return Math.PI; // opens left
			case 'left':
				return 0; // opens right
			case 'top':
				return Math.PI / 2; // opens down
			case 'bottom':
				return -Math.PI / 2; // opens up
		}
	}

	const center = $derived(arcCenter(edge));

	/**
	 * For N items at 45-degree spacing, distribute symmetrically around the
	 * arc center. E.g. 3 items → center-45°, center, center+45°.
	 */
	function itemAngle(index: number, count: number): number {
		const stepRad = (STEP_DEG * Math.PI) / 180;
		const offset = ((count - 1) / 2) * stepRad;
		return center - offset + index * stepRad;
	}

	function itemX(index: number, count: number): number {
		return Math.cos(itemAngle(index, count)) * RADIUS;
	}

	function itemY(index: number, count: number): number {
		return Math.sin(itemAngle(index, count)) * RADIUS;
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<!-- Escape key closes menu from anywhere -->
<svelte:window onkeydown={handleBackdropKeydown} />

<!-- Backdrop captures clicks outside the menu -->
<div
	class="fixed inset-0 z-50"
	onclick={handleBackdropClick}
	role="presentation"
	data-testid="radial-backdrop"
>
	<!-- Positioned at the trigger point (caller sets container position) -->
	<div class="absolute" style="left: var(--radial-x, 50%); top: var(--radial-y, 50%)">
		<!-- Background circle -->
		<div
			class="bg-glass-bg border-glass-border absolute rounded-full border shadow-2xl backdrop-blur-2xl"
			style="width: {BG_SIZE}px; height: {BG_SIZE}px; top: -{BG_SIZE / 2}px; left: -{BG_SIZE / 2}px"
			transition:scale={{ duration: 200, start: 0 }}
			data-testid="radial-bg"
		></div>

		<!-- Menu items -->
		<div role="menu">
			{#each items as item, i (item.id)}
				{@const x = itemX(i, items.length)}
				{@const y = itemY(i, items.length)}
				{@const Icon = item.icon}
				<button
					class="group border-card-border bg-card-bg hover:bg-surface-2 absolute flex h-9 w-9 items-center justify-center rounded-full border shadow-md transition-colors"
					style="left: {x - 18}px; top: {y - 18}px"
					transition:scale={{ duration: 200, start: 0, delay: i * 20 }}
					onclick={() => {
						onSelect(item.id);
						onClose();
					}}
					role="menuitem"
					data-testid="radial-item"
					data-item-id={item.id}
					aria-label={item.label}
				>
					<Icon class="text-text-primary h-3.5 w-3.5" />

					<!-- Hover label -->
					<span
						class="bg-text-primary text-surface-0 pointer-events-none absolute -bottom-6 rounded-full px-2 py-0.5 text-[length:var(--text-micro)] font-bold whitespace-nowrap opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
					>
						{item.label}
					</span>
				</button>
			{/each}
		</div>
	</div>
</div>
