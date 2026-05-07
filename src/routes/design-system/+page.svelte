<script lang="ts">
	import { resolve } from '$app/paths';

	const surfaces = [
		{ name: 'surface-0', desc: 'App background' },
		{ name: 'surface-1', desc: 'Panels, sidebars' },
		{ name: 'surface-2', desc: 'Cards, hover states' },
		{ name: 'surface-header', desc: 'Section headers' }
	];

	const texts = [
		{ name: 'text-primary', desc: 'Headings, values' },
		{ name: 'text-secondary', desc: 'Body text, labels' },
		{ name: 'text-muted', desc: 'Captions, hints' },
		{ name: 'text-faint', desc: 'Disabled, placeholder' }
	];

	const borders = [
		{ name: 'border', desc: 'Default border' },
		{ name: 'border-strong', desc: 'Emphasized border' }
	];

	const interactive = [
		{ name: 'accent', desc: 'Links, active states' },
		{ name: 'accent-muted', desc: 'Subtle highlights' },
		{ name: 'accent-strong', desc: 'Active buttons' }
	];

	const semantic = [
		{ name: 'danger', desc: 'Errors, destructive' },
		{ name: 'success', desc: 'Enabled, positive' },
		{ name: 'warning', desc: 'Warnings, caution' }
	];

	const glass = [
		{ name: 'glass-bg', desc: 'Glass panel background' },
		{ name: 'glass-border', desc: 'Glass panel border' }
	];

	const card = [
		{ name: 'card-bg', desc: 'Card background' },
		{ name: 'card-border', desc: 'Card border' }
	];

	const typeSizes = [
		{ css: 'var(--text-micro)', name: '--text-micro', size: '8px', usage: 'Hover labels, badges' },
		{
			css: 'var(--text-caption)',
			name: '--text-caption',
			size: '10px',
			usage: 'Slider labels, section titles'
		},
		{ css: 'var(--text-label)', name: '--text-label', size: '13px', usage: 'Node panel titles' },
		{ css: '0.75rem', name: 'text-xs', size: '12px', usage: 'General small text' },
		{ css: '0.875rem', name: 'text-sm', size: '14px', usage: 'Body text' },
		{ css: '1rem', name: 'text-base', size: '16px', usage: 'Default' }
	];
</script>

<main class="bg-surface-0 min-h-screen p-8">
	<div class="mx-auto max-w-4xl">
		<h1 class="text-text-primary text-2xl font-semibold">Design System</h1>
		<p class="text-text-muted mt-1 text-sm">
			Token reference for the Arami UI —
			<a href={resolve('/components')} class="text-accent hover:underline">Components</a>
		</p>

		<!-- Color Tokens -->
		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Colors</h2>

			{#each [{ title: 'Surfaces', items: surfaces }, { title: 'Text', items: texts }, { title: 'Borders', items: borders }, { title: 'Interactive', items: interactive }, { title: 'Semantic', items: semantic }, { title: 'Glass', items: glass }, { title: 'Card', items: card }] as group (group.title)}
				<div class="mt-6">
					<h3 class="text-text-secondary mb-2 text-sm font-semibold">{group.title}</h3>
					<div class="grid grid-cols-4 gap-3">
						{#each group.items as item (item.name)}
							<div class="border-border flex items-center gap-3 rounded-lg border p-3">
								<div
									class="border-border h-8 w-8 shrink-0 rounded border"
									style="background-color: var(--{item.name
										.replace('surface-', 'surface-')
										.replace('text-', 'text-')
										.replace('border', 'border-color')})"
									class:bg-surface-0={item.name === 'surface-0'}
									class:bg-surface-1={item.name === 'surface-1'}
									class:bg-surface-2={item.name === 'surface-2'}
									class:bg-surface-header={item.name === 'surface-header'}
									class:bg-text-primary={item.name === 'text-primary'}
									class:bg-text-secondary={item.name === 'text-secondary'}
									class:bg-text-muted={item.name === 'text-muted'}
									class:bg-text-faint={item.name === 'text-faint'}
									class:bg-border={item.name === 'border'}
									class:bg-border-strong={item.name === 'border-strong'}
									class:bg-accent={item.name === 'accent'}
									class:bg-accent-muted={item.name === 'accent-muted'}
									class:bg-accent-strong={item.name === 'accent-strong'}
									class:bg-danger={item.name === 'danger'}
									class:bg-success={item.name === 'success'}
									class:bg-warning={item.name === 'warning'}
									class:bg-glass-bg={item.name === 'glass-bg'}
									class:bg-glass-border={item.name === 'glass-border'}
									class:bg-card-bg={item.name === 'card-bg'}
									class:bg-card-border={item.name === 'card-border'}
								></div>
								<div>
									<p class="text-text-primary text-xs font-medium">{item.name}</p>
									<p class="text-text-muted text-[length:var(--text-caption)]">{item.desc}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</section>

		<!-- Typography -->
		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Typography</h2>
			<div class="space-y-3">
				{#each typeSizes as ts (ts.name)}
					<div class="border-border flex items-baseline gap-4 rounded-lg border p-3">
						<span class="text-text-primary w-32 shrink-0 font-bold" style="font-size: {ts.css}">
							Sample Text
						</span>
						<span class="text-text-secondary text-xs font-medium">{ts.name}</span>
						<span class="text-text-muted text-[length:var(--text-caption)]">{ts.size}</span>
						<span class="text-text-faint text-[length:var(--text-caption)]">{ts.usage}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Spacing -->
		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Spacing</h2>
			<p class="text-text-muted text-sm">
				Standard Tailwind spacing scale. Key values used in the design system:
			</p>
			<div class="mt-4 grid grid-cols-6 gap-3">
				{#each [{ tw: 'gap-0.5', px: '2px' }, { tw: 'gap-1', px: '4px' }, { tw: 'gap-1.5', px: '6px' }, { tw: 'gap-2', px: '8px' }, { tw: 'gap-3', px: '12px' }, { tw: 'gap-4', px: '16px' }] as sp (sp.tw)}
					<div class="border-border flex flex-col items-center gap-1 rounded-lg border p-3">
						<div class="bg-accent h-4 rounded" style="width: {sp.px}"></div>
						<span class="text-text-secondary text-[length:var(--text-caption)]">{sp.tw}</span>
						<span class="text-text-faint text-[length:var(--text-caption)]">{sp.px}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Effects -->
		<section class="mt-10 mb-16">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Effects</h2>
			<div class="grid grid-cols-3 gap-4">
				<div
					class="border-glass-border bg-glass-bg rounded-xl border p-4 shadow-lg backdrop-blur-xl"
				>
					<p class="text-text-primary text-sm font-medium">Glass panel</p>
					<p class="text-text-muted text-[length:var(--text-caption)]">
						bg-glass-bg + backdrop-blur-xl
					</p>
				</div>
				<div class="border-card-border bg-card-bg rounded-xl border p-4 shadow-md">
					<p class="text-text-primary text-sm font-medium">Card</p>
					<p class="text-text-muted text-[length:var(--text-caption)]">bg-card-bg + shadow-md</p>
				</div>
				<div class="border-border bg-surface-1 rounded-xl border p-4 shadow-sm">
					<p class="text-text-primary text-sm font-medium">Surface panel</p>
					<p class="text-text-muted text-[length:var(--text-caption)]">bg-surface-1 + shadow-sm</p>
				</div>
			</div>
		</section>
	</div>
</main>
