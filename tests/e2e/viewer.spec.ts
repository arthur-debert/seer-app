import { test, expect } from './viewer-fixture';

test.describe('Viewer', () => {
	test.skip(!!process.env.CI, 'requires GPU');

	test('canvas renders on page load', async ({ page, viewer }) => {
		await page.goto('/viewer');
		await viewer.expectCanvasVisible();
	});

	test('no error message displayed', async ({ page, viewer }) => {
		await page.goto('/viewer');
		await viewer.expectCanvasVisible();
		await expect(page.locator('text=Error')).not.toBeVisible();
	});

	test('zoom: scroll wheel changes zoom_level', async ({ page, viewer }) => {
		await page.setViewportSize({ width: 50, height: 50 });
		await page.goto('/viewer');
		await viewer.expectCanvasVisible();
		await viewer.expectReady();

		const initialZoom = await viewer.getZoomLevel();
		const canvas = page.locator('canvas');
		await viewer.zoomIn(canvas);
		await viewer.expectZoomChanged(initialZoom);
	});

	test('pan: drag changes uv_offset when zoomed in', async ({ page, viewer }) => {
		await page.setViewportSize({ width: 50, height: 50 });
		await page.goto('/viewer');
		await viewer.expectCanvasVisible();
		await viewer.expectReady();

		await viewer.setZoomToMax();

		const layoutBefore = await viewer.getLayout();
		const canvas = page.locator('canvas');
		await viewer.drag(canvas, 15, 15);
		await viewer.expectOffsetChanged(layoutBefore.uv_offset);
	});

	test('resize: changing viewport updates zoom_percentage', async ({ page, viewer }) => {
		await page.setViewportSize({ width: 50, height: 50 });
		await page.goto('/viewer');
		await viewer.expectCanvasVisible();
		await viewer.expectReady();

		const before = await viewer.getZoomPercentage();
		await page.setViewportSize({ width: 200, height: 200 });
		await viewer.expectZoomPercentageChanged(before);
	});

	test('cursor: grab before drag, grabbing during drag', async ({ page, viewer }) => {
		await page.goto('/viewer');
		const canvas = page.locator('canvas');
		await viewer.expectCanvasVisible();
		await viewer.expectReady();

		// Before drag
		await expect(canvas).toHaveClass(/cursor-grab/, { timeout: 5_000 });

		// Start drag
		const box = (await canvas.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx + 10, cy + 10, { steps: 3 });

		await expect(canvas).toHaveClass(/cursor-grabbing/, { timeout: 5_000 });

		await page.mouse.up();
		await expect(canvas).toHaveClass(/cursor-grab/, { timeout: 5_000 });
	});
});
