<script lang="ts">
	import { resolve } from '$app/paths';
	import PipelineItem from '$lib/editor/PipelineItem.svelte';
	import Slider from '$lib/ui/Slider.svelte';
	import Toggle from '$lib/ui/Toggle.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Divider from '$lib/ui/Divider.svelte';
	import ColorSwatch from '$lib/ui/ColorSwatch.svelte';
	import NodePanel from '$lib/ui/NodePanel.svelte';
	import MainToolbar from '$lib/ui/MainToolbar.svelte';
	import ViewSettingsToolbar from '$lib/ui/ViewSettingsToolbar.svelte';
	import MetadataPanel from '$lib/ui/MetadataPanel.svelte';
	import { icons } from '$lib/icons';
	import type { AdjustmentInfo } from '$lib/editor/editor-bridge';

	/* eslint-disable @typescript-eslint/no-unused-vars */
	const noop = () => {};
	const noopBool = (_b: boolean) => {};
	/* eslint-enable @typescript-eslint/no-unused-vars */

	function makeAdj(
		overrides: Partial<AdjustmentInfo> & { id: string; name: string }
	): AdjustmentInfo {
		return {
			plugin_id: 'arami.tone-curve',
			enabled: true,
			params: {},
			zone: 'Full',
			...overrides
		};
	}

	// --- PipelineItem scenarios ---
	const scenarios: {
		label: string;
		description: string;
		props: {
			adjustment: AdjustmentInfo;
			index: number;
			isSelected: boolean;
			isSource: boolean;
			isDimmed: boolean;
			hasError: boolean;
			errorMessage: string | null;
			zoneIcons: { components: import('svelte').Component[]; count: number } | null;
		};
	}[] = [
		{
			label: 'Source node',
			description: 'Index 0, not draggable, Full zone (globe)',
			props: {
				adjustment: makeAdj({ id: 'src', name: 'White Balance', plugin_id: 'arami.white-balance' }),
				index: 0,
				isSelected: false,
				isSource: false,
				isDimmed: false,
				hasError: false,
				errorMessage: null,
				zoneIcons: null
			}
		},
		{
			label: 'Enabled, Full zone',
			description: 'Normal adjustment with globe icon (no zone)',
			props: {
				adjustment: makeAdj({ id: 'tc1', name: 'Tone Curve', plugin_id: 'arami.tone-curve' }),
				index: 1,
				isSelected: false,
				isSource: false,
				isDimmed: false,
				hasError: false,
				errorMessage: null,
				zoneIcons: null
			}
		},
		{
			label: 'Selected',
			description: 'Highlighted row background',
			props: {
				adjustment: makeAdj({ id: 'sh1', name: 'Sharpen', plugin_id: 'arami.sharpen' }),
				index: 5,
				isSelected: true,
				isSource: false,
				isDimmed: false,
				hasError: false,
				errorMessage: null,
				zoneIcons: { components: [icons.zoneBrush.component], count: 1 }
			}
		},
		{
			label: 'Disabled',
			description: 'Reduced opacity, empty circle toggle',
			props: {
				adjustment: makeAdj({
					id: 'dn1',
					name: 'Denoise',
					plugin_id: 'arami.denoise',
					enabled: false
				}),
				index: 4,
				isSelected: false,
				isSource: false,
				isDimmed: false,
				hasError: false,
				errorMessage: null,
				zoneIcons: null
			}
		},
		{
			label: 'Error',
			description: 'Red dot before toggle',
			props: {
				adjustment: makeAdj({ id: 'cl1', name: 'Clarity', plugin_id: 'arami.clarity' }),
				index: 6,
				isSelected: false,
				isSource: false,
				isDimmed: false,
				hasError: true,
				errorMessage: 'Parameter out of range',
				zoneIcons: null
			}
		}
	];

	// --- Interactive state for demos ---
	let sliderValue = $state(42);
	let toggleActive = $state(false);
	let selectedColor = $state('#000000');
	let infoOpen = $state(false);
	let metadataVisible = $state(false);
	let matColor = $state('#000000');
	let matSize = $state(15);
	let borderWidth = $state(2);
	let borderColor = $state('#ffffff');
</script>

<main class="bg-surface-0 relative min-h-screen p-8">
	<div class="mx-auto max-w-3xl">
		<h1 class="text-text-primary text-2xl font-semibold">Components</h1>
		<p class="text-text-muted mt-1 text-sm">
			Design system components —
			<a href={resolve('/icons')} class="text-accent hover:underline">Icons</a> |
			<a href={resolve('/design-system')} class="text-accent hover:underline">Design System</a> |
			<a href={resolve('/radial-menu')} class="text-accent hover:underline">RadialMenu</a>
		</p>

		<!-- ===== ATOMIC COMPONENTS ===== -->

		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Slider</h2>
			<div class="border-border bg-surface-1 w-64 rounded-lg border p-4">
				<Slider
					label="Exposure"
					value={sliderValue}
					min={0}
					max={100}
					onChange={(v) => {
						sliderValue = v;
					}}
				/>
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Toggle</h2>
			<div class="border-border bg-surface-1 w-48 rounded-lg border p-4">
				<Toggle
					label="Landscape"
					active={toggleActive}
					onToggle={(v) => {
						toggleActive = v;
					}}
				/>
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-text-primary mb-4 text-lg font-medium">IconButton</h2>
			<div class="border-border bg-surface-1 flex items-center gap-2 rounded-lg border p-4">
				<IconButton icon={icons.undo.component} label="Undo" onClick={noop} />
				<IconButton icon={icons.redo.component} label="Redo" disabled={true} onClick={noop} />
				<IconButton icon={icons.history.component} label="History" active={true} onClick={noop} />
				<IconButton icon={icons.add.component} size="sm" onClick={noop} />
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-text-primary mb-4 text-lg font-medium">Divider</h2>
			<div class="border-border bg-surface-1 flex items-center gap-4 rounded-lg border p-4">
				<span class="text-text-secondary text-sm">Left</span>
				<Divider direction="vertical" />
				<span class="text-text-secondary text-sm">Right</span>
			</div>
			<div class="border-border bg-surface-1 mt-2 w-48 rounded-lg border p-4">
				<span class="text-text-secondary text-sm">Above</span>
				<div class="py-2"><Divider /></div>
				<span class="text-text-secondary text-sm">Below</span>
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-text-primary mb-4 text-lg font-medium">ColorSwatch</h2>
			<div class="border-border bg-surface-1 flex items-center gap-2 rounded-lg border p-4">
				{#each ['#000000', '#ffffff', '#808080', '#ef4444', '#3b82f6'] as color (color)}
					<ColorSwatch
						{color}
						selected={selectedColor === color}
						onClick={() => {
							selectedColor = color;
						}}
					/>
				{/each}
			</div>
		</section>

		<!-- ===== COMPOSITE COMPONENTS ===== -->

		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">NodePanel (stacked)</h2>
			<div class="w-64">
				<NodePanel
					title="White Balance"
					icon={icons.whiteBalance.component}
					index={0}
					isLast={false}
					onRemove={noop}
				>
					<Slider label="Temperature" value={65} />
					<div class="mt-1"><Slider label="Tint" value={30} /></div>
				</NodePanel>
				<NodePanel
					title="Tone Curve"
					icon={icons.toneCurve.component}
					index={1}
					isLast={false}
					onRemove={noop}
				>
					<span class="text-text-faint text-[length:var(--text-caption)]">Curve editor here</span>
				</NodePanel>
				<NodePanel
					title="Sharpen"
					icon={icons.sharpen.component}
					index={2}
					isLast={true}
					onRemove={noop}
				>
					<Slider label="Amount" value={50} />
				</NodePanel>
			</div>
		</section>

		<!-- ===== TOOLBAR ASSEMBLIES ===== -->

		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">MainToolbar</h2>
			<div class="flex gap-4">
				<MainToolbar
					canUndo={true}
					canRedo={false}
					{infoOpen}
					matColor="#000000"
					onUndo={noop}
					onRedo={noop}
					onToggleInfo={() => {
						infoOpen = !infoOpen;
					}}
				/>
				<MainToolbar
					canUndo={true}
					canRedo={true}
					infoOpen={false}
					matColor="#ffffff"
					onUndo={noop}
					onRedo={noop}
					onToggleInfo={noop}
				/>
			</div>
		</section>

		<section class="mt-8">
			<h2 class="text-text-primary mb-4 text-lg font-medium">ViewSettingsToolbar</h2>
			<ViewSettingsToolbar
				{matColor}
				{matSize}
				{borderWidth}
				{borderColor}
				onMatColorChange={(c) => {
					matColor = c;
				}}
				onMatSizeChange={(s) => {
					matSize = s;
				}}
				onBorderWidthChange={(w) => {
					borderWidth = w;
				}}
				onBorderColorChange={(c) => {
					borderColor = c;
				}}
			/>
		</section>

		<section class="mt-8">
			<h2 class="text-text-primary mb-4 text-lg font-medium">MetadataPanel</h2>
			<button
				class="border-border text-text-secondary hover:bg-surface-1 rounded border px-3 py-1 text-sm"
				onclick={() => {
					metadataVisible = !metadataVisible;
				}}
			>
				Toggle MetadataPanel
			</button>
		</section>

		<!-- ===== PIPELINE ITEM ===== -->

		<section class="mt-10">
			<h2 class="text-text-primary mb-4 text-lg font-medium">PipelineItem</h2>
			<p class="text-text-muted mb-6 text-sm">
				Icon-only pipeline row. Layout: drag handle | icon box | arrow | zone target(s) | spacer |
				error? | toggle | delete (hover).
			</p>

			<div class="space-y-4">
				{#each scenarios as scenario (scenario.label)}
					<div class="border-border rounded-lg border p-4">
						<div class="mb-2 flex items-baseline gap-2">
							<span class="text-text-secondary text-xs font-semibold">{scenario.label}</span>
							<span class="text-text-faint text-[10px]">{scenario.description}</span>
						</div>
						<div class="bg-surface-1 rounded px-1 py-1">
							<PipelineItem
								{...scenario.props}
								onSelect={noop}
								onToggle={noopBool}
								onRemove={noop}
							/>
						</div>
					</div>
				{/each}
			</div>
		</section>
	</div>

	<!-- MetadataPanel (positioned at bottom) -->
	<MetadataPanel
		visible={metadataVisible}
		metadata={{
			filename: 'example-image.avif',
			dateAdded: 'March 24, 2026',
			dateModified: 'March 30, 2026',
			title: 'Example Image',
			caption: 'A sample image for demonstrating the metadata panel layout.',
			location: 'San Francisco, CA',
			camera: 'Leica M11',
			lens: 'Summilux-M 35mm f/1.4',
			aperture: 'f/1.4',
			shutter: '1/4000s',
			iso: '64',
			ev: '0.0'
		}}
	/>
</main>
