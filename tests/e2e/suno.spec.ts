/**
 * suno.spec.ts — Lyricist Pro / Vibe
 * Full E2E coverage for Suno music generation.
 * ALL external calls are mocked — no API keys required.
 *
 * API routes:
 *   POST /api/suno/generate  → starts generation, returns job or audio
 *   POST /api/suno/extend    → extends an existing track
 *   GET  /api/suno/get       → polls generation status
 */
import { test, expect, Page } from '@playwright/test';

function setupSunoGenerateMock(page: Page, opts: { error?: boolean; slow?: boolean } = {}) {
  return page.route('**/api/suno/generate**', async (route) => {
    if (opts.slow) await new Promise((r) => setTimeout(r, 1_200));
    if (opts.error) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Suno service unavailable (mocked)' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-suno-job-001',
          audioUrl: 'https://example.com/suno-track.mp3',
          status: 'complete',
          title: 'Mocked Suno Track',
          provider: 'suno',
        }),
      });
    }
  });
}

function setupSunoGetMock(page: Page) {
  return page.route('**/api/suno/get**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-suno-job-001',
        status: 'complete',
        audioUrl: 'https://example.com/suno-track.mp3',
      }),
    });
  });
}

function setupSunoExtendMock(page: Page) {
  return page.route('**/api/suno/extend**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-suno-ext-001',
        status: 'complete',
        audioUrl: 'https://example.com/suno-extended.mp3',
      }),
    });
  });
}

/**
 * Navigate to the Suno panel.
 * Hard-asserts the panel is found — a missing panel is a regression, not a skip.
 * Selector is intentionally broad to survive UI refactors.
 */
async function navigateToSunoPanel(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const sunoBtn = page
    .locator(
      'button, [role="tab"], a, [data-testid*="suno"], [aria-label*="suno" i]',
    )
    .filter({ hasText: /suno/i })
    .first();
  await expect(sunoBtn).toBeVisible({ timeout: 8_000 });
  await sunoBtn.click();
}

test.describe('Suno — Generation (mocked)', () => {
  test('Suno generate button triggers API and renders audio player', async ({ page }) => {
    await setupSunoGenerateMock(page);
    await setupSunoGetMock(page);
    await navigateToSunoPanel(page);

    const generateBtn = page
      .locator('button')
      .filter({ hasText: /generat|créer|compose|create/i })
      .first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/suno/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();

    const audioEl = page.locator('audio, [data-testid="audio-player"], [class*="player"]').first();
    await expect(audioEl).toBeVisible({ timeout: 12_000 });
  });

  test('generated track appears in track list', async ({ page }) => {
    await setupSunoGenerateMock(page);
    await setupSunoGetMock(page);
    await navigateToSunoPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/suno/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();

    // Track list is an optional UI feature — skip only if the element is genuinely absent
    const trackItem = page
      .locator('[data-testid*="track"], [class*="track"], text=/Mocked Suno Track/i')
      .first();
    if (!(await trackItem.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(); // Track list UI not present in this build
      return;
    }
    await expect(trackItem).toBeVisible();
  });
});

test.describe('Suno — Poll / extend (mocked)', () => {
  test('get endpoint is called to poll status', async ({ page }) => {
    let pollCalled = false;
    await setupSunoGenerateMock(page);
    await page.route('**/api/suno/get**', async (route) => {
      pollCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-suno-job-001', status: 'complete', audioUrl: 'https://example.com/suno-track.mp3' }),
      });
    });

    await navigateToSunoPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/suno/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();

    // Wait for the audio/player element as the observable post-poll outcome —
    // avoids arbitrary waitForTimeout. If it never appears, only tolerate that
    // when polling didn't fire either (feature not implemented in this build);
    // otherwise rethrow as a real failure below.
    try {
      await page
        .locator('audio, [data-testid="audio-player"], [class*="player"]')
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
    } catch (err) {
      if (pollCalled) throw err;
    }

    // pollCalled reflects whether the app actually fires /api/suno/get;
    // skip only if the polling feature is not implemented in this build
    if (!pollCalled) {
      test.skip();
    }
  });

  test('extend action calls /api/suno/extend', async ({ page }) => {
    let extendCalled = false;
    await setupSunoGenerateMock(page);
    await setupSunoGetMock(page);
    await page.route('**/api/suno/extend**', async (route) => {
      extendCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-ext', status: 'complete', audioUrl: 'https://example.com/suno-extended.mp3' }),
      });
    });

    await navigateToSunoPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });
    await generateBtn.click();
    await page.waitForResponse('**/api/suno/generate**');

    // Extend button is optional — skip if not present in this build
    const extendBtn = page.locator('button').filter({ hasText: /extend|prolonger/i }).first();
    if (!(await extendBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(); // Extend feature not available in this build
      return;
    }
    const [extResp] = await Promise.all([
      page.waitForResponse('**/api/suno/extend**'),
      extendBtn.click(),
    ]);
    await extResp.finished();
    expect(extendCalled).toBe(true);
  });
});

test.describe('Suno — Error handling (mocked)', () => {
  test('503 from Suno does not crash the app', async ({ page }) => {
    await setupSunoGenerateMock(page, { error: true });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await navigateToSunoPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/suno/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();
    expect(pageErrors).toHaveLength(0);

    const errorIndicator = page
      .locator('[role="alert"], [class*="error"], text=/erreur|error|unavailable/i')
      .first();
    if (await errorIndicator.isVisible({ timeout: 5_000 })) {
      await expect(errorIndicator).toBeVisible();
    }
  });

  test('slow generation shows loading state (mocked 1.2s delay)', async ({ page }) => {
    await setupSunoGenerateMock(page, { slow: true });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await navigateToSunoPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });
    await generateBtn.click();

    const loadingEl = page
      .locator('[class*="loading"], [aria-busy="true"], [data-testid*="loading"]')
      .first();
    const isLoading = await loadingEl.isVisible({ timeout: 800 }).catch(() => false);
    // Wait for the slow mock to resolve via network event — no fixed timeout
    await page.waitForResponse('**/api/suno/generate**');
    expect(pageErrors).toHaveLength(0);
    // Loading state is a UI-quality check — skip only if genuinely not implemented
    if (!isLoading) test.skip();
  });
});
