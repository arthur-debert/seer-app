import './index.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const modules = import.meta.glob('../*.tsx', { eager: true }) as Record<
	string,
	{ default: React.ComponentType }
>;

const prototypes = Object.entries(modules)
	.filter(([path]) => !path.includes('main.tsx'))
	.map(([path, mod]) => ({
		name: path.replace('../', '').replace('.tsx', ''),
		Component: mod.default
	}));

function App() {
	const [active, setActive] = useState<string | null>(null);
	const proto = prototypes.find((p) => p.name === active);

	if (proto) {
		return (
			<div className="min-h-screen bg-slate-950">
				<button
					onClick={() => setActive(null)}
					className="fixed top-4 left-4 z-50 rounded bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
				>
					← Back
				</button>
				<proto.Component />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-950">
			<div className="space-y-4">
				<h1 className="mb-6 text-2xl font-bold text-slate-200">Seer Prototypes</h1>
				{prototypes.map((p) => (
					<button
						key={p.name}
						onClick={() => setActive(p.name)}
						className="block w-full rounded bg-slate-800 px-4 py-3 text-left text-slate-300 hover:bg-slate-700"
					>
						{p.name}
					</button>
				))}
			</div>
		</div>
	);
}

createRoot(document.getElementById('root')!).render(<App />);
