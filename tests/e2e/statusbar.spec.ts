import { test, expect } from '@playwright/test';

for (const scenario of [
  { width: 1440, language: 'ui:en' },
  { width: 390, language: 'ui:fr' },
  { width: 320, language: 'ui:ar' },
]) {
  test(`status controls stay usable at ${scenario.width}px in ${scenario.language}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 1000 });
    await page.addInitScript(language => {
      localStorage.setItem('lyricist_language', language);
      localStorage.setItem('vibe_ui_scale', 'small');
    }, scenario.language);
    await page.route('**/api/status', route => route.fulfill({ json: { available: false } }));
    await page.goto('/');
    // The existing welcome dialog opens once on every application mount.
    const splash = page.getByRole('dialog').first();
    await splash.waitFor({ state: 'visible' });
    await splash.locator('button[aria-label]').first().click();
    const bar = page.locator('.lcars-status-bar');
    await expect(bar).toBeVisible();
    const workspace = page.locator('.vibe-workspace');
    const zoom = bar.locator('.vibe-status-zoom button[aria-controls]');
    await zoom.hover();
    const zoomOptions = bar.locator('.vibe-status-zoom [data-choices]');
    await expect(zoomOptions).toBeVisible();
    await expect(zoomOptions.locator('button')).toHaveText(['50%', '75%', '100%', '125%', '150%']);
    const barPosition = await bar.boundingBox();
    await zoomOptions.getByRole('button', { name: '50%', exact: true }).click();
    await expect(workspace).toHaveCSS('zoom', '0.5');
    await expect(zoom).toBeFocused();
    await zoom.press('ArrowDown');
    await zoom.press('Escape');
    await expect(zoomOptions).toBeHidden();
    await expect(zoom).toBeFocused();

    for (const percent of [75, 100, 125, 150]) {
      await zoom.click();
      await zoomOptions.getByRole('button', { name: `${percent}%`, exact: true }).click();
      await expect(workspace).toHaveCSS('zoom', String(percent / 100));
    }
    const commands = bar.locator('.vibe-status-controls');
    const media = bar.locator('.vibe-status-media');
    const pause = media.locator('button').nth(0);
    const audio = media.locator('button').nth(1);
    await pause.click();
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'off');
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await audio.click();
    await expect(audio).toHaveAttribute('aria-pressed', 'true');
    const geometry = await commands.evaluate(group => {
      const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button')).filter(button => button.getClientRects().length);
      const last = buttons.at(-1)!;
      const bounds = last.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height, right: bounds.right,
        maxRight: Math.max(...buttons.map(button => button.getBoundingClientRect().right)),
        viewport: window.innerWidth, direction: getComputedStyle(group).direction };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(44);
    expect(geometry.height).toBeGreaterThanOrEqual(44);
    expect(geometry.right).toBe(geometry.maxRight);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.direction).toBe('ltr');
    expect(await bar.boundingBox()).toEqual(barPosition);
    const theme = commands.locator('.vibe-status-choice').last();
    await theme.locator(':scope > button').hover();
    await expect(theme.locator('[data-choices] button')).toHaveCount(2);
    await theme.locator('[data-choice="light"]').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(commands.locator('.vibe-status-choice').nth(1).locator(':scope > button')).toHaveText(/^[A-Z]{2}/);
    expect(await page.evaluate(() => localStorage.getItem('vibe_ui_scale'))).toBe('small');
    expect(await page.locator('html').evaluate(node => getComputedStyle(node).fontSize)).toBe('12px');
    if (scenario.width < 1024) {
      const nav = page.locator('.mobile-bottom-nav');
      await expect(nav).toBeVisible();
      expect((await bar.boundingBox())!.y + (await bar.boundingBox())!.height).toBeLessThanOrEqual((await nav.boundingBox())!.y);
    }
    if (scenario.language === 'ui:en') {
      const fullscreen = bar.getByRole('button', { name: 'Enter full screen', exact: true });
      if (await fullscreen.isVisible()) {
        await fullscreen.click();
        await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute('data-vibe-app'))).toBe(true);
        await page.evaluate(() => document.exitFullscreen());
        await expect(workspace).toHaveCSS('zoom', '1.5');
      }
      await pause.click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(pause).toBeDisabled();
      await expect(pause).toHaveAttribute('aria-pressed', 'true');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expect(pause).toBeEnabled();
      await pause.click();
    }
    await page.screenshot({ path: testInfo.outputPath(`statusbar-${scenario.width}.png`), fullPage: true });
    await page.reload();
    await expect(workspace).toHaveCSS('zoom', '1.5');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'off');
    await expect(audio).toHaveAttribute('aria-pressed', 'true');
  });
}
