/**
 * Sidebar card tests — replacements for the deleted graph-visual.spec.ts.
 * Tests the card-based pipeline sidebar that replaced the graph view.
 */
import { test, expect } from './ui-interaction-fixture';

test.describe('Sidebar Cards', () => {
	test('phase groups are visible on startup', async ({ editor, page }) => {
		// editor fixture navigates and waits for pipeline ready
		const state = await editor.getState();
		expect(state).toBeTruthy();
		// The sidebar should show the 4 phase group titles
		await expect(page.getByText('1. Image')).toBeVisible();
		await expect(page.getByText('2. Zones')).toBeVisible();
		await expect(page.getByText('3. Adjustments')).toBeVisible();
		await expect(page.getByText('4. Export')).toBeVisible();
	});

	test('adding adjustment via radial menu creates a card', async ({ editor, ui }) => {
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'Tone Curve');
		await editor.expectAdjustmentExists('seer.tone-curve');

		// The card should be visible in the sidebar
		const state = await editor.getState();
		expect(state.adjustments.length).toBe(1);
		expect(state.adjustments[0].plugin_id).toBe('seer.tone-curve');
	});

	test('adding geometry via radial menu creates a card', async ({ editor, ui }) => {
		await ui.addViaRadialMenu('phase-add-1.-image', 'Crop');

		const state = await editor.getState();
		expect(state.geometry.length).toBe(1);
		expect(state.geometry[0].plugin_id).toBe('seer.crop');
	});

	test('multiple adjustments appear in order', async ({ editor, ui }) => {
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'White Balance');
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'Tone Curve');

		const state = await editor.getState();
		expect(state.adjustments.length).toBe(2);
		expect(state.adjustments[0].plugin_id).toBe('seer.white-balance');
		expect(state.adjustments[1].plugin_id).toBe('seer.tone-curve');
	});

	test('removing adjustment updates sidebar', async ({ editor, ui, page }) => {
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'White Balance');
		await ui.addViaRadialMenu('phase-add-3.-adjustments', 'Tone Curve');

		let state = await editor.getState();
		expect(state.adjustments.length).toBe(2);

		// Remove the first adjustment via __editorActions (removal UI is the X button)
		const wbId = state.adjustments[0].id;
		await page.evaluate(
			(id) =>
				(
					window as unknown as { __editorActions: { removeAdjustment: (id: string) => void } }
				).__editorActions.removeAdjustment(id),
			wbId
		);

		await expect(async () => {
			state = await editor.getState();
			expect(state.adjustments.length).toBe(1);
		}).toPass({ timeout: 5_000, intervals: [200] });

		expect(state.adjustments[0].plugin_id).toBe('seer.tone-curve');
	});

	test('source node is always visible', async ({ editor, page }) => {
		const state = await editor.getState();
		expect(state).toBeTruthy();
		// The source node should be visible in the Image phase
		await expect(page.getByText('Standard Image')).toBeVisible();
	});
});
