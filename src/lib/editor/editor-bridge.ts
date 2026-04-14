/**
 * Editor WASM bridge -- thin wrapper over seer_editor_wasm::EditGraph.
 *
 * All edit logic lives in Rust; this module handles WASM init and type forwarding.
 */

import wasmInit, { EditGraph } from '$editor_wasm/seer_editor_wasm.js';
import wasmUrl from '$editor_wasm/seer_editor_wasm_bg.wasm?url';

export { EditGraph };

// Augment EditGraph -- svelte-check cannot resolve .d.ts from wasm pkg,
// so all non-constructor methods used in .svelte files must be declared here.
declare module '$editor_wasm/seer_editor_wasm.js' {
	interface EditGraph {
		pipeline(): AdjustmentInfo[];
		geometry_pipeline(): GeometryInfo[];
		source_info(): SourceInfo;
		phases(): PhaseInfo[];
		boundaries(): PhaseBoundary[];
		zone_list(): ZoneInfo[];
		add_adjustment(plugin_id: string, timestamp_ms: number): string;
		remove_adjustment(id: string, timestamp_ms: number): void;
		set_enabled(id: string, enabled: boolean, timestamp_ms: number): void;
		update_adjustment_params(id: string, params: unknown, timestamp_ms: number): void;
		add_geometry_node(plugin_id: string, timestamp_ms: number): string;
		remove_geometry_node(id: string, timestamp_ms: number): void;
		set_geometry_enabled(id: string, enabled: boolean, timestamp_ms: number): void;
		update_geometry_params(id: string, params: unknown, timestamp_ms: number): void;
		reorder_geometry(id: string, new_index: number, timestamp_ms: number): void;
		replace_source(image_bytes: Uint8Array, path: string, timestamp_ms: number): void;
		replace_source_rgb_f32(
			data: Float32Array,
			width: number,
			height: number,
			path: string,
			timestamp_ms: number
		): void;
		add_adaptive_bw(timestamp_ms: number): string[];
		reorder_adjustment(id: string, new_index: number, timestamp_ms: number): void;
		set_adjustment_zone(adjustment_id: string, zone_source: unknown, timestamp_ms: number): void;
		add_composition(name: string, source_js: unknown, timestamp_ms: number): string;
		update_composition(id: string, source_js: unknown): void;
		rename_composition(id: string, name: string, timestamp_ms: number): void;
		add_zone(plugin_id: string, timestamp_ms: number): string;
		remove_zone(id: string, timestamp_ms: number): void;
		zone_dependents(id: string): ZoneDependentsInfo;
		update_zone_params(id: string, params: unknown): void;
		available_adjustments(): PluginInfo[];
		available_geometry(): GeometryPluginInfo[];
		available_zone_generators(): ZonePluginInfo[];
		describe(plugin_id: string): ParamSchema;
		history_begin_group(label: string, timestamp_ms: number): void;
		history_end_group(): void;
		history_attach_log(
			level: string,
			component: string,
			message: string,
			timestamp_ms: number
		): void;
		undo(): boolean;
		redo(): boolean;
		jump_to(node_id: string): boolean;
		tag(name: string): void;
		untag(name: string): boolean;
		tags(): unknown;
		version_history(): VersionNode[];
		can_undo(): boolean;
		can_redo(): boolean;
		head_node_id(): string;
		version_node_count(): number;
	}
}

// --- Version types -------------------------------------------------------
//
// Read-only mirrors of seer_editor version_tree types. The canonical definitions
// and all recording/coalescing logic live in Rust.
// See: src-tauri/seer-editor/src/versioning/version_tree.rs

export interface VersionNode {
	id: string;
	label: string;
	timestamp_ms: number;
	steps: VersionStep[];
}

export interface VersionStep {
	label: string;
	mutation: HistoryMutation;
	timestamp_ms: number;
	log_count: number;
}

export interface TagEntry {
	name: string;
	nodeId: string;
}

export type HistoryMutation =
	| { AddGeometryNode: { node_id: string; kind: string; index: number } }
	| { RemoveGeometryNode: { node_id: string; kind: string; index: number } }
	| { ReorderGeometryNode: { node_id: string; from_index: number; to_index: number } }
	| { ToggleGeometryNode: { node_id: string; enabled: boolean; was_enabled: boolean } }
	| {
			UpdateGeometryParams: {
				node_id: string;
				node_name: string;
				before: unknown;
				after: unknown;
			};
	  }
	| { AddAdjustment: { adjustment_id: string; kind: string; index: number } }
	| { RemoveAdjustment: { adjustment_id: string; kind: string; index: number } }
	| { ReorderAdjustment: { adjustment_id: string; from_index: number; to_index: number } }
	| { ToggleAdjustment: { adjustment_id: string; enabled: boolean; was_enabled: boolean } }
	| {
			UpdateParams: {
				adjustment_id: string;
				adjustment_name: string;
				before: unknown;
				after: unknown;
			};
	  }
	| { SetSource: { path_before: string; path_after: string } }
	| { SetZone: { adjustment_id: string; before: unknown; after: unknown } }
	| { AddZone: { zone_id: string; kind: string } }
	| { RemoveZone: { zone_id: string; kind: string } }
	| { AddComposition: { zone_id: string; name: string } }
	| { RemoveComposition: { zone_id: string; name: string } }
	| { RenameComposition: { zone_id: string; name_before: string; name_after: string } };

export interface LogEntry {
	timestamp_ms: number;
	level: 'Debug' | 'Info' | 'Warn' | 'Error';
	component: string;
	message: string;
	data?: unknown;
}

// --- Plugin types --------------------------------------------------------

/** Runtime parameter value from Rust. Externally-tagged serde enum. */
export type ParamValue =
	| { Float: number }
	| { Int: number }
	| { Bool: boolean }
	| { Choice: number }
	| { String: string }
	| { Color: [number, number, number] }
	| { Curve: ControlPoint[] }
	| { Point: [number, number] }
	| { Rect: [number, number, number, number] }
	| { Strokes: BrushStroke[] };

/** Flat parameter map (plugin_id-agnostic). */
export type ParamValues = Record<string, ParamValue>;

/** Plugin parameter schema descriptor. */
export interface ParamDescriptor {
	id: string;
	label: string;
	description: string;
	param_type: ParamType;
	group: string | null;
}

export interface ParamGroup {
	id: string;
	label: string;
	collapsed: boolean;
}

export interface ParamSchema {
	params: ParamDescriptor[];
	groups: ParamGroup[];
}

// ParamType is an externally-tagged enum from Rust (mirrors seer_editor::plugin::ParamType)
export type ParamType =
	| { Float: { min: number; max: number; default: number; step: number } }
	| { Int: { min: number; max: number; default: number } }
	| { Bool: { default: boolean } }
	| { Choice: { options: { value: number; label: string }[]; default: number } }
	| { Color: { default: [number, number, number] } }
	| { Curve: { default: ControlPoint[] } }
	| { Point: { default_x: number; default_y: number } }
	| { Rect: { default: [number, number, number, number] } }
	| { Strokes: Record<string, never> };

export interface PluginInfo {
	id: string;
	name: string;
	category: string;
}

export interface GeometryPluginInfo {
	id: string;
	name: string;
}

export interface ZonePluginInfo {
	id: string;
	name: string;
}

// --- ParamValue helpers --------------------------------------------------

/** Unwrap a Float ParamValue. Returns 0 if not a Float. */
export function unwrapFloat(v: ParamValue | undefined): number {
	if (v && typeof v === 'object' && 'Float' in v) return v.Float;
	return 0;
}

/** Unwrap an Int ParamValue. Returns 0 if not an Int. */
export function unwrapInt(v: ParamValue | undefined): number {
	if (v && typeof v === 'object' && 'Int' in v) return v.Int;
	return 0;
}

/** Unwrap a Bool ParamValue. Returns false if not a Bool. */
export function unwrapBool(v: ParamValue | undefined): boolean {
	if (v && typeof v === 'object' && 'Bool' in v) return v.Bool;
	return false;
}

/** Unwrap a String ParamValue. Returns '' if not a String. */
export function unwrapString(v: ParamValue | undefined): string {
	if (v && typeof v === 'object' && 'String' in v) return v.String;
	return '';
}

/** Unwrap a Curve ParamValue. Returns [] if not a Curve. */
export function unwrapCurve(v: ParamValue | undefined): ControlPoint[] {
	if (v && typeof v === 'object' && 'Curve' in v) return v.Curve;
	return [];
}

/** Unwrap a Choice ParamValue. Returns 0 if not a Choice. */
export function unwrapChoice(v: ParamValue | undefined): number {
	if (v && typeof v === 'object' && 'Choice' in v) return v.Choice;
	return 0;
}

/** Unwrap a Color ParamValue. Returns [0,0,0] if not Color. */
export function unwrapColor(v: ParamValue | undefined): [number, number, number] {
	if (v && typeof v === 'object' && 'Color' in v) return v.Color;
	return [0, 0, 0];
}

/** Unwrap a Strokes ParamValue. Returns [] if not Strokes. */
export function unwrapStrokes(v: ParamValue | undefined): BrushStroke[] {
	if (v && typeof v === 'object' && 'Strokes' in v) return v.Strokes;
	return [];
}

// --- Phase topology types ------------------------------------------------

export type PhaseTopology = 'Condenser' | 'Linear' | 'Diffuser' | 'Passthrough';

export interface PhaseInfo {
	index: number;
	name: string;
	topology: PhaseTopology;
}

export interface PhaseBoundary {
	index: number;
	topology: PhaseTopology;
}

// --- Source and adjustment types ------------------------------------------

export interface SourceEntry {
	id: string;
	plugin_id: string;
	path: string;
	width: number;
	height: number;
}

export type MergeStrategy =
	| 'Single'
	| { Integrate: { algorithm: string; params: Record<string, unknown> } }
	| { Mosaic: { placements: { entry_id: string; x: number; y: number; scale: number }[] } }
	| {
			MaskedOverlay: {
				base: string;
				overlays: { entry_id: string; zone: unknown }[];
			};
	  };

export interface SourceInfo {
	entries: SourceEntry[];
	merge: MergeStrategy;
}

export interface GeometryInfo {
	id: string;
	plugin_id: string;
	name: string;
	enabled: boolean;
	params: ParamValues;
}

export interface AdjustmentInfo {
	id: string;
	plugin_id: string;
	name: string;
	enabled: boolean;
	params: ParamValues;
	zone: ZoneSource;
}

export interface EvalError {
	adjustmentId: string;
	error: string;
}

export interface PipelineOutput {
	width: number;
	height: number;
	data: Uint8Array;
	error?: EvalError;
}

export interface ControlPoint {
	x: number;
	y: number;
}

export interface CropParams {
	x: number;
	y: number;
	width: number;
	height: number;
	ratio_w: number;
	ratio_h: number;
	landscape: boolean;
	show_thirds: boolean;
}

// --- Zone types -----------------------------------------------------------

export interface ZoneInfo {
	id: string;
	name: string;
	kind: string;
	/** For partition label entries: the parent zone ID. */
	partition_of?: string;
	/** For partition label entries: the label name. */
	label?: string;
}

export interface BrushPoint {
	x: number;
	y: number;
	pressure: number;
}

export interface BrushStroke {
	points: BrushPoint[];
	radius: number;
	opacity: number;
}

/** A named composition: a zone built from a ZoneSource expression tree. */
export interface ZoneComposition {
	name: string;
	source: ZoneSource;
}

/** A zone entry: either a generator (with plugin_id + params) or a composition. */
export type ZoneEntry =
	| { Generator: { plugin_id: string; name: string; params: ParamValues } }
	| { Composition: ZoneComposition };

/** Dependents of a zone. */
export interface ZoneDependentsInfo {
	adjustments: string[];
	compositions: string[];
}

/** Serialized ZoneSource from Rust. */
export type ZoneSource =
	| 'Full'
	| { Ref: string }
	| { PartitionLabel: [string, string, number] }
	| { Boolean: { op: 'Union' | 'Intersect' | 'Subtract'; left: ZoneSource; right: ZoneSource } }
	| { Inverted: ZoneSource };

let initialized = false;

/** One-time WASM module initialization. Idempotent. */
export async function initEditorWasm(): Promise<void> {
	if (initialized) return;
	await wasmInit({ module_or_path: wasmUrl });
	initialized = true;
}
