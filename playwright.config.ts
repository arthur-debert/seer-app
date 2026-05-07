import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 30_000,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['html']],
	use: {
		baseURL: 'http://localhost:5173',
		actionTimeout: 5_000,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: [
						'--enable-unsafe-webgpu',
						'--enable-features=Vulkan',
						...(process.env.CI ? ['--no-sandbox', '--use-webgpu-adapter=swiftshader'] : [])
					]
				}
			}
		}
	],
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI
	}
});
