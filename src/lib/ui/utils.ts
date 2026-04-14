/**
 * Returns a Tailwind text color class that contrasts well against the given
 * hex background color. Used by toolbars that sit on variable mat colors.
 */
export function contrastColor(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	// Relative luminance (ITU-R BT.709)
	const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	return luminance > 0.5 ? 'text-text-primary' : 'text-white';
}

/**
 * Returns a semi-transparent border color that contrasts against the given
 * hex background. Used by toolbars that sit on variable mat colors.
 */
export function contrastBorder(hex: string): string {
	return hex === '#ffffff' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
}

/** Convert hex string to HSB (hue 0-360, saturation 0-100, brightness 0-100). */
export function hexToHsb(hex: string): { h: number; s: number; b: number } {
	const c = hex.replace('#', '');
	const r = parseInt(c.substring(0, 2), 16) / 255;
	const g = parseInt(c.substring(2, 4), 16) / 255;
	const b = parseInt(c.substring(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	let h = 0;
	if (delta !== 0) {
		if (max === r) h = ((g - b) / delta) % 6;
		else if (max === g) h = (b - r) / delta + 2;
		else h = (r - g) / delta + 4;
		h = Math.round(h * 60);
		if (h < 0) h += 360;
	}

	const s = max === 0 ? 0 : Math.round((delta / max) * 100);
	const brightness = Math.round(max * 100);

	return { h, s, b: brightness };
}

/** Convert HSB (hue 0-360, saturation 0-100, brightness 0-100) to hex string. */
export function hsbToHex(h: number, s: number, b: number): string {
	const sat = s / 100;
	const bright = b / 100;
	const c = bright * sat;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = bright - c;

	let r = 0,
		g = 0,
		bl = 0;
	if (h < 60) {
		r = c;
		g = x;
		bl = 0;
	} else if (h < 120) {
		r = x;
		g = c;
		bl = 0;
	} else if (h < 180) {
		r = 0;
		g = c;
		bl = x;
	} else if (h < 240) {
		r = 0;
		g = x;
		bl = c;
	} else if (h < 300) {
		r = x;
		g = 0;
		bl = c;
	} else {
		r = c;
		g = 0;
		bl = x;
	}

	const toHex = (v: number) =>
		Math.round((v + m) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/** Convert [r, g, b] floats (0-1) to hex string. */
export function rgbToHex(rgb: [number, number, number]): string {
	const toHex = (v: number) => {
		const h = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
		return h.length === 1 ? '0' + h : h;
	};
	return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/** Convert hex string to [r, g, b] floats (0-1). */
export function hexToRgb(hex: string): [number, number, number] {
	return [
		parseInt(hex.slice(1, 3), 16) / 255,
		parseInt(hex.slice(3, 5), 16) / 255,
		parseInt(hex.slice(5, 7), 16) / 255
	];
}
