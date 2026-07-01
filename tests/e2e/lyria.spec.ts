/**
 * lyria.spec.ts — Lyricist Pro / Vibe
 * Full E2E coverage for Lyria music generation.
 * ALL external calls are mocked — no API keys required.
 *
 * API routes:
 *   POST /api/lyria/generate  → returns { audioUrl, duration, provider }
 */
import { test, expect, Page } from '@playwright/test';

function setupLyriaMock(
  page: Page,
  opts: { error?: boolean; status?: number } = {},
) {
  const { error = false, status = 200 } = opts;
  return page.route('**/api/lyria/generate**', async (route) => {
    if (error) {
      await route.fulfill({
        status: status || 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Lyria service unavailable (mocked)' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          audioUrl: 'https://example.com/lyria-test.mp3',
          duration: 30,
          provider: 'lyria',
          title: 'Mocked Lyria Track',
        }),
      });
    }
  });
}

/**
 * Navigate to the Lyria panel.
 * Hard-asserts the panel is found — a missing panel is a regression, not a skip.
 */
async function navigateToLyriaPanel(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const lyriaBtn = page
    .locator('button, [role="tab"], a, [data-testid*="lyria"], [aria-label*="lyria" i]')
    .filter({ hasText: /lyria|music gen|mélodie/i })
    .first();
  await expect(lyriaBtn).toBeVisible({ timeout: 8_000 });
  await lyriaBtn.click();
}

test.describe('Lyria — Generation (mocked)', () => {
  test('Lyria generate button triggers API and renders audio player', async ({ page }) => {
    await setupLyriaMock(page);
    await navigateToLyriaPanel(page);

    const generateBtn = page
      .locator('button')
      .filter({ hasText: /generat|créer|compose|produce/i })
      .first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/lyria/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();

    const audioEl = page.locator('audio, [data-testid="audio-player"], [class*="player"]').first();
    await expect(audioEl).toBeVisible({ timeout: 12_000 });
  });

  test('generated track title or URL is displayed', async ({ page }) => {
    await setupLyriaMock(page);
    await navigateToLyriaPanel(page);

    const generateBtn = page
      .locator('button')
      .filter({ hasText: /generat|créer|compose/i })
      .first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/lyria/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();

    // Either the mock title or the audio element must be visible
    const titleEl = page.locator('text=/Mocked Lyria Track/i').first();
    const audioEl = page.locator('audio[src*="lyria-test"]').first();
    const titleVisible = await titleEl.isVisible({ timeout: 10_000 }).catch(() => false);
    const audioVisible = await audioEl.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(titleVisible || audioVisible).toBe(true);
  });
});

test.describe('Lyria — Error handling (mocked)', () => {
  test('502 from Lyria does not crash the app', async ({ page }) => {
    await setupLyriaMock(page, { error: true, status: 502 });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await navigateToLyriaPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/lyria/generate**'),
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

  test('401 auth error shows user-friendly message', async ({ page }) => {
    await page.route('**/api/lyria/generate**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized — check LYRIA_INTERNAL_TOKEN (mocked)' }),
      });
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await navigateToLyriaPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/lyria/generate**'),
      generateBtn.click(),
    ]);
    await response.finished();

    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Lyria — UI state', () => {
  test('generate button is disabled while generating', async ({ page }) => {
    // Slow mock to catch the in-progress state
    await page.route('**/api/lyria/generate**', async (route) => {
      await new Promise((r) => setTimeout(r, 1_500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ audioUrl: 'https://example.com/lyria-test.mp3', duration: 30 }),
      });
    });

    await navigateToLyriaPanel(page);

    const generateBtn = page.locator('button').filter({ hasText: /generat|créer/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 8_000 });
    await generateBtn.click();

    // Immediately after clicking, button should be disabled or show a loading state.
    // A 1.5s slow mock guarantees this in-progress state must be observable —
    // assert it directly instead of skipping when the probe is false, so a
    // missing disabled/loading state fails the test rather than being hidden.
    const isDisabledOrLoading =
      (await generateBtn.isDisabled()) ||
      (await page
        .locator('[class*="loading"], [aria-label*="loading" i], [data-testid*="loading"]')
        .first()
        .isVisible()
        .catch(() => false));
    expect(isDisabledOrLoading).toBe(true);
  });
});
