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
	await editor.addAdjustment('seer.tone-curve');
	await editor.expectAdjustmentExists('seer.tone-curve');
	await editor.expectPipelineLength(1);
});

test('add Color Mixer and verify params', async ({ editor }) => {
	await editor.addAdjustment('seer.color-mixer');
	await editor.expectAdjustmentExists('seer.color-mixer');
	await editor.expectAdjustmentParams('seer.color-mixer', {
		saturation: { Float: 0 }
	});
});

test('add White Balance and verify params', async ({ editor }) => {
	await editor.addAdjustment('seer.white-balance');
	await editor.expectAdjustmentExists('seer.white-balance');
	await editor.expectAdjustmentParams('seer.white-balance', {
		temperature: { Float: 6500 },
		tint: { Float: 0 }
	});
});

test('add Denoise and verify params', async ({ editor }) => {
	await editor.addAdjustment('seer.denoise');
	await editor.expectAdjustmentExists('seer.denoise');
	await editor.expectAdjustmentParams('seer.denoise', {
		spatial_sigma: { Float: 1 },
		range_sigma: { Float: 0.1 },
		iterations: { Int: 1 }
	});
});

test('add Sharpen and verify params', async ({ editor }) => {
	await editor.addAdjustment('seer.sharpen');
	await editor.expectAdjustmentExists('seer.sharpen');
	await editor.expectAdjustmentParams('seer.sharpen', {
		radius: { Float: 1 },
		amount: { Float: 0 },
		threshold: { Float: 0 }
	});
});

test('add Clarity and verify params', async ({ editor }) => {
	await editor.addAdjustment('seer.clarity');
	await editor.expectAdjustmentExists('seer.clarity');
	await editor.expectAdjustmentParams('seer.clarity', {
		strength: { Float: 0 }
	});
});
