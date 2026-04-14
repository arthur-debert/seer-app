/**
 * Viewer E2E test fixture — provides a ViewerHarness with state reads, actions,
 * and assertions that go through __viewerState instead of raw page.evaluate().
 */
import { test as base, expect } from './base-fixture';
import type { Page } from '@playwright/test';

export { expect };

interface ViewLayout {
	uv_offset: [number, number];
	uv_scale: [number, number];
}

interface VisibleRect {
	origin: { x: number; y: number };
	size: { width: number; height: number };
}

class ViewerHarness {
	constructor(private page: Page) {}

	// --- State reads ---

	async getZoomLevel(): Promise<number> {
		return this.page.evaluate(() =>
			(
				(window as unknown as Record<string, unknown>).__viewerState as {
					zoom_level(): number;
				}
			).zoom_level()
		);
	}

	async getZoomPercentage(): Promise<number> {
		return this.page.evaluate(() =>
			(
				(window as unknown as Record<string, unknown>).__viewerState as {
					zoom_percentage(): number;
				}
			).zoom_percentage()
		);
	}

	async getLayout(): Promise<ViewLayout> {
		return this.page.evaluate(() =>
			(
				(window as unknown as Record<string, unknown>).__viewerState as {
					layout(): ViewLayout;
				}
			).layout()
		);
	}

	async getVisibleRect(): Promise<VisibleRect> {
		return this.page.evaluate(() =>
			(
				(window as unknown as Record<string, unknown>).__viewerState as {
					visible_rect(): VisibleRect;
				}
			).visible_rect()
		);
	}

	// --- Actions ---

	async setZoomToMax(): Promise<void> {
		await this.page.evaluate(() => {
			const vs = (window as unknown as Record<string, unknown>).__viewerState as {
				set_zoom(z: number): unknown;
				max_zoom(): number;
			};
			vs.set_zoom(vs.max_zoom());
		});
	}

	async zoomIn(canvas: ReturnType<Page['locator']>): Promise<void> {
		const box = (await canvas.boundingBox())!;
		await canvas.dispatchEvent('wheel', {
			deltaY: -300,
			clientX: box.x + box.width / 2,
			clientY: box.y + box.height / 2
		});
	}

	async drag(canvas: ReturnType<Page['locator']>, dx: number, dy: number): Promise<void> {
		const box = (await canvas.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await this.page.mouse.move(cx, cy);
		await this.page.mouse.down();
		await this.page.mouse.move(cx + dx, cy + dy, { steps: 5 });
		await this.page.mouse.up();
	}

	// --- Assertions ---

	async expectReady(): Promise<void> {
		await expect(async () => {
			const hasState = await this.page.evaluate(
				() => !!(window as unknown as Record<string, unknown>).__viewerState
			);
			expect(hasState).toBe(true);
		}).toPass({ timeout: 15_000, intervals: [500] });
	}

	async expectCanvasVisible(): Promise<void> {
		const canvas = this.page.locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 10_000 });
		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.width).toBeGreaterThan(0);
		expect(box!.height).toBeGreaterThan(0);
	}

	async expectZoomChanged(previousZoom: number): Promise<void> {
		await expect(async () => {
			const current = await this.getZoomLevel();
			expect(current).not.toBeCloseTo(previousZoom, 1);
		}).toPass({ timeout: 5_000, intervals: [200] });
	}

	async expectOffsetChanged(previousOffset: [number, number]): Promise<void> {
		await expect(async () => {
			const layout = await this.getLayout();
			const changed =
				Math.abs(layout.uv_offset[0] - previousOffset[0]) > 1e-6 ||
				Math.abs(layout.uv_offset[1] - previousOffset[1]) > 1e-6;
			expect(changed).toBe(true);
		}).toPass({ timeout: 5_000, intervals: [200] });
	}

	async expectZoomPercentageChanged(previousPct: number): Promise<void> {
		await expect(async () => {
			const current = await this.getZoomPercentage();
			expect(current).not.toBeCloseTo(previousPct, 0);
		}).toPass({ timeout: 5_000, intervals: [200] });
	}
}

export const test = base.extend<{ viewer: ViewerHarness }>({
	viewer: async ({ page }, use) => {
		const harness = new ViewerHarness(page);
		await use(harness);
	}
});
