/**
 * Per-phase visual theme: colors, icons, and addable plugins.
 *
 * This is the single source of truth for phase-specific presentation
 * in the node graph. Node components read from here rather than
 * hardcoding colors or icon choices.
 */

import type { PhaseTopology } from '../editor-bridge';

export interface PhaseTheme {
	/** CSS color for the node's left-border accent and edges. */
	color: string;
	/** Lighter background tint for the node. */
	bg: string;
	/** Human-readable phase label. */
	label: string;
	/** Phase topology (from the backend data model). */
	topology: PhaseTopology;
	/** Phase index (0-4). */
	index: number;
}

export const PHASE_THEMES: Record<number, PhaseTheme> = {
	0: {
		color: 'var(--phase-source)',
		bg: 'color-mix(in srgb, var(--phase-source) 10%, transparent)',
		label: 'Source',
		topology: 'Condenser',
		index: 0
	},
	1: {
		color: 'var(--phase-geometry)',
		bg: 'color-mix(in srgb, var(--phase-geometry) 10%, transparent)',
		label: 'Geometry',
		topology: 'Linear',
		index: 1
	},
	2: {
		color: 'var(--phase-zones)',
		bg: 'color-mix(in srgb, var(--phase-zones) 10%, transparent)',
		label: 'Zones',
		topology: 'Linear',
		index: 2
	},
	3: {
		color: 'var(--phase-adjustments)',
		bg: 'color-mix(in srgb, var(--phase-adjustments) 10%, transparent)',
		label: 'Adjustments',
		topology: 'Linear',
		index: 3
	},
	4: {
		color: 'var(--phase-output)',
		bg: 'color-mix(in srgb, var(--phase-output) 10%, transparent)',
		label: 'Output',
		topology: 'Diffuser',
		index: 4
	}
};
