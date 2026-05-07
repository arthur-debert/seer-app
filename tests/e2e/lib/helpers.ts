import type { Locator, Page } from '@playwright/test';
import type { Box } from './types';

/**
 * Get a bounding box, throwing a descriptive error if the element is not visible.
 * Replaces all `(await locator.boundingBox())!` patterns.
 */
export async function requireBox(locator: Locator, name: string): Promise<Box> {
	const box = await locator.boundingBox();
	if (!box) {
		throw new Error(
			`${name} has no bounding box — element is not visible or has zero dimensions. ` +
				`Selector: ${locator}`
		);
	}
	return box;
}

/**
 * Extract computed style properties from an element.
 * Replaces the getStyles() helper scattered across spec files.
 */
export async function getComputedStyles(
	page: Page,
	selector: string,
	props: string[]
): Promise<Record<string, string>> {
	return page.evaluate(
		({ sel, properties }) => {
			const el = document.querySelector(sel);
			if (!el) throw new Error(`Element not found: ${sel}`);
			const cs = getComputedStyle(el);
			const result: Record<string, string> = {};
			for (const p of properties) {
				result[p] = cs.getPropertyValue(p);
			}
			return result;
		},
		{ sel: selector, properties: props }
	);
}

/**
 * Extract bounding box dimensions from an element by selector.
 * Replaces the getBox() helper scattered across spec files.
 */
export async function getBoxBySelector(page: Page, selector: string): Promise<Box> {
	return page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) throw new Error(`Element not found: ${sel}`);
		const r = el.getBoundingClientRect();
		return { x: r.left, y: r.top, width: r.width, height: r.height };
	}, selector);
}

/** Parse a CSS px value to a number. */
export function px(v: string): number {
	return parseFloat(v.replace('px', ''));
}
