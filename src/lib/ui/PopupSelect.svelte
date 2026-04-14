<script lang="ts">
	import { tick } from 'svelte';
	import { scale } from 'svelte/transition';
	import Portal from './Portal.svelte';

	interface Props {
		label: string;
		value: string;
		options: { value: string; label: string }[];
		onChange: (value: string) => void;
	}

	let { label, value, options, onChange }: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let dropdownEl: HTMLDivElement | undefined = $state();
	let popupTop = $state(0);
	let popupLeft = $state(0);
	let focusedIndex = $state(-1);

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? value);

	async function openPopup() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		popupTop = rect.bottom + 4;
		popupLeft = rect.left - 4;
		focusedIndex = options.findIndex((o) => o.value === value);
		open = true;
		await tick();
		dropdownEl?.focus();
	}

	function close() {
		open = false;
		triggerEl?.focus();
	}

	function select(v: string) {
		onChange(v);
		close();
	}

	function onDropdownKeydown(e: KeyboardEvent) {
		if (options.length === 0) return;
		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'ArrowDown':
				e.preventDefault();
				focusedIndex = (focusedIndex + 1) % options.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusedIndex = (focusedIndex - 1 + options.length) % options.length;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (focusedIndex >= 0 && focusedIndex < options.length) {
					select(options[focusedIndex].value);
				}
				break;
		}
	}
</script>

<div class="flex w-full items-center justify-between gap-2" data-testid="popup-select">
	<span
		class="text-text-secondary text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight opacity-60 select-none"
	>
		{label}
	</span>
	<button
		bind:this={triggerEl}
		class="border-border bg-surface-0/50 hover:bg-surface-2 flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors"
		onclick={openPopup}
		aria-haspopup="listbox"
		aria-expanded={open}
		data-testid="popup-select-trigger"
	>
		<span class="text-text-primary text-[length:var(--text-micro)] font-bold tracking-tight">
			{selectedLabel}
		</span>
		<svg class="text-text-primary h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>
</div>

{#if open}
	<Portal>
		<div
			class="fixed inset-0 z-50"
			onclick={close}
			onwheel={close}
			role="presentation"
			data-testid="popup-select-backdrop"
		></div>
		<div
			bind:this={dropdownEl}
			class="bg-card-bg/95 border-card-border fixed z-50 w-24 rounded-lg border shadow-xl backdrop-blur-2xl"
			style="top: {popupTop}px; left: {popupLeft}px;"
			transition:scale={{ duration: 150, start: 0.9 }}
			role="listbox"
			tabindex="-1"
			aria-label={label}
			onkeydown={onDropdownKeydown}
			data-testid="popup-select-dropdown"
		>
			{#each options as option, i (option.value)}
				<button
					class="w-full px-3 py-1.5 text-left text-[length:var(--text-micro)] font-bold tracking-tight transition-colors first:rounded-t-lg last:rounded-b-lg {option.value ===
					value
						? 'bg-text-primary text-surface-0'
						: i === focusedIndex
							? 'bg-surface-2 text-text-primary'
							: 'text-text-secondary hover:bg-surface-2'}"
					onclick={() => select(option.value)}
					role="option"
					aria-selected={option.value === value}
					data-testid="popup-select-option"
					data-selected={option.value === value}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</Portal>
{/if}
