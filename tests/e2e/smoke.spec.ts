import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

test('player can accrete matter and see the stellar data update', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  await expect(page.getByText('Urwolke', { exact: true }).first()).toBeVisible();
  const star = page.getByRole('button', { name: 'Materie akkretieren' });
  const starBox = await star.boundingBox();
  const chamberBox = await page.locator('.star-chamber').boundingBox();
  await star.click();
  const particleCount = await page.locator('.matter-particle').count();
  expect(particleCount).toBeGreaterThanOrEqual(5);
  expect(particleCount).toBeLessThanOrEqual(7);
  const gain = page.locator('.accretion-gain');
  await expect(gain).toHaveText('+120 ME');
  const gainTop = await gain.evaluate((element) => Number.parseFloat((element as HTMLElement).style.top));
  expect(gainTop).toBeLessThan((starBox!.y + starBox!.height / 2) - chamberBox!.y);
  await expect(gain).not.toHaveCSS('text-shadow', 'none');
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('+120 ME');
  await expect(page.getByText('120', { exact: true }).first()).toBeVisible();
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'Reaktionen 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upgrades 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen 0' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: /Vermächtnis/ })).toHaveCount(0);
  await expect(page.locator('.action-sidepanel')).toContainText('Kontrollzentrum');
  await expect(page.locator('.left-panel .cloud-stats')).toContainText('Urwolke');
  await expect(page.locator('.cloud-mini-gauge [data-ui="cloud-percent"]')).toHaveText('100%');
  await expect(page.locator('.chronicle-dock')).toBeVisible();
  await expect(page.getByText('SIMULATION AKTIV', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-ui="temperature-max"]')).toHaveText('1 Mio. K');
  await expect(page.locator('[data-ui="elapsed"]')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

  const dimensions = await page.evaluate(() => ({
    documentHeight: document.body.scrollHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

  const widths = await page.evaluate(() => ({
    sidepanel: document.querySelector('.action-sidepanel')?.getBoundingClientRect().width ?? 0,
    log: document.querySelector('.dock-log')?.getBoundingClientRect().width ?? 0,
  }));
  expect(Math.abs(widths.sidepanel - widths.log)).toBeLessThanOrEqual(1);
});

test('chronicle expands from the persistent bottom dock', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  const chronicle = page.getByRole('dialog', { name: 'Entstehung eines Sterns' });
  await expect(chronicle).toBeVisible();
  await expect(chronicle.locator('.timeline-node')).toHaveCount(5);
  const closeButton = page.getByRole('button', { name: 'Chronik schließen' });
  const restingBackground = await closeButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  await closeButton.hover();
  await expect.poll(() => closeButton.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);
  await expect(closeButton).toHaveCSS('transform', 'none');
  await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(chronicle).toHaveCount(0);
});

test('perk popover opens only on click and closes outside', async ({ page }) => {
  await page.goto('/');
  const perkButton = page.getByRole('button', { name: 'Aktive Vermächtnis-Perks anzeigen' });
  const popover = page.locator('.perk-popover');

  await expect(perkButton).not.toContainText('Sternenstaub');
  await perkButton.hover();
  await expect(popover).toBeHidden();
  await perkButton.click();
  await expect(popover).toBeVisible();
  await expect(perkButton).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.mission-strip').click();
  await expect(popover).toBeHidden();
  await expect(perkButton).toHaveAttribute('aria-expanded', 'false');
});

test('upgrade and automation cards use compact heading rows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Upgrades 0' }).click();
  const upgradeHeading = page.locator('.upgrade-heading');
  await expect(upgradeHeading).toContainText('Gravitative Verdichtung ×1');
  await expect(page.getByText('Aktueller Multiplikator', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Upgrade', { exact: true })).toHaveCount(0);
  await expect(upgradeHeading.locator('.upgrade-icon')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Automationen 0' }).click();
  await expect(page.locator('.upgrade-heading')).toHaveCount(2);
  await expect(page.locator('.upgrade-heading').first()).toContainText('Akkretionsstrom 0 ME/s');
  await expect(page.locator('[data-automation-card="accretion"]')).toContainText('Nächste Stufe: +42 ME/s');
  await expect(page.locator('[data-automation-card="fusion"]')).toContainText('Stabiler pp-Zyklus 0 H/s');
  await expect(page.locator('[data-automation-card="fusion"]')).toContainText('Nächste Stufe: +69 H/s');
  await expect(page.getByText('Automation', { exact: true })).toHaveCount(0);
});

test('header and chronicle utility buttons share the same translucent hover treatment', async ({ page }) => {
  await page.goto('/');
  const hoverStyle = async (locator: Locator) => {
    await locator.hover();
    await expect(locator).toHaveCSS('background-color', 'rgba(120, 215, 223, 0.075)');
    await expect(locator).toHaveCSS('border-color', 'rgba(120, 215, 223, 0.5)');
    return locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderColor };
    });
  };

  const downloadStyle = await hoverStyle(page.getByRole('button', { name: 'Spielstand exportieren' }));
  expect(await hoverStyle(page.getByRole('button', { name: 'Neustartoptionen öffnen' }))).toEqual(downloadStyle);
  expect(await hoverStyle(page.getByRole('button', { name: 'Aktive Vermächtnis-Perks anzeigen' }))).toEqual(downloadStyle);

  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  expect(await hoverStyle(page.getByRole('button', { name: 'Chronik schließen' }))).toEqual(downloadStyle);
});

test('mobile cockpit stacks star, actions, stats and chronicle without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const positions = await page.evaluate(() => ({
    star: document.querySelector('.star-chamber')?.getBoundingClientRect().top ?? 0,
    actions: document.querySelector('.action-sidepanel')?.getBoundingClientRect().top ?? 0,
    stats: document.querySelector('.left-panel')?.getBoundingClientRect().top ?? 0,
    chronicle: document.querySelector('.chronicle-dock')?.getBoundingClientRect().top ?? 0,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(positions.star).toBeLessThan(positions.actions);
  expect(positions.actions).toBeLessThan(positions.stats);
  expect(positions.stats).toBeLessThan(positions.chronicle);
  expect(positions.documentWidth).toBeLessThanOrEqual(positions.viewportWidth);
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
