<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Which side the collapse arrow points toward. */
		side: 'left' | 'right';
		collapsed: boolean;
		onCollapse: () => void;
		onExpand: () => void;
		/** Current width in pixels (controlled by parent). */
		width: number;
		/** Callback when the resize handle is dragged. */
		onResizeStart: (e: PointerEvent) => void;
		children: Snippet;
		/** Optional binding target for clientHeight. */
		bindHeight?: (h: number) => void;
	}

	let {
		title,
		side,
		collapsed,
		onCollapse,
		onExpand,
		width,
		onResizeStart,
		children,
		bindHeight
	}: Props = $props();

	let contentHeight: number = $state(0);

	$effect(() => {
		if (bindHeight) bindHeight(contentHeight);
	});

	const borderSide = $derived(side === 'left' ? 'border-r' : 'border-l');
	const handlePosition = $derived(side === 'left' ? '-right-[5px]' : '-left-[5px]');
	const arrowPath = $derived(side === 'left' ? 'M6 3l-5 5 5 5' : 'M10 3l5 5-5 5');
</script>

{#if collapsed}
	<button
		class="flex w-8 shrink-0 items-center justify-center {borderSide} border-border bg-surface-0 text-text-muted hover:bg-surface-1 hover:text-text-secondary"
		onclick={onExpand}
	>
		<span class="text-xs tracking-widest [writing-mode:vertical-lr]">{title}</span>
	</button>
{:else}
	<div class="relative flex shrink-0 flex-col {borderSide} border-border" style:width="{width}px">
		<div
			class="border-border bg-surface-header flex items-center justify-between border-b px-3 py-1.5"
		>
			<span class="text-text-muted text-xs tracking-widest">{title}</span>
			<button
				class="text-text-muted hover:text-text-secondary"
				aria-label="Collapse {title.toLowerCase()} panel"
				onclick={onCollapse}
			>
				<svg
					class="h-4 w-4"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path d={arrowPath} />
				</svg>
			</button>
		</div>
		<div class="flex min-h-0 flex-1 flex-col" bind:clientHeight={contentHeight}>
			{@render children()}
		</div>
		<!-- Resize handle -->
		<div
			class="absolute top-0 {handlePosition} bottom-0 w-[10px] cursor-col-resize"
			role="separator"
			aria-orientation="vertical"
			onpointerdown={onResizeStart}
		></div>
	</div>
{/if}
