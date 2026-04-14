/**
 * Lightweight WebGPU renderer for the minimap thumbnail.
 *
 * Shares the GPUDevice and image GPUTextureView from the main Renderer
 * to avoid duplicating GPU memory. Creates its own pipeline, bind group,
 * and viewport uniform for a small canvas showing the full image at
 * contain-fit.
 */

import { VERTEX_SHADER, FRAGMENT_SHADER } from '$lib/viewer/shaders';
import { computeViewLayout } from '$lib/viewer/viewport';
import type { Size } from '$lib/viewer/viewport';

export class MinimapRenderer {
	private device: GPUDevice;
	private context!: GPUCanvasContext;
	private pipeline!: GPURenderPipeline;
	private bindGroupLayout!: GPUBindGroupLayout;
	private bindGroup: GPUBindGroup | null = null;
	private canvas!: HTMLCanvasElement;
	private viewportBuffer!: GPUBuffer;
	private sampler!: GPUSampler;
	private textureView: GPUTextureView | null = null;
	private contentSize: Size = { width: 0, height: 0 };

	constructor(device: GPUDevice) {
		this.device = device;
	}

	init(canvas: HTMLCanvasElement): void {
		this.canvas = canvas;

		this.context = canvas.getContext('webgpu') as GPUCanvasContext;
		const format = navigator.gpu.getPreferredCanvasFormat();

		this.context.configure({
			device: this.device,
			format,
			alphaMode: 'opaque',
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		});

		this.viewportBuffer = this.device.createBuffer({
			label: 'minimap-viewport-uniform',
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.sampler = this.device.createSampler({
			label: 'minimap-sampler',
			magFilter: 'linear',
			minFilter: 'linear'
		});

		this.bindGroupLayout = this.device.createBindGroupLayout({
			label: 'minimap-bind-group-layout',
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
			label: 'minimap-render-pipeline',
			layout: this.device.createPipelineLayout({
				label: 'minimap-pipeline-layout',
				bindGroupLayouts: [this.bindGroupLayout]
			}),
			vertex: {
				module: this.device.createShaderModule({
					label: 'minimap-vertex',
					code: VERTEX_SHADER
				}),
				entryPoint: 'main'
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'minimap-fragment',
					code: FRAGMENT_SHADER
				}),
				entryPoint: 'main',
				targets: [{ format }]
			}
		});
	}

	/** Set the shared image texture from the main renderer. */
	setTexture(textureView: GPUTextureView, contentSize: Size): void {
		this.textureView = textureView;
		this.contentSize = contentSize;
		this.rebuildBindGroup();
		this.updateViewport();
	}

	private rebuildBindGroup(): void {
		if (!this.textureView) return;

		this.bindGroup = this.device.createBindGroup({
			label: 'minimap-bind-group',
			layout: this.bindGroupLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: this.textureView },
				{ binding: 2, resource: { buffer: this.viewportBuffer } }
			]
		});
	}

	/** Recompute the contain-fit viewport uniform for current canvas size. */
	private updateViewport(): void {
		if (this.contentSize.width === 0 || this.contentSize.height === 0) return;

		const layout = computeViewLayout(
			this.contentSize,
			{ width: this.canvas.width, height: this.canvas.height },
			'Contain'
		);

		const data = new Float32Array([...layout.uv_scale, ...layout.uv_offset]);
		this.device.queue.writeBuffer(this.viewportBuffer, 0, data);
	}

	resize(): void {
		const dpr = window.devicePixelRatio;
		const w = Math.floor(this.canvas.clientWidth * dpr);
		const h = Math.floor(this.canvas.clientHeight * dpr);

		if (this.canvas.width !== w || this.canvas.height !== h) {
			this.canvas.width = w;
			this.canvas.height = h;
			this.updateViewport();
		}
	}

	render(): void {
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

		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bindGroup);
		pass.draw(3);
		pass.end();

		this.device.queue.submit([encoder.finish()]);
	}
}
