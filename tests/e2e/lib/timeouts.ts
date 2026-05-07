/** Tiered timeout constants for E2E tests. Use these instead of magic numbers. */
export const Timeouts = {
	/** DOM visibility, simple state checks (5s) */
	fast: 5_000,
	/** State mutations after user actions — add adjustment, undo, slider drag (10s) */
	action: 10_000,
	/** Heavy operations — WASM pipeline init, image load, first render (30s) */
	pipeline: 30_000,
	/** GPU rendering, segmentation, multi-step composite pipelines (60s) */
	heavy: 60_000
} as const;

/** Progressive backoff polling intervals (ms). Playwright's .toPass() accepts these arrays. */
export const PollIntervals = {
	/** Fast state checks — in-memory state reads via page.evaluate() */
	state: [100, 200, 200, 500, 500, 1000],
	/** Render/pipeline checks — WASM evaluation, canvas redraws */
	render: [200, 500, 500, 1000, 1000, 2000]
} as const;

/** Convenience: { timeout, intervals } objects for .toPass() */
export const Poll = {
	fast: { timeout: Timeouts.fast, intervals: [...PollIntervals.state] },
	action: { timeout: Timeouts.action, intervals: [...PollIntervals.state] },
	pipeline: { timeout: Timeouts.pipeline, intervals: [...PollIntervals.render] },
	heavy: { timeout: Timeouts.heavy, intervals: [...PollIntervals.render] }
};
