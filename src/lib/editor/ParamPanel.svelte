<!--
  ParamPanel — Schema-driven parameter panel for the Edit Pane.

  Wraps InlineParamControls with adjustment state management, crop special
  case, and the "no selection" placeholder.
-->
<script lang="ts">
	import type {
		AdjustmentInfo,
		GeometryInfo,
		ParamValues,
		ParamValue,
		ParamSchema,
		CropParams
	} from './editor-bridge';
	import { unwrapFloat, unwrapBool } from './editor-bridge';
	import InlineParamControls from './InlineParamControls.svelte';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		adjustment: AdjustmentInfo | GeometryInfo | null;
		schema: ParamSchema | null;
		onParamChange: (id: string, params: ParamValues) => void;
		onCropRatioChange?: (rw: number, rh: number, uiOverrides?: Partial<CropParams>) => void;
	}

	let { adjustment, schema, onParamChange, onCropRatioChange }: Props = $props();

	// --- Crop ratio presets ---

	const CROP_RATIOS: { label: string; w: number; h: number }[] = [
		{ label: '1:1', w: 1, h: 1 },
		{ label: '4:3', w: 4, h: 3 },
		{ label: '3:2', w: 3, h: 2 },
		{ label: '16:9', w: 16, h: 9 },
		{ label: '5:4', w: 5, h: 4 },
		{ label: '7:5', w: 7, h: 5 }
	];

	// --- Local parameter state ---

	let localParams: ParamValues = $state({});

	$effect(() => {
		if (adjustment?.params) {
			localParams = { ...adjustment.params };
		} else {
			localParams = {};
		}
	});

	function updateParam(paramId: string, value: ParamValue): void {
		if (!adjustment) return;
		localParams = { ...localParams, [paramId]: value };
		onParamChange(adjustment.id, $state.snapshot(localParams) as ParamValues);
	}

	function sendAllParams(): void {
		if (!adjustment) return;
		onParamChange(adjustment.id, localParams);
	}

	// --- Crop helpers ---

	function getCropParams(): CropParams | null {
		if (adjustment?.plugin_id !== 'arami.crop') return null;
		const p = localParams;
		return {
			x: unwrapFloat(p.x),
			y: unwrapFloat(p.y),
			width: unwrapFloat(p.width),
			height: unwrapFloat(p.height),
			ratio_w: unwrapFloat(p.ratio_w),
			ratio_h: unwrapFloat(p.ratio_h),
			landscape: unwrapBool(p.landscape),
			show_thirds: unwrapBool(p.show_thirds)
		};
	}

	function updateCropFromPreset(ratioIndex: number): void {
		const cp = getCropParams();
		if (!cp) return;
		const r = CROP_RATIOS[ratioIndex];
		const rw = cp.landscape ? r.w : r.h;
		const rh = cp.landscape ? r.h : r.w;
		localParams = {
			...localParams,
			ratio_w: { Float: r.w },
			ratio_h: { Float: r.h }
		};
		sendAllParams();
		onCropRatioChange?.(rw, rh, { ...cp, ratio_w: r.w, ratio_h: r.h });
	}

	function toggleCropOrientation(): void {
		const cp = getCropParams();
		if (!cp) return;
		const newLandscape = !cp.landscape;
		const ratioIndex = CROP_RATIOS.findIndex((r) => r.w === cp.ratio_w && r.h === cp.ratio_h);
		const r = CROP_RATIOS[ratioIndex >= 0 ? ratioIndex : 1];
		const rw = newLandscape ? r.w : r.h;
		const rh = newLandscape ? r.h : r.w;
		localParams = { ...localParams, landscape: { Bool: newLandscape } };
		sendAllParams();
		onCropRatioChange?.(rw, rh, { ...cp, landscape: newLandscape });
	}

	function cropRatioSelectAction(node: HTMLSelectElement) {
		function handler() {
			updateCropFromPreset(node.selectedIndex);
		}
		node.addEventListener('change', handler);
		return {
			destroy() {
				node.removeEventListener('change', handler);
			}
		};
	}
</script>

<Panel title="Parameters">
	{#if adjustment}
		<div class="text-text-muted text-sm">
			<p class="text-text-secondary font-medium">{adjustment.name}</p>

			{#if adjustment.plugin_id === 'arami.crop'}
				{@const cp = getCropParams()}
				{#if cp}
					{@const currentRatioIndex = CROP_RATIOS.findIndex(
						(r) => r.w === cp.ratio_w && r.h === cp.ratio_h
					)}
					<div class="mt-3 space-y-3">
						<label class="block">
							<span class="text-text-muted text-xs">Ratio</span>
							<select
								data-testid="crop-ratio-select"
								class="bg-surface-2 text-text-secondary mt-1 block w-full rounded px-2 py-1 text-xs"
								value={currentRatioIndex >= 0 ? currentRatioIndex : 1}
								use:cropRatioSelectAction
							>
								{#each CROP_RATIOS as ratio, i (ratio.label)}
									<option value={i}>{ratio.label}</option>
								{/each}
							</select>
						</label>

						<button
							class="bg-surface-2 text-text-secondary hover:bg-selected w-full rounded px-3 py-1.5 text-xs"
							onclick={toggleCropOrientation}
						>
							{cp.landscape ? 'Landscape' : 'Portrait'}
						</button>

						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={cp.show_thirds}
								onchange={() => updateParam('show_thirds', { Bool: !cp.show_thirds })}
								class="rounded"
							/>
							<span class="text-text-muted text-xs">Thirds</span>
						</label>

						<div class="border-border-strong border-t pt-2">
							<span class="text-text-muted text-xs">Crop position</span>
							<div class="text-text-muted mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
								<span>X: {cp.x.toFixed(2)}</span>
								<span>Y: {cp.y.toFixed(2)}</span>
								<span>W: {cp.width.toFixed(2)}</span>
								<span>H: {cp.height.toFixed(2)}</span>
							</div>
						</div>
					</div>
				{/if}
			{:else if schema}
				<div class="mt-3">
					<InlineParamControls
						{schema}
						{localParams}
						onUpdateParam={updateParam}
						verbosity="expanded"
					/>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-text-muted text-xs">Select an adjustment to view its parameters.</p>
	{/if}
</Panel>
