import { logger } from './log';

const log = logger('loader');

export type ImageSource = { kind: 'path'; path: string } | { kind: 'url'; url: string };

function hasTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function loadViaTauri(path: string): Promise<ArrayBuffer> {
	const { invoke } = await import('@tauri-apps/api/core');
	return await invoke<ArrayBuffer>('load_image', { path });
}

async function loadViaFetch(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
	return response.arrayBuffer();
}

/**
 * Save raw RGBA pixels as a PNG file via the Tauri backend.
 * Only available in debug builds.
 */
export async function exportRender(
	path: string,
	width: number,
	height: number,
	data: Uint8Array
): Promise<void> {
	if (!hasTauri()) {
		throw new Error('exportRender requires Tauri');
	}

	log.info('exporting render', { path, width, height, bytes: data.byteLength });
	const { invoke } = await import('@tauri-apps/api/core');
	await invoke('export_render', {
		path,
		width,
		height,
		pixels: Array.from(data)
	});
	log.info('render exported', { path });
}

export async function loadImage(source: ImageSource): Promise<ArrayBuffer> {
	if (source.kind === 'url') {
		log.info('loading image via fetch', { url: source.url });
		const bytes = await loadViaFetch(source.url);
		log.info('image loaded via fetch', { url: source.url, bytes: bytes.byteLength });
		return bytes;
	}

	// kind === 'path' — use Tauri when available, fall back to Vite /@fs/ in dev
	if (hasTauri()) {
		log.info('loading image via Tauri', { path: source.path });
		const bytes = await loadViaTauri(source.path);
		log.info('image loaded via Tauri', { path: source.path, bytes: bytes.byteLength });
		return bytes;
	}

	log.info('loading image via Vite /@fs/', { path: source.path });
	const bytes = await loadViaFetch(`/@fs${source.path}`);
	log.info('image loaded via Vite /@fs/', { path: source.path, bytes: bytes.byteLength });
	return bytes;
}
