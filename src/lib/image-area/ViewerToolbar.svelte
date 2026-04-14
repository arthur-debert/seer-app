<script lang="ts">
	import { icons } from '$lib/icons';

	const UndoIcon = icons.undo.component;
	const RedoIcon = icons.redo.component;
	const HistoryIcon = icons.history.component;

	interface Props {
		canUndo: boolean;
		canRedo: boolean;
		historyVisible: boolean;
		onUndo: () => void;
		onRedo: () => void;
		onToggleHistory: () => void;
	}

	let { canUndo, canRedo, historyVisible, onUndo, onRedo, onToggleHistory }: Props = $props();
</script>

<div class="viewer-toolbar">
	<div class="toolbar-group">
		<button class="toolbar-btn" disabled={!canUndo} onclick={onUndo} title="Undo (Cmd+Z)">
			<UndoIcon class="h-4 w-4" />
		</button>
		<button class="toolbar-btn" disabled={!canRedo} onclick={onRedo} title="Redo (Cmd+Shift+Z)">
			<RedoIcon class="h-4 w-4" />
		</button>
	</div>
	<div class="toolbar-right">
		<button
			class="toolbar-btn"
			class:active={historyVisible}
			onclick={onToggleHistory}
			title="Toggle history panel"
		>
			<HistoryIcon class="h-4 w-4" />
		</button>
	</div>
</div>

<style>
	.viewer-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 8px;
		background: var(--surface-1);
		border-bottom: 1px solid var(--border-color);
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text-primary);
	}

	.toolbar-btn:disabled {
		color: var(--text-muted);
		opacity: 0.4;
		cursor: default;
	}

	.toolbar-btn.active {
		color: var(--text-primary);
		background: var(--accent-strong);
	}
</style>
