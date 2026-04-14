import type { Page, TestInfo } from '@playwright/test';
import type { EditorState } from './types';

/**
 * Attach diagnostic information to the current test on failure.
 * Call this in fixture teardown or in a test's catch block.
 */
export async function attachDiagnostics(page: Page, testInfo: TestInfo): Promise<void> {
	if (testInfo.status === testInfo.expectedStatus) return; // only on failure

	// 1. Screenshot
	try {
		const screenshot = await page.screenshot({ fullPage: true });
		await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' });
	} catch {
		// page may already be closed
	}

	// 2. Editor state dump
	try {
		const state = await page.evaluate(
			() => (window as unknown as { __editorState?: unknown }).__editorState
		);
		if (state) {
			await testInfo.attach('editor-state', {
				body: JSON.stringify(state, null, 2),
				contentType: 'application/json'
			});
		}
	} catch {
		// page may be navigated away
	}

	// 3. Console log buffer
	// (logs are captured by the fixture and passed in; this is a fallback)
	try {
		const url = page.url();
		await testInfo.attach('page-url', { body: url, contentType: 'text/plain' });
	} catch {
		// ignore
	}
}

/**
 * Attach console logs captured during the test.
 */
export async function attachConsoleLogs(logs: string[], testInfo: TestInfo): Promise<void> {
	if (testInfo.status === testInfo.expectedStatus) return;
	if (logs.length === 0) return;

	await testInfo.attach('console-logs', {
		body: logs.join('\n'),
		contentType: 'text/plain'
	});
}

/**
 * Attach error logs captured during the test.
 */
export async function attachErrorLogs(errors: string[], testInfo: TestInfo): Promise<void> {
	if (errors.length === 0) return;

	await testInfo.attach('console-errors', {
		body: errors.join('\n'),
		contentType: 'text/plain'
	});
}

/**
 * Format editor state for inline error messages.
 * Returns a short summary suitable for expect() error context.
 */
export function summarizeState(state: EditorState): string {
	const parts: string[] = [];
	parts.push(`adjustments: [${state.adjustments.map((a) => a.plugin_id).join(', ')}]`);
	parts.push(`geometry: [${state.geometry.map((g) => g.plugin_id).join(', ')}]`);
	parts.push(`zones: [${state.zones.map((z) => z.kind).join(', ')}]`);
	parts.push(`exports: ${state.exportGroups.length}`);
	if (state.evalError) parts.push(`evalError: ${state.evalError.error}`);
	if (state.error) parts.push(`error: ${state.error}`);
	parts.push(
		`imageSize: ${state.imageSize ? `${state.imageSize.width}x${state.imageSize.height}` : 'null'}`
	);
	parts.push(`undo=${state.canUndo} redo=${state.canRedo} leaf=${state.isAtLeaf}`);
	return parts.join(' | ');
}
