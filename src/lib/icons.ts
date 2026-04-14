/**
 * Icon registry — single source of truth for all icons used in the app.
 *
 * Import icons from here, not directly from '~icons/...'.
 * The /icons demo page loops this registry automatically.
 */
import type { Component } from 'svelte';

// --- Material Symbols ---
import Star from '~icons/material-symbols/star';
import CheckCircle from '~icons/material-symbols/check-circle';
import CircleOutline from '~icons/material-symbols/circle-outline';
import Add from '~icons/material-symbols/add';
import Image from '~icons/material-symbols/image';
import WbAuto from '~icons/material-symbols/wb-auto';
import Palette from '~icons/material-symbols/palette';
import MonochromePhotos from '~icons/material-symbols/monochrome-photos';
import Equalizer from '~icons/material-symbols/equalizer';
import Insights from '~icons/material-symbols/insights';
import Grain from '~icons/material-symbols/grain';
import BlurOff from '~icons/material-symbols/blur-off';
import Contrast from '~icons/material-symbols/contrast';
import Crop from '~icons/material-symbols/crop';

// --- Viewer toolbar ---
import Undo from '~icons/material-symbols/undo';
import Redo from '~icons/material-symbols/redo';
import History from '~icons/material-symbols/history';

// --- AI ---
import AutoAwesome from '~icons/material-symbols/auto-awesome';

// --- Pipeline item chrome ---
import Public from '~icons/material-symbols/public';
import DragIndicator from '~icons/material-symbols/drag-indicator';
import ArrowRightAlt from '~icons/material-symbols/arrow-right-alt';

// --- Zone kinds ---
import Brightness6 from '~icons/material-symbols/brightness-6';
import Colorize from '~icons/material-symbols/colorize';
import Gradient from '~icons/material-symbols/gradient';
import Brush from '~icons/material-symbols/brush';

// --- Semantic segmentation categories ---
import Cloud from '~icons/material-symbols/cloud';
import Person from '~icons/material-symbols/person';
import Eco from '~icons/material-symbols/eco';
import LocationCity from '~icons/material-symbols/location-city';

export interface IconEntry {
	component: Component;
	label: string;
	/** Icon set + name, e.g. "material-symbols/star" */
	iconId: string;
	/** Where this icon is used in the app */
	usage: string;
}

/** All icons used in the app, keyed by a stable identifier. */
export const icons = {
	star: {
		component: Star,
		label: 'Star',
		iconId: 'material-symbols/star',
		usage: 'History panel: add tag'
	},
	checkCircle: {
		component: CheckCircle,
		label: 'Check Circle',
		iconId: 'material-symbols/check-circle',
		usage: 'Pipeline: adjustment enabled'
	},
	circleOutline: {
		component: CircleOutline,
		label: 'Circle Outline',
		iconId: 'material-symbols/circle-outline',
		usage: 'Pipeline: adjustment disabled'
	},
	add: {
		component: Add,
		label: 'Add',
		iconId: 'material-symbols/add',
		usage: 'Pipeline: add adjustment'
	},
	source: {
		component: Image,
		label: 'Source',
		iconId: 'material-symbols/image',
		usage: 'Pipeline node: Source'
	},
	whiteBalance: {
		component: WbAuto,
		label: 'White Balance',
		iconId: 'material-symbols/wb-auto',
		usage: 'Pipeline node: White Balance'
	},
	colorMixer: {
		component: Palette,
		label: 'Color Mixer',
		iconId: 'material-symbols/palette',
		usage: 'Pipeline node: Color Mixer'
	},
	monochrome: {
		component: MonochromePhotos,
		label: 'Monochrome',
		iconId: 'material-symbols/monochrome-photos',
		usage: 'Pipeline node: Monochrome'
	},
	clahe: {
		component: Equalizer,
		label: 'CLAHE',
		iconId: 'material-symbols/equalizer',
		usage: 'Pipeline node: CLAHE'
	},
	toneCurve: {
		component: Insights,
		label: 'Tone Curve',
		iconId: 'material-symbols/insights',
		usage: 'Pipeline node: Tone Curve'
	},
	denoise: {
		component: Grain,
		label: 'Denoise',
		iconId: 'material-symbols/grain',
		usage: 'Pipeline node: Denoise'
	},
	sharpen: {
		component: BlurOff,
		label: 'Sharpen',
		iconId: 'material-symbols/blur-off',
		usage: 'Pipeline node: Sharpen'
	},
	clarity: {
		component: Contrast,
		label: 'Clarity',
		iconId: 'material-symbols/contrast',
		usage: 'Pipeline node: Clarity'
	},
	crop: {
		component: Crop,
		label: 'Crop',
		iconId: 'material-symbols/crop',
		usage: 'Pipeline node: Crop'
	},

	// Viewer toolbar
	undo: {
		component: Undo,
		label: 'Undo',
		iconId: 'material-symbols/undo',
		usage: 'Viewer toolbar: undo'
	},
	redo: {
		component: Redo,
		label: 'Redo',
		iconId: 'material-symbols/redo',
		usage: 'Viewer toolbar: redo'
	},
	history: {
		component: History,
		label: 'History',
		iconId: 'material-symbols/history',
		usage: 'Viewer toolbar: toggle history panel'
	},

	// AI
	ai: {
		component: AutoAwesome,
		label: 'AI',
		iconId: 'material-symbols/auto-awesome',
		usage: 'Zone kind: AI / Semantic segmentation'
	},

	// Pipeline item chrome
	globe: {
		component: Public,
		label: 'Globe',
		iconId: 'material-symbols/public',
		usage: 'Pipeline: Full zone (entire image)'
	},
	dragIndicator: {
		component: DragIndicator,
		label: 'Drag Indicator',
		iconId: 'material-symbols/drag-indicator',
		usage: 'Pipeline: drag handle'
	},
	arrowRight: {
		component: ArrowRightAlt,
		label: 'Arrow Right',
		iconId: 'material-symbols/arrow-right-alt',
		usage: 'Pipeline: separator between node and targets'
	},

	// Zone kinds
	zoneLuminance: {
		component: Brightness6,
		label: 'Luminance',
		iconId: 'material-symbols/brightness-6',
		usage: 'Zone kind: Luminance'
	},
	zoneColor: {
		component: Colorize,
		label: 'Color Range',
		iconId: 'material-symbols/colorize',
		usage: 'Zone kind: Color Range'
	},
	zoneGradient: {
		component: Gradient,
		label: 'Gradient',
		iconId: 'material-symbols/gradient',
		usage: 'Zone kind: Gradient'
	},
	zoneBrush: {
		component: Brush,
		label: 'Brush',
		iconId: 'material-symbols/brush',
		usage: 'Zone kind: Brush'
	},

	// Semantic segmentation categories
	segSky: {
		component: Cloud,
		label: 'Sky',
		iconId: 'material-symbols/cloud',
		usage: 'Semantic zone: Sky / water / mountains'
	},
	segPerson: {
		component: Person,
		label: 'Person',
		iconId: 'material-symbols/person',
		usage: 'Semantic zone: People'
	},
	segVegetation: {
		component: Eco,
		label: 'Vegetation',
		iconId: 'material-symbols/eco',
		usage: 'Semantic zone: Trees / grass / flowers'
	},
	segStructure: {
		component: LocationCity,
		label: 'Structure',
		iconId: 'material-symbols/location-city',
		usage: 'Semantic zone: Buildings / houses'
	}
} as const satisfies Record<string, IconEntry>;

/** Map from plugin kind string (e.g. "seer.tone-curve") to registry key. */
export const pluginIconMap: Record<string, keyof typeof icons> = {
	'seer.source.standard': 'source',
	'seer.white-balance': 'whiteBalance',
	'seer.color-mixer': 'colorMixer',
	'seer.monochrome': 'monochrome',
	'seer.clahe': 'clahe',
	'seer.tone-curve': 'toneCurve',
	'seer.denoise': 'denoise',
	'seer.sharpen': 'sharpen',
	'seer.clarity': 'clarity',
	'seer.crop': 'crop'
};

/** Adjustment plugins that can be added via the toolbar (excludes Source). */
export const addablePlugins: { pluginId: string; label: string; iconKey: keyof typeof icons }[] = [
	{ pluginId: 'seer.white-balance', label: 'White Balance', iconKey: 'whiteBalance' },
	{ pluginId: 'seer.color-mixer', label: 'Color Mixer', iconKey: 'colorMixer' },
	{ pluginId: 'seer.monochrome', label: 'Monochrome', iconKey: 'monochrome' },
	{ pluginId: 'seer.clahe', label: 'CLAHE', iconKey: 'clahe' },
	{ pluginId: 'seer.tone-curve', label: 'Tone Curve', iconKey: 'toneCurve' },
	{ pluginId: 'seer.denoise', label: 'Denoise', iconKey: 'denoise' },
	{ pluginId: 'seer.sharpen', label: 'Sharpen', iconKey: 'sharpen' },
	{ pluginId: 'seer.clarity', label: 'Clarity', iconKey: 'clarity' }
];

/** Geometry plugins that can be added via the toolbar. */
export const addableGeometry: { pluginId: string; label: string; iconKey: keyof typeof icons }[] = [
	{ pluginId: 'seer.crop', label: 'Crop', iconKey: 'crop' }
];

/** Zone generator plugins that can be added via the toolbar. */
export const addableZones: { pluginId: string; label: string; iconKey: keyof typeof icons }[] = [
	{ pluginId: 'seer.zone.luminance', label: 'Luminance', iconKey: 'zoneLuminance' },
	{ pluginId: 'seer.zone.color-range', label: 'Color Range', iconKey: 'zoneColor' },
	{ pluginId: 'seer.zone.gradient', label: 'Gradient', iconKey: 'zoneGradient' },
	{ pluginId: 'seer.zone.brush', label: 'Brush', iconKey: 'zoneBrush' },
	{ pluginId: 'seer.zone.segmentation', label: 'Segmentation', iconKey: 'ai' }
];

export interface ComboDefinition {
	id: string;
	label: string;
	/** Plugin IDs of adjustments this combo creates (for icon display). */
	pluginIds: string[];
}

/** Available combos. */
export const combos: ComboDefinition[] = [
	{
		id: 'adaptive-bw',
		label: 'Adaptive BW',
		pluginIds: [
			'seer.monochrome',
			'seer.clahe',
			'seer.tone-curve',
			'seer.tone-curve',
			'seer.tone-curve',
			'seer.tone-curve'
		]
	}
];

/** Map from ZoneInfo.kind (humanized) to icon registry key. */
const zoneKindIconMap: Record<string, keyof typeof icons> = {
	Luminance: 'zoneLuminance',
	Color: 'zoneColor',
	Gradient: 'zoneGradient',
	Brush: 'zoneBrush'
};

/** Map from semantic zone name to icon registry key. */
const semanticNameIconMap: Record<string, keyof typeof icons> = {
	Sky: 'segSky',
	Person: 'segPerson',
	Vegetation: 'segVegetation',
	Structure: 'segStructure'
};

/**
 * Get the icon component(s) for a zone, given its kind and name.
 * For AI (semantic) zones, returns [AI icon, category icon].
 * For other zone kinds, returns [kind icon].
 */
export function getZoneIcons(kind: string, name: string): Component[] {
	if (kind === 'AI') {
		const catKey = semanticNameIconMap[name];
		const result: Component[] = [icons.ai.component];
		if (catKey) result.push(icons[catKey].component);
		return result;
	}
	const key = zoneKindIconMap[kind];
	return key ? [icons[key].component] : [];
}
