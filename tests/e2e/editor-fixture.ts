/**
 * Editor E2E test fixture — provides an EditorHarness with state reads, actions,
 * and assertions that all go through __editorState / __editorActions.
 */
import { test as base, expect } from './base-fixture';
import type { Page } from '@playwright/test';
import type { EditorState, EditorWindow } from './lib/types';
import { Poll } from './lib/timeouts';

export { expect };

class EditorHarness {
	constructor(
		private page: Page,
		private consoleErrors: string[],
		private logs: string[]
	) {}

	/** Read full __editorState from the browser. */
	async getState(): Promise<EditorState> {
		return this.page.evaluate(
			() => (window as unknown as Record<string, unknown>).__editorState as unknown
		) as Promise<EditorState>;
	}

	// --- Actions (via __editorActions) ---

	async addAdjustment(pluginId: string): Promise<void> {
		await this.page.evaluate(
			(pid) => (window as unknown as EditorWindow).__editorActions.addAdjustment(pid),
			pluginId
		);
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments.some((a) => a.plugin_id === pluginId)).toBe(true);
		}).toPass(Poll.action);
	}

	async addGeometry(pluginId: string): Promise<void> {
		await expect(async () => {
			const hasActions = await this.page.evaluate(
				() => !!(window as unknown as EditorWindow).__editorActions
			);
			expect(hasActions).toBe(true);
		}).toPass(Poll.action);
		await this.page.evaluate(
			(pid) => (window as unknown as EditorWindow).__editorActions.addGeometry(pid),
			pluginId
		);
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry.some((g) => g.plugin_id === pluginId)).toBe(true);
		}).toPass(Poll.action);
	}

	async addZone(pluginId: string): Promise<void> {
		await this.page.evaluate(
			(pid) => (window as unknown as EditorWindow).__editorActions.addZone(pid),
			pluginId
		);
		await expect(async () => {
			const state = await this.getState();
			expect(state.zones.some((z) => z.name.length > 0)).toBe(true);
		}).toPass(Poll.action);
	}

	async selectSource(): Promise<void> {
		await this.page.evaluate(() =>
			(window as unknown as EditorWindow).__editorActions.selectSource()
		);
	}

	async undo(): Promise<void> {
		const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
		await this.page.keyboard.press(`${mod}+z`);
	}

	async redo(): Promise<void> {
		const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
		await this.page.keyboard.press(`${mod}+Shift+z`);
	}

	async openHistory(): Promise<void> {
		await this.page.getByTitle('Toggle history panel').click();
	}

	async selectAdjustment(index: number): Promise<void> {
		const state = await this.getState();
		const adj = state.adjustments[index];
		if (!adj) throw new Error(`No adjustment at index ${index}`);
		await this.page.evaluate(
			(id) => (window as unknown as EditorWindow).__editorActions.selectNode(id),
			adj.id
		);
	}

	async selectGeometry(index: number): Promise<void> {
		const state = await this.getState();
		const geo = state.geometry[index];
		if (!geo) throw new Error(`No geometry node at index ${index}`);
		await this.page.evaluate(
			(id) => (window as unknown as EditorWindow).__editorActions.selectNode(id),
			geo.id
		);
	}

	async selectAdjustmentByPlugin(pluginId: string): Promise<void> {
		const state = await this.getState();
		const index = state.adjustments.findIndex((a) => a.plugin_id === pluginId);
		if (index === -1) throw new Error(`No adjustment with plugin_id=${pluginId}`);
		await this.selectAdjustment(index);
	}

	async selectGeometryByPlugin(pluginId: string): Promise<void> {
		const state = await this.getState();
		const index = state.geometry.findIndex((g) => g.plugin_id === pluginId);
		if (index === -1) throw new Error(`No geometry node with plugin_id=${pluginId}`);
		await this.selectGeometry(index);
	}

	// --- Assertions ---

	async expectPipelineReady(): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.imageSize).toBeTruthy();
			expect(state.evalError).toBeNull();
			expect(state.error).toBeUndefined();
		}).toPass(Poll.pipeline);
	}

	async expectAdjustmentExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments.some((a) => a.plugin_id === pluginId)).toBe(true);
		}).toPass(Poll.action);
	}

	async expectAdjustmentNotExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments.some((a) => a.plugin_id === pluginId)).toBe(false);
		}).toPass(Poll.action);
	}

	async expectGeometryExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry.some((g) => g.plugin_id === pluginId)).toBe(true);
		}).toPass(Poll.action);
	}

	async expectGeometryNotExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry.some((g) => g.plugin_id === pluginId)).toBe(false);
		}).toPass(Poll.action);
	}

	async expectAdjustmentParams(pluginId: string, expected: Record<string, unknown>): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			const adj = state.adjustments.find((a) => a.plugin_id === pluginId);
			expect(adj).toBeTruthy();
			const params = adj!.params as Record<string, unknown>;
			for (const [key, value] of Object.entries(expected)) {
				expect(params[key]).toEqual(value);
			}
		}).toPass(Poll.action);
	}

	async expectGeometryParams(pluginId: string, expected: Record<string, unknown>): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			const geo = state.geometry.find((g) => g.plugin_id === pluginId);
			expect(geo).toBeTruthy();
			const params = geo!.params as Record<string, unknown>;
			for (const [key, value] of Object.entries(expected)) {
				expect(params[key]).toEqual(value);
			}
		}).toPass(Poll.action);
	}

	async expectNoErrors(): Promise<void> {
		const state = await this.getState();
		expect(state.evalError).toBeNull();
		expect(state.error).toBeUndefined();
		expect(this.consoleErrors).toEqual([]);
	}

	async expectImageSize(w: number, h: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.imageSize).toEqual({ width: w, height: h });
		}).toPass(Poll.action);
	}

	async expectPipelineLength(n: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments).toHaveLength(n);
		}).toPass(Poll.action);
	}

	async expectGeometryLength(n: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry).toHaveLength(n);
		}).toPass(Poll.action);
	}

	async expectUndoRedo(canUndo: boolean, canRedo: boolean): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.canUndo).toBe(canUndo);
			expect(state.canRedo).toBe(canRedo);
		}).toPass(Poll.action);
	}

	async expectAtLeaf(isAtLeaf: boolean): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.isAtLeaf).toBe(isAtLeaf);
		}).toPass(Poll.action);
	}

	async expectSourcePath(path: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.source.entries[0]?.path).toContain(path);
		}).toPass(Poll.action);
	}

	async expectZoneExists(kind: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.zones.some((z) => z.kind === kind)).toBe(true);
		}).toPass(Poll.action);
	}

	async expectZoneNotExists(kind: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.zones.some((z) => z.kind === kind)).toBe(false);
		}).toPass(Poll.action);
	}

	async getCropParams(): Promise<{ x: number; y: number; width: number; height: number } | null> {
		const state = await this.getState();
		const crop = state.geometry.find((g) => g.plugin_id === 'arami.crop');
		if (!crop) return null;
		const p = crop.params as Record<string, { Float: number }>;
		return {
			x: p.x?.Float ?? 0,
			y: p.y?.Float ?? 0,
			width: p.width?.Float ?? 0,
			height: p.height?.Float ?? 0
		};
	}

	async expectCropRatio(expected: number, precision: number = 1): Promise<void> {
		await expect(async () => {
			const params = await this.getCropParams();
			expect(params).toBeTruthy();
			expect(params!.width / params!.height).toBeCloseTo(expected, precision);
		}).toPass(Poll.action);
	}

	async expectLogContains(substring: string): Promise<void> {
		await expect(async () => {
			expect(this.logs.some((t) => t.includes(substring))).toBe(true);
		}).toPass(Poll.heavy);
	}

	// ─── Export group helpers ─────────────────────────────────────

	async addExportGroup(encoderPluginId: string): Promise<void> {
		await this.page.evaluate(
			(pid) => (window as unknown as EditorWindow).__editorActions.addExportGroup(pid),
			encoderPluginId
		);
		await expect(async () => {
			const state = await this.getState();
			expect(state.exportGroups.length).toBeGreaterThan(0);
		}).toPass(Poll.action);
	}

	async expectExportGroupCount(n: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.exportGroups.length).toBe(n);
		}).toPass(Poll.action);
	}

	async expectExportGroupExists(encoderPluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			const found = state.exportGroups.some((g) =>
				g.children.some(
					(c) => c.plugin_id === encoderPluginId && !c.plugin_id.startsWith('arami.output-child.')
				)
			);
			expect(found).toBe(true);
		}).toPass(Poll.action);
	}

	async expectGroupChildCount(groupIndex: number, count: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.exportGroups[groupIndex].children.length).toBe(count);
		}).toPass(Poll.action);
	}

	async expectGroupChildExists(groupIndex: number, childPluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			const group = state.exportGroups[groupIndex];
			expect(group.children.some((c) => c.plugin_id === childPluginId)).toBe(true);
		}).toPass(Poll.action);
	}
}

export const test = base.extend<{ editor: EditorHarness }>({
	editor: async ({ page, consoleErrors }, use) => {
		const logs: string[] = [];
		page.on('console', (msg) => {
			logs.push(msg.text());
		});

		// Navigate to editor with test fixture image
		await page.goto('/editor?src=/test-fixtures/gradient-64x64.png');

		const harness = new EditorHarness(page, consoleErrors, logs);

		// Wait for pipeline to be ready
		await harness.expectPipelineReady();

		await use(harness);
	}
});
