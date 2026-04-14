import { test, expect } from './editor-fixture';

test('canvas renders on page load', async ({ page, editor }) => {
	await editor.expectPipelineReady();
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	expect(box).toBeTruthy();
	expect(box!.width).toBeGreaterThan(0);
	expect(box!.height).toBeGreaterThan(0);
});

test('no errors after load', async ({ editor }) => {
	await editor.expectNoErrors();
});

test('pipeline is empty after load', async ({ editor }) => {
	await editor.expectPipelineLength(0);
});

const adjustmentDefaults = [
	{ id: 'seer.tone-curve', params: {} },
	{ id: 'seer.color-mixer', params: { saturation: { Float: 0 } } },
	{ id: 'seer.white-balance', params: { temperature: { Float: 6500 }, tint: { Float: 0 } } },
	{
		id: 'seer.denoise',
		params: { spatial_sigma: { Float: 1 }, range_sigma: { Float: 0.1 }, iterations: { Int: 1 } }
	},
	{
		id: 'seer.sharpen',
		params: { radius: { Float: 1 }, amount: { Float: 0 }, threshold: { Float: 0 } }
	},
	{ id: 'seer.clarity', params: { strength: { Float: 0 } } }
] as const;

for (const { id, params } of adjustmentDefaults) {
	test(`add ${id.replace('seer.', '')} and verify default params`, async ({ editor }) => {
		await editor.addAdjustment(id);
		await editor.expectAdjustmentExists(id);
		await editor.expectPipelineLength(1);
		if (Object.keys(params).length > 0) {
			await editor.expectAdjustmentParams(id, params as Record<string, unknown>);
		}
	});
}
