import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function seedLegacyGame(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  const now = Date.now();
  await page.addInitScript((seed) => {
    localStorage.setItem('cosmic-clicker-save-v1', JSON.stringify(seed));
  }, {
    version: 1, run: 1, startedAt: now - 60_000, lastTick: now, elapsed: 60,
    stage: 'nebula', cloud: { hydrogen: 74_900, helium: 25_000, deuterium: 100 },
    star: { hydrogen: 0, helium: 0, deuterium: 0 }, radiatedMass: 0,
    energy: 0, temperature: 2_700, heatBonus: 0, fusedHydrogen: 0,
    manualFusions: 0, automation: { accretion: 0, fusion: 0 }, upgrades: { gravity: 0 },
    stardust: 0, perks: { largerCloud: 0, permanentGravity: 0 }, completed: false,
    summaryOpen: false, soundEnabled: true, seenOpportunities: [], log: [],
    ...overrides,
  });
}

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
  const gainStyle = await gain.evaluate((element) => ({
    top: Number.parseFloat((element as HTMLElement).style.top),
    textShadow: getComputedStyle(element).textShadow,
  }));
  expect(gainStyle.top).toBeLessThan((starBox!.y + starBox!.height / 2) - chamberBox!.y);
  expect(gainStyle.textShadow).not.toBe('none');
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('+120 ME');
  await expect(page.getByText('120', { exact: true }).first()).toBeVisible();
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'Reaktionen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: /Vermächtnis/ })).toHaveCount(0);
  await expect(page.locator('.action-sidepanel')).toContainText('Kontrollzentrum');
  await expect(page.getByText('Automatische Akkretion', { exact: true })).toHaveCount(0);
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

test('new players can complete and replay the interactive tutorial', async ({ page }) => {
  await page.goto('/');
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Willkommen im Protostern');
  await tutorial.getByRole('button', { name: 'Tour starten' }).click();
  await expect(tutorial).toContainText('Materie akkretieren');
  await page.getByRole('button', { name: 'Materie akkretieren' }).click();
  await expect(tutorial).toContainText('Den Kern beobachten');
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  await expect(tutorial).toContainText('Entwicklung nachverfolgen');
  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  await expect(tutorial).toHaveCount(0);
  await page.getByRole('button', { name: 'Chronik schließen' }).click();
  await page.getByRole('button', { name: 'Tutorial starten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toContainText('Willkommen im Protostern');
});

test('audio settings persist volume and mute state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Audioeinstellungen öffnen' }).click();
  const slider = page.getByRole('slider', { name: 'Effektlautstärke' });
  await expect(slider).toHaveValue('35');
  await slider.fill('60');
  await expect(page.getByText('60%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ton stummschalten' }).click();
  await expect(page.getByRole('button', { name: 'Ton einschalten' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Audioeinstellungen öffnen' }).click();
  await expect(page.getByRole('slider', { name: 'Effektlautstärke' })).toHaveValue('60');
  await expect(page.getByRole('button', { name: 'Ton einschalten' })).toBeVisible();
});

test('round statistics reflect gameplay and production exposes no debug function', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie akkretieren' }).click();
  await page.getByRole('button', { name: 'Statistik öffnen' }).click();
  const stats = page.getByRole('dialog', { name: /Statistik/ });
  await expect(stats).toContainText('Manuelle Klicks');
  await expect(stats).toContainText('120 ME');
  const closeButton = page.getByRole('button', { name: 'Statistik schließen' });
  const originalCloseButton = await closeButton.elementHandle();
  await closeButton.hover();
  await page.waitForTimeout(1_200);
  expect(await originalCloseButton?.evaluate((element) => element.isConnected)).toBe(true);
  expect(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).cosmicDebug)).toBe('undefined');
});

test('tabs count unseen opportunities, flash on unlock and clear when opened', async ({ page }) => {
  await seedLegacyGame(page, {
    stage: 'hydrogen', cloud: { hydrogen: 38_900, helium: 19_000, deuterium: 50 },
    star: { hydrogen: 30_000, helium: 6_000, deuterium: 50 },
    energy: 1_000, temperature: 11_400_000, manualFusions: 4,
  });
  await page.goto('/');

  const upgradeTab = page.getByRole('tab', { name: 'Upgrades 1' });
  const automationTab = page.getByRole('tab', { name: 'Automationen 1' });
  await expect(upgradeTab).toBeVisible();
  await expect(automationTab).toBeVisible();

  const restingBackground = await upgradeTab.evaluate((element) => getComputedStyle(element).backgroundColor);
  await upgradeTab.hover();
  await expect.poll(() => upgradeTab.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);

  await page.getByRole('button', { name: '200 H fusionieren' }).click();
  const unlockedAutomationTab = page.getByRole('tab', { name: 'Automationen 2' });
  await expect(unlockedAutomationTab).toHaveClass(/unlock-flash/);
  await expect(unlockedAutomationTab.locator('.tab-count')).toHaveText('2');

  await unlockedAutomationTab.click();
  await expect(page.getByRole('tab', { name: 'Automationen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-tab-count="automation"]')).toBeHidden();
});

test('active accretion automation continuously streams particles into the star', async ({ page }) => {
  await seedLegacyGame(page, {
    stage: 'protostar', cloud: { hydrogen: 72_900, helium: 24_000, deuterium: 100 },
    star: { hydrogen: 1_500, helium: 500, deuterium: 0 },
    energy: 100, temperature: 150_000, automation: { accretion: 1, fusion: 0 },
  });
  await page.goto('/');

  const chamber = page.locator('.star-chamber');
  await expect(chamber).toHaveClass(/has-auto-accretion/);
  await expect(page.locator('.automation-particles i')).toHaveCount(8);
  await expect(page.locator('.automation-particles')).toBeVisible();
  await expect(page.locator('.automation-particles i').first()).toHaveCSS('animation-iteration-count', 'infinite');
});

test('upgrade and automation cards use compact heading rows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  const upgradeHeading = page.locator('.upgrade-heading');
  await expect(upgradeHeading).toContainText('Gravitative Verdichtung ×1');
  await expect(page.getByText('Aktueller Multiplikator', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Upgrade', { exact: true })).toHaveCount(0);
  await expect(upgradeHeading.locator('.upgrade-icon')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Automationen' }).click();
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
