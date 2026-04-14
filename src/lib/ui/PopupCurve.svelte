<script lang="ts">
	import Portal from './Portal.svelte';
	import RestartAlt from '~icons/material-symbols/restart-alt';
	import OpenInFull from '~icons/material-symbols/open-in-full';
	import CloseFullscreen from '~icons/material-symbols/close-fullscreen';

	interface ControlPoint {
		x: number;
		y: number;
	}

	interface Props {
		label: string;
		points: ControlPoint[];
		onChange: (points: ControlPoint[]) => void;
		/** Scale of the input/output points. Default 1 (0-1 range from Rust). */
		scale?: number;
	}

	let { label, points, onChange, scale = 1 }: Props = $props();

	// Internal display points are always 0-100. Convert from external scale.
	const S = $derived(scale <= 0 ? 1 : 100 / scale);
	const displayPoints = $derived(points.map((p) => ({ x: p.x * S, y: p.y * S })));

	function emitChange(pts: ControlPoint[]) {
		// Convert 0-100 display coords back to external scale
		const invS = scale / 100;
		onChange(pts.map((p) => ({ x: p.x * invS, y: p.y * invS })));
	}

	let isOpen = $state(false);
	let isLarge = $state(false);
	let triggerRect: DOMRect | null = $state(null);
	let draggingIdx: number | null = $state(null);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();

	// Offset tracking so point doesn't snap to cursor center
	let dragOffset = { x: 0, y: 0 };

	const popupWidth = $derived(isLarge ? 320 : 192);

	function getCurvePath(pts: ControlPoint[]): string {
		if (pts.length < 2) return '';
		if (pts.length === 2) return `M ${pts[0].x} ${100 - pts[0].y} L ${pts[1].x} ${100 - pts[1].y}`;

		let d = `M ${pts[0].x} ${100 - pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 =
				i === 0
					? { x: pts[0].x - (pts[1].x - pts[0].x), y: pts[0].y - (pts[1].y - pts[0].y) }
					: pts[i - 1];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 =
				i + 2 < pts.length ? pts[i + 2] : { x: p2.x + (p2.x - p1.x), y: p2.y + (p2.y - p1.y) };

			let tx1 = (p2.x - p0.x) / 6;
			let ty1 = (100 - p2.y - (100 - p0.y)) / 6;
			let tx2 = (p3.x - p1.x) / 6;
			let ty2 = (100 - p3.y - (100 - p1.y)) / 6;

			// Monotone clamping: scale tangents if they cross the boundary
			if (tx1 !== 0 && p1.x + tx1 > p2.x) {
				const scale = (p2.x - p1.x) / tx1;
				tx1 *= scale;
				ty1 *= scale;
			}
			if (tx2 !== 0 && p2.x - tx2 < p1.x) {
				const scale = (p2.x - p1.x) / tx2;
				tx2 *= scale;
				ty2 *= scale;
			}

			const cp1x = p1.x + tx1;
			const cp1y = 100 - p1.y + ty1;
			const cp2x = p2.x - tx2;
			const cp2y = 100 - p2.y - ty2;

			d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${100 - p2.y}`;
		}
		return d;
	}

	const curvePath = $derived(getCurvePath(displayPoints));

	function handleOpen() {
		if (triggerEl) {
			triggerRect = triggerEl.getBoundingClientRect();
		}
		isOpen = true;
	}

	function handleClose() {
		isOpen = false;
		draggingIdx = null;
	}

	function handleReset() {
		draggingIdx = null;
		onChange([
			{ x: 0, y: 0 },
			{ x: scale, y: scale }
		]);
	}

	function svgCoords(e: PointerEvent): { x: number; y: number } {
		if (!svgEl) return { x: 0, y: 0 };
		const box = svgEl.getBoundingClientRect();
		const ptrX = ((e.clientX - box.left) / box.width) * 100;
		const ptrY = 100 - ((e.clientY - box.top) / box.height) * 100;
		return { x: ptrX, y: ptrY };
	}

	function handlePointPointerDown(e: PointerEvent, index: number) {
		e.stopPropagation();
		(e.target as Element).setPointerCapture(e.pointerId);
		draggingIdx = index;

		const ptr = svgCoords(e);
		dragOffset = { x: ptr.x - displayPoints[index].x, y: ptr.y - displayPoints[index].y };
	}

	function handleSvgPointerDown(e: PointerEvent) {
		if (draggingIdx !== null) return;
		(e.target as Element).setPointerCapture(e.pointerId);

		const ptr = svgCoords(e);
		const x = Math.max(0, Math.min(100, ptr.x));
		const y = Math.max(0, Math.min(100, ptr.y));

		const newPoint = { x, y };
		const newPoints = [...displayPoints, newPoint].sort((a, b) => a.x - b.x);
		const newIdx = newPoints.indexOf(newPoint);

		draggingIdx = newIdx;
		dragOffset = { x: 0, y: 0 };
		emitChange(newPoints);
	}

	function handleDoubleClick(e: MouseEvent, index: number) {
		e.stopPropagation();
		if (index === 0 || index === displayPoints.length - 1) return;
		draggingIdx = null;
		emitChange(displayPoints.filter((_, i) => i !== index));
	}

	function handlePointerMove(e: PointerEvent) {
		if (draggingIdx === null) return;
		const idx = draggingIdx;

		const ptr = svgCoords(e);
		let x = ptr.x - dragOffset.x;
		let y = ptr.y - dragOffset.y;

		const prev = displayPoints;
		const minX = idx > 0 ? prev[idx - 1].x + 2 : 0;
		const maxX = idx < prev.length - 1 ? prev[idx + 1].x - 2 : 100;

		let finalX = x;
		if (idx === 0) finalX = 0;
		if (idx === prev.length - 1) finalX = 100;
		finalX = Math.max(minX, Math.min(maxX, finalX));

		const finalY = Math.max(0, Math.min(100, y));

		const newPoints = [...prev];
		newPoints[idx] = { x: finalX, y: finalY };
		emitChange(newPoints);
	}

	function handlePointerUp(e: PointerEvent) {
		const target = e.target as Element;
		if (target.hasPointerCapture && target.hasPointerCapture(e.pointerId)) {
			target.releasePointerCapture(e.pointerId);
		}
		draggingIdx = null;
	}
</script>

<!-- Trigger row -->
<div class="relative mb-1 flex flex-col py-0.5">
	<div class="flex items-center justify-between">
		<span
			class="text-text-secondary text-[length:var(--text-caption)] leading-[15px] font-bold tracking-tight select-none"
		>
			{label}
		</span>
		<button
			bind:this={triggerEl}
			onclick={handleOpen}
			aria-label="Edit {label}"
			class="border-border bg-surface-0/50 hover:bg-surface-2 flex h-6 w-10 items-center justify-center rounded-md border transition-colors"
		>
			<svg viewBox="0 0 100 100" class="h-full w-full overflow-visible p-1">
				<path
					d={curvePath}
					fill="none"
					stroke="currentColor"
					stroke-width="4"
					class="text-text-primary"
				/>
			</svg>
		</button>
	</div>
</div>

<!-- Portal popup -->
{#if isOpen && triggerRect}
	<Portal>
		<div class="pointer-events-none fixed inset-0 z-[10000]">
			<!-- Backdrop -->
			<div
				class="pointer-events-auto absolute inset-0"
				onclick={handleClose}
				onwheel={handleClose}
				role="presentation"
				data-testid="popup-curve-backdrop"
			></div>

			<!-- Popup panel -->
			<div
				class="bg-card-bg/95 border-card-border pointer-events-auto absolute flex flex-col gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-2xl"
				style="top: {triggerRect.top - 16}px; right: {typeof window !== 'undefined'
					? window.innerWidth - triggerRect.left + 16
					: 0}px; width: {popupWidth}px;"
				data-testid="popup-curve-popup"
			>
				<!-- Header -->
				<div class="mb-1 flex items-center justify-between">
					<span
						class="text-text-primary text-[length:var(--text-body)] font-semibold tracking-tight select-none"
					>
						Curve
					</span>
					<div class="flex items-center gap-1">
						<button
							onclick={handleReset}
							class="text-text-muted hover:text-text-primary p-1 transition-colors"
							title="Reset Curve"
							aria-label="Reset Curve"
						>
							<RestartAlt class="h-3 w-3" />
						</button>
						<button
							onclick={() => (isLarge = !isLarge)}
							class="text-text-muted hover:text-text-primary p-1 transition-colors"
							title="Toggle Size"
							aria-label="Toggle Size"
						>
							{#if isLarge}
								<CloseFullscreen class="h-3 w-3" />
							{:else}
								<OpenInFull class="h-3 w-3" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Curve editor area -->
				<div class="relative aspect-square w-full touch-none">
					<!-- Grid background (clipped) -->
					<div
						class="bg-surface-1/50 border-border pointer-events-none absolute inset-0 overflow-hidden rounded-xl border"
					>
						<svg viewBox="0 0 100 100" class="h-full w-full overflow-visible">
							{#each [25, 50, 75] as v (v)}
								<line
									x1={v}
									y1="0"
									x2={v}
									y2="100"
									stroke="var(--text-faint)"
									stroke-opacity="0.15"
									stroke-width="0.5"
								/>
								<line
									x1="0"
									y1={v}
									x2="100"
									y2={v}
									stroke="var(--text-faint)"
									stroke-opacity="0.15"
									stroke-width="0.5"
								/>
							{/each}
							<!-- Identity diagonal -->
							<line
								x1="0"
								y1="100"
								x2="100"
								y2="0"
								stroke="var(--text-faint)"
								stroke-opacity="0.2"
								stroke-width="0.5"
								stroke-dasharray="2 2"
							/>
						</svg>
					</div>

					<!-- Interactive SVG layer -->
					<svg
						bind:this={svgEl}
						viewBox="0 0 100 100"
						role="img"
						aria-label="Tone curve editor"
						class="absolute inset-0 h-full w-full cursor-crosshair overflow-visible"
						onpointerdown={handleSvgPointerDown}
						onpointermove={(e) => {
							if (e.buttons > 0) handlePointerMove(e);
						}}
						onpointerup={handlePointerUp}
						onpointerleave={handlePointerUp}
					>
						<!-- Curve path -->
						<path
							d={curvePath}
							fill="none"
							stroke="var(--text-primary)"
							stroke-width={isLarge ? 0.75 : 1.25}
							pointer-events="none"
						/>

						<!-- Control points -->
						{#each displayPoints as p, i (i)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<g
								class="cursor-pointer"
								onpointerdown={(e) => handlePointPointerDown(e, i)}
								ondblclick={(e) => handleDoubleClick(e, i)}
							>
								<!-- Invisible hit area -->
								<circle cx={p.x} cy={100 - p.y} r={12} fill="transparent" />
								<!-- Visual point -->
								<circle
									cx={p.x}
									cy={100 - p.y}
									r={draggingIdx === i ? (isLarge ? 3 : 4) : isLarge ? 2 : 2.5}
									fill="var(--surface-0)"
									stroke="var(--text-primary)"
									stroke-width={isLarge ? 0.5 : 1}
									pointer-events="none"
									opacity={i === 0 || i === displayPoints.length - 1 ? 0.5 : 1}
									style="transition: r 0.15s ease"
								/>
							</g>
						{/each}
					</svg>
				</div>
			</div>
		</div>
	</Portal>
{/if}
