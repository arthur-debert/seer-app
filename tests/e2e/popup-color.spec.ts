import { test, expect } from './base-fixture';

test.beforeEach(async ({ page }) => {
	await page.goto('/popup-color');
	await page.waitForSelector('[data-testid="popup-color-page"]');
});

test('opens popup on trigger click', async ({ page }) => {
	await expect(page.locator('[data-testid="popup-color-popup"]')).toHaveCount(0);
	const trigger = page.locator('[data-testid="popup-color-trigger"]').first();
	await trigger.click();
	await expect(page.locator('[data-testid="popup-color-popup"]')).toBeVisible();
});

test('color wheel is visible in popup', async ({ page }) => {
	const trigger = page.locator('[data-testid="popup-color-trigger"]').first();
	await trigger.click();
	await expect(page.locator('[data-testid="popup-color-wheel"]')).toBeVisible();
});

test('clicking backdrop closes popup', async ({ page }) => {
	const trigger = page.locator('[data-testid="popup-color-trigger"]').first();
	await trigger.click();
	await expect(page.locator('[data-testid="popup-color-popup"]')).toBeVisible();

	await page.click('[data-testid="popup-color-backdrop"]', { position: { x: 1, y: 1 } });
	await expect(page.locator('[data-testid="popup-color-popup"]')).toHaveCount(0);
});

test('trigger swatch shows the current color', async ({ page }) => {
	const trigger = page.locator('[data-testid="popup-color-trigger"]').first();
	const bg = await trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
	// #3b82f6 = rgb(59, 130, 246)
	expect(bg).toBe('rgb(59, 130, 246)');
});
