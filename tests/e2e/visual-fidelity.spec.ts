/**
 * Visual fidelity tests — assert computed styles of key UI components match
 * the prototype design specs (docs/prototypes/full-app.tsx).
 *
 * These tests run against the production Svelte app in light-mode to compare
 * with the light-mode prototype. They extract real browser-computed values
 * (sizes, spacing, colors, typography) and assert they match expected values
 * within acceptable tolerances.
 */
import { test, expect } from './editor-fixture';

// Helper: parse a CSS px value to a number
function px(v: string): number {
	return parseFloat(v.replace('px', ''));
}

// Helper: extract computed style properties from an element
async function getStyles(
	page: import('@playwright/test').Page,
	selector: string,
	props: string[]
): Promise<Record<string, string>> {
	return page.evaluate(
		({ sel, properties }) => {
			const el = document.querySelector(sel);
			if (!el) throw new Error(`Element not found: ${sel}`);
			const cs = getComputedStyle(el);
			const result: Record<string, string> = {};
			for (const p of properties) {
				result[p] = cs.getPropertyValue(p);
			}
			return result;
		},
		{ sel: selector, properties: props }
	);
}

// Helper: get bounding box dimensions
async function getBox(page: import('@playwright/test').Page, selector: string) {
	return page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) throw new Error(`Element not found: ${sel}`);
		const r = el.getBoundingClientRect();
		return { width: r.width, height: r.height, top: r.top, left: r.left };
	}, selector);
}

test.describe('Visual fidelity: Sidebar layout', () => {
	test('sidebar width is 192px (w-48)', async ({ editor, page }) => {
		// Wait for editor state
		await editor.expectPipelineReady();
		const box = await getBox(page, '[data-testid="pipeline-sidebar"]');
		expect(box.width).toBeCloseTo(192, 0);
	});
});

test.describe('Visual fidelity: NodePanel', () => {
	test('node card has no border-radius (flush cards)', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const styles = await getStyles(page, '[data-testid="node-panel"]', ['border-radius']);
		expect(px(styles['border-radius'])).toBe(0);
	});

	test('node header padding matches prototype (py-2.5 = 10px)', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const styles = await getStyles(page, '[data-testid="node-header"]', [
			'padding-top',
			'padding-bottom',
			'padding-left',
			'padding-right'
		]);
		expect(px(styles['padding-top'])).toBeCloseTo(10, 0); // py-2.5
		expect(px(styles['padding-bottom'])).toBeCloseTo(10, 0);
		expect(px(styles['padding-left'])).toBeCloseTo(12, 0); // px-3
		expect(px(styles['padding-right'])).toBeCloseTo(12, 0);
	});

	test('node header has bottom border', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const styles = await getStyles(page, '[data-testid="node-header"]', [
			'border-bottom-width',
			'border-bottom-style'
		]);
		expect(px(styles['border-bottom-width'])).toBeGreaterThanOrEqual(1);
		expect(styles['border-bottom-style']).toBe('solid');
	});

	test('node content has padding and gap matching prototype', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const styles = await getStyles(page, '[data-testid="node-content"]', [
			'padding-top',
			'padding-bottom',
			'padding-left',
			'padding-right',
			'gap'
		]);
		expect(px(styles['padding-top'])).toBeCloseTo(12, 0); // py-3
		expect(px(styles['padding-bottom'])).toBeCloseTo(12, 0);
		expect(px(styles['padding-left'])).toBeCloseTo(12, 0); // px-3
		expect(px(styles['padding-right'])).toBeCloseTo(12, 0);
		expect(px(styles['gap'])).toBeCloseTo(8, 0); // gap-2
	});

	test('node icon is 12px', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const box = await getBox(page, '[data-testid="node-icon"]');
		expect(box.width).toBeCloseTo(12, 0);
		expect(box.height).toBeCloseTo(12, 0);
	});

	test('bottom tab is small triangle (12x7)', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		await editor.addAdjustment('arami.tone-curve');
		// First node should have a bottom tab
		const tabSvg = page.locator('[data-testid="node-bottom-tab"] svg');
		const count = await tabSvg.count();
		expect(count).toBeGreaterThanOrEqual(1);
		const box = await tabSvg.first().boundingBox();
		expect(box).toBeTruthy();
		if (box) {
			expect(box.width).toBeCloseTo(12, 0);
			expect(box.height).toBeCloseTo(7, 0);
		}
	});
});

test.describe('Visual fidelity: PhaseGroup', () => {
	test('phase header has py-4 (16px) vertical padding', async ({ editor, page }) => {
		await editor.expectPipelineReady();
		const styles = await getStyles(page, '[data-testid="phase-header"]', [
			'padding-top',
			'padding-bottom'
		]);
		expect(px(styles['padding-top'])).toBeCloseTo(16, 0); // py-4
		expect(px(styles['padding-bottom'])).toBeCloseTo(16, 0);
	});

	test('empty phase shows Empty label', async ({ editor, page }) => {
		await editor.expectPipelineReady();
		// Zones phase should be empty initially
		const emptyLabel = page.locator('text=Empty');
		await expect(emptyLabel.first()).toBeVisible();
	});
});

test.describe('Visual fidelity: Slider', () => {
	test('slider value text is 9px', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const styles = await getStyles(page, '[data-testid="slider-value"]', ['font-size']);
		expect(px(styles['font-size'])).toBeCloseTo(9, 0);
	});

	test('slider track is 6px tall (h-1.5)', async ({ editor, page }) => {
		await editor.addAdjustment('arami.white-balance');
		const box = await getBox(page, '[data-testid="slider-track"]');
		expect(box.height).toBeCloseTo(6, 0);
	});
});

test.describe('Visual fidelity: Toggle', () => {
	test('toggle track is 24px wide (w-6)', async ({ page }) => {
		// Use components demo page which has a Toggle
		await page.goto('/components');
		const toggle = page.locator('[role="switch"]').first();
		await expect(toggle).toBeVisible({ timeout: 10_000 });
		const track = toggle.locator('div.rounded-full').first();
		const box = await track.boundingBox();
		expect(box).toBeTruthy();
		if (box) {
			expect(box.width).toBeCloseTo(24, 0);
			expect(box.height).toBeCloseTo(12, 0);
		}
	});
});

test.describe('Visual fidelity: MainToolbar', () => {
	test('toolbar buttons are 32px (h-8 w-8)', async ({ editor, page }) => {
		await editor.expectPipelineReady();
		const toolbar = page.getByTestId('main-toolbar');
		await expect(toolbar).toBeVisible();
		// Buttons inside toolbar
		const buttons = toolbar.locator('button');
		const count = await buttons.count();
		expect(count).toBeGreaterThanOrEqual(2);
		const box = await buttons.first().boundingBox();
		expect(box).toBeTruthy();
		if (box) {
			expect(box.width).toBeCloseTo(32, 1);
			expect(box.height).toBeCloseTo(32, 1);
		}
	});
});

test.describe('Visual fidelity: ViewSettingsToolbar', () => {
	test('settings toggle button is 32px', async ({ editor, page }) => {
		await editor.expectPipelineReady();
		const toolbar = page.getByTestId('view-settings-toolbar');
		await expect(toolbar).toBeVisible();
		const btn = toolbar.locator('button').first();
		const box = await btn.boundingBox();
		expect(box).toBeTruthy();
		if (box) {
			expect(box.width).toBeCloseTo(32, 1);
			expect(box.height).toBeCloseTo(32, 1);
		}
	});
});
