<script lang="ts">
	import { icons } from '$lib/icons';
	import { contrastColor, contrastBorder } from './utils';
	import IconButton from './IconButton.svelte';
	import Divider from './Divider.svelte';

	import Info from '~icons/material-symbols/info-outline';

	interface Props {
		canUndo: boolean;
		canRedo: boolean;
		infoOpen: boolean;
		historyVisible?: boolean;
		matColor?: string;
		onUndo: () => void;
		onRedo: () => void;
		onToggleInfo: () => void;
		onToggleHistory?: () => void;
	}

	let {
		canUndo,
		canRedo,
		infoOpen,
		historyVisible = false,
		matColor = '#0a0a0a',
		onUndo,
		onRedo,
		onToggleInfo,
		onToggleHistory
	}: Props = $props();

	const textClass = $derived(contrastColor(matColor));
	const borderStyle = $derived(contrastBorder(matColor));
</script>

<div
	class="flex items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur-xl transition-colors duration-300 {textClass}"
	style="background-color: {matColor}cc; border-color: {borderStyle}"
	data-testid="main-toolbar"
>
	<IconButton
		icon={icons.undo.component}
		label="Undo"
		disabled={!canUndo}
		size="sm"
		onClick={onUndo}
	/>
	<IconButton
		icon={icons.redo.component}
		label="Redo"
		disabled={!canRedo}
		size="sm"
		onClick={onRedo}
	/>
	<Divider direction="vertical" />
	<IconButton icon={Info} label="Image info" active={infoOpen} size="sm" onClick={onToggleInfo} />
	{#if onToggleHistory}
		<IconButton
			icon={icons.history.component}
			label="Toggle history panel"
			active={historyVisible}
			size="sm"
			onClick={onToggleHistory}
		/>
	{/if}
</div>
