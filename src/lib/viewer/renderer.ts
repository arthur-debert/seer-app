import { logger } from '$lib/log';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';
import type { ViewLayout } from './viewport';

const log = logger('renderer');

export class Renderer {
	private device!: GPUDevice;
	private ownsDevice = true;
	private context!: GPUCanvasContext;
	private pipeline!: GPURenderPipeline;
	private bindGroupLayout!: GPUBindGroupLayout;
	private bindGroup: GPUBindGroup | null = null;
	private canvas!: HTMLCanvasElement;
	private viewportBuffer!: GPUBuffer;
	private sampler!: GPUSampler;
	private textureView: GPUTextureView | null = null;

	async init(canvas: HTMLCanvasElement, sharedDevice?: GPUDevice): Promise<void> {
		this.canvas = canvas;

		if (sharedDevice) {
			this.device = sharedDevice;
			this.ownsDevice = false;
			log.info('using shared GPU device');
		} else {
			log.info('requesting WebGPU adapter');
			const adapter = await navigator.gpu?.requestAdapter();
			if (!adapter) throw new Error('WebGPU not supported: no adapter found');

			log.info('adapter acquired', {
				vendor: adapter.info.vendor,
				architecture: adapter.info.architecture,
				device: adapter.info.device
			});

			this.device = await adapter.requestDevice();
			log.info('device ready');
		}

		this.context = canvas.getContext('webgpu') as GPUCanvasContext;
		const format = navigator.gpu.getPreferredCanvasFormat();

		this.context.configure({
			device: this.device,
			format,
			alphaMode: 'opaque',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
		});
		log.info('canvas context configured', { format });

		this.viewportBuffer = this.device.createBuffer({
			label: 'viewport-uniform',
			size: 48, // vec2f uv_scale + vec2f uv_offset + vec4f bg_color + vec4f mat_bounds = 12 floats = 48 bytes
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.sampler = this.device.createSampler({
			label: 'image-sampler',
			magFilter: 'linear',
			minFilter: 'linear'
		});

		this.bindGroupLayout = this.device.createBindGroupLayout({
			label: 'image-bind-group-layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: { type: 'filtering' }
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'float' }
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: { type: 'uniform' }
				}
			]
		});

		this.pipeline = this.device.createRenderPipeline({
			label: 'image-render-pipeline',
			layout: this.device.createPipelineLayout({
				label: 'image-pipeline-layout',
				bindGroupLayouts: [this.bindGroupLayout]
			}),
			vertex: {
				module: this.device.createShaderModule({
					label: 'fullscreen-triangle-vertex',
					code: VERTEX_SHADER
				}),
				entryPoint: 'main'
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'image-sample-fragment',
					code: FRAGMENT_SHADER
				}),
				entryPoint: 'main',
				targets: [{ format }]
			}
		});

		log.info('render pipeline created');
	}

	loadPixels(data: Uint8Array, width: number, height: number): { width: number; height: number } {
		log.info('loading raw pixels', { width, height, bytes: data.byteLength });

		const maxDim = this.device.limits.maxTextureDimension2D;
		let finalData = data;
		let finalW = width;
		let finalH = height;

		if (width > maxDim || height > maxDim) {
			const scale = maxDim / Math.max(width, height);
			finalW = Math.floor(width * scale);
			finalH = Math.floor(height * scale);
			log.info('pixels exceed GPU max texture size, downsampling', {
				original: { width, height },
				maxDim,
				resized: { width: finalW, height: finalH }
			});
			// Nearest-neighbor downsample in CPU
			const out = new Uint8Array(finalW * finalH * 4);
			for (let y = 0; y < finalH; y++) {
				const srcY = Math.floor((y * height) / finalH);
				for (let x = 0; x < finalW; x++) {
					const srcX = Math.floor((x * width) / finalW);
					const srcIdx = (srcY * width + srcX) * 4;
					const dstIdx = (y * finalW + x) * 4;
					out[dstIdx] = data[srcIdx];
					out[dstIdx + 1] = data[srcIdx + 1];
					out[dstIdx + 2] = data[srcIdx + 2];
					out[dstIdx + 3] = data[srcIdx + 3];
				}
			}
			finalData = out;
		}

		const texture = this.device.createTexture({
			label: 'image-texture',
			size: { width: finalW, height: finalH },
			format: 'rgba8unorm',
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT
		});

		this.device.queue.writeTexture(
			{ texture },
			finalData as Uint8Array<ArrayBuffer>,
			{ bytesPerRow: finalW * 4, rowsPerImage: finalH },
			{ width: finalW, height: finalH }
		);
		log.info('pixels uploaded to GPU via writeTexture');

		this.textureView = texture.createView();
		this.rebuildBindGroup();

		return { width: finalW, height: finalH };
	}

	async loadImage(imageBytes: ArrayBuffer): Promise<{ width: number; height: number }> {
		log.info('decoding image', { bytes: imageBytes.byteLength });
		const blob = new Blob([imageBytes]);
		let bitmap = await createImageBitmap(blob);
		log.info('image decoded', { width: bitmap.width, height: bitmap.height });

		// Downsample if the image exceeds the GPU's maximum texture dimension
		const maxDim = this.device.limits.maxTextureDimension2D;
		if (bitmap.width > maxDim || bitmap.height > maxDim) {
			const scale = maxDim / Math.max(bitmap.width, bitmap.height);
			const resizedW = Math.floor(bitmap.width * scale);
			const resizedH = Math.floor(bitmap.height * scale);
			log.info('image exceeds GPU max texture size, downsampling', {
				original: { width: bitmap.width, height: bitmap.height },
				maxDim,
				resized: { width: resizedW, height: resizedH }
			});
			const resized = await createImageBitmap(bitmap, {
				resizeWidth: resizedW,
				resizeHeight: resizedH,
				resizeQuality: 'high'
			});
			bitmap.close();
			bitmap = resized;
		}

		const texture = this.device.createTexture({
			label: 'image-texture',
			size: { width: bitmap.width, height: bitmap.height },
			format: 'rgba8unorm',
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT
		});

		this.device.queue.copyExternalImageToTexture(
			{ source: bitmap },
			{ texture },
			{ width: bitmap.width, height: bitmap.height }
		);
		log.info('texture uploaded to GPU');

		this.textureView = texture.createView();
		this.rebuildBindGroup();

		const dims = { width: bitmap.width, height: bitmap.height };
		bitmap.close();
		log.info('image ready for rendering');
		return dims;
	}

	private rebuildBindGroup(): void {
		if (!this.textureView) return;

		this.bindGroup = this.device.createBindGroup({
			label: 'image-bind-group',
			layout: this.bindGroupLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: this.textureView },
				{ binding: 2, resource: { buffer: this.viewportBuffer } }
			]
		});
	}

	private bgColor: [number, number, number, number] = [0, 0, 0, 1];

	/** Set the background color shown outside the image region (mat color). */
	setBgColor(r: number, g: number, b: number, a: number = 1): void {
		this.bgColor = [r, g, b, a];
	}

	updateViewportUniform(layout: ViewLayout): void {
		const matBounds = layout.mat_bounds ?? [0, 0, 1, 1];
		const data = new Float32Array([
			...layout.uv_scale,
			...layout.uv_offset,
			...this.bgColor,
			...matBounds
		]);
		this.device.queue.writeBuffer(this.viewportBuffer, 0, data);

		log.info('viewport uniform updated', {
			uvScale: layout.uv_scale,
			uvOffset: layout.uv_offset
		});
	}

	render(scissorRect?: { x: number; y: number; width: number; height: number }): void {
		if (!this.bindGroup) return;

		const encoder = this.device.createCommandEncoder();
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.context.getCurrentTexture().createView(),
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
					loadOp: 'clear' as const,
					storeOp: 'store' as const
				}
			]
		});

		if (scissorRect && scissorRect.width > 0 && scissorRect.height > 0) {
			pass.setScissorRect(scissorRect.x, scissorRect.y, scissorRect.width, scissorRect.height);
		}

		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bindGroup);
		pass.draw(3);
		pass.end();

		this.device.queue.submit([encoder.finish()]);
	}

	resize(): void {
		const dpr = window.devicePixelRatio;
		const w = Math.floor(this.canvas.clientWidth * dpr);
		const h = Math.floor(this.canvas.clientHeight * dpr);

		if (this.canvas.width !== w || this.canvas.height !== h) {
			this.canvas.width = w;
			this.canvas.height = h;
			log.info('canvas resized', { width: w, height: h, dpr });
		}
	}

	/**
	 * Read back the current canvas contents as raw RGBA pixels.
	 * Returns { width, height, data } where data is a Uint8Array of RGBA bytes.
	 * Must be called after render().
	 */
	async readback(): Promise<{ width: number; height: number; data: Uint8Array }> {
		const texture = this.context.getCurrentTexture();
		const width = texture.width;
		const height = texture.height;

		const bytesPerPixel = 4;
		const unpaddedBytesPerRow = width * bytesPerPixel;
		const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256;

		const buffer = this.device.createBuffer({
			label: 'readback-buffer',
			size: paddedBytesPerRow * height,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});

		const encoder = this.device.createCommandEncoder({ label: 'readback-encoder' });
		encoder.copyTextureToBuffer(
			{ texture },
			{ buffer, bytesPerRow: paddedBytesPerRow },
			{ width, height }
		);
		this.device.queue.submit([encoder.finish()]);

		await buffer.mapAsync(GPUMapMode.READ);
		const mapped = new Uint8Array(buffer.getMappedRange());

		// Strip row padding
		const data = new Uint8Array(width * height * bytesPerPixel);
		for (let row = 0; row < height; row++) {
			data.set(
				mapped.subarray(row * paddedBytesPerRow, row * paddedBytesPerRow + unpaddedBytesPerRow),
				row * unpaddedBytesPerRow
			);
		}

		buffer.unmap();
		buffer.destroy();

		log.info('readback complete', { width, height, bytes: data.byteLength });
		return { width, height, data };
	}

	/** Shared access to the GPU device (for MinimapRenderer). */
	getDevice(): GPUDevice {
		return this.device;
	}

	/** Shared access to the image texture view (for MinimapRenderer). */
	getTextureView(): GPUTextureView | null {
		return this.textureView;
	}

	destroy(): void {
		if (this.ownsDevice) {
			this.device?.destroy();
		}
		log.info('renderer destroyed');
	}
}
