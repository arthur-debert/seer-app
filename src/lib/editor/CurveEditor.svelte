<script lang="ts">
	import type { ControlPoint } from './editor-bridge';

	interface Props {
		points: ControlPoint[];
		channel: string;
		onChange: (points: ControlPoint[]) => void;
	}

	let { points, channel, onChange }: Props = $props();

	const SIZE = 256;
	const PADDING = 8;
	const POINT_RADIUS = 6;

	const CHANNEL_COLORS: Record<string, string> = {
		master: 'var(--text-secondary)',
		red: 'var(--channel-red)',
		green: 'var(--channel-green)',
		blue: 'var(--channel-blue)'
	};

	let draggingIndex: number | null = $state(null);
	let svgEl: SVGSVGElement | undefined = $state(undefined);

	function curveColor(): string {
		return CHANNEL_COLORS[channel] ?? 'var(--text-secondary)';
	}

	/** Fritsch-Carlson monotone cubic Hermite — mirrors the Rust implementation. */
	function buildCurvePath(pts: ControlPoint[]): string {
		if (pts.length < 2) return '';

		const sorted = [...pts].sort((a, b) => a.x - b.x);
		const n = sorted.length;

		if (n === 2) {
			// Linear
			const samples: string[] = [];
			for (let i = 0; i <= SIZE; i++) {
				const t = i / SIZE;
				const frac =
					sorted[1].x === sorted[0].x
						? 0
						: Math.max(0, Math.min(1, (t - sorted[0].x) / (sorted[1].x - sorted[0].x)));
				const y = sorted[0].y + frac * (sorted[1].y - sorted[0].y);
				samples.push(`${toSvgX(t)},${toSvgY(y)}`);
			}
			return `M${samples.join(' L')}`;
		}

		// Compute secants
		const delta: number[] = [];
		const h: number[] = [];
		for (let i = 0; i < n - 1; i++) {
			const dx = sorted[i + 1].x - sorted[i].x;
			h.push(dx);
			delta.push(dx < 1e-10 ? 0 : (sorted[i + 1].y - sorted[i].y) / dx);
		}

		// Initial tangents
		const m: number[] = new Array(n).fill(0);
		m[0] = delta[0];
		m[n - 1] = delta[n - 2];
		for (let i = 1; i < n - 1; i++) {
			if (Math.sign(delta[i - 1]) !== Math.sign(delta[i])) {
				m[i] = 0;
			} else {
				m[i] = (delta[i - 1] + delta[i]) / 2;
			}
		}

		// Fritsch-Carlson monotonicity correction
		for (let i = 0; i < n - 1; i++) {
			if (Math.abs(delta[i]) < 1e-10) {
				m[i] = 0;
				m[i + 1] = 0;
			} else {
				const alpha = m[i] / delta[i];
				const beta = m[i + 1] / delta[i];
				const tau = alpha * alpha + beta * beta;
				if (tau > 9) {
					const s = 3 / Math.sqrt(tau);
					m[i] = s * alpha * delta[i];
					m[i + 1] = s * beta * delta[i];
				}
			}
		}

		// Sample 256 points
		const samples: string[] = [];
		for (let idx = 0; idx <= SIZE; idx++) {
			const t = idx / SIZE;
			let y: number;

			if (t <= sorted[0].x) {
				y = sorted[0].y;
			} else if (t >= sorted[n - 1].x) {
				y = sorted[n - 1].y;
			} else {
				// Find segment
				let seg = n - 2;
				for (let j = 1; j < n - 1; j++) {
					if (t < sorted[j].x) {
						seg = j - 1;
						break;
					}
				}
				const dx = sorted[seg + 1].x - sorted[seg].x;
				if (dx < 1e-10) {
					y = sorted[seg].y;
				} else {
					const s = (t - sorted[seg].x) / dx;
					const s2 = s * s;
					const s3 = s2 * s;
					const h00 = 2 * s3 - 3 * s2 + 1;
					const h10 = s3 - 2 * s2 + s;
					const h01 = -2 * s3 + 3 * s2;
					const h11 = s3 - s2;
					y =
						h00 * sorted[seg].y +
						h10 * dx * m[seg] +
						h01 * sorted[seg + 1].y +
						h11 * dx * m[seg + 1];
				}
			}

			samples.push(`${toSvgX(t)},${toSvgY(y)}`);
		}

		return `M${samples.join(' L')}`;
	}

	function toSvgX(val: number): number {
		return PADDING + val * SIZE;
	}

	function toSvgY(val: number): number {
		return PADDING + (1 - val) * SIZE;
	}

	function fromSvgCoords(clientX: number, clientY: number): { x: number; y: number } {
		if (!svgEl) return { x: 0, y: 0 };
		const rect = svgEl.getBoundingClientRect();
		const svgX = ((clientX - rect.left) / rect.width) * (SIZE + PADDING * 2);
		const svgY = ((clientY - rect.top) / rect.height) * (SIZE + PADDING * 2);
		return {
			x: Math.max(0, Math.min(1, (svgX - PADDING) / SIZE)),
			y: Math.max(0, Math.min(1, 1 - (svgY - PADDING) / SIZE))
		};
	}

	function onPointerDown(e: PointerEvent, index: number): void {
		e.preventDefault();
		(e.target as SVGElement).setPointerCapture(e.pointerId);
		draggingIndex = index;
	}

	function onPointerMove(e: PointerEvent): void {
		if (draggingIndex === null) return;
		const { x, y } = fromSvgCoords(e.clientX, e.clientY);
		const updated = [...points];
		const isEndpoint = draggingIndex === 0 || draggingIndex === points.length - 1;
		// Sort points by x to find endpoints
		const sorted = [...points].map((p, i) => ({ ...p, origIdx: i })).sort((a, b) => a.x - b.x);
		const isFirst = sorted[0].origIdx === draggingIndex;
		const isLast = sorted[sorted.length - 1].origIdx === draggingIndex;

		if (isFirst) {
			updated[draggingIndex] = { x: 0, y };
		} else if (isLast) {
			updated[draggingIndex] = { x: 1, y };
		} else if (isEndpoint) {
			updated[draggingIndex] = { x: points[draggingIndex].x, y };
		} else {
			updated[draggingIndex] = { x, y };
		}
		onChange(updated);
	}

	function onPointerUp(): void {
		draggingIndex = null;
	}

	function onSvgClick(e: MouseEvent): void {
		if (draggingIndex !== null) return;
		const { x, y } = fromSvgCoords(e.clientX, e.clientY);
		// Don't add too close to existing points
		for (const p of points) {
			if (Math.abs(p.x - x) < 0.03 && Math.abs(p.y - y) < 0.03) return;
		}
		const updated = [...points, { x, y }];
		updated.sort((a, b) => a.x - b.x);
		onChange(updated);
	}

	function onPointDblClick(e: MouseEvent, index: number): void {
		e.stopPropagation();
		// Don't remove if only 2 points remain
		if (points.length <= 2) return;
		// Don't remove endpoints (min x or max x)
		const sorted = [...points].map((p, i) => ({ ...p, origIdx: i })).sort((a, b) => a.x - b.x);
		if (sorted[0].origIdx === index || sorted[sorted.length - 1].origIdx === index) return;
		const updated = points.filter((_, i) => i !== index);
		onChange(updated);
	}

	function gridLines(): string[] {
		const lines: string[] = [];
		for (let i = 1; i <= 3; i++) {
			const v = (i / 4) * SIZE + PADDING;
			lines.push(`M${v},${PADDING} L${v},${SIZE + PADDING}`);
			lines.push(`M${PADDING},${v} L${SIZE + PADDING},${v}`);
		}
		return lines;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
	bind:this={svgEl}
	viewBox="0 0 {SIZE + PADDING * 2} {SIZE + PADDING * 2}"
	class="h-64 w-full cursor-crosshair rounded bg-neutral-900"
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onclick={onSvgClick}
>
	<!-- Grid lines -->
	{#each gridLines() as d, idx (idx)}
		<path {d} stroke="var(--text-faint)" stroke-width="0.5" fill="none" />
	{/each}

	<!-- Identity diagonal reference -->
	<line
		x1={PADDING}
		y1={SIZE + PADDING}
		x2={SIZE + PADDING}
		y2={PADDING}
		stroke="var(--border-strong)"
		stroke-width="0.5"
		stroke-dasharray="4,4"
	/>

	<!-- Curve -->
	<path d={buildCurvePath(points)} stroke={curveColor()} stroke-width="2" fill="none" />

	<!-- Control points -->
	{#each points as point, i (i)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<circle
			cx={toSvgX(point.x)}
			cy={toSvgY(point.y)}
			r={POINT_RADIUS}
			fill={draggingIndex === i ? curveColor() : 'var(--surface-1)'}
			stroke={curveColor()}
			stroke-width="2"
			class="cursor-grab"
			onpointerdown={(e) => onPointerDown(e, i)}
			ondblclick={(e) => onPointDblClick(e, i)}
		/>
	{/each}
</svg>
