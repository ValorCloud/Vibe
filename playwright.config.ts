import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright E2E configuration for Vibe / Lyricist Pro
 * - Smoke tests on PR (fast, mocked AI backends)
 * - Full suite on main / pre-prod
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Fewer workers on CI */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter */
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  use: {
    /* Base URL — override via E2E_BASE_URL in CI */
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    /* Collect traces on first retry */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Generous timeout for AI generation endpoints */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  /* Global timeout per test */
  timeout: 60_000,

  projects: [
    /* ── Smoke (subset used in PR gate) ── */
    {
      name: 'chromium-smoke',
      testMatch: /smoke\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },

    /* ── Full suite ── */
    {
      name: 'chromium',
      testIgnore: /smoke\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: /smoke\.spec\.ts$/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: /smoke\.spec\.ts$/,
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Start the Vite dev server automatically when running locally */
  webServer: process.env.CI
    ? undefined   // CI boots its own server
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
