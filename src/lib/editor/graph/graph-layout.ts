/**
 * Graph layout — transforms pipeline state into Svelte Flow nodes and edges.
 *
 * Pure function: takes the current pipeline state from the worker and returns
 * positioned Svelte Flow nodes + edges. No side effects, easily testable.
 */

import type { Node, Edge } from '@xyflow/svelte';
import type {
	AdjustmentInfo,
	GeometryInfo,
	SourceInfo,
	EvalError,
	PhaseBoundary,
	ZoneInfo
} from '../editor-bridge';
import type { OutputGroupInfo } from '../pipeline-worker-protocol';
import { PHASE_THEMES } from './phase-theme';

// --- Layout constants -------------------------------------------------------

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 44;
export const NODE_GAP = 6;
export const JUNCTION_HEIGHT = 32;
export const PHASE_GAP = 12;
const OUTPUT_GROUP_HEIGHT = 44;
const OUTPUT_CHILD_HEIGHT = 32;
const OUTPUT_CHILD_INDENT = 24;

// --- Node data types (consumed by custom Svelte components) -----------------

export interface PipelineNodeData {
	kind: 'pipeline';
	item: AdjustmentInfo | GeometryInfo;
	phase: number;
	/** Index within the phase's pipeline array (for E2E test selectors). */
	index: number;
	isSource: boolean;
	hasError: boolean;
	errorMessage: string | null;
	/** ParamSchema for inline editing (null if not available). */
	schema: import('../editor-bridge').ParamSchema | null;
}

export interface JunctionNodeData {
	kind: 'junction';
	boundary: PhaseBoundary;
	/** The phase below this junction (whose nodes it introduces). */
	phaseBelow: number;
	collapsed: boolean;
	/** For the Output phase junction: available export encoder plugins. */
	availableExports?: Array<{ id: string; name: string }>;
}

export interface OutputGroupNodeData {
	kind: 'output-group';
	group: OutputGroupInfo;
	phase: number;
}

export interface ZoneNodeData {
	kind: 'zone';
	zone: ZoneInfo;
	phase: number;
}

export type GraphNodeData =
	| PipelineNodeData
	| JunctionNodeData
	| OutputGroupNodeData
	| ZoneNodeData;

// --- Builder ----------------------------------------------------------------

export function buildGraph(
	source: SourceInfo,
	geometry: GeometryInfo[],
	zones: ZoneInfo[],
	adjustments: AdjustmentInfo[],
	exportGroups: OutputGroupInfo[],
	boundaries: PhaseBoundary[],
	collapsedPhases: Set<number>,
	evalError: EvalError | null,
	availableExports: Array<{ id: string; name: string }> = [],
	schemas: Record<string, import('../editor-bridge').ParamSchema> = {}
): { nodes: Node[]; edges: Edge[] } {
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	let y = 0;

	// Synthesize default boundaries if missing (e.g. before WASM sends first state)
	const b: PhaseBoundary[] =
		boundaries.length >= 5
			? boundaries
			: [
					{ index: 0, topology: 'Condenser' as const },
					{ index: 1, topology: 'Passthrough' as const },
					{ index: 2, topology: 'Passthrough' as const },
					{ index: 3, topology: 'Passthrough' as const },
					{ index: 4, topology: 'Diffuser' as const }
				];
	const x = 0; // single column, left-aligned

	// Helper: add a junction node for a boundary
	function addJunction(boundary: PhaseBoundary, phaseBelow: number): string {
		const id = `__junction_${boundary.index}__`;
		nodes.push({
			id,
			type: 'junction',
			position: { x: x, y },
			data: {
				kind: 'junction',
				boundary,
				phaseBelow,
				collapsed: collapsedPhases.has(phaseBelow),
				availableExports: phaseBelow === 4 ? availableExports : undefined
			} satisfies JunctionNodeData,
			draggable: false,
			selectable: false,
			connectable: false,
			width: NODE_WIDTH
		});
		y += JUNCTION_HEIGHT + PHASE_GAP;
		return id;
	}

	// Helper: add a pipeline node
	function addPipelineNode(
		item: AdjustmentInfo | GeometryInfo,
		phase: number,
		index: number,
		isSource: boolean
	): string {
		const hasError = evalError?.adjustmentId === item.id;
		nodes.push({
			id: item.id,
			type: 'pipeline',
			position: { x, y },
			data: {
				kind: 'pipeline',
				item,
				phase,
				index,
				isSource,
				hasError,
				errorMessage: hasError ? (evalError?.error ?? null) : null,
				schema: schemas[(item as { plugin_id: string }).plugin_id] ?? null
			} satisfies PipelineNodeData,
			draggable: !isSource,
			connectable: false,
			width: NODE_WIDTH
		});
		y += NODE_HEIGHT + NODE_GAP;
		return item.id;
	}

	// Helper: add a zone node
	function addZoneNode(zone: ZoneInfo, phase: number): string {
		nodes.push({
			id: zone.id,
			type: 'zone',
			position: { x, y },
			data: {
				kind: 'zone',
				zone,
				phase
			} satisfies ZoneNodeData,
			draggable: false,
			connectable: false,
			width: NODE_WIDTH
		});
		y += NODE_HEIGHT + NODE_GAP;
		return zone.id;
	}

	// Helper: add an output group node
	function addOutputGroup(group: OutputGroupInfo, phase: number): string {
		const childCount = group.children.length;
		const totalHeight =
			OUTPUT_GROUP_HEIGHT + childCount * (OUTPUT_CHILD_HEIGHT + NODE_GAP) + NODE_GAP;
		nodes.push({
			id: group.id,
			type: 'output-group',
			position: { x, y },
			data: {
				kind: 'output-group',
				group,
				phase
			} satisfies OutputGroupNodeData,
			draggable: false, // no reorder-group logic yet
			connectable: false,
			width: NODE_WIDTH + OUTPUT_CHILD_INDENT
		});
		y += totalHeight + NODE_GAP;
		return group.id;
	}

	// Helper: add edge
	function addEdge(sourceId: string, targetId: string, phase: number): void {
		const theme = PHASE_THEMES[phase];
		edges.push({
			id: `e_${sourceId}_${targetId}`,
			source: sourceId,
			target: targetId,
			type: 'smoothstep',
			animated: false,
			style: `stroke: ${theme?.color ?? '#888'}; stroke-width: 2px;`
		});
	}

	// Helper: wire a sequence of node IDs with edges
	function wireSequence(ids: string[], phase: number): void {
		for (let i = 0; i < ids.length - 1; i++) {
			addEdge(ids[i], ids[i + 1], phase);
		}
	}

	// ─── Phase 0: Source ──────────────────────────────────────────────
	const junctionIds: string[] = [];

	// Junction 0 (Condenser — above Source)
	const j0 = addJunction(b[0], 0);
	junctionIds.push(j0);

	const sourceIds: string[] = [j0];
	if (!collapsedPhases.has(0) && source.entries.length > 0) {
		// Create a synthetic item for the source entry
		const sourceItem = {
			id: '__source__',
			plugin_id: source.entries[0].plugin_id,
			name: 'Source',
			enabled: true,
			params: {}
		};
		sourceIds.push(addPipelineNode(sourceItem, 0, 0, true));
	}

	// Junction 1 (Passthrough — Source → Geometry)
	const j1 = addJunction(b[1], 1);
	junctionIds.push(j1);
	sourceIds.push(j1);
	wireSequence(sourceIds, 0);

	// ─── Phase 1: Geometry ────────────────────────────────────────────
	const geoIds: string[] = [j1];
	if (!collapsedPhases.has(1)) {
		for (let i = 0; i < geometry.length; i++) {
			geoIds.push(addPipelineNode(geometry[i], 1, i, false));
		}
	}

	// Junction 2 (Passthrough — Geometry → Zones)
	const j2 = addJunction(b[2], 2);
	junctionIds.push(j2);
	geoIds.push(j2);
	wireSequence(geoIds, 1);

	// ─── Phase 2: Zones ──────────────────────────────────────────────
	// Filter to only show zone generators (not compositions or partition labels)
	const zoneGenerators = zones.filter((z) => !z.partition_of && z.kind !== 'Composition');

	const zoneIds: string[] = [j2];
	if (!collapsedPhases.has(2)) {
		for (const z of zoneGenerators) {
			zoneIds.push(addZoneNode(z, 2));
		}
	}

	// Junction 3 (Passthrough — Zones → Adjustments)
	const j3 = addJunction(b[3], 3);
	junctionIds.push(j3);
	zoneIds.push(j3);
	wireSequence(zoneIds, 2);

	// ─── Phase 3: Adjustments ─────────────────────────────────────────
	const adjIds: string[] = [j3];
	if (!collapsedPhases.has(3)) {
		for (let i = 0; i < adjustments.length; i++) {
			adjIds.push(addPipelineNode(adjustments[i], 3, i, false));
		}
	}

	// Junction 4 (Diffuser — Adjustments → Output)
	const j4 = addJunction(b[4], 4);
	junctionIds.push(j4);
	adjIds.push(j4);
	wireSequence(adjIds, 3);

	// ─── Phase 4: Output ─────────────────────────────────────────────
	if (!collapsedPhases.has(4)) {
		for (const group of exportGroups) {
			const groupId = addOutputGroup(group, 4);
			// Each output group connects from the diffuser junction
			addEdge(j4, groupId, 4);
		}
	}

	return { nodes, edges };
}
