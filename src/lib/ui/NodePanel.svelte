<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		title: string;
		icon: Component<{ class?: string }>;
		onRemove?: () => void;
		isLast: boolean;
		index: number;
		children: Snippet;
	}

	let { title, icon: Icon, onRemove, isLast, index, children }: Props = $props();
</script>

<div
	class="border-card-border bg-card-bg relative flex w-full flex-col border-t backdrop-blur-xl"
	style="z-index: {50 - index}"
	transition:scale={{ duration: 200, start: 0.95 }}
	data-testid="node-panel"
>
	<!-- Header -->
	<div
		class="border-card-border flex items-center justify-between border-b px-3 py-2.5"
		data-testid="node-header"
	>
		<div class="flex items-center gap-2 truncate">
			<span class="shrink-0" data-testid="node-icon"
				><Icon class="text-text-secondary h-3 w-3 opacity-50" /></span
			>
			<span
				class="text-text-primary truncate text-[length:var(--text-label)] font-bold tracking-tighter opacity-90 select-none"
			>
				{title}
			</span>
		</div>
		{#if onRemove}
			<button
				class="text-text-faint hover:text-danger ml-2 shrink-0 transition-colors"
				onclick={onRemove}
				aria-label="Remove {title}"
			>
				<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="2" y1="2" x2="10" y2="10" />
					<line x1="10" y1="2" x2="2" y2="10" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Content -->
	<div class="flex flex-col gap-2 px-3 py-3" data-testid="node-content">
		{@render children()}
	</div>

	<!-- Interlocking bottom tab -->
	{#if !isLast}
		<div
			class="pointer-events-none absolute -bottom-[6px] left-1/2 z-[5] -translate-x-1/2 drop-shadow-sm"
			data-testid="node-bottom-tab"
		>
			<svg width="12" height="7" viewBox="0 0 12 7" fill="none">
				<path d="M0 0 L6 7 L12 0 Z" fill="var(--card-bg)" />
				<path d="M0 0 L6 7 L12 0" stroke="var(--card-border)" stroke-width="1" />
			</svg>
		</div>
	{/if}
</div>
