<script lang="ts">
	import { SvelteFlow, Background, MiniMap, Controls, type Node } from '@xyflow/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import '@xyflow/svelte/dist/base.css';

	import type {
		AdjustmentInfo,
		GeometryInfo,
		SourceInfo,
		EvalError,
		PhaseBoundary,
		ZoneInfo
	} from '../editor-bridge';
	import type { OutputGroupInfo } from '../pipeline-worker-protocol';

	import PipelineNode from './PipelineNode.svelte';
	import JunctionNode from './JunctionNode.svelte';
	import ZoneNode from './ZoneNode.svelte';
	import OutputGroupNode from './OutputGroupNode.svelte';
	import LayoutEngine from './LayoutEngine.svelte';
	import { buildGraph, type PipelineNodeData } from './graph-layout';

	interface Props {
		source: SourceInfo;
		geometry: GeometryInfo[];
		zones: ZoneInfo[];
		adjustments: AdjustmentInfo[];
		exportGroups: OutputGroupInfo[];
		boundaries: PhaseBoundary[];
		schemas: Record<string, import('../editor-bridge').ParamSchema>;
		selectedId: string | null;
		evalError: EvalError | null;
		onSelect: (id: string) => void;
		onToggle: (id: string, enabled: boolean) => void;
		onAddAdjustment: (pluginId: string) => void;
		onAddGeometry: (pluginId: string) => void;
		onAddZone: (pluginId: string) => void;
		onRemoveAdjustment: (id: string) => void;
		onRemoveZone: (id: string) => void;
		onRemoveGroup: (id: string) => void;
		onToggleGroup: (id: string, enabled: boolean) => void;
		onAddGroup: (pluginId: string) => void;
		availableExports: Array<{ id: string; name: string }>;
		onReorder: (id: string, newIndex: number) => void;
		onParamChange: (id: string, params: import('../editor-bridge').ParamValues) => void;
		onSelectOutputChild: (groupId: string, childId: string) => void;
	}

	let {
		source,
		geometry,
		zones,
		adjustments,
		exportGroups,
		boundaries,
		schemas,
		evalError,
		onSelect,
		onToggle,
		onAddAdjustment,
		onAddGeometry,
		onAddZone,
		onRemoveAdjustment,
		onRemoveZone,
		onRemoveGroup,
		onToggleGroup,
		onAddGroup,
		availableExports,
		onReorder,
		onParamChange,
		onSelectOutputChild
	}: Props = $props();

	const nodeTypes = {
		pipeline: PipelineNode,
		junction: JunctionNode,
		zone: ZoneNode,
		'output-group': OutputGroupNode
	};

	let collapsedPhases = new SvelteSet<number>();

	let nodes: Node[] = $state.raw([]);
	let edges: import('@xyflow/svelte').Edge[] = $state.raw([]);

	let graphContainer: HTMLElement;

	function triggerRelayout(): void {
		// Dispatch to LayoutEngine which listens inside the SvelteFlow tree.
		// Use double-rAF to ensure the DOM is ready after Svelte renders.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				graphContainer
					?.querySelector('[data-layout-engine]')
					?.dispatchEvent(new CustomEvent('relayout'));
			});
		});
	}

	// Build graph from pipeline state (initial positions use fixed heights)
	$effect(() => {
		const g = buildGraph(
			source,
			geometry,
			zones,
			adjustments,
			exportGroups,
			boundaries,
			collapsedPhases,
			evalError,
			availableExports,
			schemas
		);
		nodes = g.nodes;
		edges = g.edges;
		// Schedule relayout after Svelte Flow renders and measures nodes
		triggerRelayout();
	});

	function handleNodeDragStop({ targetNode: draggedNode }: { targetNode: Node }): void {
		const d = draggedNode.data as unknown as PipelineNodeData;
		if (d.kind !== 'pipeline' || d.isSource) return;

		const siblings = nodes
			.filter(
				(n) =>
					n.type === 'pipeline' &&
					(n.data as unknown as PipelineNodeData).phase === d.phase &&
					!(n.data as unknown as PipelineNodeData).isSource
			)
			.sort((a, b) => a.position.y - b.position.y);

		const newIndex = siblings.findIndex((n) => n.id === draggedNode.id);
		if (newIndex === -1) return;

		const pipelineIndex = d.phase === 3 ? newIndex + 1 : newIndex;
		onReorder(draggedNode.id, pipelineIndex);
	}

	function captureCustomEvents(node: HTMLElement): { destroy: () => void } {
		function handler(event: Event): void {
			const ce = event as CustomEvent;
			const detail = ce.detail;
			switch (ce.type) {
				case 'nodetoggle':
					if (detail.kind === 'output-group') onToggleGroup(detail.id, detail.enabled);
					else onToggle(detail.id, detail.enabled);
					break;
				case 'noderemove':
					if (detail.kind === 'zone') onRemoveZone(detail.id);
					else if (detail.kind === 'output-group') onRemoveGroup(detail.id);
					else onRemoveAdjustment(detail.id);
					break;
				case 'nodeadd':
					if (detail.phase === 1) onAddGeometry(detail.pluginId);
					else if (detail.phase === 2) onAddZone(detail.pluginId);
					else if (detail.phase === 3) onAddAdjustment(detail.pluginId);
					else if (detail.phase === 4) onAddGroup(detail.pluginId);
					break;
				case 'phasecollapse':
					if (collapsedPhases.has(detail.phase)) collapsedPhases.delete(detail.phase);
					else collapsedPhases.add(detail.phase);
					break;
				case 'nodeparamchange':
					onParamChange(detail.id, detail.params);
					break;
				case 'nodeselect':
					if (detail.groupId) {
						onSelectOutputChild(detail.groupId, detail.id);
					} else {
						onSelect(detail.id);
					}
					break;
				case 'noderesized':
					triggerRelayout();
					break;
			}
		}

		const events = [
			'nodetoggle',
			'noderemove',
			'nodeadd',
			'phasecollapse',
			'nodeselect',
			'nodeparamchange',
			'noderesized'
		];
		for (const evt of events) {
			node.addEventListener(evt, handler);
		}
		return {
			destroy() {
				for (const evt of events) {
					node.removeEventListener(evt, handler);
				}
			}
		};
	}
</script>

<div class="h-full w-full" use:captureCustomEvents bind:this={graphContainer}>
	<SvelteFlow
		{nodes}
		{edges}
		{nodeTypes}
		fitView
		nodesDraggable={true}
		nodesConnectable={false}
		elementsSelectable={true}
		panOnDrag={true}
		zoomOnScroll={true}
		minZoom={0.3}
		maxZoom={2}
		onnodeclick={({ node }) => onSelect(node.id)}
		onnodedragstop={handleNodeDragStop}
		colorMode="system"
	>
		<Background />
		<Controls />
		<MiniMap />
		<LayoutEngine />
	</SvelteFlow>
</div>

<style>
	div {
		min-height: 400px;
	}
</style>
