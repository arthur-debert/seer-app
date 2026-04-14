/**
 * Test bridge — exposes app state to E2E tests via window.__testBridge.
 * Only active in DEV mode (import.meta.env.DEV).
 */

interface TestEvent {
	time: number;
	type: string;
	detail?: unknown;
}

interface ReadinessSignals {
	pipeline: boolean;
	wasm: boolean;
	viewer: boolean;
}

interface TestBridge {
	ready: ReadinessSignals;
	events: TestEvent[];
	emit: (type: string, detail?: unknown) => void;
	waitForEvent: (type: string) => Promise<TestEvent>;
}

const MAX_EVENTS = 200;

function createTestBridge(): TestBridge {
	const events: TestEvent[] = [];
	const listeners: Map<string, Array<(event: TestEvent) => void>> = new Map();

	return {
		ready: {
			pipeline: false,
			wasm: false,
			viewer: false
		},
		events,
		emit(type: string, detail?: unknown) {
			const event: TestEvent = { time: Date.now(), type, detail };
			events.push(event);
			if (events.length > MAX_EVENTS) events.shift();
			const fns = listeners.get(type);
			if (fns) {
				for (const fn of fns) fn(event);
				listeners.delete(type);
			}
		},
		waitForEvent(type: string): Promise<TestEvent> {
			return new Promise((resolve) => {
				const fns = listeners.get(type) ?? [];
				fns.push(resolve);
				listeners.set(type, fns);
			});
		}
	};
}

let bridge: TestBridge | null = null;

/**
 * Get or create the test bridge. Returns null in production builds.
 */
export function getTestBridge(): TestBridge | null {
	if (!import.meta.env.DEV) return null;
	if (!bridge) {
		bridge = createTestBridge();
		(window as unknown as Record<string, unknown>).__testBridge = bridge;
	}
	return bridge;
}

/**
 * Emit a test event. No-op in production. Lazily initializes the bridge.
 */
export function emitTestEvent(type: string, detail?: unknown): void {
	getTestBridge()?.emit(type, detail);
}

/**
 * Update a readiness signal. No-op in production. Lazily initializes the bridge.
 */
export function setTestReady(signal: keyof ReadinessSignals, value: boolean): void {
	const b = getTestBridge();
	if (b) b.ready[signal] = value;
}
