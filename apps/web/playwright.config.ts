import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for apps/web.
 *
 * Tests mock the NestJS API using page.route() so no running backend is needed.
 * The Vite dev server is started automatically for each test run.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 20_000,
  retries: process.env['CI'] ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Reuse a running dev server in local development; always start fresh in CI
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
