import { test, expect } from './editor-fixture';

test('canvas renders on page load', async ({ page, editor }) => {
	test.skip(!!process.env.CI, 'requires GPU');
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

test('add Tone Curve adjustment', async ({ editor }) => {
	await editor.addAdjustment('arami.tone-curve');
	await editor.expectAdjustmentExists('arami.tone-curve');
	await editor.expectPipelineLength(1);
});

test('add Color Mixer and verify params', async ({ editor }) => {
	await editor.addAdjustment('arami.color-mixer');
	await editor.expectAdjustmentExists('arami.color-mixer');
	await editor.expectAdjustmentParams('arami.color-mixer', {
		saturation: { Float: 0 }
	});
});

test('add White Balance and verify params', async ({ editor }) => {
	await editor.addAdjustment('arami.white-balance');
	await editor.expectAdjustmentExists('arami.white-balance');
	await editor.expectAdjustmentParams('arami.white-balance', {
		temperature: { Float: 6500 },
		tint: { Float: 0 }
	});
});

test('add Denoise and verify params', async ({ editor }) => {
	await editor.addAdjustment('arami.denoise');
	await editor.expectAdjustmentExists('arami.denoise');
	await editor.expectAdjustmentParams('arami.denoise', {
		spatial_sigma: { Float: 1 },
		range_sigma: { Float: 0.1 },
		iterations: { Int: 1 }
	});
});

test('add Sharpen and verify params', async ({ editor }) => {
	await editor.addAdjustment('arami.sharpen');
	await editor.expectAdjustmentExists('arami.sharpen');
	await editor.expectAdjustmentParams('arami.sharpen', {
		radius: { Float: 1 },
		amount: { Float: 0 },
		threshold: { Float: 0 }
	});
});

test('add Clarity and verify params', async ({ editor }) => {
	await editor.addAdjustment('arami.clarity');
	await editor.expectAdjustmentExists('arami.clarity');
	await editor.expectAdjustmentParams('arami.clarity', {
		strength: { Float: 0 }
	});
});
