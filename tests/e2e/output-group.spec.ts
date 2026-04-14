import { test } from './editor-fixture';
import { expect } from '@playwright/test';

test.describe('Output Groups', () => {
	test('add JPEG export group creates group with 3 children', async ({ editor }) => {
		await editor.addExportGroup('seer.output.jpeg');
		await editor.expectExportGroupCount(1);
		// Default: encoder + resize + metadata = 3 children
		await editor.expectGroupChildCount(0, 3);
		await editor.expectGroupChildExists(0, 'seer.output.jpeg');
		await editor.expectGroupChildExists(0, 'seer.output-child.resize');
		await editor.expectGroupChildExists(0, 'seer.output-child.metadata');
	});

	test('add PNG export group creates group with encoder', async ({ editor }) => {
		await editor.addExportGroup('seer.output.png');
		await editor.expectExportGroupExists('seer.output.png');
	});

	test('multiple export groups coexist', async ({ editor }) => {
		await editor.addExportGroup('seer.output.jpeg');
		await editor.addExportGroup('seer.output.png');
		await editor.expectExportGroupCount(2);
	});

	test('export group is visible in __editorState', async ({ editor }) => {
		await editor.addExportGroup('seer.output.jpeg');
		const state = await editor.getState();
		const group = state.exportGroups[0];
		expect(group.name).toBe('JPEG');
		expect(group.enabled).toBe(true);
		expect(group.suffix).toBe('');
		expect(group.children.length).toBe(3);
	});
});
