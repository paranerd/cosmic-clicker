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

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root missing');

const loaded = loadGame();
let state = loaded.state;
let lastFrame = performance.now();
let lastRender = 0;
let activePanel: 'reactions' | 'systems' | 'legacy' = 'reactions';
let toast = loaded.offlineSeconds >= 60
  ? `Während deiner Abwesenheit liefen ${formatDuration(loaded.offlineSeconds)} Simulation.`
  : '';
let toastTimer = 0;

const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>',
  atom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m16 10 5 5m0-5-5 5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 19h16"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5"/><path d="M5.4 16a8 8 0 1 0 .5-9L4 9"/></svg>',
};

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits }).format(Math.max(0, value));
}

function formatCompact(value: number): string {
  if (value < 1_000) return formatNumber(value);
  return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatTemperature(value: number): string {
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)} Mio. K`;
  return `${formatCompact(value)} K`;
}

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function matterPercent(value: number, total: number): number {
  return total <= 0 ? 0 : value / total * 100;
}

function buttonDisabled(condition: boolean): string {
  return condition ? 'disabled aria-disabled="true"' : '';
}

function levelPips(level: number, max: number): string {
  return Array.from({ length: max }, (_, index) => `<i class="level-pip ${index < level ? 'is-filled' : ''}"></i>`).join('');
}

function renderReactionPanel(): string {
  const canDeuterium = state.temperature >= THRESHOLDS.deuteriumTemperature && state.star.deuterium >= 2 && !state.completed;
  const canFuse = state.temperature >= THRESHOLDS.hydrogenTemperature && state.star.hydrogen >= 200 && !state.completed;
  const fusionUnlocked = state.temperature >= THRESHOLDS.hydrogenTemperature;

  return `
    <div class="action-card ${canDeuterium ? 'is-ready' : ''}">
      <div class="reaction-symbol deuterium">D</div>
      <div class="action-copy">
        <span class="card-kicker">Protostern-Reaktion</span>
        <h3>Deuteriumbrennen</h3>
        <p>Eine begrenzte Brennphase. Wandelt 2 D um und gibt dem Kern kurzzeitig Wärme.</p>
        <div class="reaction-equation"><span>²H + ²H</span><b>→</b><span>He + Energie</span></div>
      </div>
      <button class="secondary-action" data-action="burn-deuterium" ${buttonDisabled(!canDeuterium)}>
        <span>${canDeuterium ? 'Zünden' : state.temperature < THRESHOLDS.deuteriumTemperature ? 'Ab 1 Mio. K' : 'Kein D verfügbar'}</span>
        <small>+170.000 K · +36 E</small>
      </button>
    </div>
    <div class="action-card ${canFuse ? 'is-ready' : ''}">
      <div class="reaction-symbol hydrogen">H</div>
      <div class="action-copy">
        <span class="card-kicker">Kernfusion</span>
        <h3>Proton-Proton-Kette</h3>
        <p>Wasserstoff verschmilzt über mehrere Schritte zu Helium. Ein kleiner Massendefekt wird zu Energie.</p>
        <div class="reaction-equation"><span>4 H</span><b>→</b><span>He + γ</span></div>
      </div>
      <button class="primary-action compact" data-action="fuse-hydrogen" ${buttonDisabled(!canFuse)}>
        <span>${fusionUnlocked ? '200 H fusionieren' : 'Ab 10 Mio. K'}</span>
        <small>${fusionUnlocked ? '+68 Energie' : 'Kern noch zu kalt'}</small>
      </button>
    </div>`;
}

function renderSystemsPanel(): string {
  const mass = starMass(state);
  const gravityPrice = gravityCost(state.upgrades.gravity);
  const accretionPrice = accretionCost(state.automation.accretion);
  const fusionPrice = fusionCost(state.automation.fusion);

  return `
    <div class="upgrade-grid">
      <article class="upgrade-card">
        <div class="upgrade-top"><span class="upgrade-icon">G</span><span class="tag">Upgrade</span></div>
        <h3>Gravitative Verdichtung</h3>
        <p>Mehr Materie pro Impuls und pro Sekunde. Jede Stufe erhöht die Akkretion um 55 %.</p>
        <div class="level-row">${levelPips(state.upgrades.gravity, LIMITS.gravity)}</div>
        <button data-action="buy-gravity" ${buttonDisabled(state.energy < gravityPrice || state.upgrades.gravity >= LIMITS.gravity)}>
          <span>${state.upgrades.gravity >= LIMITS.gravity ? 'Maximum' : 'Verdichten'}</span><b>${state.upgrades.gravity >= LIMITS.gravity ? '—' : `${gravityPrice} E`}</b>
        </button>
      </article>
      <article class="upgrade-card">
        <div class="upgrade-top"><span class="upgrade-icon">A</span><span class="tag">Automation</span></div>
        <h3>Akkretionsstrom</h3>
        <p>Zieht kontinuierlich Materie aus der Wolke. Benötigt einen ausgebildeten Protostern.</p>
        <div class="level-row">${levelPips(state.automation.accretion, LIMITS.accretion)}</div>
        <button data-action="buy-accretion" ${buttonDisabled(state.energy < accretionPrice || mass < THRESHOLDS.protostarMass || state.automation.accretion >= LIMITS.accretion)}>
          <span>${state.automation.accretion >= LIMITS.accretion ? 'Maximum' : mass < THRESHOLDS.protostarMass ? 'Noch instabil' : 'Ausbauen'}</span><b>${state.automation.accretion >= LIMITS.accretion ? '—' : `${accretionPrice} E`}</b>
        </button>
      </article>
      <article class="upgrade-card">
        <div class="upgrade-top"><span class="upgrade-icon">H</span><span class="tag">Automation</span></div>
        <h3>Stabiler pp-Zyklus</h3>
        <p>Fusioniert Wasserstoff automatisch. Wird nach fünf manuellen Reaktionen verfügbar.</p>
        <div class="level-row">${levelPips(state.automation.fusion, LIMITS.fusion)}</div>
        <button data-action="buy-fusion" ${buttonDisabled(state.energy < fusionPrice || state.manualFusions < 5 || state.automation.fusion >= LIMITS.fusion)}>
          <span>${state.automation.fusion >= LIMITS.fusion ? 'Maximum' : state.manualFusions < 5 ? `${state.manualFusions}/5 Reaktionen` : 'Stabilisieren'}</span><b>${state.automation.fusion >= LIMITS.fusion ? '—' : `${fusionPrice} E`}</b>
        </button>
      </article>
    </div>`;
}

function renderLegacyPanel(): string {
  const cloudCost = 2 + state.perks.largerCloud * 2;
  const gravityPerkCost = 2 + state.perks.permanentGravity * 2;
  return `
    <div class="legacy-intro">
      <div><span class="card-kicker">Kosmisches Vermächtnis</span><h3>Was ein Stern hinterlässt</h3></div>
      <p>Sternenstaub bleibt über Runden erhalten. Perks können nach einem stabilen Hauptreihenstern gekauft werden.</p>
    </div>
    <div class="perk-path">
      <article class="perk-card ${state.completed ? 'is-unlocked' : ''}">
        <span class="perk-orbit">01</span><h3>Reichere Urwolke</h3>
        <p>Jede Stufe vergrößert die nächste Gaswolke permanent um 25 %.</p>
        <strong>Stufe ${state.perks.largerCloud}</strong>
        <button data-action="buy-perk-cloud" ${buttonDisabled(!state.completed || state.stardust < cloudCost)}>Kaufen · ${cloudCost} ✦</button>
      </article>
      <div class="path-line"></div>
      <article class="perk-card ${state.completed ? 'is-unlocked' : ''}">
        <span class="perk-orbit">02</span><h3>Gravitatives Gedächtnis</h3>
        <p>Jede Stufe erhöht alle künftigen Akkretionsraten permanent um 12 %.</p>
        <strong>Stufe ${state.perks.permanentGravity}</strong>
        <button data-action="buy-perk-gravity" ${buttonDisabled(!state.completed || state.stardust < gravityPerkCost)}>Kaufen · ${gravityPerkCost} ✦</button>
      </article>
    </div>`;
}

function render(): void {
  const objective = objectiveFor(state);
  const mass = starMass(state);
  const remaining = cloudMass(state);
  const starTotal = Math.max(1, mass);
  const initialCloud = 100_000 * (1 + state.perks.largerCloud * 0.25);
  const starScale = Math.min(1, Math.max(0.1, mass / 36_000));
  const tempScale = Math.min(1, state.temperature / THRESHOLDS.hydrogenTemperature);
  const nextStageIndex = ['nebula', 'protostar', 'deuterium', 'hydrogen', 'stable'].indexOf(state.stage);
  const panel = activePanel === 'reactions' ? renderReactionPanel() : activePanel === 'systems' ? renderSystemsPanel() : renderLegacyPanel();

  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Cosmic Clicker Startseite">
        <span class="brand-mark">${icons.spark}</span><span><b>COSMIC</b><em>CLICKER</em></span>
      </a>
      <div class="run-status"><i></i><span>SIMULATION AKTIV</span><b>ZYKLUS ${state.run.toString().padStart(2, '0')}</b></div>
      <div class="header-actions">
        <div class="resource-chip" title="Bleibt nach einem Neustart erhalten"><span>✦</span><div><small>Sternenstaub</small><b>${formatNumber(state.stardust)}</b></div></div>
        <button class="icon-button" data-action="toggle-sound" aria-label="Ton ${state.soundEnabled ? 'ausschalten' : 'einschalten'}">${state.soundEnabled ? icons.sound : icons.soundOff}</button>
        <button class="icon-button" data-action="export" aria-label="Spielstand exportieren">${icons.download}</button>
        <button class="icon-button" data-action="reset" aria-label="Spielstand zurücksetzen">${icons.reset}</button>
      </div>
    </header>

    <main>
      <section class="mission-strip">
        <div class="mission-copy"><span>${objective.eyebrow}</span><h2>${objective.title}</h2><p>${objective.detail}</p></div>
        <div class="mission-progress"><div class="progress-label"><span>Fortschritt</span><b>${formatNumber(objective.progress, 1)}%</b></div><div class="progress-track"><i style="width:${objective.progress}%"></i></div></div>
        <div class="elapsed"><span>Laufzeit</span><b>${formatDuration(state.elapsed)}</b></div>
      </section>

      <section class="stellar-lab">
        <aside class="data-panel left-panel">
          <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
          <div class="primary-reading"><span>Kerntemperatur</span><b>${formatTemperature(state.temperature)}</b><div class="thermal-scale"><i style="width:${tempScale * 100}%"></i></div><small><span>2.700 K</span><span>10 Mio. K</span></small></div>
          <div class="metric-grid">
            <div class="metric"><span>Sternmasse</span><b>${formatCompact(mass)}</b><small>ME</small></div>
            <div class="metric"><span>Kerndruck</span><b>${formatNumber(pressureProgress(state), 1)}</b><small>% Zünddruck</small></div>
            <div class="metric"><span>Energie</span><b>${formatCompact(state.energy)}</b><small>verfügbar</small></div>
            <div class="metric"><span>Akkretion</span><b>${formatCompact(accretionPerSecond(state))}</b><small>ME / Sek.</small></div>
          </div>
          <div class="composition">
            <div class="section-label"><span>Kernzusammensetzung</span><small>${formatCompact(mass)} ME</small></div>
            <div class="composition-row"><span class="element h">H</span><div><b>Wasserstoff</b><div class="mini-track"><i style="width:${matterPercent(state.star.hydrogen, starTotal)}%"></i></div></div><strong>${formatNumber(matterPercent(state.star.hydrogen, starTotal), 1)}%</strong></div>
            <div class="composition-row"><span class="element he">He</span><div><b>Helium</b><div class="mini-track"><i style="width:${matterPercent(state.star.helium, starTotal)}%"></i></div></div><strong>${formatNumber(matterPercent(state.star.helium, starTotal), 1)}%</strong></div>
            <div class="composition-row"><span class="element d">D</span><div><b>Deuterium</b><div class="mini-track"><i style="width:${Math.max(1, matterPercent(state.star.deuterium, starTotal))}%"></i></div></div><strong>${formatNumber(state.star.deuterium, 1)}</strong></div>
          </div>
        </aside>

        <section class="star-chamber" style="--star-scale:${starScale}; --temp-scale:${tempScale}">
          <div class="stage-label"><span>${STAGE_LABELS[state.stage]}</span><b>${state.completed ? 'Hydrostatisches Gleichgewicht' : 'Gravitative Kontraktion'}</b></div>
          <div class="orbit orbit-outer"><span></span><span></span></div><div class="orbit orbit-inner"><span></span></div>
          <button class="star-button stage-${state.stage}" data-action="accrete" ${buttonDisabled(state.completed || remaining <= 0)} aria-label="Materie akkretieren">
            <span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span>
          </button>
          <div class="click-callout"><span>${state.completed ? 'STERN STABIL' : `+${formatNumber(accretionPerClick(state))} ME`}</span><small>${state.completed ? 'Hauptreihe erreicht' : 'Klicken zum Akkretieren'}</small></div>
          <div class="phase-dots">${['nebula', 'protostar', 'deuterium', 'hydrogen', 'stable'].map((_, index) => `<i class="${index <= nextStageIndex ? 'active' : ''}"></i>`).join('')}</div>
        </section>

        <aside class="data-panel right-panel">
          <div class="panel-heading"><span class="index">02</span><div><small>Reservoir</small><h2>Urwolke</h2></div></div>
          <div class="cloud-gauge"><div class="gauge-ring" style="--remaining:${remaining / initialCloud * 360}deg"><div><b>${formatNumber(remaining / initialCloud * 100, 1)}%</b><small>verfügbar</small></div></div><div><span>Restmaterie</span><b>${formatCompact(remaining)} ME</b><small>von ${formatCompact(initialCloud)} ME</small></div></div>
          <div class="reservoir-list">
            <div><span class="element h">H</span><p><b>Wasserstoff</b><small>74,9 % initial</small></p><strong>${formatCompact(state.cloud.hydrogen)}</strong></div>
            <div><span class="element he">He</span><p><b>Helium</b><small>25,0 % initial</small></p><strong>${formatCompact(state.cloud.helium)}</strong></div>
            <div><span class="element d">D</span><p><b>Deuterium</b><small>Spurenelement</small></p><strong>${formatNumber(state.cloud.deuterium, 1)}</strong></div>
          </div>
          <div class="rate-card"><span>${icons.atom}</span><div><small>Automatische Akkretion</small><b>${state.automation.accretion > 0 ? `${formatCompact(accretionPerSecond(state))} ME / s` : 'Noch inaktiv'}</b></div><i class="${state.automation.accretion > 0 ? 'online' : ''}"></i></div>
          <div class="science-note"><span>WISSENSKERN</span><p>Ein Protostern leuchtet schon vor der Fusion: Seine Strahlung entsteht zunächst durch gravitative Kontraktion.</p></div>
        </aside>
      </section>

      <section class="control-deck">
        <div class="deck-tabs" role="tablist" aria-label="Kontrollbereiche">
          <button class="${activePanel === 'reactions' ? 'active' : ''}" data-panel="reactions" role="tab">Reaktionen <span>${state.temperature >= THRESHOLDS.deuteriumTemperature ? '2' : '0'}</span></button>
          <button class="${activePanel === 'systems' ? 'active' : ''}" data-panel="systems" role="tab">Systeme <span>${state.automation.accretion + state.automation.fusion + state.upgrades.gravity}</span></button>
          <button class="${activePanel === 'legacy' ? 'active' : ''}" data-panel="legacy" role="tab">Vermächtnis <span>✦ ${state.stardust}</span></button>
        </div>
        <div class="deck-content">${panel}</div>
      </section>

      <section class="bottom-grid">
        <div class="timeline-card">
          <div class="section-label"><span>Stellare Entwicklung</span><small>VERTICAL SLICE 01</small></div>
          <div class="timeline">
            ${[
              ['nebula', 'Gaswolke', 'Materie sammeln'], ['protostar', 'Protostern', 'Kern verdichten'], ['deuterium', 'D-Brennen', '1 Mio. K'], ['hydrogen', 'pp-Kette', '10 Mio. K'], ['stable', 'Hauptreihe', 'Gleichgewicht'],
            ].map(([key, label, detail], index) => `<div class="timeline-node ${index <= nextStageIndex ? 'done' : ''} ${key === state.stage ? 'current' : ''}"><i>${index < nextStageIndex ? '✓' : index + 1}</i><span><b>${label}</b><small>${detail}</small></span></div>`).join('')}
          </div>
          <div class="future-strip"><span>C</span><i></i><span>O</span><i></i><span>Ne</span><i></i><span>Si</span><i></i><span>Fe</span><p>Spätere Entwicklungsphasen</p></div>
        </div>
        <div class="log-card">
          <div class="section-label"><span>Sternenlogbuch</span><small>LIVE</small></div>
          <div class="log-list">${state.log.slice(0, 4).map((entry) => `<div class="log-entry ${entry.kind}"><i></i><p>${entry.text}</p></div>`).join('')}</div>
        </div>
      </section>
    </main>

    <footer><span>COSMIC CLICKER · PROTOTYP 0.1</span><p>Wissenschaftlich plausibel · spielerisch komprimiert</p><button data-action="import">Spielstand importieren</button><input id="save-import" type="file" accept="application/json" hidden /></footer>

    ${state.summaryOpen ? `
      <div class="modal-backdrop" role="presentation">
        <section class="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
          <span class="modal-star">${icons.spark}</span><small>ZYKLUS ${state.run.toString().padStart(2, '0')} VOLLENDET</small><h2 id="summary-title">Ein Stern erwacht.</h2>
          <p>Der nach innen gerichtete Gravitationsdruck und der nach außen gerichtete Strahlungsdruck befinden sich im Gleichgewicht.</p>
          <div class="summary-stats"><div><span>Endmasse</span><b>${formatCompact(mass)} ME</b></div><div><span>Fusionsdauer</span><b>${formatDuration(state.elapsed)}</b></div><div><span>Ertrag</span><b>✦ ${state.stardust}</b></div></div>
          <button class="primary-action" data-action="close-summary">Vermächtnis ansehen</button><button class="text-action" data-action="prestige">Nächsten Zyklus beginnen</button>
        </section>
      </div>` : ''}
    ${toast ? `<div class="toast" role="status">${toast}</div>` : ''}
  `;
}

function dispatch(action: GameAction): void {
  state = reduceGame(state, action);
  saveGame(state);
  render();
}

function showToast(message: string): void {
  toast = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast = ''; render(); }, 3_500);
  render();
}

function exportSave(): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cosmic-clicker-zyklus-${state.run}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Spielstand exportiert.');
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const panelButton = target.closest<HTMLButtonElement>('[data-panel]');
  if (panelButton) {
    activePanel = panelButton.dataset.panel as typeof activePanel;
    render();
    return;
  }

  const button = target.closest<HTMLButtonElement>('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (!action) return;
  const actions: Record<string, GameAction> = {
    'accrete': { type: 'ACCRETE' }, 'burn-deuterium': { type: 'BURN_DEUTERIUM' },
    'fuse-hydrogen': { type: 'FUSE_HYDROGEN' }, 'buy-gravity': { type: 'BUY_GRAVITY' },
    'buy-accretion': { type: 'BUY_ACCRETION' }, 'buy-fusion': { type: 'BUY_FUSION' },
    'buy-perk-cloud': { type: 'BUY_PERK', perk: 'largerCloud' },
    'buy-perk-gravity': { type: 'BUY_PERK', perk: 'permanentGravity' },
    'prestige': { type: 'PRESTIGE' }, 'close-summary': { type: 'CLOSE_SUMMARY' },
    'toggle-sound': { type: 'TOGGLE_SOUND' },
  };
  if (actions[action]) dispatch(actions[action]);
  if (action === 'export') exportSave();
  if (action === 'import') document.querySelector<HTMLInputElement>('#save-import')?.click();
  if (action === 'reset' && window.confirm('Den gesamten Spielstand inklusive Sternenstaub wirklich löschen?')) {
    clearSave();
    state = createInitialState();
    showToast('Ein neuer Kosmos beginnt.');
  }
});

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id !== 'save-import' || !input.files?.[0]) return;
  try {
    const imported = JSON.parse(await input.files[0].text()) as GameState;
    if (imported.version !== 1 || !imported.cloud || !imported.star) throw new Error('Invalid save');
    state = { ...imported, lastTick: Date.now() };
    saveGame(state);
    showToast('Spielstand erfolgreich importiert.');
  } catch {
    showToast('Diese Datei ist kein gültiger Spielstand.');
  }
});

function frame(now: number): void {
  const delta = Math.min(1, (now - lastFrame) / 1_000);
  lastFrame = now;
  state = tick(state, delta);
  if (now - lastRender > 250) {
    render();
    lastRender = now;
  }
  requestAnimationFrame(frame);
}

window.setInterval(() => saveGame(state), 5_000);
window.addEventListener('beforeunload', () => saveGame(state));
render();
requestAnimationFrame(frame);

// Exposed for deterministic smoke tests in development builds.
if (import.meta.env.DEV) Object.assign(window, { __cosmicState: () => state, __temperature: () => calculateTemperature(state), __fusionRate: () => fusionPerSecond(state) });
