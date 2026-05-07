/**
 * Pipeline Web Worker -- owns EditGraph and runs evaluation off the main thread.
 *
 * All WASM state lives here. The main thread communicates via the message
 * protocol defined in pipeline-worker-protocol.ts.
 */

import wasmInit, { EditGraph } from '$editor_wasm/arami_editor_wasm.js';
import wasmUrl from '$editor_wasm/arami_editor_wasm_bg.wasm?url';
import type { MainToWorkerMessage, WorkerToMainMessage, Action } from './pipeline-worker-protocol';
import type { VersionNode, TagEntry } from './editor-bridge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let graph: (EditGraph & Record<string, any>) | undefined;

function post(msg: WorkerToMainMessage, transfer?: Transferable[]): void {
	if (transfer) {
		self.postMessage(msg, { transfer });
	} else {
		self.postMessage(msg);
	}
}

function evaluateAndSend(seq: number): void {
	if (!graph) return;
	const output = graph.evaluate();
	const data = output.data;
	post(
		{
			type: 'pixels',
			data,
			width: output.width,
			height: output.height,
			seq,
			error: output.error
		},
		[data.buffer]
	);
}

function sendState(addedIds?: string[]): void {
	if (!graph) return;
	const tagsObj = graph.tags() as Record<string, string>;
	const tags: TagEntry[] = [];
	for (const [name, nodeId] of Object.entries(tagsObj)) {
		tags.push({ name, nodeId });
	}
	// Collect schemas for all unique plugin_ids across geometry and adjustments
	const pipeline = graph.pipeline();
	const geometry = graph.geometry_pipeline();
	const schemas: Record<string, unknown> = {};
	for (const node of geometry) {
		const pid = (node as { plugin_id: string }).plugin_id;
		if (pid && !(pid in schemas)) {
			try {
				schemas[pid] = graph.describe(pid);
			} catch {
				// skip if describe fails
			}
		}
	}
	for (const adj of pipeline) {
		const pid = (adj as { plugin_id: string }).plugin_id;
		if (pid && !(pid in schemas)) {
			try {
				schemas[pid] = graph.describe(pid);
			} catch {
				// skip if describe fails
			}
		}
	}
	let exportTargets: import('./pipeline-worker-protocol').OutputGroupInfo[] = [];
	try {
		exportTargets = graph.export_pipeline();
	} catch {
		// export_pipeline may not exist yet in WASM
	}
	for (const group of exportTargets) {
		for (const child of group.children) {
			const pid = child.plugin_id;
			if (pid && !(pid in schemas)) {
				try {
					schemas[pid] = graph.describe(pid);
				} catch {
					// skip if describe fails
				}
			}
		}
	}
	post({
		type: 'state',
		source: graph.source_info(),
		pipeline,
		geometry,
		schemas: schemas as Record<string, import('./editor-bridge').ParamSchema>,
		versionNodes: graph.version_history() as VersionNode[],
		headNodeId: graph.head_node_id(),
		canUndo: graph.can_undo(),
		canRedo: graph.can_redo(),
		tags,
		zones: graph.zone_list(),
		exportTargets,
		availableExports: (() => {
			try {
				return graph.available_exports();
			} catch {
				return [];
			}
		})(),
		boundaries: (() => {
			try {
				return graph.boundaries();
			} catch {
				return [];
			}
		})(),
		addedIds
	});
}

function applyAction(action: Action, ts: number): string[] {
	if (!graph) return [];
	const addedIds: string[] = [];

	switch (action.type) {
		case 'add-adjustment': {
			const id = graph.add_adjustment(action.pluginId, ts);
			if (action.zone) {
				graph.set_adjustment_zone(id, action.zone, ts);
			}
			addedIds.push(id);
			break;
		}
		case 'remove-adjustment':
			graph.remove_adjustment(action.id, ts);
			break;
		case 'toggle':
			graph.set_enabled(action.id, action.enabled, ts);
			break;
		case 'update-params':
			graph.update_adjustment_params(action.id, action.params, ts);
			break;
		case 'add-geometry': {
			const id = graph.add_geometry_node(action.pluginId, ts);
			addedIds.push(id);
			break;
		}
		case 'remove-geometry':
			graph.remove_geometry_node(action.id, ts);
			break;
		case 'toggle-geometry':
			graph.set_geometry_enabled(action.id, action.enabled, ts);
			break;
		case 'update-geometry-params':
			graph.update_geometry_params(action.id, action.params, ts);
			break;
		case 'reorder-geometry':
			graph.reorder_geometry(action.id, action.newIndex, ts);
			break;
		case 'replace-source':
			graph.replace_source(action.bytes, action.path, ts);
			break;
		case 'replace-source-f32':
			graph.replace_source_rgb_f32(action.data, action.width, action.height, action.path, ts);
			break;
		case 'apply-adaptive-bw': {
			const ids: string[] = graph.add_adaptive_bw(ts);
			addedIds.push(...ids);
			break;
		}
		case 'set-zone':
			graph.set_adjustment_zone(action.adjustmentId, action.zoneSource, ts);
			break;
		case 'reorder-adjustment':
			graph.reorder_adjustment(action.id, action.newIndex, ts);
			break;
		case 'add-zone': {
			const id = graph.add_zone(action.pluginId, ts);
			addedIds.push(id);
			break;
		}
		case 'remove-zone':
			graph.remove_zone(action.id, ts);
			break;
		case 'add-composition': {
			const id = graph.add_composition(action.name, action.source, ts);
			addedIds.push(id);
			break;
		}
		case 'remove-composition':
			graph.remove_zone(action.id, ts);
			break;
		case 'rename-composition':
			graph.rename_composition(action.id, action.name, ts);
			break;
		case 'add-export-group': {
			const id = graph.add_export_group(action.pluginId, ts);
			addedIds.push(id);
			break;
		}
		case 'remove-export-group':
			graph.remove_export_group(action.id, ts);
			break;
		case 'toggle-export-group':
			graph.set_export_enabled(action.id, action.enabled, ts);
			break;
		case 'reorder-export-group':
			graph.reorder_export_group(action.id, action.newIndex, ts);
			break;
		case 'run-export': {
			try {
				const result = graph.run_export(action.id);
				post({ type: 'export-result', id: action.id, data: result.data }, [result.data.buffer]);
			} catch (e) {
				post({ type: 'error', message: `Export failed: ${e}` });
			}
			break;
		}
		case 'set-group-name':
			graph.set_group_name(action.id, action.name, ts);
			break;
		case 'set-group-suffix':
			graph.set_group_suffix(action.id, action.suffix, ts);
			break;
		case 'set-group-path':
			graph.set_group_path(action.id, action.path, ts);
			break;
		case 'add-group-child': {
			const childId = graph.add_group_child(action.groupId, action.pluginId, ts);
			addedIds.push(childId);
			break;
		}
		case 'remove-group-child':
			graph.remove_group_child(action.groupId, action.childId, ts);
			break;
		case 'toggle-group-child':
			graph.toggle_group_child(action.groupId, action.childId, action.enabled, ts);
			break;
		case 'update-group-child-params':
			graph.update_group_child_params(action.groupId, action.childId, action.params, ts);
			break;
	}

	return addedIds;
}

self.onmessage = (e: MessageEvent<MainToWorkerMessage>) => {
	const msg = e.data;

	try {
		switch (msg.type) {
			case 'init': {
				const bytes = new Uint8Array(msg.imageBytes);
				graph = new EditGraph(bytes, msg.path, msg.timestamp);
				graph.history_end_group();
				sendState();
				evaluateAndSend(0);
				break;
			}

			case 'init-f32': {
				graph = EditGraph.from_rgb_f32(msg.data, msg.width, msg.height, msg.path, msg.timestamp);
				graph.history_end_group();
				sendState();
				evaluateAndSend(0);
				break;
			}

			case 'perform': {
				if (!graph) break;
				const ts = Date.now();
				graph.history_begin_group(msg.label, ts);
				const allAddedIds: string[] = [];
				try {
					for (const action of msg.actions) {
						const ids = applyAction(action, ts);
						allAddedIds.push(...ids);
					}
				} finally {
					graph.history_end_group();
				}
				sendState(allAddedIds.length > 0 ? allAddedIds : undefined);
				evaluateAndSend(msg.seq);
				break;
			}

			case 'undo': {
				if (!graph) break;
				if (graph.undo()) {
					sendState();
					evaluateAndSend(0);
				}
				break;
			}

			case 'redo': {
				if (!graph) break;
				if (graph.redo()) {
					sendState();
					evaluateAndSend(0);
				}
				break;
			}

			case 'jump-to': {
				if (!graph) break;
				if (graph.jump_to(msg.nodeId)) {
					sendState();
					evaluateAndSend(0);
				}
				break;
			}

			case 'tag': {
				if (!graph) break;
				graph.tag(msg.name);
				sendState();
				break;
			}

			case 'untag': {
				if (!graph) break;
				graph.untag(msg.name);
				sendState();
				break;
			}

			case 'attach-log': {
				if (!graph) break;
				graph.history_attach_log(msg.level, msg.component, msg.message, msg.timestamp);
				break;
			}

			case 'set-class-map': {
				if (!graph) break;
				graph.set_class_map(msg.data, msg.width, msg.height);
				// Re-evaluate with the new class map
				sendState();
				evaluateAndSend(0);
				break;
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		post({ type: 'error', message });
	}
};

// Initialize WASM module, then signal readiness
wasmInit({ module_or_path: wasmUrl })
	.then(() => {
		post({ type: 'ready' });
	})
	.catch((err) => {
		const message = err instanceof Error ? err.message : String(err);
		post({ type: 'error', message: `WASM init failed: ${message}` });
	});
