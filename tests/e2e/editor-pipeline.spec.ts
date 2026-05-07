import { test, expect } from './editor-fixture';

test('full pipeline: load → BW → segmentation → render', async ({ page, editor }) => {
	// Requires WebGPU + SegFormer ONNX model (gitignored, run scripts/fetch-segformer-model.sh)
	test.skip(!!process.env.CI, 'requires GPU');

	const modelAvailable = await page.evaluate(async () => {
		try {
			const res = await fetch('/models/segformer-b0-ade-512.onnx', { method: 'HEAD' });
			return res.ok;
		} catch {
			return false;
		}
	});
	test.skip(!modelAvailable, 'requires SegFormer model (run scripts/fetch-segformer-model.sh)');

	test.setTimeout(90_000);

	// 1. Canvas renders
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	expect(box).toBeTruthy();
	expect(box!.width).toBeGreaterThan(0);

	// 2. Pipeline is ready (no adjustments yet, just source image)
	await editor.expectNoErrors();

	// 3. Apply the Adaptive BW combo: monochrome + CLAHE + tone curve + semantic zone
	await editor.addAdjustment('arami.monochrome');
	await editor.addAdjustment('arami.clahe');
	await editor.addAdjustment('arami.tone-curve');
	await editor.addZone('arami.zone.segmentation');

	// 4. Wait for segmentation to complete
	await editor.expectLogContains('[editor] segmentation complete');

	// 5. Verify structured logs confirm each pipeline stage ran
	await editor.expectLogContains('[editor] edit graph created');
	await editor.expectLogContains('[editor] pipeline evaluated');

	// 6. "Analyzing image..." status bar must be gone
	await expect(page.getByText('Analyzing image')).not.toBeVisible({ timeout: 2_000 });
});
