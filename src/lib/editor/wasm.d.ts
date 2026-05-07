declare module '$editor_wasm/arami_editor_wasm.js' {
	export class EditGraph {
		constructor(image_bytes: Uint8Array, path: string, timestamp_ms: number);
		static from_rgb_f32(
			data: Float32Array,
			width: number,
			height: number,
			path: string,
			timestamp_ms: number
		): EditGraph;
		free(): void;
		evaluate(): {
			width: number;
			height: number;
			data: Uint8Array;
			error?: { adjustmentId: string; error: string };
		};
		set_enabled(id: string, enabled: boolean, timestamp_ms: number): void;
		add_adjustment(plugin_id: string, timestamp_ms: number): string;
		remove_adjustment(id: string, timestamp_ms: number): void;
		adjustment_params(id: string): unknown;
		update_adjustment_params(id: string, params: unknown, timestamp_ms: number): void;
		pipeline(): Array<{
			id: string;
			plugin_id: string;
			name: string;
			enabled: boolean;
			params: Record<string, unknown>;
		}>;
		serialize(): string;
		replace_source(image_bytes: Uint8Array, path: string, timestamp_ms: number): void;
		replace_source_rgb_f32(
			data: Float32Array,
			width: number,
			height: number,
			path: string,
			timestamp_ms: number
		): void;
		add_adaptive_bw(timestamp_ms: number): string[];
		source_width(): number;
		source_height(): number;
		phases(): import('./editor-bridge').PhaseInfo[];
		add_zone(plugin_id: string, timestamp_ms: number): string;
		remove_zone(id: string, timestamp_ms: number): void;
		zone_params(id: string): unknown;
		update_zone_params(id: string, params: unknown): void;
		set_adjustment_zone(adjustment_id: string, zone_source: unknown, timestamp_ms: number): void;
		adjustment_zone(adjustment_id: string): unknown;
		zone_list(): Array<{ id: string; name: string; kind: string }>;
		available_adjustments(): Array<{ id: string; name: string; category: string }>;
		available_zone_generators(): Array<{ id: string; name: string }>;
		describe(plugin_id: string): unknown;
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
		version_history(): unknown;
		can_undo(): boolean;
		can_redo(): boolean;
		head_node_id(): string;
		version_node_count(): number;
		set_class_map(data: Uint8Array, width: number, height: number): void;
		needs_segmentation(): boolean;
		// Geometry
		add_geometry_node(plugin_id: string, timestamp_ms: number): string;
		remove_geometry_node(id: string, timestamp_ms: number): void;
		reorder_geometry(id: string, new_index: number, timestamp_ms: number): void;
		set_geometry_enabled(id: string, enabled: boolean, timestamp_ms: number): void;
		update_geometry_params(id: string, params: unknown, timestamp_ms: number): void;
		geometry_pipeline(): Array<{
			id: string;
			plugin_id: string;
			name: string;
			enabled: boolean;
			params: Record<string, unknown>;
		}>;
		available_geometry(): Array<{ id: string; name: string }>;
		reorder_adjustment(id: string, new_index: number, timestamp_ms: number): void;
		// Compositions
		add_composition(name: string, source: unknown, timestamp_ms: number): string;
		update_composition(id: string, source: unknown): void;
		rename_composition(id: string, name: string, timestamp_ms: number): void;
		zone_dependents(id: string): { adjustments: string[]; compositions: string[] };
		// Outputs
		add_export_target(plugin_id: string, timestamp_ms: number): string;
		remove_export_target(id: string, timestamp_ms: number): void;
		reorder_export_target(id: string, new_index: number, timestamp_ms: number): void;
		set_export_enabled(id: string, enabled: boolean, timestamp_ms: number): void;
		update_export_params(id: string, params: unknown, timestamp_ms: number): void;
		export_pipeline(): Array<import('./pipeline-worker-protocol').OutputInfo>;
		available_exports(): Array<{ id: string; name: string }>;
		run_export(id: string): { data: Uint8Array };
		set_output_suffix(id: string, suffix: string, timestamp_ms: number): void;
		set_output_name(id: string, name: string, timestamp_ms: number): void;
		set_output_resize(id: string, resize: unknown, timestamp_ms: number): void;
		set_output_path(id: string, path: unknown, timestamp_ms: number): void;
		set_output_metadata(id: string, metadata: unknown, timestamp_ms: number): void;
		source_info(): import('./editor-bridge').SourceInfo;
	}

	export default function init(
		input?: string | URL | Request | { module_or_path: string | URL | Request }
	): Promise<void>;
}

declare module '$editor_wasm/arami_editor_wasm_bg.wasm?url' {
	const url: string;
	export default url;
}
