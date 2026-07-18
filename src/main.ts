import './styles.scss';
import { LIMITS, STAGE_LABELS, THRESHOLDS } from './game/config';
import {
  accretionCost,
  accretionPerClick,
  accretionPerSecond,
  calculateTemperature,
  cloudMass,
  createInitialState,
  fusionCost,
  fusionPerSecond,
  gravityCost,
  objectiveFor,
  pressureProgress,
  reduceGame,
  starMass,
  tick,
} from './game/engine';
import { clearSave, loadGame, saveGame } from './game/storage';
import type { GameAction, GameState } from './game/types';

type Panel = 'reactions' | 'upgrades' | 'automation' | 'legacy' | 'chronicle';
type ResetMode = 'run' | 'full';

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root missing');

const loaded = loadGame();
let state = loaded.state;
let activePanel: Panel = 'reactions';
let lastFrame = performance.now();
let lastUiUpdate = 0;
let lastStage = state.stage;
let lastLogSignature = '';
let lastUnreadSignature = '';
let toast = loaded.offlineSeconds >= 60
  ? `Während deiner Abwesenheit liefen ${formatDuration(loaded.offlineSeconds)} Simulation.`
  : '';
let toastTimer = 0;
let resetMenuOpen = false;
let fullResetArmed = false;
let resetTimer = 0;
let overlaySignature = '';

const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>',
  atom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m16 10 5 5m0-5-5 5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 19h16"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5"/><path d="M5.4 16a8 8 0 1 0 .5-9L4 9"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
};

const formatNumber = (value: number, maximumFractionDigits = 0): string =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits }).format(Math.max(0, value));

const formatCompact = (value: number): string => value < 1_000
  ? formatNumber(value)
  : new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function formatTemperature(value: number): string {
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)} Mio. K`;
  return `${formatNumber(value, value < 100_000 ? 1 : 0)} K`;
}

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const matterPercent = (value: number, total: number): number => total <= 0 ? 0 : value / total * 100;
const disabled = (condition: boolean): string => condition ? 'disabled aria-disabled="true"' : '';
const progress = (value: number, cost: number, unlocked = true): number => unlocked ? Math.min(100, value / cost * 100) : 0;

function temperatureScale(value: number): { max: number; label: string; progress: number } {
  const stops = [1_000_000, 10_000_000, 25_000_000, 100_000_000, 1_000_000_000];
  const max = stops.find((stop) => value <= stop) ?? 10 ** Math.ceil(Math.log10(value));
  return { max, label: formatTemperature(max), progress: Math.min(100, value / max * 100) };
}

function levelPips(level: number, max: number): string {
  return Array.from({ length: max }, (_, index) => `<i class="level-pip ${index < level ? 'is-filled' : ''}"></i>`).join('');
}

function currentOpportunities(): Record<'upgrades' | 'automation', string[]> {
  const upgrades: string[] = [];
  const automation: string[] = [];
  if (state.upgrades.gravity < LIMITS.gravity && state.energy >= gravityCost(state.upgrades.gravity)) {
    upgrades.push(`gravity:${state.upgrades.gravity}`);
  }
  if (state.automation.accretion < LIMITS.accretion && starMass(state) >= THRESHOLDS.protostarMass && state.energy >= accretionCost(state.automation.accretion)) {
    automation.push(`accretion:${state.automation.accretion}`);
  }
  if (state.automation.fusion < LIMITS.fusion && state.manualFusions >= 5 && state.energy >= fusionCost(state.automation.fusion)) {
    automation.push(`fusion:${state.automation.fusion}`);
  }
  return { upgrades, automation };
}

function renderReactionPanel(): string {
  return `
    <div class="reaction-grid">
      <div class="action-card" data-card="deuterium">
        <div class="reaction-symbol deuterium">D</div>
        <div class="action-copy"><span class="card-kicker">Protostern-Reaktion</span><h3>Deuteriumbrennen</h3><p>Eine begrenzte Brennphase. Wandelt 2 D um und gibt dem Kern kurzzeitig Wärme.</p><div class="reaction-equation"><span>²H + ²H</span><b>→</b><span>He + Energie</span></div></div>
        <button class="secondary-action" data-action="burn-deuterium"><span data-button-label>Zünden</span><small>+170.000 K · +36 E</small></button>
      </div>
      <div class="action-card" data-card="fusion">
        <div class="reaction-symbol hydrogen">H</div>
        <div class="action-copy"><span class="card-kicker">Kernfusion</span><h3>Proton-Proton-Kette</h3><p>Wasserstoff verschmilzt zu Helium. Ein kleiner Massendefekt wird zu Energie.</p><div class="reaction-equation"><span>4 H</span><b>→</b><span>He + γ</span></div></div>
        <button class="primary-action compact" data-action="fuse-hydrogen"><span data-button-label>200 H fusionieren</span><small data-button-detail>+68 Energie</small></button>
      </div>
    </div>`;
}

function upgradeCard(): string {
  const price = gravityCost(state.upgrades.gravity);
  const isMax = state.upgrades.gravity >= LIMITS.gravity;
  return `
    <article class="upgrade-card featured">
      <div class="upgrade-top"><span class="upgrade-icon">G</span><span class="tag">Upgrade</span></div>
      <h3>Gravitative Verdichtung</h3><p>Mehr Materie pro Impuls und pro Sekunde. Jede Stufe erhöht die aktive und automatische Akkretion um 55 %.</p>
      <div class="upgrade-effect"><span>Aktueller Multiplikator</span><b data-ui="gravity-multiplier">×1,00</b></div>
      <div class="level-row" data-levels="gravity">${levelPips(state.upgrades.gravity, LIMITS.gravity)}</div>
      <button class="progress-button" data-action="buy-gravity" style="--button-progress:${progress(state.energy, price)}%" ${disabled(state.energy < price || isMax)}><i></i><span data-button-label>${isMax ? 'Maximum' : 'Verdichten'}</span><b data-button-cost>${isMax ? '—' : `${price} E`}</b></button>
    </article>`;
}

function automationCard(kind: 'accretion' | 'fusion'): string {
  const isAccretion = kind === 'accretion';
  const level = state.automation[kind];
  const max = isAccretion ? LIMITS.accretion : LIMITS.fusion;
  const price = isAccretion ? accretionCost(level) : fusionCost(level);
  const unlocked = isAccretion ? starMass(state) >= THRESHOLDS.protostarMass : state.manualFusions >= 5;
  const isMax = level >= max;
  const label = isMax ? 'Maximum' : !unlocked ? (isAccretion ? 'Noch instabil' : `${state.manualFusions}/5 Reaktionen`) : 'Ausbauen';
  return `
    <article class="upgrade-card" data-automation-card="${kind}">
      <div class="upgrade-top"><span class="upgrade-icon">${isAccretion ? 'A' : 'H'}</span><span class="tag">Automation</span></div>
      <h3>${isAccretion ? 'Akkretionsstrom' : 'Stabiler pp-Zyklus'}</h3>
      <p>${isAccretion ? 'Zieht kontinuierlich Materie aus der Wolke. Benötigt einen ausgebildeten Protostern.' : 'Fusioniert Wasserstoff automatisch. Wird nach fünf manuellen Reaktionen verfügbar.'}</p>
      <div class="level-row">${levelPips(level, max)}</div>
      <button class="progress-button" data-action="${isAccretion ? 'buy-accretion' : 'buy-fusion'}" style="--button-progress:${progress(state.energy, price, unlocked)}%" ${disabled(state.energy < price || !unlocked || isMax)}><i></i><span data-button-label>${label}</span><b data-button-cost>${isMax ? '—' : `${price} E`}</b></button>
    </article>`;
}

function renderLegacyPanel(): string {
  return `
    <div class="legacy-layout">
      <div class="perk-path">
        <article class="perk-card is-unlocked"><span class="perk-orbit">01</span><h3>Reichere Urwolke</h3><p>Vergrößert die nächste Gaswolke permanent um 25 %.</p><strong>Stufe ${state.perks.largerCloud}</strong></article>
        <div class="path-line"></div>
        <article class="perk-card is-unlocked"><span class="perk-orbit">02</span><h3>Gravitatives Gedächtnis</h3><p>Erhöht künftige Akkretionsraten permanent um 12 %.</p><strong>Stufe ${state.perks.permanentGravity}</strong></article>
      </div>
      <aside class="save-management"><span class="card-kicker">Kosmisches Vermächtnis</span><h3>Bereit für den nächsten Zyklus</h3><p>Neue Perks werden direkt am Ende eines Zyklus mit Sternenstaub gekauft. Hier bleibt dein permanenter Fortschritt jederzeit sichtbar.</p></aside>
    </div>`;
}

function timelineMarkup(): string {
  const stageIndex = ['nebula', 'protostar', 'deuterium', 'hydrogen', 'stable'].indexOf(state.stage);
  const nodes = [
    ['nebula', 'Gaswolke', 'Materie sammeln'], ['protostar', 'Protostern', 'Kern verdichten'], ['deuterium', 'D-Brennen', '1 Mio. K'], ['hydrogen', 'pp-Kette', '10 Mio. K'], ['stable', 'Hauptreihe', 'Gleichgewicht'],
  ];
  return nodes.map(([key, label, detail], index) => `<div class="timeline-node ${index <= stageIndex ? 'done' : ''} ${key === state.stage ? 'current' : ''}"><i>${index < stageIndex ? '✓' : index + 1}</i><span><b>${label}</b><small>${detail}</small></span></div>`).join('');
}

function renderChroniclePanel(): string {
  return `
    <div class="chronicle-layout">
      <div class="timeline-card"><div class="section-label"><span>Stellare Entwicklung</span><small>VERTICAL SLICE 01</small></div><div class="timeline" data-ui="timeline">${timelineMarkup()}</div><div class="future-strip"><span>C</span><i></i><span>O</span><i></i><span>Ne</span><i></i><span>Si</span><i></i><span>Fe</span><p>Spätere Entwicklungsphasen</p></div></div>
      <div class="log-card"><div class="section-label"><span>Sternenlogbuch</span><small>LIVE</small></div><div class="log-list" data-ui="log-list">${logMarkup()}</div></div>
    </div>`;
}

function logMarkup(): string {
  return state.log.slice(0, 5).map((entry) => `<div class="log-entry ${entry.kind}"><i></i><p>${entry.text}</p></div>`).join('');
}

function panelMarkup(panel: Panel): string {
  if (panel === 'reactions') return renderReactionPanel();
  if (panel === 'upgrades') return `<div class="upgrade-grid single-upgrade">${upgradeCard()}</div>`;
  if (panel === 'automation') return `<div class="upgrade-grid automation-grid">${automationCard('accretion')}${automationCard('fusion')}</div>`;
  if (panel === 'legacy') return renderLegacyPanel();
  return renderChroniclePanel();
}

function renderShell(): void {
  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Cosmic Clicker Startseite"><span class="brand-mark">${icons.spark}</span><span><b>COSMIC</b><em>CLICKER</em></span></a>
      <div class="run-status"><i></i><span>SIMULATION AKTIV</span><b data-ui="run">ZYKLUS 01</b></div>
      <div class="header-actions"><div class="resource-chip" title="Bleibt nach einem Neustart erhalten"><span>✦</span><div><small>Sternenstaub</small><b data-ui="stardust">0</b></div></div><button class="icon-button" data-action="toggle-sound" aria-label="Ton ausschalten">${icons.sound}</button><button class="icon-button export-button" data-action="export" aria-label="Spielstand exportieren">${icons.download}</button><div class="reset-control"><button class="icon-button reset-button" data-action="reset-menu" aria-label="Neustartoptionen öffnen">${icons.reset}</button><div class="reset-choices"><button data-action="reset-run">Runde neu starten</button><button data-action="reset-full"><span data-full-reset-label>Spielstand löschen</span></button></div></div></div>
    </header>

    <main>
      <section class="mission-strip"><div class="mission-copy"><span data-ui="objective-eyebrow"></span><h2 data-ui="objective-title"></h2><p data-ui="objective-detail"></p></div><div class="mission-progress"><div class="progress-label"><span>Fortschritt</span><b data-ui="objective-percent"></b></div><div class="progress-track"><i data-ui="objective-bar"></i></div></div><div class="elapsed"><span>Laufzeit</span><b data-ui="elapsed"></b></div></section>

      <section class="stellar-lab">
        <aside class="data-panel left-panel">
          <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
          <div class="primary-reading"><span>Kerntemperatur</span><b data-ui="temperature"></b><div class="thermal-scale"><i data-ui="temperature-bar"></i></div><small><span>2.700 K</span><span data-ui="temperature-max"></span></small></div>
          <div class="metric-grid"><div class="metric"><span>Sternmasse</span><b data-ui="mass"></b><small>ME</small></div><div class="metric"><span>Kerndruck</span><b data-ui="pressure"></b><small>% Zünddruck</small></div><div class="metric"><span>Energie</span><b data-ui="energy"></b><small>verfügbar</small></div><div class="metric"><span>Akkretion</span><b data-ui="accretion-rate"></b><small>ME / Sek.</small></div></div>
          <div class="composition"><div class="section-label"><span>Kernzusammensetzung</span><small data-ui="core-total"></small></div>${['hydrogen','helium','deuterium'].map((key) => `<div class="composition-row"><span class="element ${key === 'hydrogen' ? 'h' : key === 'helium' ? 'he' : 'd'}">${key === 'hydrogen' ? 'H' : key === 'helium' ? 'He' : 'D'}</span><div><b>${key === 'hydrogen' ? 'Wasserstoff' : key === 'helium' ? 'Helium' : 'Deuterium'}</b><div class="mini-track"><i data-ui="${key}-bar"></i></div></div><strong data-ui="${key}-value"></strong></div>`).join('')}</div>
        </aside>

        <section class="star-chamber">
          <div class="stage-label"><span data-ui="stage"></span><b data-ui="stage-detail"></b></div><div class="orbit orbit-outer"><span></span><span></span></div><div class="orbit orbit-inner"><span></span></div>
          <button class="star-button" data-action="accrete" aria-label="Materie akkretieren"><span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span></button>
          <div class="click-callout"><span data-ui="click-yield"></span><small data-ui="click-detail"></small></div><div class="phase-dots">${Array.from({length:5},(_, index)=>`<i data-phase="${index}"></i>`).join('')}</div>
        </section>

        <aside class="data-panel right-panel">
          <div class="panel-heading"><span class="index">02</span><div><small>Reservoir</small><h2>Urwolke</h2></div></div>
          <div class="cloud-gauge"><div class="gauge-ring"><div><b data-ui="cloud-percent"></b><small>verfügbar</small></div></div><div><span>Restmaterie</span><b data-ui="cloud-mass"></b><small data-ui="cloud-initial"></small></div></div>
          <div class="reservoir-list">${['hydrogen','helium','deuterium'].map((key) => `<div><span class="element ${key === 'hydrogen' ? 'h' : key === 'helium' ? 'he' : 'd'}">${key === 'hydrogen' ? 'H' : key === 'helium' ? 'He' : 'D'}</span><p><b>${key === 'hydrogen' ? 'Wasserstoff' : key === 'helium' ? 'Helium' : 'Deuterium'}</b><small>${key === 'hydrogen' ? '74,9 % initial' : key === 'helium' ? '25,0 % initial' : 'Spurenelement'}</small></p><strong data-ui="cloud-${key}"></strong></div>`).join('')}</div>
          <div class="rate-card"><span>${icons.atom}</span><div><small>Automatische Akkretion</small><b data-ui="auto-accretion"></b></div><i data-ui="auto-status"></i></div>
          <div class="science-note"><span>WISSENSKERN</span><p>Ein Protostern leuchtet schon vor der Fusion: Seine Strahlung entsteht zunächst durch gravitative Kontraktion.</p></div>
        </aside>
      </section>

      <section class="control-deck">
        <div class="deck-tabs" role="tablist" aria-label="Kontrollbereiche">
          ${([['reactions','Reaktionen'],['upgrades','Upgrades'],['automation','Automationen'],['legacy','Vermächtnis'],['chronicle','Chronik']] as [Panel,string][]).map(([panel,label])=>`<button data-panel="${panel}" role="tab"><span>${label}</span><b class="tab-count" data-tab-count="${panel}"></b><i class="notice-dot" data-notice="${panel}"></i></button>`).join('')}
        </div><div class="deck-content" data-ui="deck-content"></div>
      </section>
    </main>

    <footer><span>COSMIC CLICKER · PROTOTYP 0.2</span><p>Wissenschaftlich plausibel · spielerisch komprimiert</p><button data-action="import">Spielstand importieren</button><input id="save-import" type="file" accept="application/json" hidden /></footer>
    <div data-ui="overlay-root"></div><div data-ui="toast-root"></div>`;

  switchPanel(activePanel, false);
  updateUI(true);
}

function setText(name: string, value: string): void {
  const element = app.querySelector<HTMLElement>(`[data-ui="${name}"]`);
  if (element && element.textContent !== value) element.textContent = value;
}

function setWidth(name: string, value: number): void {
  app.querySelector<HTMLElement>(`[data-ui="${name}"]`)?.style.setProperty('width', `${Math.max(0, Math.min(100, value))}%`);
}

function syncReactionPanel(): void {
  const dButton = app.querySelector<HTMLButtonElement>('[data-action="burn-deuterium"]');
  const hButton = app.querySelector<HTMLButtonElement>('[data-action="fuse-hydrogen"]');
  if (!dButton || !hButton) return;
  const canD = state.temperature >= THRESHOLDS.deuteriumTemperature && state.star.deuterium >= 2 && !state.completed;
  const canH = state.temperature >= THRESHOLDS.hydrogenTemperature && state.star.hydrogen >= 200 && !state.completed;
  dButton.disabled = !canD;
  dButton.querySelector('[data-button-label]')!.textContent = canD ? 'Zünden' : state.temperature < THRESHOLDS.deuteriumTemperature ? 'Ab 1 Mio. K' : 'Kein D verfügbar';
  hButton.disabled = !canH;
  hButton.querySelector('[data-button-label]')!.textContent = state.temperature >= THRESHOLDS.hydrogenTemperature ? '200 H fusionieren' : 'Ab 10 Mio. K';
  hButton.querySelector('[data-button-detail]')!.textContent = state.temperature >= THRESHOLDS.hydrogenTemperature ? '+68 Energie' : 'Kern noch zu kalt';
  dButton.closest('.action-card')?.classList.toggle('is-ready', canD);
  hButton.closest('.action-card')?.classList.toggle('is-ready', canH);
}

function syncProgressButton(action: string, price: number, unlocked: boolean, isMax: boolean, label: string): void {
  const button = app.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (!button) return;
  button.style.setProperty('--button-progress', `${progress(state.energy, price, unlocked)}%`);
  button.disabled = !unlocked || state.energy < price || isMax;
  button.querySelector('[data-button-label]')!.textContent = isMax ? 'Maximum' : label;
  button.querySelector('[data-button-cost]')!.textContent = isMax ? '—' : `${price} E`;
}

function syncActivePanel(): void {
  if (activePanel === 'reactions') syncReactionPanel();
  if (activePanel === 'upgrades') {
    syncProgressButton('buy-gravity', gravityCost(state.upgrades.gravity), true, state.upgrades.gravity >= LIMITS.gravity, 'Verdichten');
    setText('gravity-multiplier', `×${formatNumber(1 + state.upgrades.gravity * .55 + state.perks.permanentGravity * .12, 2)}`);
  }
  if (activePanel === 'automation') {
    syncProgressButton('buy-accretion', accretionCost(state.automation.accretion), starMass(state) >= THRESHOLDS.protostarMass, state.automation.accretion >= LIMITS.accretion, starMass(state) >= THRESHOLDS.protostarMass ? 'Ausbauen' : 'Noch instabil');
    syncProgressButton('buy-fusion', fusionCost(state.automation.fusion), state.manualFusions >= 5, state.automation.fusion >= LIMITS.fusion, state.manualFusions >= 5 ? 'Ausbauen' : `${state.manualFusions}/5 Reaktionen`);
  }
  if (activePanel === 'chronicle') {
    const signature = `${state.stage}:${state.log.map((entry) => entry.id).join(',')}`;
    if (signature !== lastLogSignature) {
      const timeline = app.querySelector<HTMLElement>('[data-ui="timeline"]');
      const logList = app.querySelector<HTMLElement>('[data-ui="log-list"]');
      if (timeline) timeline.innerHTML = timelineMarkup();
      if (logList) logList.innerHTML = logMarkup();
      lastLogSignature = signature;
    }
  }
}

function syncNotifications(): void {
  const opportunities = currentOpportunities();
  if (activePanel === 'upgrades') opportunities.upgrades.forEach((key) => { if (!state.seenOpportunities.includes(key)) state.seenOpportunities.push(key); });
  if (activePanel === 'automation') opportunities.automation.forEach((key) => { if (!state.seenOpportunities.includes(key)) state.seenOpportunities.push(key); });
  const unread = {
    upgrades: opportunities.upgrades.filter((key) => !state.seenOpportunities.includes(key)),
    automation: opportunities.automation.filter((key) => !state.seenOpportunities.includes(key)),
  };
  (['upgrades', 'automation'] as const).forEach((panel) => {
    const button = app.querySelector<HTMLButtonElement>(`[data-panel="${panel}"]`);
    const dot = app.querySelector<HTMLElement>(`[data-notice="${panel}"]`);
    button?.classList.toggle('has-notice', unread[panel].length > 0);
    if (dot) dot.textContent = unread[panel].length ? String(unread[panel].length) : '';
  });
  const signature = [...unread.upgrades.map((key) => `u:${key}`), ...unread.automation.map((key) => `a:${key}`)].join('|');
  if (signature && signature !== lastUnreadSignature) {
    const changedPanel = signature.includes('u:') ? 'upgrades' : 'automation';
    app.querySelector<HTMLElement>(`[data-panel="${changedPanel}"]`)?.animate(
      [{ transform: 'translateY(0)', filter: 'brightness(1)' }, { transform: 'translateY(-3px)', filter: 'brightness(1.8)' }, { transform: 'translateY(0)', filter: 'brightness(1)' }],
      { duration: 900, easing: 'ease-out' },
    );
  }
  lastUnreadSignature = signature;
}

function syncOverlay(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="overlay-root"]');
  if (!root) return;
  if (!state.summaryOpen) { if (root.innerHTML) root.innerHTML = ''; overlaySignature = ''; return; }
  const signature = `${state.stardust}:${state.perks.largerCloud}:${state.perks.permanentGravity}`;
  if (signature === overlaySignature) return;
  overlaySignature = signature;
  const cloudCost = 2 + state.perks.largerCloud * 2;
  const gravityPerkCost = 2 + state.perks.permanentGravity * 2;
  root.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div class="summary-heading"><span class="modal-star">${icons.spark}</span><div><small>ZYKLUS ${state.run.toString().padStart(2, '0')} VOLLENDET</small><h2 id="summary-title">Ein Stern erwacht.</h2><p>Gravitationsdruck und Strahlungsdruck befinden sich im Gleichgewicht.</p></div></div><div class="summary-stats"><div><span>Endmasse</span><b>${formatCompact(starMass(state))} ME</b></div><div><span>Fusionsdauer</span><b>${formatDuration(state.elapsed)}</b></div><div><span>Sternenstaub</span><b>✦ ${state.stardust}</b></div></div><div class="summary-legacy"><div class="summary-section-title"><span>Vermächtnis wählen</span><small>Wirkt ab dem nächsten Zyklus</small></div><div class="summary-perk-grid"><article><span class="perk-orbit">01</span><div><h3>Reichere Urwolke</h3><p>+25 % Ausgangsmaterie pro Stufe</p><strong>Stufe ${state.perks.largerCloud}</strong></div><button data-action="buy-perk-cloud" ${disabled(state.stardust < cloudCost)}>+${cloudCost} ✦</button></article><article><span class="perk-orbit">02</span><div><h3>Gravitatives Gedächtnis</h3><p>+12 % Akkretionsrate pro Stufe</p><strong>Stufe ${state.perks.permanentGravity}</strong></div><button data-action="buy-perk-gravity" ${disabled(state.stardust < gravityPerkCost)}>+${gravityPerkCost} ✦</button></article></div></div><div class="summary-actions"><button class="primary-action" data-action="prestige">Nächsten Zyklus beginnen</button><button class="text-action" data-action="close-summary">Später entscheiden</button></div></section></div>`;
}

function syncToast(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="toast-root"]');
  if (root) root.innerHTML = toast ? `<div class="toast" role="status">${toast}</div>` : '';
}

function updateUI(forcePanel = false): void {
  const objective = objectiveFor(state);
  const mass = starMass(state);
  const remaining = cloudMass(state);
  const starTotal = Math.max(1, mass);
  const initialCloud = 100_000 * (1 + state.perks.largerCloud * .25);
  const scale = temperatureScale(state.temperature);
  const stageIndex = ['nebula', 'protostar', 'deuterium', 'hydrogen', 'stable'].indexOf(state.stage);

  setText('run', `ZYKLUS ${state.run.toString().padStart(2, '0')}`); setText('stardust', formatNumber(state.stardust)); setText('elapsed', formatDuration(state.elapsed));
  setText('objective-eyebrow', objective.eyebrow); setText('objective-title', objective.title); setText('objective-detail', objective.detail); setText('objective-percent', `${formatNumber(objective.progress, 1)}%`); setWidth('objective-bar', objective.progress);
  setText('temperature', formatTemperature(state.temperature)); setText('temperature-max', scale.label); app.querySelector<HTMLElement>('[data-ui="temperature-bar"]')?.style.setProperty('clip-path', `inset(0 ${100 - scale.progress}% 0 0)`);
  setText('mass', formatCompact(mass)); setText('pressure', formatNumber(pressureProgress(state), 1)); setText('energy', formatCompact(state.energy)); setText('accretion-rate', formatCompact(accretionPerSecond(state))); setText('core-total', `${formatCompact(mass)} ME`);
  (['hydrogen', 'helium', 'deuterium'] as const).forEach((key) => { const percent = matterPercent(state.star[key], starTotal); setWidth(`${key}-bar`, key === 'deuterium' ? Math.max(1, percent) : percent); setText(`${key}-value`, key === 'deuterium' ? formatNumber(state.star[key], 1) : `${formatNumber(percent, 1)}%`); setText(`cloud-${key}`, key === 'deuterium' ? formatNumber(state.cloud[key], 1) : formatCompact(state.cloud[key])); });
  setText('stage', STAGE_LABELS[state.stage]); setText('stage-detail', state.completed ? 'Hydrostatisches Gleichgewicht' : 'Gravitative Kontraktion');
  const star = app.querySelector<HTMLButtonElement>('.star-button');
  if (star) { star.className = `star-button stage-${state.stage}`; star.disabled = state.completed || remaining <= 0; }
  const chamber = app.querySelector<HTMLElement>('.star-chamber');
  chamber?.style.setProperty('--star-scale', String(Math.min(1, Math.max(.1, mass / 36_000)))); chamber?.style.setProperty('--temp-scale', String(Math.min(1, state.temperature / THRESHOLDS.hydrogenTemperature)));
  setText('click-yield', state.completed ? 'STERN STABIL' : `+${formatNumber(accretionPerClick(state))} ME`); setText('click-detail', state.completed ? 'Hauptreihe erreicht' : 'Klicken zum Akkretieren');
  app.querySelectorAll<HTMLElement>('[data-phase]').forEach((dot) => dot.classList.toggle('active', Number(dot.dataset.phase) <= stageIndex));
  const cloudPercent = remaining / initialCloud * 100; setText('cloud-percent', `${formatNumber(cloudPercent, 1)}%`); setText('cloud-mass', `${formatCompact(remaining)} ME`); setText('cloud-initial', `von ${formatCompact(initialCloud)} ME`); app.querySelector<HTMLElement>('.gauge-ring')?.style.setProperty('--remaining', `${cloudPercent / 100 * 360}deg`);
  setText('auto-accretion', state.automation.accretion > 0 ? `${formatCompact(accretionPerSecond(state))} ME / s` : 'Noch inaktiv'); app.querySelector('[data-ui="auto-status"]')?.classList.toggle('online', state.automation.accretion > 0);
  const soundButton = app.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]'); if (soundButton) { soundButton.innerHTML = state.soundEnabled ? icons.sound : icons.soundOff; soundButton.ariaLabel = `Ton ${state.soundEnabled ? 'ausschalten' : 'einschalten'}`; }
  setText('reactions-count', state.temperature >= THRESHOLDS.deuteriumTemperature ? '2' : '0');
  const counts: Record<Panel, string> = { reactions: state.temperature >= THRESHOLDS.deuteriumTemperature ? '2' : '0', upgrades: String(state.upgrades.gravity), automation: String(state.automation.accretion + state.automation.fusion), legacy: `✦ ${state.stardust}`, chronicle: String(state.log.length) };
  (Object.keys(counts) as Panel[]).forEach((panel) => { const element = app.querySelector<HTMLElement>(`[data-tab-count="${panel}"]`); if (element) element.textContent = counts[panel]; });
  syncNotifications(); syncActivePanel(); syncOverlay(); syncToast();
  if (forcePanel || state.stage !== lastStage) { if (activePanel === 'chronicle') syncActivePanel(); lastStage = state.stage; }
}

function switchPanel(panel: Panel, markSeen = true): void {
  activePanel = panel;
  if (markSeen && (panel === 'upgrades' || panel === 'automation')) {
    currentOpportunities()[panel].forEach((key) => { if (!state.seenOpportunities.includes(key)) state.seenOpportunities.push(key); });
    saveGame(state);
  }
  app.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => { const active = button.dataset.panel === panel; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(panel);
  lastLogSignature = '';
  syncActivePanel(); syncNotifications();
}

function dispatch(action: GameAction): void {
  state = reduceGame(state, action);
  saveGame(state);
  if (['BUY_GRAVITY', 'BUY_ACCRETION', 'BUY_FUSION', 'BUY_PERK'].includes(action.type)) switchPanel(activePanel, false);
  updateUI(true);
}

function showToast(message: string): void {
  toast = message; window.clearTimeout(toastTimer); syncToast();
  toastTimer = window.setTimeout(() => { toast = ''; syncToast(); }, 3_500);
}

function exportSave(): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cosmic-clicker-zyklus-${state.run}.json`; anchor.click(); URL.revokeObjectURL(url); showToast('Spielstand exportiert.');
}

function closeResetMenu(): void {
  resetMenuOpen = false; fullResetArmed = false; window.clearTimeout(resetTimer);
  const control = app.querySelector<HTMLElement>('.reset-control'); control?.classList.remove('is-open');
  const trigger = app.querySelector<HTMLButtonElement>('[data-action="reset-menu"]'); trigger?.setAttribute('aria-expanded', 'false');
  const fullLabel = app.querySelector<HTMLElement>('[data-full-reset-label]'); if (fullLabel) fullLabel.textContent = 'Spielstand löschen';
  app.querySelector('[data-action="reset-full"]')?.classList.remove('is-armed');
}

function toggleResetMenu(): void {
  if (resetMenuOpen) { closeResetMenu(); return; }
  resetMenuOpen = true;
  app.querySelector('.reset-control')?.classList.add('is-open');
  app.querySelector('[data-action="reset-menu"]')?.setAttribute('aria-expanded', 'true');
  window.clearTimeout(resetTimer); resetTimer = window.setTimeout(closeResetMenu, 7_000);
}

function armFullReset(): void {
  fullResetArmed = true; window.clearTimeout(resetTimer);
  const button = app.querySelector<HTMLElement>('[data-action="reset-full"]'); button?.classList.add('is-armed');
  const label = app.querySelector<HTMLElement>('[data-full-reset-label]'); if (label) label.textContent = 'Wirklich alles löschen?';
  resetTimer = window.setTimeout(closeResetMenu, 5_000);
}

function performReset(mode: ResetMode): void {
  closeResetMenu();
  const sound = state.soundEnabled;
  if (mode === 'full') { clearSave(); state = createInitialState(); }
  else state = createInitialState(state.perks, state.stardust, state.run);
  state.soundEnabled = sound; activePanel = 'reactions'; switchPanel('reactions', false); saveGame(state); updateUI(true); showToast(mode === 'full' ? 'Ein neuer Kosmos beginnt.' : 'Der aktuelle Zyklus wurde neu gestartet.');
}

function createActionFeedback(container: HTMLElement, text: string, kind: string): void {
  const feedback = document.createElement('span'); feedback.className = `action-feedback ${kind}`; feedback.textContent = text; container.append(feedback);
  feedback.addEventListener('animationend', () => feedback.remove(), { once: true });
}

function playActionFeedback(action: string): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (action === 'accrete') {
    const chamber = app.querySelector<HTMLElement>('.star-chamber'); const star = app.querySelector<HTMLElement>('.star-button');
    if (chamber) { createActionFeedback(chamber, `+${formatNumber(accretionPerClick(state))} ME`, 'matter'); const ring = document.createElement('i'); ring.className = 'impact-ring'; chamber.append(ring); ring.addEventListener('animationend', () => ring.remove(), { once: true }); }
    star?.animate([{ transform: 'scale(1)' }, { transform: 'scale(.965)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
  }
  if (action === 'burn-deuterium' || action === 'fuse-hydrogen') {
    const selector = action === 'burn-deuterium' ? '[data-card="deuterium"]' : '[data-card="fusion"]';
    const card = app.querySelector<HTMLElement>(selector); const button = app.querySelector<HTMLElement>(`[data-action="${action}"]`);
    if (card) createActionFeedback(card, action === 'burn-deuterium' ? '+170.000 K' : '+68 Energie', action === 'burn-deuterium' ? 'heat' : 'fusion');
    card?.animate([{ borderColor: 'rgba(242,168,75,.25)' }, { borderColor: 'rgba(242,168,75,.9)', filter: 'brightness(1.35)' }, { borderColor: 'rgba(242,168,75,.25)', filter: 'brightness(1)' }], { duration: 650, easing: 'ease-out' });
    button?.animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    app.querySelector<HTMLElement>('.star-surface')?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }], { duration: 520, easing: 'ease-out' });
  }
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const panelButton = target.closest<HTMLButtonElement>('[data-panel]'); if (panelButton) { switchPanel(panelButton.dataset.panel as Panel); return; }
  const button = target.closest<HTMLButtonElement>('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action; if (!action) return;
  if (action === 'reset-menu') { toggleResetMenu(); return; }
  if (action === 'reset-run') { performReset('run'); return; }
  if (action === 'reset-full') { if (fullResetArmed) performReset('full'); else armFullReset(); return; }
  const actions: Record<string, GameAction> = {
    accrete: { type: 'ACCRETE' }, 'burn-deuterium': { type: 'BURN_DEUTERIUM' }, 'fuse-hydrogen': { type: 'FUSE_HYDROGEN' }, 'buy-gravity': { type: 'BUY_GRAVITY' }, 'buy-accretion': { type: 'BUY_ACCRETION' }, 'buy-fusion': { type: 'BUY_FUSION' }, 'buy-perk-cloud': { type: 'BUY_PERK', perk: 'largerCloud' }, 'buy-perk-gravity': { type: 'BUY_PERK', perk: 'permanentGravity' }, prestige: { type: 'PRESTIGE' }, 'close-summary': { type: 'CLOSE_SUMMARY' }, 'toggle-sound': { type: 'TOGGLE_SOUND' },
  };
  if (actions[action]) { dispatch(actions[action]); playActionFeedback(action); }
  if (action === 'close-summary') switchPanel('legacy', false);
  if (action === 'prestige') switchPanel('reactions', false);
  if (action === 'export') exportSave();
  if (action === 'import') document.querySelector<HTMLInputElement>('#save-import')?.click();
});

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement; if (input.id !== 'save-import' || !input.files?.[0]) return;
  try { const imported = JSON.parse(await input.files[0].text()) as GameState; if (imported.version !== 1 || !imported.cloud || !imported.star) throw new Error('Invalid save'); imported.seenOpportunities ??= []; state = { ...imported, lastTick: Date.now() }; saveGame(state); updateUI(true); showToast('Spielstand erfolgreich importiert.'); } catch { showToast('Diese Datei ist kein gültiger Spielstand.'); }
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (event) => {
    const x = event.clientX / window.innerWidth - .5; const y = event.clientY / window.innerHeight - .5;
    document.documentElement.style.setProperty('--parallax-x', `${x * -10}px`); document.documentElement.style.setProperty('--parallax-y', `${y * -7}px`); document.documentElement.style.setProperty('--parallax-soft-x', `${x * 5}px`); document.documentElement.style.setProperty('--parallax-soft-y', `${y * 4}px`);
  }, { passive: true });
}

function frame(now: number): void {
  const delta = Math.min(1, (now - lastFrame) / 1_000); lastFrame = now; state = tick(state, delta);
  if (now - lastUiUpdate > 100) { updateUI(); lastUiUpdate = now; }
  requestAnimationFrame(frame);
}

window.setInterval(() => saveGame(state), 5_000); window.addEventListener('beforeunload', () => saveGame(state));
renderShell(); requestAnimationFrame(frame);
if (import.meta.env.DEV) Object.assign(window, { __cosmicState: () => state, __temperature: () => calculateTemperature(state), __fusionRate: () => fusionPerSecond(state) });
