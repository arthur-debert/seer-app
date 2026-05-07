/**
 * Unit tests for PipelineScheduler rAF coalescing.
 *
 * We mock the Worker (capture postMessage calls) and rAF (manual trigger)
 * so tests are deterministic and synchronous.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────

// Mock $lib/log before importing the scheduler
vi.mock('$lib/log', () => ({
	logger: () => ({
		info: vi.fn(),
		error: vi.fn()
	})
}));

// Capture rAF callbacks for manual triggering
let rafCallback: FrameRequestCallback | null = null;
let rafIdCounter = 1;

vi.stubGlobal(
	'requestAnimationFrame',
	vi.fn((cb: FrameRequestCallback) => {
		rafCallback = cb;
		return rafIdCounter++;
	})
);

vi.stubGlobal(
	'cancelAnimationFrame',
	vi.fn(() => {
		rafCallback = null;
	})
);

function triggerRaf(): void {
	const cb = rafCallback;
	rafCallback = null;
	if (cb) cb(performance.now());
}

// Mock Worker: capture postMessage calls, track last instance
const mockWorkerInstances: MockWorker[] = [];

class MockWorker {
	messages: unknown[] = [];
	onmessage: ((e: MessageEvent) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	constructor() {
		mockWorkerInstances.push(this);
	}
	postMessage(msg: unknown): void {
		this.messages.push(msg);
	}
	terminate(): void {}
}

vi.stubGlobal('Worker', MockWorker);

// Now import the scheduler (after mocks are in place)
import { PipelineScheduler } from './pipeline-scheduler';

// ─── Helpers ─────────────────────────────────────────────────────────

function createScheduler() {
	const callbacks = {
		onState: vi.fn(),
		onPixels: vi.fn(),
		onExportResult: vi.fn(),
		onError: vi.fn()
	};
	const before = mockWorkerInstances.length;
	const scheduler = new PipelineScheduler(callbacks);
	const worker = mockWorkerInstances[before];
	return { scheduler, worker, callbacks };
}

function performMessages(worker: MockWorker) {
	return worker.messages.filter(
		(m) => typeof m === 'object' && m !== null && (m as Record<string, unknown>).type === 'perform'
	) as Array<{ type: 'perform'; label: string; actions: unknown[]; seq: number }>;
}

// ─── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
	rafCallback = null;
	rafIdCounter = 1;
	vi.mocked(requestAnimationFrame).mockClear();
	vi.mocked(cancelAnimationFrame).mockClear();
});

afterEach(() => {
	mockWorkerInstances.length = 0;
});

describe('rAF coalescing', () => {
	test('single update-params is deferred until rAF', () => {
		const { scheduler, worker } = createScheduler();

		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.5 } }
		]);

		// No immediate postMessage
		expect(performMessages(worker)).toHaveLength(0);
		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

		// Trigger rAF
		triggerRaf();
		const msgs = performMessages(worker);
		expect(msgs).toHaveLength(1);
		expect(msgs[0].actions).toEqual([
			{ type: 'update-params', id: 'adj-1', params: { value: 0.5 } }
		]);

		scheduler.destroy();
	});

	test('multiple update-params for same adjustment coalesce (latest wins)', () => {
		const { scheduler, worker } = createScheduler();

		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.3 } }
		]);
		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.7 } }
		]);
		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.9 } }
		]);

		// Only one rAF scheduled
		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

		triggerRaf();
		const msgs = performMessages(worker);
		expect(msgs).toHaveLength(1);
		expect(msgs[0].actions).toHaveLength(1);
		expect(msgs[0].actions[0]).toEqual({
			type: 'update-params',
			id: 'adj-1',
			params: { value: 0.9 }
		});

		scheduler.destroy();
	});

	test('update-params for different adjustments batch into one message', () => {
		const { scheduler, worker } = createScheduler();

		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.5 } }
		]);
		scheduler.perform('contrast', [{ type: 'update-params', id: 'adj-2', params: { value: 0.8 } }]);

		triggerRaf();
		const msgs = performMessages(worker);
		expect(msgs).toHaveLength(1);
		expect(msgs[0].actions).toHaveLength(2);

		const ids = msgs[0].actions.map((a: { type: string; id?: string }) => (a as { id: string }).id);
		expect(ids).toContain('adj-1');
		expect(ids).toContain('adj-2');

		scheduler.destroy();
	});

	test('non-coalescable action flushes pending immediately', () => {
		const { scheduler, worker } = createScheduler();

		// Buffer an update-params
		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.5 } }
		]);
		expect(performMessages(worker)).toHaveLength(0);

		// Now send a non-coalescable action
		scheduler.perform('add adjustment', [{ type: 'add-adjustment', pluginId: 'arami.contrast' }]);

		// Both should be sent immediately (no rAF wait)
		const msgs = performMessages(worker);
		expect(msgs).toHaveLength(1);
		expect(msgs[0].actions).toHaveLength(2);
		expect(msgs[0].actions[0]).toEqual({
			type: 'update-params',
			id: 'adj-1',
			params: { value: 0.5 }
		});
		expect(msgs[0].actions[1]).toEqual({ type: 'add-adjustment', pluginId: 'arami.contrast' });

		// rAF should have been cancelled
		expect(cancelAnimationFrame).toHaveBeenCalled();

		scheduler.destroy();
	});

	test('destroy cancels pending rAF', () => {
		const { scheduler, worker } = createScheduler();

		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.5 } }
		]);

		scheduler.destroy();

		// Trigger rAF (should be a no-op since it was cancelled)
		triggerRaf();

		expect(performMessages(worker)).toHaveLength(0);
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	test('coalesced message respects latest-wins when worker is busy', () => {
		const { scheduler, worker } = createScheduler();

		// First perform goes through immediately (after rAF)
		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.3 } }
		]);
		triggerRaf();
		expect(performMessages(worker)).toHaveLength(1);

		// Worker is now "evaluating" — next performs should be queued
		scheduler.perform('brightness', [
			{ type: 'update-params', id: 'adj-1', params: { value: 0.7 } }
		]);
		triggerRaf();

		// Still only 1 postMessage — second is queued internally
		expect(performMessages(worker)).toHaveLength(1);

		// Simulate worker finishing: send pixels response
		worker.onmessage!(
			new MessageEvent('message', {
				data: { type: 'pixels', data: new Uint8Array(0), width: 1, height: 1, seq: 1 }
			})
		);

		// Now the queued request should have been sent
		const msgs = performMessages(worker);
		expect(msgs).toHaveLength(2);
		expect(msgs[1].actions).toEqual([
			{ type: 'update-params', id: 'adj-1', params: { value: 0.7 } }
		]);

		scheduler.destroy();
	});
});
