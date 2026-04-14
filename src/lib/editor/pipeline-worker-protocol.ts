/**
 * Shared types for the pipeline Worker <-> Main thread message protocol.
 */

import type {
	AdjustmentInfo,
	GeometryInfo,
	SourceInfo,
	EvalError,
	VersionNode,
	TagEntry,
	ZoneInfo,
	PhaseBoundary,
	ParamSchema
} from './editor-bridge';

// --- Actions (mutations sent inside a perform message) -------------------

export type Action =
	| { type: 'add-adjustment'; pluginId: string; zone?: unknown }
	| { type: 'remove-adjustment'; id: string }
	| { type: 'toggle'; id: string; enabled: boolean }
	| { type: 'update-params'; id: string; params: unknown }
	| { type: 'add-geometry'; pluginId: string }
	| { type: 'remove-geometry'; id: string }
	| { type: 'toggle-geometry'; id: string; enabled: boolean }
	| { type: 'update-geometry-params'; id: string; params: unknown }
	| { type: 'reorder-geometry'; id: string; newIndex: number }
	| { type: 'replace-source'; bytes: Uint8Array; path: string }
	| { type: 'replace-source-f32'; data: Float32Array; width: number; height: number; path: string }
	| { type: 'apply-adaptive-bw' }
	| { type: 'set-zone'; adjustmentId: string; zoneSource: unknown }
	| { type: 'reorder-adjustment'; id: string; newIndex: number }
	| { type: 'add-zone'; pluginId: string }
	| { type: 'remove-zone'; id: string }
	| { type: 'add-composition'; name: string; source: unknown }
	| { type: 'remove-composition'; id: string }
	| { type: 'rename-composition'; id: string; name: string }
	| { type: 'add-export-group'; pluginId: string }
	| { type: 'remove-export-group'; id: string }
	| { type: 'toggle-export-group'; id: string; enabled: boolean }
	| { type: 'reorder-export-group'; id: string; newIndex: number }
	| { type: 'run-export'; id: string }
	| { type: 'set-group-name'; id: string; name: string }
	| { type: 'set-group-suffix'; id: string; suffix: string }
	| { type: 'set-group-path'; id: string; path: OutputPath }
	| { type: 'add-group-child'; groupId: string; pluginId: string }
	| { type: 'remove-group-child'; groupId: string; childId: string }
	| { type: 'toggle-group-child'; groupId: string; childId: string; enabled: boolean }
	| { type: 'update-group-child-params'; groupId: string; childId: string; params: unknown };

// --- Output DTO ----------------------------------------------------------

export type OutputPath = 'SameAsSource' | { Custom: string };

export interface OutputChildInfo {
	id: string;
	plugin_id: string;
	params: Record<string, unknown>;
	enabled: boolean;
}

export interface OutputGroupInfo {
	id: string;
	name: string;
	enabled: boolean;
	suffix: string;
	path: OutputPath;
	children: OutputChildInfo[];
}

// --- Main -> Worker messages ---------------------------------------------

export type MainToWorkerMessage =
	| { type: 'init'; imageBytes: ArrayBuffer; path: string; timestamp: number }
	| {
			type: 'init-f32';
			data: Float32Array;
			width: number;
			height: number;
			path: string;
			timestamp: number;
	  }
	| { type: 'perform'; label: string; actions: Action[]; seq: number }
	| { type: 'undo' }
	| { type: 'redo' }
	| { type: 'jump-to'; nodeId: string }
	| { type: 'tag'; name: string }
	| { type: 'untag'; name: string }
	| {
			type: 'attach-log';
			level: string;
			component: string;
			message: string;
			timestamp: number;
	  }
	| { type: 'set-class-map'; data: Uint8Array; width: number; height: number };

// --- Worker -> Main messages ---------------------------------------------

export type WorkerToMainMessage =
	| { type: 'ready' }
	| {
			type: 'state';
			source: SourceInfo;
			pipeline: AdjustmentInfo[];
			geometry: GeometryInfo[];
			schemas: Record<string, ParamSchema>;
			versionNodes: VersionNode[];
			headNodeId: string;
			canUndo: boolean;
			canRedo: boolean;
			tags: TagEntry[];
			zones: ZoneInfo[];
			exportTargets: OutputGroupInfo[];
			availableExports: Array<{ id: string; name: string }>;
			boundaries: PhaseBoundary[];
			addedIds?: string[];
	  }
	| {
			type: 'pixels';
			data: Uint8Array;
			width: number;
			height: number;
			seq: number;
			error?: EvalError;
	  }
	| { type: 'export-result'; id: string; data: Uint8Array }
	| { type: 'error'; message: string };
