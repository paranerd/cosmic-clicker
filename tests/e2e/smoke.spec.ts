import { expect, test } from '@playwright/test';

test('player can accrete matter and see the stellar data update', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  await expect(page.getByText('Urwolke', { exact: true }).first()).toBeVisible();
  const star = page.getByRole('button', { name: 'Materie akkretieren' });
  await star.click();
  await expect(page.locator('.action-feedback.matter')).toBeVisible();
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('+120 ME');
  await expect(page.getByText('120', { exact: true }).first()).toBeVisible();
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'Reaktionen 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upgrades 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen 0' })).toBeVisible();
  await expect(page.locator('[data-ui="temperature-max"]')).toHaveText('1 Mio. K');

  const dimensions = await page.evaluate(() => ({ documentHeight: document.body.scrollHeight, viewportHeight: window.innerHeight }));
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
});

test('restart uses an inline confirmation instead of a browser dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Neustartoptionen öffnen' }).click();
  await expect(page.getByRole('button', { name: 'Runde neu starten' })).toBeVisible();
  const fullReset = page.getByRole('button', { name: 'Spielstand löschen' });
  await expect(fullReset).toBeVisible();
  await fullReset.click();
  await expect(page.getByRole('button', { name: 'Wirklich alles löschen?' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('cycle summary offers legacy perks before the next run', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem('cosmic-clicker-save-v1', JSON.stringify({
      version: 1, run: 1, startedAt: now - 600_000, lastTick: now, elapsed: 600,
      stage: 'stable', cloud: { hydrogen: 40_000, helium: 20_000, deuterium: 40 },
      star: { hydrogen: 20_000, helium: 19_800, deuterium: 20 }, radiatedMass: 140,
      energy: 1_000, temperature: 12_000_000, heatBonus: 0, fusedHydrogen: 15_000,
      manualFusions: 20, automation: { accretion: 2, fusion: 1 }, upgrades: { gravity: 2 },
      stardust: 4, perks: { largerCloud: 0, permanentGravity: 0 }, completed: true,
      summaryOpen: true, soundEnabled: true, seenOpportunities: [], log: [],
    }));
  });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toContainText('Vermächtnis wählen');
  await expect(page.getByRole('button', { name: '+2 ✦' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Nächsten Zyklus beginnen' })).toBeVisible();
});
