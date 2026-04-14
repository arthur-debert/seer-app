import { test, expect } from './base-fixture';

test.beforeEach(async ({ page }) => {
	await page.goto('/popup-select');
	await page.waitForSelector('[data-testid="popup-select-page"]');
});

test('opens dropdown on trigger click', async ({ page }) => {
	await expect(page.locator('[data-testid="popup-select-dropdown"]')).toHaveCount(0);
	await page.click('[data-testid="popup-select-trigger"]');
	await expect(page.locator('[data-testid="popup-select-dropdown"]')).toBeVisible();
});

test('shows correct number of options', async ({ page }) => {
	await page.click('[data-testid="popup-select-trigger"]');
	const options = page.locator('[data-testid="popup-select-option"]');
	await expect(options).toHaveCount(4);
});

test('clicking option updates selected value and closes popup', async ({ page }) => {
	await page.click('[data-testid="popup-select-trigger"]');
	// Click the "16:9" option (4th one)
	const options = page.locator('[data-testid="popup-select-option"]');
	await options.nth(3).click();

	// Popup should close
	await expect(page.locator('[data-testid="popup-select-dropdown"]')).toHaveCount(0);

	// Selected value should update
	await expect(page.locator('[data-testid="selected-value"]')).toHaveText('16:9');
});

test('clicking backdrop closes popup', async ({ page }) => {
	await page.click('[data-testid="popup-select-trigger"]');
	await expect(page.locator('[data-testid="popup-select-dropdown"]')).toBeVisible();

	// Click the backdrop
	await page.click('[data-testid="popup-select-backdrop"]', { position: { x: 1, y: 1 } });

	await expect(page.locator('[data-testid="popup-select-dropdown"]')).toHaveCount(0);
});

test('selected option has correct visual styling', async ({ page }) => {
	await page.click('[data-testid="popup-select-trigger"]');

	// The default selected value is "4:3" which is the 2nd option
	const selectedOption = page.locator('[data-testid="popup-select-option"][data-selected="true"]');
	await expect(selectedOption).toHaveCount(1);
	await expect(selectedOption).toHaveText('4:3');
});
