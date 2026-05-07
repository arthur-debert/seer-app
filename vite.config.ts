/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import Icons from 'unplugin-icons/vite';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync, cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename } from 'path';

const host = process.env.TAURI_DEV_HOST;

/**
 * Serve onnxruntime-web WASM/MJS files directly from node_modules.
 *
 * onnxruntime-web dynamically imports worker .mjs files and fetches .wasm binaries.
 * Vite's dev server intercepts dynamic imports and breaks them. This plugin adds
 * middleware that serves /ort-wasm/* files directly, bypassing Vite's transform pipeline.
 * For production builds, the files are copied to the output by the buildStart hook.
 */
function serveOrtWasm(): Plugin {
	const ORT_DIST = resolve('node_modules/onnxruntime-web/dist');
	const MIME: Record<string, string> = {
		'.wasm': 'application/wasm',
		'.mjs': 'application/javascript'
	};

	let isBuild = false;

	return {
		name: 'serve-ort-wasm',
		config(_, { command }) {
			isBuild = command === 'build';
		},
		// Dev: serve directly from node_modules, bypassing Vite's module transforms
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url ?? '';
				const match = url.match(/^\/ort-wasm\/([^?]+)/);
				if (!match) return next();

				const filename = basename(match[1]);
				const ext = filename.substring(filename.lastIndexOf('.'));
				const mime = MIME[ext];
				if (!mime) return next();

				const filePath = resolve(ORT_DIST, filename);
				if (!existsSync(filePath)) return next();

				res.setHeader('Content-Type', mime);
				res.setHeader('Cache-Control', 'public, max-age=604800');
				res.end(readFileSync(filePath));
			});
		},
		// Build: copy files to static/ort-wasm/ so they end up in the production output
		buildStart() {
			if (!isBuild) return;
			const dest = resolve('static/ort-wasm');
			if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
			for (const name of readdirSync(ORT_DIST)) {
				if (name.startsWith('ort-wasm-simd-threaded') && /\.(wasm|mjs)$/.test(name)) {
					cpSync(resolve(ORT_DIST, name), resolve(dest, name));
				}
			}
		}
	};
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		devtoolsJson(),
		Icons({
			compiler: 'svelte',
			customCollections: {
				arami: FileSystemIconLoader('./src/icons', (svg) =>
					svg.replace(/^<svg /, '<svg fill="currentColor" ')
				)
			}
		}),
		serveOrtWasm(),
		sveltekit()
	],

	// Tauri expects a fixed port, fail if it's taken
	server: {
		port: 5173,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 5174
				}
			: undefined,
		watch: {
			ignored: ['**/wasm/**']
		},
		fs: {
			// Allow serving files from the parent directory (e.g. temp-images/) in dev mode
			allow: ['..']
		}
	},

	optimizeDeps: {
		exclude: ['onnxruntime-web']
	},

	test: {
		exclude: ['tests/e2e/**', '**/node_modules/**', 'git-trees/**']
	},

	// Produce sourcemaps for tauri debug builds
	build: {
		sourcemap: !!process.env.TAURI_ENV_DEBUG
	}
});
