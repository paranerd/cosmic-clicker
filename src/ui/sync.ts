import {
  ACTIVE_WARNINGS,
  AUTOMATION_ORDER,
  DISPLAY_MATTER_KEYS,
  INITIAL_TEMPERATURE,
  MATTER_KEYS,
  PRESTIGE_PERKS,
  REACTION_ORDER,
  REACTION_UPGRADE,
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
import { formatCompact, formatDuration, formatMatter, formatNumber, formatRate, formatSolarMasses, formatTemperature, icons, levelPips, matterPercent, temperatureScale } from './format';
import { isWarningsOpen, setWarningsOpen } from './menus';
import { markOpportunitiesSeen, syncNotifications, syncObjectiveAchievement, syncToast } from './notifications';
import { syncOverlay } from './overlay';
import { app, getActivePanel, getState, setActivePanel, type Panel } from './store';
import { syncTutorial } from './tutorial';
import {
  automationView,
  automationVisible,
  currentOpportunities,
  logMarkup,
  orderedUpgradeCards,
  panelMarkup,
  reactionView,
  timelineMarkup,
  timelineNodes,
  upgradeOrderSignature,
} from './views';

let lastStage = getState().stage;
let lastLogSignature = '';
let lastUpgradeOrderSignature = '';
let lastDynamicPanelSignature = '';

export function renderShell(): void {
  const state = getState();
  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Cosmic Clicker Startseite"><span class="brand-mark">${icons.spark}</span><span><b>COSMIC</b><em>CLICKER</em></span></a>
      <div class="run-status"><b data-ui="run">ZYKLUS 01</b></div>
      <div class="header-actions"><div class="resource-menu"><button class="resource-chip" data-action="toggle-perks" aria-label="Sternenstaub und aktive Vermächtnis-Perks anzeigen" aria-expanded="false"><span>✦</span><b data-ui="stardust">0</b></button><div class="perk-popover"><span>Aktive Perks</span><div><b>${PRESTIGE_PERKS.largerCloud.title}</b><small><i data-ui="cloud-perk-name">Kleine Urwolke</i></small></div><div><b>${PRESTIGE_PERKS.permanentGravity.title}</b><small>Stufe <i data-ui="gravity-perk-level">0</i></small></div><div><b>${PRESTIGE_PERKS.fusionMemory.title}</b><small>Stufe <i data-ui="fusion-perk-level">0</i></small></div><p>Neue Stufen können am Zyklusende gekauft werden.</p></div></div><div class="sound-menu"><button class="icon-button" data-action="toggle-sound-menu" aria-label="Audioeinstellungen öffnen" aria-expanded="false">${state.soundEnabled ? icons.sound : icons.soundOff}</button><div class="sound-popover"><div><span>Effektlautstärke</span><b data-ui="volume-label">35%</b></div><input data-action="set-volume" aria-label="Effektlautstärke" type="range" min="0" max="100" step="1" value="35"><button data-action="toggle-sound" data-ui="mute-label">Ton stummschalten</button></div></div><button class="icon-button export-button" data-action="export" aria-label="Spielstand exportieren">${icons.download}</button><div class="reset-control"><button class="icon-button reset-button" data-action="reset-menu" aria-label="Neustartoptionen öffnen">${icons.reset}</button><div class="reset-choices"><button data-action="reset-run">Runde neu starten</button><button data-action="reset-full"><span data-full-reset-label>Spielstand löschen</span></button></div></div></div>
    </header>

    <main>
      <section class="mission-strip"><div class="mission-copy"><span data-ui="objective-eyebrow"></span><h2 data-ui="objective-title"></h2><p data-ui="objective-detail"></p></div><div class="mission-progress"><div class="progress-label"><span>Fortschritt</span><b data-ui="objective-percent"></b></div><div class="progress-track"><i data-ui="objective-bar"></i></div></div><div class="elapsed"><span>Laufzeit</span><b data-ui="elapsed"></b></div></section>

      <section class="stellar-lab">
        <aside class="data-panel left-panel">
          <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
          <div class="primary-reading"><span>Kerntemperatur</span><b data-ui="temperature"></b><div class="thermal-scale"><i data-ui="temperature-bar"></i></div><small><span>${formatTemperature(INITIAL_TEMPERATURE)}</span><span data-ui="temperature-max"></span></small></div>
          <div class="metric-grid"><div class="metric"><span>Sternmasse</span><b data-ui="mass"></b><small>ME</small></div><div class="metric"><span>Kerndruck</span><b data-ui="pressure"></b><small>% Zünddruck</small></div><div class="metric energy-metric"><span>Energie</span><b data-ui="energy"></b><small>verfügbar</small></div><div class="metric"><span>Akkretion</span><b data-ui="accretion-rate"></b><small>ME / Sek.</small></div></div>
          <div class="composition"><div class="section-label"><span>Kernzusammensetzung</span></div>${DISPLAY_MATTER_KEYS.map((key) => `<div class="composition-row" data-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><div><b>${RESOURCES[key].label}</b><div class="mini-track"><i data-ui="${key}-bar"></i></div></div><strong data-ui="${key}-value"></strong></div>`).join('')}</div>
          <div class="cloud-stats"><div class="section-label"><span data-ui="cloud-name">Urwolke</span></div><div class="cloud-summary"><div><span>Restmaterie</span><b data-ui="cloud-mass"></b><small data-ui="cloud-initial"></small></div><div class="cloud-mini-gauge"><i class="gauge-ring"></i><b data-ui="cloud-percent"></b></div></div><div class="cloud-elements">${DISPLAY_MATTER_KEYS.map((key) => `<div data-cloud-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><p><b>${RESOURCES[key].label}</b><strong data-ui="cloud-${key}"></strong></p></div>`).join('')}</div></div>
        </aside>

        <section class="star-chamber">
          <div class="stage-label"><span data-ui="stage"></span><b data-ui="stage-detail"></b></div>
          <div class="automation-particles" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i data-auto-particle="${index}">H</i>`).join('')}</div>
          <button class="star-button" data-action="accrete" aria-label="Materie einsammeln"><span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span></button>
          <div class="click-callout"><span data-ui="click-yield"></span><small data-ui="click-detail"></small></div><div class="phase-dots">${Array.from({length:8},(_, index)=>`<i data-phase="${index}"></i>`).join('')}</div>
          <div class="warning-corner" data-ui="warning-corner" hidden><button class="warning-toggle" data-action="toggle-warnings" aria-label="Aktive Warnungen anzeigen" aria-expanded="false">${icons.warning}</button><div class="warning-popover"><span class="warning-popover-title">Aktive Warnungen</span><div data-ui="warning-list"></div></div></div>
        </section>

        <aside class="action-sidepanel">
          <div class="sidepanel-heading"><div class="sidepanel-title"><span class="index">02</span><div><small>Kontrollzentrum</small><h2>Sternsysteme</h2></div></div><div class="sidepanel-tools"><button data-action="replay-tutorial" aria-label="Tutorial starten">${icons.help}</button><button data-action="open-stats" aria-label="Statistik öffnen">${icons.stats}</button></div></div>
          <div class="side-tabs" role="tablist" aria-label="Kontrollbereiche">${([['reactions','Reaktionen'],['upgrades','Upgrades'],['automation','Automationen']] as [Panel,string][]).map(([panel,label])=>`<button data-panel="${panel}" role="tab"><span>${label}</span><b class="tab-count" data-tab-count="${panel}" hidden></b></button>`).join('')}</div>
          <div class="side-content" data-ui="deck-content"></div>
        </aside>
      </section>

      <section class="chronicle-dock"><div class="dock-timeline"><div class="section-label"><span>Stellare Entwicklung</span><small>${cloudDefinition(state.cloudTier).shortName.toUpperCase()} · ≈ ${formatSolarMasses(cloudDefinition(state.cloudTier).solarMasses)}</small></div><div class="timeline" data-ui="dock-timeline">${timelineMarkup()}</div></div><div class="dock-log"><div class="section-label"><span>Sternenlogbuch</span><small>LIVE</small></div><div class="log-list" data-ui="dock-log">${logMarkup(2)}</div></div><button class="chronicle-expand" data-action="open-chronicle" aria-label="Chronik öffnen">↗</button></section>
    </main>

    <footer><span>COSMIC CLICKER · PROTOTYP 0.3</span><p>Wissenschaftlich plausibel · spielerisch komprimiert</p><button data-action="import">Spielstand importieren</button><input id="save-import" type="file" accept="application/json" hidden /></footer>
    <div data-ui="overlay-root"></div><div data-ui="tutorial-root"></div><div data-ui="achievement-root"></div><div data-ui="debug-root"></div><div data-ui="toast-root"></div>`;

  switchPanel(getActivePanel(), false);
  updateUI(true);
}

function setText(name: string, value: string): void {
  const element = app.querySelector<HTMLElement>(`[data-ui="${name}"]`);
  if (element && element.textContent !== value) element.textContent = value;
}

function setWidth(name: string, value: number): void {
  app.querySelector<HTMLElement>(`[data-ui="${name}"]`)?.style.setProperty('width', `${Math.max(0, Math.min(100, value))}%`);
}

// Punkt 8: Die Reaktionskarten werden gezielt in-place aktualisiert statt bei
// jedem Tick per innerHTML neu gebaut. Das Neubauen zerstörte den Hover- und
// Fokuszustand der Buttons und ließ sie beim Überfahren flackern; die Struktur
// des Panels ändert sich jetzt nur noch, wenn eine neue Reaktion freigeschaltet
// wird (siehe dynamicPanelSignature in updateUI).
function syncReactionPanel(): void {
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
      const tooltip = `${view.upgradeMax ? 'Maximum' : 'Ausbauen'} ${view.upgradeMax ? '—' : `${view.upgradePrice} E`}`;
      syncTileButton(upgradeButton, view.upgradeMax, true, view.upgradeAffordable, tooltip);
      const pips = card.querySelector<HTMLElement>(`[data-reaction-upgrade-levels="${id}"]`);
      const pipMarkup = levelPips(view.upgradeLevel, REACTION_UPGRADE.maxLevel);
      if (pips && pips.innerHTML !== pipMarkup) pips.innerHTML = pipMarkup;
      const cost = card.querySelector<HTMLElement>(`[data-reaction-upgrade-cost="${id}"]`);
      const costText = view.upgradeMax ? '—' : `${view.upgradePrice} E`;
      if (cost && cost.textContent !== costText) cost.textContent = costText;
    }
  });
}

// Punkt 3/4/6/7: Gemeinsame In-place-Aktualisierung für die Eck-Ausbaubuttons
// (Automationen, Upgrades, Reaktionsausbau). Icon/Zustandsklassen wechseln
// nur bei einem echten Zustandswechsel (Ausbaustufe erreicht Maximum,
// Voraussetzung erfüllt/verliert sich) — die reine Bezahlbarkeit (Energie
// reicht gerade so) wird dagegen bei jedem Tick aktualisiert, damit der
// Amber-Glow sofort an-/ausgeht.
function syncTileButton(button: HTMLButtonElement | null, complete: boolean, unlocked: boolean, affordable: boolean, tooltip: string): void {
  if (!button) return;
  button.disabled = !affordable;
  button.classList.toggle('is-buildable', affordable);
  const tileState = complete ? 'complete' : !unlocked ? 'locked' : 'open';
  if (button.dataset.tileState !== tileState) {
    button.classList.toggle('is-complete', complete);
    button.classList.toggle('is-locked', !complete && !unlocked);
    button.innerHTML = complete ? icons.check : !unlocked ? icons.lock : icons.buildUp;
    button.dataset.tileState = tileState;
  }
  if (button.title !== tooltip) { button.title = tooltip; button.setAttribute('aria-label', tooltip); }
}

function syncActivePanel(): void {
  const state = getState();
  const activePanel = getActivePanel();
  if (activePanel === 'reactions') syncReactionPanel();
  if (activePanel === 'upgrades') {
    orderedUpgradeCards().forEach(({ view }) => {
      const button = app.querySelector<HTMLButtonElement>(`[data-action="${view.definition.action}"]`);
      const affordable = !view.complete && view.unlocked && state.energy >= view.price;
      const tooltip = `${view.label} ${view.complete ? '—' : `${view.price} E`}`;
      syncTileButton(button, view.complete, view.unlocked, affordable, tooltip);
    });
  }
  if (activePanel === 'automation') {
    AUTOMATION_ORDER.filter(automationVisible).forEach((kind) => {
      const view = automationView(kind);
      const isMax = view.level >= view.max;
      const button = app.querySelector<HTMLButtonElement>(`[data-automation-card="${kind}"] button`);
      const affordable = !isMax && view.unlocked && state.energy >= view.price;
      const tooltip = `${isMax ? 'Maximum' : view.unlocked ? 'Ausbauen' : view.lockedLabel} ${isMax ? '—' : `${view.price} E`}`;
      syncTileButton(button, isMax, view.unlocked, affordable, tooltip);
      // Der Sperrgrund-Fortschritt (z. B. "998 / 1.500 C") wächst kontinuierlich
      // mit der Reaktionsleistung — anders als der Ausbaupreis muss dieser Text
      // daher bei jedem Tick aktualisiert werden, nicht erst beim Strukturrebuild.
      const cost = app.querySelector<HTMLElement>(`[data-automation-cost="${kind}"]`);
      const costText = isMax ? '—' : view.unlocked ? `${view.price} E` : view.lockedLabel;
      if (cost && cost.textContent !== costText) cost.textContent = costText;
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
  const starTotal = Math.max(1, mass);
  const currentCloudDefinition = cloudDefinition(state.cloudTier);
  const initialCloud = MATTER_KEYS.reduce((sum, key) => sum + currentCloudDefinition.matter[key], 0);
  const scale = temperatureScale(state.temperature);
  const nodes = timelineNodes();
  const stageIndex = Math.max(0, nodes.findIndex(([stage]) => stage === state.stage));
  const stageChanged = state.stage !== lastStage;

  setText('run', `ZYKLUS ${state.run.toString().padStart(2, '0')}`);
  setText('stardust', formatNumber(state.stardust));
  setText('elapsed', formatDuration(state.elapsed));
  setText('cloud-perk-name', cloudDefinition(state.perks.largerCloud).name);
  setText('gravity-perk-level', String(state.perks.permanentGravity));
  setText('fusion-perk-level', String(state.perks.fusionMemory));
  setText('objective-eyebrow', objective.eyebrow);
  setText('objective-title', objective.title);
  setText('objective-detail', objective.detail);
  setText('objective-percent', `${formatNumber(objective.progress, 1)}%`);
  setWidth('objective-bar', objective.progress);
  syncObjectiveAchievement(objective);
  setText('temperature', formatTemperature(state.temperature));
  setText('temperature-max', scale.label); app.querySelector<HTMLElement>('[data-ui="temperature-bar"]')?.style.setProperty('clip-path', `inset(0 ${100 - scale.progress}% 0 0)`);
  setText('mass', formatMatter(mass));
  setText('pressure', formatNumber(pressureProgress(state), 1));
  setText('energy', formatCompact(state.energy));
  setText('accretion-rate', formatMatter(accretionPerSecond(state)));
  DISPLAY_MATTER_KEYS.forEach((key) => {
    const percent = matterPercent(state.star[key], starTotal);
    setWidth(`${key}-bar`, percent);
    setText(`${key}-value`, `${formatMatter(state.star[key])} ME`);
    setText(`cloud-${key}`, formatMatter(state.cloud[key]));
    const coreElement = app.querySelector<HTMLElement>(`[data-matter="${key}"]`);
    const cloudElement = app.querySelector<HTMLElement>(`[data-cloud-matter="${key}"]`);
    if (coreElement) coreElement.hidden = state.star[key] <= 0 && currentCloudDefinition.matter[key] <= 0;
    if (cloudElement) cloudElement.hidden = currentCloudDefinition.matter[key] <= 0;
  });
  app.querySelectorAll<HTMLElement>('[data-auto-particle]').forEach((particle, index) => { particle.textContent = index % 5 !== 4 ? 'H' : 'He'; });
  setText('stage', STAGE_LABELS[state.stage]); setText('stage-detail', STAGES[state.stage].detail); setText('cloud-name', currentCloudDefinition.name);
  const star = app.querySelector<HTMLButtonElement>('.star-button');
  if (star) {
    star.className = `star-button stage-${state.stage}`;
    star.dataset.action = state.completed ? 'open-summary' : 'accrete';
    star.ariaLabel = state.completed ? 'Zyklus-Zusammenfassung öffnen' : 'Materie einsammeln';
    star.disabled = !state.completed && remaining <= 0;
  }
  const chamber = app.querySelector<HTMLElement>('.star-chamber');
  chamber?.style.setProperty('--star-scale', String(Math.min(1, Math.max(.1, mass / Math.max(1, initialCloud))))); chamber?.style.setProperty('--temp-scale', String(Math.min(1, state.temperature / THRESHOLDS.siliconTemperature)));
  chamber?.style.setProperty('--auto-accretion-duration', `${Math.max(1.45, 3.2 - state.automation.accretion * .2)}s`);
  chamber?.classList.toggle('has-auto-accretion', state.automation.accretion > 0 && !state.completed && remaining > 0);
  setText('click-yield', state.completed ? 'ZUSAMMENFASSUNG' : remaining <= 0 ? 'WOLKE ERSCHÖPFT' : `+${formatNumber(accretionPerClick(state))} ME`); setText('click-detail', state.completed ? 'Auf den Stern klicken zum Öffnen' : remaining <= 0 ? 'Entwicklung über Reaktionen fortsetzen' : 'Klicken, um Materie einzusammeln');
  app.querySelectorAll<HTMLElement>('[data-phase]').forEach((dot) => { const normalizedStage = nodes.length <= 1 ? 7 : Math.round(stageIndex / (nodes.length - 1) * 7); dot.classList.toggle('active', Number(dot.dataset.phase) <= normalizedStage); });
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
  // Karten existieren) — alle Werte darin aktualisiert syncReactionPanel()
  // in-place, ohne die Buttons neu zu bauen.
  const dynamicPanelSignature = activePanel === 'reactions'
    ? state.unlockedReactions.join(',')
    : activePanel === 'automation' ? `${state.unlockedReactions.join(',')}:${Object.values(state.automation).join(',')}` : '';
  const dynamicPanelChanged = dynamicPanelSignature !== lastDynamicPanelSignature;
  if (forcePanel || stageChanged || upgradeOrderChanged || dynamicPanelChanged) { const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(activePanel); lastStage = state.stage; lastUpgradeOrderSignature = currentUpgradeOrder; lastDynamicPanelSignature = dynamicPanelSignature; }
  syncNotifications(); syncActivePanel(); syncChronicleDock(); syncOverlay(); syncTutorial(); syncToast();
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
