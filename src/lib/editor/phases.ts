/**
 * Static pipeline phase descriptors.
 *
 * Mirrors the Rust PHASES constant from phase_topology.rs. Since phase
 * topology is fixed at compile time, we define it as a TypeScript constant
 * rather than fetching it from WASM on every state update.
 */

import type { PhaseInfo, PhaseTopology } from './editor-bridge';

export const PHASES: readonly PhaseInfo[] = [
	{ index: 0, name: 'Source', topology: 'Condenser' },
	{ index: 1, name: 'Geometry', topology: 'Linear' },
	{ index: 2, name: 'Zones', topology: 'Linear' },
	{ index: 3, name: 'Adjustments', topology: 'Linear' },
	{ index: 4, name: 'Output', topology: 'Diffuser' }
] as const;

export type { PhaseInfo, PhaseTopology };
