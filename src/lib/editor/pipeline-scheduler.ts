/**
 * Pipeline Scheduler — main-thread coordinator for the pipeline Worker.
 *
 * Provides an async API over the Worker message protocol and implements
 * latest-wins scheduling: if a new perform() arrives while the Worker is
 * evaluating, intermediate requests are dropped and only the latest runs.
 */

import { logger } from '$lib/log';
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
import type {
	Action,
	MainToWorkerMessage,
	WorkerToMainMessage,
	OutputGroupInfo
} from './pipeline-worker-protocol';

const log = logger('scheduler');

export interface SchedulerCallbacks {
	onState: (
		source: SourceInfo,
		pipeline: AdjustmentInfo[],
		geometry: GeometryInfo[],
		schemas: Record<string, ParamSchema>,
		versionNodes: VersionNode[],
		headNodeId: string,
		canUndo: boolean,
		canRedo: boolean,
		tags: TagEntry[],
		zones: ZoneInfo[],
		exportTargets: OutputGroupInfo[],
		availableExports: Array<{ id: string; name: string }>,
		boundaries: PhaseBoundary[],
		addedIds?: string[]
	) => void;
	onPixels: (data: Uint8Array, width: number, height: number, error?: EvalError) => void;
	onExportResult: (id: string, data: Uint8Array) => void;
	onError: (message: string) => void;
}

type EvalState = 'idle' | 'evaluating' | 'queued';

interface QueuedRequest {
	label: string;
	actions: Action[];
}

export class PipelineScheduler {
	private worker: Worker;
	private callbacks: SchedulerCallbacks;
	private seq = 0;
	private evalState: EvalState = 'idle';
	private queued: QueuedRequest | null = null;
	private readyPromise: Promise<void>;
	private resolveReady!: () => void;
	private rejectReady!: (err: Error) => void;

	/** rAF coalescing: pending update-params keyed by adjustment id (latest wins). */
	private pending: Map<string, Action> = new Map();
	private pendingLabel = '';
	private rafId: number | null = null;

	/** True while the Worker is evaluating (for UI indicators). */
	get evaluating(): boolean {
		return this.evalState !== 'idle';
	}

	constructor(callbacks: SchedulerCallbacks) {
		this.callbacks = callbacks;
		this.worker = new Worker(new URL('./pipeline-worker.ts', import.meta.url), {
			type: 'module'
		});

		this.readyPromise = new Promise((resolve, reject) => {
			this.resolveReady = resolve;
			this.rejectReady = reject;
		});

		this.worker.onmessage = (e: MessageEvent<WorkerToMainMessage>) => {
			this.handleMessage(e.data);
		};

		this.worker.onerror = (e) => {
			log.error('worker error', { message: e.message });
			this.callbacks.onError(e.message);
		};
	}

	private send(msg: MainToWorkerMessage, transfer?: Transferable[]): void {
		if (transfer) {
			this.worker.postMessage(msg, transfer);
		} else {
			this.worker.postMessage(msg);
		}
	}

	private handleMessage(msg: WorkerToMainMessage): void {
		switch (msg.type) {
			case 'ready':
				log.info('worker ready');
				this.resolveReady();
				break;

			case 'state':
				this.callbacks.onState(
					msg.source,
					msg.pipeline,
					msg.geometry,
					msg.schemas,
					msg.versionNodes,
					msg.headNodeId,
					msg.canUndo,
					msg.canRedo,
					msg.tags,
					msg.zones,
					msg.exportTargets,
					msg.availableExports ?? [],
					msg.boundaries ?? [],
					msg.addedIds
				);
				break;

			case 'pixels':
				this.handlePixels(msg);
				break;

			case 'export-result':
				this.callbacks.onExportResult(msg.id, msg.data);
				break;

			case 'error':
				log.error('worker reported error', { message: msg.message });
				this.callbacks.onError(msg.message);
				// If we were evaluating, reset state so we don't get stuck
				if (this.evalState !== 'idle') {
					this.evalState = 'idle';
					this.queued = null;
				}
				break;
		}
	}

	private handlePixels(msg: Extract<WorkerToMainMessage, { type: 'pixels' }>): void {
		// Discard stale results
		if (msg.seq !== 0 && msg.seq < this.seq) {
			log.info('discarding stale pixels', { got: msg.seq, current: this.seq });
			return;
		}

		this.callbacks.onPixels(msg.data, msg.width, msg.height, msg.error);

		// Process queued request if any
		if (this.queued) {
			const next = this.queued;
			this.queued = null;
			this.evalState = 'evaluating';
			this.seq++;
			log.info('sending queued request', { label: next.label, seq: this.seq });
			this.send({
				type: 'perform',
				label: next.label,
				actions: next.actions,
				seq: this.seq
			});
		} else {
			this.evalState = 'idle';
		}
	}

	/** Wait for WASM to initialize in the Worker. */
	async waitReady(): Promise<void> {
		return this.readyPromise;
	}

	/** Initialize the EditGraph from encoded image bytes. */
	init(imageBytes: ArrayBuffer, path: string, timestamp: number): void {
		this.evalState = 'evaluating';
		this.send({ type: 'init', imageBytes, path, timestamp }, [imageBytes]);
	}

	/** Initialize the EditGraph from raw F32 pixel data. */
	initF32(
		data: Float32Array,
		width: number,
		height: number,
		path: string,
		timestamp: number
	): void {
		this.evalState = 'evaluating';
		this.send({ type: 'init-f32', data, width, height, path, timestamp }, [data.buffer]);
	}

	/**
	 * Perform a mutation group and re-evaluate.
	 *
	 * update-params actions are coalesced per-adjustment within a rAF window.
	 * Any other action type flushes all pending actions immediately.
	 *
	 * If the Worker is currently evaluating, the request is queued (replacing
	 * any previously queued request — latest wins).
	 */
	perform(label: string, actions: Action[]): void {
		const allUpdateParams = actions.every(
			(a) => a.type === 'update-params' || a.type === 'update-geometry-params'
		);

		if (allUpdateParams) {
			for (const action of actions) {
				if (action.type === 'update-params' || action.type === 'update-geometry-params') {
					this.pending.set(action.id, action);
				}
			}
			this.pendingLabel = label;
			if (this.rafId === null) {
				this.rafId = requestAnimationFrame(() => this.flush());
			}
			return;
		}

		// Non-coalescable action: flush everything immediately
		const flushed = this.cancelPending();
		const allActions = [...flushed, ...actions];
		this.sendPerform(label, allActions);
	}

	private flush(): void {
		this.rafId = null;
		const actions = [...this.pending.values()];
		const label = this.pendingLabel;
		this.pending.clear();
		this.pendingLabel = '';
		if (actions.length > 0) {
			this.sendPerform(label, actions);
		}
	}

	private cancelPending(): Action[] {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		const actions = [...this.pending.values()];
		this.pending.clear();
		this.pendingLabel = '';
		return actions;
	}

	private sendPerform(label: string, actions: Action[]): void {
		if (this.evalState === 'evaluating' || this.evalState === 'queued') {
			log.info('queueing perform (worker busy)', { label });
			this.queued = { label, actions };
			this.evalState = 'queued';
			return;
		}

		this.evalState = 'evaluating';
		this.seq++;
		this.send({
			type: 'perform',
			label,
			actions,
			seq: this.seq
		});
	}

	/** Reorder an adjustment to a new pipeline position. */
	reorder(id: string, newIndex: number): void {
		this.perform('Reorder', [{ type: 'reorder-adjustment', id, newIndex }]);
	}

	/** Add a zone generator by plugin ID. */
	addZone(pluginId: string): void {
		this.perform('Add Zone', [{ type: 'add-zone', pluginId }]);
	}

	/** Remove a zone by ID. */
	removeZone(id: string): void {
		this.perform('Remove Zone', [{ type: 'remove-zone', id }]);
	}

	/** Add a named composition. */
	addComposition(name: string, source: unknown): void {
		this.perform('Add Composition', [{ type: 'add-composition', name, source }]);
	}

	/** Remove a composition by ID (uses same underlying remove as zones). */
	removeComposition(id: string): void {
		this.perform('Remove Composition', [{ type: 'remove-composition', id }]);
	}

	/** Rename a composition. */
	renameComposition(id: string, name: string): void {
		this.perform('Rename Composition', [{ type: 'rename-composition', id, name }]);
	}

	/** Send a segmentation class map to the Worker. */
	setClassMap(data: Uint8Array, width: number, height: number): void {
		this.send({ type: 'set-class-map', data, width, height });
	}

	/** Check whether the pipeline needs segmentation (has a segmentation zone). */
	needsSegmentation(zones: ZoneInfo[]): boolean {
		return zones.some((z) => z.kind === 'AI');
	}

	/** Forward a log entry to the Worker's history. */
	attachLog(level: string, component: string, message: string, timestamp: number): void {
		this.send({ type: 'attach-log', level, component, message, timestamp });
	}

	/** Undo the last edit. */
	undo(): void {
		this.cancelPending();
		this.queued = null;
		this.send({ type: 'undo' });
	}

	/** Redo the last undone edit. */
	redo(): void {
		this.cancelPending();
		this.queued = null;
		this.send({ type: 'redo' });
	}

	/** Jump to an arbitrary version node. */
	jumpTo(nodeId: string): void {
		this.cancelPending();
		this.queued = null;
		this.send({ type: 'jump-to', nodeId });
	}

	/** Tag the current head node. */
	tag(name: string): void {
		this.send({ type: 'tag', name });
	}

	/** Remove a tag by name. */
	untag(name: string): void {
		this.send({ type: 'untag', name });
	}

	/** Terminate the Worker. */
	destroy(): void {
		this.cancelPending();
		this.worker.terminate();
		log.info('worker terminated');
	}
}
