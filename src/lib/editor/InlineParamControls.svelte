<!--
  InlineParamControls — Schema-driven parameter controls.

  Shared rendering logic extracted from ParamPanel. Used both in the Edit Pane
  (ParamPanel) and inline inside graph nodes (PipelineNode expanded view).

  Renders: Float→slider, Int→slider, Bool→toggle, Choice→dropdown,
  Curve→CurveEditor, Color→swatch, Point/Rect→readout, String→text input.
-->
<script lang="ts">
	import type { ParamValues, ParamValue, ParamSchema, ParamDescriptor } from './editor-bridge';
	import { unwrapFloat, unwrapInt, unwrapBool, unwrapCurve } from './editor-bridge';
	import CurveEditor from './CurveEditor.svelte';

	interface Props {
		schema: ParamSchema;
		localParams: ParamValues;
		onUpdateParam: (paramId: string, value: ParamValue) => void;
		/** If 'default', only show Float, Int, Bool params. If 'expanded', show all. */
		verbosity?: 'default' | 'expanded';
		/** Compact spacing for inline-in-node use. */
		compact?: boolean;
	}

	let {
		schema,
		localParams,
		onUpdateParam,
		verbosity = 'expanded',
		compact = false
	}: Props = $props();

	function formatFloat(value: number, step: number): string {
		if (step >= 100) return Math.round(value).toString();
		if (step >= 1) return value.toFixed(0);
		if (step >= 0.1) return value.toFixed(1);
		if (step >= 0.01) return value.toFixed(2);
		return value.toFixed(3);
	}

	function groupedParams(s: ParamSchema): {
		group: { id: string; label: string; collapsed: boolean } | null;
		params: ParamDescriptor[];
	}[] {
		const ungrouped = s.params.filter((p) => !p.group);
		const groups: {
			group: { id: string; label: string; collapsed: boolean } | null;
			params: ParamDescriptor[];
		}[] = [];

		if (ungrouped.length > 0) {
			groups.push({ group: null, params: ungrouped });
		}

		for (const g of s.groups) {
			const gParams = s.params.filter((p) => p.group === g.id);
			if (gParams.length > 0) {
				groups.push({ group: g, params: gParams });
			}
		}

		return groups;
	}

	function isDefaultParam(desc: ParamDescriptor): boolean {
		return 'Float' in desc.param_type || 'Int' in desc.param_type || 'Bool' in desc.param_type;
	}
</script>

<div class={compact ? 'space-y-1.5' : 'space-y-3'}>
	{#each groupedParams(schema) as section (section.group?.id ?? '_ungrouped')}
		{#if section.group && verbosity === 'expanded'}
			<div class={`border-border-strong border-t ${compact ? 'pt-1.5' : 'pt-3'}`}>
				<span class="text-text-muted text-xs font-medium">{section.group.label}</span>
			</div>
		{/if}
		{#each section.params as desc (desc.id)}
			{@const show = verbosity === 'expanded' || isDefaultParam(desc)}
			{#if show}
				{#if 'Float' in desc.param_type}
					{@const spec = desc.param_type.Float}
					{@const val = unwrapFloat(localParams[desc.id])}
					<label class="nodrag block">
						<span class="text-text-muted text-xs">{desc.label}: {formatFloat(val, spec.step)}</span>
						<input
							type="range"
							min={spec.min}
							max={spec.max}
							step={spec.step}
							value={val}
							oninput={(e) =>
								onUpdateParam(desc.id, {
									Float: +(e.target as HTMLInputElement).value
								})}
							class="mt-0.5 w-full"
						/>
					</label>
				{:else if 'Int' in desc.param_type}
					{@const spec = desc.param_type.Int}
					{@const val = unwrapInt(localParams[desc.id])}
					<label class="nodrag block">
						<span class="text-text-muted text-xs">{desc.label}: {val}</span>
						<input
							type="range"
							min={spec.min}
							max={spec.max}
							step="1"
							value={val}
							oninput={(e) =>
								onUpdateParam(desc.id, {
									Int: +(e.target as HTMLInputElement).value
								})}
							class="mt-0.5 w-full"
						/>
					</label>
				{:else if 'Bool' in desc.param_type}
					{@const val = unwrapBool(localParams[desc.id])}
					<label class="nodrag flex items-center gap-2">
						<input
							type="checkbox"
							checked={val}
							onchange={() => onUpdateParam(desc.id, { Bool: !val })}
							class="rounded"
						/>
						<span class="text-text-muted text-xs">{desc.label}</span>
					</label>
				{:else if 'Choice' in desc.param_type}
					{@const spec = desc.param_type.Choice}
					{@const val =
						localParams[desc.id] && 'Choice' in localParams[desc.id]
							? (localParams[desc.id] as { Choice: number }).Choice
							: spec.default}
					<label class="nodrag block">
						<span class="text-text-muted text-xs">{desc.label}</span>
						<select
							class="bg-surface-2 text-text-secondary mt-0.5 block w-full rounded px-2 py-1 text-xs"
							value={val}
							onchange={(e) =>
								onUpdateParam(desc.id, {
									Choice: +(e.target as HTMLSelectElement).value
								})}
						>
							{#each spec.options as opt (opt.value)}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</label>
				{:else if 'Curve' in desc.param_type}
					{@const pts = unwrapCurve(localParams[desc.id])}
					<div class="nodrag">
						<span class="text-text-muted text-xs">{desc.label}</span>
						<CurveEditor
							points={pts}
							channel={desc.id}
							onChange={(newPts) => onUpdateParam(desc.id, { Curve: newPts })}
						/>
					</div>
				{:else if 'Color' in desc.param_type}
					{@const v = localParams[desc.id]}
					{@const rgb =
						v && 'Color' in v ? (v as { Color: [number, number, number] }).Color : [0, 0, 0]}
					<div>
						<span class="text-text-muted text-xs">{desc.label}</span>
						<div
							class="border-border-strong mt-0.5 h-6 w-full rounded border"
							style="background: rgb({Math.round(rgb[0] * 255)}, {Math.round(
								rgb[1] * 255
							)}, {Math.round(rgb[2] * 255)})"
						></div>
					</div>
				{:else if 'Point' in desc.param_type}
					{@const v = localParams[desc.id]}
					{@const pt = v && 'Point' in v ? (v as { Point: [number, number] }).Point : [0, 0]}
					<div>
						<span class="text-text-muted text-xs">{desc.label}</span>
						<p class="text-text-muted text-xs">
							({pt[0].toFixed(2)}, {pt[1].toFixed(2)})
						</p>
					</div>
				{:else if 'Rect' in desc.param_type}
					{@const v = localParams[desc.id]}
					{@const rect =
						v && 'Rect' in v
							? (v as { Rect: [number, number, number, number] }).Rect
							: [0, 0, 0, 0]}
					<div>
						<span class="text-text-muted text-xs">{desc.label}</span>
						<p class="text-text-muted text-xs">
							x:{rect[0].toFixed(2)} y:{rect[1].toFixed(2)} w:{rect[2].toFixed(2)} h:{rect[3].toFixed(
								2
							)}
						</p>
					</div>
				{:else if 'String' in desc.param_type}
					{@const spec = desc.param_type.String as { default: string; placeholder?: string }}
					{@const val =
						localParams[desc.id] && 'String' in localParams[desc.id]
							? (localParams[desc.id] as { String: string }).String
							: (spec.default ?? '')}
					<label class="nodrag block">
						<span class="text-text-muted text-xs">{desc.label}</span>
						<input
							type="text"
							class="bg-surface-2 text-text-secondary focus:ring-accent mt-0.5 w-full rounded px-2 py-1 text-xs outline-none focus:ring-1"
							value={val}
							placeholder={spec.placeholder ?? ''}
							onchange={(e) =>
								onUpdateParam(desc.id, {
									String: (e.target as HTMLInputElement).value
								})}
						/>
					</label>
				{/if}
			{/if}
		{/each}
	{/each}
</div>
