import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/demo-e2e-results.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    actionTimeout: 10000,
  },
  testMatch: /demo-mode\.spec\.ts$/,
});
