import { expect, test } from '@playwright/test';

test('cosmicDebug exists only on the dev server and can finish a round', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const debug = (window as typeof window & { cosmicDebug?: () => string }).cosmicDebug;
    return { type: typeof debug, message: debug?.() };
  });

  expect(result).toEqual({ type: 'function', message: 'Cosmic Debug geöffnet.' });
  const panel = page.getByLabel('Debug- und Balance-Modus');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Runde abschließen' }).click();
  await expect(page.getByRole('dialog', { name: /Ein Stern erwacht/ })).toBeVisible();
});
