import { test, expect } from './mirror-fixture';

test.describe('Mirror', () => {
	test('both canvases render on page load', async ({ page, mirror }) => {
		await page.goto('/mirror');
		await mirror.expectBothCanvasesVisible();
	});

	test('no error message displayed', async ({ page, mirror }) => {
		await page.goto('/mirror');
		await mirror.expectBothCanvasesVisible();
		await expect(page.locator('text=Error')).not.toBeVisible();
	});

	test('canvases are side-by-side, each roughly 50% width', async ({ page, mirror }) => {
		await page.goto('/mirror');
		await mirror.expectSideBySideLayout();
	});

	test('both viewers start synced', async ({ page, mirror }) => {
		await page.goto('/mirror');
		await mirror.expectBothCanvasesVisible();
		await mirror.expectReady();
		await mirror.expectSynced();
	});

	test('cursor: grab before drag, grabbing during drag', async ({ page, mirror }) => {
		await page.goto('/mirror');
		await mirror.expectBothCanvasesVisible();
		await mirror.expectCanvasesSetup();

		const leftCanvas = page.locator('canvas').first();
		await expect(leftCanvas).toHaveClass(/cursor-grab/, { timeout: 5_000 });

		const box = (await leftCanvas.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx + 10, cy + 10, { steps: 3 });

		await expect(leftCanvas).toHaveClass(/cursor-grabbing/, { timeout: 5_000 });

		await page.mouse.up();
		await expect(leftCanvas).toHaveClass(/cursor-grab/, { timeout: 5_000 });
	});
});
