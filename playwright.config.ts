import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Vibe / Lyricist Pro
 * - Smoke tests on PR (fast, mocked AI backends)
 * - Full suite on main / pre-prod
 * Docs: https://playwright.dev/docs/test-configuration
 */

// Fixed port for the preview server. Kept in sync with the workflow's
// E2E_BASE_URL and the `webServer` block below.
const PORT = 4173;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

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
    baseURL: BASE_URL,
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

  /*
   * Always start the built app via `vite preview` on a fixed port.
   *
   * Previously this block was disabled when CI was set (`process.env.CI`),
   * but the workflow never started its own server — so nothing listened on
   * :4173 and every `page.goto` failed with NS_ERROR_CONNECTION_REFUSED.
   * Starting the preview server here works both in CI and locally;
   * `reuseExistingServer` means a dev server already running locally is
   * reused instead of conflicting.
   */
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
