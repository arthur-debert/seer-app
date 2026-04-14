import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 30_000,
	retries: 0,
	use: {
		baseURL: 'http://localhost:5173',
		actionTimeout: 5_000
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan']
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
