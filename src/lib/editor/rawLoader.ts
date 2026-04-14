/**
 * Raw image loader using libraw-wasm.
 *
 * Detects DNG files via TIFF magic bytes and decodes them through libraw
 * (same engine as rawpy) to produce linear RGB f32 data for the pipeline.
 */

import LibRaw from 'libraw-wasm';

let librawInstance: Awaited<ReturnType<typeof LibRaw.initialize>> | null = null;

async function getLibRaw(): Promise<Awaited<ReturnType<typeof LibRaw.initialize>>> {
	if (!librawInstance) {
		librawInstance = await LibRaw.initialize();
	}
	return librawInstance;
}

/** Check if bytes are a DNG file (TIFF magic bytes). */
export function isDng(buffer: ArrayBuffer): boolean {
	if (buffer.byteLength < 4) return false;
	const view = new DataView(buffer);
	const b0 = view.getUint8(0);
	const b1 = view.getUint8(1);
	const b2 = view.getUint8(2);
	const b3 = view.getUint8(3);
	// Little-endian TIFF: II 0x2A 0x00
	const le = b0 === 0x49 && b1 === 0x49 && b2 === 0x2a && b3 === 0x00;
	// Big-endian TIFF: MM 0x00 0x2A
	const be = b0 === 0x4d && b1 === 0x4d && b2 === 0x00 && b3 === 0x2a;
	return le || be;
}

/** Decode a raw image (DNG) to linear RGB float data. */
export async function decodeRaw(
	buffer: ArrayBuffer
): Promise<{ data: Float32Array; width: number; height: number }> {
	const libraw = await getLibRaw();
	const result = libraw.process(new Uint8Array(buffer), {
		gamm: [1, 1],
		outputBps: 16,
		noAutoBright: true,
		useCameraWb: true
	});

	const width = result.width;
	const height = result.height;
	const u16 = result.data as Uint16Array;

	// Convert 16-bit [0, 65535] to f32 [0.0, 1.0]
	const f32 = new Float32Array(u16.length);
	for (let i = 0; i < u16.length; i++) {
		f32[i] = u16[i] / 65535.0;
	}

	return { data: f32, width, height };
}
