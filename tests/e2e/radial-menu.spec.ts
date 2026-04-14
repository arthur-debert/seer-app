import { test, expect } from './base-fixture';

test.describe('RadialMenu', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/radial-menu');
		await expect(page.getByTestId('radial-page')).toBeVisible();
	});

	test('opens with correct number of items', async ({ page }) => {
		await page.getByTestId('trigger-right').click();
		const items = page.getByTestId('radial-item');
		await expect(items).toHaveCount(5);
	});

	test('clicking an item fires onSelect and closes menu', async ({ page }) => {
		await page.getByTestId('trigger-right').click();
		await expect(page.getByTestId('radial-bg')).toBeVisible();

		// Click the first item (White Balance)
		await page.getByTestId('radial-item').first().click();

		// Menu should close
		await expect(page.getByTestId('radial-bg')).not.toBeAttached();

		// Selection should be reported
		await expect(page.getByTestId('last-selected')).toBeVisible();
	});

	test('clicking backdrop closes menu without selecting', async ({ page }) => {
		await page.getByTestId('trigger-right').click();
		await expect(page.getByTestId('radial-bg')).toBeVisible();

		// Press Escape or click the backdrop far from any trigger button.
		// The backdrop is a fixed overlay; clicking at the very bottom-right
		// corner avoids hitting any trigger buttons underneath.
		const viewport = page.viewportSize()!;
		await page.getByTestId('radial-backdrop').click({
			position: { x: viewport.width - 5, y: viewport.height - 5 }
		});

		await expect(page.getByTestId('radial-bg')).not.toBeAttached();
	});

	for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
		test(`edge="${edge}" positions items in correct hemisphere`, async ({ page }) => {
			await page.getByTestId(`trigger-${edge}`).click();
			await expect(page.getByTestId('radial-bg')).toBeVisible();

			const items = page.getByTestId('radial-item');
			const count = await items.count();
			expect(count).toBe(5);

			// Get the background circle's center position
			const bg = page.getByTestId('radial-bg');
			const bgBox = await bg.boundingBox();
			expect(bgBox).not.toBeNull();
			const cx = bgBox!.x + bgBox!.width / 2;
			const cy = bgBox!.y + bgBox!.height / 2;

			// Check each item is in the correct hemisphere relative to center
			for (let i = 0; i < count; i++) {
				const itemBox = await items.nth(i).boundingBox();
				expect(itemBox).not.toBeNull();
				const ix = itemBox!.x + itemBox!.width / 2;
				const iy = itemBox!.y + itemBox!.height / 2;

				switch (edge) {
					case 'right':
						// Items should open to the LEFT of center
						expect(ix).toBeLessThanOrEqual(cx + 5);
						break;
					case 'left':
						// Items should open to the RIGHT of center
						expect(ix).toBeGreaterThanOrEqual(cx - 5);
						break;
					case 'top':
						// Items should open BELOW center
						expect(iy).toBeGreaterThanOrEqual(cy - 5);
						break;
					case 'bottom':
						// Items should open ABOVE center
						expect(iy).toBeLessThanOrEqual(cy + 5);
						break;
				}
			}
		});
	}

	test('items have aria-labels', async ({ page }) => {
		await page.getByTestId('trigger-right').click();
		const items = page.getByTestId('radial-item');
		const count = await items.count();
		for (let i = 0; i < count; i++) {
			const label = await items.nth(i).getAttribute('aria-label');
			expect(label).toBeTruthy();
		}
	});
});
