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
  await panel.getByRole('button', { name: 'Stellare Wolke' }).click();
  await panel.getByRole('button', { name: 'Runde abschließen' }).click();
  const cycleEnd = page.locator('.cycle-end-banner');
  await expect(cycleEnd).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await cycleEnd.getByRole('button', { name: /Zusammenfassung öffnen/ }).click();
  await expect(page.getByRole('dialog', { name: /Ein Weißer Zwerg bleibt zurück/ })).toBeVisible();
});

test('console cheats add and subtract stardust and energy in development', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    type CheatApi = { stardust: (amount: number) => number; energy: (amount: number) => number };
    const cheat = (window as typeof window & { cheat?: CheatApi }).cheat;
    if (!cheat) return null;
    return {
      stardustAdded: cheat.stardust(5),
      stardustReduced: cheat.stardust(-2),
      energyAdded: cheat.energy(100),
      energyReduced: cheat.energy(-100),
      clampedAtZero: cheat.energy(-1),
    };
  });

  expect(result).toEqual({ stardustAdded: 5, stardustReduced: 3, energyAdded: 100, energyReduced: 0, clampedAtZero: 0 });
  await expect(page.locator('[data-ui="stardust"]')).toHaveText('3');
  await expect(page.locator('[data-ui="energy"]')).toHaveText('0');
});
