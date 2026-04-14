<!--
  Portal — teleports children to document.body to escape overflow/stacking contexts.
  Uses a Svelte action to move the container element after mount.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	function portal(node: HTMLElement) {
		if (typeof document === 'undefined') return;
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}
</script>

<div use:portal style="display: contents;">
	{@render children()}
</div>
