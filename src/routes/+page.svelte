<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<main class="bg-surface-0 flex h-screen w-screen items-center justify-center">
	<div class="max-w-md space-y-8">
		<div>
			<h1 class="text-text-primary text-2xl font-semibold">Seer</h1>
			<p class="text-text-muted mt-1 text-sm">Component demos</p>
		</div>

		<nav class="space-y-3">
			<a
				href={resolve('/viewer')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">ImageViewer</span>
				<p class="text-text-muted mt-1 text-sm">
					Interactive image viewer with zoom, pan, and WebGPU rendering.
				</p>
			</a>

			<a
				href={resolve('/framer')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">Framer</span>
				<p class="text-text-muted mt-1 text-sm">
					Frame-first crop tool with minimap. Pan and zoom the image behind a fixed-ratio frame.
				</p>
			</a>

			<a
				href={resolve('/mirror')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">Mirror</span>
				<p class="text-text-muted mt-1 text-sm">
					Side-by-side synchronized comparison of two images.
				</p>
			</a>
			<a
				href={resolve('/editor')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">Editor</span>
				<p class="text-text-muted mt-1 text-sm">
					Image editing pipeline with adjustment-based processing.
				</p>
			</a>
			<a
				href={resolve('/image-area')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">ImageArea</span>
				<p class="text-text-muted mt-1 text-sm">
					Image viewer with mat/frame and magnification controls.
				</p>
			</a>
			<a
				href={resolve('/icons')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">Icons</span>
				<p class="text-text-muted mt-1 text-sm">All registered icons used across the app.</p>
			</a>
			<a
				href={resolve('/components')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">Components</span>
				<p class="text-text-muted mt-1 text-sm">Complex UI widgets with hardcoded mock data.</p>
			</a>
			<a
				href={resolve('/design-system')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">Design System</span>
				<p class="text-text-muted mt-1 text-sm">
					Color tokens, typography, spacing, and effects reference.
				</p>
			</a>
			<a
				href={resolve('/radial-menu')}
				class="border-border hover:border-border-strong hover:bg-surface-1 block rounded-lg border px-5 py-4 transition-colors"
			>
				<span class="text-text-secondary font-medium">RadialMenu</span>
				<p class="text-text-muted mt-1 text-sm">
					Arc menu with 45-degree spacing and edge-aware orientation.
				</p>
			</a>
		</nav>
	</div>
</main>
