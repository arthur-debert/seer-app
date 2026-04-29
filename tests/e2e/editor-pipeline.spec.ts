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

	await test.step('verify canvas renders', async () => {
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible();
		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.width).toBeGreaterThan(0);
	});

	await test.step('verify pipeline is clean', async () => {
		await editor.expectNoErrors();
	});

	await test.step('build adaptive BW pipeline', async () => {
		await editor.addAdjustment('seer.monochrome');
		await editor.addAdjustment('seer.clahe');
		await editor.addAdjustment('seer.tone-curve');
		await editor.addZone('seer.zone.segmentation');
	});

	await test.step('verify pipeline structure', async () => {
		const state = await editor.getState();
		expect(state.adjustments).toHaveLength(3);
		expect(state.adjustments.map((a) => a.plugin_id)).toEqual([
			'seer.monochrome',
			'seer.clahe',
			'seer.tone-curve'
		]);
		expect(state.zones.length).toBeGreaterThan(0);
	});

	await test.step('wait for segmentation', async () => {
		await editor.expectLogContains('[editor] segmentation complete');
	});

	await test.step('verify pipeline stages completed', async () => {
		await editor.expectLogContains('[editor] edit graph created');
		await editor.expectLogContains('[editor] pipeline evaluated');
		await expect(page.getByText('Analyzing image')).not.toBeVisible({ timeout: 2_000 });
	});
});
