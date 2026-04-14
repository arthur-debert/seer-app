import React, { useState, useMemo, forwardRef } from 'react';
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
	Crop
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIGURATION ---
const RADIAL_RADIUS = 75;
const RADIAL_BUTTON_SIZE = 34;

const MENU_DATA = {
	id: 'root',
	label: 'Tools',
	icon: MousePointer2,
	children: [
		{
			id: 'selection',
			label: 'Selection',
			icon: MousePointerSquareDashed,
			children: [
				{ id: 'rect-select', label: 'Marquee', icon: MousePointerSquareDashed },
				{ id: 'lasso', label: 'Lasso', icon: Hand },
				{ id: 'magic', label: 'Magic Wand', icon: Star }
			]
		},
		{
			id: 'adjustments-root',
			label: 'Adjustments',
			icon: Filter,
			children: [
				{ id: 'adj-frame', label: 'Frame', icon: Crop, type: 'adjustment' },
				{ id: 'adj-brightness', label: 'Brightness', icon: Sun, type: 'adjustment' },
				{ id: 'adj-contrast', label: 'Contrast', icon: ContrastIcon, type: 'adjustment' },
				{ id: 'adj-exposure', label: 'Exposure', icon: Zap, type: 'adjustment' }
			]
		},
		{
			id: 'visuals',
			label: 'Visuals',
			icon: Palette,
			children: [
				{ id: 'layers-menu', label: 'Layers', icon: Layers },
				{ id: 'canvas', label: 'Canvas', icon: Layout }
			]
		},
		{ id: 'shapes-root', label: 'Shapes', icon: Hexagon }
	]
};

// --- STYLES HELPER ---
const SMALL_TEXT_STYLE =
	'text-[10px] font-bold leading-[15px] h-[15px] opacity-60 tracking-tight font-sans select-none';
const TITLE_TEXT_STYLE = 'text-[13px] font-bold tracking-tighter opacity-90 font-sans select-none';

// --- ATOMS ---

const Divider = ({ orientation = 'horizontal' }) => (
	<div
		className={`rounded-full bg-neutral-300/40 ${orientation === 'horizontal' ? 'mx-1 h-4 w-[1px]' : 'my-1 h-[1px] w-4'}`}
	/>
);

const HUDToggle = ({ icon: Icon, label, isActive = false, onClick, groupId = 'active-pill' }) => (
	<button
		onClick={onClick}
		className={`group relative z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 ${isActive ? 'text-white' : 'text-neutral-600 hover:bg-white/60 hover:text-neutral-900'}`}
	>
		{isActive && (
			<motion.div
				layoutId={groupId}
				className="absolute inset-0 -z-10 rounded-full bg-neutral-900 shadow-lg"
				transition={{ type: 'spring', stiffness: 400, damping: 30 }}
			/>
		)}
		<div className="pointer-events-none relative z-20">
			<Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
		</div>
		<div className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 scale-90 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
			<span
				className={`rounded-full border border-white/80 bg-white/95 px-2.5 whitespace-nowrap text-neutral-800 shadow-md backdrop-blur-md ${SMALL_TEXT_STYLE} h-auto py-0.5 opacity-100`}
			>
				{label}
			</span>
		</div>
	</button>
);

// --- RADIAL COMPONENTS ---

const RadialButton = forwardRef(
	({ node, x = 0, y = 0, isCenter, onClick, index = 0, showX = false }, ref) => {
		const Icon = showX ? X : node.icon || Star;
		return (
			<motion.div
				ref={ref}
				layoutId={`radial-${node.id}`}
				initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
				animate={{
					scale: 1,
					opacity: 1,
					x,
					y,
					transition: {
						type: 'spring',
						stiffness: 450,
						damping: 30,
						delay: isCenter ? 0 : index * 0.02
					}
				}}
				exit={{ scale: 0.5, opacity: 0, x: 0, y: 0, transition: { duration: 0.15 } }}
				className="absolute"
				style={{
					left: '50%',
					top: '50%',
					marginLeft: -RADIAL_BUTTON_SIZE / 2,
					marginTop: -RADIAL_BUTTON_SIZE / 2
				}}
			>
				<button
					onClick={(e) => {
						e.stopPropagation();
						onClick(node);
					}}
					className={`group relative flex flex-col items-center justify-center rounded-full transition-all duration-300 ${isCenter ? 'z-30 scale-110 bg-neutral-900 text-white shadow-xl' : 'z-20 border border-white/60 bg-white/60 text-neutral-800 shadow-md backdrop-blur-xl hover:bg-white/90'}`}
					style={{ width: RADIAL_BUTTON_SIZE, height: RADIAL_BUTTON_SIZE }}
				>
					<Icon size={14} strokeWidth={isCenter ? 3 : 2} />
					<div
						className={`pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 transition-all duration-300 ${isCenter ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
					>
						<span
							className={`rounded-full border border-white/40 bg-white/95 px-2.5 whitespace-nowrap text-neutral-800 shadow-sm backdrop-blur-md ${SMALL_TEXT_STYLE} h-auto py-0.5 opacity-100 ${isCenter ? 'border-neutral-700 bg-neutral-900 text-white' : ''}`}
						>
							{node.label}
						</span>
					</div>
					{node.children && !isCenter && (
						<div className="absolute top-0 right-0 h-2 w-2 rounded-full border border-white bg-neutral-400 shadow-sm" />
					)}
				</button>
			</motion.div>
		);
	}
);

// --- STACKABLE PANELS ---

const StackedPanel = forwardRef(
	({ children, title, icon: Icon, onRemove, isFirst = false, isLast = false }, ref) => {
		const tabH = 8;
		const r = 12;

		const getPaths = () => {
			const topCap = `M 0,${r} A ${r},${r} 0 0 1 ${r},0 L ${100 - r},0 A ${r},${r} 0 0 1 100,${r}`;
			const topNotch = `M 0,0 L 42,0 L 50,${tabH} L 58,0 L 100,0`;
			const bottomCap = `L 100,${100 - r} A ${r},${r} 0 0 1 ${100 - r},100 L ${r},100 A ${r},${r} 0 0 1 0,${100 - r}`;
			const bottomTab = `L 100,100 L 58,100 L 50,108 L 42,100 L 0,100`;
			const fill = (isFirst ? topCap : topNotch) + ' ' + (isLast ? bottomCap : bottomTab) + ' Z';

			let stroke = '';
			if (isFirst) {
				stroke = topCap;
			} else {
				stroke = `M 100,0`;
			}

			if (isLast) {
				stroke += ` L 100,${100 - r} A ${r},${r} 0 0 1 ${100 - r},100 L ${r},100 A ${r},${r} 0 0 1 0,${100 - r} L 0,0`;
			} else {
				stroke += ` L 100,100 L 58,100 L 50,108 L 42,100 L 0,100 L 0,0`;
			}
			return { fill, stroke };
		};

		const paths = getPaths();
		const clipPathId = useMemo(() => `clip-${Math.random().toString(36).substr(2, 9)}`, []);

		return (
			<motion.div
				ref={ref}
				layout
				initial={{ opacity: 0, x: 20, scale: 0.95 }}
				animate={{ opacity: 1, x: 0, scale: 1 }}
				exit={{ opacity: 0, x: 20, scale: 0.95 }}
				className="group relative w-64"
				style={{ marginTop: isFirst ? 0 : -tabH }}
			>
				<svg width="0" height="0" className="absolute">
					<defs>
						<clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
							<path d={paths.fill} transform="scale(0.01, 0.01)" />
						</clipPath>
					</defs>
				</svg>

				<div
					className="absolute inset-0 bg-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-2xl"
					style={{ clipPath: `url(#${clipPathId})` }}
				/>

				<svg
					className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<path
						d={paths.stroke}
						fill="none"
						stroke="rgba(255, 255, 255, 0.95)"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
					{!isLast && (
						<path
							d="M 42,100 L 50,108 L 58,100"
							fill="none"
							stroke="rgba(0, 0, 0, 0.06)"
							strokeWidth="1"
							vectorEffect="non-scaling-stroke"
							transform="translate(0, 1)"
						/>
					)}
				</svg>

				<div className="relative z-30 flex flex-col pt-3 pb-4">
					<div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
						<div className="flex items-center gap-2">
							<Icon size={14} className="opacity-60" strokeWidth={2.5} />
							<span className={TITLE_TEXT_STYLE}>{title}</span>
						</div>
						<button
							onClick={onRemove}
							className="text-neutral-400 transition-colors hover:text-red-500"
						>
							<X size={12} />
						</button>
					</div>
					<div className="px-4 py-3">{children}</div>
				</div>
			</motion.div>
		);
	}
);

// --- FORM CONTROLS ---

const SliderField = ({ label, value, onChange }) => (
	<div className="mb-2 flex flex-col gap-1 last:mb-0">
		<div className="flex items-center justify-between px-0.5">
			<span className={SMALL_TEXT_STYLE}>{label}</span>
			<span className="text-[10px] font-bold tracking-tight text-neutral-800">{value}%</span>
		</div>
		<input
			type="range"
			className="h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900"
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	</div>
);

const SegmentedControl = ({ options, activeValue, onChange, layoutId }) => (
	<div className="relative flex gap-0.5 rounded-full bg-neutral-200/50 p-0.5">
		{options.map((opt) => (
			<button
				key={opt.value}
				onClick={() => onChange(opt.value)}
				className={`relative z-10 flex-1 rounded-full px-2 py-1 text-[9px] font-bold tracking-tight transition-colors ${activeValue === opt.value ? 'text-white' : 'text-neutral-500 hover:text-neutral-800'}`}
			>
				{activeValue === opt.value && (
					<motion.div
						layoutId={layoutId}
						className="absolute inset-0 -z-10 rounded-full bg-neutral-900"
						transition={{ type: 'spring', stiffness: 400, damping: 30 }}
					/>
				)}
				{opt.label}
			</button>
		))}
	</div>
);

const SelectField = ({ label, options, value, onChange }) => (
	<div className="mb-3 flex items-center justify-between gap-4">
		<span className={SMALL_TEXT_STYLE}>{label}</span>
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="rounded-full border border-white/60 bg-white/40 px-2 py-0.5 text-[10px] font-bold tracking-tight text-neutral-800 focus:outline-none"
		>
			{options.map((o) => (
				<option key={o} value={o}>
					{o}
				</option>
			))}
		</select>
	</div>
);

// --- MAIN APP ---

export default function App() {
	const [isRadialOpen, setIsRadialOpen] = useState(false);
	const [radialPath, setRadialPath] = useState([MENU_DATA]);

	const [adjustmentStack, setAdjustmentStack] = useState([
		{ id: 'initial-frame', label: 'Frame', icon: Crop, type: 'frame', ratio: '16:9', mode: 'fit' },
		{ id: 'initial-exposure', label: 'Exposure', icon: Zap, type: 'slider', value: 45 },
		{ id: 'initial-contrast', label: 'Contrast', icon: ContrastIcon, type: 'slider', value: 12 }
	]);

	const currentRadialParent = radialPath[radialPath.length - 1];

	const handleRadialClick = (node) => {
		if (node.id === currentRadialParent.id) {
			if (radialPath.length === 1) setIsRadialOpen(!isRadialOpen);
			else setRadialPath(radialPath.slice(0, -1));
			return;
		}
		if (node.children) {
			setRadialPath([...radialPath, node]);
			setIsRadialOpen(true);
		} else {
			if (node.type === 'adjustment') {
				const isFrame = node.id === 'adj-frame';
				const newAdj = {
					id: `adj-${Date.now()}`,
					label: node.label,
					icon: node.icon,
					type: isFrame ? 'frame' : 'slider',
					...(isFrame ? { ratio: '1:1', mode: 'fit' } : { value: 50 })
				};
				setAdjustmentStack([...adjustmentStack, newAdj]);
			}
			setIsRadialOpen(false);
		}
	};

	const updateStackItem = (id, updates) => {
		setAdjustmentStack((prev) =>
			prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
		);
	};

	const removeFromStack = (id) => {
		setAdjustmentStack((prev) => prev.filter((item) => item.id !== id));
	};

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#f3f4f6] font-sans select-none">
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.05]"
				style={{
					backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
					backgroundSize: '32px 32px'
				}}
			/>

			{/* TOP HUD */}
			<div className="absolute top-8 z-40">
				<div className="flex flex-col items-center gap-2">
					<span className={SMALL_TEXT_STYLE}>Design Workspace</span>
					<div className="flex items-center gap-1 rounded-full border border-white/60 bg-white/40 p-1 shadow-lg backdrop-blur-xl">
						<HUDToggle
							icon={MousePointer2}
							label="Radial Hub"
							isActive={isRadialOpen}
							onClick={() => setIsRadialOpen(!isRadialOpen)}
							groupId="hub"
						/>
						<Divider />
						<HUDToggle
							icon={Plus}
							label="New Node"
							isActive={false}
							onClick={() => {
								const adjRoot = MENU_DATA.children.find((c) => c.id === 'adjustments-root');
								if (adjRoot) {
									setRadialPath([MENU_DATA, adjRoot]);
									setIsRadialOpen(true);
								}
							}}
							groupId="hub"
						/>
					</div>
				</div>
			</div>

			{/* RADIAL MENU */}
			<AnimatePresence>
				{isRadialOpen && (
					<div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="pointer-events-auto absolute inset-0 bg-white/10 backdrop-blur-sm"
							onClick={() => setIsRadialOpen(false)}
						/>
						<div className="pointer-events-auto relative">
							<AnimatePresence mode="popLayout">
								<RadialButton
									key={currentRadialParent.id}
									node={currentRadialParent}
									isCenter={true}
									onClick={handleRadialClick}
									showX={true}
								/>
								{(currentRadialParent.children || []).map((child, i) => {
									const angle =
										(i / currentRadialParent.children.length) * Math.PI * 2 - Math.PI / 2;
									return (
										<RadialButton
											key={child.id}
											node={child}
											x={Math.cos(angle) * RADIAL_RADIUS}
											y={Math.sin(angle) * RADIAL_RADIUS}
											index={i}
											onClick={handleRadialClick}
										/>
									);
								})}
							</AnimatePresence>
						</div>
					</div>
				)}
			</AnimatePresence>

			{/* RIGHT STACK */}
			<div className="no-scrollbar absolute top-1/2 right-12 z-30 flex max-h-[85vh] -translate-y-1/2 flex-col items-center gap-0 overflow-y-auto pr-4">
				<div className="mb-8 text-center">
					<span className={SMALL_TEXT_STYLE}>Processing Pipeline</span>
				</div>
				<div className="flex flex-col items-center">
					<AnimatePresence mode="popLayout">
						{adjustmentStack.map((adj, index) => (
							<StackedPanel
								key={adj.id}
								title={adj.label}
								icon={adj.icon}
								onRemove={() => removeFromStack(adj.id)}
								isFirst={index === 0}
								isLast={index === adjustmentStack.length - 1}
							>
								{adj.type === 'frame' ? (
									<div className="flex flex-col gap-1">
										<SelectField
											label="Ratio"
											value={adj.ratio}
											options={['16:9', '4:3', '1:1', '4:5', '9:16']}
											onChange={(ratio) => updateStackItem(adj.id, { ratio })}
										/>
										<div className="mt-1 flex flex-col gap-1.5">
											<span className={SMALL_TEXT_STYLE}>Mode</span>
											<SegmentedControl
												layoutId={`mode-${adj.id}`}
												options={[
													{ label: 'Fit', value: 'fit' },
													{ label: 'Crop', value: 'crop' },
													{ label: 'Margin', value: 'margin' }
												]}
												activeValue={adj.mode}
												onChange={(mode) => updateStackItem(adj.id, { mode })}
											/>
										</div>
									</div>
								) : (
									<SliderField
										label="Strength"
										value={adj.value}
										onChange={(val) => updateStackItem(adj.id, { value: val })}
									/>
								)}
							</StackedPanel>
						))}
					</AnimatePresence>
					{adjustmentStack.length === 0 && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex w-64 items-center justify-center rounded-[24px] border border-dashed border-neutral-300 bg-white/10 p-8"
						>
							<span className={SMALL_TEXT_STYLE}>Pipeline Empty</span>
						</motion.div>
					)}
				</div>
			</div>

			{/* FOOTER */}
			<div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 opacity-30">
				<p className={SMALL_TEXT_STYLE}>Adjustment Chain / V.02</p>
				<div className="h-[1px] w-32 bg-neutral-400/30" />
			</div>
		</div>
	);
}
