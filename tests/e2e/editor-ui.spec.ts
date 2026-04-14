/**
 * UI interaction E2E tests — verify actual DOM interactions with editor widgets.
 */
import { test, expect } from './ui-interaction-fixture';
import { Poll } from './lib/timeouts';

test.describe('Slider interaction', () => {
	test('drag slider changes param value', async ({ editor, ui }) => {
		await editor.addAdjustment('seer.white-balance');
		// Drag Temperature slider to ~80% position
		await ui.dragSlider('temperature', 0.8);
		// Verify state changed (Temperature default is 6500, range 2000-12000)
		const val = await ui.getParamValue('seer.white-balance', 'temperature');
		expect(val).toBeTruthy();
		// The Float value should be roughly 80% through the range: 2000 + 0.8 * 10000 = 10000
		if (val && typeof val === 'object' && 'Float' in val) {
			expect((val as { Float: number }).Float).toBeGreaterThan(8000);
			expect((val as { Float: number }).Float).toBeLessThan(12000);
		}
	});

	test('slider fill reflects current value', async ({ editor, ui }) => {
		await editor.addAdjustment('seer.white-balance');
		// Default Temperature is 6500, range 2000-12000 -> ratio = (6500-2000)/10000 = 0.45
		await ui.expectSliderFill('temperature', 0.45, 0.15);
	});
});

test.describe('Curve popup', () => {
	test('click trigger opens popup in viewport', async ({ editor, ui }) => {
		await editor.addAdjustment('seer.tone-curve');
		await ui.openCurvePopup('Master');
		await ui.expectPopupInViewport('popup-curve-popup');
		await ui.closePopup('popup-curve-backdrop');
	});

	test('popup has control point circles', async ({ editor, ui, page }) => {
		await editor.addAdjustment('seer.tone-curve');
		await ui.openCurvePopup('Master');
		// Default curve has 2 points (identity: 0,0 and 100,100)
		// Each point renders a <g> with a hit-area circle and a visual circle
		const pointGroups = page.locator('[data-testid="popup-curve-popup"] svg g.cursor-pointer');
		const count = await pointGroups.count();
		expect(count).toBeGreaterThanOrEqual(2);
		await ui.closePopup('popup-curve-backdrop');
	});
});

test.describe('Select popup', () => {
	test('select dropdown opens and selects', async ({ page }) => {
		await page.goto('/popup-select');
		await page.getByTestId('popup-select-trigger').click();
		await expect(page.getByTestId('popup-select-dropdown')).toBeVisible();
		await page.getByTestId('popup-select-option').nth(2).click();
		await expect(page.getByTestId('popup-select-dropdown')).not.toBeAttached();
	});
});

test.describe('End-to-end editing flow', () => {
	test('add tone curve via radial menu shows curve triggers', async ({ editor, ui, page }) => {
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'Tone Curve');
		await editor.expectAdjustmentExists('seer.tone-curve');
		// Tone Curve has 4 curve channels: Master, Red, Green, Blue
		// Each PopupCurve has a trigger button with aria-label="Edit <label>"
		const curveTriggers = page.locator('button[aria-label^="Edit "]');
		await expect(async () => {
			const count = await curveTriggers.count();
			expect(count).toBeGreaterThanOrEqual(4);
		}).toPass(Poll.action);
	});

	test('add white balance and drag slider', async ({ editor, ui }) => {
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'White Balance');
		await editor.expectAdjustmentExists('seer.white-balance');
		// Drag the temperature slider to 30%
		await ui.dragSlider('temperature', 0.3);
		// Verify state changed
		const val = (await ui.getParamValue('seer.white-balance', 'temperature')) as {
			Float: number;
		} | null;
		expect(val).toBeTruthy();
		// Temperature range is 2000-12000, so 30% -> ~5000
		if (val && 'Float' in val) {
			expect(val.Float).toBeGreaterThan(3000);
			expect(val.Float).toBeLessThan(6000);
		}
	});
});
