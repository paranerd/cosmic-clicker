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

// Fusionen werden über den Fusionsring in der Star Chamber ausgewählt und
// anschließend am Stern ausgelöst. Der Ring sitzt über dem Stern und wird bei
// manchen Seeds jeden Frame aktualisiert — der Klick wird deshalb synchron im
// Dokument ausgelöst, statt Playwrights Scroll-und-Klick-Ablauf gegen ein
// Re-Render laufen zu lassen.
async function selectFusion(page: Page, reaction: string): Promise<Locator> {
  const button = page.locator(`[data-fusion-ring-button="${reaction}"]`);
  await expect(button).toBeVisible();
  await button.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(button).toHaveClass(/is-active/);
  return button;
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
  await expect(page.locator('.left-panel [data-matter="hydrogen"] strong')).toContainText('ME');
  await expect(page.locator('.left-panel [data-matter="hydrogen"] strong')).not.toContainText('%');
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
  await expect(page.locator('.left-panel .energy-metric small')).toHaveText('MeV');
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
  // Aktive Warnungen stehen jetzt in der Effekte-Ecke rechts unten in der
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
  expect(chamberBox.x + chamberBox.width - (warningBox.x + warningBox.width)).toBe(14);
  expect(warningBox.y).toBeGreaterThan(chamberBox.y);
  // Darunter steht der Perk-Button derselben Sektion, ebenfalls rechtsbündig.
  const perkBox = (await page.locator('.perk-toggle').boundingBox())!;
  expect(chamberBox.x + chamberBox.width - (perkBox.x + perkBox.width)).toBe(14);
  expect(perkBox.y).toBeGreaterThan(warningBox.y);
  // Die Urwolke bleibt in der linken Ecke.
  const cloudBox = (await page.locator('.cloud-toggle').boundingBox())!;
  expect(cloudBox.x - chamberBox.x).toBe(14);
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
  // mass changing every animation frame. Dispatch the clicks synchronously
  // in-page instead of Playwright's normal scroll-then-click flow, which can
  // race a re-render.
  await selectFusion(page, 'hydrogen');
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('200 H → 199 He + 68 γ');
  const star = page.locator('.star-button');
  await star.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('[data-reaction-card="hydrogen"]')).toBeVisible();
  await expect(star).toBeEnabled();
  await expect(star).toHaveAttribute('aria-label', 'Fusion zu Helium auslösen');
  await expect(page.getByText('Hauptreihe verlassen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Phase abgeschlossen', { exact: true })).toHaveCount(0);
});

test('desktop cockpit fits and exposes the separated control tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoGame(page);

  await expect(page.getByRole('tab', { name: 'Upgrades' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Automationen' })).toBeVisible();
  // Perks sind kein Kontrollbereich mehr, sondern stehen im Effekte-Popover
  // unten rechts in der Sternenkammer; Fusionen sind in die Upgrades
  // eingegliedert und haben deshalb ebenfalls keinen eigenen Reiter mehr.
  await expect(page.getByRole('tab', { name: 'Perks' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Fusionen' })).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.action-sidepanel')).toContainText('Kontrollzentrum');
  // Punkt 5/6: Die Fußzeile ist ersatzlos entfallen, das Dock bleibt der
  // mobilen Fassung vorbehalten.
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.locator('.mobile-dock')).toHaveCount(0);
  await expect(page.locator('.left-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stern-Echtzeitdaten anzeigen' })).toBeHidden();
  await expect(page.getByText('Automatische Akkretion', { exact: true })).toHaveCount(0);
  const cloudPanel = page.locator('[data-ui="cloud-panel"]');
  const cloudPopover = cloudPanel.locator('.cloud-popover');
  const coreComposition = page.locator('.left-panel .core-elements');
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
  await expect(page.locator('.chronicle-dock')).toHaveCount(0);
  const sidepanelTools = page.locator('.action-sidepanel .sidepanel-tools');
  await expect(sidepanelTools.getByRole('button')).toHaveCount(2);
  await expect(sidepanelTools.getByRole('button', { name: 'Chronik öffnen' })).toBeVisible();
  await expect(sidepanelTools.getByRole('button', { name: 'Einstellungen öffnen' })).toBeVisible();
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

});

test('small screens open stellar realtime data below the primordial cloud button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoGame(page);

  await expect(page.locator('.left-panel')).toBeHidden();
  const stellarData = page.locator('[data-ui="stellar-data-panel"]');
  const stellarDataButton = stellarData.getByRole('button', { name: 'Stern-Echtzeitdaten anzeigen' });
  const stellarDataPopover = stellarData.locator('.stellar-data-popover');
  const cloudButton = page.getByRole('button', { name: 'Informationen zur Urwolke anzeigen' });
  await expect(stellarDataButton).toBeVisible();
  await expect(stellarDataPopover).toBeHidden();

  const cloudBox = (await cloudButton.boundingBox())!;
  const stellarDataBox = (await stellarDataButton.boundingBox())!;
  expect(stellarDataBox.x).toBeCloseTo(cloudBox.x, 1);
  expect(stellarDataBox.y).toBeGreaterThan(cloudBox.y);
  expect(stellarDataBox.y - cloudBox.y).toBeCloseTo(44, 1);

  await stellarDataButton.click();
  await expect(stellarDataPopover).toBeVisible();
  await expect(stellarDataPopover.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  await expect(stellarDataPopover.locator('[data-ui-mirror="temperature"]')).toHaveText('10 K');
  await expect(stellarDataPopover).toContainText('Kernzusammensetzung');
  const stellarDataPopoverBox = (await stellarDataPopover.boundingBox())!;
  expect(stellarDataPopoverBox.y + stellarDataPopoverBox.height).toBeLessThanOrEqual(cloudBox.y);

  await cloudButton.click();
  await expect(stellarDataPopover).toBeHidden();
  await expect(page.locator('.cloud-popover')).toBeVisible();
});

test('chronicle opens from the control-center button', async ({ page }) => {
  await gotoGame(page);
  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
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
  await expect(page.locator('[data-ui="dock-log"]')).toHaveCount(0);
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

test('header is removed and chronicle and settings sit next to each other in the control center', async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('.mission-strip')).toHaveCount(0);

  const tools = page.locator('.action-sidepanel .sidepanel-tools');
  const chronicleButton = tools.getByRole('button', { name: 'Chronik öffnen' });
  const settingsButton = page.getByRole('button', { name: 'Einstellungen öffnen' });
  await expect(page.locator('.star-chamber .settings-button')).toHaveCount(0);
  await expect(chronicleButton).toBeVisible();
  await expect(settingsButton).toBeVisible();
  const chronicleBox = (await chronicleButton.boundingBox())!;
  const settingsBox = (await settingsButton.boundingBox())!;
  expect(settingsBox.x - (chronicleBox.x + chronicleBox.width)).toBe(5);
  expect(settingsBox.y).toBe(chronicleBox.y);

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

  const realtimePanel = page.locator('.left-panel');
  await expect(realtimePanel.locator('.metric-grid .knowledge-button')).toHaveCount(metrics.length);
  for (const [id, title] of metrics) {
    // Der Button gehört zu genau der Kachel, deren Begriff er erklärt.
    const metric = realtimePanel.locator('.metric').filter({ hasText: title });
    await expect(metric.locator(`[data-knowledge="${id}"]`)).toHaveCount(1);

    await realtimePanel.locator(`[data-knowledge="${id}"]`).click();
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
  await expect(page.locator('[data-tutorial="realtime-data"].tutorial-focus')).toBeVisible();
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
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toHaveAttribute('aria-selected', 'true');
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
  await expect(page.locator('[data-tutorial="left-panel"].tutorial-focus')).toBeVisible();
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

test('mobile tutorial centers its card and spotlights targets inside the fixed viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' }).getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  const cardBox = await tutorial.boundingBox();
  expect(Math.abs(cardBox!.x + cardBox!.width / 2 - 195)).toBeLessThanOrEqual(1);
  await expect(page.locator('.tutorial-blocker').first()).toHaveCSS('background-color', 'rgba(2, 5, 9, 0.82)');
  await expect(page.locator('.tutorial-highlight-shield')).toHaveCount(0);
  await expect(page.locator('.tutorial-inner-frame')).toHaveCount(0);
  await expect(page.locator('.tutorial-spotlight')).toHaveCount(0);
  const firstTarget = page.locator('[data-tutorial="realtime-data"].tutorial-focus');
  await expect.poll(() => firstTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);
  await expectTutorialFrameInsideViewport(page);

  // Punkt 7: Die Seite selbst scrollt nicht mehr — das Ziel muss also ohne
  // Scrollen im Viewport liegen. Die Abdunklungsgrenze folgt dem Rahmen; die
  // Messung wird wiederholt, weil das Popover beim Einblenden noch ein paar
  // Pixel wandert und die Grenzen erst mit dem nächsten UI-Tick nachziehen.
  expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight))).toBe(0);
  await expect.poll(() => page.evaluate(() => {
    const target = document.querySelector<HTMLElement>('.tutorial-focus')!;
    const targetRect = target.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(target).getPropertyValue('--tutorial-frame-padding'));
    const blocker = document.querySelector<HTMLElement>('[data-tutorial-blocker="top"]')!.getBoundingClientRect();
    const frameTop = targetRect.top - padding - 1;
    return Math.abs(blocker.bottom - frameTop) <= 1 && frameTop >= 5.5;
  })).toBe(true);

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
  await expect(page.locator('[data-ui="toast-root"]').getByRole('status')).toHaveCount(2);
  await expect(skipped).toBeVisible();
  await expect(cosmos).toBeVisible();
  await expect.poll(async () => {
    const skippedBox = await skipped.boundingBox(); const cosmosBox = await cosmos.boundingBox();
    return skippedBox!.y < cosmosBox!.y;
  }).toBe(true);
  await expect(page.locator('[data-ui="toast-root"]').getByRole('status')).toHaveCount(0, { timeout: 5_000 });
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

// Punkt 5: Die Angaben der entfallenen Fußzeile stehen jetzt am Ende der
// Einstellungen.
test('settings carry the former footer information', async ({ page }) => {
  await gotoGame(page);
  const settings = await openSettings(page);
  const about = settings.locator('.settings-about');
  await expect(settings.getByRole('heading', { name: 'Cosmic Clicker' })).toBeVisible();
  await expect(about).toContainText('COSMIC CLICKER · PROTOTYP 0.3');
  await expect(about).toContainText('Wissenschaftlich plausibel · spielerisch komprimiert');
});

// Punkt 1: Ab einer Million kürzt das Mittelpanel ab — das linke Datenpanel
// zeigt weiterhin den vollen Wert.
test('the three chamber resources abbreviate values from one million upwards', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 900_000, helium: 400_000, deuterium: 30, carbon: 1_000, oxygen: 0 },
    temperature: 120_000_000, energy: 1_400_000,
    unlockedReactions: ['hydrogen', 'helium', 'alphaCapture'],
    reactionTotals: { hydrogen: 15_000, helium: 1_000, alphaCapture: 0, carbon: 0, neon: 0, oxygen: 0, silicon: 0 },
    stats: { hydrogenFused: 15_000, heliumFused: 1_000, peakTemperature: 120_000_000 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const chamberResources = page.getByRole('region', { name: 'Ressourcen' });
  // Die Temperatur wird beim Laden aus dem Stadium neu berechnet (Heliumbrennen
  // startet bei 100 Mio. K), unabhängig vom Wert im Spielstand.
  await expect(chamberResources.locator('[data-ui="chamber-temperature"]')).toHaveText('100,00 Mio');
  await expect(chamberResources.locator('[data-ui="chamber-energy"]')).toHaveText('1,40 Mio');
  await expect(chamberResources.locator('[data-ui="chamber-mass"]')).toHaveText('1,30 Mio');
  // Die Werte dürfen dabei nicht abgeschnitten werden.
  const overflowing = await chamberResources.locator('.chamber-resource b').evaluateAll(
    (values) => values.filter((value) => value.scrollWidth > value.clientWidth + 1).length,
  );
  expect(overflowing).toBe(0);
  await expect(page.locator('[data-ui="temperature"]')).toHaveText('100 Mio. K');
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

test('the effects corner lists every permanent perk with its current level', async ({ page }) => {
  await seedLegacyGame(page, {
    stardust: 4,
    perks: { largerCloud: 2, permanentGravity: 1, fusionMemory: 0 },
  });
  await gotoGame(page);

  const popover = page.locator('.perk-popover');
  await expect(popover).not.toBeVisible();
  await page.getByRole('button', { name: 'Aktive Perks anzeigen' }).click();
  await expect(popover).toBeVisible();

  const entries = popover.locator('.perk-entry');
  await expect(entries).toHaveCount(3);
  const cloudPerk = popover.locator('[data-perk-entry="largerCloud"]');
  await expect(cloudPerk).toContainText('Wolkenmasse');
  await expect(cloudPerk).toContainText('Stufe 2 von 24');
  await expect(cloudPerk.locator('strong')).toHaveText('×4');
  await expect(popover.locator('[data-perk-entry="permanentGravity"]')).toContainText('Gravitatives Gedächtnis');
  await expect(popover.locator('[data-perk-entry="permanentGravity"]')).toContainText('Stufe 1 von 10');

  // Ein noch nicht gekaufter Perk bleibt sichtbar, tritt aber zurück.
  const fusionPerk = popover.locator('[data-perk-entry="fusionMemory"]');
  await expect(fusionPerk).toHaveClass(/is-inactive/);
  await expect(fusionPerk).toContainText('Stufe 0 von 5');
  await expect(fusionPerk.locator('strong')).toHaveText('×1');

  // Gekauft wird weiterhin ausschließlich in der Zyklus-Zusammenfassung.
  await expect(popover.getByRole('button')).toHaveCount(0);
  await expect(popover).toContainText('am Ende eines Zyklus');

  // Ein Klick daneben schließt das Popover wieder.
  await page.locator('.star-button').click({ position: { x: 10, y: 10 }, force: true });
  await expect(popover).not.toBeVisible();
});

test('upgrade and automation tabs show their current purchase resource once', async ({ page }) => {
  await seedLegacyGame(page, {
    energy: 123,
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
});

test('tabs count unseen opportunities, flash on unlock and clear when opened', async ({ page }) => {
  await seedLegacyGame(page, {
    stage: 'hydrogen', cloud: { hydrogen: 38_900, helium: 19_000, deuterium: 50 },
    star: { hydrogen: 30_000, helium: 6_000, deuterium: 50 },
    energy: 1_000, temperature: 11_400_000, manualFusions: 25,
    stats: { hydrogenFused: 5_000 },
  });
  await gotoGame(page);

  // Der aktive Reiter meldet nie eine offene Gelegenheit — seine Kacheln
  // liegen bereits vor dem Spieler. Gezählt wird deshalb auf dem anderen.
  const upgradeTab = page.getByRole('tab', { name: /^Upgrades/ });
  await expect(upgradeTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-tab-count="upgrades"]')).toBeHidden();
  const automationTab = page.getByRole('tab', { name: 'Automationen 1' });
  await expect(automationTab).toBeVisible();

  const restingBackground = await automationTab.evaluate((element) => getComputedStyle(element).backgroundColor);
  await automationTab.hover();
  await expect.poll(() => automationTab.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);

  await selectFusion(page, 'hydrogen');
  await page.locator('.star-button').click();
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

test('upgrade and automation cards use compact heading rows with the rate moved below the title', async ({ page }) => {
  await gotoGame(page);
  const lockedHydrogenCard = page.locator('[data-reaction-card="hydrogen"]');
  await expect(lockedHydrogenCard).toContainText('Helium');
  await expect(lockedHydrogenCard.locator('.card-kicker')).toHaveText('Proton-Proton-Kette');
  // Die noch gesperrte Reaktion zeigt wie eine gesperrte Automation ein "-"
  // unter "Aktuell" und den Sperrgrund als Kostenzeile — und keinen eigenen
  // Aktionsbutton in der Kachel.
  await expect(lockedHydrogenCard.locator('.tile-rate div').first().locator('b')).toHaveText('-');
  await expect(lockedHydrogenCard.locator('[data-reaction-cost="hydrogen"]')).toHaveText('Ab 10 Mio. K');
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

test('unlocked reaction cards drop the redundant cost line below the pips and hold no fusion button at all', async ({ page }) => {
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

  // Die Fusion selbst wird nicht mehr in der Kachel ausgelöst: Der einzige
  // Button der Kachel ist der Eck-Ausbaubutton, ausgelöst wird über den
  // Fusionsring am Stern.
  await expect(hydrogenCard.locator('button')).toHaveCount(1);
  await expect(hydrogenCard.locator('.primary-action')).toHaveCount(0);
  await expect(hydrogenCard.locator('[data-action="run-reaction"]')).toHaveCount(0);
  // Die Kachel trägt damit dieselbe Zeilenfolge wie eine Automationskachel;
  // der Kicker (Reaktionskette) bleibt die einzige reaktionsspezifische Zeile.
  const cardRows = await hydrogenCard.evaluate((card) => [...card.children]
    .map((child) => child.className.split(' ')[0] || child.tagName.toLowerCase())
    .filter((name) => name !== 'tile-action-button'));
  expect(cardRows).toEqual(['card-kicker', 'upgrade-heading', 'tile-rate', 'p', 'level-row']);
});

test('the star processes remaining fuel and is disabled only when none is available', async ({ page }) => {
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

  const ringButton = await selectFusion(page, 'hydrogen');
  const star = page.locator('.star-button');
  await expect(star).toBeEnabled();
  // Der Hinweis unter dem Stern zeigt die Restmenge, die dieser Klick umsetzt.
  await expect(page.locator('[data-ui="click-yield"]')).toContainText('37 H');
  await star.click();
  // Die Auswahl bleibt bestehen (nur gedämpft), der Stern ist ohne Brennstoff
  // deaktiviert — abwählen bleibt jederzeit möglich.
  await expect(star).toBeDisabled();
  await expect(ringButton).toHaveClass(/is-active/);
  await expect(ringButton).toHaveClass(/is-empty/);
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('KEIN BRENNSTOFF');
  await ringButton.click();
  await expect(ringButton).not.toHaveClass(/is-active/);
  await expect(star).toHaveAttribute('aria-label', 'Materie einsammeln');
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

  await selectFusion(page, 'hydrogen');
  const star = page.locator('.star-button');
  const chamber = page.locator('.star-chamber');
  const starBox = (await star.boundingBox())!;
  const chamberBox = (await chamber.boundingBox())!;

  // Punkt 9: Genau wie beim Materiegewinn steigt "+X Energie" aus der Region
  // des tatsächlichen Klickpunkts auf (mit demselben Zufalls-Versatz), statt
  // von einer festen Stelle — zwei weit auseinanderliegende Klicks auf den
  // Stern erzeugen deshalb deutlich unterschiedliche Positionen. Das Feedback
  // hängt jetzt in der Star Chamber, weil die Fusion dort ausgelöst wird.
  const feedback = chamber.locator('.action-feedback.fusion');
  await star.click({ position: { x: 20, y: starBox.height / 2 } });
  await expect(feedback).toBeVisible();
  const firstLeft = await feedback.first().evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));

  await star.click({ position: { x: starBox.width - 20, y: starBox.height / 2 } });
  await expect(feedback).toHaveCount(2);
  const secondLeft = await feedback.nth(1).evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));

  // Der Zufalls-Versatz allein deckt maximal ±18px ab (siehe feedback.ts) —
  // ein Unterschied deutlich darüber kann nur vom unterschiedlichen
  // Klickpunkt selbst stammen, nicht vom Zufall.
  expect(secondLeft - firstLeft).toBeGreaterThan(30);

  // Beide Positionen liegen erkennbar im Bereich des Sterns (kammerrelativ).
  const starLeftInChamber = starBox.x - chamberBox.x;
  const starRightInChamber = starBox.x + starBox.width - chamberBox.x;
  expect(firstLeft).toBeGreaterThan(starLeftInChamber - 30);
  expect(secondLeft).toBeLessThan(starRightInChamber + 30);
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

test('the fusion ring arranges one round button per unlocked reaction around the star', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 20_000, helium: 8_000, deuterium: 30, carbon: 1_000, oxygen: 0 },
    temperature: 100_000_000, energy: 1_000,
    unlockedReactions: ['hydrogen', 'helium', 'alphaCapture'], activeReaction: 'helium',
    reactionTotals: { hydrogen: 15_000, helium: 1_000, alphaCapture: 0, carbon: 0, neon: 0, oxygen: 0, silicon: 0 },
    stats: { hydrogenFused: 15_000, heliumFused: 1_000, oxygenCreated: 0, peakTemperature: 100_000_000 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const ring = page.getByRole('group', { name: 'Fusionen' });
  const buttons = ring.locator('.fusion-ring-button');
  await expect(buttons).toHaveCount(3);
  // Jeder Button zeigt das Elementsymbol seines Haupterzeugnisses, in
  // Kettenreihenfolge von links nach rechts.
  await expect(buttons).toHaveText(['He', 'C', 'O']);
  // Die gespeicherte Auswahl wird beim Laden wiederhergestellt.
  await expect(page.locator('[data-fusion-ring-button="helium"]')).toHaveClass(/is-active/);
  await expect(page.locator('.star-button')).toHaveAttribute('aria-label', 'Fusion zu Kohlenstoff auslösen');
  const geometry = await page.evaluate(() => {
    const star = document.querySelector('.star-button')!.getBoundingClientRect();
    const center = { x: star.left + star.width / 2, y: star.top + star.height / 2 };
    return [...document.querySelectorAll<HTMLElement>('.fusion-ring-button')].map((button) => {
      const box = button.getBoundingClientRect();
      return {
        round: getComputedStyle(button).borderRadius,
        // offsetWidth statt Rechteckbreite: Der ausgewählte Button ist leicht
        // vergrößert (transform), seine Layoutgröße bleibt aber die des Rings.
        size: button.offsetWidth,
        offsetX: box.left + box.width / 2 - center.x,
        distance: Math.hypot(box.left + box.width / 2 - center.x, box.top + box.height / 2 - center.y),
        starRadius: star.width / 2,
      };
    });
  });
  for (const button of geometry) {
    expect(button.round).toBe('50%');
    expect(button.size).toBeGreaterThanOrEqual(38);
    // Ringförmig um den Stern: gleicher Abstand zur Sternmitte (±12 px durch
    // die etwas flachere Ellipse) und vollständig außerhalb der Sternfläche.
    expect(Math.abs(button.distance - geometry[0].distance)).toBeLessThanOrEqual(12);
    expect(button.distance - button.size / 2).toBeGreaterThan(button.starRadius);
  }
  // Unten um den Stern angeordnet: links, mittig, rechts.
  expect(geometry[0].offsetX).toBeLessThan(-20);
  expect(Math.abs(geometry[1].offsetX)).toBeLessThan(2);
  expect(geometry[2].offsetX).toBeGreaterThan(20);
});

test('the fusion ring routes star clicks to the selected reaction and back to accretion', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7, run: 2, stage: 'helium', cloudTier: 1, nextCloudTier: 1,
    cloud: { hydrogen: 10_000, helium: 4_000, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 20_000, helium: 8_000, deuterium: 30, carbon: 1_000, oxygen: 0 },
    temperature: 100_000_000, energy: 1_000,
    unlockedReactions: ['hydrogen', 'helium', 'alphaCapture'],
    reactionTotals: { hydrogen: 15_000, helium: 1_000, alphaCapture: 0, carbon: 0, neon: 0, oxygen: 0, silicon: 0 },
    stats: { hydrogenFused: 15_000, heliumFused: 1_000, oxygenCreated: 0, peakTemperature: 100_000_000 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  const star = page.locator('.star-button');
  const hydrogenButton = page.locator('[data-fusion-ring-button="hydrogen"]');
  const heliumButton = page.locator('[data-fusion-ring-button="helium"]');
  await expect(star).toHaveAttribute('aria-label', 'Materie einsammeln');
  await expect(hydrogenButton).toHaveAttribute('aria-pressed', 'false');

  // Auswahl: Der Stern führt ab jetzt genau diese Fusion aus.
  await hydrogenButton.click();
  await expect(hydrogenButton).toHaveAttribute('aria-pressed', 'true');
  await expect(hydrogenButton).toHaveAttribute('aria-label', 'Fusion zu Helium abwählen');
  await expect(star).toHaveAttribute('aria-label', 'Fusion zu Helium auslösen');
  await expect(page.locator('[data-ui="click-detail"]')).toHaveText('Klicken, um zu fusionieren');

  const heliumBefore = await page.locator('[data-ui="helium-value"]').textContent();
  await star.click();
  await expect(page.locator('[data-ui="helium-value"]')).not.toHaveText(heliumBefore!);

  // Wechsel: Es ist immer nur eine Fusion ausgewählt.
  await heliumButton.click();
  await expect(heliumButton).toHaveAttribute('aria-pressed', 'true');
  await expect(hydrogenButton).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.fusion-ring-button.is-active')).toHaveCount(1);
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText(/He → .*C \+ .*γ/);

  // Die Auswahl liegt im Spielstand und übersteht damit einen Neustart. Der
  // Seed dieses Tests wird bei jeder Navigation neu gesetzt (addInitScript),
  // geprüft wird deshalb der gespeicherte Zustand statt eines Reloads — das
  // Zurücklesen deckt der Ring-Geometrietest oben ab.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmic-clicker-save-v1') ?? '{}').activeReaction)).toBe('helium');

  // Abwahl: Der Stern akkretiert wieder.
  await heliumButton.click();
  await expect(page.locator('.fusion-ring-button.is-active')).toHaveCount(0);
  await expect(star).toHaveAttribute('aria-label', 'Materie einsammeln');
  await expect(page.locator('[data-ui="click-detail"]')).toHaveText('Klicken, um Materie einzusammeln');
  const massBefore = await page.locator('[data-ui="chamber-mass"]').textContent();
  await star.click();
  await expect(page.locator('[data-ui="chamber-mass"]')).not.toHaveText(massBefore!);
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
  // Fusionskacheln stehen gemeinsam mit den übrigen Upgrades in einem Raster.
  const reactionPanel = page.locator('.upgrade-grid');
  await expect(reactionPanel.getByRole('heading', { name: 'Helium', exact: true })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Kohlenstoff', exact: true })).toBeVisible();
  await expect(reactionPanel.locator('[data-reaction-card="alphaCapture"]')).toHaveCount(0);
  await page.getByRole('tab', { name: /Automationen/ }).click();

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

  const reactionPanel = page.locator('.upgrade-grid');
  // Punkt 2: Die Kachel trägt den Namen des Hauptprodukts, der Kicker nennt
  // den Prozess — bei Alpha-Einfang unterscheidet er die Sauerstoffquelle.
  await expect(reactionPanel.getByRole('heading', { name: 'Helium', exact: true })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Kohlenstoff', exact: true })).toBeVisible();
  await expect(reactionPanel.getByRole('heading', { name: 'Sauerstoff', exact: true })).toBeVisible();
  await expect(reactionPanel.locator('[data-reaction-card="alphaCapture"] .card-kicker')).toHaveText('Alpha-Einfang');
  await expect(reactionPanel.getByRole('heading', { name: 'Neon', exact: true })).toBeVisible();
  // Die noch gesperrte Kohlenstofffusion hat keinen Ringbutton; für die drei
  // gezündeten Reaktionen steht je einer unter dem Stern.
  await expect(page.locator('[data-fusion-ring-button]')).toHaveCount(3);
  await expect(page.locator('[data-fusion-ring-button="carbon"]')).toHaveCount(0);
  await expect(page.locator('[data-fusion-ring-button="alphaCapture"]')).toHaveText('O');

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

  await expect(page.locator('[data-ui="toast-root"]').getByRole('status')).toContainText('Automation kann ausgebaut werden.');
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

// Punkt 6/7: Auf kleinen Bildschirmen gibt es kein Kontrollzentrum mehr. Die
// Sternkammer füllt den Viewport bis zum Dock, die Seite selbst scrollt nicht.
test('mobile fills the viewport with the star chamber and replaces the control center with a dock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoGame(page);
  await expect(page.getByRole('button', { name: 'Materie einsammeln' })).toHaveCSS('touch-action', 'manipulation');

  await expect(page.locator('.action-sidepanel')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.locator('.left-panel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Stern-Echtzeitdaten anzeigen' })).toBeVisible();

  const dock = page.getByRole('navigation', { name: 'Kontrollbereiche' });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button')).toHaveCount(5);
  await expect(dock.getByRole('button')).toHaveText([
    'Upgrades', 'Automationen', 'Sternkammer', 'Chronik', 'Settings',
  ]);
  // Der durch die entfallenen Perks- und Fusionen-Bereiche frei gewordene
  // Platz geht in größere Symbole und Beschriftungen.
  await expect(dock.getByRole('button').first().locator('svg')).toHaveCSS('width', '23px');
  await expect(dock.getByRole('button').first().locator('.dock-label')).toHaveCSS('font-size', '8px');
  // Die Sternkammer steht in der Mitte, ist der Ausgangszustand des Docks und
  // tritt als einziges Feld plastisch hervor: größeres, rundes Symbolfeld, das
  // ein Stück über die Dockkante hinausragt.
  const chamberButton = dock.getByRole('button', { name: 'Sternkammer anzeigen' });
  await expect(chamberButton).toHaveClass(/active/);
  const chamberProminence = await page.evaluate(() => {
    const dockRect = document.querySelector('.mobile-dock')!.getBoundingClientRect();
    const icons = [...document.querySelectorAll('.mobile-dock .dock-icon')].map((icon) => icon.getBoundingClientRect());
    const chamberIcon = document.querySelector('.dock-chamber .dock-icon')!;
    const chamberRect = chamberIcon.getBoundingClientRect();
    const style = getComputedStyle(chamberIcon);
    const labelTops = [...document.querySelectorAll('.mobile-dock .dock-label')].map((label) => label.getBoundingClientRect().top);
    return {
      index: icons.findIndex((icon) => icon.x === chamberRect.x),
      total: icons.length,
      width: chamberRect.width,
      widestOther: Math.max(...icons.filter((icon) => icon.x !== chamberRect.x).map((icon) => icon.width)),
      liftAboveDock: dockRect.top - chamberRect.top,
      borderRadius: style.borderRadius,
      distinctLabelTops: [...new Set(labelTops.map((top) => Math.round(top)))],
    };
  });
  expect(chamberProminence.index).toBe(2);
  expect(chamberProminence.total).toBe(5);
  expect(chamberProminence.width).toBeGreaterThan(chamberProminence.widestOther);
  expect(chamberProminence.liftAboveDock).toBeGreaterThan(0);
  expect(chamberProminence.borderRadius).toBe('50%');
  // Hinausragen darf allein das Symbolfeld: Alle Beschriftungen stehen weiterhin
  // auf derselben Linie, auch die der Sternkammer.
  expect(chamberProminence.distinctLabelTops).toHaveLength(1);

  const geometry = await page.evaluate(() => {
    const chamber = document.querySelector('.star-chamber')!.getBoundingClientRect();
    const star = document.querySelector('.star-button')!.getBoundingClientRect();
    const dockRect = document.querySelector('.mobile-dock')!.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.mobile-dock button')].map((button) => button.getBoundingClientRect());
    const labels = [...document.querySelectorAll('.mobile-dock .dock-label')].map((label) => label.getBoundingClientRect());
    return {
      chamber: { x: chamber.x, y: chamber.y, width: chamber.width, height: chamber.height },
      starCenterY: star.y + star.height / 2,
      dockTop: dockRect.top,
      dockBottom: dockRect.bottom,
      lowestButtonBottom: Math.max(...buttons.map((button) => button.bottom)),
      lowestLabelBottom: Math.max(...labels.map((label) => label.bottom)),
      outerLabelInset: Math.min(labels[0].left, window.innerWidth - labels[labels.length - 1].right),
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  // Die Kammer beginnt oben, endet exakt am Dock und das Dock am Viewportrand.
  expect(geometry.chamber.width).toBe(geometry.viewportWidth);
  expect(geometry.chamber.y).toBe(0);
  expect(Math.abs(geometry.chamber.y + geometry.chamber.height - geometry.dockTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.dockBottom - geometry.viewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.starCenterY - (geometry.chamber.y + geometry.chamber.height / 2))).toBeLessThanOrEqual(1);
  // Unterhalb der Dock-Buttons bleibt ein Fußabstand frei, damit Beschriftung
  // und Trefferfläche weder in die System-Geste am unteren Rand (Home/Siri)
  // noch in die abgerundeten Displayecken laufen. Der Abstand kommt zusätzlich
  // zu einer eventuellen Safe-Area, die es im Testbrowser nicht gibt.
  expect(geometry.viewportHeight - geometry.lowestButtonBottom).toBeGreaterThanOrEqual(18);
  expect(geometry.viewportHeight - geometry.lowestLabelBottom).toBeGreaterThanOrEqual(18);
  expect(geometry.outerLabelInset).toBeGreaterThanOrEqual(6);
  // Kein Scrollen mehr — weder vertikal noch horizontal.
  expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).toBe('hidden');
});

test('the dock opens each control area as a titled popup and keeps the tiles live', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  const dock = page.getByRole('navigation', { name: 'Kontrollbereiche' });

  // Die beiden Bereichssymbole öffnen ihren Bereich als Blatt mit passendem
  // Titel. Die Fusionskacheln stehen dabei im Upgrades-Bereich.
  for (const [name, cardSelector] of [
    ['Upgrades', '[data-upgrade-card="gravity"]'],
    ['Automationen', '[data-automation-card="accretion"]'],
  ] as const) {
    await dock.getByRole('button', { name: `${name} öffnen` }).click();
    const popup = page.getByRole('dialog', { name });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('heading', { name })).toBeVisible();
    await expect(popup.locator(cardSelector)).toBeVisible();
    await page.getByRole('button', { name: `${name} schließen` }).click();
    await expect(popup).toHaveCount(0);
  }
  await dock.getByRole('button', { name: 'Upgrades öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Upgrades' }).locator('[data-reaction-card="hydrogen"]')).toBeVisible();
  await page.getByRole('button', { name: 'Upgrades schließen' }).click();

  // Die Kacheln im Popup werden weiterhin pro Tick aktualisiert: Der
  // Ausbaubutton der Gravitation ist mit 150 Energie bezahlbar und pulst.
  await dock.getByRole('button', { name: 'Upgrades öffnen' }).click();
  const gravityButton = page.locator('[data-upgrade-card="gravity"] .tile-action-button');
  await expect(gravityButton).toHaveClass(/is-buildable/);
  await gravityButton.click();
  await expect(page.locator('[data-upgrade-card="gravity"] .level-pip.is-filled')).toHaveCount(1);

  // Schließen geht auch über den Hintergrund und Escape.
  await page.locator('[data-overlay-dismiss="panel"]').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog', { name: 'Upgrades' })).toHaveCount(0);
  await dock.getByRole('button', { name: 'Automationen öffnen' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Automationen' })).toHaveCount(0);

  // Die letzten beiden Symbole öffnen unverändert ihre bekannten Inhalte.
  await dock.getByRole('button', { name: 'Chronik öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Lebenswege der Sterne' })).toBeVisible();
  await page.getByRole('button', { name: 'Chronik schließen' }).click();
  await dock.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible();
});

// Kern der mobilen Fassung: Vom Dock geöffnete Flächen enden über dem Dock,
// statt es zu verdecken. Ein Wechsel zwischen zwei Dock-Zielen ist deshalb
// immer genau ein Klick — ohne vorheriges Schließen.
test('dock sheets end above the dock so switching between areas takes a single tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoGame(page);
  const dock = page.getByRole('navigation', { name: 'Kontrollbereiche' });
  const chamber = dock.getByRole('button', { name: 'Sternkammer anzeigen' });

  const sheetGeometry = async () => page.evaluate(() => {
    const backdrop = document.querySelector('.modal-backdrop')!.getBoundingClientRect();
    const dockRect = document.querySelector('.mobile-dock')!.getBoundingClientRect();
    const topmostAtDock = document.elementFromPoint(dockRect.x + dockRect.width / 2, dockRect.top + dockRect.height / 2);
    return { sheetBottom: backdrop.bottom, dockTop: dockRect.top, dockIsOnTop: Boolean(topmostAtDock?.closest('.mobile-dock')) };
  });

  // Einstellungen öffnen: Das Blatt endet über dem Dock, das Dock bleibt oben.
  await dock.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible();
  let geometry = await sheetGeometry();
  expect(geometry.sheetBottom).toBeLessThanOrEqual(geometry.dockTop);
  expect(geometry.dockIsOnTop).toBe(true);
  await expect(dock.getByRole('button', { name: 'Einstellungen öffnen' })).toHaveClass(/active/);
  await expect(chamber).not.toHaveClass(/active/);

  // Ein Klick genügt für den Wechsel in einen Kontrollbereich …
  await dock.getByRole('button', { name: 'Upgrades öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Upgrades' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toHaveCount(0);
  geometry = await sheetGeometry();
  expect(geometry.sheetBottom).toBeLessThanOrEqual(geometry.dockTop);

  // … und ein Klick auf die Sternkammer gibt den Blick auf den Stern frei.
  await chamber.click();
  await expect(page.getByRole('dialog', { name: 'Upgrades' })).toHaveCount(0);
  await expect(chamber).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Materie einsammeln' })).toBeVisible();

  // Ein erneuter Klick auf dasselbe Dock-Element schließt es wieder.
  await dock.getByRole('button', { name: 'Upgrades öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Upgrades' })).toBeVisible();
  await dock.getByRole('button', { name: 'Upgrades öffnen' }).click();
  await expect(page.getByRole('dialog', { name: 'Upgrades' })).toHaveCount(0);
  await expect(chamber).toHaveClass(/active/);

  // Ziel- und Wissens-Modale haben keinen Dock-Gegenpart und bleiben deshalb
  // bildschirmfüllend.
  await page.getByRole('button', { name: 'Aktuelles Ziel öffnen' }).click();
  const objectiveGeometry = await sheetGeometry();
  expect(objectiveGeometry.sheetBottom).toBeGreaterThan(objectiveGeometry.dockTop);
});

test('the dock marks control areas with an opportunity through glow and a counter', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLegacyGame(page, {
    stage: 'hydrogen', cloud: { hydrogen: 38_900, helium: 19_000, deuterium: 50 },
    star: { hydrogen: 30_000, helium: 6_000, deuterium: 50 },
    energy: 1_000, temperature: 11_400_000, manualFusions: 25,
    stats: { hydrogenFused: 5_000 },
  });
  await gotoGame(page);
  const dock = page.getByRole('navigation', { name: 'Kontrollbereiche' });
  const upgrades = dock.getByRole('button', { name: 'Upgrades öffnen' });
  const chamber = dock.getByRole('button', { name: 'Sternkammer anzeigen' });

  await expect(upgrades).toHaveClass(/has-notice/);
  await expect(upgrades).toHaveCSS('color', 'rgb(242, 168, 75)');
  expect(await upgrades.locator('.dock-icon').evaluate((element) => getComputedStyle(element).filter)).toContain('drop-shadow');
  // Solange im Dock nichts geöffnet ist, sieht der Spieler die Kacheln gar
  // nicht — die Gelegenheit bleibt deshalb offen, statt still abgehakt zu
  // werden. Die Sternkammer selbst kennt keine Gelegenheiten.
  await expect(chamber).not.toHaveClass(/has-notice/);
  await expect(chamber.locator('.tab-count')).toHaveCount(0);

  // Das Öffnen des Bereichs quittiert die Gelegenheit.
  await upgrades.click();
  await page.getByRole('button', { name: 'Upgrades schließen' }).click();
  await expect(upgrades).not.toHaveClass(/has-notice/);
  await expect(upgrades.locator('.tab-count')).toBeHidden();
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

  await expect(page.getByRole('heading', { name: 'Helium', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kohlenstoff', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sauerstoff', exact: true, level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neon', exact: true, level: 3 })).toBeVisible();
  await expect(page.locator('[data-reaction-card="hydrogen"] .reaction-symbol.element.he')).toHaveText('He');
  await expect(page.locator('[data-reaction-card="helium"] .reaction-symbol.element.c')).toHaveText('C');
  await expect(page.locator('[data-reaction-card="alphaCapture"] .reaction-symbol.element.o')).toHaveText('O');
  await expect(page.locator('[data-reaction-card="carbon"] .reaction-symbol.element.ne')).toHaveText('Ne');
  await expect(page.locator('[data-fusion-ring-button="carbon"]')).toHaveCount(0);
  // The carbonOxygen stage now carries the Punkt-6 shell wind, which keeps
  // the H/He envelope (and thus the star chamber) changing every frame.
  // Dispatch the clicks synchronously in-page rather than racing Playwright's
  // scroll-then-click flow against the next re-render.
  await selectFusion(page, 'alphaCapture');
  await page.locator('.star-button').evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('.left-panel [data-matter="oxygen"]')).toBeVisible();
  await expect(page.locator('[data-ui="oxygen-value"]')).not.toHaveText('0%');

  await page.getByRole('tab', { name: /Automationen/ }).click();
  await expect(page.locator('[data-automation-card="fusion"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="heliumFusion"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="oxygenSynthesis"]')).toBeVisible();
  await expect(page.locator('[data-automation-card="carbonFusion"]')).toHaveCount(0);
});
