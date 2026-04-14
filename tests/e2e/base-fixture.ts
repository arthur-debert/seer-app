/**
 * Shared Playwright fixture that captures console errors and page errors.
 * ALL test files should import { test, expect } from this module instead
 * of '@playwright/test' to get automatic error detection.
 */
import { test as base, expect } from '@playwright/test';

/** Patterns for known benign console errors (e.g. ORT WASM warnings). */
const IGNORED_PATTERNS = [
	'cpuid_info',
	'VerifyEachNodeIsAssignedToAnEp',
	'SharedArrayBuffer',
	'WebGPU',
	'GPUAdapter',
	'navigator.gpu',
	'the server responded with a status of 404'
];

function isIgnored(text: string): boolean {
	return IGNORED_PATTERNS.some((p) => text.includes(p));
}

export { expect };

export const test = base.extend<{ consoleErrors: string[] }>({
	consoleErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on('console', (msg) => {
				if (msg.type() === 'error' && !isIgnored(msg.text())) {
					errors.push(msg.text());
				}
			});
			page.on('pageerror', (err) => {
				if (!isIgnored(err.message)) {
					errors.push(`pageerror: ${err.message}`);
				}
			});
			await use(errors);
			// Auto-fail if unexpected errors occurred
			expect(errors).toEqual([]);
		},
		{ auto: true }
	]
});
