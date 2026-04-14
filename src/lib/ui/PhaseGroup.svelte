<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import RadialMenu from './RadialMenu.svelte';

	interface RadialMenuItem {
		id: string;
		icon: Component<{ class?: string }>;
		label: string;
	}

	interface Props {
		title: string;
		children: Snippet;
		empty?: boolean;
		addItems?: RadialMenuItem[];
		addEdge?: 'left' | 'right' | 'top' | 'bottom';
		onAdd?: (id: string) => void;
	}

	let { title, children, empty = false, addItems, addEdge = 'left', onAdd }: Props = $props();

	let menuOpen = $state(false);
	let anchorX = $state(0);
	let anchorY = $state(0);

	function openMenu(e: MouseEvent) {
		const btn = e.currentTarget as HTMLElement;
		const rect = btn.getBoundingClientRect();
		anchorX = rect.left + rect.width / 2;
		anchorY = rect.top + rect.height / 2;
		menuOpen = !menuOpen;
	}
</script>

<div class="border-border flex flex-col border-b">
	<!-- Phase header -->
	<div
		class="bg-surface-header relative flex items-center justify-center px-3 py-4"
		data-testid="phase-header"
	>
		{#if addItems && addItems.length > 0 && onAdd}
			<div class="absolute top-1/2 left-3 -translate-y-1/2">
				<button
					class="border-card-border bg-card-bg text-text-secondary hover:bg-text-primary hover:text-surface-0 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors
						{menuOpen ? 'rotate-45' : ''}"
					onclick={openMenu}
					aria-label="Add to {title}"
					data-testid="phase-add-{title.toLowerCase().replace(/\s+/g, '-')}"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</button>
			</div>
		{/if}

		<span
			class="text-text-primary text-[length:var(--text-label)] font-bold tracking-tighter select-none"
		>
			{title}
		</span>
	</div>

	<!-- Node panels -->
	<div class="bg-surface-1/40 flex w-full flex-col">
		{@render children()}

		{#if empty}
			<div class="border-card-border flex h-10 items-center justify-center border-t opacity-30">
				<span
					class="text-text-secondary text-[length:var(--text-micro)] font-bold tracking-widest uppercase"
				>
					Empty
				</span>
			</div>
		{/if}
	</div>
</div>

<!-- Radial menu (rendered outside the sidebar's overflow container via fixed positioning) -->
{#if menuOpen && addItems && onAdd}
	<div style="--radial-x: {anchorX}px; --radial-y: {anchorY}px;">
		<RadialMenu
			items={addItems}
			edge={addEdge}
			onSelect={(id) => {
				onAdd!(id);
			}}
			onClose={() => {
				menuOpen = false;
			}}
		/>
	</div>
{/if}
