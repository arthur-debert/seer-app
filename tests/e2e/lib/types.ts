/** Shape of __editorActions exposed by Editor.svelte in DEV mode. */
export interface EditorActions {
	addAdjustment: (pluginId: string) => void;
	addGeometry: (pluginId: string) => void;
	addZone: (pluginId: string) => void;
	removeAdjustment: (id: string) => void;
	selectNode: (id: string) => void;
	selectSource: () => void;
	addExportGroup: (pluginId: string) => void;
}

/** Shape of __editorState exposed by Editor.svelte in DEV mode. */
export interface EditorState {
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

export interface EditorWindow {
	__editorState: EditorState;
	__editorActions: EditorActions;
}

export interface ViewLayout {
	uv_offset: [number, number];
	uv_scale: [number, number];
}

export interface VisibleRect {
	origin: { x: number; y: number };
	size: { width: number; height: number };
}

export interface ViewerState {
	zoom_level(): number;
	zoom_percentage(): number;
	set_zoom(level: number): void;
	max_zoom(): number;
	layout(): ViewLayout;
	visible_rect(): VisibleRect;
	pan(dx: number, dy: number): void;
	zoom(delta: number, centerX: number, centerY: number): void;
}

export interface ViewerWindow {
	__viewerState: ViewerState;
}

export interface MirrorWindow {
	__mirrorState: {
		left: ViewerState;
		right: ViewerState;
	};
}

export interface TestEvent {
	time: number;
	type: string;
	detail?: unknown;
}

export interface TestBridge {
	ready: {
		pipeline: boolean;
		wasm: boolean;
		viewer: boolean;
	};
	events: TestEvent[];
	emit: (type: string, detail?: unknown) => void;
	waitForEvent: (type: string) => Promise<TestEvent>;
}

/** Combined window type for page.evaluate() calls. */
export type TestWindow = EditorWindow & ViewerWindow & MirrorWindow & { __testBridge?: TestBridge };

/** A non-null bounding box (use with requireBox helper). */
export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}
