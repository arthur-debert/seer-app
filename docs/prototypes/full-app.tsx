import React, { useState, useMemo, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import {
	MousePointer2,
	Pencil,
	Type,
	Square,
	Circle,
	Layout,
	Settings,
	Layers,
	Eraser,
	Grab,
	X,
	Star,
	MousePointerSquareDashed,
	Hand,
	Trash2,
	Copy,
	Plus,
	Move,
	RotateCw,
	Maximize,
	Filter,
	Palette,
	ImageIcon,
	Hexagon,
	Triangle,
	Pentagon,
	ChevronRight,
	Eye,
	EyeOff,
	Lock,
	Unlock,
	MoreVertical,
	Sun,
	Contrast as ContrastIcon,
	Droplets,
	Zap,
	Crop,
	FileImage,
	Camera,
	Target,
	Pipette,
	Move3d,
	Paintbrush,
	Aperture,
	Thermometer,
	Activity,
	Wind,
	Sparkles,
	Download,
	Info,
	Check,
	Maximize2,
	Minimize2,
	Monitor,
	Undo2,
	Redo2,
	MapPin,
	Watch,
	ChevronDown,
	Frame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- STYLES HELPER ---
const SMALL_TEXT_STYLE =
	'text-[10px] font-bold leading-[15px] h-[15px] opacity-60 tracking-tight font-sans select-none';
const TITLE_TEXT_STYLE =
	'text-[13px] font-bold tracking-tighter opacity-90 text-neutral-900 font-sans select-none';

// --- DATA STRUCTURE: PHASES ---
const PHASES = [
	{
		id: 'image',
		label: '1. Image',
		nodes: [
			{ id: 'seer.source.standard', label: 'Standard Image', icon: FileImage },
			{ id: 'seer.source.raw', label: 'RAW / DNG', icon: Camera },
			{ id: 'seer.crop', label: 'Crop', icon: Crop }
		]
	},
	{
		id: 'zones',
		label: '2. Zones',
		nodes: [
			{ id: 'seer.zone.luminance', label: 'Luminance', icon: Target },
			{ id: 'seer.zone.color-range', label: 'Color Range', icon: Pipette },
			{ id: 'seer.zone.gradient', label: 'Gradient', icon: Move3d },
			{ id: 'seer.zone.brush', label: 'Brush', icon: Paintbrush },
			{ id: 'seer.zone.segmentation', label: 'AI Segmentation', icon: Aperture }
		]
	},
	{
		id: 'adjustments',
		label: '3. Adjustments',
		nodes: [
			{ id: 'seer.white-balance', label: 'White Balance', icon: Thermometer },
			{ id: 'seer.tone-curve', label: 'Tone Curve', icon: Activity },
			{ id: 'seer.color-adjust', label: 'Color Adjust', icon: Palette },
			{ id: 'seer.clahe', label: 'CLAHE', icon: Sparkles },
			{ id: 'seer.denoise', label: 'Denoise', icon: Wind }
		]
	},
	{
		id: 'output',
		label: '4. Export',
		nodes: [
			{ id: 'seer.output.png', label: 'PNG Encoder', icon: Download },
			{ id: 'seer.output.jpeg', label: 'JPEG Encoder', icon: ImageIcon },
			{ id: 'seer.output-child.resize', label: 'Resize', icon: Maximize2 },
			{ id: 'seer.output-child.metadata', label: 'Metadata', icon: Info }
		]
	}
];

// --- UTILS ---
const getContrastingColor = (hex) => {
	if (hex === '#ffffff') return 'text-neutral-900';
	return 'text-white';
};

const hexToHsb = (hex) => {
	let r = parseInt(hex.slice(1, 3), 16) / 255;
	let g = parseInt(hex.slice(3, 5), 16) / 255;
	let b_ = parseInt(hex.slice(5, 7), 16) / 255;

	let max = Math.max(r, g, b_),
		min = Math.min(r, g, b_);
	let h = 0,
		s,
		v = max;
	let d = max - min;
	s = max === 0 ? 0 : d / max;

	if (max !== min) {
		switch (max) {
			case r:
				h = (g - b_) / d + (g < b_ ? 6 : 0);
				break;
			case g:
				h = (b_ - r) / d + 2;
				break;
			case b_:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return { h: Math.round(h * 360), s: Math.round(s * 100), b: Math.round(v * 100) };
};

const hsbToHex = (h, s, b) => {
	s /= 100;
	b /= 100;
	const k = (n) => (n + h / 60) % 6;
	const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
	const toHex = (x) => {
		const hex = Math.round(x * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};
	return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
};

// --- PORTAL SYSTEM ---
const Portal = ({ children }) => {
	if (typeof document === 'undefined') return null;
	return createPortal(children, document.body);
};

// --- COMPONENTS ---

const NodePanel = forwardRef(
	(
		{
			children,
			title,
			icon: Icon,
			onRemove,
			isFirst = false,
			isLast = false,
			hideRemove = false,
			index = 0
		},
		ref
	) => {
		return (
			<motion.div
				ref={ref}
				layout
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.98, y: -10 }}
				className="relative flex w-full flex-col border-t border-black/5 bg-white/80 backdrop-blur-xl"
				style={{ zIndex: 50 - index }}
			>
				<div className="relative z-10 flex items-center justify-between border-b border-black/5 px-3 py-2.5">
					<div className="flex items-center gap-2 truncate">
						{Icon && <Icon size={12} className="flex-shrink-0 text-neutral-800 opacity-50" />}
						<span className={`${TITLE_TEXT_STYLE} truncate`}>{title}</span>
					</div>
					{!hideRemove && (
						<button
							onClick={onRemove}
							className="ml-2 flex-shrink-0 text-neutral-400 transition-colors hover:text-red-500"
						>
							<X size={12} />
						</button>
					)}
				</div>

				<div className="relative z-20 flex flex-col gap-2 px-3 py-3">{children}</div>

				{!isLast && (
					<div className="pointer-events-none absolute -bottom-[6px] left-1/2 z-[5] h-[7px] w-[12px] -translate-x-1/2 drop-shadow-sm">
						<svg viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M0 0 L6 7 L12 0 Z" fill="#fafafa" />
							<path d="M0 0 L6 7 L12 0" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
						</svg>
					</div>
				)}
			</motion.div>
		);
	}
);

// Interactive Slider
const Slider = ({ label, value, min = 0, max = 100, onChange }) => {
	const [localVal, setLocalVal] = useState(value);
	React.useEffect(() => setLocalVal(value), [value]);

	const trackRef = React.useRef(null);

	const handlePointer = (e) => {
		if (!trackRef.current) return;
		const rect = trackRef.current.getBoundingClientRect();
		let p = (e.clientX - rect.left) / rect.width;
		p = Math.max(0, Math.min(1, p));
		const newVal = Math.round(min + p * (max - min));
		setLocalVal(newVal);
		if (onChange) onChange(newVal);
	};

	return (
		<div className="mb-1 flex flex-col gap-1 last:mb-0">
			<div className="flex items-center justify-between">
				<span className={SMALL_TEXT_STYLE}>{label}</span>
				<span className="text-[9px] font-bold text-neutral-800 opacity-80">{localVal}</span>
			</div>
			<div
				ref={trackRef}
				className="relative h-1.5 cursor-pointer overflow-hidden rounded-full bg-neutral-200/50"
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					handlePointer(e);
				}}
				onPointerMove={(e) => {
					if (e.buttons > 0) handlePointer(e);
				}}
			>
				<div
					className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-neutral-900"
					style={{ width: `${((localVal - min) / (max - min)) * 100}%` }}
				/>
			</div>
		</div>
	);
};

// Interactive Toggle
const Toggle = ({ label, active }) => {
	const [localActive, setLocalActive] = useState(active);
	return (
		<div
			className="mb-1 flex cursor-pointer items-center justify-between py-1"
			onClick={() => setLocalActive(!localActive)}
		>
			<span className={SMALL_TEXT_STYLE}>{label}</span>
			<div
				className={`relative h-3 w-6 rounded-full transition-colors ${localActive ? 'bg-neutral-900' : 'bg-neutral-300'}`}
			>
				<div
					className={`absolute top-[2px] h-2 w-2 rounded-full bg-white shadow-sm transition-all ${localActive ? 'left-[14px]' : 'left-[2px]'}`}
				/>
			</div>
		</div>
	);
};

// Portal-powered Select
const Select = ({ label, value, options }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [selected, setSelected] = useState(value);
	const [rect, setRect] = useState(null);
	const triggerRef = React.useRef(null);

	const handleOpen = () => {
		setRect(triggerRef.current.getBoundingClientRect());
		setIsOpen(true);
	};

	return (
		<div className="relative mb-1 flex items-center justify-between py-0.5">
			<span className={SMALL_TEXT_STYLE}>{label}</span>
			<button
				ref={triggerRef}
				onClick={handleOpen}
				className="flex items-center gap-1.5 rounded-md border border-black/5 bg-black/5 px-2 py-0.5 transition-colors hover:bg-black/10"
			>
				<span className="text-[9px] font-bold tracking-tight text-neutral-800">{selected}</span>
				<ChevronDown size={10} className="opacity-40" />
			</button>

			<AnimatePresence>
				{isOpen && rect && (
					<Portal>
						<div className="pointer-events-none fixed inset-0 z-[10000]">
							<div
								className="pointer-events-auto absolute inset-0"
								onClick={() => setIsOpen(false)}
								onWheel={() => setIsOpen(false)}
							/>
							<motion.div
								initial={{ opacity: 0, scale: 0.95, y: -5 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: -5 }}
								transition={{ type: 'spring', stiffness: 400, damping: 25 }}
								className="pointer-events-auto absolute w-24 overflow-hidden rounded-lg border border-black/5 bg-white/95 py-1 shadow-xl backdrop-blur-2xl"
								style={{ top: rect.bottom + 4, left: rect.left - 4 }}
							>
								{options.map((opt) => (
									<button
										key={opt.value}
										onClick={() => {
											setSelected(opt.label);
											setIsOpen(false);
										}}
										className={`w-full px-3 py-1.5 text-left text-[9px] font-bold tracking-tight transition-colors ${selected === opt.label ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-black/5'}`}
									>
										{opt.label}
									</button>
								))}
							</motion.div>
						</div>
					</Portal>
				)}
			</AnimatePresence>
		</div>
	);
};

// Advanced Spline-driven Tone Curve
const ToneCurve = ({ label }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [isLarge, setIsLarge] = useState(false);
	const [rect, setRect] = useState(null);
	const triggerRef = React.useRef(null);

	const [points, setPoints] = useState([
		{ x: 0, y: 0 },
		{ x: 25, y: 25 },
		{ x: 50, y: 50 },
		{ x: 75, y: 75 },
		{ x: 100, y: 100 }
	]);

	// Synchronous refs for flawless drag tracking without React state lag
	const [draggingIdx, setDraggingIdx] = useState(null);
	const draggingIdxRef = React.useRef(null);
	const dragOffsetRef = React.useRef({ x: 0, y: 0 });
	const svgRef = React.useRef(null);

	// Advanced Catmull-Rom with Monotone Clamping to prevent visual overshoots/loops
	const getCurvePath = (pts) => {
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

			// Scale down tangents if they cross the boundary (Prevents backwards loops)
			if (p1.x + tx1 > p2.x) {
				const scale = (p2.x - p1.x) / tx1;
				tx1 *= scale;
				ty1 *= scale;
			}
			if (p2.x - tx2 < p1.x) {
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
	};

	const handleOpen = () => {
		setRect(triggerRef.current.getBoundingClientRect());
		setIsOpen(true);
	};

	const handlePointerDown = (e, index) => {
		e.stopPropagation();
		e.target.setPointerCapture(e.pointerId);
		draggingIdxRef.current = index;
		setDraggingIdx(index);

		// Lock the exact pointer offset so the node doesn't "snap" to the cursor center
		if (svgRef.current) {
			const box = svgRef.current.getBoundingClientRect();
			let ptrX = ((e.clientX - box.left) / box.width) * 100;
			let ptrY = 100 - ((e.clientY - box.top) / box.height) * 100;
			dragOffsetRef.current = { x: ptrX - points[index].x, y: ptrY - points[index].y };
		}
	};

	const handleSvgPointerDown = (e) => {
		if (draggingIdxRef.current !== null) return; // Ignore if already holding a point
		e.target.setPointerCapture(e.pointerId);

		const box = svgRef.current.getBoundingClientRect();
		let ptrX = ((e.clientX - box.left) / box.width) * 100;
		let ptrY = 100 - ((e.clientY - box.top) / box.height) * 100;

		let x = Math.max(0, Math.min(100, ptrX));
		let y = Math.max(0, Math.min(100, ptrY));

		const newPoint = { x, y };
		const newPoints = [...points, newPoint].sort((a, b) => a.x - b.x);
		const newIdx = newPoints.indexOf(newPoint);

		setPoints(newPoints);
		draggingIdxRef.current = newIdx;
		setDraggingIdx(newIdx);
		dragOffsetRef.current = { x: 0, y: 0 };
	};

	const handleDoubleClick = (e, index) => {
		e.stopPropagation();
		if (index === 0 || index === points.length - 1) return; // Endpoints cannot be removed
		setPoints((prev) => prev.filter((_, i) => i !== index));
		draggingIdxRef.current = null;
		setDraggingIdx(null);
	};

	const handlePointerMove = (e) => {
		const idx = draggingIdxRef.current;
		if (idx === null || !svgRef.current) return;
		const box = svgRef.current.getBoundingClientRect();

		let ptrX = ((e.clientX - box.left) / box.width) * 100;
		let ptrY = 100 - ((e.clientY - box.top) / box.height) * 100;

		let x = ptrX - dragOffsetRef.current.x;
		let y = ptrY - dragOffsetRef.current.y;

		setPoints((prev) => {
			const minX = idx > 0 ? prev[idx - 1].x + 2 : 0;
			const maxX = idx < prev.length - 1 ? prev[idx + 1].x - 2 : 100;

			let finalX = x;
			if (idx === 0) finalX = 0;
			if (idx === prev.length - 1) finalX = 100;
			finalX = Math.max(minX, Math.min(maxX, finalX));

			let finalY = Math.max(0, Math.min(100, y));

			const newPoints = [...prev];
			newPoints[idx] = { x: finalX, y: finalY };
			return newPoints;
		});
	};

	const handlePointerUp = (e) => {
		if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) {
			e.target.releasePointerCapture(e.pointerId);
		}
		draggingIdxRef.current = null;
		setDraggingIdx(null);
	};

	const handleReset = () => {
		setPoints([
			{ x: 0, y: 0 },
			{ x: 100, y: 100 }
		]);
		draggingIdxRef.current = null;
		setDraggingIdx(null);
	};

	return (
		<div className="relative mb-1 flex flex-col py-0.5">
			<div className="flex items-center justify-between">
				<span className={SMALL_TEXT_STYLE}>{label}</span>
				<button
					ref={triggerRef}
					onClick={handleOpen}
					className="flex h-6 w-10 items-center justify-center rounded-md border border-black/10 bg-black/5 transition-colors hover:bg-black/10"
				>
					<svg viewBox="0 0 100 100" className="h-full w-full overflow-visible p-1">
						<path d={getCurvePath(points)} fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="4" />
					</svg>
				</button>
			</div>

			<AnimatePresence>
				{isOpen && rect && (
					<Portal>
						<div className="pointer-events-none fixed inset-0 z-[10000]">
							<div
								className="pointer-events-auto absolute inset-0"
								onClick={() => setIsOpen(false)}
								onWheel={() => setIsOpen(false)}
							/>
							<motion.div
								initial={{ opacity: 0, scale: 0.9, x: 10 }}
								animate={{ opacity: 1, scale: 1, x: 0, width: isLarge ? 320 : 192 }}
								exit={{ opacity: 0, scale: 0.9, x: 10 }}
								transition={{ type: 'spring', stiffness: 400, damping: 30 }}
								className="pointer-events-auto absolute flex flex-col gap-3 rounded-2xl border border-black/5 bg-white/95 p-4 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
								style={{ top: rect.top - 16, right: window.innerWidth - rect.left + 16 }}
							>
								<div className="mb-1 flex items-center justify-between">
									<span className={TITLE_TEXT_STYLE}>Curve</span>
									<div className="flex items-center gap-1">
										<button
											onClick={handleReset}
											className="p-1 text-neutral-400 transition-colors hover:text-neutral-900"
											title="Reset Curve"
										>
											<RotateCw size={12} />
										</button>
										<button
											onClick={() => setIsLarge(!isLarge)}
											className="p-1 text-neutral-400 transition-colors hover:text-neutral-900"
											title="Toggle Size"
										>
											{isLarge ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
										</button>
									</div>
								</div>

								<div className="relative aspect-square w-full touch-none">
									{/* Layer 1: Strictly clipped Background and Grid */}
									<div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-black/5 bg-neutral-100/50">
										<svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
											{[25, 50, 75].map((v) => (
												<g key={v}>
													<line
														x1={v}
														y1="0"
														x2={v}
														y2="100"
														stroke="rgba(0,0,0,0.06)"
														strokeWidth="0.5"
													/>
													<line
														x1="0"
														y1={v}
														x2="100"
														y2={v}
														stroke="rgba(0,0,0,0.06)"
														strokeWidth="0.5"
													/>
												</g>
											))}
											<line
												x1="0"
												y1="100"
												x2="100"
												y2="0"
												stroke="rgba(0,0,0,0.1)"
												strokeWidth="0.5"
												strokeDasharray="2 2"
											/>
										</svg>
									</div>

									{/* Layer 2: Interactive SVG strictly overflowing boundaries */}
									<svg
										ref={svgRef}
										viewBox="0 0 100 100"
										className="absolute inset-0 h-full w-full cursor-crosshair overflow-visible"
										onPointerDown={handleSvgPointerDown}
										onPointerMove={(e) => {
											if (e.buttons > 0) handlePointerMove(e);
										}}
										onPointerUp={handlePointerUp}
										onPointerLeave={handlePointerUp}
									>
										<path
											d={getCurvePath(points)}
											fill="none"
											stroke="rgba(0,0,0,0.8)"
											strokeWidth={isLarge ? '0.75' : '1.25'}
											pointerEvents="none"
										/>

										{points.map((p, i) => (
											<g
												key={i}
												className="cursor-pointer"
												onPointerDown={(e) => handlePointerDown(e, i)}
												onDoubleClick={(e) => handleDoubleClick(e, i)}
											>
												{/* Invisible large hit area for easier grabbing */}
												<circle cx={p.x} cy={100 - p.y} r={12} fill="transparent" />
												{/* Visual Point */}
												<circle
													cx={p.x}
													cy={100 - p.y}
													r={draggingIdx === i ? (isLarge ? 3 : 4) : isLarge ? 2 : 2.5}
													className={`pointer-events-none fill-white stroke-neutral-900 ${i === 0 || i === points.length - 1 ? 'opacity-50' : ''}`}
													style={{ transition: 'r 0.15s ease' }}
													strokeWidth={isLarge ? 0.5 : 1}
												/>
											</g>
										))}
									</svg>
								</div>
							</motion.div>
						</div>
					</Portal>
				)}
			</AnimatePresence>
		</div>
	);
};

const RECENT_COLORS = [
	{ h: 210, s: 90, b: 100 }, // Blue
	{ h: 45, s: 95, b: 100 }, // Yellow
	{ h: 150, s: 80, b: 100 } // Emerald
];

// Portal-powered ColorPicker
const ColorPicker = ({ label, initialColor, showRecents = false, showSliders = false }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [rect, setRect] = useState(null);
	const triggerRef = React.useRef(null);

	const initHSB = useMemo(() => hexToHsb(initialColor), [initialColor]);
	const [h, setH] = useState(initHSB.h);
	const [s, setS] = useState(initHSB.s);
	const [b, setB] = useState(initHSB.b);

	const wheelRef = React.useRef(null);

	const handleOpen = () => {
		setRect(triggerRef.current.getBoundingClientRect());
		setIsOpen(true);
	};

	const handlePointer = (e) => {
		if (!wheelRef.current) return;
		const box = wheelRef.current.getBoundingClientRect();
		const cx = box.left + box.width / 2;
		const cy = box.top + box.height / 2;
		const dx = e.clientX - cx;
		const dy = e.clientY - cy; // Y points down in DOM
		const maxR = box.width / 2;

		let dist = Math.sqrt(dx * dx + dy * dy);
		let newS = Math.min(100, (dist / maxR) * 100);

		let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
		let newH = angle + 90;
		if (newH < 0) newH += 360;

		// Magnetic Snapping
		if (showRecents) {
			for (const rc of RECENT_COLORS) {
				const rcRad = ((rc.h - 90) * Math.PI) / 180;
				const rcDist = (rc.s / 100) * maxR;
				const rcDx = Math.cos(rcRad) * rcDist;
				const rcDy = Math.sin(rcRad) * rcDist;

				const snapDist = Math.sqrt(Math.pow(dx - rcDx, 2) + Math.pow(dy - rcDy, 2));
				if (snapDist < maxR * 0.15) {
					// Snap radius: 15% of wheel
					newH = rc.h;
					newS = rc.s;
					break;
				}
			}
		}

		setH(Math.round(newH));
		setS(Math.round(newS));
	};

	const getDotStyle = (hue, sat, offset) => {
		const rad = ((hue - 90) * Math.PI) / 180;
		const r = (sat / 100) * 50; // 50% radius
		return {
			left: `calc(${50 + r * Math.cos(rad)}% - ${offset}px)`,
			top: `calc(${50 + r * Math.sin(rad)}% - ${offset}px)`
		};
	};

	const currentColor = hsbToHex(h, s, b);

	return (
		<div className="relative mb-1 flex flex-col py-0.5">
			<div className="flex items-center justify-between">
				<span className={SMALL_TEXT_STYLE}>{label}</span>
				<button
					ref={triggerRef}
					onClick={handleOpen}
					className="h-4 w-4 rounded-full border border-black/10 shadow-sm ring-2 ring-transparent transition-transform hover:scale-110 hover:ring-black/5 focus:ring-black/10"
					style={{ backgroundColor: currentColor }}
				/>
			</div>

			<AnimatePresence>
				{isOpen && rect && (
					<Portal>
						<div className="pointer-events-none fixed inset-0 z-[10000]">
							<div
								className="pointer-events-auto absolute inset-0"
								onClick={() => setIsOpen(false)}
								onWheel={() => setIsOpen(false)}
							/>
							<motion.div
								initial={{ opacity: 0, scale: 0.9, x: 10 }}
								animate={{ opacity: 1, scale: 1, x: 0 }}
								exit={{ opacity: 0, scale: 0.9, x: 10 }}
								transition={{ type: 'spring', stiffness: 400, damping: 25 }}
								className="pointer-events-auto absolute flex min-w-[140px] flex-col gap-3 rounded-3xl border border-black/5 bg-white/95 p-3 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
								style={{ top: rect.top - 20, right: window.innerWidth - rect.left + 16 }} // Pops out entirely to the left of the button
							>
								{/* Interactive Color Wheel Container */}
								<div
									ref={wheelRef}
									className="relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-full border border-black/5 shadow-inner"
									style={{
										background:
											'conic-gradient(from 90deg at 50% 50%, red, yellow, lime, aqua, blue, magenta, red)'
									}}
									onPointerDown={(e) => {
										e.currentTarget.setPointerCapture(e.pointerId);
										handlePointer(e);
									}}
									onPointerMove={(e) => {
										if (e.buttons > 0) handlePointer(e);
									}}
								>
									{/* Desaturation Center */}
									<div
										className="pointer-events-none absolute inset-0 rounded-full"
										style={{
											background: 'radial-gradient(circle closest-side, white 0%, transparent 100%)'
										}}
									/>

									{/* Brightness Overlay Filter */}
									<div
										className="pointer-events-none absolute inset-0 rounded-full bg-black transition-opacity"
										style={{ opacity: 1 - b / 100 }}
									/>

									{/* Active Selection Ring (Removed position transitions for instant tracking) */}
									<div
										className="pointer-events-none absolute z-20 h-3 w-3 rounded-full border-2 border-white shadow-md"
										style={{ ...getDotStyle(h, s, 6), backgroundColor: hsbToHex(h, s, 100) }}
									/>

									{/* Recent Colors (Snapping Targets) */}
									{showRecents &&
										RECENT_COLORS.map((rc, idx) => (
											<button
												key={idx}
												className="absolute z-10 h-1.5 w-1.5 rounded-full border border-white shadow-sm ring-2 ring-transparent transition-all hover:scale-150 hover:ring-white"
												style={{
													...getDotStyle(rc.h, rc.s, 3),
													backgroundColor: hsbToHex(rc.h, rc.s, rc.b)
												}}
												onClick={(e) => {
													e.stopPropagation();
													setH(rc.h);
													setS(rc.s);
													setB(rc.b);
												}}
											/>
										))}
								</div>

								{/* Composable HSB Sliders */}
								{showSliders && (
									<div className="flex flex-col gap-2 border-t border-black/5 pt-1">
										<Slider label="Hue" value={h} min={0} max={360} onChange={setH} />
										<Slider label="Sat" value={s} min={0} max={100} onChange={setS} />
										<Slider label="Bri" value={b} min={0} max={100} onChange={setB} />
									</div>
								)}
							</motion.div>
						</div>
					</Portal>
				)}
			</AnimatePresence>
		</div>
	);
};

// Portal-powered ContextualRadial
const ContextualRadial = ({ phase, onAdd, onClose, rect }) => {
	if (!phase || !rect) return null;
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;

	return (
		<Portal>
			<div className="pointer-events-none fixed inset-0 z-[10000]">
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="pointer-events-auto absolute inset-0 bg-white/10 backdrop-blur-[2px]"
					onClick={onClose}
					onWheel={onClose}
				/>
				<div className="pointer-events-none absolute" style={{ top: cy, left: cx }}>
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0 }}
						transition={{ type: 'spring', stiffness: 300, damping: 25 }}
						className="pointer-events-none absolute rounded-full border border-neutral-300/50 bg-white/70 shadow-2xl backdrop-blur-2xl"
						style={{ width: 160, height: 160, top: -80, left: -80 }}
					/>

					{phase.nodes.map((node, i) => {
						const angle = (i / phase.nodes.length) * Math.PI * 2 - Math.PI / 2;
						const dist = 65;
						return (
							<motion.button
								key={node.id}
								initial={{ scale: 0, x: -18, y: -18 }}
								animate={{
									scale: 1,
									x: Math.cos(angle) * dist - 18,
									y: Math.sin(angle) * dist - 18
								}}
								exit={{ scale: 0, x: -18, y: -18 }}
								whileHover={{ scale: 1.1 }}
								transition={{ type: 'spring', stiffness: 300, damping: 20 }}
								onClick={(e) => {
									e.stopPropagation();
									onAdd(node);
									onClose();
								}}
								className="group pointer-events-auto absolute flex h-9 w-9 flex-col items-center justify-center rounded-full border border-black/5 bg-white shadow-md transition-colors hover:bg-neutral-50"
								style={{ top: 0, left: 0 }}
							>
								<node.icon size={14} className="text-neutral-800" />
								<div className="pointer-events-none absolute -bottom-6 opacity-0 transition-opacity group-hover:opacity-100">
									<span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[8px] font-bold whitespace-nowrap text-white shadow-lg">
										{node.label}
									</span>
								</div>
							</motion.button>
						);
					})}
				</div>
			</div>
		</Portal>
	);
};

// --- VIEWER COMPONENTS ---

const ViewerToolbar = ({ onToggleInfo, isInfoOpen, matColor }) => {
	const contrastClass = getContrastingColor(matColor);

	return (
		<div
			className={`flex items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur-xl transition-colors duration-300`}
			style={{
				backgroundColor: `${matColor}cc`,
				borderColor: matColor === '#ffffff' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'
			}}
		>
			<button
				className={`flex h-8 w-8 items-center justify-center rounded-full ${contrastClass} transition-colors hover:bg-black/10`}
			>
				<Undo2 size={14} strokeWidth={2.5} />
			</button>
			<button
				className={`flex h-8 w-8 items-center justify-center rounded-full ${contrastClass} transition-colors hover:bg-black/10`}
			>
				<Redo2 size={14} strokeWidth={2.5} />
			</button>
			<div className={`mx-1 h-4 w-[1px] bg-current opacity-20 ${contrastClass}`} />
			<button
				onClick={onToggleInfo}
				className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${isInfoOpen ? 'bg-neutral-900 text-white shadow-md' : `${contrastClass} hover:bg-black/10`}`}
			>
				<Info size={14} strokeWidth={2.5} />
			</button>
		</div>
	);
};

const PhotoViewToolbar = ({ settings, setSettings }) => {
	const [isOpen, setIsOpen] = useState(false);
	const contrastClass = getContrastingColor(settings.matColor);

	const matColors = [
		{ label: 'Black', value: '#000000' },
		{ label: 'White', value: '#ffffff' },
		{ label: 'Gray', value: '#262626' }
	];

	const borderSizes = [
		{ label: 'P', value: 2 },
		{ label: 'M', value: 4 },
		{ label: 'G', value: 16 }
	];

	const borderColors = [
		{ label: 'W', value: '#ffffff' },
		{ label: 'B', value: '#000000' },
		{ label: 'G', value: '#404040' },
		{ label: 'None', value: 'transparent' }
	];

	return (
		<motion.div
			layout
			className="pointer-events-auto flex items-center overflow-hidden rounded-full border p-1 shadow-lg backdrop-blur-xl transition-colors duration-300"
			style={{
				backgroundColor: `${settings.matColor}cc`,
				borderColor: settings.matColor === '#ffffff' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'
			}}
		>
			<motion.button
				layout
				onClick={() => setIsOpen(!isOpen)}
				className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${contrastClass} transition-colors hover:bg-black/10`}
			>
				{isOpen ? <X size={14} strokeWidth={2.5} /> : <Settings size={14} strokeWidth={2.5} />}
			</motion.button>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ width: 0, opacity: 0 }}
						animate={{ width: 'auto', opacity: 1 }}
						exit={{ width: 0, opacity: 0 }}
						transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
						className="flex items-center overflow-hidden whitespace-nowrap"
					>
						<div
							className={`mx-2 h-4 w-[1px] flex-shrink-0 bg-current opacity-20 ${contrastClass}`}
						/>

						<div className="flex flex-shrink-0 items-center gap-6 px-2 py-1 pr-4">
							<div
								className={`flex items-center gap-2 border-r pr-4 ${settings.matColor === '#ffffff' ? 'border-black/10' : 'border-white/20'}`}
							>
								<span className={`${SMALL_TEXT_STYLE} ${contrastClass}`}>Zoom</span>
								<div
									className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 ${settings.matColor === '#ffffff' ? 'border-black/5 bg-black/5' : 'border-white/10 bg-white/10'}`}
								>
									<span className={`text-[9px] font-bold ${contrastClass}`}>100%</span>
									<ChevronDown size={10} className={`${contrastClass} opacity-40`} />
								</div>
							</div>

							<div className="flex items-center gap-2">
								<span className={`${SMALL_TEXT_STYLE} ${contrastClass}`}>Mat</span>
								<div className="flex gap-1">
									{matColors.map((c) => (
										<button
											key={c.label}
											onClick={() => setSettings((s) => ({ ...s, matColor: c.value }))}
											className={`h-4 w-4 rounded-full border border-white/80 shadow-sm transition-transform hover:scale-110 ${settings.matColor === c.value ? 'ring-2 ring-blue-500' : ''}`}
											style={{ backgroundColor: c.value }}
											title={c.label}
										/>
									))}
								</div>
							</div>

							<div
								className={`flex min-w-[100px] items-center gap-3 border-r pr-4 ${settings.matColor === '#ffffff' ? 'border-black/10' : 'border-white/20'}`}
							>
								<span className={`${SMALL_TEXT_STYLE} ${contrastClass}`}>Size</span>
								<input
									type="range"
									min="5"
									max="30"
									step="1"
									className={`h-1 w-20 rounded-full ${settings.matColor === '#ffffff' ? 'bg-black/10 accent-neutral-900' : 'bg-white/20 accent-white'}`}
									value={settings.matSize}
									onChange={(e) =>
										setSettings((s) => ({ ...s, matSize: parseInt(e.target.value) }))
									}
								/>
								<span className={`text-[8px] font-bold ${contrastClass} opacity-60`}>
									{settings.matSize}%
								</span>
							</div>

							<div className="flex items-center gap-3">
								<span className={`${SMALL_TEXT_STYLE} ${contrastClass}`}>Border</span>
								<div
									className={`flex gap-0.5 rounded-full p-0.5 ${settings.matColor === '#ffffff' ? 'bg-black/5' : 'bg-white/10'}`}
								>
									{borderSizes.map((s) => (
										<button
											key={s.label}
											onClick={() => setSettings((prev) => ({ ...prev, borderWidth: s.value }))}
											className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold transition-colors ${settings.borderWidth === s.value ? (settings.matColor === '#ffffff' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900') : `${contrastClass} opacity-60 hover:opacity-100`}`}
										>
											{s.label}
										</button>
									))}
								</div>
								<div className="ml-1 flex gap-1">
									{borderColors.map((c) => (
										<button
											key={c.label}
											onClick={() => setSettings((prev) => ({ ...prev, borderColor: c.value }))}
											className={`h-3.5 w-3.5 rounded-sm border border-white shadow-sm transition-transform hover:scale-110 ${settings.borderColor === c.value ? 'ring-2 ring-blue-500' : ''}`}
											style={{ backgroundColor: c.value }}
											title={c.label}
										/>
									))}
								</div>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
};

const MetadataPanel = forwardRef((props, ref) => (
	<motion.div
		ref={ref}
		initial={{ y: '100%' }}
		animate={{ y: 0 }}
		exit={{ y: '100%' }}
		transition={{ type: 'spring', damping: 25, stiffness: 200 }}
		className="absolute inset-x-0 bottom-0 z-[100] border-t border-black/5 bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.1)]"
	>
		<div className="mx-auto flex max-w-5xl items-start gap-16 px-12 py-8">
			<div className="flex min-w-[200px] flex-col gap-4">
				<div className="flex flex-col gap-1">
					<span className={SMALL_TEXT_STYLE}>File Name</span>
					<span className="text-[11px] font-bold text-neutral-900">
						705-Sky Scrapper Beach-1400.avif
					</span>
				</div>
				<div className="flex flex-col gap-1">
					<span className={SMALL_TEXT_STYLE}>Timeline</span>
					<div className="flex flex-col text-[10px] font-bold text-neutral-700">
						<span>Added: March 24, 2026</span>
						<span className="font-medium italic opacity-40">Modified: March 30, 2026</span>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-6">
				<div className="flex flex-col gap-1">
					<span className={SMALL_TEXT_STYLE}>Title & Caption</span>
					<span className="text-[14px] leading-tight font-bold tracking-tight text-neutral-900">
						Sky Scrapper Beach, NY
					</span>
					<p className="mt-1 max-w-sm text-[10px] leading-relaxed font-medium text-neutral-500">
						Urban landscape documentation of Lower Manhattan waterfront, exploring the intersection
						of leisure and infrastructure.
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<span className={SMALL_TEXT_STYLE}>Location</span>
					<div className="group relative h-28 overflow-hidden rounded-xl border border-black/5 bg-neutral-100">
						<img
							src="https://raw.githubusercontent.com/arthur-debert/seer/refs/heads/main/docs/assets/map-sample.png?token=GHSAT0AAAAAADSGPBWDQV7LYT3UUZTODV5Q2OMJY4A"
							alt="Location Map"
							className="h-full w-full object-cover brightness-90 contrast-125 grayscale"
						/>
						<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
							<div className="h-2 w-2 rounded-full border-2 border-white bg-neutral-900 shadow-xl" />
						</div>
						<div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 shadow-sm">
							<MapPin size={10} className="text-neutral-900" />
							<span className="text-[9px] font-bold tracking-tight text-neutral-900">
								Lower Manhattan, NY
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-5 border-l border-black/5 pl-16">
				<div className="flex items-center gap-3">
					<Camera size={16} className="opacity-20" />
					<div className="flex flex-col">
						<span className="text-[11px] font-bold text-neutral-900">Leica M11</span>
						<span className="text-[9px] font-bold tracking-widest uppercase opacity-40">
							Summilux-M 35mm f/1.4 ASPH
						</span>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-x-8 gap-y-4">
					<div className="flex flex-col">
						<span className={SMALL_TEXT_STYLE}>Aperture</span>
						<span className="text-[12px] font-black text-neutral-900">ƒ/1.4</span>
					</div>
					<div className="flex flex-col">
						<span className={SMALL_TEXT_STYLE}>Shutter</span>
						<span className="text-[12px] font-black text-neutral-900">1/4000</span>
					</div>
					<div className="flex flex-col">
						<span className={SMALL_TEXT_STYLE}>Sensitivity</span>
						<span className="text-[12px] font-black text-neutral-900">ISO 64</span>
					</div>
					<div className="flex flex-col">
						<span className={SMALL_TEXT_STYLE}>Exposure</span>
						<span className="text-[12px] font-black text-neutral-900">0.0 EV</span>
					</div>
				</div>
			</div>
		</div>
	</motion.div>
));

// --- MAIN WORKSPACE ---

export default function App() {
	const [pipeline, setPipeline] = useState({
		image: [
			{ id: 's1', type: 'seer.source.standard', label: 'Standard Image', icon: FileImage },
			{ id: 'g1', type: 'seer.crop', label: 'Crop', icon: Crop }
		],
		zones: [],
		adjustments: [
			{ id: 'a1', type: 'seer.white-balance', label: 'White Balance', icon: Thermometer },
			{ id: 'a2', type: 'seer.tone-curve', label: 'Tone Curve', icon: Activity },
			{ id: 'a3', type: 'seer.color-adjust', label: 'Color Adjust', icon: Palette }
		],
		output: []
	});

	const [activeRadial, setActiveRadial] = useState(null);
	const [radialRect, setRadialRect] = useState(null);
	const [isInfoOpen, setIsInfoOpen] = useState(false);

	const [viewSettings, setViewSettings] = useState({
		matColor: '#262626',
		matSize: 15,
		borderWidth: 4,
		borderColor: '#ffffff'
	});

	const addNode = (phaseId, node) => {
		const newNode = { ...node, type: node.id, id: `${node.id}-${Date.now()}` };
		setPipeline((prev) => ({ ...prev, [phaseId]: [...prev[phaseId], newNode] }));
	};

	const removeNode = (phaseId, nodeId) => {
		setPipeline((prev) => ({ ...prev, [phaseId]: prev[phaseId].filter((n) => n.id !== nodeId) }));
	};

	return (
		<div className="flex h-screen w-full overflow-hidden bg-[#404040] font-sans select-none">
			{/* 1. LEFT VIEW: IMAGE VIEWER */}
			<div
				className="relative flex-1 overflow-hidden transition-colors duration-500"
				style={{ backgroundColor: viewSettings.matColor }}
			>
				<div
					className="pointer-events-none absolute inset-0 opacity-[0.04] transition-colors duration-500"
					style={{
						backgroundImage: `radial-gradient(${viewSettings.matColor === '#ffffff' ? '#000' : '#fff'} 1px, transparent 0)`,
						backgroundSize: '40px 40px'
					}}
				/>

				<motion.div
					animate={{
						paddingBottom: isInfoOpen ? 320 : 0
					}}
					transition={{ type: 'spring', damping: 25, stiffness: 200 }}
					className="absolute inset-0 flex flex-col items-center justify-between"
				>
					<div className="pointer-events-auto relative z-[70] pt-8 pb-4">
						<ViewerToolbar
							onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
							isInfoOpen={isInfoOpen}
							matColor={viewSettings.matColor}
						/>
					</div>

					<div
						className="flex min-h-0 w-full flex-1 items-center justify-center transition-all duration-300 ease-in-out"
						style={{
							padding: `${viewSettings.matSize / 2}vh ${viewSettings.matSize / 2}vw`
						}}
					>
						<img
							src="https://photos.debert.xyz/ny-with-hugh--&-claudia/705-Sky%20Scrapper%20Beach-1400.avif"
							alt="Workspace View"
							className="block shadow-2xl"
							style={{
								maxHeight: '100%',
								maxWidth: '100%',
								outline: `${viewSettings.borderWidth}px solid ${viewSettings.borderColor}`,
								outlineOffset: `-${viewSettings.borderWidth / 2}px`,
								filter: 'grayscale(0.1) contrast(1.05)',
								objectFit: 'contain'
							}}
						/>
					</div>

					<div className="pointer-events-auto relative z-[70] pt-4 pb-8">
						<PhotoViewToolbar settings={viewSettings} setSettings={setViewSettings} />
					</div>
				</motion.div>

				<AnimatePresence>{isInfoOpen && <MetadataPanel key="info-panel" />}</AnimatePresence>
			</div>

			{/* 2. RIGHT VIEW: PIPELINE SIDEBAR */}
			<div className="relative flex w-48 flex-col border-l border-black/10 bg-[#f3f4f6] shadow-[-16px_0_48px_rgba(0,0,0,0.1)]">
				<div className="no-scrollbar flex w-full flex-1 flex-col overflow-y-auto">
					{PHASES.map((phase, phaseIdx) => (
						<div
							key={phase.id}
							className="relative flex w-full flex-col border-b border-black/10 transition-all duration-300"
							style={{ zIndex: activeRadial === phase.id ? 100 : 50 - phaseIdx }} // Descending z-index resolves stacking context overlap natively
						>
							{/* Title Bar - Flush, Full Width */}
							<div className="relative z-20 flex items-center justify-center bg-white/60 px-3 py-4">
								{/* Trigger Attached to the Left */}
								{!phase.isSingleton && (
									<div className="absolute top-1/2 left-3 z-30 -translate-y-1/2">
										<div className="relative h-6 w-6">
											<button
												onClick={(e) => {
													if (activeRadial === phase.id) setActiveRadial(null);
													else {
														setRadialRect(e.currentTarget.getBoundingClientRect());
														setActiveRadial(phase.id);
													}
												}}
												className="relative z-20 flex h-full w-full items-center justify-center rounded-full border border-black/5 bg-white text-neutral-800 shadow-sm transition-colors hover:bg-neutral-900 hover:text-white"
											>
												<motion.div animate={{ rotate: activeRadial === phase.id ? 45 : 0 }}>
													<Plus size={14} strokeWidth={2.5} />
												</motion.div>
											</button>
										</div>
									</div>
								)}

								{/* Centered Title */}
								<span className={TITLE_TEXT_STYLE}>{phase.label}</span>
							</div>

							{/* Nodes Container - Flush, Full Width */}
							<div className="flex w-full flex-col bg-white/40">
								<AnimatePresence mode="popLayout">
									{pipeline[phase.id].map((node, idx) => (
										<NodePanel
											key={node.id}
											title={node.label}
											icon={node.icon}
											isFirst={idx === 0}
											isLast={idx === pipeline[phase.id].length - 1}
											index={idx}
											onRemove={() => removeNode(phase.id, node.id)}
											hideRemove={phase.isSingleton}
										>
											{node.type === 'seer.source.standard' && (
												<div className="mb-1 flex items-center gap-2 rounded-lg border border-black/5 bg-black/5 p-1.5">
													<img
														src="https://photos.debert.xyz/ny-with-hugh--&-claudia/705-Sky%20Scrapper%20Beach-1400.avif"
														alt="Thumb"
														className="h-7 w-7 rounded-md object-cover shadow-sm"
													/>
													<div className="flex flex-1 flex-col overflow-hidden pr-1">
														<span className="mb-0.5 text-[8px] font-bold tracking-wider text-neutral-800 uppercase">
															Source
														</span>
														<span className="truncate font-mono text-[9px] text-neutral-500">
															/media/705-Sky...
														</span>
													</div>
												</div>
											)}
											{node.type === 'seer.crop' && (
												<div className="flex flex-col gap-0.5">
													<Select
														label="Aspect Ratio"
														value="16:9"
														options={[
															{ label: 'Original', value: 'original' },
															{ label: '1:1 Square', value: '1:1' },
															{ label: '4:3', value: '4:3' },
															{ label: '16:9', value: '16:9' }
														]}
													/>
													<Toggle label="Landscape" active={true} />
												</div>
											)}
											{node.type === 'seer.white-balance' && (
												<div className="flex flex-col gap-1">
													<Slider label="Temperature" value={45} />
													<Slider label="Tint" value={10} />
												</div>
											)}
											{node.type === 'seer.tone-curve' && <ToneCurve label="Curve" />}
											{node.type === 'seer.color-adjust' && (
												<div className="flex flex-col gap-1">
													<ColorPicker label="Base Hue" initialColor="#3b82f6" />
													<ColorPicker
														label="Secondary"
														initialColor="#eab308"
														showRecents={true}
													/>
													<ColorPicker
														label="Highlight"
														initialColor="#f43f5e"
														showRecents={true}
														showSliders={true}
													/>
												</div>
											)}

											{node.type?.includes('zone') && <Slider label="Feather" value={20} />}
											{node.type?.includes('output.jpeg') && <Slider label="Quality" value={92} />}

											{![
												'crop',
												'white-balance',
												'tone-curve',
												'color-adjust',
												'zone',
												'output.jpeg',
												'source.standard'
											].some((t) => node.type?.includes(t)) && (
												<div className="flex h-4 items-center justify-center opacity-30">
													<span className="text-[8px] font-bold tracking-widest text-neutral-800 uppercase">
														No Parameters
													</span>
												</div>
											)}
										</NodePanel>
									))}
								</AnimatePresence>

								{pipeline[phase.id].length === 0 && (
									<div className="flex h-10 items-center justify-center border-t border-black/5 opacity-30">
										<span className="text-[9px] font-bold tracking-widest text-neutral-800 uppercase">
											Empty
										</span>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Globally rendered Radial via Portal logic but inside root layout to catch clicks */}
			<AnimatePresence>
				{activeRadial && radialRect && (
					<ContextualRadial
						phase={PHASES.find((p) => p.id === activeRadial)}
						onAdd={(node) => addNode(activeRadial, node)}
						onClose={() => setActiveRadial(null)}
						rect={radialRect}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
