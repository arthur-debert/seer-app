import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		alias: {
			$viewer_wasm: 'wasm/seer-viewer-wasm/pkg',
			$editor_wasm: 'wasm/seer-editor-wasm/pkg'
		}
	}
};

export default config;
