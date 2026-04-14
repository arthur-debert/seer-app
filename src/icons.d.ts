declare module '~icons/*' {
	import type { Component } from 'svelte';
	const component: Component<{ class?: string }>;
	export default component;
}
