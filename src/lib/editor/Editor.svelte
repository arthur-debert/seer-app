<script lang="ts">
	import { untrack } from 'svelte';
	import { logger, setLogSink, clearLogSink } from '$lib/log';
	import { Renderer } from '$lib/viewer/renderer';
	import { initViewportWasm, ViewerState, FramerState } from '$lib/viewer/viewport';
	import { emitTestEvent, setTestReady } from '$lib/test-bridge';
	import type { ViewLayout, Size, Rect } from '$lib/viewer/viewport';
	import type {
		AdjustmentInfo,
		GeometryInfo,
		SourceInfo,
		EvalError,
		VersionNode,
		TagEntry,
		ZoneInfo,
		CropParams,
		ParamSchema,
		ParamValue
	} from './editor-bridge';
	import type { OutputGroupInfo } from './pipeline-worker-protocol';
	import { PipelineScheduler } from './pipeline-scheduler';
	import { runSegmentation } from './segmentation';
	import { isDng, decodeRaw } from './rawLoader';
	import ParamPanel from './ParamPanel.svelte';
	import HistoryPanel from './HistoryPanel.svelte';
	import { CANVAS_OVERLAYS } from './canvas-overlay';
	import MainToolbar from '$lib/ui/MainToolbar.svelte';
	import ViewSettingsToolbar from '$lib/ui/ViewSettingsToolbar.svelte';
	import MetadataPanel from '$lib/ui/MetadataPanel.svelte';
	import NodePanel from '$lib/ui/NodePanel.svelte';
	import PhaseGroup from '$lib/ui/PhaseGroup.svelte';
	import Slider from '$lib/ui/Slider.svelte';
	import Toggle from '$lib/ui/Toggle.svelte';
	import PopupCurve from '$lib/ui/PopupCurve.svelte';
	import PopupSelect from '$lib/ui/PopupSelect.svelte';
	import PopupColorPicker from '$lib/ui/PopupColorPicker.svelte';
	import Pane from '$lib/ui/Pane.svelte';
	import { rgbToHex, hexToRgb } from '$lib/ui/utils';
	import { icons, pluginIconMap, addablePlugins, addableZones, addableGeometry } from '$lib/icons';
	import { unwrapFloat, unwrapBool, unwrapCurve, unwrapChoice, unwrapColor } from './editor-bridge';

	interface Props {
		imageBytes: ArrayBuffer;
		imagePath?: string;
	}

	let { imageBytes, imagePath }: Props = $props();

	const log = logger('editor');

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let error: string | undefined = $state();
	let dragging: boolean = $state(false);
	let source: SourceInfo = $state({ entries: [], merge: 'Single' });
	let adjustments: AdjustmentInfo[] = $state([]);
	let geometry: GeometryInfo[] = $state([]);
	let selectedId: string | null = $state(null);
	let segStatus: string | null = $state(null);
	let evalError: EvalError | null = $state(null);
	let versionNodes: VersionNode[] = $state([]);
	let fullPath: VersionNode[] = $state([]);
	let headNodeId: string = $state('');
	let canUndo: boolean = $state(false);
	let canRedo: boolean = $state(false);
	let tags: TagEntry[] = $state([]);
	let zones: ZoneInfo[] = $state([]);
	let schemas: Record<string, ParamSchema> = $state({});
	let exportGroups: OutputGroupInfo[] = $state([]);
	let availableExports: Array<{ id: string; name: string }> = $state([]);
	let selectedZoneId: string | null = $state(null);
	let currentLayout: ViewLayout | null = $state(null);
	let imageSize: Size | null = $state(null);
	let schedulerRef: PipelineScheduler | undefined = $state();

	// Thumbnail Blob URL for the source node
	let thumbnailUrl: string | undefined = $state();
	$effect(() => {
		const url = URL.createObjectURL(new Blob([imageBytes]));
		thumbnailUrl = url;
		return () => {
			URL.revokeObjectURL(url);
		};
	});

	// View controls state
	let framePercentage: number = $state(10);
	let matColor: string = $state('#262626');

	/** Parse a CSS hex color to linear [r, g, b, a] floats for the shader. */
	function hexToLinear(hex: string): [number, number, number, number] {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		return [r, g, b, 1];
	}

	let isAtLeaf = $derived(fullPath.length === 0 || headNodeId === fullPath[fullPath.length - 1].id);

	let selectedAdjustment = $derived(
		adjustments.find((n) => n.id === selectedId) ??
			geometry.find((n) => n.id === selectedId) ??
			null
	);
	let activeOverlay = $derived(
		selectedAdjustment ? (CANVAS_OVERLAYS[selectedAdjustment.name] ?? null) : null
	);
	let parts = $derived(zones.filter((z) => z.kind !== 'Composition'));

	// Radial menu items for each phase
	function toRadialItems(list: { pluginId: string; label: string; iconKey: keyof typeof icons }[]) {
		return list.map((p) => ({
			id: p.pluginId,
			icon: icons[p.iconKey].component,
			label: p.label
		}));
	}
	const adjustmentMenuItems = toRadialItems(addablePlugins);
	const zoneMenuItems = toRadialItems(addableZones);
	const geometryMenuItems = toRadialItems(addableGeometry);

	function iconFor(pluginId: string) {
		const key = pluginIconMap[pluginId];
		return key ? icons[key].component : icons.source.component;
	}

	// Guard: when head is not at the leaf of fullPath, editing will discard
	// all forward history. Ask for confirmation before proceeding.
	function confirmEdit(): boolean {
		if (isAtLeaf) return true;
		return confirm('This will discard edits after this point. Continue?');
	}

	// --- Handlers that only need schedulerRef (available at module level) ---

	function handleAddAdjustment(pluginId: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		let zone: unknown = undefined;
		if (selectedZoneId) {
			const colonIdx = selectedZoneId.indexOf(':');
			if (colonIdx !== -1) {
				const parentId = selectedZoneId.slice(0, colonIdx);
				const label = selectedZoneId.slice(colonIdx + 1);
				zone = { PartitionLabel: [parentId, label, 5.0] };
			} else {
				zone = { Ref: selectedZoneId };
			}
		}
		schedulerRef.perform(`Add adjustment`, [{ type: 'add-adjustment', pluginId, zone }]);
	}

	function handleAddGeometry(pluginId: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		schedulerRef.perform('Add geometry', [{ type: 'add-geometry', pluginId }]);
	}

	function handleRemoveAdjustment(id: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		const isGeo = geometry.some((n) => n.id === id);
		if (selectedId === id) {
			const list = isGeo ? geometry : adjustments;
			const remaining = list.filter((n) => n.id !== id);
			selectedId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
		}
		if (isGeo) {
			schedulerRef.perform('Remove', [{ type: 'remove-geometry', id }]);
		} else {
			schedulerRef.perform('Remove', [{ type: 'remove-adjustment', id }]);
		}
	}

	function handleParamChange(id: string, params: unknown): void {
		if (!schedulerRef || !confirmEdit()) return;
		const isGeo = geometry.some((n) => n.id === id);
		if (isGeo) {
			schedulerRef.perform('Adjust', [{ type: 'update-geometry-params', id, params }]);
		} else {
			schedulerRef.perform('Adjust', [{ type: 'update-params', id, params }]);
		}
	}

	function handleAddZone(pluginId: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		schedulerRef.addZone(pluginId);
	}

	function handleRemoveZone(id: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		if (selectedZoneId === id) selectedZoneId = null;
		schedulerRef.removeZone(id);
	}

	function handleAddGroup(pluginId: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		schedulerRef.perform('Add export', [{ type: 'add-export-group', pluginId }]);
	}

	function handleRemoveGroup(id: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		if (selectedId === id) {
			const remaining = exportGroups.filter((g) => g.id !== id);
			selectedId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
		}
		schedulerRef.perform('Remove export', [{ type: 'remove-export-group', id }]);
	}

	// Export-phase handlers — not yet wired to template, used by __editorActions
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function handleReorderGroup(id: string, newIndex: number): void {
		if (!schedulerRef || !confirmEdit()) return;
		schedulerRef.perform('Reorder export', [{ type: 'reorder-export-group', id, newIndex }]);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function handleRunExport(id: string): void {
		if (!schedulerRef) return;
		schedulerRef.perform('Run export', [{ type: 'run-export', id }]);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function handleAddChild(groupId: string, pluginId: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		schedulerRef.perform('Add child', [{ type: 'add-group-child', groupId, pluginId }]);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function handleRemoveChild(groupId: string, childId: string): void {
		if (!schedulerRef || !confirmEdit()) return;
		if (selectedId === childId) selectedId = groupId;
		schedulerRef.perform('Remove child', [{ type: 'remove-group-child', groupId, childId }]);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function handleToggleChild(groupId: string, childId: string, enabled: boolean): void {
		if (!schedulerRef || !confirmEdit()) return;
		schedulerRef.perform(enabled ? 'Enable' : 'Disable', [
			{ type: 'toggle-group-child', groupId, childId, enabled }
		]);
	}

	function handleJumpTo(nodeId: string): void {
		if (!schedulerRef) return;
		schedulerRef.jumpTo(nodeId);
	}

	function handleTag(name: string): void {
		if (!schedulerRef) return;
		schedulerRef.tag(name);
	}

	function handleUntag(name: string): void {
		if (!schedulerRef) return;
		schedulerRef.untag(name);
	}

	// --- Handlers that need $effect-local state (viewerState, framerState, renderer) ---
	// Wrapped in $state because they are reassigned inside $effect.
	let handleEnterCropMode: () => void = $state(() => {});
	let handleExitCropMode: () => void = $state(() => {});
	let handleUpdateCropRatio: (rw: number, rh: number, uiOverrides?: Partial<CropParams>) => void =
		$state(() => {});
	let handleViewFrameChange: (pct: number) => void = $state(() => {});
	let handleViewMatColorChange: (color: string) => void = $state(() => {});

	$effect(() => {
		if (!canvasEl || !imageBytes) return;

		const renderer = new Renderer();
		let viewerState: ViewerState | undefined;
		let framerState: FramerState | undefined;
		let sourceImageSize: Size | null = null;
		let scheduler: PipelineScheduler | undefined;
		let alive = true;
		let classMapSent = false;

		function applyLayout(layout: ViewLayout): void {
			currentLayout = layout;
			renderer.updateViewportUniform(layout);
			const fr = layout.frame_rect;
			renderer.render({
				x: Math.round(fr.origin.x),
				y: Math.round(fr.origin.y),
				width: Math.round(fr.size.width),
				height: Math.round(fr.size.height)
			});
		}

		function emitCropParams(uiOverrides?: Partial<CropParams>): void {
			if (!framerState || !sourceImageSize || !selectedAdjustment || !scheduler) return;
			const crop = framerState.crop_rect() as Rect;
			const p = selectedAdjustment.params as Record<string, unknown> | undefined;
			// Merge geometry into existing params. UI fields (ratio, landscape,
			// show_thirds) are managed by ParamPanel and must not be overwritten.
			const pv = p as Record<string, ParamValue | undefined>;
			const hasBool = (v: unknown): v is { Bool: boolean } =>
				!!v && typeof v === 'object' && 'Bool' in v;
			const existing: CropParams = p
				? {
						x: unwrapFloat(pv.x) || 0,
						y: unwrapFloat(pv.y) || 0,
						width: unwrapFloat(pv.width) || 1,
						height: unwrapFloat(pv.height) || 1,
						ratio_w: unwrapFloat(pv.ratio_w) || 4,
						ratio_h: unwrapFloat(pv.ratio_h) || 3,
						landscape: hasBool(p.landscape) ? p.landscape.Bool : true,
						show_thirds: hasBool(p.show_thirds) ? p.show_thirds.Bool : false
					}
				: {
						x: 0,
						y: 0,
						width: 1,
						height: 1,
						ratio_w: 4,
						ratio_h: 3,
						landscape: true,
						show_thirds: false
					};
			const merged = {
				...existing,
				...uiOverrides,
				x: crop.origin.x / sourceImageSize.width,
				y: crop.origin.y / sourceImageSize.height,
				width: crop.size.width / sourceImageSize.width,
				height: crop.size.height / sourceImageSize.height
			};
			handleParamChange(selectedAdjustment.id, {
				x: { Float: merged.x },
				y: { Float: merged.y },
				width: { Float: merged.width },
				height: { Float: merged.height },
				ratio_w: { Float: merged.ratio_w },
				ratio_h: { Float: merged.ratio_h },
				landscape: { Bool: merged.landscape },
				show_thirds: { Bool: merged.show_thirds }
			});
		}

		function enterCropMode(): void {
			if (!sourceImageSize || !canvasEl) return;
			let rw = 4;
			let rh = 3;
			let landscape = true;
			if (selectedAdjustment) {
				const p = selectedAdjustment.params as Record<string, unknown> | undefined;
				if (p) {
					rw = (p.ratio_w as { Float: number })?.Float ?? 4;
					rh = (p.ratio_h as { Float: number })?.Float ?? 3;
					landscape = (p.landscape as { Bool: boolean })?.Bool ?? true;
				}
			}
			const effectiveW = landscape ? rw : rh;
			const effectiveH = landscape ? rh : rw;
			framerState = new FramerState(
				sourceImageSize.width,
				sourceImageSize.height,
				canvasEl.width,
				canvasEl.height,
				effectiveW,
				effectiveH
			);
			applyLayout(framerState.layout() as ViewLayout);
			emitCropParams();
		}

		function exitCropMode(): void {
			if (framerState) emitCropParams();
			framerState?.free();
			framerState = undefined;
			if (viewerState) applyLayout(viewerState.layout());
		}

		async function setup(): Promise<void> {
			// Initialize viewport WASM and renderer (no editor WASM needed on main thread)
			await Promise.all([initViewportWasm(), renderer.init(canvasEl!)]);
			emitTestEvent('wasm:loaded');
			setTestReady('wasm', true);

			const ts = Date.now();
			const path = imagePath ?? '';

			// Create scheduler with callbacks
			scheduler = schedulerRef = new PipelineScheduler({
				onState: (
					sourceInfo,
					pipeline,
					geometryNodes,
					schemaMap,
					nodes,
					head,
					undo,
					redo,
					tagList,
					zoneList,
					exportTargetList,
					availableExportList,
					_boundaryList,
					addedIds
				) => {
					if (!alive) return;
					log.info('edit graph created', {
						adjustments: pipeline.length,
						geometry: geometryNodes.length
					});
					source = sourceInfo;
					adjustments = pipeline;
					geometry = geometryNodes;
					schemas = schemaMap;
					exportGroups = exportTargetList;
					availableExports = availableExportList;
					versionNodes = nodes;
					headNodeId = head;
					canUndo = undo;
					canRedo = redo;
					tags = tagList;
					zones = zoneList;

					// Maintain fullPath: if newNodes is a prefix of the current
					// fullPath, we navigated back — keep the full timeline visible.
					// Otherwise a new edit happened — replace fullPath entirely.
					const isPrefix =
						nodes.length <= fullPath.length && nodes.every((n, i) => fullPath[i].id === n.id);
					if (!isPrefix) {
						fullPath = nodes;
					}

					// Select the first added adjustment if any
					if (addedIds && addedIds.length > 0) {
						selectedId = addedIds[0];
					}
				},
				onPixels: (data, width, height, pixelError) => {
					if (!alive) return;
					evalError = pixelError ?? null;
					log.info('pipeline evaluated', { width, height });

					// When crop mode is active, skip loading cropped output pixels.
					// The source texture is already on the renderer and matches
					// FramerState's expected image dimensions.
					if (framerState) return;

					const dims = renderer.loadPixels(data, width, height);
					// Track source image size (always full source when we get here,
					// since crop mode early-returns above).
					sourceImageSize = { width: dims.width, height: dims.height };
					imageSize = sourceImageSize;

					// Initialize ViewerState on first pixels received
					if (!viewerState) {
						renderer.resize();
						viewerState = new ViewerState(
							dims.width,
							dims.height,
							canvasEl!.width,
							canvasEl!.height
						);
						viewerState.set_zoom_limits(5.0, 400.0);
						viewerState.set_mat_fraction(framePercentage / 100);
						const [r, g, b, a] = hexToLinear(matColor);
						renderer.setBgColor(r, g, b, a);

						// Select first adjustment after initial state
						if (adjustments.length > 0 && !selectedId) {
							selectedId = adjustments[0].id;
						}

						emitTestEvent('viewer:rendered');
						setTestReady('viewer', true);
					}

					applyLayout(viewerState!.layout());
					emitTestEvent('pipeline:evaluated');
					setTestReady('pipeline', true);

					// Run segmentation when a segmentation zone exists and class map hasn't been sent yet
					if (!classMapSent) {
						runSegmentationOnOutput(data, width, height);
					}
				},
				onExportResult: (id, data) => {
					if (!alive) return;
					const group = exportGroups.find((g) => g.id === id);
					const encoder = group?.children.find(
						(c) =>
							c.plugin_id.startsWith('seer.output.') &&
							!c.plugin_id.startsWith('seer.output-child.')
					);
					const ext = encoder?.plugin_id.replace('seer.output.', '') ?? 'bin';
					const srcPath = source.entries[0]?.path || 'export';
					const srcBasename = srcPath.split(/[/\\]/).pop() ?? 'export';
					const srcName = srcBasename.includes('.')
						? srcBasename.split('.').slice(0, -1).join('.')
						: srcBasename;
					const suffix = group?.suffix || '';
					const filename = `${srcName}${suffix}.${ext}`;
					const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = filename;
					a.click();
					URL.revokeObjectURL(url);
				},
				onError: (message) => {
					if (!alive) return;
					log.error('scheduler error', { error: message });
					evalError = { adjustmentId: '', error: `Pipeline error: ${message}` };
				}
			});

			await scheduler.waitReady();
			log.info('pipeline worker ready');

			// Wire log sink to forward to the Worker's history
			setLogSink((l, c, m, logTs) => scheduler!.attachLog(l, c, m, logTs));

			// Initialize the EditGraph in the Worker
			if (isDng(imageBytes)) {
				const decoded = await decodeRaw(imageBytes);
				scheduler.initF32(decoded.data, decoded.width, decoded.height, path, ts);
			} else {
				// Clone imageBytes since it will be transferred (neutered)
				const copy = imageBytes.slice(0);
				scheduler.init(copy, path, ts);
			}
		}

		function runSegmentationOnOutput(data: Uint8Array, width: number, height: number): void {
			if (!scheduler) return;
			if (!scheduler.needsSegmentation(zones)) return;

			classMapSent = true;
			segStatus = 'Analyzing image...';
			const imgData = new ImageData(new Uint8ClampedArray(data), width, height);
			runSegmentation(imgData)
				.then((result) => {
					if (!alive || !scheduler) return;
					scheduler.setClassMap(result.data, result.width, result.height);
					segStatus = null;
					log.info('segmentation complete', { width: result.width, height: result.height });
				})
				.catch((e: unknown) => {
					if (!alive) return;
					const msg = e instanceof Error ? e.message : String(e);
					log.warn('segmentation failed (non-fatal)', { error: msg });
					segStatus = null;
					evalError = { adjustmentId: '', error: `Segmentation error: ${msg}` };
				});
		}

		setup().catch((e: unknown) => {
			if (!alive) return;
			error = e instanceof Error ? e.message : String(e);
			log.error('setup failed', { error });
		});

		if (import.meta.env.DEV) {
			Object.defineProperty(window, '__editorState', {
				get: () => ({
					source,
					adjustments,
					geometry,
					versionNodes,
					fullPath,
					headNodeId,
					canUndo,
					canRedo,
					isAtLeaf,
					tags,
					evalError,
					schemas,
					zones,
					exportGroups,
					imageSize,
					error
				}),
				configurable: true
			});
			Object.defineProperty(window, '__editorActions', {
				get: () => ({
					addAdjustment: (pluginId: string) => handleAddAdjustment(pluginId),
					addGeometry: (pluginId: string) => handleAddGeometry(pluginId),
					addZone: (pluginId: string) => handleAddZone(pluginId),
					removeAdjustment: (id: string) => handleRemoveAdjustment(id),
					selectNode: (id: string) => {
						selectedId = id;
					},
					selectSource: () => {
						selectedId = '__source__';
					},
					addExportGroup: (pluginId: string) => handleAddGroup(pluginId)
				}),
				configurable: true
			});
		}

		// --- Event handlers: dual-path (FramerState when crop active, ViewerState otherwise) ---

		function onWheel(e: WheelEvent): void {
			e.preventDefault();
			const dpr = window.devicePixelRatio;
			const rect = canvasEl!.getBoundingClientRect();
			const x = (e.clientX - rect.left) * dpr;
			const y = (e.clientY - rect.top) * dpr;
			if (framerState) {
				applyLayout(framerState.zoom(-e.deltaY, x, y) as ViewLayout);
			} else if (viewerState) {
				applyLayout(viewerState.zoom(-e.deltaY, x, y));
			}
		}

		let lastX = 0;
		let lastY = 0;

		function onPointerDown(e: PointerEvent): void {
			if (e.button !== 0) return;
			if (!framerState && !viewerState) return;
			dragging = true;
			lastX = e.clientX;
			lastY = e.clientY;
			canvasEl!.setPointerCapture(e.pointerId);
		}

		function onPointerMove(e: PointerEvent): void {
			if (!dragging) return;
			const dpr = window.devicePixelRatio;
			const dx = (e.clientX - lastX) * dpr;
			const dy = (e.clientY - lastY) * dpr;
			lastX = e.clientX;
			lastY = e.clientY;
			if (framerState) {
				applyLayout(framerState.pan(dx, dy) as ViewLayout);
			} else if (viewerState) {
				applyLayout(viewerState.pan(dx, dy));
			}
		}

		function onPointerUp(): void {
			if (dragging && framerState) {
				emitCropParams();
			}
			dragging = false;
		}

		const observer = new ResizeObserver(() => {
			renderer.resize();
			if (framerState) {
				applyLayout(framerState.resize_viewport(canvasEl!.width, canvasEl!.height) as ViewLayout);
			} else if (viewerState) {
				applyLayout(viewerState.resize_canvas(canvasEl!.width, canvasEl!.height));
			}
		});
		observer.observe(canvasEl);

		canvasEl.addEventListener('wheel', onWheel, { passive: false });
		canvasEl.addEventListener('pointerdown', onPointerDown);
		canvasEl.addEventListener('pointermove', onPointerMove);
		canvasEl.addEventListener('pointerup', onPointerUp);
		canvasEl.addEventListener('pointercancel', onPointerUp);

		function onKeyDown(e: KeyboardEvent): void {
			if (!scheduler) return;
			const mod = e.metaKey || e.ctrlKey;
			if (mod && e.key === 'z' && !e.shiftKey) {
				e.preventDefault();
				scheduler.undo();
			} else if (mod && e.key === 'z' && e.shiftKey) {
				e.preventDefault();
				scheduler.redo();
			}
		}
		document.addEventListener('keydown', onKeyDown);

		// Assign $effect-local handlers (need viewerState/framerState/renderer)
		handleEnterCropMode = () => enterCropMode();
		handleExitCropMode = () => exitCropMode();
		handleUpdateCropRatio = (rw: number, rh: number, uiOverrides?: Partial<CropParams>) => {
			if (!framerState) return;
			applyLayout(framerState.set_ratio(rw, rh) as ViewLayout);
			emitCropParams(uiOverrides);
		};

		handleViewFrameChange = (pct: number) => {
			framePercentage = pct;
			if (!viewerState) return;
			applyLayout(viewerState.set_mat_fraction(pct / 100));
		};

		handleViewMatColorChange = (color: string) => {
			matColor = color;
			if (!viewerState) return;
			const [cr, cg, cb, ca] = hexToLinear(color);
			renderer.setBgColor(cr, cg, cb, ca);
			applyLayout(viewerState.layout());
		};

		return () => {
			alive = false;
			if (import.meta.env.DEV) {
				delete (window as unknown as Record<string, unknown>).__editorState;
				delete (window as unknown as Record<string, unknown>).__editorActions;
			}
			clearLogSink();
			observer.disconnect();
			document.removeEventListener('keydown', onKeyDown);
			canvasEl!.removeEventListener('wheel', onWheel);
			canvasEl!.removeEventListener('pointerdown', onPointerDown);
			canvasEl!.removeEventListener('pointermove', onPointerMove);
			canvasEl!.removeEventListener('pointerup', onPointerUp);
			canvasEl!.removeEventListener('pointercancel', onPointerUp);
			framerState?.free();
			scheduler?.destroy();
			schedulerRef = undefined;
			viewerState?.free();
			renderer.destroy();
		};
	});

	// Enter/exit crop mode when overlay activates/deactivates
	$effect(() => {
		if (activeOverlay) {
			untrack(() => handleEnterCropMode());
		} else {
			untrack(() => handleExitCropMode());
		}
	});

	let historyVisible: boolean = $state(false);
	let infoOpen: boolean = $state(false);
	let borderWidth: number = $state(2);
	let borderColor: string = $state('#ffffff');

	// Derive image metadata from source info for the MetadataPanel
	let imageMetadata = $derived({
		filename: source.entries[0]?.path?.split(/[/\\]/).pop() ?? '(no image)',
		title:
			source.entries[0]?.path
				?.split(/[/\\]/)
				.pop()
				?.replace(/\.[^.]+$/, '') ?? undefined,
		caption: source.entries[0]
			? `${source.entries[0].width} × ${source.entries[0].height} pixels`
			: undefined
	});

	// --- Resizable panels ---
	const MIN_HISTORY = 224; // w-56
	let historyWidth: number = $state(MIN_HISTORY);

	let resizing: boolean = $state(false);
	let resizeStart: number = $state(0);
	let resizeInitial: number = $state(0);

	function startResize(e: PointerEvent): void {
		e.preventDefault();
		resizing = true;
		resizeStart = e.clientX;
		resizeInitial = historyWidth;
		document.addEventListener('pointermove', onResizeMove);
		document.addEventListener('pointerup', onResizeEnd);
	}

	function onResizeMove(e: PointerEvent): void {
		if (!resizing) return;
		const delta = e.clientX - resizeStart;
		historyWidth = Math.max(MIN_HISTORY, resizeInitial + delta * -1);
	}

	function onResizeEnd(): void {
		resizing = false;
		document.removeEventListener('pointermove', onResizeMove);
		document.removeEventListener('pointerup', onResizeEnd);
	}
</script>

{#if error}
	<div class="bg-surface-0 text-danger flex h-full items-center justify-center">
		<p>{error}</p>
	</div>
{:else}
	<div class="bg-surface-0 flex h-full" class:select-none={resizing}>
		<!-- Image viewer column -->
		<div class="relative min-w-0 flex-1">
			<canvas
				bind:this={canvasEl}
				class="h-full w-full cursor-grab"
				class:cursor-grabbing={dragging}
			></canvas>

			{#if activeOverlay && currentLayout && imageSize && selectedAdjustment}
				{@const Overlay = activeOverlay.component}
				<Overlay
					params={selectedAdjustment.params}
					layout={currentLayout}
					{imageSize}
					onParamChange={(p) => handleParamChange(selectedAdjustment.id, p)}
				/>
			{/if}

			<!-- Floating main toolbar (top-center) -->
			<div class="pointer-events-none absolute top-3 right-0 left-0 flex justify-center">
				<div class="pointer-events-auto">
					<MainToolbar
						{canUndo}
						{canRedo}
						{infoOpen}
						{historyVisible}
						{matColor}
						onUndo={() => schedulerRef?.undo()}
						onRedo={() => schedulerRef?.redo()}
						onToggleInfo={() => (infoOpen = !infoOpen)}
						onToggleHistory={() => (historyVisible = !historyVisible)}
					/>
				</div>
			</div>

			<!-- Floating view settings toolbar (bottom-center) -->
			<div class="pointer-events-none absolute right-0 bottom-8 left-0 flex justify-center">
				<div class="pointer-events-auto">
					<ViewSettingsToolbar
						{matColor}
						matSize={framePercentage}
						{borderWidth}
						{borderColor}
						onMatColorChange={handleViewMatColorChange}
						onMatSizeChange={handleViewFrameChange}
						onBorderWidthChange={(w) => {
							borderWidth = w;
						}}
						onBorderColorChange={(c) => {
							borderColor = c;
						}}
					/>
				</div>
			</div>

			{#if segStatus}
				<div
					class="bg-surface-1/80 text-text-muted absolute right-3 bottom-3 rounded-full px-3 py-1 text-xs backdrop-blur-sm"
				>
					{segStatus}
				</div>
			{/if}

			<!-- Metadata panel (slides up from bottom) -->
			<MetadataPanel visible={infoOpen} metadata={imageMetadata} />
		</div>

		<!-- Right sidebar: card-based pipeline -->
		<div
			class="border-border bg-surface-1 relative flex w-48 flex-col border-l shadow-[-16px_0_48px_rgba(0,0,0,0.1)]"
			data-testid="pipeline-sidebar"
		>
			<div class="flex-1 overflow-y-auto">
				<!-- 1. Image phase (source + geometry) -->
				<PhaseGroup
					title="1. Image"
					addItems={geometryMenuItems}
					addEdge="left"
					onAdd={handleAddGeometry}
				>
					<!-- Source node (not removable) -->
					{#if source.entries.length > 0}
						{@const entry = source.entries[0]}
						<NodePanel
							title="Standard Image"
							icon={icons.source.component}
							index={0}
							isLast={geometry.length === 0}
						>
							<div
								class="border-border bg-surface-0/50 flex items-center gap-2 rounded-lg border p-1.5"
							>
								{#if thumbnailUrl}
									<img
										src={thumbnailUrl}
										alt="Source thumbnail"
										class="h-7 w-7 shrink-0 rounded-md object-cover shadow-sm"
									/>
								{/if}
								<div class="flex flex-1 flex-col overflow-hidden">
									<span
										class="text-text-secondary text-[length:var(--text-micro)] font-bold tracking-wider uppercase"
										>Source</span
									>
									<span class="text-text-muted truncate font-mono text-[length:var(--text-micro)]">
										{entry.path?.split('/').pop() ?? '(none)'}
									</span>
								</div>
							</div>
						</NodePanel>
					{/if}

					<!-- Geometry nodes (crop, etc.) — use ParamPanel for full schema rendering -->
					{#each geometry as node, i (node.id)}
						<NodePanel
							title={node.name}
							icon={iconFor(node.plugin_id)}
							index={i + 1}
							isLast={i === geometry.length - 1}
							onRemove={() => handleRemoveAdjustment(node.id)}
						>
							<ParamPanel
								adjustment={node}
								schema={schemas[node.plugin_id] ?? null}
								onParamChange={handleParamChange}
								onCropRatioChange={node.plugin_id === 'seer.crop'
									? handleUpdateCropRatio
									: undefined}
							/>
						</NodePanel>
					{/each}
				</PhaseGroup>

				<!-- 2. Zones phase -->
				<PhaseGroup
					title="2. Zones"
					addItems={zoneMenuItems}
					addEdge="left"
					onAdd={handleAddZone}
					empty={parts.length === 0}
				>
					{#each parts as zone, i (zone.id)}
						<NodePanel
							title={zone.name}
							icon={icons.zoneLuminance.component}
							index={i}
							isLast={i === parts.length - 1}
							onRemove={() => handleRemoveZone(zone.id)}
						>
							<span class="text-text-muted text-[length:var(--text-micro)]">{zone.kind}</span>
						</NodePanel>
					{/each}
				</PhaseGroup>

				<!-- 3. Adjustments phase -->
				<PhaseGroup
					title="3. Adjustments"
					addItems={adjustmentMenuItems}
					addEdge="left"
					onAdd={handleAddAdjustment}
				>
					{#each adjustments as adj, i (adj.id)}
						{@const schema = schemas[adj.plugin_id]}
						<NodePanel
							title={adj.name}
							icon={iconFor(adj.plugin_id)}
							index={i}
							isLast={i === adjustments.length - 1}
							onRemove={() => handleRemoveAdjustment(adj.id)}
						>
							{#if schema && schema.params.length > 0}
								<div class="flex flex-col gap-1">
									{#each schema.params as param (param.id)}
										{#if 'Float' in (param.param_type ?? {})}
											{@const ft = (param.param_type as { Float: { min: number; max: number } })
												.Float}
											<Slider
												label={param.label}
												value={unwrapFloat(adj.params[param.id])}
												min={ft.min}
												max={ft.max}
												onChange={(v) => handleParamChange(adj.id, { [param.id]: { Float: v } })}
											/>
										{:else if 'Bool' in (param.param_type ?? {})}
											<Toggle
												label={param.label}
												active={unwrapBool(adj.params[param.id])}
												onToggle={(v) => handleParamChange(adj.id, { [param.id]: { Bool: v } })}
											/>
										{:else if 'Curve' in (param.param_type ?? {})}
											<PopupCurve
												label={param.label}
												points={unwrapCurve(adj.params[param.id])}
												onChange={(pts) =>
													handleParamChange(adj.id, { [param.id]: { Curve: pts } })}
											/>
										{:else if 'Choice' in (param.param_type ?? {})}
											{@const ch = (
												param.param_type as {
													Choice: { options: { value: number; label: string }[] };
												}
											).Choice}
											<PopupSelect
												label={param.label}
												value={String(unwrapChoice(adj.params[param.id]))}
												options={ch.options.map((o) => ({
													value: String(o.value),
													label: o.label
												}))}
												onChange={(v) =>
													handleParamChange(adj.id, { [param.id]: { Choice: Number(v) } })}
											/>
										{:else if 'Color' in (param.param_type ?? {})}
											<PopupColorPicker
												label={param.label}
												color={rgbToHex(unwrapColor(adj.params[param.id]))}
												onChange={(hex) =>
													handleParamChange(adj.id, { [param.id]: { Color: hexToRgb(hex) } })}
											/>
										{/if}
									{/each}
								</div>
							{:else}
								<span
									class="text-text-faint text-[length:var(--text-micro)] font-bold tracking-widest uppercase"
									>No Parameters</span
								>
							{/if}
						</NodePanel>
					{/each}
				</PhaseGroup>

				<!-- 4. Export phase -->
				<PhaseGroup
					title="4. Export"
					addItems={availableExports.map((e) => ({
						id: e.id,
						icon: icons.source.component,
						label: e.name
					}))}
					addEdge="left"
					onAdd={(pluginId) => handleAddGroup(pluginId)}
					empty={exportGroups.length === 0}
				>
					{#each exportGroups as group, i (group.id)}
						<NodePanel
							title={group.name || 'Export Group'}
							icon={icons.source.component}
							index={i}
							isLast={i === exportGroups.length - 1}
							onRemove={() => handleRemoveGroup(group.id)}
						>
							<span class="text-text-muted text-[length:var(--text-micro)]">
								{group.children.length} encoder{group.children.length !== 1 ? 's' : ''}
							</span>
						</NodePanel>
					{/each}
				</PhaseGroup>
			</div>
		</div>

		<!-- History pane (toggled from viewer toolbar) -->
		{#if historyVisible}
			<Pane
				title="HISTORY"
				side="right"
				collapsed={false}
				onCollapse={() => (historyVisible = false)}
				onExpand={() => (historyVisible = true)}
				width={historyWidth}
				onResizeStart={startResize}
			>
				<div class="flex-1 overflow-y-auto p-3">
					<HistoryPanel
						nodes={fullPath}
						{headNodeId}
						{tags}
						onJumpTo={handleJumpTo}
						onTag={handleTag}
						onUntag={handleUntag}
					/>
				</div>
			</Pane>
		{/if}
	</div>
{/if}
