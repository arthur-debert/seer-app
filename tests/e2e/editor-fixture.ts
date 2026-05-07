/**
 * Editor E2E test fixture — provides an EditorHarness with state reads, actions,
 * and assertions that all go through __editorState / __editorActions.
 */
import { test as base, expect } from './base-fixture';
import type { Page } from '@playwright/test';

export { expect };

/** Shape of __editorActions exposed by Editor.svelte in DEV mode. */
interface EditorActions {
	addAdjustment: (pluginId: string) => void;
	addGeometry: (pluginId: string) => void;
	addZone: (pluginId: string) => void;
	removeAdjustment: (id: string) => void;
	selectNode: (id: string) => void;
	selectSource: () => void;
	addExportGroup: (pluginId: string) => void;
}

interface EditorWindow {
	__editorState: EditorState;
	__editorActions: EditorActions;
}

/** Shape of __editorState exposed by Editor.svelte in DEV mode. */
interface EditorState {
	source: {
		entries: Array<{
			id: string;
			plugin_id: string;
			path: string;
			width: number;
			height: number;
		}>;
		merge: unknown;
	};
	adjustments: Array<{
		id: string;
		name: string;
		plugin_id: string;
		enabled: boolean;
		params: Record<string, unknown>;
		zone: unknown;
	}>;
	geometry: Array<{
		id: string;
		name: string;
		plugin_id: string;
		enabled: boolean;
		params: Record<string, unknown>;
	}>;
	versionNodes: Array<{ id: string; label: string }>;
	fullPath: Array<{ id: string; label: string }>;
	headNodeId: string;
	canUndo: boolean;
	canRedo: boolean;
	isAtLeaf: boolean;
	tags: Array<{ name: string; nodeId: string }>;
	evalError: { adjustmentId: string; error: string } | null;
	schemas: Record<string, unknown>;
	zones: Array<{ id: string; name: string; kind: string }>;
	exportGroups: Array<{
		id: string;
		name: string;
		enabled: boolean;
		suffix: string;
		path: unknown;
		children: Array<{
			id: string;
			plugin_id: string;
			params: Record<string, unknown>;
			enabled: boolean;
		}>;
	}>;
	imageSize: { width: number; height: number } | null;
	error: string | undefined;
}

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
		}).toPass({ timeout: 15_000, intervals: [200] });
	}

	async addGeometry(pluginId: string): Promise<void> {
		await expect(async () => {
			const hasActions = await this.page.evaluate(
				() => !!(window as unknown as EditorWindow).__editorActions
			);
			expect(hasActions).toBe(true);
		}).toPass({ timeout: 10_000, intervals: [200] });
		await this.page.evaluate(
			(pid) => (window as unknown as EditorWindow).__editorActions.addGeometry(pid),
			pluginId
		);
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry.some((g) => g.plugin_id === pluginId)).toBe(true);
		}).toPass({ timeout: 15_000, intervals: [200] });
	}

	async addZone(pluginId: string): Promise<void> {
		await this.page.evaluate(
			(pid) => (window as unknown as EditorWindow).__editorActions.addZone(pid),
			pluginId
		);
		await expect(async () => {
			const state = await this.getState();
			expect(state.zones.some((z) => z.name.length > 0)).toBe(true);
		}).toPass({ timeout: 15_000, intervals: [200] });
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
		}).toPass({ timeout: 30_000, intervals: [500] });
	}

	async expectAdjustmentExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments.some((a) => a.plugin_id === pluginId)).toBe(true);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectAdjustmentNotExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments.some((a) => a.plugin_id === pluginId)).toBe(false);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectGeometryExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry.some((g) => g.plugin_id === pluginId)).toBe(true);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectGeometryNotExists(pluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry.some((g) => g.plugin_id === pluginId)).toBe(false);
		}).toPass({ timeout: 10_000, intervals: [200] });
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
		}).toPass({ timeout: 10_000, intervals: [200] });
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
		}).toPass({ timeout: 10_000, intervals: [200] });
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
		}).toPass({ timeout: 15_000, intervals: [500] });
	}

	async expectPipelineLength(n: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.adjustments).toHaveLength(n);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectGeometryLength(n: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.geometry).toHaveLength(n);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectUndoRedo(canUndo: boolean, canRedo: boolean): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.canUndo).toBe(canUndo);
			expect(state.canRedo).toBe(canRedo);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectAtLeaf(isAtLeaf: boolean): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.isAtLeaf).toBe(isAtLeaf);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectSourcePath(path: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.source.entries[0]?.path).toContain(path);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectZoneExists(kind: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.zones.some((z) => z.kind === kind)).toBe(true);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectZoneNotExists(kind: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.zones.some((z) => z.kind === kind)).toBe(false);
		}).toPass({ timeout: 10_000, intervals: [200] });
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
		}).toPass({ timeout: 15_000, intervals: [500] });
	}

	async expectLogContains(substring: string): Promise<void> {
		await expect(async () => {
			expect(this.logs.some((t) => t.includes(substring))).toBe(true);
		}).toPass({ timeout: 60_000, intervals: [500] });
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
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectExportGroupCount(n: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.exportGroups.length).toBe(n);
		}).toPass({ timeout: 10_000, intervals: [200] });
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
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectGroupChildCount(groupIndex: number, count: number): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			expect(state.exportGroups[groupIndex].children.length).toBe(count);
		}).toPass({ timeout: 10_000, intervals: [200] });
	}

	async expectGroupChildExists(groupIndex: number, childPluginId: string): Promise<void> {
		await expect(async () => {
			const state = await this.getState();
			const group = state.exportGroups[groupIndex];
			expect(group.children.some((c) => c.plugin_id === childPluginId)).toBe(true);
		}).toPass({ timeout: 10_000, intervals: [200] });
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
