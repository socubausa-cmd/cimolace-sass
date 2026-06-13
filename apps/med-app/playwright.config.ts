import { defineConfig } from '@playwright/test';

/**
 * Playwright smoke configuration for @isna/med-app.
 *
 * Override the target with E2E_BASE_URL (default: production med.cimolace.space).
 * Override the auth handoff with E2E_HANDOFF_URL (see e2e/auth.setup.ts).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  reporter: 'list',
  outputDir: 'e2e-results',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://med.cimolace.space',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
