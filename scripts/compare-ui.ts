/**
 * Visual comparison script: extracts computed styles from both the React prototype
 * and the production Svelte app, then diffs them.
 *
 * Run: npx playwright test scripts/compare-ui.ts
 * Requires: prototype on :5174, production on :5173
 *
 * For each matched component pair, we extract ALL relevant computed CSS properties
 * and bounding boxes, then report mismatches above a threshold.
 */
import { chromium } from '@playwright/test';

const PROTO_URL = 'http://localhost:5174';
const PROD_URL = 'http://localhost:5173/editor';

// ---- Extraction helpers ----

/** All CSS properties we care about for visual comparison */
const STYLE_PROPS = [
	// Box model
	'width',
	'height',
	'padding-top',
	'padding-right',
	'padding-bottom',
	'padding-left',
	'margin-top',
	'margin-right',
	'margin-bottom',
	'margin-left',
	'border-top-width',
	'border-right-width',
	'border-bottom-width',
	'border-left-width',
	'border-top-style',
	'border-right-style',
	'border-bottom-style',
	'border-left-style',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'border-radius',
	// Colors
	'background-color',
	'color',
	'opacity',
	// Typography
	'font-size',
	'font-weight',
	'font-family',
	'letter-spacing',
	'line-height',
	'text-transform',
	// Layout
	'display',
	'flex-direction',
	'align-items',
	'justify-content',
	'gap',
	'position',
	'top',
	'right',
	'bottom',
	'left',
	'z-index',
	'overflow',
	// Visual
	'box-shadow',
	'backdrop-filter'
];

interface ElementDump {
	tag: string;
	rect: { x: number; y: number; width: number; height: number };
	styles: Record<string, string>;
	children?: ElementDump[];
}

// Inject the dump helper into a page (avoids tsx __name decoration issues with page.evaluate)
const DUMP_SCRIPT = `
window.__dumpEl = function(el, props, maxDepth) {
	var cs = getComputedStyle(el);
	var r = el.getBoundingClientRect();
	var styles = {};
	for (var i = 0; i < props.length; i++) styles[props[i]] = cs.getPropertyValue(props[i]);
	var result = {
		tag: el.tagName.toLowerCase(),
		rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
		styles: styles
	};
	if (maxDepth > 0) {
		var kids = [];
		for (var j = 0; j < el.children.length; j++) {
			var cr = el.children[j].getBoundingClientRect();
			if (cr.width > 0 && cr.height > 0) kids.push(window.__dumpEl(el.children[j], props, maxDepth - 1));
		}
		if (kids.length > 0) result.children = kids;
	}
	return result;
};
`;

async function injectDumper(page: import('@playwright/test').Page) {
	await page.evaluate(DUMP_SCRIPT.replace(/^/, '(function(){') + '})()');
}

async function dumpElement(
	page: import('@playwright/test').Page,
	selector: string,
	depth = 3
): Promise<ElementDump | null> {
	return page.evaluate(
		`(function() {
			var el = document.querySelector(${JSON.stringify(selector)});
			if (!el) return null;
			return window.__dumpEl(el, ${JSON.stringify(STYLE_PROPS)}, ${depth});
		})()`
	);
}

async function dumpAll(
	page: import('@playwright/test').Page,
	selector: string,
	depth = 2
): Promise<ElementDump[]> {
	return page.evaluate(
		`(function() {
			var els = document.querySelectorAll(${JSON.stringify(selector)});
			return Array.from(els).map(function(el) { return window.__dumpEl(el, ${JSON.stringify(STYLE_PROPS)}, ${depth}); });
		})()`
	);
}

// ---- Comparison logic ----

interface Mismatch {
	component: string;
	property: string;
	prototype: string;
	production: string;
	severity: 'high' | 'medium' | 'low';
}

function classifySeverity(
	prop: string,
	protoVal: string,
	prodVal: string
): 'high' | 'medium' | 'low' {
	// Color mismatches are high
	if (prop.includes('color') || prop === 'background-color' || prop === 'opacity') return 'high';
	// Size mismatches
	if (prop === 'width' || prop === 'height' || prop === 'font-size') {
		const pxDiff = Math.abs(parseFloat(protoVal) - parseFloat(prodVal));
		if (pxDiff > 4) return 'high';
		if (pxDiff > 1) return 'medium';
		return 'low';
	}
	// Padding/margin/gap
	if (prop.startsWith('padding') || prop.startsWith('margin') || prop === 'gap') {
		const pxDiff = Math.abs(parseFloat(protoVal) - parseFloat(prodVal));
		if (pxDiff > 4) return 'high';
		if (pxDiff > 2) return 'medium';
		return 'low';
	}
	return 'medium';
}

function normalizeColor(c: string): string {
	// Normalize rgba(0, 0, 0, 0) variations
	return c.replace(/\s+/g, '');
}

function colorsClose(a: string, b: string, tolerance = 15): boolean {
	// Parse rgba or rgb
	const parseRgba = (s: string): number[] | null => {
		const m = s.match(/rgba?\(([^)]+)\)/);
		if (!m) return null;
		const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
		return parts;
	};
	// Parse oklab(L a b / alpha) — Tailwind v4 uses this internally
	const parseOklab = (s: string): number[] | null => {
		const m = s.match(/oklab\(([^)]+)\)/);
		if (!m) return null;
		// Format: "L a b" or "L a b / alpha"
		const parts = m[1].split('/');
		const lab = parts[0].trim().split(/\s+/).map(Number);
		const alpha = parts[1] ? parseFloat(parts[1].trim()) : 1;
		return [...lab, alpha];
	};

	const na = normalizeColor(a),
		nb = normalizeColor(b);
	if (na === nb) return true;

	// If both are oklab, compare in oklab space
	const oa = parseOklab(a),
		ob = parseOklab(b);
	if (oa && ob) {
		if (Math.abs(oa[0] - ob[0]) > 0.05) return false; // L
		if (Math.abs(oa[1] - ob[1]) > 0.02) return false; // a
		if (Math.abs(oa[2] - ob[2]) > 0.02) return false; // b
		if (Math.abs((oa[3] ?? 1) - (ob[3] ?? 1)) > 0.15) return false; // alpha
		return true;
	}

	// If one is oklab and other is rgba, convert oklab to approximate rgb for comparison
	if ((oa && !ob) || (!oa && ob)) {
		const okVal = oa || ob;
		const rgbVal = parseRgba(oa ? b : a);
		if (okVal && rgbVal) {
			const okAlpha = okVal[3] ?? 1;
			const rgbAlpha = rgbVal.length > 3 ? (rgbVal[3] ?? 1) : 1;
			// For very transparent overlays (alpha < 0.2), compare alpha only
			if (okAlpha < 0.2 && rgbAlpha < 0.2 && Math.abs(okAlpha - rgbAlpha) < 0.05) return true;
			// For near-white or near-black in oklab, compare with rgb equivalent
			// oklab L=1 ≈ white (255,255,255), L=0 ≈ black (0,0,0)
			const L = okVal[0];
			if (L > 0.99) {
				// Near white — check if rgb is also near white
				const isRgbWhite = rgbVal[0] > 240 && rgbVal[1] > 240 && rgbVal[2] > 240;
				if (isRgbWhite && Math.abs(okAlpha - rgbAlpha) < 0.15) return true;
			}
			if (L < 0.01) {
				// Near black — check if rgb is also near black
				const isRgbBlack = rgbVal[0] < 15 && rgbVal[1] < 15 && rgbVal[2] < 15;
				if (isRgbBlack && Math.abs(okAlpha - rgbAlpha) < 0.15) return true;
			}
		}
		// Mixed color spaces — flag as potential mismatch but low severity
		return false;
	}

	// Both rgba
	const pa = parseRgba(a),
		pb = parseRgba(b);
	if (!pa || !pb) return na === nb;
	for (let i = 0; i < 3; i++) {
		if (Math.abs((pa[i] ?? 0) - (pb[i] ?? 0)) > tolerance) return false;
	}
	if (pa.length > 3 && pb.length > 3) {
		if (Math.abs((pa[3] ?? 1) - (pb[3] ?? 1)) > 0.15) return false;
	}
	return true;
}

function valuesMatch(prop: string, a: string, b: string): boolean {
	if (a === b) return true;
	// Normalize
	a = a.trim();
	b = b.trim();
	if (a === b) return true;

	// Color comparison with tolerance
	if (prop.includes('color') || prop === 'background-color') {
		return colorsClose(a, b);
	}

	// Numeric comparison with 1px tolerance
	const na = parseFloat(a),
		nb = parseFloat(b);
	if (!isNaN(na) && !isNaN(nb)) {
		return Math.abs(na - nb) <= 1;
	}

	// Font family — just check first family matches
	if (prop === 'font-family') {
		const fa = a.split(',')[0].replace(/"/g, '').trim().toLowerCase();
		const fb = b.split(',')[0].replace(/"/g, '').trim().toLowerCase();
		return fa === fb;
	}

	return false;
}

function compareElements(
	label: string,
	proto: ElementDump | null,
	prod: ElementDump | null,
	mismatches: Mismatch[]
): void {
	if (!proto || !prod) {
		mismatches.push({
			component: label,
			property: 'existence',
			prototype: proto ? 'present' : 'missing',
			production: prod ? 'present' : 'missing',
			severity: 'high'
		});
		return;
	}

	// Compare bounding box dimensions (not position since layouts differ)
	const wDiff = Math.abs(proto.rect.width - prod.rect.width);
	const hDiff = Math.abs(proto.rect.height - prod.rect.height);
	if (wDiff > 2) {
		mismatches.push({
			component: label,
			property: 'width',
			prototype: `${proto.rect.width}px`,
			production: `${prod.rect.width}px`,
			severity: wDiff > 8 ? 'high' : 'medium'
		});
	}
	if (hDiff > 2) {
		mismatches.push({
			component: label,
			property: 'height',
			prototype: `${proto.rect.height}px`,
			production: `${prod.rect.height}px`,
			severity: hDiff > 8 ? 'high' : 'medium'
		});
	}

	// Compare all style properties
	for (const prop of STYLE_PROPS) {
		const pv = proto.styles[prop];
		const dv = prod.styles[prop];
		if (pv === undefined || dv === undefined) continue;
		if (!valuesMatch(prop, pv, dv)) {
			mismatches.push({
				component: label,
				property: prop,
				prototype: pv,
				production: dv,
				severity: classifySeverity(prop, pv, dv)
			});
		}
	}
}

// ---- Main comparison ----

async function main() {
	const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu'] });

	// -- Prototype page --
	const protoPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	await protoPage.goto(PROTO_URL);
	// Click the full-app prototype button
	await protoPage.click('button:has-text("full-app")');
	await protoPage.waitForTimeout(1500); // Wait for animations

	// -- Production page --
	const prodPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	await prodPage.goto(PROD_URL);
	// Wait for editor to be ready
	await prodPage.waitForFunction(
		() => !!(window as unknown as Record<string, unknown>).__editorState,
		null,
		{
			timeout: 30000
		}
	);
	await prodPage.waitForTimeout(500);

	// Inject dump helper into both pages
	await injectDumper(protoPage);
	await injectDumper(prodPage);

	// Take full-page screenshots for visual comparison
	await protoPage.screenshot({ path: 'test-results/proto-full.png', fullPage: false });
	await prodPage.screenshot({ path: 'test-results/prod-full.png', fullPage: false });
	console.log('\n=== Screenshots saved to test-results/proto-full.png and prod-full.png ===\n');

	const mismatches: Mismatch[] = [];

	// ---- 1. SIDEBAR ----
	// Prototype sidebar: last child of the root flex container
	const protoSidebar = await dumpElement(protoPage, '.flex.h-screen > div:last-child', 1);
	const prodSidebar = await dumpElement(prodPage, '[data-testid="pipeline-sidebar"]', 1);
	compareElements('Sidebar', protoSidebar, prodSidebar, mismatches);

	// ---- 2. PHASE HEADERS ----
	// Prototype phase headers: inside the sidebar
	const protoPhaseHeaders = await dumpAll(
		protoPage,
		'.flex.h-screen > div:last-child > div > div > div:first-child',
		2
	);
	const prodPhaseHeaders = await dumpAll(prodPage, '[data-testid="phase-header"]', 2);
	const phaseCount = Math.min(protoPhaseHeaders.length, prodPhaseHeaders.length);
	for (let i = 0; i < phaseCount; i++) {
		compareElements(`PhaseHeader[${i}]`, protoPhaseHeaders[i], prodPhaseHeaders[i], mismatches);
	}
	if (protoPhaseHeaders.length !== prodPhaseHeaders.length) {
		mismatches.push({
			component: 'PhaseHeaders',
			property: 'count',
			prototype: String(protoPhaseHeaders.length),
			production: String(prodPhaseHeaders.length),
			severity: 'high'
		});
	}

	// ---- 3. NODE PANELS (cards) ----
	const protoCards = await dumpAll(
		protoPage,
		'.flex.h-screen > div:last-child [class*="border-t"][class*="bg-white"]',
		3
	);
	const prodCards = await dumpAll(prodPage, '[data-testid="node-panel"]', 3);
	const cardCount = Math.min(protoCards.length, prodCards.length);
	for (let i = 0; i < cardCount; i++) {
		compareElements(`NodePanel[${i}]`, protoCards[i], prodCards[i], mismatches);
		// Compare headers (first child)
		if (protoCards[i].children?.[0] && prodCards[i].children?.[0]) {
			compareElements(
				`NodePanel[${i}].header`,
				protoCards[i].children![0],
				prodCards[i].children![0],
				mismatches
			);
		}
		// Compare content (second child)
		if (protoCards[i].children?.[1] && prodCards[i].children?.[1]) {
			compareElements(
				`NodePanel[${i}].content`,
				protoCards[i].children![1],
				prodCards[i].children![1],
				mismatches
			);
		}
	}

	// ---- 4. + BUTTONS (phase add buttons) ----
	const protoAddBtns = await dumpAll(
		protoPage,
		'.flex.h-screen > div:last-child button[class*="rounded-full"][class*="h-6"]',
		2
	);
	const prodAddBtns = await dumpAll(prodPage, '[data-testid^="phase-add-"] ', 2);
	const addBtnCount = Math.min(protoAddBtns.length, prodAddBtns.length);
	for (let i = 0; i < addBtnCount; i++) {
		compareElements(`AddButton[${i}]`, protoAddBtns[i], prodAddBtns[i], mismatches);
	}

	// ---- 5. SLIDERS ----
	const protoSliders = await dumpAll(
		protoPage,
		'.flex.h-screen > div:last-child [class*="mb-1"][class*="flex-col"]',
		2
	);
	const prodSliders = await dumpAll(prodPage, '[data-testid^="slider-"]', 2);
	if (protoSliders.length > 0 && prodSliders.length > 0) {
		compareElements('Slider[0]', protoSliders[0], prodSliders[0], mismatches);
	}

	// ---- 6. TOP TOOLBAR (MainToolbar) ----
	const protoToolbar = await dumpElement(
		protoPage,
		'.flex.h-screen > div:first-child [class*="rounded-full"][class*="backdrop-blur"]',
		2
	);
	const prodToolbar = await dumpElement(prodPage, '[data-testid="main-toolbar"]', 2);
	compareElements('MainToolbar', protoToolbar, prodToolbar, mismatches);
	// Compare individual toolbar buttons
	if (protoToolbar?.children && prodToolbar?.children) {
		const btnCount = Math.min(
			protoToolbar.children.filter((c) => c.tag === 'button').length,
			prodToolbar.children.filter((c) => c.tag === 'button').length
		);
		const protoBtns = protoToolbar.children.filter((c) => c.tag === 'button');
		const prodBtns = prodToolbar.children.filter((c) => c.tag === 'button');
		for (let i = 0; i < btnCount; i++) {
			compareElements(`MainToolbar.button[${i}]`, protoBtns[i], prodBtns[i], mismatches);
		}
	}

	// ---- 7. VIEW SETTINGS TOOLBAR ----
	const protoViewToolbar = await dumpElement(
		protoPage,
		'.flex.h-screen > div:first-child > div > div:last-child [class*="rounded-full"][class*="backdrop-blur"]',
		2
	);
	const prodViewToolbar = await dumpElement(prodPage, '[data-testid="view-settings-toolbar"]', 2);
	compareElements('ViewSettingsToolbar', protoViewToolbar, prodViewToolbar, mismatches);

	// ---- 8. TOOLBAR POSITIONING ----
	// Check prototype vs production toolbar container positions
	const protoTopToolbarContainer = await dumpElement(
		protoPage,
		'.flex.h-screen > div:first-child > div > div:first-child',
		0
	);
	const prodTopToolbarContainer = await dumpElement(
		prodPage,
		'.pointer-events-none.absolute.top-3',
		0
	);
	if (protoTopToolbarContainer && prodTopToolbarContainer) {
		compareElements(
			'TopToolbarContainer',
			protoTopToolbarContainer,
			prodTopToolbarContainer,
			mismatches
		);
	}

	const protoBottomToolbarContainer = await dumpElement(
		protoPage,
		'.flex.h-screen > div:first-child > div > div:last-child',
		0
	);
	const prodBottomToolbarContainer = await dumpElement(
		prodPage,
		'.pointer-events-none.absolute.bottom-3',
		0
	);
	if (protoBottomToolbarContainer && prodBottomToolbarContainer) {
		compareElements(
			'BottomToolbarContainer',
			protoBottomToolbarContainer,
			prodBottomToolbarContainer,
			mismatches
		);
	}

	// ---- 9. OPEN STATES ----
	// Open view settings
	console.log('--- Opening view settings in both apps ---');
	try {
		// Prototype: click the settings gear button (bottom toolbar)
		const protoSettingsBtn = protoPage
			.locator('.flex.h-screen > div:first-child [class*="rounded-full"][class*="backdrop-blur"]')
			.last()
			.locator('button')
			.first();
		await protoSettingsBtn.click();
		await protoPage.waitForTimeout(500);
	} catch (e) {
		console.log('Could not open prototype settings:', e);
	}
	try {
		await prodPage.getByTestId('view-settings-toolbar').locator('button').first().click();
		await prodPage.waitForTimeout(300);
	} catch (e) {
		console.log('Could not open production settings:', e);
	}

	// Screenshot with settings open
	await protoPage.screenshot({ path: 'test-results/proto-settings-open.png', fullPage: false });
	await prodPage.screenshot({ path: 'test-results/prod-settings-open.png', fullPage: false });

	// Re-dump the view settings toolbar in open state
	const protoViewOpen = await dumpElement(
		protoPage,
		'.flex.h-screen > div:first-child > div > div:last-child [class*="rounded-full"][class*="backdrop-blur"]',
		3
	);
	const prodViewOpen = await dumpElement(prodPage, '[data-testid="view-settings-toolbar"]', 3);
	compareElements('ViewSettingsToolbar(open)', protoViewOpen, prodViewOpen, mismatches);

	// ---- REPORT ----
	console.log('\n' + '='.repeat(80));
	console.log('VISUAL FIDELITY COMPARISON REPORT');
	console.log('='.repeat(80));
	console.log(`Prototype: ${PROTO_URL}`);
	console.log(`Production: ${PROD_URL}`);
	console.log(`Total mismatches: ${mismatches.length}`);

	const high = mismatches.filter((m) => m.severity === 'high');
	const medium = mismatches.filter((m) => m.severity === 'medium');
	const low = mismatches.filter((m) => m.severity === 'low');

	if (high.length > 0) {
		console.log(`\n${'─'.repeat(60)}`);
		console.log(`HIGH SEVERITY (${high.length}):`);
		console.log(`${'─'.repeat(60)}`);
		for (const m of high) {
			console.log(`  ${m.component} → ${m.property}`);
			console.log(`    proto: ${m.prototype}`);
			console.log(`    prod:  ${m.production}`);
		}
	}

	if (medium.length > 0) {
		console.log(`\n${'─'.repeat(60)}`);
		console.log(`MEDIUM SEVERITY (${medium.length}):`);
		console.log(`${'─'.repeat(60)}`);
		for (const m of medium) {
			console.log(`  ${m.component} → ${m.property}`);
			console.log(`    proto: ${m.prototype}`);
			console.log(`    prod:  ${m.production}`);
		}
	}

	if (low.length > 0) {
		console.log(`\n${'─'.repeat(60)}`);
		console.log(`LOW SEVERITY (${low.length}):`);
		console.log(`${'─'.repeat(60)}`);
		for (const m of low) {
			console.log(`  ${m.component} → ${m.property}`);
			console.log(`    proto: ${m.prototype}`);
			console.log(`    prod:  ${m.production}`);
		}
	}

	// Also dump full data for manual inspection
	const report = { mismatches, high: high.length, medium: medium.length, low: low.length };
	const fs = await import('fs');
	fs.mkdirSync('test-results', { recursive: true });
	fs.writeFileSync('test-results/visual-comparison.json', JSON.stringify(report, null, 2));
	console.log('\nFull report saved to test-results/visual-comparison.json');
	console.log('Screenshots saved to test-results/proto-*.png and prod-*.png');

	await browser.close();
}

main().catch((e) => {
	console.error('Comparison failed:', e);
	process.exit(1);
});
