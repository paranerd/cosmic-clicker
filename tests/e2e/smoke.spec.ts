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

test('player can accrete matter and see the stellar data update', async ({ page }) => {
  await gotoGame(page);
  expect(await page.evaluate(() => typeof (window as typeof window & { cheat?: unknown }).cheat)).toBe('undefined');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(page.getByRole('heading', { name: 'Stellarer Kern' })).toBeVisible();
  await expect(page.getByText('Urwolke', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-ui="temperature"]')).toHaveText('10 K');
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
  await expect(gain).toHaveText('+48 ME');
  const gainStyle = await gain.evaluate((element) => ({
    top: Number.parseFloat((element as HTMLElement).style.top),
    textShadow: getComputedStyle(element).textShadow,
  }));
  expect(gainStyle.top).toBeLessThan((starBox!.y + starBox!.height / 2) - chamberBox!.y);
  expect(gainStyle.textShadow).not.toBe('none');
  await expect(page.locator('[data-ui="click-yield"]')).toHaveText('+48 ME');
  await expect(page.getByText('48', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-matter="hydrogen"] strong')).toContainText('ME');
  await expect(page.locator('[data-matter="hydrogen"] strong')).not.toContainText('%');
});

test('the first objective collects 1,000 ME hydrogen before protostar formation', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'nebula', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 9_010, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 990, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['collect-hydrogen'],
  });
  await page.goto('/');

  await expect(page.locator('[data-ui="objective-title"]')).toHaveText('Sammle 1.000 ME Wasserstoff ein');
  await expect(page.locator('[data-ui="objective-percent"]')).toHaveText('99%');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  await expect(page.locator('[data-ui="objective-title"]')).toHaveText('Protostern bilden');
  await expect(page.locator('.achievement-banner')).toContainText('1.000 ME Wasserstoff gesammelt');
});

test('reaching an objective uses a non-blocking achievement banner and warns about stellar wind', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'nebula', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 9_504, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_496, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    temperature: 97_184,
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
  const bannerBox = await achievement.boundingBox();
  expect(Math.abs((bannerBox!.x + bannerBox!.width / 2) - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(4_800);
  await expect(achievement).toBeVisible();
  await page.getByRole('button', { name: 'Zielhinweis schließen' }).click();
  await expect(achievement).toHaveCount(0);
  // Punkt 4: Aktive Warnungen erscheinen nicht mehr im Urwolken-Panel,
  // sondern als Warnsymbol unten rechts in der Star Chamber mit Popover.
  const warningCorner = page.locator('[data-ui="warning-corner"]');
  await expect(warningCorner).toBeVisible();
  const warningPopover = page.locator('.warning-popover');
  await expect(warningPopover).not.toBeVisible();
  await page.getByRole('button', { name: 'Aktive Warnungen anzeigen' }).click();
  await expect(warningPopover).toBeVisible();
  await expect(warningPopover).toContainText('Sternwind aktiv');
  await expect(warningPopover).toContainText('ME/s');
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
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: /Vermächtnis/ })).toHaveCount(0);
  await expect(page.locator('.action-sidepanel')).toContainText('Kontrollzentrum');
  await expect(page.getByText('Automatische Akkretion', { exact: true })).toHaveCount(0);
  const cloudPanel = page.locator('[data-ui="cloud-panel"]');
  const coreComposition = page.locator('.core-elements');
  await expect(coreComposition.locator('[data-matter="hydrogen"]')).toContainText('Wasserstoff');
  await expect(coreComposition.locator('[data-matter="hydrogen"]')).toContainText('ME');
  await expect(coreComposition.locator('.mini-track')).toHaveCount(0);
  await expect(coreComposition).toHaveCSS('grid-template-columns', /\d+(?:\.\d+)?px \d+(?:\.\d+)?px/);
  await expect(cloudPanel).toContainText('Kleine Urwolke');
  await expect(cloudPanel).toContainText('Zusammensetzung');
  await expect(cloudPanel.locator('.cloud-elements')).toHaveCSS('grid-template-columns', /\d+(?:\.\d+)?px \d+(?:\.\d+)?px/);
  const panelFlow = await page.locator('.left-panel').evaluate((leftPanel) => {
    const core = leftPanel.querySelector('.core-panel')?.getBoundingClientRect();
    const cloud = leftPanel.querySelector('.cloud-panel')?.getBoundingClientRect();
    const left = leftPanel.getBoundingClientRect();
    return {
      sectionGap: core && cloud ? cloud.top - core.bottom : Number.NaN,
      spaceBelowCloud: cloud ? left.bottom - cloud.bottom : Number.NaN,
    };
  });
  expect(Math.abs(panelFlow.sectionGap)).toBeLessThanOrEqual(1);
  expect(panelFlow.spaceBelowCloud).toBeGreaterThan(12);
  await expect(page.locator('.cloud-mini-gauge [data-ui="cloud-percent"]')).toHaveText('100%');
  // The smallest cloud now shares the same realistic primordial composition
  // as every other cloud size (~75 % H, ~25 % He, a small D trace) instead of
  // a hydrogen-only special case.
  await expect(page.locator('[data-cloud-matter="hydrogen"]')).toContainText('7.867');
  await expect(page.locator('[data-cloud-matter="helium"]')).toBeVisible();
  await expect(page.locator('[data-cloud-matter="helium"]')).toContainText('2.622');
  // Deuterium is intentionally never shown in the composition grid
  // (RESOURCES.deuterium.visibleInComposition is false), independent of the
  // cloud's actual composition.
  await expect(page.locator('[data-cloud-matter="deuterium"]')).toHaveCount(0);
  await expect(page.locator('.chronicle-dock')).toBeVisible();
  await expect(page.locator('.star-chamber .orbit')).toHaveCount(0);
  await expect.poll(() => page.locator('.star-chamber').evaluate((element) => [
    getComputedStyle(element, '::before').content,
    getComputedStyle(element, '::after').content,
  ])).toEqual(['none', 'none']);
  await expect(page.getByText('SIMULATION AKTIV', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-ui="temperature-max"]')).toHaveText('100.000 K');
  await expect(page.locator('[data-ui="core-total"]')).toHaveCount(0);
  await expect(page.locator('[data-ui="elapsed"]')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

  const objectivePositions = await page.locator('.mission-copy').evaluate((element) => {
    const eyebrow = element.querySelector('[data-ui="objective-eyebrow"]')!.getBoundingClientRect();
    const title = element.querySelector('[data-ui="objective-title"]')!.getBoundingClientRect();
    const detail = element.querySelector('[data-ui="objective-detail"]')!.getBoundingClientRect();
    return { eyebrow: eyebrow.top, title: title.top, detail: detail.top };
  });
  expect(objectivePositions.eyebrow).toBeLessThan(objectivePositions.title);
  expect(objectivePositions.title).toBeLessThan(objectivePositions.detail);

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
  await expect(chronicle.locator('.evolution-branch')).toHaveCount(6);
  await expect(chronicle).toContainText('Unterhalb der Zündmasse');
  const closeButton = page.getByRole('button', { name: 'Chronik schließen' });
  const restingBackground = await closeButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  await closeButton.hover();
  await expect.poll(() => closeButton.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);
  await expect(closeButton).toHaveCSS('transform', 'none');
  await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(chronicle).toHaveCount(0);
});

test('chronicle shows runtime timestamps and entries from earlier cycles', async ({ page }) => {
  const archivedEntries = Array.from({ length: 30 }, (_, index) => ({
    id: 100 + index,
    run: 1,
    elapsed: index,
    totalElapsed: index,
    text: `Archivierter Eintrag ${index + 1}.`,
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
      ...archivedEntries,
    ],
  });
  await gotoGame(page);
  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  const chronicle = page.getByRole('dialog', { name: 'Lebenswege der Sterne' });

  await expect(chronicle).toContainText('Zyklus 02 · 00:00:42 · Gesamt 00:01:47');
  await expect(chronicle).toContainText('Zweiter Zyklus gestartet.');
  await expect(chronicle).toContainText('Zyklus 01 · 00:01:05 · Gesamt 00:01:05');
  await expect(chronicle).toContainText('Erster Zyklus abgeschlossen.');
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

test('mission strip collapses to compact progress, percentage and runtime details', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await gotoGame(page);
  const strip = page.locator('.mission-strip');
  const collapseButton = page.getByRole('button', { name: 'Zielbereich verkleinern' });
  const restingColors = await collapseButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color };
  });
  expect(await collapseButton.evaluate((element) => {
    const button = element.getBoundingClientRect();
    const icon = element.querySelector('svg')!.getBoundingClientRect();
    return { x: icon.x + icon.width / 2 - (button.x + button.width / 2), y: icon.y + icon.height / 2 - (button.y + button.height / 2) };
  })).toEqual({ x: 0, y: 0 });
  const expandedStripBox = (await strip.boundingBox())!;
  const expandedButtonBox = (await collapseButton.boundingBox())!;
  expect(expandedButtonBox.y - expandedStripBox.y).toBe(10);
  expect(expandedStripBox.x + expandedStripBox.width - (expandedButtonBox.x + expandedButtonBox.width)).toBe(0);
  await collapseButton.tap();

  await expect(strip).toHaveClass(/is-collapsed/);
  expect(await strip.evaluate((element) => element.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running'))).toBe(true);
  await strip.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))));
  await expect(strip.locator('.progress-label')).toBeVisible();
  await expect(strip.locator('.progress-label')).toContainText('Fortschritt');
  await expect(strip.locator('[data-ui="objective-percent"]')).toHaveText(/%$/);
  await expect(strip.locator('.progress-track')).toBeVisible();
  await expect(strip.locator('.mission-copy')).toBeHidden();
  await expect(strip.locator('.elapsed')).toBeVisible();
  await expect(strip.locator('[data-ui="elapsed"]')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  const stripBox = (await strip.boundingBox())!;
  const expandButton = page.getByRole('button', { name: 'Zielbereich vergrößern' });
  const collapseButtonBox = (await expandButton.boundingBox())!;
  expect(stripBox.height).toBeLessThanOrEqual(48);
  expect(collapseButtonBox.height).toBeLessThan(stripBox.height);
  expect(await expandButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color };
  })).toEqual(restingColors);
  expect(await expandButton.evaluate((element) => {
    const button = element.getBoundingClientRect();
    const icon = element.querySelector('svg')!.getBoundingClientRect();
    return { x: icon.x + icon.width / 2 - (button.x + button.width / 2), y: icon.y + icon.height / 2 - (button.y + button.height / 2) };
  })).toEqual({ x: 0, y: 0 });

  await page.reload();
  await expect(page.locator('.mission-strip')).toHaveClass(/is-collapsed/);
  await page.getByRole('button', { name: 'Zielbereich vergrößern' }).tap();
  await expect(page.locator('.mission-copy')).toBeVisible();
  await context.close();
});

test('perk popover opens only on click and closes outside', async ({ page }) => {
  await gotoGame(page);
  const perkButton = page.getByRole('button', { name: 'Sternenstaub und aktive Vermächtnis-Perks anzeigen' });
  const popover = page.locator('.perk-popover');

  await expect(perkButton).not.toContainText('Sternenstaub');
  await perkButton.hover();
  await expect(popover).toBeHidden();
  await perkButton.click();
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('Wolkenmasse');
  await expect(popover).toContainText('Stufe 0');
  await expect(popover).not.toContainText('Kleine Urwolke');
  await expect(perkButton).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.mission-strip').click();
  await expect(popover).toBeHidden();
  await expect(perkButton).toHaveAttribute('aria-expanded', 'false');
});

test('new players can complete and replay the interactive tutorial', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' });
  await expect(intro).toContainText('COSMICCLICKER');
  await expect(intro).toContainText('kleinen Wolke aus kaltem Wasserstoff');
  await expect(intro).toHaveCSS('animation-name', 'introModalIn');
  await expect(page.locator('[data-ui="elapsed"]')).toHaveText('00:00:00');
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
  await expect(page.locator('.cloud-panel')).toHaveCSS('overflow-y', 'visible');
  const cloudCompositionFrame = await cloudComposition.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const panelRect = element.closest('.cloud-panel')!.getBoundingClientRect();
    const framePadding = Number.parseFloat(getComputedStyle(element).outlineOffset);
    return {
      frameBottom: rect.bottom + framePadding + 1,
      panelBottom: panelRect.bottom,
    };
  });
  expect(cloudCompositionFrame.frameBottom).toBeGreaterThan(cloudCompositionFrame.panelBottom);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein erster Akkretionsimpuls');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();
  await expect(tutorial).toContainText('Materie für den Sternenkern');
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Energie für dein Wachstum');
  await expect(page.locator('.energy-metric')).toHaveClass(/tutorial-focus/);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein erstes Ziel');
  await expect(page.locator('[data-tutorial="objective"]')).toHaveClass(/tutorial-focus/);
  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Fortschritt im Blick');
  await expect(page.locator('[data-tutorial="objective-progress"]')).toHaveClass(/tutorial-focus/);
  await tutorial.getByRole('button', { name: 'Verstanden' }).click();
  await expect(tutorial).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Protostern bilden' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Reaktionen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Ein neuer Kosmos beginnt.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tutorial starten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toContainText('Willkommen bei Cosmic Clicker!');
});

test('tutorial resumes when the first upgrade and automation can be purchased', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    elapsed: 120,
    stage: 'protostar',
    cloud: { hydrogen: 7_456, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_544, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    energy: 110,
    temperature: 100_000,
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 8 },
  });
  await page.goto('/');

  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toHaveAttribute('aria-selected', 'true');
  await expect(tutorial).toContainText('Dein erstes Upgrade');
  const gravityCard = page.locator('[data-upgrade-card="gravity"]');
  await expect(gravityCard).toHaveClass(/tutorial-focus/);
  await gravityCard.locator('[data-action="buy-gravity"]').click();

  await expect(page.getByRole('tab', { name: 'Automationen' })).toHaveAttribute('aria-selected', 'true');
  await expect(tutorial).toContainText('Automatische Akkretion');
  const accretionCard = page.locator('[data-automation-card="accretion"]');
  await expect(accretionCard).toHaveClass(/tutorial-focus/);
  await accretionCard.locator('[data-action="buy-accretion"]').click();
  await expect(tutorial).toContainText('Der Akkretionsstrom arbeitet');
  await expect(tutorial).toContainText('automatisch im Kern verdichtet');
  await expect(page.locator('[data-tutorial="left-panel"]')).toHaveClass(/tutorial-focus/);
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
    upgrades: { gravity: 1, deuteriumBurning: false },
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
  await expect(page.getByText('Tutorial beendet. Über ? kannst du es erneut starten.', { exact: true })).toBeVisible();
});

test('tutorial blocks the dimmed page while keeping its highlighted action clickable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' }).getByRole('button', { name: 'Tutorial starten', exact: true }).click();
  const tutorial = page.getByRole('complementary', { name: 'Tutorial' });
  const star = page.getByRole('button', { name: 'Materie einsammeln' });
  const starBox = await star.boundingBox();

  await page.mouse.click(starBox!.x + starBox!.width / 2, starBox!.y + starBox!.height / 2);
  await expect(page.locator('[data-ui="mass"]')).toHaveText('0');
  await expect(page.locator('.tutorial-blocker')).toHaveCSS('pointer-events', 'auto');

  for (let step = 0; step < 4; step += 1) await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect(tutorial).toContainText('Dein erster Akkretionsimpuls');
  await expect(star).toHaveClass(/tutorial-focus/);
  await expect(page.locator('.tutorial-highlight-shield')).toHaveCount(0);
  const starFocus = await star.evaluate((element) => {
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
  expect(starFocus.boxShadow).toContain('rgba(2, 5, 9, 0.98)');
  await star.click();
  await expect(page.locator('[data-ui="mass"]')).not.toHaveText('0');
});

test('objective achievements remain visible while the tutorial is active', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    cloud: { hydrogen: 9_010, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 990, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 4, stepId: 'first-accretion' },
    seenObjectives: ['collect-hydrogen'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  const achievement = page.locator('.achievement-banner');
  await expect(achievement).toBeVisible();
  await expect(achievement).toContainText('1.000 ME Wasserstoff gesammelt');
  await expect(achievement.locator('.achievement-next')).toContainText('Protostern bilden');
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toContainText('Materie für den Sternenkern');
});

test('the protostar achievement and its next objective remain visible during the tutorial', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 7,
    cloud: { hydrogen: 7_504, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
    star: { hydrogen: 2_496, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    temperature: 94_000,
    tutorial: { introSeen: true, cosmosToastPending: false, completed: false, step: 4, stepId: 'first-accretion' },
    seenObjectives: ['collect-hydrogen', 'form-protostar'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();

  const achievement = page.locator('.achievement-banner');
  await expect(achievement).toBeVisible();
  await expect(achievement).toContainText('Protostern gebildet');
  await expect(achievement).toContainText('Sternwind setzt ein');
  await expect(achievement.locator('.achievement-next')).toContainText('1.000.000 K erreichen');
});

test('mobile tutorial centers its card, spotlights targets and scrolls them into view', async ({ page }) => {
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
  const firstTarget = page.locator('[data-tutorial="realtime-data"]');
  await expect.poll(() => firstTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);
  await expect(firstTarget).toHaveCSS('outline-style', 'solid');
  await expect(firstTarget).toHaveCSS('outline-color', 'rgba(120, 215, 223, 0.72)');
  expect(await firstTarget.evaluate((element) => getComputedStyle(element).boxShadow)).toContain('rgba(2, 5, 9, 0.98)');
  const focusFrame = await firstTarget.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const padding = Number.parseFloat(style.outlineOffset);
    return {
      padding,
      left: rect.left - padding - 1,
      right: rect.right + padding + 1,
      viewportWidth: window.innerWidth,
    };
  });
  expect(focusFrame.padding).toBeGreaterThan(0);
  expect(focusFrame.padding).toBeLessThanOrEqual(12);
  expect(focusFrame.left).toBeGreaterThanOrEqual(5.5);
  expect(focusFrame.right).toBeLessThanOrEqual(focusFrame.viewportWidth - 5.5);

  // Der Scroll-Listener muss die Blocker noch im selben Scroll-Event
  // aktualisieren. Eine Positionierung erst im nächsten
  // requestAnimationFrame würde als sichtbares Nachziehen auffallen.
  const trackedBoxes = await page.evaluate(() => {
    return new Promise<{ focusTop: number; framePadding: number; blockerBottom: number }>((resolve) => {
      window.addEventListener('scroll', () => {
        const focusElement = document.querySelector('[data-tutorial="realtime-data"]')!;
        const focus = focusElement.getBoundingClientRect();
        const blocker = document.querySelector<HTMLElement>('[data-tutorial-blocker="top"]')!.getBoundingClientRect();
        resolve({
          focusTop: focus.top,
          framePadding: Number.parseFloat(getComputedStyle(focusElement).outlineOffset),
          blockerBottom: blocker.bottom,
        });
      }, { once: true, capture: true });
      window.scrollBy(0, 60);
    });
  });
  const expectedFrameTop = Math.max(6, trackedBoxes.focusTop - trackedBoxes.framePadding);
  expect(Math.abs(trackedBoxes.blockerBottom - expectedFrameTop)).toBeLessThanOrEqual(1);

  await tutorial.getByRole('button', { name: 'Weiter' }).click();
  await expect.poll(() => page.locator('.left-panel').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);

  await tutorial.getByRole('button', { name: 'Tutorial beenden', exact: true }).click();
  await tutorial.locator('[data-action="confirm-end-tutorial"]').click();
  const toast = page.getByText('Tutorial beendet. Über ? kannst du es erneut starten.', { exact: true });
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

  const skipped = page.getByText('Tutorial beendet. Über ? kannst du es erneut starten.', { exact: true });
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
  await page.getByRole('button', { name: 'Materie einsammeln' }).click();
  await page.getByRole('button', { name: 'Statistik öffnen' }).click();
  const stats = page.getByRole('dialog', { name: /Statistik/ });
  await expect(stats).toContainText('Eingesammelte Materie');
  await expect(stats).toContainText('48 ME');
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
  await expect(accretionCard).toContainText('Nächste Stufe: 17 ME/s');
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
  // mit 150 Energie auch bezahlbar (Preis 45) — trotzdem zeigt der Button vor
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
  // Preis 65 bezahlbar (105 Energie verbleiben nach dem Gravitations-Ausbau),
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
    energy: 20, temperature: 500_000,
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

  // Die Gravitations-Verdichtung ist freigeschaltet (keine Voraussetzungen),
  // mit 20 von 45 nötigen Energie aber noch nicht bezahlbar — der Fill zeigt
  // hier den Energie/Preis-Fortschritt (≈44,4 %), exakt wie bei Reaktionen.
  const gravityButton = page.locator('.upgrade-card').filter({ hasText: 'Gravitative Verdichtung' }).locator('.tile-action-button');
  await expect(gravityButton).not.toHaveClass(/is-buildable/);
  const gravityFill = await gravityButton.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--tile-fill'));
  expect(parseFloat(gravityFill)).toBeCloseTo(20 / 45 * 100, 5);
  expect(await gravityButton.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('gradient');

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
  // Deuteriumbrennen ist ein einmaliges Toggle-Upgrade ohne echte Ausbaustufen
  // (Punkt 2/Q4-Entscheidung) und bekommt daher keine Aktuell/Nächste-Stufe-
  // Zeile mit dem Multiplikator — die Bestätigung läuft über den
  // Beschreibungstext und den Button-Zustand.
  // Punkt 2/9: Kein Tooltip mehr — der Preis steht direkt im Button, das
  // aria-label liest sich wie ein Satz statt "Label Preis".
  await upgrade.getByRole('button', { name: 'Aktivieren für 75 Energie' }).click();
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
    energy: 117, temperature: 200_000, automation: { accretion: 1, fusion: 0 },
    perks: { largerCloud: 1, permanentGravity: 0, fusionMemory: 0 },
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
    seenObjectives: ['heat-protostar'], seenOpportunities: ['accretion:0'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Materie einsammeln' }).click({ clickCount: 4 });

  await expect(page.getByRole('status')).toContainText('Automation kann ausgebaut werden.');
  await expect(page.getByText('Neue Automation verfügbar.', { exact: true })).toHaveCount(0);
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
  expect(await hoverStyle(page.getByRole('button', { name: 'Sternenstaub und aktive Vermächtnis-Perks anzeigen' }))).toEqual(downloadStyle);

  await page.getByRole('button', { name: 'Chronik öffnen' }).click();
  expect(await hoverStyle(page.getByRole('button', { name: 'Chronik schließen' }))).toEqual(downloadStyle);
});

test('mobile cockpit stacks star, actions, stats and chronicle without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoGame(page);
  await expect(page.getByRole('button', { name: 'Materie einsammeln' })).toHaveCSS('touch-action', 'manipulation');

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
  await page.getByRole('button', { name: 'Wirklich alles löschen?' }).click();
  await expect(page.getByRole('dialog', { name: 'Entdecke das Schicksal der Sterne.' })).toBeVisible();
  await expect(page.getByText('Ein neuer Kosmos beginnt.')).toHaveCount(0);
});

test('cycle completion slides in a compact notice and opens the summary only on demand', async ({ page }) => {
  await seedLegacyGame(page, {
    version: 4, stage: 'deuterium', cloudTier: 0, nextCloudTier: 0,
    cloud: { hydrogen: 48, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 },
    star: { hydrogen: 10_442, helium: 0, deuterium: 10, carbon: 0, oxygen: 0 },
    temperature: 6_000_000,
    tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 },
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Tutorial starten' }).click();
  await expect(page.getByRole('complementary', { name: 'Tutorial' })).toBeVisible();
  await page.getByRole('button', { name: 'Statistik öffnen' }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole('dialog', { name: /Statistik/ })).toBeVisible();
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
  await expect(cloudPerk).toContainText('Stufe 0');
  await expect(cloudPerk).not.toContainText('Kleine Urwolke');
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
  await expect(page.locator('[data-ui="run"]')).toHaveText('ZYKLUS 01');
  await summary.getByRole('button', { name: 'Ohne Upgrades starten' }).click();
  await expect(summary).toHaveCount(0);
  await expect(page.locator('[data-ui="run"]')).toHaveText('ZYKLUS 02');
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
  await expect(page.locator('[data-ui="stardust"]')).toHaveText('0');

  await cloudPerk.getByRole('button', { name: 'Wolkenmasse abwählen' }).click();
  await expect(cloudPerk).toContainText('+1 gewählt');
  await expect(summary.locator('.cloud-slider input[type="range"]')).toHaveAttribute('max', '1');
  await expect(page.locator('[data-ui="stardust"]')).toHaveText('5');

  await summary.getByRole('button', { name: 'Neuen Zyklus starten' }).click();
  await expect(page.locator('[data-ui="run"]')).toHaveText('ZYKLUS 02');
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
  await expect(page.locator('[data-cloud-matter="helium"]')).toBeVisible();
  await expect(page.locator('[data-cloud-matter="deuterium"]')).toHaveCount(0);
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
