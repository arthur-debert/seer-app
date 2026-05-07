import { test, expect } from './editor-fixture';

/**
 * E2E tests for the Crop geometry node and canvas overlay system.
 */
test.describe('Crop geometry', () => {
	test('add Crop node appears in geometry', async ({ editor }) => {
		await editor.addGeometry('arami.crop');
		await editor.expectGeometryExists('arami.crop');
	});

	test('selecting Crop shows overlay', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');
		await expect(page.locator('mask#crop-mask')).toBeAttached({ timeout: 5_000 });
	});

	test('Crop controls visible in edit panel', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');
		await editor.selectGeometryByPlugin('arami.crop');

		await expect(page.locator('[data-testid="crop-ratio-select"]')).toBeVisible({
			timeout: 5_000
		});
		await expect(page.getByRole('button', { name: 'Landscape' })).toBeVisible();
		await expect(page.getByText('Thirds')).toBeVisible();
		await expect(page.getByText(/X:/)).toBeVisible();
		await expect(page.getByText(/W:/)).toBeVisible();
	});

	test('overlay sets crop params matching frame ratio', async ({ editor }) => {
		await editor.addGeometry('arami.crop');
		await editor.expectCropRatio(4 / 3);
	});

	test('orientation toggle switches landscape/portrait', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');

		const landscapeBtn = page.getByRole('button', { name: 'Landscape' });
		await expect(landscapeBtn).toBeVisible({ timeout: 5_000 });
		await landscapeBtn.click();

		await expect(page.getByRole('button', { name: 'Portrait' })).toBeVisible({ timeout: 5_000 });

		// Portrait = 3:4, so height/width = 4/3
		await expect(async () => {
			const params = await editor.getCropParams();
			expect(params).toBeTruthy();
			expect(params!.height / params!.width).toBeCloseTo(4 / 3, 1);
		}).toPass({ timeout: 15_000, intervals: [500] });
	});

	test('thirds toggle shows and hides grid lines', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');

		// Scope to the crop overlay SVG to avoid matching icon SVGs
		const overlayLines = page.locator('[data-testid="crop-overlay"] line');

		await expect(overlayLines).toHaveCount(0, { timeout: 5_000 });

		await page.getByLabel('Thirds').check();
		await expect(overlayLines).toHaveCount(4, { timeout: 15_000 });

		await page.getByLabel('Thirds').uncheck();
		await expect(overlayLines).toHaveCount(0, { timeout: 15_000 });
	});

	test('deselecting Crop removes overlay', async ({ page, editor }) => {
		await editor.addAdjustment('arami.white-balance');
		await editor.addGeometry('arami.crop');

		await expect(page.locator('mask#crop-mask')).toBeAttached({ timeout: 5_000 });

		await editor.selectAdjustmentByPlugin('arami.white-balance');
		await expect(page.locator('mask#crop-mask')).not.toBeAttached({ timeout: 5_000 });
	});

	test('undo removes Crop and overlay', async ({ page, editor }) => {
		test.setTimeout(60_000);

		await editor.addGeometry('arami.crop');

		await page.locator('canvas').click();

		await expect(async () => {
			await editor.undo();
			const state = await editor.getState();
			expect(state.geometry.some((g) => g.plugin_id === 'arami.crop')).toBe(false);
		}).toPass({ timeout: 15_000, intervals: [500] });

		await expect(page.locator('mask#crop-mask')).not.toBeAttached({ timeout: 5_000 });

		await expect(async () => {
			await editor.redo();
			const state = await editor.getState();
			expect(state.geometry.some((g) => g.plugin_id === 'arami.crop')).toBe(true);
		}).toPass({ timeout: 15_000, intervals: [500] });
		await expect(page.locator('mask#crop-mask')).toBeAttached({ timeout: 5_000 });
	});

	test('crop frame border is rendered in SVG', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');

		const frameBorder = page.locator('svg rect[stroke="white"][fill="none"]');
		await expect(frameBorder).toBeAttached({ timeout: 5_000 });

		const width = await frameBorder.getAttribute('width');
		const height = await frameBorder.getAttribute('height');
		expect(Number(width)).toBeGreaterThan(0);
		expect(Number(height)).toBeGreaterThan(0);
	});

	test('ratio selector options are available', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');

		const ratioSelect = page.locator('[data-testid="crop-ratio-select"]');
		const options = ratioSelect.locator('option');

		await expect(options).toHaveCount(6); // 1:1, 4:3, 3:2, 16:9, 5:4, 7:5
		await expect(options.nth(0)).toHaveText('1:1');
		await expect(options.nth(1)).toHaveText('4:3');
		await expect(options.nth(2)).toHaveText('3:2');
		await expect(options.nth(3)).toHaveText('16:9');
	});

	test('switching ratio updates crop dimensions', async ({ page, editor }) => {
		await editor.addGeometry('arami.crop');

		// Wait for initial 4:3 crop
		await editor.expectCropRatio(4 / 3);

		// Switch to 1:1
		await page.locator('[data-testid="crop-ratio-select"]').selectOption({ index: 0 });
		await editor.expectCropRatio(1.0);
	});

	test('removing Crop cleans up overlay', async ({ page, editor }) => {
		test.setTimeout(60_000);
		await editor.addGeometry('arami.crop');

		page.on('dialog', (dialog) => dialog.accept());

		const state = await editor.getState();
		const cropNode = state.geometry.find((g) => g.plugin_id === 'arami.crop');
		await page.evaluate(
			(id) =>
				(
					window as unknown as { __editorActions: { removeAdjustment: (id: string) => void } }
				).__editorActions.removeAdjustment(id),
			cropNode!.id
		);

		await editor.expectGeometryNotExists('arami.crop');
		await expect(page.locator('mask#crop-mask')).not.toBeAttached({ timeout: 5_000 });
	});
});
