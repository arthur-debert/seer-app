/**
 * Mirror E2E test fixture — provides a MirrorHarness with state reads
 * and assertions for the dual-viewer sync behavior.
 */
import { test as base, expect } from './base-fixture';
import type { Page } from '@playwright/test';

export { expect };

interface ViewLayout {
	uv_offset: [number, number];
	uv_scale: [number, number];
}

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
		}).toPass({ timeout: 15_000, intervals: [500] });
	}

	async expectBothCanvasesVisible(): Promise<void> {
		const canvases = this.page.locator('canvas');
		await expect(canvases).toHaveCount(2, { timeout: 15_000 });
		for (const canvas of await canvases.all()) {
			await expect(canvas).toBeVisible();
			const box = await canvas.boundingBox();
			expect(box).toBeTruthy();
			expect(box!.width).toBeGreaterThan(0);
			expect(box!.height).toBeGreaterThan(0);
		}
	}

	async expectCanvasesSetup(): Promise<void> {
		// Wait for renderer.resize() to fire (replaces default 300px width)
		await this.page.waitForFunction(
			() => {
				const c = document.querySelector('canvas');
				return c && c.width !== 300;
			},
			null,
			{ timeout: 15_000 }
		);
	}

	async expectSideBySideLayout(): Promise<void> {
		const canvases = this.page.locator('canvas');
		await expect(canvases).toHaveCount(2, { timeout: 15_000 });
		const [left, right] = await canvases.all();
		const leftBox = (await left.boundingBox())!;
		const rightBox = (await right.boundingBox())!;
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
		}).toPass({ timeout: 5_000, intervals: [200] });
	}
}

export const test = base.extend<{ mirror: MirrorHarness }>({
	mirror: async ({ page }, use) => {
		const harness = new MirrorHarness(page);
		await use(harness);
	}
});
