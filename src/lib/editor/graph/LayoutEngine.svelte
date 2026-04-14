<!--
  LayoutEngine — measures rendered node heights and recomputes Y positions.

  Rendered inside <SvelteFlow> to access useSvelteFlow() context.
  Exposes a relayout() function called imperatively from the parent.
-->
<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { onMount } from 'svelte';
	import { NODE_GAP, PHASE_GAP } from './graph-layout';

	const { getNodes, getInternalNode, updateNode, fitView } = useSvelteFlow();

	function relayout(): void {
		const nodes = getNodes();
		if (nodes.length === 0) return;

		// Collect measured heights (local, not reactive — plain Map is correct)
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const heights = new Map<string, number>();
		for (const n of nodes) {
			const internal = getInternalNode(n.id);
			const h = (internal as { measured?: { height?: number } })?.measured?.height;
			if (h && h > 0) heights.set(n.id, h);
		}
		if (heights.size === 0) return;

		// Walk nodes in current order, compute correct Y from accumulated heights
		let y = 0;
		for (const n of nodes) {
			const measuredH = heights.get(n.id) ?? n.height ?? 44;
			const gap = n.type === 'junction' ? PHASE_GAP : NODE_GAP;

			if (Math.abs(n.position.y - y) > 1) {
				updateNode(n.id, { position: { x: n.position.x, y } });
			}

			y += measuredH + gap;
		}

		// Re-fit view after repositioning so all nodes are visible
		requestAnimationFrame(() => fitView({ padding: 0.1 }));
	}

	// Schedule a relayout after initial render
	onMount(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => relayout());
		});
	});

	// Listen for 'relayout' custom events from the parent
	function handleRelayoutEvent(node: HTMLElement): { destroy: () => void } {
		function handler() {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => relayout());
			});
		}
		node.addEventListener('relayout', handler);
		return {
			destroy() {
				node.removeEventListener('relayout', handler);
			}
		};
	}
</script>

<div class="hidden" data-layout-engine use:handleRelayoutEvent></div>
