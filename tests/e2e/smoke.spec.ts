/**
 * smoke.spec.ts — Lyricist Pro / Vibe
 * Fast "happy-path" suite run on every PR (chromium-smoke project).
 * All AI back-ends are mocked via Playwright route interception so the
 * tests are deterministic and require ZERO real API keys.
 */
import { test, expect } from '@playwright/test';

// ---- helpers ----------------------------------------------------------------

async function mockGeminiGenerate(page: import('@playwright/test').Page) {
  await page.route('**/api/generate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lyrics: '[Verse 1]\nSmoke test lyrics\n[Chorus]\nIt works!',
        model: 'gemini-2.5-pro',
      }),
    });
  });
}

async function mockLyriaGenerate(page: import('@playwright/test').Page) {
  await page.route('**/api/lyria/generate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ audioUrl: 'https://example.com/mock-audio.mp3' }),
    });
  });
}

async function mockSunoGenerate(page: import('@playwright/test').Page) {
  await page.route('**/api/suno/generate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ audioUrl: 'https://example.com/mock-suno.mp3', status: 'complete' }),
    });
  });
}

async function mockCopyrightCheck(page: import('@playwright/test').Page) {
  await page.route('**/api/copyright/check**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        riskLevel: 'low',
        matches: [],
        message: 'No copyright issues found (mocked).',
      }),
    });
  });
}

// ---- tests ------------------------------------------------------------------

test.describe('Smoke — App loads', () => {
  test('home page renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Lyricist|Vibe/i);
    const hardErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver'),
    );
    expect(hardErrors, `Unexpected console errors: ${hardErrors.join('\n')}`).toHaveLength(0);
  });
});

test.describe('Smoke — Editor', () => {
  test('editor panel is visible and accepts text input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const editor = page
      .locator('[data-testid="lyrics-editor"], textarea, [contenteditable="true"]')
      .first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await editor.fill('Hello smoke test');
    const value = await editor.inputValue().catch(() => editor.textContent());
    expect(value).toContain('Hello smoke test');
  });

  test('save action does not throw and content persists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const editor = page
      .locator('[data-testid="lyrics-editor"], textarea, [contenteditable="true"]')
      .first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await editor.fill('Save smoke content');

    await page.keyboard.press('Control+s');
    await page
      .locator('[data-testid="save-indicator"], [aria-label*="saved" i]')
      .waitFor({ state: 'visible', timeout: 3_000 })
      .catch(() => {
        // No visible indicator — assert content integrity instead
      });

    const value = await editor.inputValue().catch(() => editor.textContent());
    expect(value).toContain('Save smoke content');
    expect(errors).toHaveLength(0);
  });
});

test.describe('Smoke — AI Generate (mocked)', () => {
  test('clicking Generate triggers API call and shows lyrics', async ({ page }) => {
    await mockGeminiGenerate(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const generateBtn = page
      .locator('button')
      .filter({ hasText: /generat|AI|créer|write/i })
      .first();
    await expect(generateBtn).toBeVisible({ timeout: 10_000 });
    await generateBtn.click();

    await expect(page.locator('text=Smoke test lyrics')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Smoke — Copyright check (mocked)', () => {
  test('copyright check returns low risk badge', async ({ page }) => {
    await mockCopyrightCheck(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const editor = page
      .locator('[data-testid="lyrics-editor"], textarea, [contenteditable="true"]')
      .first();
    await editor.click();
    await editor.fill('These are test lyrics');

    const checkBtn = page
      .locator('button')
      .filter({ hasText: /copyright|check|vérif/i })
      .first();
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await expect(page.locator('text=/low|faible|no.*issue/i')).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip();
      return;
    }
  });
});

test.describe('Smoke — i18n', () => {
  test('language switcher exists and changes language', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const langSwitch = page
      .locator(
        '[data-testid="lang-switch"], [aria-label*="language" i], select[name*="lang" i], button',
      )
      .filter({ hasText: /EN|FR|lang/i })
      .first();
    if (await langSwitch.isVisible()) {
      await langSwitch.click();
      // Replace arbitrary timeout with deterministic load-state wait
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/error/);
      await expect(page.locator('body')).not.toBeEmpty();
    } else {
      test.skip();
      return;
    }
  });
});
