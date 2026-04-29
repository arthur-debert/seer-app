/**
 * Mirror E2E test fixture — provides a MirrorHarness with state reads
 * and assertions for the dual-viewer sync behavior.
 */
import { test as base, expect } from './base-fixture';
import type { Page } from '@playwright/test';
import type { ViewLayout } from './lib/types';
import { Poll, Timeouts } from './lib/timeouts';
import { requireBox } from './lib/helpers';

export { expect };

class MirrorHarness {
	constructor(private page: Page) {}

	// --- State reads ---

	async getZoomLevel(side: 'left' | 'right'): Promise<number> {
		return this.page.evaluate(
			(s) =>
				(
					(window as unknown as Record<string, unknown>).__mirrorState as Record<
						string,
						{ zoom_level(): number }
					>
				)[s].zoom_level(),
			side
		);
	}

	async getLayout(side: 'left' | 'right'): Promise<ViewLayout> {
		return this.page.evaluate(
			(s) =>
				(
					(window as unknown as Record<string, unknown>).__mirrorState as Record<
						string,
						{ layout(): ViewLayout }
					>
				)[s].layout(),
			side
		);
	}

	// --- Assertions ---

	async expectReady(): Promise<void> {
		await expect(async () => {
			const hasState = await this.page.evaluate(
				() => !!(window as unknown as Record<string, unknown>).__mirrorState
			);
			expect(hasState).toBe(true);
		}).toPass(Poll.pipeline);
	}

	async expectBothCanvasesVisible(): Promise<void> {
		const canvases = this.page.locator('canvas');
		await expect(canvases).toHaveCount(2, { timeout: Timeouts.pipeline });
		for (const canvas of await canvases.all()) {
			await expect(canvas).toBeVisible();
			const box = await canvas.boundingBox();
			expect(box).toBeTruthy();
			expect(box!.width).toBeGreaterThan(0);
			expect(box!.height).toBeGreaterThan(0);
		}
	}

	async expectCanvasesSetup(): Promise<void> {
		// Wait for renderer.resize() to fire — default Playwright canvas width is 300px
		await this.page.waitForFunction(
			() => {
				const c = document.querySelector('canvas');
				return c && c.width !== 300; // 300 = default HTML canvas width before resize
			},
			null,
			{ timeout: Timeouts.pipeline }
		);
	}

	async expectSideBySideLayout(): Promise<void> {
		const canvases = this.page.locator('canvas');
		await expect(canvases).toHaveCount(2, { timeout: Timeouts.pipeline });
		const [left, right] = await canvases.all();
		const leftBox = await requireBox(left, 'left mirror canvas');
		const rightBox = await requireBox(right, 'right mirror canvas');
		expect(leftBox.x).toBeLessThan(rightBox.x);

		const viewport = this.page.viewportSize()!;
		const expectedHalf = viewport.width / 2;
		expect(leftBox.width).toBeGreaterThan(expectedHalf * 0.8);
		expect(leftBox.width).toBeLessThan(expectedHalf * 1.2);
		expect(rightBox.width).toBeGreaterThan(expectedHalf * 0.8);
		expect(rightBox.width).toBeLessThan(expectedHalf * 1.2);
	}

	async expectSynced(): Promise<void> {
		await expect(async () => {
			const leftZoom = await this.getZoomLevel('left');
			const rightZoom = await this.getZoomLevel('right');
			expect(leftZoom).toBeCloseTo(rightZoom, 3);
		}).toPass(Poll.fast);
	}
}

export const test = base.extend<{ mirror: MirrorHarness }>({
	mirror: async ({ page }, use) => {
		const harness = new MirrorHarness(page);
		await use(harness);
	}
});
