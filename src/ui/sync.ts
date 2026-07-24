import {
  ACTIVE_WARNINGS,
  AUTOMATION_ORDER,
  DISPLAY_MATTER_KEYS,
  INITIAL_TEMPERATURE,
  MATTER_KEYS,
  PRESTIGE_PERKS,
  REACTION_ORDER,
  RESOURCES,
  STAGES,
  STAGE_LABELS,
  THRESHOLDS,
} from '../content';
import {
  accretionPerClick,
  accretionPerSecond,
  activeWarnings,
  cloudDefinition,
  cloudMass,
  objectiveFor,
  pressureProgress,
  starMass,
} from '../game/engine';
import { syncDebug } from './debug';
import { formatDuration, formatEnergy, formatMatter, formatNumber, formatRate, formatSolarMasses, formatTemperature, icons, temperatureScale } from './format';
import { isWarningsOpen, setWarningsOpen } from './menus';
import { isMissionCollapsed } from './mission';
import { markOpportunitiesSeen, syncCycleEndNotice, syncNotifications, syncObjectiveAchievement, syncToast } from './notifications';
import { syncOverlay } from './overlay';
import { app, getActivePanel, getState, setActivePanel, type Panel } from './store';
import { syncTutorial } from './tutorial';
import {
  automationView,
  automationVisible,
  currentOpportunities,
  knowledgeButton,
  logMarkup,
  orderedUpgradeCards,
  panelMarkup,
  reactionView,
  tileButtonInner,
  timelineMarkup,
  timelineNodes,
  upgradeOrderSignature,
} from './views';

let lastStage = getState().stage;
let lastLogSignature = '';
let lastUpgradeOrderSignature = '';
let lastDynamicPanelSignature = '';
const uiElements = new Map<string, HTMLElement>();

export function renderShell(): void {
  const state = getState();
  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Cosmic Clicker Startseite"><span class="brand-mark">${icons.spark}</span><span><b>COSMIC</b><em>CLICKER</em></span></a>
      <div class="run-status"><b data-ui="run">ZYKLUS 01</b></div>
      <div class="header-actions"><div class="resource-menu"><button class="resource-chip" data-action="toggle-perks" aria-label="Sternenstaub und aktive Vermächtnis-Perks anzeigen" aria-expanded="false"><span>✦</span><b data-ui="stardust">0</b></button><div class="perk-popover"><span>Aktive Perks</span><div><b>${PRESTIGE_PERKS.largerCloud.title}</b><small>Stufe <i data-ui="cloud-perk-level">0</i></small></div><div><b>${PRESTIGE_PERKS.permanentGravity.title}</b><small>Stufe <i data-ui="gravity-perk-level">0</i></small></div><div><b>${PRESTIGE_PERKS.fusionMemory.title}</b><small>Stufe <i data-ui="fusion-perk-level">0</i></small></div><p>Neue Stufen können am Zyklusende gekauft werden.</p></div></div><div class="sound-menu"><button class="icon-button" data-action="toggle-sound-menu" aria-label="Audioeinstellungen öffnen" aria-expanded="false">${state.soundEnabled ? icons.sound : icons.soundOff}</button><div class="sound-popover"><div><span>Effektlautstärke</span><b data-ui="volume-label">35%</b></div><input data-action="set-volume" aria-label="Effektlautstärke" type="range" min="0" max="100" step="1" value="35"><button data-action="toggle-sound" data-ui="mute-label">Ton stummschalten</button></div></div><button class="icon-button export-button" data-action="export" aria-label="Spielstand exportieren">${icons.download}</button><div class="reset-control"><button class="icon-button reset-button" data-action="reset-menu" aria-label="Neustartoptionen öffnen">${icons.reset}</button><div class="reset-choices"><button data-action="reset-run">Runde neu starten</button><button data-action="reset-full"><span data-full-reset-label>Spielstand löschen</span></button></div></div></div>
    </header>

    <main class="${isMissionCollapsed() ? 'mission-is-collapsed' : ''}">
      <section class="mission-strip ${isMissionCollapsed() ? 'is-collapsed' : ''}" data-ui="mission-strip"><div class="mission-copy" data-tutorial="objective"><span data-ui="objective-eyebrow"></span><h2 data-ui="objective-title"></h2><p data-ui="objective-detail"></p></div><div class="mission-progress" data-tutorial="objective-progress"><div class="progress-label"><span>Fortschritt</span><b data-ui="objective-percent"></b></div><div class="progress-track"><i data-ui="objective-bar"></i></div></div><div class="elapsed"><span>Laufzeit</span><b data-ui="elapsed"></b></div><button class="mission-collapse" data-action="toggle-mission" aria-expanded="${String(!isMissionCollapsed())}" aria-label="${isMissionCollapsed() ? 'Zielbereich vergrößern' : 'Zielbereich verkleinern'}" title="${isMissionCollapsed() ? 'Zielbereich vergrößern' : 'Zielbereich verkleinern'}">${icons.chevron}</button></section>

      <section class="stellar-lab">
        <aside class="left-panel" data-tutorial="left-panel">
          <section class="data-panel core-panel" data-tutorial="realtime-data">
            <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
            <div class="primary-reading"><span>Kerntemperatur${knowledgeButton('coreTemperature')}</span><b data-ui="temperature"></b><div class="thermal-scale"><i data-ui="temperature-bar"></i></div><small><span>${formatTemperature(INITIAL_TEMPERATURE)}</span><span data-ui="temperature-max"></span></small></div>
            <div class="metric-grid"><div class="metric"><span>Sternmasse${knowledgeButton('starMass')}</span><b data-ui="mass"></b><small>ME</small></div><div class="metric"><span>Kerndruck${knowledgeButton('corePressure')}</span><b data-ui="pressure"></b><small>% Zünddruck</small></div><div class="metric energy-metric" data-tutorial="energy"><span>Energie${knowledgeButton('energy')}</span><b data-ui="energy"></b><small>MeV</small></div><div class="metric"><span>Akkretion${knowledgeButton('accretion')}</span><b data-ui="accretion-rate"></b><small>ME / Sek.</small></div></div>
            <div class="composition" data-tutorial="core-composition"><div class="section-label"><span>Kernzusammensetzung</span></div><div class="matter-elements core-elements">${DISPLAY_MATTER_KEYS.map((key) => `<div data-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><p><b>${RESOURCES[key].label}</b><strong data-ui="${key}-value"></strong></p></div>`).join('')}</div></div>
          </section>
          <section class="data-panel cloud-panel" data-ui="cloud-panel" data-tutorial="matter-reservoir">
            <div class="panel-heading cloud-panel-heading"><span class="index">01B</span><div><small>Materiereservoir</small><h2 data-ui="cloud-name">Urwolke</h2></div></div>
            <div class="cloud-stats"><div class="cloud-summary"><div><span>Restmaterie</span><b data-ui="cloud-mass"></b><small data-ui="cloud-initial"></small></div><div class="cloud-mini-gauge"><i class="gauge-ring"></i><b data-ui="cloud-percent"></b></div></div><div data-tutorial="cloud-composition"><div class="section-label cloud-composition-label"><span>Zusammensetzung</span></div><div class="matter-elements cloud-elements">${DISPLAY_MATTER_KEYS.map((key) => `<div data-cloud-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><p><b>${RESOURCES[key].label}</b><strong data-ui="cloud-${key}"></strong></p></div>`).join('')}</div></div></div>
          </section>
        </aside>

        <section class="star-chamber">
          <div class="stage-label"><span data-ui="stage"></span><b data-ui="stage-detail"></b></div>
          <div class="automation-particles" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i data-auto-particle="${index}">${index % 5 !== 4 ? 'H' : 'He'}</i>`).join('')}</div>
          <button class="star-button" data-action="accrete" data-tutorial="star" aria-label="Materie einsammeln"><span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span></button>
          <button class="click-callout" type="button" disabled><span data-ui="click-yield"></span><small data-ui="click-detail"></small></button><div class="phase-dots">${Array.from({length:8},(_, index)=>`<i data-phase="${index}"></i>`).join('')}</div>
          <div class="warning-corner" data-ui="warning-corner" hidden><button class="warning-toggle" data-action="toggle-warnings" aria-label="Aktive Warnungen anzeigen" aria-expanded="false">${icons.warning}</button><div class="warning-popover"><span class="warning-popover-title">Aktive Warnungen</span><div data-ui="warning-list"></div></div></div>
        </section>

        <aside class="action-sidepanel">
          <div class="sidepanel-heading"><div class="sidepanel-title"><span class="index">02</span><div><small>Kontrollzentrum</small><h2>Sternsysteme</h2></div></div><div class="sidepanel-tools"><button data-action="replay-tutorial" aria-label="Tutorial starten">${icons.help}</button><button data-action="open-stats" aria-label="Statistik öffnen">${icons.stats}</button></div></div>
          <div class="side-tabs" role="tablist" aria-label="Kontrollbereiche">${([['reactions','Reaktionen'],['upgrades','Upgrades'],['automation','Automationen']] as [Panel,string][]).map(([panel,label])=>`<button data-panel="${panel}" role="tab"><span>${label}</span><b class="tab-count" data-tab-count="${panel}" hidden></b></button>`).join('')}</div>
          <div class="side-content" data-ui="deck-content"></div>
        </aside>
      </section>

      <section class="chronicle-dock" role="button" tabindex="0" aria-label="Chronik öffnen"><div class="dock-timeline"><div class="section-label"><span>Stellare Entwicklung</span><small>${cloudDefinition(state.cloudTier).shortName.toUpperCase()} · ≈ ${formatSolarMasses(cloudDefinition(state.cloudTier).solarMasses)}</small></div><div class="timeline" data-ui="dock-timeline">${timelineMarkup()}</div></div><div class="dock-log"><div class="section-label"><span>Sternenlogbuch</span><small>LIVE</small></div><div class="log-list" data-ui="dock-log">${logMarkup(2)}</div></div><span class="chronicle-expand" aria-hidden="true">↗</span></section>
    </main>

    <footer><span>COSMIC CLICKER · PROTOTYP 0.3</span><p>Wissenschaftlich plausibel · spielerisch komprimiert</p><button data-action="import">Spielstand importieren</button><input id="save-import" type="file" accept="application/json" hidden /></footer>
    <div data-ui="overlay-root"></div><div data-ui="tutorial-root"></div><div data-ui="achievement-root"></div><div data-ui="cycle-end-root"></div><div data-ui="debug-root"></div><div data-ui="toast-root"></div>`;

  switchPanel(getActivePanel(), false);
  updateUI(true);
}

function uiElement(name: string): HTMLElement | null {
  const cached = uiElements.get(name);
  if (cached?.isConnected) return cached;
  const element = app.querySelector<HTMLElement>(`[data-ui="${name}"]`);
  if (element) uiElements.set(name, element);
  return element;
}

function setText(name: string, value: string): void {
  const element = uiElement(name);
  if (element && element.textContent !== value) element.textContent = value;
}

function setWidth(name: string, value: number): void {
  uiElement(name)?.style.setProperty('width', `${Math.max(0, Math.min(100, value))}%`);
}

// Punkt 8: Die Reaktionskarten werden gezielt in-place aktualisiert statt bei
// jedem Tick per innerHTML neu gebaut. Das Neubauen zerstörte den Hover- und
// Fokuszustand der Buttons und ließ sie beim Überfahren flackern; die Struktur
// des Panels ändert sich jetzt nur noch, wenn eine neue Reaktion freigeschaltet
// wird (siehe dynamicPanelSignature in updateUI).
function syncReactionPanel(): void {
  const state = getState();
  REACTION_ORDER.forEach((id) => {
    const card = app.querySelector<HTMLElement>(`[data-reaction-card="${id}"]`);
    if (!card) return;
    const view = reactionView(id);
    card.classList.toggle('is-ready', view.available);
    const button = card.querySelector<HTMLButtonElement>('[data-action="run-reaction"]');
    if (button) {
      button.disabled = !view.available;
      const label = button.querySelector('[data-button-label]');
      if (label && label.textContent !== view.label) label.textContent = view.label;
      const detail = button.querySelector('[data-button-detail]');
      if (detail && detail.textContent !== view.detail) detail.textContent = view.detail;
    }
    const upgradeButton = card.querySelector<HTMLButtonElement>('[data-action="buy-reaction-upgrade"]');
    if (upgradeButton) {
      // Der Ausbaupreis ändert sich nur mit der Ausbaustufe, und die ist Teil
      // der dynamicPanelSignature (siehe updateUI) — ein Stufenwechsel löst
      // also ohnehin einen Strukturrebuild aus. Hier bleibt daher nur die pro
      // Tick schwankende Bezahlbarkeit (Energie) zu aktualisieren.
      const fillPercent = view.upgradeMax ? 0 : state.energy / view.upgradePrice * 100;
      const costText = view.upgradeMax ? '' : `${view.upgradePrice} E`;
      const ariaLabel = view.upgradeMax ? 'Reaktionsausbau voll ausgebaut' : `Reaktionsausbau für ${view.upgradePrice} Energie`;
      // Reaktionen zeigen von Anfang an den Doppel-Caret, nie ein Schloss.
      syncTileButton(upgradeButton, view.upgradeMax, true, false, view.upgradeAffordable, fillPercent, costText, ariaLabel);
    }
  });
}

// Punkt 3/4/6/7/9: Gemeinsame In-place-Aktualisierung für die Eck-Ausbaubuttons
// (Automationen, Upgrades, Reaktionsausbau). Icon/Zustandsklassen und der im
// Button stehende Preis wechseln nur bei einem echten Zustandswechsel
// (Ausbaustufe erreicht Maximum, Voraussetzung erfüllt/verliert sich) — die
// reine Bezahlbarkeit (Energie reicht gerade so) und der Fortschritts-Fill
// (Freischaltungs- bzw. Bezahlbarkeits-Fortschritt, bei allen drei Kartentypen)
// werden dagegen bei jedem Tick aktualisiert, damit der Amber-Glow sofort
// an-/ausgeht. Tooltips gibt es
// bewusst nicht mehr (Punkt 2) — aria-label bleibt nur für Screenreader
// erhalten. Der Wechsel von Schloss zu Doppel-Caret nach der ersten
// gekauften Stufe (Punkt 1, showLock) braucht hier keine eigene
// Übergangserkennung: bei Upgrades/Automationen steckt die Stufe bereits in
// der jeweiligen Panel-Signatur (siehe updateUI), ein Stufenwechsel baut das
// Panel also ohnehin komplett neu — mit dem dann schon korrekten Icon.
function syncTileButton(
  button: HTMLButtonElement | null,
  complete: boolean,
  unlocked: boolean,
  showLock: boolean,
  affordable: boolean,
  fillPercent: number,
  costText: string,
  ariaLabel: string,
): void {
  if (!button) return;
  button.disabled = !affordable;
  button.classList.toggle('is-buildable', affordable);
  button.style.setProperty('--tile-fill', `${Math.max(0, Math.min(100, fillPercent))}%`);
  const tileState = complete ? 'complete' : !unlocked ? 'locked' : 'open';
  if (button.dataset.tileState !== tileState) {
    button.classList.toggle('is-complete', complete);
    button.classList.toggle('is-locked', !complete && !unlocked);
    button.innerHTML = tileButtonInner(complete, unlocked, showLock, costText);
    button.dataset.tileState = tileState;
  } else {
    const priceSpan = button.querySelector<HTMLElement>('[data-tile-price]');
    if (priceSpan && priceSpan.textContent !== costText) priceSpan.textContent = costText;
  }
  if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
}

function syncActivePanel(): void {
  const state = getState();
  const activePanel = getActivePanel();
  if (activePanel === 'reactions') syncReactionPanel();
  if (activePanel === 'upgrades') {
    orderedUpgradeCards().forEach(({ view }) => {
      const button = app.querySelector<HTMLButtonElement>(`[data-action="${view.definition.action}"]`);
      const affordable = !view.complete && view.unlocked && state.energy >= view.price;
      // Fortschritts-Fill genau wie bei Reaktionen: gesperrt → unlockProgress,
      // ausbaubar → Energie/Preis. Schloss bis zur ersten gekauften Stufe
      // (Punkt 1), unabhängig von der Freischaltung.
      const fillPercent = view.complete ? 0 : !view.unlocked ? view.unlockProgress * 100 : state.energy / view.price * 100;
      const showLock = view.level === 0;
      const costText = view.complete ? '' : `${view.price} E`;
      const ariaLabel = view.complete ? view.definition.button.complete
        : !view.unlocked ? view.label
          : `${view.definition.button.purchase} für ${view.price} Energie`;
      syncTileButton(button, view.complete, view.unlocked, showLock, affordable, fillPercent, costText, ariaLabel);
    });
  }
  if (activePanel === 'automation') {
    AUTOMATION_ORDER.filter(automationVisible).forEach((kind) => {
      const view = automationView(kind);
      const isMax = view.level >= view.max;
      const button = app.querySelector<HTMLButtonElement>(`[data-automation-card="${kind}"] button`);
      const affordable = !isMax && view.unlocked && state.energy >= view.price;
      // Fortschritts-Fill genau wie bei Reaktionen/Upgrades: gesperrt →
      // unlockProgress, ausbaubar → Energie/Preis. Schloss bis zur ersten
      // gekauften Stufe (Punkt 1), unabhängig von der Freischaltung.
      const fillPercent = isMax ? 0 : !view.unlocked ? view.unlockProgress * 100 : state.energy / view.price * 100;
      const showLock = view.level === 0;
      const costText = isMax ? '' : `${view.price} E`;
      const ariaLabel = isMax ? 'Maximum' : !view.unlocked ? view.lockedLabel : `Ausbauen für ${view.price} Energie`;
      syncTileButton(button, isMax, view.unlocked, showLock, affordable, fillPercent, costText, ariaLabel);
      // Der Sperrgrund-Fortschritt (z. B. "998 / 1.500 C") wächst kontinuierlich
      // mit der Reaktionsleistung — anders als der Ausbaupreis muss dieser Text
      // daher bei jedem Tick aktualisiert werden, nicht erst beim Strukturrebuild.
      // Das Element existiert nur, solange die Automation gesperrt ist (siehe
      // automationCard) — der Übergang selbst löst über dynamicPanelSignature
      // einen Strukturrebuild aus.
      const cost = app.querySelector<HTMLElement>(`[data-automation-cost="${kind}"]`);
      if (cost && cost.textContent !== view.lockedLabel) cost.textContent = view.lockedLabel;
    });
  }
}

function syncChronicleDock(): void {
  const state = getState();
  const signature = `${state.stage}:${state.log.map((entry) => entry.id).join(',')}`;
  if (signature === lastLogSignature) return;
  const timeline = app.querySelector<HTMLElement>('[data-ui="dock-timeline"]');
  const logList = app.querySelector<HTMLElement>('[data-ui="dock-log"]');
  if (timeline) timeline.innerHTML = timelineMarkup();
  if (logList) logList.innerHTML = logMarkup(2);
  lastLogSignature = signature;
}

export function updateUI(forcePanel = false): void {
  const state = getState();
  const activePanel = getActivePanel();
  const objective = objectiveFor(state);
  const mass = starMass(state);
  const remaining = cloudMass(state);
  const currentCloudDefinition = cloudDefinition(state.cloudTier);
  const initialCloud = MATTER_KEYS.reduce((sum, key) => sum + currentCloudDefinition.matter[key], 0);
  const scale = temperatureScale(state.temperature);
  const stageChanged = state.stage !== lastStage;

  const cloudPanel = uiElement('cloud-panel');
  if (cloudPanel) cloudPanel.hidden = remaining <= .001;

  setText('run', `ZYKLUS ${state.run.toString().padStart(2, '0')}`);
  setText('stardust', formatNumber(state.stardust));
  setText('elapsed', formatDuration(state.elapsed));
  setText('cloud-perk-level', String(state.perks.largerCloud));
  setText('gravity-perk-level', String(state.perks.permanentGravity));
  setText('fusion-perk-level', String(state.perks.fusionMemory));
  setText('objective-eyebrow', objective.eyebrow);
  setText('objective-title', objective.title);
  setText('objective-detail', objective.detail);
  setText('objective-percent', `${formatNumber(objective.progress, 1)}%`);
  setWidth('objective-bar', objective.progress);
  syncObjectiveAchievement(objective);
  setText('temperature', formatTemperature(state.temperature));
  setText('temperature-max', scale.label); uiElement('temperature-bar')?.style.setProperty('clip-path', `inset(0 ${100 - scale.progress}% 0 0)`);
  setText('mass', formatMatter(mass));
  setText('pressure', formatNumber(pressureProgress(state), 1));
  setText('energy', formatEnergy(state.energy));
  setText('accretion-rate', formatMatter(accretionPerSecond(state)));
  DISPLAY_MATTER_KEYS.forEach((key) => {
    setText(`${key}-value`, `${formatMatter(state.star[key])} ME`);
    setText(`cloud-${key}`, formatMatter(state.cloud[key]));
    const coreElement = app.querySelector<HTMLElement>(`[data-matter="${key}"]`);
    const cloudElement = app.querySelector<HTMLElement>(`[data-cloud-matter="${key}"]`);
    if (coreElement) coreElement.hidden = state.star[key] <= 0 && currentCloudDefinition.matter[key] <= 0;
    if (cloudElement) cloudElement.hidden = currentCloudDefinition.matter[key] <= 0;
  });
  setText('stage', STAGE_LABELS[state.stage]); setText('stage-detail', STAGES[state.stage].detail); setText('cloud-name', currentCloudDefinition.name);
  const star = app.querySelector<HTMLButtonElement>('.star-button');
  if (star) {
    star.className = `star-button stage-${state.stage}${state.completed ? ' is-complete' : ''}`;
    if (state.completed) delete star.dataset.action;
    else star.dataset.action = 'accrete';
    star.ariaLabel = state.completed ? 'Abgeschlossener Stern' : 'Materie einsammeln';
    star.disabled = !state.completed && remaining <= 0;
  }
  const clickCallout = app.querySelector<HTMLButtonElement>('.click-callout');
  if (clickCallout) {
    clickCallout.disabled = !state.completed;
    if (state.completed) clickCallout.dataset.action = 'open-summary';
    else delete clickCallout.dataset.action;
    clickCallout.ariaLabel = state.completed ? 'Zyklus-Zusammenfassung öffnen' : 'Akkretionshinweis';
  }
  const chamber = app.querySelector<HTMLElement>('.star-chamber');
  chamber?.style.setProperty('--star-scale', String(Math.min(1, Math.max(.1, mass / Math.max(1, initialCloud))))); chamber?.style.setProperty('--temp-scale', String(Math.min(1, state.temperature / THRESHOLDS.siliconTemperature)));
  chamber?.style.setProperty('--auto-accretion-duration', `${Math.max(1.45, 3.2 - state.automation.accretion * .2)}s`);
  chamber?.classList.toggle('has-auto-accretion', state.automation.accretion > 0 && !state.completed && remaining > 0);
  setText('click-yield', state.completed ? 'ZUSAMMENFASSUNG' : remaining <= 0 ? 'WOLKE ERSCHÖPFT' : `+${formatNumber(accretionPerClick(state))} ME`); setText('click-detail', state.completed ? 'Hier klicken zum Öffnen' : remaining <= 0 ? 'Entwicklung über Reaktionen fortsetzen' : 'Klicken, um Materie einzusammeln');
  if (forcePanel || stageChanged) {
    const nodes = timelineNodes();
    const stageIndex = Math.max(0, nodes.findIndex(([stage]) => stage === state.stage));
    const normalizedStage = nodes.length <= 1 ? 7 : Math.round(stageIndex / (nodes.length - 1) * 7);
    app.querySelectorAll<HTMLElement>('[data-phase]').forEach((dot) => dot.classList.toggle('active', Number(dot.dataset.phase) <= normalizedStage));
  }
  const cloudPercent = remaining / initialCloud * 100; setText('cloud-percent', `${formatNumber(cloudPercent, 1)}%`); setText('cloud-mass', `${formatMatter(remaining)} ME`); setText('cloud-initial', `von ${formatMatter(initialCloud)} ME`); app.querySelector<HTMLElement>('.gauge-ring')?.style.setProperty('--remaining', `${cloudPercent / 100 * 360}deg`);
  // Punkt 4: Warnsymbol unten rechts in der Star Chamber, sobald mindestens
  // eine Warnung aktiv ist; das Popover listet alle aktiven Warnungen samt
  // aktueller Verlustrate.
  const warnings = activeWarnings(state);
  const warningCorner = app.querySelector<HTMLElement>('[data-ui="warning-corner"]');
  if (warningCorner) {
    warningCorner.hidden = warnings.length === 0;
    if (!warnings.length && isWarningsOpen()) setWarningsOpen(false);
  }
  const warningMarkup = warnings.map(({ id, ratePerSecond }) =>
    `<div class="warning-entry"><b>${ACTIVE_WARNINGS[id].title}</b><strong>−${formatRate(ratePerSecond)} ME/s</strong><p>${ACTIVE_WARNINGS[id].text}</p></div>`).join('');
  const warningList = app.querySelector<HTMLElement>('[data-ui="warning-list"]');
  if (warningList && warningList.innerHTML !== warningMarkup) warningList.innerHTML = warningMarkup;
  const soundButton = app.querySelector<HTMLButtonElement>('[data-action="toggle-sound-menu"]'); if (soundButton) { soundButton.innerHTML = state.soundEnabled ? icons.sound : icons.soundOff; soundButton.ariaLabel = 'Audioeinstellungen öffnen'; }
  const volumeInput = app.querySelector<HTMLInputElement>('[data-action="set-volume"]'); if (volumeInput && Number(volumeInput.value) !== Math.round(state.volume * 100)) volumeInput.value = String(Math.round(state.volume * 100));
  setText('volume-label', `${Math.round(state.volume * 100)}%`); setText('mute-label', state.soundEnabled ? 'Ton stummschalten' : 'Ton einschalten');
  const currentUpgradeOrder = activePanel === 'upgrades' ? upgradeOrderSignature() : '';
  const upgradeOrderChanged = activePanel === 'upgrades' && currentUpgradeOrder !== lastUpgradeOrderSignature;
  // Punkt 8: Für das Reaktionspanel zählt nur noch die Struktur (welche
  // Karten existieren, welche Reaktionsausbaustufe sie gerade zeigen) — alle
  // sonstigen Werte darin aktualisiert syncReactionPanel() in-place, ohne die
  // Buttons neu zu bauen. Die Ausbaustufe gehört mit in die Signatur, weil der
  // „Voll ausgebaut"-Zustand (Punkt 5/6) den Kosten-Block strukturell
  // entfernt statt ihn nur per Text zu leeren. Für Automationen gilt dasselbe
  // zusätzlich für den Freischalt-Zustand (Meisterschaftsschwelle erreicht),
  // der unabhängig von einem Stufenwechsel eintreten kann.
  const dynamicPanelSignature = activePanel === 'reactions'
    ? `${state.unlockedReactions.join(',')}:${Object.values(state.reactionUpgrades).join(',')}`
    : activePanel === 'automation'
      ? `${state.unlockedReactions.join(',')}:${Object.values(state.automation).join(',')}:${AUTOMATION_ORDER.map((kind) => automationView(kind).unlocked).join(',')}`
      : '';
  const dynamicPanelChanged = dynamicPanelSignature !== lastDynamicPanelSignature;
  if (forcePanel || stageChanged || upgradeOrderChanged || dynamicPanelChanged) { const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(activePanel); lastStage = state.stage; lastUpgradeOrderSignature = currentUpgradeOrder; lastDynamicPanelSignature = dynamicPanelSignature; }
  syncNotifications(); syncActivePanel(); syncChronicleDock(); syncOverlay(); syncCycleEndNotice(); syncTutorial(); syncToast();
  if (import.meta.hot) syncDebug();
}

export function switchPanel(panel: Panel, markSeen = true): void {
  setActivePanel(panel);
  app.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => { const active = button.dataset.panel === panel; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(panel);
  syncActivePanel();
  if (markSeen) markOpportunitiesSeen(panel, currentOpportunities());
  syncNotifications();
}
