import React, { useState } from 'react';
import {
	Database,
	Layers,
	Maximize,
	Sliders,
	Share2,
	ArrowRight,
	Monitor,
	Zap,
	Combine,
	Split
} from 'lucide-react';

const STAGES = [
	{
		id: 0,
		title: 'Source',
		icon: Database,
		color: 'blue',
		description: 'Loading image assets',
		edge: 'condenser'
	},
	{
		id: 1,
		title: 'Geometry',
		icon: Maximize,
		color: 'purple',
		description: 'Canonical Canvas Lock'
	},
	{ id: 2, title: 'Zones', icon: Layers, color: 'indigo', description: 'Mask Generation' },
	{ id: 3, title: 'Adjustments', icon: Sliders, color: 'emerald', description: 'Pixel Processing' },
	{
		id: 4,
		title: 'Output',
		icon: Share2,
		color: 'orange',
		description: 'Multi-profile encoding',
		edge: 'diffuser'
	}
];

const App = () => {
	const [activeStage, setActiveStage] = useState(-1);
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);

	const runSimulation = async () => {
		setIsProcessing(true);
		setMessages([]);

		// Stage 0: Source
		setActiveStage(0);
		setMessages((prev) => [...prev, '📥 Source: Loading raw image set (Image A, Image B)...']);
		await delay(1000);
		setMessages((prev) => [
			...prev,
			'🔗 Edge Node (Condenser): Recombining many inputs into canonical buffer...'
		]);
		await delay(1200);

		// Stage 1: Geometry
		setActiveStage(1);
		setMessages((prev) => [...prev, '📏 Geometry: Establishing Canonical Canvas (4000x3000)...']);
		await delay(1000);

		// Stage 2: Zones
		setActiveStage(2);
		setMessages((prev) => [...prev, '🎭 Zones: Evaluating masks on canonical coordinates...']);
		await delay(1000);

		// Stage 3: Adjustments
		setActiveStage(3);
		setMessages((prev) => [
			...prev,
			'🎨 Adjustments: Homogenous pixel processing with zone masks...'
		]);
		await delay(1200);

		// Stage 4: Output
		setActiveStage(4);
		setMessages((prev) => [
			...prev,
			'🌈 Edge Node (Diffuser): Fanning out single buffer to target profiles...'
		]);
		await delay(800);
		setMessages((prev) => [
			...prev,
			'✅ Output: Rendered for Instagram (9:16)',
			'✅ Output: Rendered for Print (300DPI)',
			'✅ Output: Rendered for Web Thumbnail'
		]);

		setIsProcessing(false);
	};

	const delay = (ms) => new Promise((res) => setTimeout(res, ms));

	return (
		<div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900 transition-colors duration-300 md:p-8 dark:bg-slate-950 dark:text-slate-200">
			<div className="mx-auto max-w-6xl">
				<header className="mb-12 text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold tracking-widest text-indigo-600 uppercase dark:bg-indigo-900/30 dark:text-indigo-400">
						<Zap className="h-3 w-3" /> System Architecture
					</div>
					<h1 className="mb-2 bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-4xl font-black text-transparent dark:from-indigo-400 dark:to-emerald-400">
						RedNode Pipeline
					</h1>
					<p className="text-slate-500 dark:text-slate-400">
						Modeling the logic of Stage-Boundaries and Flow Geometry
					</p>
				</header>

				{/* Pipeline Visualization */}
				<div className="relative mb-16 flex flex-col items-stretch justify-between gap-6 lg:flex-row">
					{STAGES.map((stage, idx) => (
						<React.Fragment key={stage.id}>
							<div className="relative flex flex-1 items-center">
								{/* Stage Card */}
								<div
									className={`relative flex flex-1 flex-col items-center rounded-2xl border-2 p-6 text-center transition-all duration-500 ${
										activeStage === idx
											? `border-${stage.color}-500 z-10 scale-105 bg-white shadow-xl dark:bg-slate-900`
											: 'border-slate-200 bg-slate-100/50 opacity-60 grayscale dark:border-slate-800 dark:bg-slate-900/50'
									}`}
								>
									<div
										className={`mb-4 rounded-xl p-3 ${activeStage === idx ? `bg-${stage.color}-100 dark:bg-${stage.color}-900/30 text-${stage.color}-600 dark:text-${stage.color}-400` : 'bg-slate-200 text-slate-400 dark:bg-slate-800'}`}
									>
										<stage.icon className="h-8 w-8" />
									</div>
									<h3 className="mb-1 text-lg font-bold">{stage.title}</h3>
									<p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
										{stage.description}
									</p>

									{/* Boundary Node: Condenser (Right exit of Source) */}
									{stage.edge === 'condenser' && (
										<div className="absolute top-1/2 -right-4 z-20 flex -translate-y-1/2 flex-col items-center">
											<div
												className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-lg dark:bg-slate-900 ${activeStage >= 0 ? 'border-blue-500 text-blue-500' : 'border-slate-300 text-slate-400 dark:border-slate-700'}`}
											>
												<Combine className="h-4 w-4" />
											</div>
											<span className="absolute top-10 text-[10px] font-bold tracking-tighter text-blue-500 uppercase">
												Condenser
											</span>
										</div>
									)}

									{/* Boundary Node: Diffuser (Left entry of Output) */}
									{stage.edge === 'diffuser' && (
										<div className="absolute top-1/2 -left-4 z-20 flex -translate-y-1/2 flex-col items-center">
											<div
												className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-lg dark:bg-slate-900 ${activeStage === 4 ? 'border-orange-500 text-orange-500' : 'border-slate-300 text-slate-400 dark:border-slate-700'}`}
											>
												<Split className="h-4 w-4" />
											</div>
											<span className="absolute top-10 text-[10px] font-bold tracking-tighter text-orange-500 uppercase">
												Diffuser
											</span>
										</div>
									)}

									{activeStage === idx && (
										<div
											className={`absolute right-6 -bottom-0.5 left-6 h-1 bg-${stage.color}-500 animate-pulse rounded-full`}
										/>
									)}
								</div>

								{/* Connector Arrow */}
								{idx < STAGES.length - 1 && (
									<div className="hidden flex-1 justify-center lg:flex">
										<ArrowRight
											className={`h-5 w-5 transition-colors ${activeStage > idx ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-800'}`}
										/>
									</div>
								)}
							</div>
						</React.Fragment>
					))}
				</div>

				{/* Control & Log */}
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
					<div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl lg:col-span-1 dark:border-slate-800 dark:bg-slate-900">
						<h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
							<Monitor className="h-5 w-5 text-indigo-500" /> Pipeline Console
						</h2>
						<button
							onClick={runSimulation}
							disabled={isProcessing}
							className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold transition-all ${
								isProcessing
									? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
									: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95'
							}`}
						>
							{isProcessing ? 'Executing Flow...' : 'Start Image Pipeline'}
						</button>

						<div className="mt-8 space-y-4">
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
								<p className="mb-2 text-[10px] font-bold text-slate-400 uppercase dark:text-slate-500">
									Internal State
								</p>
								<div className="mb-2 flex items-center justify-between">
									<span className="text-xs font-semibold">Canvas Context</span>
									<span
										className={
											activeStage >= 1
												? 'font-mono text-xs font-bold text-emerald-500'
												: 'font-mono text-xs text-slate-400 dark:text-slate-700'
										}
									>
										{activeStage >= 1 ? 'LOCKED (4000px)' : 'UNBOUNDED'}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-xs font-semibold">Message Count</span>
									<span className="font-mono text-xs font-bold text-indigo-500">
										{activeStage === 0
											? 'N-Messages'
											: activeStage === 4
												? 'M-Targets'
												: '1 Canonical'}
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="flex min-h-[400px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/50 p-8 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900/50">
						<h2 className="mb-6 flex items-center gap-2 font-mono text-sm font-bold text-slate-400 dark:text-slate-500">
							<div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> SYSTEM_LIVE_FEED
						</h2>
						<div className="scrollbar-hide flex-1 space-y-3 overflow-y-auto pr-4 font-mono text-xs md:text-sm">
							{messages.length === 0 && (
								<p className="text-slate-400 italic">Waiting for trigger...</p>
							)}
							{messages.map((msg, i) => (
								<div key={i} className="animate-in slide-in-from-left flex gap-3 duration-300">
									<span className="text-slate-400 dark:text-slate-600">
										[{new Date().toLocaleTimeString([], { hour12: false })}]
									</span>
									<span
										className={
											msg.includes('✅')
												? 'font-bold text-emerald-600 dark:text-emerald-400'
												: 'text-slate-700 dark:text-slate-300'
										}
									>
										{msg}
									</span>
								</div>
							))}
							{isProcessing && (
								<div className="flex animate-pulse items-center gap-1 pt-2 text-indigo-500">
									<span className="h-1 w-1 rounded-full bg-indigo-500" />
									<span className="h-1 w-1 rounded-full bg-indigo-500" />
									<span className="h-1 w-1 rounded-full bg-indigo-500" />
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default App;
