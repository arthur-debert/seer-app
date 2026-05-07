/**
 * UI interaction fixture — extends EditorHarness with DOM-level interaction helpers.
 * Import this instead of editor-fixture when testing actual UI widgets.
 */
import { test as base, expect } from './editor-fixture';
import type { Page, Locator } from '@playwright/test';
import type { EditorWindow } from './lib/types';
import { requireBox } from './lib/helpers';
import { Poll } from './lib/timeouts';

export { expect };

class UIHarness {
	constructor(private page: Page) {}

	// --- Sidebar interactions ---

	/** Click the + button for a phase, pick from radial menu by aria-label */
	async addViaRadialMenu(phaseTestId: string, itemLabel: string): Promise<void> {
		await this.page.getByTestId(phaseTestId).click();
		await expect(this.page.getByTestId('radial-bg')).toBeVisible();

		const item = this.page.locator(`[data-testid="radial-item"][aria-label="${itemLabel}"]`);
		await item.click();

		await expect(this.page.getByTestId('radial-bg')).not.toBeAttached();
	}

	// --- Widget interactions ---

	/** Drag a slider track to a target ratio (0=min, 1=max). Finds by data-testid="slider-{label}" */
	async dragSlider(sliderLabel: string, targetRatio: number): Promise<void> {
		const slider = this.page.getByTestId(`slider-${sliderLabel}`);
		const track = slider.getByTestId('slider-track');
		const box = await requireBox(track, `slider track for "${sliderLabel}"`);

		const startX = box.x + box.width * 0.5;
		const startY = box.y + box.height / 2;
		const targetX = box.x + box.width * Math.max(0, Math.min(1, targetRatio));
		const targetY = startY;

		await this.page.mouse.move(startX, startY);
		await this.page.mouse.down();
		await this.page.mouse.move(targetX, targetY, { steps: 5 });
		await this.page.mouse.up();
	}

	/** Click a PopupCurve trigger. Returns the popup locator. */
	async openCurvePopup(paramLabel: string): Promise<Locator> {
		const trigger = this.page.locator(`button[aria-label="Edit ${paramLabel}"]`);
		await trigger.click();

		const popup = this.page.getByTestId('popup-curve-popup');
		await expect(popup).toBeVisible();
		return popup;
	}

	/** Close any open popup by clicking its backdrop */
	async closePopup(backdropTestId: string): Promise<void> {
		const backdrop = this.page.getByTestId(backdropTestId);
		await backdrop.click({ position: { x: 1, y: 1 } });
		await expect(backdrop).not.toBeAttached();
	}

	/** Click a PopupSelect trigger and select an option */
	async selectDropdownOption(selectLabel: string, optionLabel: string): Promise<void> {
		const trigger = this.page.getByTestId('popup-select-trigger');
		await trigger.click();
		await expect(this.page.getByTestId('popup-select-dropdown')).toBeVisible();

		const options = this.page.getByTestId('popup-select-option');
		const count = await options.count();
		const available: string[] = [];
		for (let i = 0; i < count; i++) {
			const text = await options.nth(i).textContent();
			available.push(text?.trim() ?? '');
			if (text?.trim() === optionLabel) {
				await options.nth(i).click();
				return;
			}
		}
		throw new Error(
			`Option "${optionLabel}" not found in dropdown "${selectLabel}". ` +
				`Available options: [${available.join(', ')}]`
		);
	}

	// --- Deep assertions ---

	/** Assert a popup is visible AND its bounding box is within the viewport (not clipped) */
	async expectPopupInViewport(popupTestId: string): Promise<void> {
		const popup = this.page.getByTestId(popupTestId);
		await expect(popup).toBeVisible();

		const box = await popup.boundingBox();
		expect(box).toBeTruthy();

		const viewport = this.page.viewportSize();
		expect(viewport).toBeTruthy();

		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
		expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
	}

	/** Assert slider fill width roughly matches expected ratio (tolerance 0.1 = 10%) */
	async expectSliderFill(
		sliderLabel: string,
		expectedRatio: number,
		tolerance: number = 0.1
	): Promise<void> {
		const slider = this.page.getByTestId(`slider-${sliderLabel}`);
		const track = slider.getByTestId('slider-track');
		const fill = slider.getByTestId('slider-fill');

		await expect(async () => {
			const trackBox = await track.boundingBox();
			const fillBox = await fill.boundingBox();
			expect(trackBox).toBeTruthy();
			expect(fillBox).toBeTruthy();

			const actualRatio = fillBox!.width / trackBox!.width;
			expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio - tolerance);
			expect(actualRatio).toBeLessThanOrEqual(expectedRatio + tolerance);
		}).toPass(Poll.fast);
	}

	/** Read a specific param value from __editorState for a given pluginId + paramId */
	async getParamValue(pluginId: string, paramId: string): Promise<unknown> {
		return this.page.evaluate(
			({ pid, param }) => {
				const state = (window as unknown as EditorWindow).__editorState;
				const adj = state.adjustments.find((a) => a.plugin_id === pid);
				if (!adj) return null;
				return adj.params[param] ?? null;
			},
			{ pid: pluginId, param: paramId }
		);
	}
}

export const test = base.extend<{ ui: UIHarness }>({
	ui: async ({ page }, use) => {
		await use(new UIHarness(page));
	}
});
