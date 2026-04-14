export const VERTEX_SHADER = /* wgsl */ `
struct VertexOutput {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
};

@vertex
fn main(@builtin(vertex_index) vi: u32) -> VertexOutput {
	// Fullscreen triangle: vertices at (-1,-1), (3,-1), (-1,3)
	// Covers the entire [-1,1] clip space; GPU clips the excess.
	let x = f32(i32(vi & 1u) * 4 - 1);
	let y = f32(i32(vi & 2u) * 2 - 1);

	var out: VertexOutput;
	out.position = vec4f(x, y, 0.0, 1.0);
	// Clip [-1,1] -> UV [0,1], Y flipped (texture origin is top-left)
	out.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
	return out;
}
`;

export const FRAGMENT_SHADER = /* wgsl */ `
struct Viewport {
	uv_scale: vec2f,
	uv_offset: vec2f,
	bg_color: vec4f,
	// Inner rect bounds in normalized UV space: (min_x, min_y, max_x, max_y).
	// Pixels outside these bounds are always background (mat margin).
	mat_bounds: vec4f,
};

@group(0) @binding(0) var tex_sampler: sampler;
@group(0) @binding(1) var tex_image: texture_2d<f32>;
@group(0) @binding(2) var<uniform> viewport: Viewport;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
	// Remap screen UV to image UV: subtract offset, divide by scale
	let image_uv = (uv - viewport.uv_offset) / viewport.uv_scale;

	// Sample unconditionally — textureSample requires uniform control flow.
	// Clamping keeps out-of-bounds UVs from causing artifacts; the select
	// below replaces those pixels with background color anyway.
	let clamped_uv = clamp(image_uv, vec2f(0.0), vec2f(1.0));
	let color = textureSample(tex_image, tex_sampler, clamped_uv);

	// Pixel must be inside the image UV region AND inside the inner rect (mat bounds).
	// The mat_bounds check ensures the image never bleeds into the mat margin when zoomed in.
	let in_image = image_uv.x >= 0.0 && image_uv.x <= 1.0 && image_uv.y >= 0.0 && image_uv.y <= 1.0;
	let in_bounds = uv.x >= viewport.mat_bounds.x && uv.x <= viewport.mat_bounds.z
	             && uv.y >= viewport.mat_bounds.y && uv.y <= viewport.mat_bounds.w;
	return select(viewport.bg_color, color, in_image && in_bounds);
}
`;
