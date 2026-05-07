import { test, expect } from './editor-fixture';
import { Poll } from './lib/timeouts';

test.describe('Editor History Panel', () => {
	test('history shows Open Image after load', async ({ page, editor }) => {
		await editor.expectPipelineReady();
		await editor.openHistory();
		await expect(page.getByText('Open Image')).toBeVisible({ timeout: 5_000 });
	});

	test('adding adjustments creates history entries', async ({ page, editor }) => {
		await editor.openHistory();
		await editor.addAdjustment('arami.white-balance');
		// History entry label is "Add White Balance" (set by Rust add_adjustment)
		await expect(page.getByText('Add White Balance')).toBeVisible({ timeout: 5_000 });

		await editor.addAdjustment('arami.tone-curve');
		await editor.expectPipelineLength(2);
		await expect(page.getByText('Add Tone Curve')).toBeVisible({ timeout: 5_000 });
	});

	test('Cmd-Z undoes and Cmd-Shift-Z redoes', async ({ editor }) => {
		await editor.addAdjustment('arami.white-balance');
		await editor.addAdjustment('arami.tone-curve');
		await editor.expectPipelineLength(2);

		// Undo: ToneCurve should disappear
		await editor.undo();
		await editor.expectAdjustmentNotExists('arami.tone-curve');
		await editor.expectAdjustmentExists('arami.white-balance');

		// Redo: ToneCurve should reappear
		await editor.redo();
		await editor.expectAdjustmentExists('arami.tone-curve');
	});

	test('click history entry to jump — forward entries stay visible but dimmed', async ({
		page,
		editor
	}) => {
		await test.step('set up pipeline with two adjustments', async () => {
			await editor.openHistory();
			await editor.addAdjustment('arami.white-balance');
			await editor.addAdjustment('arami.tone-curve');
		});

		await test.step('jump to root via history click', async () => {
			await page.getByText('Open Image').click();
			await editor.expectAdjustmentNotExists('arami.white-balance');
			await editor.expectPipelineLength(0);
		});

		await test.step('verify forward entries remain visible', async () => {
			await expect(page.getByText('Add White Balance')).toBeVisible();
			await expect(async () => {
				const state = await editor.getState();
				expect(state.fullPath.length).toBeGreaterThanOrEqual(3);
			}).toPass(Poll.fast);
			await editor.expectAtLeaf(false);
		});

		await test.step('jump forward to leaf', async () => {
			await page.getByText('Add Tone Curve').click();
			await editor.expectAdjustmentExists('arami.tone-curve');
			await editor.expectAtLeaf(true);
		});
	});

	test('editing at non-leaf shows confirm dialog', async ({ page, editor }) => {
		await test.step('set up and navigate to non-leaf', async () => {
			await editor.openHistory();
			await editor.addAdjustment('arami.white-balance');
			await page.getByText('Open Image').click();
			await editor.expectAdjustmentNotExists('arami.white-balance');
		});

		await test.step('dismiss dialog cancels the action', async () => {
			page.once('dialog', (dialog) => dialog.dismiss());
			await page.evaluate(() =>
				(
					window as unknown as { __editorActions: { addAdjustment: (id: string) => void } }
				).__editorActions.addAdjustment('arami.tone-curve')
			);
			await expect(async () => {
				const state = await editor.getState();
				expect(state.adjustments.some((a) => a.plugin_id === 'arami.tone-curve')).toBe(false);
			}).toPass(Poll.fast);
		});

		await test.step('accept dialog applies the action', async () => {
			page.once('dialog', (dialog) => dialog.accept());
			await page.evaluate(() =>
				(
					window as unknown as { __editorActions: { addAdjustment: (id: string) => void } }
				).__editorActions.addAdjustment('arami.tone-curve')
			);
			await editor.expectAdjustmentExists('arami.tone-curve');
		});

		await test.step('forward history is pruned', async () => {
			const state = await editor.getState();
			expect(state.isAtLeaf).toBe(true);
		});
	});

	test('canUndo and canRedo state', async ({ editor }) => {
		// Add adjustment
		await editor.addAdjustment('arami.white-balance');
		await editor.expectUndoRedo(true, false);

		// Undo
		await editor.undo();
		await editor.expectAdjustmentNotExists('arami.white-balance');
		// Can still undo (Open Image), and can now redo
		await editor.expectUndoRedo(true, true);

		// Redo
		await editor.redo();
		await editor.expectAdjustmentExists('arami.white-balance');
		await editor.expectUndoRedo(true, false);
	});

	test('create and delete tag', async ({ page, editor }) => {
		await editor.openHistory();
		await editor.addAdjustment('arami.white-balance');

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
		await editor.addAdjustment('arami.white-balance');
		await editor.addAdjustment('arami.tone-curve');

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
