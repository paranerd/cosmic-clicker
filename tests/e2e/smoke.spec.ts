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

async function gotoGame(page: Page): Promise<void> {
  await page.goto('/');
  const acknowledgement = page.getByRole('button', { name: 'Ziel verstanden' });
  if (await acknowledgement.isVisible()) await acknowledgement.click();
}

test('player can accrete matter and see the stellar data update', async ({ page }) => {
  await gotoGame(page);
  await expect(page.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  await expect(page.getByText('Urwolke', { exact: true }).first()).toBeVisible();
  const star = page.getByRole('button', { name: 'Materie akkretieren' });
  const starBox = await star.boundingBox();
  const chamberBox = await page.locator('.star-chamber').boundingBox();
  await star.click();
  const particleCount = await page.locator('.matter-particle').count();
  expect(particleCount).toBeGreaterThanOrEqual(5);
  expect(particleCount).toBeLessThanOrEqual(7);
  await expect(page.locator('.matter-particle').filter({ hasText: 'He' })).toHaveCount(0);
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

test('each objective requires one acknowledgement and stays acknowledged after reload', async ({ page }) => {
  await page.goto('/');
  const objective = page.getByRole('dialog', { name: 'Protostern verdichten' });
  await expect(objective).toBeVisible();
  await expect(objective).toContainText('Akkretiere Materie');
  await objective.getByRole('button', { name: 'Ziel verstanden' }).click();
  await expect(objective).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Protostern verdichten' })).toHaveCount(0);
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoGame(page);

  await expect(page.getByRole('tab', { name: 'Reaktionen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: /Vermächtnis/ })).toHaveCount(0);
  await expect(page.locator('.action-sidepanel')).toContainText('Kontrollzentrum');
  await expect(page.getByText('Automatische Akkretion', { exact: true })).toHaveCount(0);
  await expect(page.locator('.left-panel .cloud-stats')).toContainText('Urwolke');
  await expect(page.locator('.cloud-mini-gauge [data-ui="cloud-percent"]')).toHaveText('100%');
  await expect(page.locator('[data-cloud-matter="hydrogen"]')).toContainText('100.000');
  await expect(page.locator('[data-cloud-matter="helium"]')).toBeHidden();
  await expect(page.locator('[data-cloud-matter="deuterium"]')).toBeHidden();
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
  await gotoGame(page);
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
  await gotoGame(page);
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
  await gotoGame(page);
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

test('mobile tutorial centers its card, spotlights targets and scrolls them into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoGame(page);
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  const cardBox = await tutorial.boundingBox();
  expect(Math.abs(cardBox!.x + cardBox!.width / 2 - 195)).toBeLessThanOrEqual(1);
  await expect(page.locator('.tutorial-spotlight')).toHaveCSS('box-shadow', /rgba\(2, 5, 9, 0\.82\)/);

  await tutorial.getByRole('button', { name: 'Tour starten' }).click();
  await expect.poll(() => page.getByRole('button', { name: 'Materie akkretieren' }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
  const spotlightBox = await page.locator('.tutorial-spotlight').boundingBox();
  const starBox = await page.getByRole('button', { name: 'Materie akkretieren' }).boundingBox();
  expect(spotlightBox!.x).toBeLessThanOrEqual(starBox!.x);
  expect(spotlightBox!.x + spotlightBox!.width).toBeGreaterThanOrEqual(starBox!.x + starBox!.width);

  await page.getByRole('button', { name: 'Materie akkretieren' }).click();
  await expect.poll(() => page.locator('.left-panel').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);

  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await tutorial.getByRole('button', { name: 'Überspringen' }).click();
  const toast = page.getByRole('status');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS('left', '195px');
  await expect(toast).toHaveCSS('top', '76px');
  await expect(toast).toHaveCSS('transform', /matrix\(1, 0, 0, 1, -[\d.]+, 0\)/);
});

test('audio settings persist volume and mute state', async ({ page }) => {
  await gotoGame(page);
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
  await gotoGame(page);
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
  await gotoGame(page);

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
  await gotoGame(page);

  const chamber = page.locator('.star-chamber');
  await expect(chamber).toHaveClass(/has-auto-accretion/);
  await expect(page.locator('.automation-particles i')).toHaveCount(8);
  await expect(page.locator('.automation-particles')).toBeVisible();
  await expect(page.locator('.automation-particles i').first()).toHaveCSS('animation-iteration-count', 'infinite');
});

test('upgrade and automation cards use compact heading rows', async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator('[data-card="fusion"]')).toContainText('Wasserstoffbrennen');
  await expect(page.getByRole('button', { name: /Zünden/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  const upgradeHeading = page.locator('.upgrade-card').filter({ hasText: 'Gravitative Verdichtung' }).locator('.upgrade-heading');
  await expect(upgradeHeading).toContainText('Gravitative Verdichtung ×1');
  await expect(page.locator('.deuterium-upgrade')).toContainText('Deuteriumbrennen inaktiv');
  await expect(page.getByText('Aktueller Multiplikator', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Upgrade', { exact: true })).toHaveCount(0);
  await expect(upgradeHeading.locator('.upgrade-icon')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Automationen' }).click();
  await expect(page.locator('.upgrade-heading')).toHaveCount(2);
  await expect(page.locator('.upgrade-heading').first()).toContainText('Akkretionsstrom 0 ME/s');
  await expect(page.locator('[data-automation-card="accretion"]')).toContainText('Nächste Stufe: +42 ME/s');
  await expect(page.locator('[data-automation-card="fusion"]')).toContainText('Stabiles Wasserstoffbrennen 0 H/s');
  await expect(page.locator('[data-automation-card="fusion"]')).toContainText('Nächste Stufe: +69 H/s');
  await expect(page.getByText('Automation', { exact: true })).toHaveCount(0);
});

test('header and chronicle utility buttons share the same translucent hover treatment', async ({ page }) => {
  await gotoGame(page);
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
  await gotoGame(page);

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
  await gotoGame(page);
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
  await gotoGame(page);
  await expect(page.getByRole('dialog')).toContainText('Vermächtnis wählen');
  await expect(page.getByRole('button', { name: '+2 ✦' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Nächsten Zyklus beginnen' })).toBeVisible();
});
