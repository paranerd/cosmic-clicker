import {
  ACTIVE_WARNINGS,
  AUTOMATION_ORDER,
  DISPLAY_MATTER_KEYS,
  INITIAL_TEMPERATURE,
  MATTER_KEYS,
  REACTIONS,
  REACTION_ORDER,
  RESOURCES,
  STAGES,
  STAGE_LABELS,
  THRESHOLDS,
  CORE_COLLAPSE,
} from '../content';
import {
  accretionPerClick,
  accretionPerSecond,
  activeWarnings,
  collapseEjectionPerClick,
  cloudDefinition,
  cloudMass,
  objectiveFor,
  pressureProgress,
  reactionAvailable,
  starMass,
} from '../game/engine';
import { syncDebug } from './debug';
import { formatChamberValue, formatEnergy, formatMatter, formatNumber, formatRate, formatTemperature, icons, temperatureScale } from './format';
import { isCloudInfoOpen, isWarningsOpen, setCloudInfoOpen, setWarningsOpen } from './menus';
import { markOpportunitiesSeen, syncCycleEndNotice, syncNotifications, syncObjectiveAchievement, syncToast } from './notifications';
import { invalidateOverlay, isChronicleOpen, isSettingsOpen, openPanelPopup, syncOverlay } from './overlay';
import { app, getActivePanel, getState, isMobileLayout, PANEL_LABELS, PANEL_ORDER, setActivePanel, type Panel } from './store';
import { invalidateTutorial, syncTutorial } from './tutorial';
import {
  activePerksMarkup,
  automationView,
  automationVisible,
  currentOpportunities,
  fusionRingMarkup,
  knowledgeButton,
  panelMarkup,
  reactionView,
  REACTION_UNLOCK_PRICE_LABEL,
  tileButtonInner,
  unlockedReactionIds,
  upgradeOrderSignature,
  visibleUpgradeViews,
} from './views';

let lastStage = getState().stage;
let lastUpgradeOrderSignature = '';
let lastDynamicPanelSignature = '';
let lastFusionRingSignature = '';
const uiElements = new Map<string, HTMLElement>();

function dynamicPanelSignature(panel: Panel): string {
  const state = getState();
  // Der Upgrades-Bereich braucht hier keine eigene Signatur mehr: Seine
  // Struktur — inklusive der eingegliederten Fusionskacheln — steckt
  // vollständig in upgradeOrderSignature().
  if (panel === 'automation') {
    return `${state.unlockedReactions.join(',')}:${Object.values(state.automation).join(',')}:${AUTOMATION_ORDER.map((kind) => automationView(kind).unlocked).join(',')}`;
  }
  return '';
}

function rememberPanelStructure(panel: Panel): void {
  lastUpgradeOrderSignature = panel === 'upgrades' ? upgradeOrderSignature() : '';
  lastDynamicPanelSignature = dynamicPanelSignature(panel);
}

function realtimeDataMarkup(mirror = false): string {
  const ui = (name: string): string => mirror ? `data-ui-mirror="${name}"` : `data-ui="${name}"`;
  return `
    <section class="data-panel core-panel" data-tutorial="realtime-data">
      <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
      <div class="primary-reading"><span>Kerntemperatur${knowledgeButton('coreTemperature')}</span><b ${ui('temperature')}></b><div class="thermal-scale"><i ${ui('temperature-bar')}></i></div><small><span>${formatTemperature(INITIAL_TEMPERATURE)}</span><span ${ui('temperature-max')}></span></small></div>
      <div class="metric-grid"><div class="metric"><span>Sternmasse${knowledgeButton('starMass')}</span><b ${ui('mass')}></b><small>ME</small></div><div class="metric"><span>Kerndruck${knowledgeButton('corePressure')}</span><b ${ui('pressure')}></b><small>% Zünddruck</small></div><div class="metric energy-metric" data-tutorial="energy"><span>Energie${knowledgeButton('energy')}</span><b ${ui('energy')}></b><small>MeV</small></div><div class="metric"><span>Akkretion${knowledgeButton('accretion')}</span><b ${ui('accretion-rate')}></b><small>ME / Sek.</small></div></div>
      <div class="composition" data-tutorial="core-composition"><div class="section-label"><span>Kernzusammensetzung</span></div><div class="matter-elements core-elements">${DISPLAY_MATTER_KEYS.map((key) => `<div data-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><p><b>${RESOURCES[key].label}</b><strong ${ui(`${key}-value`)}></strong></p></div>`).join('')}</div></div>
    </section>`;
}

// Kontrollzentrum der Desktop-Fassung. Auf kleinen Bildschirmen entfällt es
// ersatzlos; seine Bereiche öffnet dort das Dock (siehe dockMarkup) in einem
// Popup, das dieselbe `[data-ui="deck-content"]`-Fläche mitbringt.
const controlCenterMarkup = (): string => `
        <aside class="action-sidepanel">
          <div class="sidepanel-heading">
            <div class="sidepanel-title"><span class="index">02</span><div><small>Kontrollzentrum</small><h2>Sternsysteme</h2></div></div>
            <div class="sidepanel-tools">
              <button data-action="open-chronicle" aria-label="Chronik öffnen" aria-haspopup="dialog">${icons.stats}</button>
              <button class="settings-button" data-action="open-settings" aria-label="Einstellungen öffnen" aria-haspopup="dialog">${icons.settings}</button>
            </div>
          </div>
          <div class="side-tabs" role="tablist" aria-label="Kontrollbereiche">${PANEL_ORDER.map((panel) => `<button data-panel="${panel}" role="tab"><span>${PANEL_LABELS[panel]}</span><b class="tab-count" data-tab-count="${panel}" hidden></b></button>`).join('')}</div>
          <div class="side-content" data-ui="deck-content"></div>
        </aside>`;

// Dock der mobilen Fassung: die beiden Kontrollbereiche als Popup-Öffner, in
// der Mitte die Sternkammer und rechts Chronik und Einstellungen, die
// dieselben Inhalte wie auf dem Desktop zeigen. Die Bereichsbuttons tragen
// dasselbe `data-panel` wie die Desktop-Reiter — der Gelegenheits-Indikator
// (syncNotifications) funktioniert dadurch unverändert für beide Fassungen.
const DOCK_PANEL_ICONS: Record<Panel, string> = {
  upgrades: icons.buildUp,
  automation: icons.automation,
};

// Effekte-Ecke unten rechts in der Sternenkammer: alles, was gerade dauerhaft
// oder akut auf den Stern wirkt. Links bleiben Echtzeitdaten und Urwolke, die
// den Zustand beschreiben; rechts steht, was ihn verändert. Beide Popover
// teilen sich die Ecke und schließen einander aus (siehe ui/menus.ts), damit
// sie sich auf schmalen Bildschirmen nicht überlagern. Der Warnungsbutton
// erscheint nur bei aktiven Warnungen, der Perk-Button dauerhaft — er zeigt
// auch mit Stufe 0 an, welche Vermächtnis-Effekte es überhaupt gibt.
const effectsCornerMarkup = (): string => `
          <div class="effects-corner" role="group" aria-label="Effekte">
            <div class="warning-corner" data-ui="warning-corner" hidden>
              <button class="warning-toggle" data-action="toggle-warnings" aria-label="Aktive Warnungen anzeigen" aria-expanded="false" aria-haspopup="true">${icons.warning}</button>
              <div class="warning-popover"><span class="warning-popover-title">Aktive Warnungen</span><div data-ui="warning-list"></div></div>
            </div>
            <div class="perk-corner" data-ui="perk-corner">
              <button class="perk-toggle" data-action="toggle-perks" aria-label="Aktive Perks anzeigen" aria-expanded="false" aria-haspopup="true">${icons.spark}</button>
              <section class="perk-popover" aria-label="Aktive Perks">
                <span class="perk-popover-kicker">Dauerhafte Effekte</span>
                <h2>Aktive Perks</h2>
                <div class="perk-list" data-ui="perk-list"></div>
                <p class="perk-popover-note">Neue Stufen wählst du am Ende eines Zyklus in der Zusammenfassung.</p>
              </section>
            </div>
          </div>`;

// Die Sternkammer steht bewusst in der Mitte und ist optisch hervorgehoben:
// Sie ist der Ausgangszustand, zu dem jedes geöffnete Dock-Blatt wieder
// zurückführt, und damit das einzige Dock-Element, das nichts öffnet sondern
// alles schließt.
const dockMarkup = (): string => `
      <nav class="mobile-dock" aria-label="Kontrollbereiche">
        ${PANEL_ORDER.map((panel) => `<button data-panel="${panel}" aria-haspopup="dialog" aria-label="${PANEL_LABELS[panel]} öffnen"><span class="dock-icon">${DOCK_PANEL_ICONS[panel]}</span><span class="dock-label">${PANEL_LABELS[panel]}</span><b class="tab-count" data-tab-count="${panel}" hidden></b></button>`).join('')}
        <button class="dock-chamber" data-action="show-chamber" aria-label="Sternkammer anzeigen"><span class="dock-icon">${icons.chamber}</span><span class="dock-label">Sternkammer</span></button>
        <button data-action="open-chronicle" aria-haspopup="dialog" aria-label="Chronik öffnen"><span class="dock-icon">${icons.stats}</span><span class="dock-label">Chronik</span></button>
        <button data-action="open-settings" class="settings-button" aria-haspopup="dialog" aria-label="Einstellungen öffnen"><span class="dock-icon">${icons.settings}</span><span class="dock-label">Settings</span></button>
      </nav>`;

export function renderShell(): void {
  // Die Shell ersetzt den kompletten Baum: alle Signaturen, die auf inzwischen
  // entfernte Knoten zeigen, müssen mit verworfen werden, damit Overlay,
  // Tutorial und Fusionsring danach wieder aufbauen.
  invalidateOverlay();
  invalidateTutorial();
  lastFusionRingSignature = '';
  const mobile = isMobileLayout();
  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <main>
      <section class="stellar-lab">
        <aside class="left-panel" data-tutorial="left-panel">
          ${realtimeDataMarkup()}
        </aside>

        <section class="star-chamber">
          <div class="chamber-resources" role="region" aria-label="Ressourcen">
            <div class="chamber-resource"><span>Temperatur</span><b data-ui="chamber-temperature"></b><small>K</small></div>
            <div class="chamber-resource"><span>Energie</span><b data-ui="chamber-energy"></b><small>MeV</small></div>
            <div class="chamber-resource"><span>Masse</span><b data-ui="chamber-mass"></b><small>ME</small></div>
          </div>
          <div class="stage-label"><span data-ui="stage"></span><b data-ui="stage-detail"></b></div>
          <div class="automation-particles" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i data-auto-particle="${index}">${index % 5 !== 4 ? 'H' : 'He'}</i>`).join('')}</div>
          <button class="star-button" data-action="accrete" data-tutorial="star" aria-label="Materie einsammeln"><span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span></button>
          <div class="fusion-ring" data-ui="fusion-ring" role="group" aria-label="Fusionen" hidden></div>
          <button class="click-callout" type="button" disabled><span data-ui="click-yield"></span><small data-ui="click-detail"></small></button>
          <button class="chamber-objective-progress" type="button" data-action="open-objective" data-tutorial="objective-progress" aria-label="Aktuelles Ziel öffnen" aria-haspopup="dialog">
            <span class="chamber-progress-track"><i data-ui="chamber-objective-bar"></i></span>
            <b data-ui="chamber-objective-percent"></b>
          </button>
          <div class="cloud-corner" data-ui="cloud-panel">
            <button class="cloud-toggle" data-action="toggle-cloud-info" aria-label="Informationen zur Urwolke anzeigen" aria-expanded="false" aria-haspopup="true">
              <i class="cloud-gauge-ring"></i><b data-ui="cloud-percent"></b>
            </button>
            <section class="cloud-popover" data-tutorial="matter-reservoir" aria-label="Informationen zur Urwolke">
              <span class="cloud-popover-kicker">Materiereservoir</span>
              <h2 data-ui="cloud-name">Urwolke</h2>
              <div class="cloud-summary"><div><span>Restmaterie</span><b data-ui="cloud-mass"></b><small data-ui="cloud-initial"></small></div></div>
              <div data-tutorial="cloud-composition"><div class="section-label cloud-composition-label"><span>Zusammensetzung</span></div><div class="matter-elements cloud-elements">${DISPLAY_MATTER_KEYS.map((key) => `<div data-cloud-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><p><b>${RESOURCES[key].label}</b><strong data-ui="cloud-${key}"></strong></p></div>`).join('')}</div></div>
            </section>
          </div>
          <div class="stellar-data-corner" data-ui="stellar-data-panel">
            <button class="stellar-data-toggle" data-action="toggle-stellar-data" aria-label="Stern-Echtzeitdaten anzeigen" aria-expanded="false" aria-haspopup="true">${icons.realtime}</button>
            <section class="stellar-data-popover" data-tutorial="left-panel" aria-label="Stern-Echtzeitdaten">
              ${realtimeDataMarkup(true)}
            </section>
          </div>
          ${effectsCornerMarkup()}
        </section>

        ${mobile ? '' : controlCenterMarkup()}
      </section>
      ${mobile ? dockMarkup() : ''}
    </main>

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
  app.querySelectorAll<HTMLElement>(`[data-ui-mirror="${name}"]`).forEach((mirror) => {
    if (mirror.textContent !== value) mirror.textContent = value;
  });
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
    // Noch nicht gezündete Fusion: Der Eck-Button ist der kostenlose
    // Freischalter. Temperatur und Masse wachsen laufend, deshalb müssen Fill
    // und Sperrgrund bei jedem Tick nachgeführt werden — der Wechsel zu
    // "freischaltbar" selbst steckt in der Panel-Signatur und baut die Kachel
    // ohnehin neu.
    const unlockButton = card.querySelector<HTMLButtonElement>('[data-action="unlock-reaction"]');
    if (unlockButton) {
      const ariaLabel = view.unlockable ? `${REACTIONS[id].fullTitle} kostenlos freischalten` : view.lockedLabel;
      syncTileButton(unlockButton, false, view.unlockable, true, view.unlockable, view.unlockProgress * 100, view.unlockable ? REACTION_UNLOCK_PRICE_LABEL : '', ariaLabel);
      const cost = card.querySelector<HTMLElement>(`[data-reaction-cost="${id}"]`);
      const costLabel = view.unlockable ? 'Kostenlos freischalten' : view.lockedLabel;
      if (cost) {
        if (cost.textContent !== costLabel) cost.textContent = costLabel;
        cost.classList.toggle('is-ready', view.unlockable);
      }
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

// Fusionsring unter dem Stern: Die Buttons selbst werden nur neu gebaut, wenn
// eine weitere Reaktion freigeschaltet wird (dann ändert sich die Ringgeometrie
// aller Buttons). Auswahl- und Brennstoffzustand wechseln dagegen laufend und
// werden deshalb in-place an den bestehenden Buttons aktualisiert — genau wie
// bei den Kacheln, damit Hover und Fokus erhalten bleiben.
function syncFusionRing(): void {
  const state = getState();
  const ring = uiElement('fusion-ring');
  if (!ring) return;
  const ids = unlockedReactionIds();
  ring.hidden = ids.length === 0 || state.completed;
  const signature = ids.join(',');
  if (signature !== lastFusionRingSignature) {
    ring.innerHTML = fusionRingMarkup(ids);
    lastFusionRingSignature = signature;
  }
  ids.forEach((id) => {
    const button = ring.querySelector<HTMLButtonElement>(`[data-fusion-ring-button="${id}"]`);
    if (!button) return;
    const active = state.activeReaction === id;
    button.classList.toggle('is-active', active);
    button.classList.toggle('is-empty', !reactionAvailable(state, id));
    const pressed = String(active);
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    const ariaLabel = `${REACTIONS[id].fullTitle} ${active ? 'abwählen' : 'auswählen'}`;
    if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
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
  const panelResource = app.querySelector<HTMLElement>('[data-panel-resource]');
  if (panelResource) {
    const value = formatEnergy(state.energy);
    if (panelResource.textContent !== value) panelResource.textContent = value;
  }
  // Der Upgrades-Bereich enthält beide Kachelarten: klassische Upgrades und
  // die eingegliederten Fusionen.
  if (activePanel === 'upgrades') {
    syncReactionPanel();
    visibleUpgradeViews().forEach((view) => {
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
  if (cloudPanel) {
    cloudPanel.hidden = remaining <= .001;
    if (remaining <= .001 && isCloudInfoOpen()) setCloudInfoOpen(false);
  }

  setText('chamber-objective-percent', `${formatNumber(objective.progress, 1)}%`);
  setWidth('chamber-objective-bar', objective.progress);
  syncObjectiveAchievement(objective);
  setText('temperature', formatTemperature(state.temperature));
  setText('chamber-temperature', formatChamberValue(state.temperature));
  setText('temperature-max', scale.label);
  app.querySelectorAll<HTMLElement>('[data-ui="temperature-bar"], [data-ui-mirror="temperature-bar"]').forEach((bar) => {
    bar.style.setProperty('clip-path', `inset(0 ${100 - scale.progress}% 0 0)`);
  });
  setText('mass', formatMatter(mass));
  setText('chamber-mass', formatChamberValue(Math.round(mass)));
  setText('pressure', formatNumber(pressureProgress(state), 1));
  setText('energy', formatEnergy(state.energy));
  // Wie formatEnergy immer abgerundet, damit die große Anzeige im Mittelpanel
  // nicht früher als die Kachelpreise auf den nächsten Wert springt.
  setText('chamber-energy', formatChamberValue(Math.floor(Math.max(0, state.energy))));
  setText('accretion-rate', formatMatter(accretionPerSecond(state)));
  DISPLAY_MATTER_KEYS.forEach((key) => {
    setText(`${key}-value`, `${formatMatter(state.star[key])} ME`);
    setText(`cloud-${key}`, formatMatter(state.cloud[key]));
    const cloudElement = app.querySelector<HTMLElement>(`[data-cloud-matter="${key}"]`);
    app.querySelectorAll<HTMLElement>(`[data-matter="${key}"]`).forEach((coreElement) => {
      coreElement.hidden = state.star[key] <= 0 && currentCloudDefinition.matter[key] <= 0;
    });
    if (cloudElement) cloudElement.hidden = currentCloudDefinition.matter[key] <= 0;
  });
  setText('stage', STAGE_LABELS[state.stage]); setText('stage-detail', STAGES[state.stage].detail); setText('cloud-name', currentCloudDefinition.name);
  // Der Stern ist die einzige Ausführungsstelle für Fusionen: Solange über den
  // Fusionsring eine Reaktion ausgewählt ist, löst ein Klick auf den Stern
  // genau diese Reaktion aus statt zu akkretieren. Fehlt der Brennstoff, bleibt
  // die Auswahl bestehen und der Stern ist deaktiviert (statt still auf
  // Akkretion zurückzufallen) — der Callout darunter nennt den Grund.
  const activeReaction = state.activeReaction !== null && state.unlockedReactions.includes(state.activeReaction)
    ? state.activeReaction
    : null;
  const activeReactionView = activeReaction ? reactionView(activeReaction) : null;
  // Während des Kernkollapses übernimmt der Stern eine dritte Aufgabe: Jeder
  // Klick stößt Hülle ab. Die Phase läuft auch ohne Zutun vollständig durch —
  // der Klick ist ein Bonus, keine Bedingung.
  const collapsing = !state.completed && state.stage === 'supernova';
  const star = app.querySelector<HTMLButtonElement>('.star-button');
  if (star) {
    star.className = `star-button stage-${state.stage}${state.completed ? ' is-complete' : ''}`;
    if (state.completed) delete star.dataset.action;
    else star.dataset.action = collapsing ? 'eject-envelope' : activeReaction ? 'run-reaction' : 'accrete';
    if (activeReaction && !state.completed && !collapsing) star.dataset.reaction = activeReaction;
    else delete star.dataset.reaction;
    star.ariaLabel = state.completed ? 'Abgeschlossener Stern'
      : collapsing ? 'Hülle abstoßen'
        : activeReaction ? `${REACTIONS[activeReaction].fullTitle} auslösen`
          : 'Materie einsammeln';
    star.disabled = state.completed ? false
      : collapsing ? collapseEjectionPerClick(state) <= 0
        : activeReactionView ? !activeReactionView.available : remaining <= 0;
    if (state.completed) star.disabled = true;
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
  // Der Hinweis unter dem Stern beschreibt immer genau die Aktion, die ein
  // Klick auf den Stern gerade auslöst. Bei ausgewählter Fusion übernimmt er
  // damit auch die dynamische Reaktionsgleichung, die vorher im Fusionsbutton
  // der Kachel stand.
  const [clickYield, clickDetail] = state.completed ? ['ZUSAMMENFASSUNG', 'Hier klicken zum Öffnen']
    : collapsing ? collapseEjectionPerClick(state) > 0
      ? [`KERNKOLLAPS · ${Math.max(0, Math.ceil(CORE_COLLAPSE.seconds - state.collapseElapsed))} s`, 'Klicken, um Hülle abzustoßen']
      : ['KERNKOLLAPS', 'Hülle vollständig abgestoßen']
    : activeReactionView ? activeReactionView.available
      ? [activeReactionView.detail, 'Klicken, um zu fusionieren']
      : ['KEIN BRENNSTOFF', 'Andere Fusion wählen oder Brennstoff aufbauen']
      : remaining <= 0 ? ['WOLKE ERSCHÖPFT', unlockedReactionIds().length ? 'Fusion unter dem Stern auswählen' : 'Entwicklung über Reaktionen fortsetzen']
        : [`+${formatNumber(accretionPerClick(state))} ME`, 'Klicken, um Materie einzusammeln'];
  setText('click-yield', clickYield); setText('click-detail', clickDetail);
  const cloudPercent = remaining / initialCloud * 100; setText('cloud-percent', `${formatNumber(cloudPercent, 1)}%`); setText('cloud-mass', `${formatMatter(remaining)} ME`); setText('cloud-initial', `von ${formatMatter(initialCloud)} ME`); app.querySelector<HTMLElement>('.cloud-gauge-ring')?.style.setProperty('--remaining', `${cloudPercent / 100 * 360}deg`);
  // Punkt 4: Warnsymbol links unten in der Star Chamber, sobald mindestens
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
  // Perkstufen ändern sich nur beim Zyklusstart; der Vergleich hält die Liste
  // trotzdem ohne eigene Signatur aktuell — sie ist kurz und wird nur beim
  // tatsächlichen Wechsel neu gebaut.
  const perkList = app.querySelector<HTMLElement>('[data-ui="perk-list"]');
  const perkMarkup = activePerksMarkup();
  if (perkList && perkList.innerHTML !== perkMarkup) perkList.innerHTML = perkMarkup;
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
  const currentDynamicPanelSignature = dynamicPanelSignature(activePanel);
  const dynamicPanelChanged = currentDynamicPanelSignature !== lastDynamicPanelSignature;
  if (forcePanel || stageChanged || upgradeOrderChanged || dynamicPanelChanged) { const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(activePanel); lastStage = state.stage; lastUpgradeOrderSignature = currentUpgradeOrder; lastDynamicPanelSignature = currentDynamicPanelSignature; }
  syncFusionRing(); syncNotifications(visiblePanel()); syncActivePanel(); syncOverlay(); syncDock(); syncCycleEndNotice(); syncTutorial(); syncToast();
  if (import.meta.hot) syncDebug();
}

// Dock-Zustand: Im Dock markiert `.active` nicht den zuletzt gewählten
// Bereich, sondern das gerade geöffnete Blatt — anders als bei den
// Desktop-Reitern, wo immer genau ein Bereich sichtbar ist. Ist nichts
// geöffnet, leuchtet die Sternkammer, denn genau die ist dann zu sehen.
export function syncDock(): void {
  const dock = app.querySelector<HTMLElement>('.mobile-dock');
  if (!dock) return;
  const popup = openPanelPopup();
  const chronicle = isChronicleOpen();
  const settings = isSettingsOpen();
  dock.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const panel = button.dataset.panel as Panel | undefined;
    const action = button.dataset.action;
    const active = panel ? popup === panel
      : action === 'open-chronicle' ? chronicle
        : action === 'open-settings' ? settings
          : action === 'show-chamber' ? !popup && !chronicle && !settings
            : false;
    button.classList.toggle('active', active);
    if (action !== 'show-chamber') button.setAttribute('aria-expanded', String(active));
  });
}

export function switchPanel(panel: Panel, markSeen = true): void {
  setActivePanel(panel);
  // Die Dock-Buttons tragen dasselbe `data-panel`, folgen aber ihrem eigenen
  // Zustand (siehe syncDock) und bleiben hier deshalb unangetastet.
  app.querySelectorAll<HTMLButtonElement>('.side-tabs [data-panel]').forEach((button) => { const active = button.dataset.panel === panel; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(panel);
  // Der nächste UI-Tick darf das soeben gerenderte Panel nicht direkt erneut
  // ersetzen. Andernfalls zeigen die gespeicherten Signaturen noch auf den
  // vorherigen Tab und bereits gefundene DOM-Knoten werden kurz nach dem
  // Wechsel wieder abgelöst.
  rememberPanelStructure(panel);
  syncActivePanel();
  if (markSeen) markOpportunitiesSeen(panel, currentOpportunities());
  syncNotifications(visiblePanel());
  syncDock();
}

// Sichtbarer Bereich: auf dem Desktop immer der gewählte Reiter, auf kleinen
// Bildschirmen nur ein tatsächlich geöffnetes Dock-Blatt (siehe
// syncNotifications).
const visiblePanel = (): Panel | null => isMobileLayout() ? openPanelPopup() : getActivePanel();
