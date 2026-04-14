import { test, expect } from './editor-fixture';

test.describe('Editor History Panel', () => {
	test('history shows Open Image after load', async ({ page, editor }) => {
		await editor.expectPipelineReady();
		await editor.openHistory();
		await expect(page.getByText('Open Image')).toBeVisible({ timeout: 5_000 });
	});

	test('adding adjustments creates history entries', async ({ page, editor }) => {
		await editor.openHistory();
		await editor.addAdjustment('seer.white-balance');
		// History entry label is "Add White Balance" (set by Rust add_adjustment)
		await expect(page.getByText('Add White Balance')).toBeVisible({ timeout: 5_000 });

		await editor.addAdjustment('seer.tone-curve');
		await editor.expectPipelineLength(2);
		await expect(page.getByText('Add Tone Curve')).toBeVisible({ timeout: 5_000 });
	});

	test('Cmd-Z undoes and Cmd-Shift-Z redoes', async ({ editor }) => {
		await editor.addAdjustment('seer.white-balance');
		await editor.addAdjustment('seer.tone-curve');
		await editor.expectPipelineLength(2);

		// Undo: ToneCurve should disappear
		await editor.undo();
		await editor.expectAdjustmentNotExists('seer.tone-curve');
		await editor.expectAdjustmentExists('seer.white-balance');

		// Redo: ToneCurve should reappear
		await editor.redo();
		await editor.expectAdjustmentExists('seer.tone-curve');
	});

	test('click history entry to jump — forward entries stay visible but dimmed', async ({
		page,
		editor
	}) => {
		await editor.openHistory();
		await editor.addAdjustment('seer.white-balance');
		await editor.addAdjustment('seer.tone-curve');

		// Click "Open Image" entry to jump to root
		await page.getByText('Open Image').click();
		await editor.expectAdjustmentNotExists('seer.white-balance');
		await editor.expectPipelineLength(0);

		// Forward entries should still be visible in history
		await expect(page.getByText('Add White Balance')).toBeVisible();

		// State confirms we're not at the leaf and forward history exists
		await expect(async () => {
			const state = await editor.getState();
			expect(state.fullPath.length).toBeGreaterThanOrEqual(3);
		}).toPass({ timeout: 5_000, intervals: [200] });
		await editor.expectAtLeaf(false);

		// Click forward entry to jump back to leaf
		await page.getByText('Add Tone Curve').click();
		await editor.expectAdjustmentExists('seer.tone-curve');
		await editor.expectAtLeaf(true);
	});

	test('editing at non-leaf shows confirm dialog', async ({ page, editor }) => {
		await editor.openHistory();
		await editor.addAdjustment('seer.white-balance');

		// Jump back to root
		await page.getByText('Open Image').click();
		await editor.expectAdjustmentNotExists('seer.white-balance');

		// Dismiss the confirm dialog to cancel
		page.once('dialog', (dialog) => dialog.dismiss());
		await page.evaluate(() =>
			(
				window as unknown as { __editorActions: { addAdjustment: (id: string) => void } }
			).__editorActions.addAdjustment('seer.tone-curve')
		);
		// ToneCurve should NOT appear (dialog was dismissed)
		await expect(async () => {
			const state = await editor.getState();
			expect(state.adjustments.some((a) => a.plugin_id === 'seer.tone-curve')).toBe(false);
		}).toPass({ timeout: 2_000, intervals: [200] });

		// Accept the confirm dialog
		page.once('dialog', (dialog) => dialog.accept());
		await page.evaluate(() =>
			(
				window as unknown as { __editorActions: { addAdjustment: (id: string) => void } }
			).__editorActions.addAdjustment('seer.tone-curve')
		);
		await editor.expectAdjustmentExists('seer.tone-curve');

		// Forward history (WhiteBalance) should be gone
		const state = await editor.getState();
		expect(state.isAtLeaf).toBe(true);
	});

	test('canUndo and canRedo state', async ({ editor }) => {
		// Add adjustment
		await editor.addAdjustment('seer.white-balance');
		await editor.expectUndoRedo(true, false);

		// Undo
		await editor.undo();
		await editor.expectAdjustmentNotExists('seer.white-balance');
		// Can still undo (Open Image), and can now redo
		await editor.expectUndoRedo(true, true);

		// Redo
		await editor.redo();
		await editor.expectAdjustmentExists('seer.white-balance');
		await editor.expectUndoRedo(true, false);
	});

	test('create and delete tag', async ({ page, editor }) => {
		await editor.openHistory();
		await editor.addAdjustment('seer.white-balance');

		// Click "+" button on head entry to create tag (use exact match)
		await page.getByRole('button', { name: 'Add tag', exact: true }).click();
		const input = page.locator('input[placeholder="Tag name..."]');
		await expect(input).toBeVisible({ timeout: 2_000 });
		await input.fill('baseline');
		await input.press('Enter');

		// Tag badge should appear
		await expect(page.getByText('baseline')).toBeVisible({ timeout: 5_000 });

		// Delete tag (use exact match)
		await page.getByRole('button', { name: 'Remove tag baseline', exact: true }).click();
		await expect(page.getByText('baseline')).not.toBeVisible({ timeout: 5_000 });
	});

	test('filter toggle shows only tagged entries', async ({ page, editor }) => {
		await editor.openHistory();
		await editor.addAdjustment('seer.white-balance');
		await editor.addAdjustment('seer.tone-curve');

		// Tag the current head (use exact match)
		await page.getByRole('button', { name: 'Add tag', exact: true }).click();
		const input = page.locator('input[placeholder="Tag name..."]');
		await input.fill('checkpoint');
		await input.press('Enter');
		await expect(page.getByText('checkpoint')).toBeVisible({ timeout: 5_000 });

		// Switch to "Named" filter
		await page.getByRole('button', { name: 'Named' }).click();

		// Only the tagged entry should be in the DOM; non-tagged entries should be removed
		await expect(page.getByText('Add Tone Curve')).toBeAttached({ timeout: 5_000 });
		await expect(page.getByText('Open Image')).not.toBeAttached({ timeout: 2_000 });
		await expect(page.getByText('Add White Balance')).not.toBeAttached();

		// Switch back to "All"
		await page.getByRole('button', { name: 'All' }).click();
		await expect(page.getByText('Open Image')).toBeVisible({ timeout: 2_000 });
	});
});
