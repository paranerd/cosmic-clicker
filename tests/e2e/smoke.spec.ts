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
  const directStart = page.getByRole('button', { name: 'Ohne Tutorial starten' });
  if (await directStart.isVisible()) await directStart.click();
  const acknowledgement = page.getByRole('button', { name: 'Okay' });
  if (await acknowledgement.isVisible()) await acknowledgement.click();
}

async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  const settings = page.getByRole('dialog', { name: 'Einstellungen' });
  await expect(settings).toBeVisible();
  return settings;
}

async function expectTutorialFrameInsideViewport(page: Page): Promise<Locator> {
  await expect(page.locator('[data-tutorial-focus-frame]')).toHaveCount(0);
  const target = page.locator('main .tutorial-focus');
  await expect(target).toHaveCount(1);
  await expect(target).toBeVisible();
  const geometry = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const padding = Number.parseFloat(style.getPropertyValue('--tutorial-frame-padding'));
    const isRound = element.matches('.star-button');
    const frameStyle = getComputedStyle(element, '::after');
    return {
      left: rect.left - padding - 1,
      top: rect.top - padding - 1,
      right: rect.right + padding + 1,
      bottom: rect.bottom + padding + 1,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      borderColor: frameStyle.borderTopColor,
      borderStyle: frameStyle.borderTopStyle,
      borderWidth: frameStyle.borderTopWidth,
      boxShadow: frameStyle.boxShadow,
      targetFilter: style.filter,
      targetOutline: style.outlineStyle,
      isRound,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(5.5);
  expect(geometry.top).toBeGreaterThanOrEqual(5.5);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 5.5);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight - 5.5);
  expect(geometry.borderColor).toBe('rgba(120, 215, 223, 0.72)');
  expect(geometry.borderStyle).toBe('solid');
  expect(geometry.borderWidth).toBe('1px');
  expect(geometry.boxShadow).toContain(geometry.isRound ? '45px' : '32px');
  expect(geometry.targetFilter).toBe('none');
  expect(geometry.targetOutline).toBe('none');
  return target;
}

test('player can accrete matter and see the stellar data update', async ({ page }) => {
  await gotoGame(page);
  expect(await page.evaluate(() => typeof (window as typeof window & { cheat?: unknown }).cheat)).toBe('undefined');
  await expect(page.locator('link[rel="icon"][type="image/x-icon"]')).toHaveAttribute('href', '/cosmic-clicker/favicon.ico');
  await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute('href', '/cosmic-clicker/favicon-32x32.png');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/cosmic-clicker/favicon.svg');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/cosmic-clicker/apple-touch-icon.png');
  await expect(page.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  const cloudInfo = page.locator('[data-ui="cloud-panel"]');
  await expect(cloudInfo).toBeVisible();
  await expect(cloudInfo.locator('.cloud-popover')).not.toBeVisible();
  await cloudInfo.getByRole('button', { name: 'Informationen zur Urwolke anzeigen' }).click();
  await expect(cloudInfo.locator('.cloud-popover')).toBeVisible();
  await expect(cloudInfo.getByText('Kleine Urwolke', { exact: true })).toBeVisible();
  await page.locator('.chamber-resources').click({ position: { x: 5, y: 5 }, force: true });
  await expect(cloudInfo.locator('.cloud-popover')).not.toBeVisible();
  await expect(page.locator('[data-ui="temperature"]')).toHaveText('10 K');
  const chamberResources = page.getByRole('region', { name: 'Ressourcen' });
  await expect(chamberResources).toBeVisible();
  await expect(chamberResources.locator('.chamber-resource')).toHaveCount(3);
  await expect(chamberResources.locator('[data-ui="chamber-temperature"]')).toHaveText('10');
  await expect(chamberResources.locator('[data-ui="chamber-energy"]')).toHaveText('0');
  await expect(chamberResources.locator('[data-ui="chamber-mass"]')).toHaveText('0');
  await expect(chamberResources.locator('[data-ui="chamber-stardust"]')).toHaveCount(0);
  await expect(chamberResources.locator('.chamber-resource small')).toHaveText(['K', 'MeV', 'ME']);
  await expect(chamberResources).toHaveCSS('border-top-width', '0px');
  await expect(chamberResources).toHaveCSS('border-bottom-width', '0px');
  const resourceWidthsBefore = await chamberResources.locator('.chamber-resource').evaluateAll(
    (resources) => resources.map((resource) => resource.getBoundingClientRect().width),
  );
  expect(new Set(resourceWidthsBefore.map((width) => Math.round(width))).size).toBe(1);
  const star = page.getByRole('button', { name: 'Materie einsammeln' });
  const starBox = await star.boundingBox();
  const chamberBox = await page.locator('.star-chamber').boundingBox();
  // Die Klick-Partikel und die aufsteigende Gewinnanzeige entfernen sich nach
  // ihrem animationend selbst aus dem DOM. Damit die folgenden Assertions
  // nicht gegen dieses Aufräumen rennen (bekannter Flake auf langsamen CI-
  // Runnern), werden die Animationen nur für diesen Test stark verlangsamt.
  await page.addStyleTag({ content: '.matter-particle, .accretion-gain { animation-duration: 120s !important; }' });
  await star.click();
  const particleCount = await page.locator('.matter-particle').count();
  expect(particleCount).toBeGreaterThanOrEqual(5);
  expect(particleCount).toBeLessThanOrEqual(7);
  // Seit dem Wolkenwachstum-Rework enthält auch die kleinste Urwolke Helium;
  // die Partikel zeigen daher H oder He. (Die frühere „kein He“-Assertion war
  // nur grün, weil die Partikel beim Prüfen bereits wieder entfernt waren.)
  for (const text of await page.locator('.matter-particle').allTextContents()) {
    expect(['H', 'He']).toContain(text);
  }
  const gain = page.locator('.accretion-gain');
  await expect(gain).toHaveText('+1 ME');
  const gainStyle = await gain.evaluate((element) => ({
    top: Number.parseFloat((element as HTMLElement).style.top),
    textShadow: getComputedStyle(element).textShadow,
  }));
  expect(gainStyle.top).toBeLessThan((starBox!.y + starBox!.height / 2) - chamberBox!.y);
  expect(gainStyle.textShadow).not.toBe('none');
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('+1 ME');
  await expect(chamberResources.locator('[data-ui="chamber-mass"]')).toHaveText('1');
  const resourceWidthsAfter = await chamberResources.locator('.chamber-resource').evaluateAll(
    (resources) => resources.map((resource) => resource.getBoundingClientRect().width),
  );
  expect(resourceWidthsAfter).toEqual(resourceWidthsBefore);
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-matter="hydrogen"] strong')).toContainText('ME');
  await expect(page.locator('[data-matter="hydrogen"] strong')).not.toContainText('%');
});

test('the first objective collects one ME and congratulates the player', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'nebula', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 10_000, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['collect-first-matter'],
  });
  await page.goto('/');

  await expect(page.locator('.mission-strip')).toHaveCount(0);
  await expect(page.locator('[data-ui="chamber-objective-percent"]')).toHaveText('0%');
  await page.getByRole('button', { name: 'Aktuelles Ziel öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Aktuelles Ziel' })).toContainText('Sammle 1 ME Materie ein');
  await page.getByRole('button', { name: 'Ziel schließen' }).click();
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  await page.getByRole('button', { name: 'Aktuelles Ziel öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Aktuelles Ziel' })).toContainText('Erzeuge 1 MeV Energie');
  await page.getByRole('button', { name: 'Ziel schließen' }).click();
  await expect(page.locator('[data-ui="energy"]')).toHaveText('0');
  await expect(page.locator('.energy-metric small')).toHaveText('MeV');
  await expect(page.locator('[data-ui="chamber-objective-percent"]')).toHaveText('1,8%');
  await expect(page.locator('.achievement-banner')).toContainText('Glückwunsch – die erste Materie ist gesammelt!');
});

test('reaching an objective uses a non-blocking achievement banner and warns about stellar wind', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'nebula', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 9_457, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_543, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    temperature: 97_184,
    stats: { energyGenerated: 44 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['form-protostar'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  await expect(page.getByRole('dialog', { name: 'Protostern bilden' })).toHaveCount(0);
  const achievement = page.locator('.achievement-banner');
  await expect(achievement).toBeVisible();
  await expect(achievement).toContainText('Protostern gebildet');
  await expect(achievement).toContainText('Sternwind setzt ein');
  await expect(achievement).toContainText('nicht mehr eingesammelt');
  await expect(achievement).toContainText('Als Nächstes');
  await expect(achievement.locator('.achievement-timeout-bar i')).toHaveCSS('animation-duration', '6s');
  const bannerBox = await achievement.boundingBox();
  expect(Math.abs((bannerBox!.x + bannerBox!.width / 2) - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(4_800);
  await expect(achievement).toBeVisible();
  await expect(achievement).toHaveCount(0);
  // Aktive Warnungen stehen über dem Urwolken-Ring in der linken Ecke der
  // Star Chamber und öffnen weiterhin ihr eigenes Popover.
  const warningCorner = page.locator('[data-ui="warning-corner"]');
  await expect(warningCorner).toBeVisible();
  const warningPopover = page.locator('.warning-popover');
  const cloudPopover = page.locator('.cloud-popover');
  await expect(warningPopover).not.toBeVisible();
  await page.getByRole('button', { name: 'Informationen zur Urwolke anzeigen' }).click();
  await expect(cloudPopover).toBeVisible();
  await page.getByRole('button', { name: 'Aktive Warnungen anzeigen' }).click();
  await expect(warningPopover).toBeVisible();
  await expect(cloudPopover).not.toBeVisible();
  await expect(warningPopover).toContainText('Sternwind aktiv');
  await expect(warningPopover).toContainText('ME/s');
  const warningBox = (await warningCorner.boundingBox())!;
  const chamberBox = (await page.locator('.star-chamber').boundingBox())!;
  const settingsBox = (await page.getByRole('button', { name: 'Einstellungen öffnen' }).boundingBox())!;
  expect(warningBox.x - chamberBox.x).toBe(14);
  expect(warningBox.x + warningBox.width).toBeLessThanOrEqual(settingsBox.x);
  expect(settingsBox.y - warningBox.y).toBe(44);
  await page.locator('.star-button').click({ position: { x: 10, y: 10 }, force: true });
  await expect(warningPopover).not.toBeVisible();
});

test('hydrogen burning remains usable after the main-sequence milestone', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'mainSequence', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 22_000, helium: 8_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 24_000, helium: 12_000, deuterium: 30, carbon: 0, oxygen: 0 },
    temperature: 25_000_000,
    fusedHydrogen: 14_900, stats: { hydrogenFused: 14_900 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['sustain-hydrogen'],
  });
  await page.goto('/');

  // Structural main-sequence hydrogen burn (Punkt 6) keeps this seed's star
  // mass changing every animation frame, so the reaction panel re-renders
  // continuously. Dispatch the click synchronously in-page instead of
  // Playwright's normal scroll-then-click flow, which can race a re-render.
  const hydrogenCard = page.locator('[data-reaction-card="hydrogen"]');
  await expect(hydrogenCard.getByRole('button', { name: /Fusionieren 200 H → 199 He \+ 68 γ/ })).toBeVisible();
  await expect(hydrogenCard.locator('.reaction-equation')).toHaveCount(0);
  await hydrogenCard.getByRole('button', { name: /H → .*He \+ .*γ/ }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(hydrogenCard).toBeVisible();
  await expect(hydrogenCard.getByRole('button', { name: /H → .*He \+ .*γ/ })).toBeEnabled();
  await expect(page.getByText('Hauptreihe verlassen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Phase abgeschlossen', { exact: true })).toHaveCount(0);
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoGame(page);

  await expect(page.getByRole('tab', { name: 'Reaktionen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Perks' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.locator('.action-sidepanel')).toContainText('Kontrollzentrum');
  await expect(page.getByText('Automatische Akkretion', { exact: true })).toHaveCount(0);
  const cloudPanel = page.locator('[data-ui="cloud-panel"]');
  const cloudPopover = cloudPanel.locator('.cloud-popover');
  const coreComposition = page.locator('.core-elements');
  await expect(coreComposition.locator('[data-matter="hydrogen"]')).toContainText('Wasserstoff');
  await expect(coreComposition.locator('[data-matter="hydrogen"]')).toContainText('ME');
  await expect(coreComposition.locator('.mini-track')).toHaveCount(0);
  await expect(coreComposition).toHaveCSS('grid-template-columns', /\d+(?:\.\d+)?px \d+(?:\.\d+)?px/);
  await expect(page.locator('.left-panel .cloud-panel')).toHaveCount(0);
  await expect(cloudPanel.locator('[data-ui="cloud-percent"]')).toHaveText('100%');
  const cloudBox = (await cloudPanel.boundingBox())!;
  const chamberBox = (await page.locator('.star-chamber').boundingBox())!;
  expect(cloudBox.x - chamberBox.x).toBe(14);
  expect(chamberBox.y + chamberBox.height - cloudBox.y - cloudBox.height).toBe(14);
  await cloudPanel.getByRole('button', { name: 'Informationen zur Urwolke anzeigen' }).click();
  await expect(cloudPopover).toBeVisible();
  await expect(cloudPopover).toContainText('Kleine Urwolke');
  await expect(cloudPopover).toContainText('Zusammensetzung');
  await expect(cloudPopover.locator('.cloud-elements')).toHaveCSS('grid-template-columns', /\d+(?:\.\d+)?px \d+(?:\.\d+)?px/);
  // The smallest cloud now shares the same realistic primordial composition
  // as every other cloud size (~75 % H, ~25 % He, a small D trace) instead of
  // a hydrogen-only special case.
  await expect(cloudPopover.locator('[data-cloud-matter="hydrogen"]')).toContainText('7.867');
  await expect(cloudPopover.locator('[data-cloud-matter="helium"]')).toBeVisible();
  await expect(cloudPopover.locator('[data-cloud-matter="helium"]')).toContainText('2.622');
  // Deuterium is intentionally never shown in the composition grid
  // (RESOURCES.deuterium.visibleInComposition is false), independent of the
  // cloud's actual composition.
  await expect(cloudPopover.locator('[data-cloud-matter="deuterium"]')).toHaveCount(0);
  await expect(page.locator('.chronicle-dock')).toBeVisible();
  await expect(page.locator('.star-chamber .orbit')).toHaveCount(0);
  await expect.poll(() => page.locator('.star-chamber').evaluate((element) => [
    getComputedStyle(element, '::before').content,
    getComputedStyle(element, '::after').content,
  ])).toEqual(['none', 'none']);
  await expect(page.getByText('SIMULATION AKTIV', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-ui="temperature-max"]')).toHaveText('100.000 K');
  await expect(page.locator('[data-ui="core-total"]')).toHaveCount(0);
  await expect(page.locator('[data-ui="elapsed"]')).toHaveCount(0);

  await expect(page.locator('.mission-strip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Zielbereich/ })).toHaveCount(0);

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
  await page.getByRole('button', { name: 'Chronik öffnen' }).locator('.dock-log').click();
  const chronicle = page.getByRole('dialog', { name: 'Lebenswege der Sterne' });
  await expect(chronicle).toBeVisible();
  // Punkt 3: Die Timeline zeigt nur den Stand bis jetzt (frisches Spiel =
  // Urwolke) plus genau einen offenen „?“-Knoten — keine Zukunftsprognose.
  await expect(chronicle.locator('.timeline-node')).toHaveCount(2);
  await expect(chronicle.locator('.timeline-node.is-open')).toHaveText(/\?.*Sternentwicklung.*Ausgang offen/s);
  await expect(chronicle.locator('.evolution-branch')).toHaveCount(0);
  await expect(chronicle.locator('.chronicle-stats')).toContainText('Eingesammelte Materie');
  await expect(chronicle.locator('.chronicle-stats .run-stat-grid > div')).toHaveCount(9);
  const closeButton = page.getByRole('button', { name: 'Chronik schließen' });
  const restingBackground = await closeButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  await closeButton.hover();
  await expect.poll(() => closeButton.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);
  await expect(closeButton).toHaveCSS('transform', 'none');
  await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(chronicle).toHaveCount(0);
});

test('chronicle shows runtime timestamps and only entries from the current cycle', async ({ page }) => {
  const archivedEntries = Array.from({ length: 30 }, (_, index) => ({
    id: 100 + index,
    run: 1,
    elapsed: index,
    totalElapsed: index,
    text: `Archivierter Eintrag ${index + 1}.`,
    kind: 'info',
  }));
  const currentEntries = Array.from({ length: 30 }, (_, index) => ({
    id: 200 + index,
    run: 2,
    elapsed: index,
    totalElapsed: 65 + index,
    text: `Aktueller Eintrag ${index + 1}.`,
    kind: 'info',
  }));
  await seedLegacyGame(page, {
    version: 7,
    run: 2,
    elapsed: 42,
    totalElapsed: 107,
    log: [
      { id: 2, run: 2, elapsed: 42, totalElapsed: 107, text: 'Zweiter Zyklus gestartet.', kind: 'info' },
      { id: 1, run: 1, elapsed: 65, totalElapsed: 65, text: 'Erster Zyklus abgeschlossen.', kind: 'discovery' },
      ...currentEntries,
      ...archivedEntries,
    ],
  });
  await gotoGame(page);
  const dockLog = page.locator('[data-ui="dock-log"]');
  await expect(dockLog).toContainText('Zweiter Zyklus gestartet.');
  await expect(dockLog).not.toContainText('Erster Zyklus abgeschlossen.');
  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  const chronicle = page.getByRole('dialog', { name: 'Lebenswege der Sterne' });

  await expect(chronicle.locator('[data-ui="chronicle-elapsed"]')).toHaveText(/^LAUFZEIT \d{2}:\d{2}:\d{2}$/);
  await expect(chronicle).not.toContainText('ALLE ZYKLEN');
  await expect(chronicle.locator('.log-entry time').first()).toHaveText('00:00:42');
  await expect(chronicle.locator('.log-list')).not.toContainText('Zyklus 02');
  await expect(chronicle.locator('.log-list')).not.toContainText('Gesamt');
  await expect(chronicle).toContainText('Zweiter Zyklus gestartet.');
  await expect(chronicle).not.toContainText('Erster Zyklus abgeschlossen.');
  await expect(chronicle).not.toContainText('Archivierter Eintrag');
  const scrolling = await chronicle.locator('.log-list').evaluate((element) => {
    const modal = element.closest<HTMLElement>('.chronicle-modal')!;
    element.scrollTop = element.scrollHeight;
    return {
      overflowY: getComputedStyle(element).overflowY,
      canScroll: element.scrollHeight > element.clientHeight,
      logScrollTop: element.scrollTop,
      modalScrollTop: modal.scrollTop,
    };
  });
  expect(scrolling).toMatchObject({ overflowY: 'auto', canScroll: true, modalScrollTop: 0 });
  expect(scrolling.logScrollTop).toBeGreaterThan(0);
});

test('the chamber progress is the only persistent objective display and opens a modal', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await gotoGame(page);
  const chamberProgress = page.getByRole('button', { name: 'Aktuelles Ziel öffnen' });
  await expect(page.locator('.mission-strip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Zielbereich/ })).toHaveCount(0);
  await expect(page.locator('.phase-dots')).toHaveCount(0);
  await expect(chamberProgress.locator('[data-ui="chamber-objective-percent"]')).toHaveText(/%$/);
  expect(await chamberProgress.locator('.chamber-progress-track i').evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )).toContain('gradient');
  await chamberProgress.tap();
  const objective = page.getByRole('dialog', { name: 'Aktuelles Ziel' });
  await expect(objective).toBeVisible();
  await expect(chamberProgress).toHaveCSS('color', 'rgb(120, 215, 223)');
  await expect(chamberProgress.locator('.chamber-progress-track i')).toHaveCSS(
    'background-image',
    'linear-gradient(90deg, rgb(46, 183, 195), rgb(120, 215, 223))',
  );
  await expect(objective).toHaveCSS('border-color', 'rgba(120, 215, 223, 0.3)');
  await expect(objective).toHaveCSS('background-color', 'rgb(10, 16, 26)');
  await expect(objective.locator('.chronicle-modal-heading small')).toHaveCSS('color', 'rgb(120, 215, 223)');
  await expect(objective).toContainText('Erstes Ziel');
  await expect(objective).toContainText('Sammle 1 ME Materie ein');
  await expect(objective).toContainText('Ziehe die erste Materie aus der Urwolke');
  await page.getByRole('button', { name: 'Ziel schließen' }).click();
  await expect(objective).toHaveCount(0);
  await chamberProgress.tap();
  await page.keyboard.press('Escape');
  await expect(objective).toHaveCount(0);
  await chamberProgress.tap();
  await page.locator('[data-overlay-dismiss="objective"]').click({ position: { x: 5, y: 5 } });
  await expect(objective).toHaveCount(0);
  await context.close();
});

test('header is removed and settings occupies the round lower-right chamber control', async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('.mission-strip')).toHaveCount(0);

  const settingsButton = page.getByRole('button', { name: 'Einstellungen öffnen' });
  const chamberBox = (await page.locator('.star-chamber').boundingBox())!;
  const settingsBox = await settingsButton.boundingBox();
  expect(settingsBox).not.toBeNull();
  expect(chamberBox.x + chamberBox.width - (settingsBox!.x + settingsBox!.width)).toBe(14);
  expect(chamberBox.y + chamberBox.height - (settingsBox!.y + settingsBox!.height)).toBe(14);
  await expect(settingsButton).toHaveCSS('border-radius', '50%');

  await settingsButton.click();
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible();
});

test('the core temperature offers an unobtrusive knowledge entry that survives the game loop', async ({ page }) => {
  await gotoGame(page);
  const reading = page.locator('.primary-reading').first();
  const knowledgeButton = reading.locator('.knowledge-button');
  const modal = page.locator('.knowledge-modal');

  // Der Button sitzt in der Beschriftungszeile, trägt keinen sichtbaren Text
  // und keinen Rahmen — sonst wäre er nicht mehr „unauffällig".
  await expect(reading).toContainText('Kerntemperatur');
  await expect(knowledgeButton).toBeVisible();
  await expect(knowledgeButton).toHaveText('');
  await expect(knowledgeButton).toHaveCSS('border-top-width', '0px');
  const buttonBox = await knowledgeButton.boundingBox();
  expect(buttonBox?.width).toBeLessThan(20);
  await expect(modal).toHaveCount(0);

  await knowledgeButton.click();
  await expect(modal).toBeVisible();
  await expect(modal.locator('#knowledge-title')).toHaveText('Kerntemperatur');
  await expect(modal).toContainText('15 Millionen K');
  await expect(modal.locator('.knowledge-ingame')).toContainText('Im Spiel');

  // updateUI() läuft alle 100 ms und ruft syncOverlay() mit auf. Ohne die
  // Signaturprüfung im Overlay würde das Modal dabei permanent neu gebaut —
  // der Knoten muss deshalb derselbe bleiben und darf nicht flackern.
  const heading = await modal.locator('#knowledge-title').elementHandle();
  await page.waitForTimeout(500);
  await expect(modal).toBeVisible();
  expect(await heading?.evaluate((element) => element.isConnected)).toBe(true);

  // Drei Schließwege: Escape, Klick auf den Hintergrund, ×-Button.
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await knowledgeButton.click();
  await expect(modal).toBeVisible();
  await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(modal).toHaveCount(0);
  await knowledgeButton.click();
  await page.getByRole('button', { name: 'Erklärung schließen' }).click();
  await expect(modal).toHaveCount(0);
});

test('every core metric carries its own knowledge entry', async ({ page }) => {
  await gotoGame(page);
  const modal = page.locator('.knowledge-modal');
  // Reihenfolge und Beschriftung der vier Kacheln im linken Datenpanel.
  const metrics: [string, string][] = [
    ['starMass', 'Sternmasse'],
    ['corePressure', 'Kerndruck'],
    ['energy', 'Energie'],
    ['accretion', 'Akkretion'],
  ];

  await expect(page.locator('.metric-grid .knowledge-button')).toHaveCount(metrics.length);
  for (const [id, title] of metrics) {
    // Der Button gehört zu genau der Kachel, deren Begriff er erklärt.
    const metric = page.locator('.metric').filter({ hasText: title });
    await expect(metric.locator(`[data-knowledge="${id}"]`)).toHaveCount(1);

    await page.locator(`[data-knowledge="${id}"]`).click();
    await expect(modal.locator('#knowledge-title')).toHaveText(title);
    // Jeder Eintrag hat Erklärabsätze und einen abgesetzten Spielbezug.
    expect(await modal.locator('.knowledge-body > p').count()).toBeGreaterThan(0);
    await expect(modal.locator('.knowledge-ingame')).toContainText('Im Spiel');
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  }
});

test('new players can complete and resume the interactive tutorial', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' });
  await expect(intro).toContainText('COSMICCLICKER');
  await expect(intro).toContainText('kleinen Wolke aus kaltem Wasserstoff');
  await expect(intro).toHaveCSS('animation-name', 'introModalIn');
  await expect(page.locator('[data-ui="elapsed"]')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Protostern bilden' })).toHaveCount(0);
  await intro.getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Willkommen bei Cosmic Clicker!');
  await expect(tutorial).toContainText('winzig kleinen Materieteilchen');
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein Stern im Blick');
  await expect(page.locator('[data-tutorial="realtime-data"]')).toHaveClass(/tutorial-focus/);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Alles beginnt in der Urwolke');
  await expect(page.locator('[data-tutorial="matter-reservoir"]')).toHaveClass(/tutorial-focus/);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Der kosmische Baustoff');
  const cloudComposition = page.locator('[data-tutorial="cloud-composition"]');
  await expect(cloudComposition).toHaveClass(/tutorial-focus/);
  await expect(page.locator('.cloud-popover')).toBeVisible();
  await expectTutorialFrameInsideViewport(page);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein erster Akkretionsimpuls');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();
  await expect(tutorial).toContainText('Materie für den Sternenkern');
  const objectiveTarget = page.locator('[data-tutorial="objective-progress"]');
  const objectiveLayoutBeforeHighlight = await objectiveTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const chamberRect = element.closest('.star-chamber')!.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      left: rect.left - chamberRect.left,
      bottom: chamberRect.bottom - rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein nächstes Ziel');
  await expect(tutorial).toContainText('Fortschrittsbalken unter deinem Stern');
  await expect(objectiveTarget).toHaveClass(/tutorial-focus/);
  await expectTutorialFrameInsideViewport(page);
  const objectiveLayoutDuringHighlight = await objectiveTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const chamberRect = element.closest('.star-chamber')!.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      left: rect.left - chamberRect.left,
      bottom: chamberRect.bottom - rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(objectiveLayoutBeforeHighlight.position).toBe('absolute');
  expect(objectiveLayoutDuringHighlight.position).toBe('absolute');
  expect(objectiveLayoutDuringHighlight.left).toBeCloseTo(objectiveLayoutBeforeHighlight.left, 1);
  expect(objectiveLayoutDuringHighlight.bottom).toBeCloseTo(objectiveLayoutBeforeHighlight.bottom, 1);
  expect(objectiveLayoutDuringHighlight.width).toBeCloseTo(objectiveLayoutBeforeHighlight.width, 1);
  expect(objectiveLayoutDuringHighlight.height).toBeCloseTo(objectiveLayoutBeforeHighlight.height, 1);
  const tutorialLayering = await page.evaluate(() => ({
    progress: Number(getComputedStyle(document.querySelector<HTMLElement>('.chamber-objective-progress')!).zIndex),
    callout: Number(getComputedStyle(document.querySelector<HTMLElement>('.click-callout')!).zIndex),
  }));
  expect(tutorialLayering.progress).toBeLessThan(tutorialLayering.callout);
  await expect(tutorial).toContainText('Klicke auf den markierten Fortschrittsbalken');
  await objectiveTarget.click();
  await expect(tutorial).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Aktuelles Ziel' })).toContainText('Erzeuge 1 MeV Energie');
  await page.getByRole('button', { name: 'Ziel schließen' }).click();
  await expect(page.getByRole('dialog', { name: 'Protostern bilden' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Reaktionen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Ein neuer Kosmos beginnt.', { exact: true })).toBeVisible();
  let settings = await openSettings(page);
  await settings.getByRole('switch', { name: 'Tutorial ausschalten' }).click();
  settings = await openSettings(page);
  await settings.getByRole('switch', { name: 'Tutorial einschalten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toHaveCount(0);
  settings = await openSettings(page);
  await expect(settings.getByRole('switch', { name: 'Tutorial ausschalten' })).toBeVisible();
  await expect(settings).toContainText('passend zu deinem Fortschritt fortgesetzt');
});

test('reactivating the tutorial skips actions the player has already completed', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    cloud: { hydrogen: 9_999, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 1, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    stats: { matterAccreted: 1, energyGenerated: .018 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0, stepId: 'welcome' },
  });
  await page.goto('/');

  const settings = await openSettings(page);
  await settings.getByRole('switch', { name: 'Tutorial einschalten' }).click();

  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Materie für den Sternenkern');
  await expect(tutorial).not.toContainText('Dein erster Akkretionsimpuls');
  await expect(page.getByText('Tutorial eingeschaltet und passend zu deinem Fortschritt fortgesetzt.', { exact: true })).toBeVisible();
});

test('tutorial resumes when the first upgrade and automation can be purchased', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    elapsed: 120,
    stage: 'protostar',
    cloud: { hydrogen: 7_456, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_544, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    // 3 E für die Verdichtung plus 25 E für die direkt danach getestete
    // Akkretionsstrom-Freischaltung.
    energy: 28,
    temperature: 100_000,
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 8 },
  });
  await page.goto('/');

  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toHaveAttribute('aria-selected', 'true');
  await expect(tutorial).toContainText('Dein erstes Upgrade');
  const gravityCard = page.locator('[data-upgrade-card="gravity"]');
  await expect(gravityCard).toHaveClass(/tutorial-focus/);
  await expect(page.locator('.action-sidepanel')).toHaveCSS('overflow', 'hidden');
  await expectTutorialFrameInsideViewport(page);
  await gravityCard.locator('[data-action="buy-gravity"]').click();

  await expect(page.getByRole('tab', { name: 'Automationen' })).toHaveAttribute('aria-selected', 'true');
  await expect(tutorial).toContainText('Automatische Akkretion');
  const accretionCard = page.locator('[data-automation-card="accretion"]');
  await expect(accretionCard).toHaveClass(/tutorial-focus/);
  await expectTutorialFrameInsideViewport(page);
  await accretionCard.locator('[data-action="buy-accretion"]').click();
  await expect(tutorial).toContainText('Der Akkretionsstrom arbeitet');
  await expect(tutorial).toContainText('automatisch im Kern verdichtet');
  await expect(page.locator('[data-tutorial="left-panel"]')).toHaveClass(/tutorial-focus/);
  await expectTutorialFrameInsideViewport(page);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toHaveCount(0);
});

test('the first automation tutorial step also restores directly from its stable step id', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    stage: 'protostar',
    cloud: { hydrogen: 7_456, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_544, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    energy: 65,
    temperature: 100_000,
    upgrades: { gravity: 1, deuteriumBurning: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 10, stepId: 'first-automation' },
  });
  await page.goto('/');

  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Automatische Akkretion');
  await expect(page.getByRole('tab', { name: 'Automationen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-automation-card="accretion"]')).toHaveClass(/tutorial-focus/);
});

test('ending the tutorial requires confirmation and can be cancelled', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' }).getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });

  await tutorial.getByRole('button', { name: 'Tutorial beenden', exact: true }).click();
  await expect(tutorial).toContainText('Möchtest du das Tutorial wirklich beenden?');
  await tutorial.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(tutorial).toContainText('Willkommen bei Cosmic Clicker!');

  await tutorial.getByRole('button', { name: 'Tutorial beenden', exact: true }).click();
  await tutorial.locator('[data-action="confirm-end-tutorial"]').click();
  await expect(tutorial).toHaveCount(0);
  await expect(page.getByText('Tutorial beendet. In den Einstellungen kannst du es wieder einschalten.', { exact: true })).toBeVisible();
});

test('tutorial blocks the dimmed page while keeping its highlighted action clickable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' }).getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  const star = page.getByRole('button', { name: 'Materie einsammeln' });
  const starBox = await star.boundingBox();

  await page.mouse.click(starBox!.x + starBox!.width / 2, starBox!.y + starBox!.height / 2);
  await expect(page.locator('[data-ui="mass"]')).toHaveText('0');
  await expect(page.locator('#app')).toHaveClass(/tutorial-active/);
  await expect(page.locator('.tutorial-blocker')).toHaveCSS('pointer-events', 'none');

  for (let step = 0; step < 4; step += 1) await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein erster Akkretionsimpuls');
  await expect(star).toHaveClass(/tutorial-focus/);
  await expect(page.locator('.tutorial-highlight-shield')).toHaveCount(0);
  const starFrame = await expectTutorialFrameInsideViewport(page);
  const starFocus = await starFrame.evaluate((element) => {
    const focusRing = getComputedStyle(element, '::after');
    return {
      borderRadius: focusRing.borderRadius,
      borderColor: focusRing.borderTopColor,
      boxShadow: focusRing.boxShadow,
    };
  });
  const roundDimmer = page.locator('[data-tutorial-round-dimmer]');
  await expect(roundDimmer).toHaveCount(1);
  await expect(roundDimmer).toHaveCSS('background-color', 'rgba(2, 5, 9, 0.82)');
  expect(await roundDimmer.evaluate((element) => getComputedStyle(element).maskImage)).toContain('radial-gradient');
  expect(starFocus.borderRadius).toBe('50%');
  expect(starFocus.borderColor).toBe('rgba(120, 215, 223, 0.72)');
  expect(starFocus.boxShadow).toContain('rgba(120, 215, 223, 0.25)');
  await star.click();
  await expect(page.locator('[data-ui="mass"]')).not.toHaveText('0');
});

test('the first-matter achievement remains visible while the tutorial is active', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    cloud: { hydrogen: 10_000, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 4, stepId: 'first-accretion' },
    seenObjectives: ['collect-first-matter'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  const achievement = page.locator('.achievement-banner');
  await expect(achievement).toBeVisible();
  await expect(achievement).toContainText('Glückwunsch – die erste Materie ist gesammelt!');
  await expect(achievement.locator('.achievement-next')).toContainText('Erzeuge 1 MeV Energie');
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toContainText('Materie für den Sternenkern');
  await page.getByRole('button', { name: 'Zielhinweis schließen' }).click();
  await expect(achievement).toHaveCount(0);
});

test('the protostar achievement and its next objective remain visible during the tutorial', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    cloud: { hydrogen: 7_457, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_543, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    temperature: 94_000,
    stats: { energyGenerated: 44 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 4, stepId: 'first-accretion' },
    seenObjectives: ['collect-first-matter', 'generate-first-energy', 'generate-upgrade-energy', 'form-protostar'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  const achievement = page.locator('.achievement-banner');
  await expect(achievement).toBeVisible();
  await expect(achievement).toContainText('Protostern gebildet');
  await expect(achievement).toContainText('Sternwind setzt ein');
  await expect(achievement.locator('.achievement-next')).toContainText('Erreiche 1.000.000 K');
});

test('mobile tutorial centers its card, spotlights targets and scrolls them into view', async ({ page }) => {
  // Bewusst niedrig: Die Kerndaten sind rund 525px hoch, erst darunter wird
  // die Blende — in der das erste Tutorial-Ziel liegt — wirklich scrollbar.
  // Genau dieses Scrollen prüft der Test weiter unten.
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' }).getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  const cardBox = await tutorial.boundingBox();
  expect(Math.abs(cardBox!.x + cardBox!.width / 2 - 195)).toBeLessThanOrEqual(1);
  // Der Schritt zeigt auf die Kerndaten; mobil öffnet das Tutorial dafür die Blende.
  await expect(page.locator('.left-panel')).toBeVisible();
  await expect(page.locator('.tutorial-blocker').first()).toHaveCSS('background-color', 'rgba(2, 5, 9, 0.82)');
  await expect(page.locator('.tutorial-highlight-shield')).toHaveCount(0);
  await expect(page.locator('.tutorial-inner-frame')).toHaveCount(0);
  await expect(page.locator('.tutorial-spotlight')).toHaveCount(0);
  const firstTarget = page.locator('[data-tutorial="realtime-data"]');
  await expect.poll(() => firstTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);
  await expectTutorialFrameInsideViewport(page);

  // Der sichtbare Rahmen ist direkt am Ziel verankert. Dadurch bewegt er
  // sich auch beim compositor-gesteuerten mobilen Scrollen zusammen mit dem
  // Element; nur die unsichtbaren Ausschnittsgrenzen werden per JS angepasst.
  // Mobil scrollt nicht mehr die Seite, sondern die Kerndaten-Blende — der
  // Fensterlistener fängt das über die Capture-Phase weiterhin ab.
  // Das Einblenden des Ziels hat die Blende schon bewegt; gescrollt wird
  // deshalb in die Richtung, in der noch Weg ist.
  const sheetRange = await page.locator('.left-panel').evaluate((element) => ({
    scrollTop: element.scrollTop,
    scrollable: element.scrollHeight - element.clientHeight,
  }));
  expect(sheetRange.scrollable).toBeGreaterThanOrEqual(40);

  const trackedBoxes = await page.evaluate((range) => {
    return new Promise<{ targetTop: number; frameTop: number; blockerBottom: number }>((resolve) => {
      const sheet = document.querySelector<HTMLElement>('.left-panel')!;
      window.addEventListener('scroll', () => {
        const target = document.querySelector<HTMLElement>('.tutorial-focus')!;
        const targetRect = target.getBoundingClientRect();
        const padding = Number.parseFloat(getComputedStyle(target).getPropertyValue('--tutorial-frame-padding'));
        const blocker = document.querySelector<HTMLElement>('[data-tutorial-blocker="top"]')!.getBoundingClientRect();
        resolve({
          targetTop: targetRect.top,
          frameTop: targetRect.top - padding - 1,
          blockerBottom: blocker.bottom,
        });
      }, { once: true, capture: true });
      sheet.scrollBy(0, range.scrollTop > range.scrollable - 40 ? -40 : 40);
    });
  }, sheetRange);
  expect(Math.abs(trackedBoxes.blockerBottom - trackedBoxes.frameTop)).toBeLessThanOrEqual(1);
  // Am Viewportrand darf der elementgebundene Rahmen innerhalb des Ziels
  // liegen. Entscheidend für scrollsynchrones Verhalten ist, dass die
  // Abdunklungsgrenze ihm bereits im Scroll-Event exakt folgt.
  expect(trackedBoxes.frameTop).toBeGreaterThanOrEqual(5.5);

  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  const cloudTarget = page.locator('[data-tutorial="matter-reservoir"]');
  await expect(cloudTarget).toHaveClass(/tutorial-focus/);
  await expect(cloudTarget).toBeVisible();
  await expect.poll(() => cloudTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);
  await expectTutorialFrameInsideViewport(page);

  await tutorial.getByRole('button', { name: 'Tutorial beenden', exact: true }).click();
  await tutorial.locator('[data-action="confirm-end-tutorial"]').click();
  const toast = page.getByText('Tutorial beendet. In den Einstellungen kannst du es wieder einschalten.', { exact: true });
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  expect(Math.abs(toastBox!.x + toastBox!.width / 2 - 195)).toBeLessThanOrEqual(1);
  await expect(page.locator('.toast-stack')).toHaveCSS('left', '195px');
  await expect(page.locator('.toast-stack')).toHaveCSS('top', '76px');
  await expect(toast).toHaveCSS('transform', /matrix\(1, 0, 0, 1, -[\d.]+, 0\)/);
});

test('rapid onboarding toasts stack, shift and disappear independently', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' }).getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await tutorial.getByRole('button', { name: 'Tutorial beenden', exact: true }).click();
  await tutorial.locator('[data-action="confirm-end-tutorial"]').click();

  const skipped = page.getByText('Tutorial beendet. In den Einstellungen kannst du es wieder einschalten.', { exact: true });
  const cosmos = page.getByText('Ein neuer Kosmos beginnt.', { exact: true });
  await expect(page.getByRole('status')).toHaveCount(2);
  await expect(skipped).toBeVisible();
  await expect(cosmos).toBeVisible();
  await expect.poll(async () => {
    const skippedBox = await skipped.boundingBox(); const cosmosBox = await cosmos.boundingBox();
    return skippedBox!.y < cosmosBox!.y;
  }).toBe(true);
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 5_000 });
});

test('audio settings persist volume and mute state', async ({ page }) => {
  await gotoGame(page);
  let settings = await openSettings(page);
  const slider = settings.getByRole('slider', { name: 'Effektlautstärke' });
  await expect(slider).toHaveValue('35');
  await slider.fill('60');
  await expect(settings.getByText('60%', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: 'Ton stummschalten' }).click();
  await expect(settings.getByRole('button', { name: 'Ton einschalten' })).toBeVisible();
  await page.reload();
  settings = await openSettings(page);
  await expect(settings.getByRole('slider', { name: 'Effektlautstärke' })).toHaveValue('60');
  await expect(settings.getByRole('button', { name: 'Ton einschalten' })).toBeVisible();
});

test('settings export and import saves and tutorial state', async ({ page }) => {
  await gotoGame(page);
  let settings = await openSettings(page);
  await expect(settings.getByRole('heading', { name: 'Effektlautstärke' })).toBeVisible();
  await expect(settings.getByRole('heading', { name: 'Sichern und übertragen' })).toBeVisible();
  await expect(settings.getByRole('heading', { name: 'Fortschritt zurücksetzen' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await settings.getByRole('button', { name: /Exportieren/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('cosmic-clicker-zyklus-1.json');
  const exportedSave = await download.path();
  expect(exportedSave).not.toBeNull();

  await settings.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();
  await expect(page.locator('[data-ui="hydrogen-value"]')).toHaveText('1 ME');
  settings = await openSettings(page);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await settings.getByRole('button', { name: /Importieren/ }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(exportedSave!);
  await expect(page.getByText('Spielstand erfolgreich importiert.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-ui="hydrogen-value"]')).toHaveText('0 ME');

  settings = await openSettings(page);
  await settings.getByRole('switch', { name: 'Tutorial einschalten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toBeVisible();
  settings = await openSettings(page);
  await settings.getByRole('switch', { name: 'Tutorial ausschalten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toHaveCount(0);
});

test('popup headers stay visible while only their body scrolls', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await gotoGame(page);

  const settings = await openSettings(page);
  const heading = settings.locator('.chronicle-modal-heading');
  const closeButton = settings.getByRole('button', { name: 'Einstellungen schließen' });
  const body = settings.locator('.settings-body');
  const headingBefore = await heading.boundingBox();
  const closeBefore = await closeButton.boundingBox();
  const scrolling = await body.evaluate((element) => {
    const modal = element.closest<HTMLElement>('.settings-modal')!;
    element.scrollTop = element.scrollHeight;
    return {
      bodyOverflowY: getComputedStyle(element).overflowY,
      bodyCanScroll: element.scrollHeight > element.clientHeight,
      bodyScrollTop: element.scrollTop,
      modalOverflowY: getComputedStyle(modal).overflowY,
      modalScrollTop: modal.scrollTop,
    };
  });

  expect(scrolling).toMatchObject({
    bodyOverflowY: 'auto',
    bodyCanScroll: true,
    modalOverflowY: 'hidden',
    modalScrollTop: 0,
  });
  expect(scrolling.bodyScrollTop).toBeGreaterThan(0);
  expect(await heading.boundingBox()).toEqual(headingBefore);
  expect(await closeButton.boundingBox()).toEqual(closeBefore);

  await context.close();
});

test('round statistics are integrated into the chronicle and production exposes no debug function', async ({ page }) => {
  await gotoGame(page);
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();
  await expect(page.getByRole('button', { name: 'Statistik öffnen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  const stats = page.getByRole('dialog', { name: 'Lebenswege der Sterne' }).locator('.chronicle-stats');
  await expect(stats).toContainText('Eingesammelte Materie');
  await expect(stats).toContainText('1 ME');
  const closeButton = page.getByRole('button', { name: 'Chronik schließen' });
  const originalCloseButton = await closeButton.elementHandle();
  await closeButton.hover();
  await page.waitForTimeout(1_200);
  expect(await originalCloseButton?.evaluate((element) => element.isConnected)).toBe(true);
  expect(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).cosmicDebug)).toBe('undefined');
});

test('perks tab shows every permanent perk in the upgrade card style', async ({ page }) => {
  await seedLegacyGame(page, {
    stardust: 4,
    perks: { largerCloud: 2, permanentGravity: 1, fusionMemory: 3 },
  });
  await gotoGame(page);

  await page.getByRole('tab', { name: 'Perks' }).click();
  await expect(page.getByRole('tab', { name: 'Perks' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status', { name: 'Verfügbarer Sternenstaub' })).toContainText('4');
  await expect(page.getByRole('status', { name: 'Verfügbarer Sternenstaub' })).toContainText('✦');

  const cards = page.locator('[data-perk-card]');
  await expect(cards).toHaveCount(3);
  await expect(cards).toHaveClass([/upgrade-card/, /upgrade-card/, /upgrade-card/]);
  await expect(cards.locator('.tile-action-button')).toHaveCount(3);
  for (const button of await cards.locator('.tile-action-button').all()) await expect(button).toBeDisabled();

  const cloudPerk = page.locator('[data-perk-card="largerCloud"]');
  await expect(cloudPerk).toContainText('Wolkenmasse');
  await expect(cloudPerk).toContainText('Stufe 2 von 24');
  await expect(cloudPerk.locator('.tile-rate')).toContainText('×4');
  await expect(cloudPerk.locator('.tile-rate')).toContainText('×8');
  const cloudUpgrade = cloudPerk.getByRole('button', { name: /Wolkenmasse für 8 Sternenstaub/ });
  await expect(cloudUpgrade).toContainText('8 ✦');
  expect(parseFloat(await cloudUpgrade.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill')))).toBeCloseTo(50, 5);
  expect(await cloudUpgrade.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('gradient');

  await expect(page.locator('[data-perk-card="permanentGravity"]')).toContainText('Gravitatives Gedächtnis');
  await expect(page.locator('[data-perk-card="fusionMemory"]')).toContainText('Fusionsgedächtnis');
  await expect(cards.first().getByText('Neue Stufen können am Zyklusende gekauft werden.')).toBeVisible();
});

test('upgrade, automation and perk tabs show their current purchase resource once', async ({ page }) => {
  await seedLegacyGame(page, {
    energy: 123,
    stardust: 4,
    perks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
  });
  await gotoGame(page);
  const sideContent = page.locator('[data-ui="deck-content"]');

  await page.getByRole('tab', { name: 'Upgrades' }).click();
  await expect(sideContent.getByRole('status', { name: 'Verfügbare Energie' })).toHaveCount(1);
  await expect(sideContent.getByRole('status', { name: 'Verfügbare Energie' })).toContainText('123');
  await expect(sideContent.getByRole('status', { name: 'Verfügbare Energie' })).toContainText('MeV');

  await page.getByRole('tab', { name: 'Automationen' }).click();
  await expect(sideContent.getByRole('status', { name: 'Verfügbare Energie' })).toHaveCount(1);
  await expect(sideContent.getByRole('status', { name: 'Verfügbare Energie' })).toContainText('123');

  await page.getByRole('tab', { name: 'Perks' }).click();
  await expect(sideContent.getByRole('status', { name: 'Verfügbarer Sternenstaub' })).toHaveCount(1);
  await expect(sideContent.getByRole('status', { name: 'Verfügbarer Sternenstaub' })).toContainText('4');
  await expect(sideContent.getByRole('status', { name: 'Verfügbarer Sternenstaub' })).toContainText('✦');
});

test('tabs count unseen opportunities, flash on unlock and clear when opened', async ({ page }) => {
  await seedLegacyGame(page, {
    stage: 'hydrogen', cloud: { hydrogen: 38_900, helium: 19_000, deuterium: 50 },
    star: { hydrogen: 30_000, helium: 6_000, deuterium: 50 },
    energy: 1_000, temperature: 11_400_000, manualFusions: 25,
    stats: { hydrogenFused: 5_000 },
  });
  await gotoGame(page);

  const upgradeTab = page.getByRole('tab', { name: 'Upgrades 1' });
  const automationTab = page.getByRole('tab', { name: 'Automationen 1' });
  await expect(upgradeTab).toBeVisible();
  await expect(automationTab).toBeVisible();

  const restingBackground = await upgradeTab.evaluate((element) => getComputedStyle(element).backgroundColor);
  await upgradeTab.hover();
  await expect.poll(() => upgradeTab.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);

  await page.getByRole('button', { name: /Fusionieren 200 H → 199 He \+ 68 γ/ }).click();
  const unlockedAutomationTab = page.getByRole('tab', { name: 'Automationen 2' });
  await expect(unlockedAutomationTab).toHaveClass(/unlock-flash/);
  await expect(unlockedAutomationTab.locator('.tab-count')).toHaveText('2');

  await unlockedAutomationTab.click();
  await expect(page.getByRole('tab', { name: 'Automationen' })).toHaveAttribute('aria-selected', 'true');
  // Denselben Zähler tragen der Tab und der Dock-Knopf; beide müssen leeren.
  await expect(page.locator('[data-tab-count="automation"]')).toHaveCount(2);
  for (const counter of await page.locator('[data-tab-count="automation"]').all()) {
    await expect(counter).toBeHidden();
  }
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

test('upgrade and automation cards use compact heading rows with the rate moved below the title', async ({ page }) => {
  await gotoGame(page);
  const lockedHydrogenCard = page.locator('[data-reaction-card="hydrogen"]');
  await expect(lockedHydrogenCard).toContainText('Wasserstofffusion');
  await expect(lockedHydrogenCard.locator('[data-button-detail]')).toHaveText('');
  await expect(lockedHydrogenCard.locator('[data-button-detail]')).toBeHidden();
  await expect(lockedHydrogenCard.locator('.reaction-symbol.element.he')).toHaveText('He');
  await expect(page.getByRole('button', { name: /Zünden/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  const gravityCard = page.locator('.upgrade-card').filter({ hasText: 'Gravitative Verdichtung' });
  const upgradeHeading = gravityCard.locator('.upgrade-heading');
  await expect(upgradeHeading).toContainText('Gravitative Verdichtung');
  await expect(upgradeHeading).not.toContainText('×1');
  await expect(gravityCard.locator('.tile-rate')).toContainText('×1');
  await expect(page.locator('.deuterium-upgrade')).toHaveCount(0);
  await expect(page.getByText('Aktueller Multiplikator', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Upgrade', { exact: true })).toHaveCount(0);
  await expect(upgradeHeading.locator('.upgrade-icon')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Automationen' }).click();
  await expect(page.locator('.upgrade-heading')).toHaveCount(1);
  await expect(page.locator('.upgrade-heading').first()).toContainText('Akkretionsstrom');
  await expect(page.locator('.upgrade-heading').first()).not.toContainText('ME/s');
  const accretionCard = page.locator('[data-automation-card="accretion"]');
  // Punkt 4 (Folgesession): "Aktuell" zeigt bei gesperrten Automationen "-"
  // statt einer irreführenden 0-ME/s-Angabe.
  await expect(accretionCard.locator('.tile-rate div').first().locator('b')).toHaveText('-');
  // Punkt 4: "Nächste Stufe" zeigt den Gesamtwert nach der nächsten
  // Ausbaustufe (hier identisch mit dem alten Inkrement, weil die aktuelle
  // Rate bei Stufe 0 noch 0 ist), nicht mehr nur die Differenz.
  await expect(accretionCard).toContainText('Nächste Stufe: 1 ME/s');
  await expect(page.getByRole('button', { name: /Protostern erforderlich/ })).toBeDisabled();
  await expect(page.locator('[data-automation-card="fusion"]')).toHaveCount(0);
  await expect(page.getByText('Automation', { exact: true })).toHaveCount(0);
});

test('upgrade and automation corner buttons keep the lock icon until the first level is bought, independent of the fill', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'protostar', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 50_000, helium: 18_000, deuterium: 80, carbon: 0, oxygen: 0 },
    star: { hydrogen: 5_000, helium: 900, deuterium: 20, carbon: 0, oxygen: 0 },
    energy: 150, temperature: 350_000,
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['heat-protostar'],
  });
  await page.goto('/');

  // Punkt 1: Die Gravitations-Verdichtung ist hier längst freigeschaltet und
  // mit 150 Energie auch bezahlbar (Preis 3) — trotzdem zeigt der Button vor
  // dem ersten Ausbau noch das Schloss, kein Doppel-Caret. Der Fill ist dabei
  // (wieder, wie bei Reaktionen) am 100 %-Deckel, weil Energie den Preis
  // längst übersteigt — Icon-Wechsel und Fill sind zwei unabhängige Signale.
  await page.getByRole('tab', { name: /Upgrades/ }).click();
  const upgradeButton = page.locator('.upgrade-card').filter({ hasText: 'Gravitative Verdichtung' }).locator('.tile-action-button');
  await expect(upgradeButton).toHaveClass(/is-buildable/);
  await expect(upgradeButton.locator('.tile-action-icon svg rect')).toHaveCount(1);
  expect(await upgradeButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'))).toBe('100%');
  await upgradeButton.click();
  await expect(upgradeButton.locator('.tile-action-icon svg rect')).toHaveCount(0);
  expect(await upgradeButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'))).toBe('100%');

  // Dieselbe Logik gilt für Automationen: Der Akkretionsstrom ist bei dieser
  // Sternmasse (5.920 ME > 2.544 ME Protostern-Schwelle) unlocked und mit
  // Preis 25 bezahlbar (147 Energie verbleiben nach dem Gravitations-Ausbau),
  // zeigt aber vor der ersten Stufe ebenfalls das Schloss.
  await page.getByRole('tab', { name: /Automationen/ }).click();
  const automationButton = page.locator('[data-automation-card="accretion"] .tile-action-button');
  await expect(automationButton).toHaveClass(/is-buildable/);
  await expect(automationButton.locator('.tile-action-icon svg rect')).toHaveCount(1);
  expect(await automationButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'))).toBe('100%');
  await automationButton.click();
  await expect(automationButton.locator('.tile-action-icon svg rect')).toHaveCount(0);
});

test('locked and not-yet-affordable upgrades/automations show a fractional progress fill, exactly like reactions', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'protostar', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 50_000, helium: 18_000, deuterium: 80, carbon: 0, oxygen: 0 },
    // 1.272 ME = genau die Hälfte der Protostern-Schwelle (2.544 ME), die
    // sowohl Deuteriumbrennens Mindestmasse als auch den Akkretionsstrom-
    // Meisterschaftsschwellenwert bildet.
    star: { hydrogen: 1_272, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    // Die seedbare Temperatur wird im Protostern-Stadium sofort auf den
    // Stadien-Sockelwert (100.000 K) neu berechnet, unabhängig vom Seed-Wert
    // hier — das ist genau ein Zehntel der für Deuteriumbrennen nötigen
    // 1 Mio. K und damit die tatsächlich bindende (kleinste) Voraussetzung.
    energy: 2.5, temperature: 500_000,
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  // Punkt 3: Deuteriumbrennen ist gesperrt (Sternmasse bei der Hälfte der
  // nötigen 2.544 ME, Temperatur bei einem Zehntel der nötigen 1 Mio. K —
  // Letzteres ist die kleinere und damit bindende Voraussetzung) und zeigt
  // daher exakt 10 % Fill Richtung Freischaltung statt 0 %.
  await page.getByRole('tab', { name: /Upgrades/ }).click();
  const deuteriumButton = page.locator('.deuterium-upgrade .tile-action-button');
  expect(await deuteriumButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'))).toBe('10%');
  await expect(deuteriumButton.locator('.tile-action-icon svg rect')).toHaveCount(1);
  // Der Fill-Wert allein reicht nicht: eine generische ".upgrade-card
  // button:disabled"-Regel hat einmal den Fill-Verlauf dieses (deaktivierten,
  // weil gesperrten) Buttons mit background:transparent überschrieben, obwohl
  // --tile-fill korrekt gesetzt war. Deshalb hier zusätzlich den tatsächlich
  // gerenderten Hintergrund prüfen statt nur die CSS-Variable.
  expect(await deuteriumButton.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('gradient');

  // Die Gravitations-Verdichtung ist freigeschaltet (keine Voraussetzungen).
  // Mit 2,5 von 3 nötigen Energie (Erste-Stufe-Kosten seit der Progressions-
  // Überarbeitung) ist sie noch nicht bezahlbar — der Fill zeigt hier den
  // Energie/Preis-Fortschritt (≈83,3 %).
  const gravityButton = page.locator('.upgrade-card').filter({ hasText: 'Gravitative Verdichtung' }).locator('.tile-action-button');
  await expect(gravityButton).not.toHaveClass(/is-buildable/);
  const gravityFill = await gravityButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'));
  expect(parseFloat(gravityFill)).toBeCloseTo(2.5 / 3 * 100, 5);
  expect(await gravityButton.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('gradient');
  // Ein normaler UI-Tick darf die unmittelbar nach dem Tabwechsel gerenderte
  // Kachel nicht nochmals ersetzen. Ein abgelöster Knoten liefert bei
  // getComputedStyle() leere Werte und machte diese Prüfung zuvor flakey.
  expect(await gravityButton.evaluate(async (element) => {
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    return element.isConnected;
  })).toBe(true);

  // Punkt 3/4: Der Akkretionsstrom ist bei dieser Sternmasse ebenfalls erst
  // zur Hälfte freigeschaltet — 50 % Fill, Schloss-Icon, und "Aktuell" zeigt
  // "-" statt einer irreführenden 0-ME/s-Angabe.
  await page.getByRole('tab', { name: /Automationen/ }).click();
  const accretionCard = page.locator('[data-automation-card="accretion"]');
  const accretionButton = accretionCard.locator('.tile-action-button');
  expect(await accretionButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'))).toBe('50%');
  await expect(accretionButton.locator('.tile-action-icon svg rect')).toHaveCount(1);
  expect(await accretionButton.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('gradient');
  await expect(accretionCard.locator('.tile-rate div').first().locator('b')).toHaveText('-');
});

test('unlocked reaction cards drop the redundant cost line below the pips and give the fusion button the full card width', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 20_000, helium: 8_000, deuterium: 30, carbon: 1_000, oxygen: 0 },
    temperature: 100_000_000, fusedHydrogen: 15_000, fusedHelium: 1_000,
    energy: 1_000, stats: { hydrogenFused: 15_000, heliumFused: 1_000, oxygenCreated: 0 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const hydrogenCard = page.locator('[data-reaction-card="hydrogen"]');
  // Punkt 1: Der Ausbaupreis steht nur noch im Eck-Button, nicht mehr
  // zusätzlich als eigene Zeile unter den Ausbaustufen-Pips.
  await expect(hydrogenCard.locator('[data-reaction-upgrade-levels]')).toBeVisible();
  await expect(hydrogenCard.locator('.tile-cost')).toHaveCount(0);
  await expect(hydrogenCard.locator('[data-action="buy-reaction-upgrade"] [data-tile-price]')).toBeVisible();

  // Punkt 2: Der Fusionsbutton nimmt jetzt die volle Kartenbreite ein (Breite
  // der Karte minus deren eigenes Padding), statt sich auf seinen Inhalt zu
  // schrumpfen.
  const fusionButton = hydrogenCard.locator('[data-action="run-reaction"]');
  const cardBox = await hydrogenCard.boundingBox();
  const buttonBox = await fusionButton.boundingBox();
  const cardInset = await hydrogenCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  });
  expect(Math.abs(buttonBox!.width - (cardBox!.width - cardInset))).toBeLessThanOrEqual(1);
});

test('reaction button processes remaining fuel and disables only when none is available', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'hydrogen', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 1_000, helium: 0, deuterium: 0 },
    star: { hydrogen: 37, helium: 20_000, deuterium: 0 },
    temperature: 10_000_000,
    unlockedReactions: ['hydrogen'],
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const button = page.locator('[data-reaction-card="hydrogen"] [data-action="run-reaction"]');
  await expect(button).toBeEnabled();
  await expect(button.locator('[data-button-detail]')).toContainText('37 H');
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button.locator('[data-button-label]')).toHaveText('Kein Brennstoff verfügbar.');
});

test('gravity upgrade expires when the primordial cloud is exhausted', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'hydrogen', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 0, helium: 0, deuterium: 0 },
    star: { hydrogen: 20_000, helium: 1_000, deuterium: 0 },
    temperature: 10_000_000,
    energy: 1_000,
    unlockedReactions: ['hydrogen'],
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');
  await page.getByRole('tab', { name: /Upgrades/ }).click();

  const gravityCard = page.locator('[data-upgrade-card="gravity"]');
  await expect(gravityCard.locator('.tile-action-button')).toBeDisabled();
  await expect(gravityCard.locator('.tile-cost')).toHaveText('Urwolke erschöpft');
});

test('fusion click feedback rises from the actual click position, not a fixed spot', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 20_000, helium: 8_000, deuterium: 30, carbon: 1_000, oxygen: 0 },
    temperature: 100_000_000, fusedHydrogen: 15_000, fusedHelium: 1_000,
    energy: 1_000, stats: { hydrogenFused: 15_000, heliumFused: 1_000, oxygenCreated: 0 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');
  // Die Feedback-Anzeige entfernt sich nach ihrem animationend selbst aus dem
  // DOM (wie die Akkretions-Partikel) — für diesen Test stark verlangsamt,
  // damit beide Klicks ausgewertet werden können, bevor irgendetwas entfernt
  // wird (siehe der analoge Kommentar beim Akkretions-Test oben).
  await page.addStyleTag({ content: '.action-feedback { animation-duration: 120s !important; }' });

  const hydrogenCard = page.locator('[data-reaction-card="hydrogen"]');
  const fusionButton = hydrogenCard.locator('[data-action="run-reaction"]');
  const buttonBox = await fusionButton.boundingBox();
  const cardBox = await hydrogenCard.boundingBox();

  // Punkt 9: Genau wie beim Materiegewinn am Stern steigt "+X Energie" aus
  // der Region des tatsächlichen Klickpunkts auf (mit demselben Zufalls-
  // Versatz), statt immer von derselben festen Stelle in der Karte — zwei
  // weit auseinanderliegende Klicks auf denselben Button erzeugen deshalb
  // deutlich unterschiedliche Positionen. Jeder Dispatch rendert die
  // Reaktionskarte komplett neu (eigenes Verhalten, nicht Teil dieser
  // Änderung), daher existiert je Klick nur eine Feedback-Anzeige gleich-
  // zeitig — die Position wird direkt nach jedem einzelnen Klick ausgelesen,
  // statt beide am Ende gemeinsam zu erwarten.
  await fusionButton.click({ position: { x: 10, y: 8 } });
  const firstFeedback = hydrogenCard.locator('.action-feedback.fusion');
  await expect(firstFeedback).toBeVisible();
  const firstLeft = await firstFeedback.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));

  await fusionButton.click({ position: { x: buttonBox!.width - 10, y: 8 } });
  const secondFeedback = hydrogenCard.locator('.action-feedback.fusion');
  await expect(secondFeedback).toBeVisible();
  await expect(secondFeedback).toHaveCount(1);
  const secondLeft = await secondFeedback.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));

  // Der Zufalls-Versatz allein deckt maximal ±18px ab (siehe feedback.ts) —
  // ein Unterschied deutlich darüber kann nur vom unterschiedlichen
  // Klickpunkt selbst stammen, nicht vom Zufall.
  expect(secondLeft - firstLeft).toBeGreaterThan(30);

  // Beide Positionen liegen erkennbar im Bereich des Buttons (kartenrelativ),
  // nicht an einer festen, vom Button unabhängigen Stelle wie zuvor
  // (".action-card .action-feedback { right: 22px; top: 28%; }").
  const buttonLeftInCard = buttonBox!.x - cardBox!.x;
  const buttonRightInCard = buttonBox!.x + buttonBox!.width - cardBox!.x;
  expect(firstLeft).toBeGreaterThan(buttonLeftInCard - 30);
  expect(firstLeft).toBeLessThan(buttonRightInCard + 30);
});

test('reaction cards mirror the upgrade/automation card layout with no separating divider', async ({ page }) => {
  await gotoGame(page);
  const hydrogenCard = page.locator('[data-reaction-card="hydrogen"]');
  // Punkt 4: Reaktionskarten teilen sich jetzt denselben .upgrade-heading-
  // Wrapper wie Upgrade-/Automationskarten (gleiche Icon-Größe/-Ausrichtung),
  // haben keine eigene .action-copy-Verpackung mehr und keinen Trennstrich
  // (.reaction-upgrade) zwischen Beschreibung und Ausbaustufen.
  await expect(hydrogenCard.locator('.upgrade-heading')).toHaveCount(1);
  await expect(hydrogenCard.locator('.upgrade-heading .upgrade-icon.reaction-symbol')).toHaveCount(1);
  await expect(hydrogenCard.locator('.action-copy')).toHaveCount(0);
  await expect(hydrogenCard.locator('.reaction-upgrade')).toHaveCount(0);
  await expect(hydrogenCard.locator('.card-kicker')).toBeVisible();
  const kickerBeforeHeading = await hydrogenCard.evaluate((card) => {
    const kicker = card.querySelector('.card-kicker');
    const heading = card.querySelector('.upgrade-heading');
    return !!(kicker && heading && (kicker.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  });
  expect(kickerBeforeHeading).toBe(true);
  const iconSize = await hydrogenCard.locator('.upgrade-icon').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(iconSize).toBe(32);
});

test('available upgrades are ordered before upgrades that are still locked', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'protostar', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 50_000, helium: 18_000, deuterium: 80, carbon: 0, oxygen: 0 },
    star: { hydrogen: 5_000, helium: 900, deuterium: 20, carbon: 0, oxygen: 0 },
    energy: 100, temperature: 350_000,
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['heat-protostar'],
  });
  await page.goto('/');
  await page.getByRole('tab', { name: /Upgrades/ }).click();

  const headings = page.locator('.upgrade-card h3');
  await expect(headings).toHaveCount(2);
  await expect(headings.nth(0)).toContainText('Gravitative Verdichtung');
  await expect(headings.nth(1)).toContainText('Deuteriumbrennen');
});

test('deuterium burning appears at the protostar and is available in the first cycle above one million kelvin', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'deuterium', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 4_000, helium: 0, deuterium: 10, carbon: 0, oxygen: 0 },
    star: { hydrogen: 8_000, helium: 0, deuterium: 10, carbon: 0, oxygen: 0 },
    energy: 100, temperature: 1_200_000,
    upgrades: { gravity: 0, deuteriumBurning: false },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await gotoGame(page);
  await page.getByRole('tab', { name: /Upgrades/ }).click();

  const upgrade = page.locator('.deuterium-upgrade');
  await expect(upgrade).toBeVisible();
  // Auch das auf eine Stufe begrenzte Deuterium-Upgrade nutzt dieselbe
  // Aktuell/Nächste-Stufe-Darstellung wie jedes andere Upgrade.
  await expect(upgrade.locator('.tile-rate')).toContainText('Aktuell');
  await expect(upgrade.locator('.tile-rate')).toContainText('×1');
  await expect(upgrade.locator('.tile-rate')).toContainText('×1,35');
  await expect(upgrade.locator('.level-row i')).toHaveCount(1);
  // Punkt 2/9: Kein Tooltip mehr — der Preis steht direkt im Button, das
  // aria-label liest sich wie ein Satz statt "Label Preis".
  await upgrade.getByRole('button', { name: 'Aktivieren für 75 Energie' }).click();
  await expect(upgrade.locator('.tile-rate')).toContainText('Voll ausgebaut');
  await expect(upgrade.locator('.tile-rate')).toContainText('×1,35');
  await expect(upgrade).toContainText('Erwärmung beschleunigt');
  await expect(upgrade.locator('.tile-action-button')).toHaveClass(/is-complete/);
  await expect(page.locator('[data-matter="deuterium"]')).toHaveCount(0);
  await expect(page.locator('[data-cloud-matter="deuterium"]')).toHaveCount(0);
});

test('stable hydrogen burning is hidden before ignition and then tracks created helium', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'hydrogen', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 38_000, helium: 18_000, deuterium: 50, carbon: 0, oxygen: 0 },
    star: { hydrogen: 30_000, helium: 6_000, deuterium: 50, carbon: 0, oxygen: 0 },
    energy: 1_000, temperature: 11_000_000,
    stats: { hydrogenFused: 0 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await gotoGame(page);
  const reactionPanel = page.locator('.reaction-grid');
  await expect(reactionPanel.getByRole('heading', { name: 'Wasserstofffusion' })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Heliumfusion' })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Alpha-Einfang' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Automationen 1' }).click();

  const fusionAutomation = page.locator('[data-automation-card="fusion"]');
  await expect(fusionAutomation).toBeVisible();
  await expect(fusionAutomation).toContainText('0 / 5.000 He');
  await expect(fusionAutomation).not.toContainText('Reaktionen');
  await expect(page.locator('[data-automation-card="heliumFusion"]')).toHaveCount(0);
});

test('helium burning keeps earlier reactions, previews carbon and reveals matching automations', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 20_000, helium: 8_000, deuterium: 30, carbon: 1_000, oxygen: 0 },
    temperature: 100_000_000, fusedHydrogen: 15_000, fusedHelium: 1_000,
    energy: 1_000, stats: { hydrogenFused: 15_000, heliumFused: 1_000, oxygenCreated: 0 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const reactionPanel = page.locator('.reaction-grid');
  await expect(reactionPanel.getByRole('heading', { name: 'Wasserstofffusion' })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Heliumfusion' })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Alpha-Einfang' })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Kohlenstofffusion' })).toBeVisible();
  await expect(page.locator('[data-reaction-card="carbon"] [data-action="run-reaction"]')).toBeDisabled();

  await page.getByRole('tab', { name: /Automationen/ }).click();
  await expect(page.locator('[data-automation-card="fusion"]')).toBeVisible();
  const heliumAutomation = page.locator('[data-automation-card="heliumFusion"]');
  await expect(heliumAutomation).toBeVisible();
  await expect(heliumAutomation).toContainText('998 / 1.500 C');
  await expect(page.locator('[data-automation-card="oxygenSynthesis"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="carbonFusion"]')).toHaveCount(0);
});

test('terminal upgrades render the corner button as complete, not as a purchase progress bar', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, run: 2, stage: 'deuterium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 40_000, helium: 12_000, deuterium: 40, carbon: 0, oxygen: 0 },
    star: { hydrogen: 16_000, helium: 6_900, deuterium: 60, carbon: 0, oxygen: 0 },
    temperature: 2_000_000, upgrades: { gravity: 0, deuteriumBurning: true },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['ignite-hydrogen'],
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Upgrades' }).click();

  // Punkt 5: Sobald voll ausgebaut, verschwindet der Preis (bzw. hier: das
  // "—") komplett aus dem aria-label statt ihn wie zuvor als Tooltip-Rest
  // mitzuschleppen.
  const button = page.locator('.deuterium-upgrade').getByRole('button', { name: 'Aktiv', exact: true });
  await expect(button).toHaveClass(/is-complete/);
  await expect(button).not.toHaveClass(/is-buildable/);
  await expect(button.locator('i')).toHaveCount(0);
});

test('an affordable next automation level uses an expansion toast', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, run: 2, stage: 'protostar', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 54_000, helium: 17_000, deuterium: 100, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_000, helium: 1_900, deuterium: 0, carbon: 0, oxygen: 0 },
    // Akkretionsstrom steht bereits auf Stufe 1; die nächste Stufe kostet seit
    // der Progressions-Überarbeitung round(25 × 1,85¹) = 46 Energie statt der
    // vorherigen 120. 45 Energie liegt knapp darunter, sodass erst die
    // Klicks (je ≈0,018 Energie) die Schwelle überschreiten und den Toast
    // auslösen — bei bereits ausreichender Startenergie wäre die Gelegenheit
    // schon beim ersten Sync als "gesehen" markiert und der Toast bliebe aus.
    energy: 45, temperature: 200_000, automation: { accretion: 1, fusion: 0 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['heat-protostar'], seenOpportunities: ['accretion:0'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click({ clickCount: 56 });

  await expect(page.getByRole('status')).toContainText('Automation kann ausgebaut werden.');
  await expect(page.getByText('Neue Automation verfügbar.', { exact: true })).toHaveCount(0);
});

test('modal utility buttons share the same translucent hover treatment', async ({ page }) => {
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

  const settingsStyle = await hoverStyle(page.getByRole('button', { name: 'Einstellungen öffnen' }));
  await page.getByRole('button', { name: 'Aktuelles Ziel öffnen' }).click();
  expect(await hoverStyle(page.getByRole('button', { name: 'Ziel schließen' }))).toEqual(settingsStyle);
  await page.getByRole('button', { name: 'Ziel schließen' }).click();

  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  expect(await hoverStyle(page.getByRole('button', { name: 'Chronik schließen' }))).toEqual(settingsStyle);
});

// Mobil gehört der Bildschirm der Sternkammer. Alles andere wird über das
// Dock am unteren Rand aufgerufen und legt sich als Popup darüber.
for (const device of [{ name: 'iPhone 14', width: 390, height: 844 }, { name: 'iPhone SE', width: 375, height: 667 }]) {
  test(`mobile chamber fills the screen above the dock on ${device.name}`, async ({ page }) => {
    await page.setViewportSize({ width: device.width, height: device.height });
    await gotoGame(page);
    await expect(page.getByRole('button', { name: 'Materie einsammeln' })).toHaveCSS('touch-action', 'manipulation');

    const layout = await page.evaluate(() => {
      const rect = (selector: string): { top: number; bottom: number; width: number; height: number } | null => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      return {
        chamber: rect('.star-chamber'),
        star: rect('.star-button'),
        stageLabel: rect('.stage-label'),
        dock: rect('.chamber-dock'),
        objective: rect('.chamber-objective-progress'),
        settings: rect('.chamber-settings'),
        dockButtons: document.querySelectorAll('.dock-button').length,
        sheetVisible: Boolean(document.querySelector('.action-sidepanel')?.checkVisibility()),
        chronicleDockVisible: Boolean(document.querySelector('.chronicle-dock')?.checkVisibility()),
        coreSheetVisible: Boolean(document.querySelector('.left-panel')?.checkVisibility()),
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });

    // Die Kammer nimmt den ganzen Bildschirm ein, und die Seite scrollt nicht.
    expect(layout.chamber!.width).toBe(layout.viewportWidth);
    expect(layout.chamber!.height).toBe(layout.viewportHeight);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

    // Das Dock sitzt als Overlay am unteren Rand der Kammer, mit allen vier Bereichen.
    expect(layout.dockButtons).toBe(4);
    expect(layout.dock!.bottom).toBe(layout.viewportHeight);
    expect(layout.dock!.width).toBe(layout.viewportWidth);

    // Zielbalken und Ecktasten rücken über das Dock, statt darunter zu geraten.
    expect(layout.objective!.bottom).toBeLessThanOrEqual(layout.dock!.top);
    expect(layout.settings!.bottom).toBeLessThanOrEqual(layout.dock!.top);

    // Der Stern bleibt zwischen Stadium-Label und Dock.
    expect(layout.star!.top).toBeGreaterThanOrEqual(layout.stageLabel!.bottom);
    expect(layout.star!.bottom).toBeLessThanOrEqual(layout.dock!.top);

    // Kontrollzentrum, Kerndaten und Chronik erscheinen erst auf Anforderung.
    expect(layout.sheetVisible).toBe(false);
    expect(layout.coreSheetVisible).toBe(false);
    expect(layout.chronicleDockVisible).toBe(false);
  });
}

test('every dock button opens its own popup with its own heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 40_000, helium: 12_000, deuterium: 0 },
    star: { hydrogen: 20_000, helium: 15_000, deuterium: 0 },
    temperature: 120_000_000, energy: 50_000, stardust: 12,
    unlockedReactions: ['hydrogen', 'helium'],
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const sheet = page.locator('.action-sidepanel');
  const heading = page.locator('[data-ui="panel-sheet-title"]');
  const eyebrow = page.locator('[data-ui="panel-sheet-eyebrow"]');
  await expect(sheet).toBeHidden();

  // Jeder Bereich ist ein eigenes Popup mit eigener Überschrift; die
  // gemeinsame Spaltenüberschrift und die Tabs erscheinen mobil nicht.
  const areas = [
    { panel: 'reactions', title: 'Reaktionen', eyebrow: 'Fusionskette' },
    { panel: 'upgrades', title: 'Upgrades', eyebrow: 'Ausbaustufen' },
    { panel: 'automation', title: 'Automationen', eyebrow: 'Dauerbetrieb' },
    { panel: 'perks', title: 'Perks', eyebrow: 'Vermächtnis' },
  ];

  for (const area of areas) {
    await page.locator(`[data-dock-panel="${area.panel}"]`).click();
    await expect(sheet).toBeVisible();
    await expect(heading).toHaveText(area.title);
    await expect(eyebrow).toHaveText(area.eyebrow);
    await expect(sheet.locator('.side-tabs')).toBeHidden();
    await expect(sheet.locator('.sidepanel-heading')).toBeHidden();
    // useInnerText, weil textContent auch die ausgeblendete Spaltenüberschrift läse.
    await expect(sheet).not.toContainText('Sternsysteme', { useInnerText: true });

    // Wie eine eigene Seite: füllt den Bildschirm ganz aus, in der Farbe der
    // übrigen Modale und mit deren Kopfzeile samt Schließen-Kreuz.
    const shape = await page.evaluate(() => {
      const modalElement = document.querySelector('.action-sidepanel')!;
      const modal = modalElement.getBoundingClientRect();
      const heading = document.querySelector('.panel-modal-heading')!.getBoundingClientRect();
      return {
        top: modal.top,
        left: modal.left,
        width: modal.width,
        height: modal.height,
        background: getComputedStyle(modalElement).backgroundColor,
        headingAtTop: Math.abs(heading.top - modal.top) <= 1,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(shape.top).toBe(0);
    expect(shape.left).toBe(0);
    expect(shape.width).toBe(shape.viewportWidth);
    expect(shape.height).toBe(shape.viewportHeight);
    expect(shape.background).toBe('rgb(10, 16, 26)');
    expect(shape.headingAtTop).toBe(true);

    await page.locator('.panel-modal-heading button').click();
    await expect(sheet).toBeHidden();
  }

  // Ein Tipp in die Seite schließt sie nicht — dafür ist das Kreuz da.
  await page.locator('[data-dock-panel="upgrades"]').click();
  await expect(sheet).toBeVisible();
  await page.locator('.panel-modal-heading h2').click();
  await expect(sheet).toBeVisible();
  await page.locator('.panel-modal-heading button').click();
  await expect(sheet).toBeHidden();
});

test('desktop keeps the column heading and tabs, without the mobile popup chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoGame(page);

  // Die Popup-Kopfzeile und das Dock gehören zum mobilen Layout; auf dem
  // Desktop stünden sie als zweite Überschrift in der Spalte.
  await expect(page.locator('.panel-modal-heading')).toBeHidden();
  await expect(page.locator('.chamber-dock')).toBeHidden();
  await expect(page.locator('.chamber-tools')).toBeHidden();
  await expect(page.locator('.sidepanel-heading')).toBeVisible();
  await expect(page.locator('.side-tabs')).toBeVisible();
  await expect(page.locator('.left-panel')).toBeVisible();
  await expect(page.locator('.chronicle-dock')).toBeVisible();

  // Die Karten sitzen direkt unter den Tabs, ohne Lücke aus einer zweiten Kopfzeile.
  const gap = await page.evaluate(() => {
    const tabs = document.querySelector('.side-tabs')!.getBoundingClientRect();
    const content = document.querySelector('.side-content')!.getBoundingClientRect();
    return content.top - tabs.bottom;
  });
  expect(gap).toBeLessThanOrEqual(1);
});

test('mobile dock buttons are round icons with a counter badge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLegacyGame(page, {
    stage: 'hydrogen', cloud: { hydrogen: 38_900, helium: 19_000, deuterium: 50 },
    star: { hydrogen: 30_000, helium: 6_000, deuterium: 50 },
    energy: 1_000, temperature: 11_400_000, manualFusions: 25,
    stats: { hydrogenFused: 5_000 },
  });
  await gotoGame(page);

  // Nur Zeichen, kein Text — der Name steckt im aria-label.
  for (const [panel, label] of [['reactions', 'Reaktionen'], ['upgrades', 'Upgrades'], ['automation', 'Automationen'], ['perks', 'Perks']]) {
    const button = page.locator(`[data-dock-panel="${panel}"]`);
    await expect(button).toHaveAttribute('aria-label', `${label} öffnen`);
    await expect(button.locator('svg')).toHaveCount(1);
    // Außer dem Zähler steht kein Text auf dem Knopf.
    const labelText = await button.evaluate((element) => {
      const withoutBadge = element.cloneNode(true) as HTMLElement;
      withoutBadge.querySelector('.dock-count')?.remove();
      return withoutBadge.textContent?.trim() ?? '';
    });
    expect(labelText).toBe('');
  }

  const shape = await page.locator('[data-dock-panel="upgrades"]').evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, radius: style.borderRadius };
  });
  expect(shape.width).toBe(shape.height);
  expect(shape.radius).toBe('50%');

  // Der Indikator sitzt als Kreis oben rechts auf dem Knopf.
  const badge = page.locator('[data-dock-panel="upgrades"] .dock-count');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('1');
  const placement = await page.locator('[data-dock-panel="upgrades"]').evaluate((element) => {
    const button = element.getBoundingClientRect();
    const dot = element.querySelector('.dock-count')!.getBoundingClientRect();
    return {
      aboveMiddle: dot.top < button.top + button.height / 2,
      rightOfMiddle: dot.left > button.left + button.width / 2,
      round: getComputedStyle(element.querySelector('.dock-count')!).borderRadius,
    };
  });
  expect(placement.aboveMiddle).toBe(true);
  expect(placement.rightOfMiddle).toBe(true);
  expect(placement.round).toBe('999px');
});

test('mobile core data opens as a sheet and the card list scrolls on its own', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Mehrere freigeschaltete Reaktionen: erst dann ist die Kartenliste länger
  // als ihr Platz und der interne Scrollbereich überhaupt beweglich.
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 40_000, helium: 12_000, deuterium: 0 },
    star: { hydrogen: 20_000, helium: 15_000, deuterium: 0 },
    temperature: 120_000_000, energy: 50_000,
    unlockedReactions: ['hydrogen', 'helium', 'alphaCapture'],
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const coreSheet = page.locator('.left-panel');
  await expect(coreSheet).toBeHidden();
  await page.locator('[data-action="toggle-core-data"]').click();
  await expect(coreSheet).toBeVisible();
  await expect(coreSheet.getByText('Stellarer Kern')).toBeVisible();
  await page.locator('[data-action="close-core-data"]').click();
  await expect(coreSheet).toBeHidden();

  await page.locator('[data-action="open-chronicle"]').click();
  await expect(page.getByRole('dialog', { name: 'Lebenswege der Sterne' })).toBeVisible();
  await page.locator('[data-action="close-chronicle"]').click();

  // Gescrollt wird innerhalb der Kartenliste im Popup, nie in der Seite.
  await page.locator('[data-dock-panel="reactions"]').click();
  const scrolled = await page.locator('.side-content').evaluate((element) => {
    element.scrollTop = 200;
    return { scrollTop: element.scrollTop, pageOffset: window.scrollY };
  });
  expect(scrolled.scrollTop).toBeGreaterThan(0);
  expect(scrolled.pageOffset).toBe(0);
});

test('restart uses an inline confirmation instead of a browser dialog', async ({ page }) => {
  await gotoGame(page);
  const settings = await openSettings(page);
  await expect(settings.getByRole('button', { name: /Runde neu starten/ })).toBeVisible();
  const fullReset = settings.getByRole('button', { name: /Spielstand löschen/ });
  await expect(fullReset).toBeVisible();
  await fullReset.click();
  await expect(settings.getByRole('button', { name: /Wirklich alles löschen?/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await settings.getByRole('button', { name: /Wirklich alles löschen?/ }).click();
  await expect(page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' })).toBeVisible();
  await expect(page.getByText('Ein neuer Kosmos beginnt.')).toHaveCount(0);
});

test('cycle completion slides in a compact notice and opens the summary only on demand', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'deuterium', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 1, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 10_442, helium: 0, deuterium: 10, carbon: 0, oxygen: 0 },
    temperature: 6_000_000,
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const settings = await openSettings(page);
  await settings.getByRole('switch', { name: 'Tutorial einschalten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toBeVisible();
  await page.getByRole('button', { name: 'Chronik öffnen' }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole('dialog', { name: 'Lebenswege der Sterne' })).toBeVisible();
  await page.locator('[data-ui="achievement-root"]').evaluate((root) => { root.innerHTML = '<aside class="achievement-banner is-visible">Alter Zielhinweis</aside>'; });

  await page.getByRole('button', { name: 'Materie einsammeln' }).evaluate((button: HTMLButtonElement) => button.click());

  await expect(page.locator('[data-ui="cloud-panel"]')).toBeHidden();

  const cycleEnd = page.locator('.cycle-end-banner');
  await expect(cycleEnd).toBeVisible();
  await expect(cycleEnd).toContainText('ZYKLUS 01 ABGESCHLOSSEN');
  await expect(cycleEnd).toContainText('Eine Massengrenze wird sichtbar.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toHaveCount(0);
  await expect(page.locator('.achievement-banner')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0);

  const openSummary = cycleEnd.getByRole('button', { name: /Zusammenfassung öffnen/ });
  await openSummary.click();
  const summary = page.getByRole('dialog', { name: 'Eine Massengrenze wird sichtbar.' });
  await expect(summary).toBeVisible();
  await expect(cycleEnd).toHaveCount(0);
  await summary.getByRole('button', { name: 'Später entscheiden' }).click();

  const completedStar = page.getByRole('button', { name: 'Abgeschlossener Stern' });
  await completedStar.click({ force: true });
  await expect(summary).toHaveCount(0);
  await expect(page.locator('[data-ui="click-detail"]')).toHaveText('Hier klicken zum Öffnen');
  await page.getByRole('button', { name: 'Zyklus-Zusammenfassung öffnen' }).click();
  await expect(summary).toBeVisible();
});

test('cycle summary offers v0.3 perks and cloud selection before the next run', async ({ page }) => {
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
  const summary = page.getByRole('dialog');
  await expect(summary).toContainText('Vermächtnis wählen');
  await expect(summary).toContainText('Wolkenmasse');
  await expect(summary).toContainText('Fusionsgedächtnis');
  const cloudPerk = summary.locator('.summary-perk-grid article').filter({ hasText: 'Wolkenmasse' });
  const gravityPerk = summary.locator('.summary-perk-grid article').filter({ hasText: 'Gravitatives Gedächtnis' });
  await expect(cloudPerk).toContainText('Stufe 0');
  await expect(cloudPerk).not.toContainText('Kleine Urwolke');
  await expect(gravityPerk).toContainText('+135% Akkretionsrate');
  await expect(gravityPerk).not.toContainText('Nächste Stufe:');
  await expect(page.getByRole('button', { name: 'Neuen Zyklus starten' })).toBeVisible();
});

test('cycle summary can be reopened and confirms skipping affordable perks', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'brownDwarf', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 12_000, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    completed: true, outcome: 'brownDwarf', discoveredOutcomes: ['brownDwarf'], summaryOpen: true,
    stardust: 2, perks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    stats: { stardustEarned: 2 }, seenObjectives: [],
  });
  await page.goto('/');

  const summary = page.getByRole('dialog', { name: 'Eine Massengrenze wird sichtbar.' });
  await expect(summary.locator('.summary-perk-grid article.perk-attention')).toHaveCount(2);
  await expect(summary.locator('.summary-perk-grid article.perk-attention').first()).toHaveCSS('animation-name', 'perkAttention');
  await summary.getByRole('button', { name: 'Später entscheiden' }).click();
  await expect(summary).toHaveCount(0);

  await page.getByRole('button', { name: 'Zyklus-Zusammenfassung öffnen' }).click();
  await expect(summary).toBeVisible();
  await summary.getByRole('button', { name: 'Neuen Zyklus starten' }).click();
  await expect(summary.getByRole('button', { name: 'Ohne Upgrades starten' })).toHaveClass(/is-confirming/);
  const remindedPerk = summary.locator('.summary-perk-grid article').filter({ hasText: 'Wolkenmasse' });
  await expect(remindedPerk).toHaveClass(/perk-attention/);
  expect(await remindedPerk.evaluate((element) => element.getAnimations().some((animation) => animation.playState === 'running'))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmic-clicker-save-v1') ?? '{}').run)).toBe(1);
  await summary.getByRole('button', { name: 'Ohne Upgrades starten' }).click();
  await expect(summary).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmic-clicker-save-v1') ?? '{}').run)).toBe(2);
});

test('multiple perk levels can be staged and deselected before prestige', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'brownDwarf', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 12_000, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    completed: true, outcome: 'brownDwarf', discoveredOutcomes: ['brownDwarf'], summaryOpen: true,
    stardust: 7, perks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    stats: { stardustEarned: 7 }, seenObjectives: [],
  });
  await page.goto('/');

  const summary = page.getByRole('dialog', { name: 'Eine Massengrenze wird sichtbar.' });
  const cloudPerk = summary.locator('.summary-perk-grid article').filter({ hasText: 'Wolkenmasse' });
  await cloudPerk.getByRole('button', { name: '+2 ✦' }).click();
  await cloudPerk.getByRole('button', { name: '+5 ✦' }).click();
  await expect(cloudPerk).toContainText('Stufe 2');
  await expect(cloudPerk).toContainText('+2 gewählt');
  await expect(summary.locator('.cloud-slider input[type="range"]')).toHaveValue('2');
  await expect(summary.locator('.cloud-slider-summary')).toContainText('Stellare Urwolke');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmic-clicker-save-v1') ?? '{}').stardust)).toBe(0);

  await cloudPerk.getByRole('button', { name: 'Wolkenmasse abwählen' }).click();
  await expect(cloudPerk).toContainText('+1 gewählt');
  await expect(summary.locator('.cloud-slider input[type="range"]')).toHaveAttribute('max', '1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmic-clicker-save-v1') ?? '{}').stardust)).toBe(5);

  await summary.getByRole('button', { name: 'Neuen Zyklus starten' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmic-clicker-save-v1') ?? '{}').run)).toBe(2);
  await expect(page.locator('[data-ui="cloud-name"]')).toHaveText('Stellare Urwolke');
});

test('perk changes preserve the summary scroll position on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await seedLegacyGame(page, {
    version: 4, stage: 'brownDwarf', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 12_000, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    completed: true, outcome: 'brownDwarf', discoveredOutcomes: ['brownDwarf'], summaryOpen: true,
    stardust: 7, perks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    stats: { stardustEarned: 7 }, seenObjectives: [],
  });
  await page.goto('/');

  const summary = page.locator('.summary-modal');
  const cloudPerk = summary.locator('.summary-perk-grid article').filter({ hasText: 'Wolkenmasse' });
  await cloudPerk.getByRole('button', { name: '+2 ✦' }).scrollIntoViewIfNeeded();
  const beforeSelection = await summary.evaluate((element) => element.scrollTop);
  expect(beforeSelection).toBeGreaterThan(0);
  await cloudPerk.getByRole('button', { name: '+2 ✦' }).click();
  await expect.poll(() => summary.evaluate((element) => element.scrollTop)).toBeCloseTo(beforeSelection, 0);

  const beforeRemoval = await summary.evaluate((element) => element.scrollTop);
  await cloudPerk.getByRole('button', { name: 'Wolkenmasse abwählen' }).click();
  await expect.poll(() => summary.evaluate((element) => element.scrollTop)).toBeCloseTo(beforeRemoval, 0);
});

test('the first brown dwarf reward unlocks the stellar cloud for cycle two', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'brownDwarf', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 12_000, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    completed: true, outcome: 'brownDwarf', discoveredOutcomes: ['brownDwarf'], summaryOpen: true,
    stardust: 2, perks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    stats: { stardustEarned: 2 }, seenObjectives: [],
  });
  await page.goto('/');

  const summary = page.getByRole('dialog', { name: 'Eine Massengrenze wird sichtbar.' });
  await expect(summary).toContainText('Brauner Zwerg');
  const cloudPerk = summary.locator('.summary-perk-grid article').filter({ hasText: 'Wolkenmasse' });
  await cloudPerk.getByRole('button', { name: '+2 ✦' }).click();
  await expect(summary.locator('.cloud-slider-summary')).toContainText('Stellare Urwolke');
  await expect(summary.locator('.cloud-slider-summary')).toContainText('Weißer Zwerg');
  await summary.getByRole('button', { name: 'Neuen Zyklus starten' }).click();

  await expect(page.locator('[data-ui="cloud-name"]')).toHaveText('Stellare Urwolke');
  const cloudPanel = page.locator('[data-ui="cloud-panel"]');
  const cloudPopover = cloudPanel.locator('.cloud-popover');
  await expect(cloudPopover).not.toBeVisible();
  await cloudPanel.getByRole('button', { name: 'Informationen zur Urwolke anzeigen' }).click();
  await expect(cloudPopover).toBeVisible();
  await expect(cloudPopover.locator('[data-cloud-matter="helium"]')).toBeVisible();
  await expect(cloudPopover.locator('[data-cloud-matter="deuterium"]')).toHaveCount(0);
});

test('the full ordered reaction path keeps available fuel visible and previews carbon burning', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, run: 2, stage: 'carbonOxygen', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 20_000, helium: 2_000, deuterium: 30, carbon: 5_000, oxygen: 0 },
    temperature: 180_000_000, fusedHydrogen: 15_000, fusedHelium: 4_500,
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    stats: { heliumFused: 4_500, oxygenCreated: 0 }, seenObjectives: ['build-oxygen-core'],
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Wasserstofffusion' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Heliumfusion' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alpha-Einfang', level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kohlenstofffusion', level: 3 })).toBeVisible();
  await expect(page.locator('[data-reaction-card="hydrogen"] .reaction-symbol.element.he')).toHaveText('He');
  await expect(page.locator('[data-reaction-card="helium"] .reaction-symbol.element.c')).toHaveText('C');
  await expect(page.locator('[data-reaction-card="alphaCapture"] .reaction-symbol.element.o')).toHaveText('O');
  await expect(page.locator('[data-reaction-card="carbon"] .reaction-symbol.element.ne')).toHaveText('Ne');
  await expect(page.locator('[data-reaction-card="carbon"] [data-action="run-reaction"]')).toBeDisabled();
  // The carbonOxygen stage now carries the Punkt-6 shell wind, which keeps
  // the H/He envelope (and thus the reaction panel) changing every frame.
  // Dispatch the click synchronously in-page rather than racing Playwright's
  // scroll-then-click flow against the next re-render.
  await page.locator('[data-reaction-card="alphaCapture"] [data-action="run-reaction"]').evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('[data-matter="oxygen"]')).toBeVisible();
  await expect(page.locator('[data-ui="oxygen-value"]')).not.toHaveText('0%');

  await page.getByRole('tab', { name: /Automationen/ }).click();
  await expect(page.locator('[data-automation-card="fusion"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="heliumFusion"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="oxygenSynthesis"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="carbonFusion"]')).toHaveCount(0);
});
