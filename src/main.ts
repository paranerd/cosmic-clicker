import './styles.scss';
import { playSound, type SoundEffect } from './audio';
import { CLOUD_TIERS, DEUTERIUM_UPGRADE_COST, INITIAL_TEMPERATURE, LIMITS, MATTER_KEYS, OUTCOME_LABELS, STAGE_LABELS, THRESHOLDS } from './game/config';
import {
  accretionCost,
  accretionPerClick,
  accretionPerSecond,
  calculateTemperature,
  cloudTierCost,
  cloudMass,
  createInitialState,
  evolutionActionFor,
  fusionPerkCost,
  fusionCost,
  fusionPerSecond,
  gravityCost,
  gravityPerkCost,
  objectiveFor,
  pressureProgress,
  reduceGame,
  starMass,
  stellarFusionMultiplier,
  tick,
} from './game/engine';
import { clearSave, loadGame, normalizeGameState, saveGame } from './game/storage';
import type { CloudTier, GameAction, Stage } from './game/types';

type Panel = 'reactions' | 'upgrades' | 'automation';
type ResetMode = 'run' | 'full';
interface ToastMessage { id: number; text: string; leaving: boolean }

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root missing');

const loaded = loadGame();
let state = loaded.state;
let activePanel: Panel = 'reactions';
let lastFrame = performance.now();
let lastUiUpdate = 0;
let lastStage = state.stage;
let lastLogSignature = '';
let lastOpportunitySignature = '';
let notificationsInitialized = false;
const offlineToast = loaded.offlineSeconds >= 60
  ? `Während deiner Abwesenheit liefen ${formatDuration(loaded.offlineSeconds)} Simulation.`
  : '';
let toastSequence = 0;
let toastMessages: ToastMessage[] = [];
const toastTimers = new Map<number, number>();
let resetMenuOpen = false;
let fullResetArmed = false;
let resetTimer = 0;
let overlaySignature = '';
let chronicleOpen = false;
let perksOpen = false;
let soundMenuOpen = false;
let statsOpen = false;
let debugOpen = false;
let tutorialSignature = '';
let debugSignature = '';
let tutorialSpotlightFrame = 0;

const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m16 10 5 5m0-5-5 5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 19h16"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5"/><path d="M5.4 16a8 8 0 1 0 .5-9L4 9"/></svg>',
  stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.2M12 17h.01"/></svg>',
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
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

const MATTER_META = {
  hydrogen: { symbol: 'H', label: 'Wasserstoff', className: 'h' },
  helium: { symbol: 'He', label: 'Helium', className: 'he' },
  deuterium: { symbol: 'D', label: 'Deuterium', className: 'd' },
  carbon: { symbol: 'C', label: 'Kohlenstoff', className: 'c' },
  oxygen: { symbol: 'O', label: 'Sauerstoff', className: 'o' },
} as const;

const hydrogenPast = (stage: Stage): boolean => !['nebula', 'protostar', 'deuterium', 'hydrogen'].includes(stage);

function currentOpportunities(): Record<Panel, string[]> {
  const reactions: string[] = [];
  const upgrades: string[] = [];
  const automation: string[] = [];
  if (!state.completed && state.stage === 'hydrogen' && state.star.hydrogen >= 200) {
    reactions.push('reaction:hydrogen');
  }
  if (!state.completed && state.stage === 'helium' && state.star.helium >= 300) reactions.push('reaction:helium');
  if (!state.completed && state.stage === 'carbonOxygen' && state.star.carbon >= 180 && state.star.helium >= 60) reactions.push('reaction:oxygen');
  const evolution = evolutionActionFor(state);
  if (evolution?.available) reactions.push(`evolution:${state.stage}`);
  if (!state.upgrades.deuteriumBurning && state.star.deuterium > 0 && state.temperature >= THRESHOLDS.deuteriumTemperature && state.temperature < THRESHOLDS.hydrogenTemperature && state.energy >= DEUTERIUM_UPGRADE_COST) {
    upgrades.push('deuterium-burning');
  }
  if (state.upgrades.gravity < LIMITS.gravity && state.energy >= gravityCost(state.upgrades.gravity)) {
    upgrades.push(`gravity:${state.upgrades.gravity}`);
  }
  if (state.automation.accretion < LIMITS.accretion && starMass(state) >= THRESHOLDS.protostarMass && state.energy >= accretionCost(state.automation.accretion)) {
    automation.push(`accretion:${state.automation.accretion}`);
  }
  if (state.automation.fusion < LIMITS.fusion && state.manualFusions >= 5 && state.energy >= fusionCost(state.automation.fusion)) {
    automation.push(`fusion:${state.automation.fusion}`);
  }
  return { reactions, upgrades, automation };
}

function renderReactionPanel(): string {
  const multiplier = stellarFusionMultiplier(state);
  const hydrogenAmount = Math.round(200 * multiplier);
  const heliumAmount = Math.round(300 * multiplier);
  const canHydrogen = state.stage === 'hydrogen' && state.star.hydrogen >= hydrogenAmount;
  const hydrogenLabel = state.cloudTier === 0 ? 'Zündmasse nicht erreichbar' : hydrogenPast(state.stage) ? 'Phase abgeschlossen' : state.temperature < THRESHOLDS.hydrogenTemperature ? 'Ab 10 Mio. K' : `${hydrogenAmount} H fusionieren`;
  const heliumVisible = ['redGiant', 'helium', 'carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'].includes(state.stage);
  const canHelium = state.stage === 'helium' && state.star.helium >= heliumAmount;
  const oxygenVisible = ['carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'].includes(state.stage);
  const canOxygen = state.stage === 'carbonOxygen' && state.star.carbon >= 180 && state.star.helium >= 60 && state.stats.oxygenCreated < THRESHOLDS.oxygenCore;
  const evolution = evolutionActionFor(state);
  return `<div class="reaction-grid">
    <div class="action-card ${canHydrogen ? 'is-ready' : ''}" data-card="fusion">
      <div class="reaction-symbol hydrogen">H</div>
      <div class="action-copy"><span class="card-kicker">Kernfusion</span><h3>Wasserstoffbrennen</h3><p>Wasserstoff verschmilzt zu Helium. Ein kleiner Massendefekt wird zu Energie.</p><div class="reaction-equation"><span>4 H</span><b>→</b><span>He + γ</span></div></div>
      <button class="primary-action compact" data-action="fuse-hydrogen" ${disabled(!canHydrogen)}><span data-button-label>${hydrogenLabel}</span><small data-button-detail>${canHydrogen ? `+${formatCompact(hydrogenAmount * .34)} Energie` : state.cloudTier === 0 ? 'Die Wolke ist zu leicht' : 'Kern noch nicht bereit'}</small></button>
    </div>
    ${heliumVisible ? `<div class="action-card ${canHelium ? 'is-ready' : ''}" data-card="helium-fusion"><div class="reaction-symbol helium">He</div><div class="action-copy"><span class="card-kicker">Triple-Alpha</span><h3>Heliumbrennen</h3><p>Drei Heliumkerne verschmelzen bei etwa 100 Mio. K zu Kohlenstoff.</p><div class="reaction-equation"><span>3 He</span><b>→</b><span>C + γ</span></div></div><button class="primary-action compact" data-action="fuse-helium" ${disabled(!canHelium)}><span>${state.stage === 'helium' ? `${heliumAmount} He fusionieren` : hydrogenPast(state.stage) && state.stage !== 'redGiant' ? 'Phase abgeschlossen' : 'Heliumkern noch inaktiv'}</span><small>Bildet Kohlenstoff</small></button></div>` : ''}
    ${oxygenVisible ? `<div class="action-card ${canOxygen ? 'is-ready' : ''}" data-card="oxygen-fusion"><div class="reaction-symbol oxygen">O</div><div class="action-copy"><span class="card-kicker">Alpha-Einfang</span><h3>Sauerstoff bilden</h3><p>Ein Kohlenstoffkern fängt Helium ein und wächst zu Sauerstoff.</p><div class="reaction-equation"><span>C + He</span><b>→</b><span>O + γ</span></div></div><button class="primary-action compact" data-action="create-oxygen" ${disabled(!canOxygen)}><span>${state.stats.oxygenCreated >= THRESHOLDS.oxygenCore ? 'C/O-Kern vollständig' : 'Sauerstoff erzeugen'}</span><small>${formatCompact(state.stats.oxygenCreated)} / ${formatCompact(THRESHOLDS.oxygenCore)} O</small></button></div>` : ''}
    ${evolution ? `<div class="action-card evolution-action ${evolution.available ? 'is-ready' : ''}" data-card="evolution"><div class="reaction-symbol evolution">✦</div><div class="action-copy"><span class="card-kicker">Stellare Entwicklung</span><h3>${evolution.label}</h3><p>${evolution.detail}</p></div><button class="primary-action compact" data-action="advance-evolution" ${disabled(!evolution.available)}><span>Entwicklung fortsetzen</span><small>${STAGE_LABELS[state.stage]}</small></button></div>` : ''}
  </div>`;
}

function deuteriumUpgradeCard(): string {
  const active = state.upgrades.deuteriumBurning;
  const hasDeuterium = state.star.deuterium > 0 || state.cloud.deuterium > 0;
  const unlocked = hasDeuterium && state.star.deuterium > 0 && state.temperature >= THRESHOLDS.deuteriumTemperature && state.temperature < THRESHOLDS.hydrogenTemperature;
  const label = active ? 'Aktiv' : !hasDeuterium ? 'Kein Deuterium' : state.temperature >= THRESHOLDS.hydrogenTemperature ? 'Phase beendet' : unlocked ? 'Aktivieren' : 'Ab 1 Mio. K';
  return `
    <article class="upgrade-card deuterium-upgrade">
      <div class="upgrade-heading"><span class="upgrade-icon">D</span><h3>Deuteriumbrennen <b>${active ? '×1,35' : 'inaktiv'}</b></h3></div>
      <p>Beschleunigt die kompressionsbedingte Erwärmung um 35 %. Der Effekt endet beim Freischalten des Wasserstoffbrennens.<strong>${active ? 'Erwärmung beschleunigt' : 'Einmaliges Upgrade für die Protosternphase'}</strong></p>
      <div class="level-row"><i class="level-pip ${active ? 'is-filled' : ''}"></i></div>
      <button class="${active ? 'terminal-button' : 'progress-button'}" data-action="buy-deuterium" ${active ? '' : `style="--button-progress:${progress(state.energy, DEUTERIUM_UPGRADE_COST, unlocked)}%"`} ${disabled(active || !unlocked || state.energy < DEUTERIUM_UPGRADE_COST)}>${active ? '' : '<i></i>'}<span data-button-label>${label}</span><b data-button-cost>${active ? '—' : `${DEUTERIUM_UPGRADE_COST} E`}</b></button>
    </article>`;
}

function upgradeCard(): string {
  const price = gravityCost(state.upgrades.gravity);
  const isMax = state.upgrades.gravity >= LIMITS.gravity;
  return `
    <article class="upgrade-card featured">
      <div class="upgrade-heading"><span class="upgrade-icon">G</span><h3>Gravitative Verdichtung <b data-ui="gravity-multiplier">×1,00</b></h3></div>
      <p>Mehr Materie pro Impuls und pro Sekunde. Jede Stufe erhöht die aktive und automatische Akkretion um 55 %.</p>
      <div class="level-row" data-levels="gravity">${levelPips(state.upgrades.gravity, LIMITS.gravity)}</div>
      <button class="${isMax ? 'terminal-button' : 'progress-button'}" data-action="buy-gravity" ${isMax ? '' : `style="--button-progress:${progress(state.energy, price)}%"`} ${disabled(state.energy < price || isMax)}>${isMax ? '' : '<i></i>'}<span data-button-label>${isMax ? 'Maximum' : 'Verdichten'}</span><b data-button-cost>${isMax ? '—' : `${price} E`}</b></button>
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
  const rateAt = (targetLevel: number) => isAccretion
    ? targetLevel * 42 * (accretionPerClick(state) / 120)
    : targetLevel * 64 * (1 + targetLevel * .08) * stellarFusionMultiplier(state);
  const currentRate = rateAt(level);
  const nextGain = rateAt(Math.min(max, level + 1)) - currentRate;
  const unit = isAccretion ? 'ME/s' : 'H/s';
  return `
    <article class="upgrade-card" data-automation-card="${kind}">
      <div class="upgrade-heading"><span class="upgrade-icon">${isAccretion ? 'A' : 'H'}</span><h3>${isAccretion ? 'Akkretionsstrom' : 'Stabiles Wasserstoffbrennen'} <b>${formatCompact(currentRate)} ${unit}</b></h3></div>
      <p>${isAccretion ? 'Zieht kontinuierlich Materie aus der Wolke. Benötigt einen ausgebildeten Protostern.' : 'Fusioniert Wasserstoff automatisch. Wird nach fünf manuellen Reaktionen verfügbar.'}<strong>${isMax ? 'Maximum erreicht' : `Nächste Stufe: +${formatCompact(nextGain)} ${unit}`}</strong></p>
      <div class="level-row">${levelPips(level, max)}</div>
      <button class="${isMax ? 'terminal-button' : 'progress-button'}" data-action="${isAccretion ? 'buy-accretion' : 'buy-fusion'}" ${isMax ? '' : `style="--button-progress:${progress(state.energy, price, unlocked)}%"`} ${disabled(state.energy < price || !unlocked || isMax)}>${isMax ? '' : '<i></i>'}<span data-button-label>${label}</span><b data-button-cost>${isMax ? '—' : `${price} E`}</b></button>
    </article>`;
}

function timelineNodes(tier: CloudTier = state.cloudTier): [Stage, string, string][] {
  if (tier === 0) return [
    ['nebula', 'Urwolke', '10 K'], ['protostar', 'Protostern', 'Verdichtung'], ['brownDwarf', 'Brauner Zwerg', 'Massengrenze'],
  ];
  const shared: [Stage, string, string][] = [
    ['nebula', 'Urwolke', CLOUD_TIERS[tier].shortName], ['protostar', 'Protostern', 'Verdichtung'], ['deuterium', 'D-Brennen', '1 Mio. K'], ['hydrogen', 'H-Brennen', '10 Mio. K'], ['mainSequence', 'Hauptreihe', 'Gleichgewicht'], ['redGiant', 'Roter Riese', 'Kernkontraktion'], ['helium', 'He-Brennen', 'Triple-Alpha'], ['carbonOxygen', 'C/O-Kern', 'Alpha-Einfang'],
  ];
  return tier === 1
    ? [...shared, ['whiteDwarf', 'Weißer Zwerg', 'Stellarer Rest']]
    : [...shared, ['massiveStar', 'Späte Phasen', 'Komprimiert'], ['supernova', 'Supernova', 'Kernkollaps'], [state.outcome === 'blackHole' ? 'blackHole' : 'neutronStar', state.outcome === 'blackHole' ? 'Schwarzes Loch' : 'Sternrest', 'Masse entscheidet']];
}

function timelineMarkup(): string {
  const nodes = timelineNodes();
  const stageIndex = Math.max(0, nodes.findIndex(([key]) => key === state.stage));
  return nodes.map(([key, label, detail], index) => `<div class="timeline-node ${index <= stageIndex ? 'done' : ''} ${key === state.stage ? 'current' : ''}"><i>${index < stageIndex ? '✓' : index + 1}</i><span><b>${label}</b><small>${detail}</small></span></div>`).join('');
}

function evolutionMapMarkup(): string {
  const discovered = new Set(state.discoveredOutcomes);
  const branch = (tier: CloudTier, outcome: 'brownDwarf' | 'whiteDwarf' | 'neutronStar' | 'blackHole', detail: string) => {
    const unlocked = tier <= state.perks.largerCloud;
    const known = discovered.has(outcome);
    const current = state.cloudTier === tier;
    return `<article class="evolution-branch ${unlocked ? 'is-unlocked' : 'is-locked'} ${known ? 'is-discovered' : ''} ${current ? 'is-current' : ''}"><span>WOLKE ${tier + 1}</span><h3>${unlocked ? CLOUD_TIERS[tier].name : 'Unbekannte Wolke'}</h3><p>${unlocked ? detail : 'Über Wolkenwachstum freischalten.'}</p><strong>${known ? `Entdeckt: ${OUTCOME_LABELS[outcome]}` : unlocked ? 'Noch nicht entdeckt' : 'Gesperrt'}</strong></article>`;
  };
  return `<div class="evolution-map">${branch(0, 'brownDwarf', 'Unterhalb der Zündmasse → Brauner Zwerg')}${branch(1, 'whiteDwarf', 'Hauptreihe → Roter Riese → Weißer Zwerg')}<div class="massive-branches">${branch(2, 'neutronStar', 'Supernova bei geringerer Endmasse → Neutronenstern')}${branch(2, 'blackHole', 'Supernova bei hoher Endmasse → Schwarzes Loch')}</div></div>`;
}

function logMarkup(limit = 5): string {
  return state.log.slice(0, limit).map((entry) => `<div class="log-entry ${entry.kind}"><i></i><p>${entry.text}</p></div>`).join('');
}

function panelMarkup(panel: Panel): string {
  if (panel === 'reactions') return renderReactionPanel();
  if (panel === 'upgrades') return `<div class="upgrade-grid">${deuteriumUpgradeCard()}${upgradeCard()}</div>`;
  return `<div class="upgrade-grid automation-grid">${automationCard('accretion')}${automationCard('fusion')}</div>`;
}

const tutorialSteps = [
  { title: 'Materie akkretieren', text: 'Klicke auf den Stern. Ein Teil der Urwolke fällt ins Zentrum und erhöht Masse, Druck und Temperatur.', selector: '.star-button', trigger: 'accrete' },
  { title: 'Den Kern beobachten', text: 'Links siehst du Temperatur, Druck, Energie und Zusammensetzung. Diese Werte bestimmen, welche Reaktionen möglich sind.', selector: '.left-panel', trigger: 'next' },
  { title: 'Sternsysteme steuern', text: 'Öffne einen der drei Tabs. Reaktionen treiben den Stern an, Upgrades verstärken ihn und Automationen übernehmen wiederkehrende Arbeit.', selector: '.side-tabs', trigger: 'panel' },
  { title: 'Entwicklung nachverfolgen', text: 'Öffne die Chronik. Sie zeigt Meilensteine und erklärt, was im Kern deines Sterns geschieht.', selector: '.chronicle-dock', trigger: 'open-chronicle' },
] as const;

function statsEntries(): [string, string, string][] {
  const stats = state.stats;
  return [
    ['clicks', 'Manuelle Klicks', formatNumber(stats.manualClicks)],
    ['matter', 'Akkretiert', `${formatCompact(stats.matterAccreted)} ME`],
    ['automatic-matter', 'Davon automatisch', `${formatCompact(stats.automaticMatterAccreted)} ME`],
    ['fusion', 'Manuelle Fusionen', formatNumber(stats.manualFusionActions)],
    ['hydrogen', 'Wasserstoff fusioniert', `${formatCompact(stats.hydrogenFused)} H`],
    ['helium', 'Helium fusioniert', `${formatCompact(stats.heliumFused)} He`],
    ['oxygen', 'Sauerstoff erzeugt', `${formatCompact(stats.oxygenCreated)} O`],
    ['energy', 'Energie erzeugt', formatCompact(stats.energyGenerated)],
    ['purchases', 'Käufe', formatNumber(stats.upgradesPurchased + stats.automationsPurchased)],
    ['offline', 'Offline-Simulation', formatDuration(stats.offlineSeconds)],
  ];
}

function statsGridMarkup(live = false): string {
  return statsEntries().map(([key, label, value]) => `<div><span>${label}</span><b${live ? ` data-live-stat="${key}"` : ''}>${value}</b></div>`).join('');
}

function historyMarkup(): string {
  if (!state.history.length) return '<p class="empty-history">Noch keine abgeschlossene Runde archiviert.</p>';
  return state.history.slice(0, 5).map((record) => `<article><span>ZYKLUS ${record.run.toString().padStart(2, '0')}</span><b>${OUTCOME_LABELS[record.outcome]}</b><small>${formatCompact(record.finalMass)} ME · ${formatDuration(record.duration)} · +${record.stardustEarned} ✦</small></article>`).join('');
}

function renderShell(): void {
  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Cosmic Clicker Startseite"><span class="brand-mark">${icons.spark}</span><span><b>COSMIC</b><em>CLICKER</em></span></a>
      <div class="run-status"><b data-ui="run">ZYKLUS 01</b></div>
      <div class="header-actions"><div class="resource-menu"><button class="resource-chip" data-action="toggle-perks" aria-label="Aktive Vermächtnis-Perks anzeigen" aria-expanded="false"><span>✦</span><b data-ui="stardust">0</b></button><div class="perk-popover"><span>Aktive Perks</span><div><b>Wolkenwachstum</b><small><i data-ui="cloud-perk-name">Kleine Urwolke</i></small></div><div><b>Gravitatives Gedächtnis</b><small>Stufe <i data-ui="gravity-perk-level">0</i></small></div><div><b>Fusionsgedächtnis</b><small>Stufe <i data-ui="fusion-perk-level">0</i></small></div><p>Neue Stufen werden am Zyklusende gekauft.</p></div></div><div class="sound-menu"><button class="icon-button" data-action="toggle-sound-menu" aria-label="Audioeinstellungen öffnen" aria-expanded="false">${state.soundEnabled ? icons.sound : icons.soundOff}</button><div class="sound-popover"><div><span>Effektlautstärke</span><b data-ui="volume-label">35%</b></div><input data-action="set-volume" aria-label="Effektlautstärke" type="range" min="0" max="100" step="1" value="35"><button data-action="toggle-sound" data-ui="mute-label">Ton stummschalten</button></div></div><button class="icon-button export-button" data-action="export" aria-label="Spielstand exportieren">${icons.download}</button><div class="reset-control"><button class="icon-button reset-button" data-action="reset-menu" aria-label="Neustartoptionen öffnen">${icons.reset}</button><div class="reset-choices"><button data-action="reset-run">Runde neu starten</button><button data-action="reset-full"><span data-full-reset-label>Spielstand löschen</span></button></div></div></div>
    </header>

    <main>
      <section class="mission-strip"><div class="mission-copy"><span data-ui="objective-eyebrow"></span><h2 data-ui="objective-title"></h2><p data-ui="objective-detail"></p></div><div class="mission-progress"><div class="progress-label"><span>Fortschritt</span><b data-ui="objective-percent"></b></div><div class="progress-track"><i data-ui="objective-bar"></i></div></div><div class="elapsed"><span>Laufzeit</span><b data-ui="elapsed"></b></div></section>

      <section class="stellar-lab">
        <aside class="data-panel left-panel">
          <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
          <div class="primary-reading"><span>Kerntemperatur</span><b data-ui="temperature"></b><div class="thermal-scale"><i data-ui="temperature-bar"></i></div><small><span>${formatTemperature(INITIAL_TEMPERATURE)}</span><span data-ui="temperature-max"></span></small></div>
          <div class="metric-grid"><div class="metric"><span>Sternmasse</span><b data-ui="mass"></b><small>ME</small></div><div class="metric"><span>Kerndruck</span><b data-ui="pressure"></b><small>% Zünddruck</small></div><div class="metric"><span>Energie</span><b data-ui="energy"></b><small>verfügbar</small></div><div class="metric"><span>Akkretion</span><b data-ui="accretion-rate"></b><small>ME / Sek.</small></div></div>
          <div class="composition"><div class="section-label"><span>Kernzusammensetzung</span><small data-ui="core-total"></small></div>${MATTER_KEYS.map((key) => `<div class="composition-row" data-matter="${key}"><span class="element ${MATTER_META[key].className}">${MATTER_META[key].symbol}</span><div><b>${MATTER_META[key].label}</b><div class="mini-track"><i data-ui="${key}-bar"></i></div></div><strong data-ui="${key}-value"></strong></div>`).join('')}</div>
          <div class="cloud-stats"><div class="section-label"><span data-ui="cloud-name">Urwolke</span></div><div class="cloud-summary"><div><span>Restmaterie</span><b data-ui="cloud-mass"></b><small data-ui="cloud-initial"></small></div><div class="cloud-mini-gauge"><i class="gauge-ring"></i><b data-ui="cloud-percent"></b></div></div><div class="cloud-elements">${MATTER_KEYS.map((key) => `<div data-cloud-matter="${key}"><span class="element ${MATTER_META[key].className}">${MATTER_META[key].symbol}</span><p><b>${MATTER_META[key].label}</b><strong data-ui="cloud-${key}"></strong></p></div>`).join('')}</div></div>
        </aside>

        <section class="star-chamber">
          <div class="stage-label"><span data-ui="stage"></span><b data-ui="stage-detail"></b></div><div class="orbit orbit-outer"><span></span><span></span></div><div class="orbit orbit-inner"><span></span></div>
          <div class="automation-particles" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i data-auto-particle="${index}">H</i>`).join('')}</div>
          <button class="star-button" data-action="accrete" aria-label="Materie akkretieren"><span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span></button>
          <div class="click-callout"><span data-ui="click-yield"></span><small data-ui="click-detail"></small></div><div class="phase-dots">${Array.from({length:8},(_, index)=>`<i data-phase="${index}"></i>`).join('')}</div>
        </section>

        <aside class="action-sidepanel">
          <div class="sidepanel-heading"><div class="sidepanel-title"><span class="index">02</span><div><small>Kontrollzentrum</small><h2>Sternsysteme</h2></div></div><div class="sidepanel-tools"><button data-action="replay-tutorial" aria-label="Tutorial starten">${icons.help}</button><button data-action="open-stats" aria-label="Statistik öffnen">${icons.stats}</button></div></div>
          <div class="side-tabs" role="tablist" aria-label="Kontrollbereiche">${([['reactions','Reaktionen'],['upgrades','Upgrades'],['automation','Automationen']] as [Panel,string][]).map(([panel,label])=>`<button data-panel="${panel}" role="tab"><span>${label}</span><b class="tab-count" data-tab-count="${panel}" hidden></b></button>`).join('')}</div>
          <div class="side-content" data-ui="deck-content"></div>
        </aside>
      </section>

      <section class="chronicle-dock"><div class="dock-timeline"><div class="section-label"><span>Stellare Entwicklung</span><small>PFAD ${state.cloudTier + 1}</small></div><div class="timeline" data-ui="dock-timeline">${timelineMarkup()}</div></div><div class="dock-log"><div class="section-label"><span>Sternenlogbuch</span><small>LIVE</small></div><div class="log-list" data-ui="dock-log">${logMarkup(2)}</div></div><button class="chronicle-expand" data-action="open-chronicle" aria-label="Chronik öffnen">↗</button></section>
    </main>

    <footer><span>COSMIC CLICKER · PROTOTYP 0.3</span><p>Wissenschaftlich plausibel · spielerisch komprimiert</p><button data-action="import">Spielstand importieren</button><input id="save-import" type="file" accept="application/json" hidden /></footer>
    <div data-ui="overlay-root"></div><div data-ui="tutorial-root"></div><div data-ui="debug-root"></div><div data-ui="toast-root"></div>`;

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
  // Reaction cards are intentionally rendered as a unit because each stellar phase
  // exposes a different set of processes and explanations.
}

function syncProgressButton(action: string, price: number, unlocked: boolean, isMax: boolean, label: string, terminalLabel = 'Maximum'): void {
  const button = app.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (!button) return;
  if (!isMax) button.style.setProperty('--button-progress', `${progress(state.energy, price, unlocked)}%`);
  button.disabled = !unlocked || state.energy < price || isMax;
  button.querySelector('[data-button-label]')!.textContent = isMax ? terminalLabel : label;
  button.querySelector('[data-button-cost]')!.textContent = isMax ? '—' : `${price} E`;
}

function syncActivePanel(): void {
  if (activePanel === 'reactions') syncReactionPanel();
  if (activePanel === 'upgrades') {
    const hasDeuterium = state.star.deuterium > 0 || state.cloud.deuterium > 0;
    const deuteriumUnlocked = hasDeuterium && state.star.deuterium > 0 && state.temperature >= THRESHOLDS.deuteriumTemperature && state.temperature < THRESHOLDS.hydrogenTemperature;
    const deuteriumLabel = state.upgrades.deuteriumBurning ? 'Aktiv' : !hasDeuterium ? 'Kein Deuterium' : state.temperature >= THRESHOLDS.hydrogenTemperature ? 'Phase beendet' : deuteriumUnlocked ? 'Aktivieren' : 'Ab 1 Mio. K';
    syncProgressButton('buy-deuterium', DEUTERIUM_UPGRADE_COST, deuteriumUnlocked, state.upgrades.deuteriumBurning, deuteriumLabel, deuteriumLabel);
    syncProgressButton('buy-gravity', gravityCost(state.upgrades.gravity), true, state.upgrades.gravity >= LIMITS.gravity, 'Verdichten');
    setText('gravity-multiplier', `×${formatNumber(1 + state.upgrades.gravity * .55 + state.perks.permanentGravity * .12, 2)}`);
  }
  if (activePanel === 'automation') {
    syncProgressButton('buy-accretion', accretionCost(state.automation.accretion), starMass(state) >= THRESHOLDS.protostarMass, state.automation.accretion >= LIMITS.accretion, starMass(state) >= THRESHOLDS.protostarMass ? 'Ausbauen' : 'Noch instabil');
    syncProgressButton('buy-fusion', fusionCost(state.automation.fusion), state.manualFusions >= 5, state.automation.fusion >= LIMITS.fusion, state.manualFusions >= 5 ? 'Ausbauen' : `${state.manualFusions}/5 Reaktionen`);
  }
}

function syncChronicleDock(): void {
  const signature = `${state.stage}:${state.log.map((entry) => entry.id).join(',')}`;
  if (signature === lastLogSignature) return;
  const timeline = app.querySelector<HTMLElement>('[data-ui="dock-timeline"]');
  const logList = app.querySelector<HTMLElement>('[data-ui="dock-log"]');
  if (timeline) timeline.innerHTML = timelineMarkup();
  if (logList) logList.innerHTML = logMarkup(2);
  lastLogSignature = signature;
}

function markOpportunitiesSeen(panel: Panel, opportunities: Record<Panel, string[]>): void {
  let changed = false;
  opportunities[panel].forEach((key) => {
    if (state.seenOpportunities.includes(key)) return;
    state.seenOpportunities.push(key);
    changed = true;
  });
  if (changed) saveGame(state);
}

function flashUnlockedTab(panel: Panel): void {
  const button = app.querySelector<HTMLButtonElement>(`[data-panel="${panel}"]`);
  if (!button) return;
  button.classList.remove('unlock-flash');
  void button.offsetWidth;
  button.classList.add('unlock-flash');
  button.addEventListener('animationend', () => button.classList.remove('unlock-flash'), { once: true });
}

function syncNotifications(): void {
  const opportunities = currentOpportunities();
  const previous = new Set(lastOpportunitySignature ? lastOpportunitySignature.split('|') : []);
  const unseenBeforeOpening = (Object.keys(opportunities) as Panel[]).reduce<Record<Panel, string[]>>((result, panel) => {
    result[panel] = opportunities[panel].filter((key) => !state.seenOpportunities.includes(key));
    return result;
  }, { reactions: [], upgrades: [], automation: [] });
  const newlyUnlocked = notificationsInitialized
    ? (Object.keys(opportunities) as Panel[]).filter((panel) => unseenBeforeOpening[panel].some((key) => !previous.has(key)))
    : [];
  const newlyAvailable = (Object.keys(opportunities) as Panel[]).reduce<Record<Panel, string[]>>((result, panel) => {
    result[panel] = unseenBeforeOpening[panel].filter((key) => !previous.has(key));
    return result;
  }, { reactions: [], upgrades: [], automation: [] });

  markOpportunitiesSeen(activePanel, opportunities);
  (Object.keys(opportunities) as Panel[]).forEach((panel) => {
    const button = app.querySelector<HTMLButtonElement>(`[data-panel="${panel}"]`);
    const count = app.querySelector<HTMLElement>(`[data-tab-count="${panel}"]`);
    const unreadCount = panel === activePanel ? 0 : opportunities[panel].filter((key) => !state.seenOpportunities.includes(key)).length;
    button?.classList.toggle('has-notice', unreadCount > 0);
    if (count) {
      count.textContent = unreadCount ? String(unreadCount) : '';
      count.hidden = unreadCount === 0;
    }
  });

  if (newlyUnlocked.length) {
    newlyUnlocked.forEach(flashUnlockedTab);
    playSound('unlock', state.soundEnabled, state.volume);
    const automationIsNew = newlyAvailable.automation.some((key) => key.endsWith(':0'));
    const messages: Record<Panel, string> = { reactions: 'Neue Reaktion verfügbar.', upgrades: 'Neues Upgrade verfügbar.', automation: automationIsNew ? 'Neue Automation verfügbar.' : 'Automation kann ausgebaut werden.' };
    showToast(newlyUnlocked.length === 1 ? messages[newlyUnlocked[0]] : 'Neue Sternsysteme verfügbar.');
  }
  lastOpportunitySignature = (Object.keys(opportunities) as Panel[]).flatMap((panel) => opportunities[panel]).join('|');
  notificationsInitialized = true;
}

function syncLiveStats(root: HTMLElement): void {
  statsEntries().forEach(([key, , value]) => {
    const element = root.querySelector<HTMLElement>(`[data-live-stat="${key}"]`);
    if (element && element.textContent !== value) element.textContent = value;
  });
}

function syncOverlay(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="overlay-root"]');
  if (!root) return;
  const objective = objectiveFor(state);
  const introNeedsDecision = !state.tutorial.introSeen;
  const objectiveNeedsAcknowledgement = state.tutorial.completed && !state.completed && !state.seenObjectives.includes(objective.id);
  if (!state.summaryOpen && !chronicleOpen && !statsOpen && !introNeedsDecision && !objectiveNeedsAcknowledgement) { if (root.innerHTML) root.innerHTML = ''; overlaySignature = ''; return; }
  if (introNeedsDecision) {
    if (overlaySignature === 'intro') return;
    overlaySignature = 'intro';
    root.innerHTML = `<div class="modal-backdrop intro-backdrop"><section class="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-description"><div class="intro-brand"><span>COSMIC</span><b>CLICKER</b></div><small>DEIN KOSMISCHES EXPERIMENT</small><span class="intro-star">${icons.spark}</span><h2 id="intro-title">Entdecke das Schicksal der Sterne.</h2><p id="intro-description">Beginne mit einer kleinen Wolke aus kaltem Wasserstoff. Sammle Materie und finde heraus, warum nicht jede Wolke einen echten Stern zünden kann.</p><div class="intro-pillars"><div><b>01</b><span>Materie sammeln</span><small>Forme aus der Urwolke einen Protostern.</small></div><div><b>02</b><span>Massengrenzen entdecken</span><small>Die Masse bestimmt den möglichen Lebensweg.</small></div><div><b>03</b><span>Kosmos erweitern</span><small>Nutze Sternenstaub für größere Wolken.</small></div></div><div class="intro-actions"><button class="primary-action" data-action="start-intro-tutorial" aria-label="Tutorial starten"><span>Tutorial starten</span><small>Kurze geführte Tour</small></button><button class="intro-secondary" data-action="skip-intro-tutorial">Ohne Tutorial starten</button></div></section></div>`;
    return;
  }
  if (objectiveNeedsAcknowledgement && !chronicleOpen && !statsOpen && !state.summaryOpen) {
    const objectiveSignature = `objective:${state.run}:${objective.id}`;
    if (objectiveSignature === overlaySignature) return;
    overlaySignature = objectiveSignature;
    root.innerHTML = `<div class="modal-backdrop objective-backdrop"><section class="objective-modal" role="dialog" aria-modal="true" aria-labelledby="objective-title"><small>${objective.eyebrow}</small><span class="objective-mark">${icons.spark}</span><h2 id="objective-title">${objective.title}</h2><p>${objective.detail}</p><button class="primary-action" data-action="acknowledge-objective">Okay</button></section></div>`;
    return;
  }
  if (chronicleOpen && !state.summaryOpen) {
    const chronicleSignature = `chronicle:${state.stage}:${state.log.map((entry) => entry.id).join(',')}`;
    if (chronicleSignature === overlaySignature) return;
    overlaySignature = chronicleSignature;
    root.innerHTML = `<div class="modal-backdrop" data-overlay-dismiss="chronicle" role="presentation"><section class="chronicle-modal" role="dialog" aria-modal="true" aria-labelledby="chronicle-title"><div class="chronicle-modal-heading"><div><small>KOSMISCHE CHRONIK</small><h2 id="chronicle-title">Lebenswege der Sterne</h2></div><button data-action="close-chronicle" aria-label="Chronik schließen">×</button></div><div class="chronicle-layout"><div class="timeline-card"><div class="section-label"><span>Aktueller Entwicklungspfad</span><small>${CLOUD_TIERS[state.cloudTier].name}</small></div><div class="timeline">${timelineMarkup()}</div>${evolutionMapMarkup()}</div><div class="log-card"><div class="section-label"><span>Sternenlogbuch</span><small>LIVE</small></div><div class="log-list">${logMarkup(10)}</div></div></div></section></div>`;
    return;
  }
  if (statsOpen && !state.summaryOpen) {
    const statsSignature = `stats:${state.run}:${state.history.length}`;
    if (statsSignature !== overlaySignature) {
      overlaySignature = statsSignature;
      root.innerHTML = `<div class="modal-backdrop" data-overlay-dismiss="stats" role="presentation"><section class="stats-modal" role="dialog" aria-modal="true" aria-labelledby="stats-title"><div class="chronicle-modal-heading"><div><small>RUNDENANALYSE</small><h2 id="stats-title">Statistik · Zyklus ${state.run.toString().padStart(2, '0')}</h2></div><button data-action="close-stats" aria-label="Statistik schließen">×</button></div><div class="stats-modal-body"><div class="run-stat-grid">${statsGridMarkup(true)}</div><div class="round-history"><div class="section-label"><span>Vergangene Runden</span><small>${state.history.length} ARCHIVIERT</small></div>${historyMarkup()}</div></div></section></div>`;
    }
    syncLiveStats(root);
    return;
  }
  const signature = `summary:${state.stardust}:${state.perks.largerCloud}:${state.perks.permanentGravity}:${state.perks.fusionMemory}:${state.nextCloudTier}:${state.outcome}`;
  if (signature === overlaySignature) return;
  overlaySignature = signature;
  const cloudCost = cloudTierCost(state.perks.largerCloud);
  const gravityCostValue = gravityPerkCost(state.perks.permanentGravity);
  const fusionCostValue = fusionPerkCost(state.perks.fusionMemory);
  const cloudMax = state.perks.largerCloud >= LIMITS.cloudTier;
  const gravityMax = state.perks.permanentGravity >= LIMITS.permanentGravity;
  const fusionMax = state.perks.fusionMemory >= LIMITS.fusionMemory;
  const outcome = state.outcome ?? 'legacyMainSequence';
  const outcomeCopy = {
    brownDwarf: ['Eine Massengrenze wird sichtbar.', 'Die kleine Wolke wurde vollständig gebunden, blieb aber zu leicht für dauerhaftes Wasserstoffbrennen.'],
    whiteDwarf: ['Ein Weißer Zwerg bleibt zurück.', 'Der sonnenähnliche Stern hat seine Hülle abgestoßen. Sein Kohlenstoff-Sauerstoff-Kern glüht weiter.'],
    neutronStar: ['Ein Neutronenstern entsteht.', 'Die Supernova hat einen extrem dichten kompakten Sternrest hinterlassen.'],
    blackHole: ['Ein Schwarzes Loch entsteht.', 'Die Endmasse war so groß, dass kein bekannter Druck den Kollaps aufhalten konnte.'],
    legacyMainSequence: ['Ein Hauptreihenstern wurde archiviert.', 'Dieser Abschluss stammt aus dem v0.2-Lebenszyklus.'],
  }[outcome];
  const cloudChoices = ([0, 1, 2] as CloudTier[]).filter((tier) => tier <= state.perks.largerCloud).map((tier) => `<button class="cloud-choice ${state.nextCloudTier === tier ? 'is-selected' : ''}" data-action="select-cloud-${tier}"><span>${CLOUD_TIERS[tier].shortName}</span><small>${tier === 0 ? 'Brauner Zwerg' : tier === 1 ? 'Weißer Zwerg' : 'Supernova'}</small></button>`).join('');
  root.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div class="summary-heading"><span class="modal-star">${icons.spark}</span><div><small>ZYKLUS ${state.run.toString().padStart(2, '0')} · ${OUTCOME_LABELS[outcome]}</small><h2 id="summary-title">${outcomeCopy[0]}</h2><p>${outcomeCopy[1]}</p></div></div><div class="summary-stats"><div><span>Endmasse</span><b>${formatCompact(starMass(state))} ME</b></div><div><span>Rundendauer</span><b>${formatDuration(state.elapsed)}</b></div><div><span>Sternenstaub erhalten</span><b>+${state.stats.stardustEarned} ✦</b></div></div><div class="summary-detail"><div class="summary-section-title"><span>Rundenauswertung</span><small>ZYKLUS ${state.run.toString().padStart(2, '0')}</small></div><div class="run-stat-grid compact">${statsGridMarkup()}</div></div><div class="summary-legacy"><div class="summary-section-title"><span>Vermächtnis wählen</span><small>DAUERHAFTE EFFEKTE</small></div><div class="summary-perk-grid"><article><span class="perk-orbit">01</span><div><h3>Wolkenwachstum</h3><p>Schaltet die nächste Wolkengröße und neue Sternpfade frei.</p><strong>${CLOUD_TIERS[Math.min(2, state.perks.largerCloud) as CloudTier].name}</strong></div><button data-action="buy-perk-cloud" ${disabled(cloudMax || state.stardust < cloudCost)}>${cloudMax ? 'MAX' : `+${cloudCost} ✦`}</button></article><article><span class="perk-orbit">02</span><div><h3>Gravitatives Gedächtnis</h3><p>+12 % Akkretionsrate pro Stufe</p><strong>Stufe ${state.perks.permanentGravity}</strong></div><button data-action="buy-perk-gravity" ${disabled(gravityMax || state.stardust < gravityCostValue)}>${gravityMax ? 'MAX' : `+${gravityCostValue} ✦`}</button></article><article><span class="perk-orbit">03</span><div><h3>Fusionsgedächtnis</h3><p>+15 % manuelle und automatische Fusion pro Stufe</p><strong>Stufe ${state.perks.fusionMemory}</strong></div><button data-action="buy-perk-fusion" ${disabled(fusionMax || state.stardust < fusionCostValue)}>${fusionMax ? 'MAX' : `+${fusionCostValue} ✦`}</button></article></div><div class="cloud-selection"><div class="summary-section-title"><span>Nächste Urwolke</span><small>${CLOUD_TIERS[state.nextCloudTier].description}</small></div><div>${cloudChoices}</div></div></div><div class="summary-actions"><button class="primary-action" data-action="prestige">Mit ${CLOUD_TIERS[state.nextCloudTier].name} beginnen</button><button class="text-action" data-action="close-summary">Später entscheiden</button></div></section></div>`;
}

function syncToast(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="toast-root"]');
  if (!root) return;
  if (!toastMessages.length) { if (root.innerHTML) root.innerHTML = ''; return; }
  let stack = root.querySelector<HTMLElement>('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; root.append(stack); }
  const activeIds = new Set(toastMessages.map((message) => String(message.id)));
  stack.querySelectorAll<HTMLElement>('.toast').forEach((element) => {
    if (!activeIds.has(element.dataset.toastId ?? '')) element.remove();
  });
  const entering: HTMLElement[] = [];
  toastMessages.forEach((message) => {
    let element = stack!.querySelector<HTMLElement>(`[data-toast-id="${message.id}"]`);
    if (!element) {
      element = document.createElement('div'); element.className = 'toast is-entering'; element.dataset.toastId = String(message.id); element.setAttribute('role', 'status'); element.setAttribute('aria-atomic', 'true'); element.textContent = message.text; stack!.append(element); entering.push(element);
    }
    element.classList.toggle('is-leaving', message.leaving);
  });
  let offset = 0;
  toastMessages.forEach((message) => {
    const element = stack!.querySelector<HTMLElement>(`[data-toast-id="${message.id}"]`);
    if (!element) return;
    element.style.setProperty('--toast-offset', `${offset}px`);
    offset += element.getBoundingClientRect().height + 8;
  });
  if (entering.length) window.requestAnimationFrame(() => entering.forEach((element) => element.classList.remove('is-entering')));
}

function setTutorial(step: number, completed = false): void {
  state.tutorial = { ...state.tutorial, step: Math.max(0, Math.min(tutorialSteps.length - 1, step)), completed };
  saveGame(state);
  syncTutorial();
  overlaySignature = '';
  syncOverlay();
}

function resolveIntro(startTutorial: boolean): void {
  state.tutorial = { ...state.tutorial, introSeen: true, completed: !startTutorial, step: 0 };
  saveGame(state);
  overlaySignature = '';
  tutorialSignature = '';
  syncOverlay();
  syncTutorial();
  if (!startTutorial) showToast('Tutorial übersprungen. Über ? kannst du es erneut starten.');
}

function positionTutorialSpotlight(target: Element): void {
  const spotlight = app.querySelector<HTMLElement>('.tutorial-spotlight');
  if (!spotlight) return;
  const rect = target.getBoundingClientRect();
  const padding = 18;
  spotlight.style.left = `${Math.max(4, rect.left - padding)}px`;
  spotlight.style.top = `${Math.max(4, rect.top - padding)}px`;
  spotlight.style.width = `${Math.min(window.innerWidth - 8, rect.width + padding * 2)}px`;
  spotlight.style.height = `${Math.min(window.innerHeight - 8, rect.height + padding * 2)}px`;
}

function queueTutorialSpotlightPosition(): void {
  if (tutorialSpotlightFrame) return;
  tutorialSpotlightFrame = window.requestAnimationFrame(() => {
    tutorialSpotlightFrame = 0;
    if (!state.tutorial.introSeen || state.tutorial.completed) return;
    const step = tutorialSteps[state.tutorial.step] ?? tutorialSteps[0];
    const target = app.querySelector(step.selector);
    if (target) positionTutorialSpotlight(target);
  });
}

function syncTutorial(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="tutorial-root"]');
  if (!root) return;
  app.querySelectorAll('.tutorial-focus').forEach((element) => element.classList.remove('tutorial-focus'));
  if (!state.tutorial.introSeen || state.tutorial.completed) {
    if (root.innerHTML) root.innerHTML = '';
    tutorialSignature = state.tutorial.introSeen ? 'completed' : 'waiting-for-intro';
    return;
  }
  const step = tutorialSteps[state.tutorial.step] ?? tutorialSteps[0];
  const target = app.querySelector(step.selector);
  target?.classList.add('tutorial-focus');
  const signature = `step:${state.tutorial.step}`;
  if (signature !== tutorialSignature) {
    tutorialSignature = signature;
    if (target && window.matchMedia('(max-width: 1100px)').matches) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }
    const interactionHint = step.trigger === 'accrete' ? 'Klicke auf den markierten Stern.'
      : step.trigger === 'panel' ? 'Öffne einen markierten Tab.'
        : step.trigger === 'open-chronicle' ? 'Öffne die markierte Chronik.' : '';
    root.innerHTML = `<div class="tutorial-spotlight" aria-hidden="true"></div><aside class="tutorial-card" aria-label="Tutorial"><div><span>TUTORIAL · ${state.tutorial.step + 1}/${tutorialSteps.length}</span><button data-action="skip-tutorial">Überspringen</button></div><h2>${step.title}</h2><p>${step.text}</p>${interactionHint ? `<small>${interactionHint}</small>` : `<button class="tutorial-next" data-action="tutorial-next">Weiter</button>`}</aside>`;
  }
  if (target) positionTutorialSpotlight(target);
}

function advanceTutorial(trigger: string): void {
  if (state.tutorial.completed || tutorialSteps[state.tutorial.step]?.trigger !== trigger) return;
  if (state.tutorial.step >= tutorialSteps.length - 1) setTutorial(state.tutorial.step, true);
  else setTutorial(state.tutorial.step + 1);
}

function moveDebugMatter(targetMass: number): void {
  const current = starMass(state);
  const available = cloudMass(state);
  const amount = Math.min(Math.max(0, targetMass - current), available);
  if (amount <= 0) return;
  const ratio = amount / available;
  MATTER_KEYS.forEach((key) => {
    const moved = state.cloud[key] * ratio;
    state.cloud[key] -= moved;
    state.star[key] += moved;
  });
  state.stats.matterAccreted += amount;
  state = tick(state, 0);
}

function runDebugAction(action: string): void {
  if (!import.meta.hot) return;
  if (action === 'close') { debugOpen = false; syncDebug(); return; }
  if (action.startsWith('cloud-')) {
    const tier = Number(action.slice(-1)) as CloudTier;
    const perks = { ...state.perks, largerCloud: Math.max(state.perks.largerCloud, tier) };
    state = createInitialState(perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: tier, nextCloudTier: tier, discoveredOutcomes: state.discoveredOutcomes });
  }
  if (action === 'energy') state.energy += 2_000;
  if (action === 'protostar') moveDebugMatter(2_000);
  if (action === 'deuterium') moveDebugMatter(8_000);
  if (action === 'hydrogen') { moveDebugMatter(34_000); state.energy = Math.max(state.energy, 1_000); state = tick(state, 0); }
  if (action === 'fusion-ready') { moveDebugMatter(34_000); state.manualFusions = Math.max(5, state.manualFusions); state.energy = Math.max(state.energy, 2_000); state = tick(state, 0); }
  if (action === 'main' || action === 'helium' || action === 'oxygen' || action === 'complete') {
    if (state.cloudTier === 0 && action !== 'complete') {
      state = createInitialState({ ...state.perks, largerCloud: Math.max(1, state.perks.largerCloud) }, state.stardust, Math.max(2, state.run), { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: 1, nextCloudTier: 1, discoveredOutcomes: state.discoveredOutcomes });
    }
    if (state.cloudTier === 0) moveDebugMatter(cloudMass(state));
    else {
      moveDebugMatter(state.cloudTier === 2 ? 110_000 : 45_000);
      state.energy = Math.max(state.energy, 10_000);
      state = tick(state, 0);
      while (state.stage === 'hydrogen') state = reduceGame(state, { type: 'FUSE_HYDROGEN' });
      if (action !== 'main') {
        if (state.stage === 'mainSequence') state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
        if (state.stage === 'redGiant') state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
        if (action === 'oxygen' || action === 'complete') {
          while (state.stage === 'helium') state = reduceGame(state, { type: 'FUSE_HELIUM' });
          while (state.stage === 'carbonOxygen' && state.stats.oxygenCreated < THRESHOLDS.oxygenCore) state = reduceGame(state, { type: 'CREATE_OXYGEN' });
          if (action === 'complete') {
            while (!state.completed) state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
          }
        }
      }
    }
  }
  if (action === 'fresh') state = createInitialState(state.perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: state.cloudTier, nextCloudTier: state.nextCloudTier, discoveredOutcomes: state.discoveredOutcomes });
  saveGame(state);
  updateUI(true);
  syncDebug();
}

function syncDebug(): void {
  if (!import.meta.hot) return;
  const root = app.querySelector<HTMLElement>('[data-ui="debug-root"]');
  if (!root) return;
  if (!debugOpen) { if (root.innerHTML) root.innerHTML = ''; debugSignature = 'closed'; return; }
  const signature = `${state.stage}:${Math.round(starMass(state))}:${Math.round(state.temperature)}:${Math.round(state.energy)}:${state.stats.manualClicks + state.stats.manualFusionActions + state.stats.deuteriumBurns}`;
  if (signature === debugSignature) return;
  debugSignature = signature;
  root.innerHTML = `<aside class="debug-panel" aria-label="Debug- und Balance-Modus"><div><span>DEV · BALANCE</span><button data-debug="close" aria-label="Debug-Modus schließen">×</button></div><dl><div><dt>Stufe</dt><dd>${STAGE_LABELS[state.stage]}</dd></div><div><dt>Wolke</dt><dd>${CLOUD_TIERS[state.cloudTier].shortName}</dd></div><div><dt>Masse</dt><dd>${formatCompact(starMass(state))} ME</dd></div><div><dt>Temperatur</dt><dd>${formatTemperature(state.temperature)}</dd></div><div><dt>Energie</dt><dd>${formatCompact(state.energy)}</dd></div><div><dt>Aktionen</dt><dd>${formatNumber(state.stats.manualClicks + state.stats.manualFusionActions + state.stats.manualHeliumActions)}</dd></div></dl><div class="debug-actions"><button data-debug="cloud-0">Kleine Wolke</button><button data-debug="cloud-1">Stellare Wolke</button><button data-debug="cloud-2">Massereiche Wolke</button><button data-debug="energy">+2.000 Energie</button><button data-debug="protostar">Protostern</button><button data-debug="hydrogen">H-Brennen</button><button data-debug="main">Hauptreihe</button><button data-debug="helium">He-Brennen</button><button data-debug="oxygen">C/O-Kern</button><button data-debug="complete">Runde abschließen</button><button data-debug="fresh">Runde zurücksetzen</button></div><p>v0.3-Pfade lassen sich vollständig im Dev-Server simulieren.</p></aside>`;
}

function updateUI(forcePanel = false): void {
  const objective = objectiveFor(state);
  const mass = starMass(state);
  const remaining = cloudMass(state);
  const starTotal = Math.max(1, mass);
  const initialCloud = MATTER_KEYS.reduce((sum, key) => sum + CLOUD_TIERS[state.cloudTier].matter[key], 0);
  const scale = temperatureScale(state.temperature);
  const nodes = timelineNodes();
  const stageIndex = Math.max(0, nodes.findIndex(([stage]) => stage === state.stage));
  const stageChanged = state.stage !== lastStage;

  setText('run', `ZYKLUS ${state.run.toString().padStart(2, '0')}`); setText('stardust', formatNumber(state.stardust)); setText('elapsed', formatDuration(state.elapsed)); setText('cloud-perk-name', CLOUD_TIERS[state.perks.largerCloud as CloudTier].name); setText('gravity-perk-level', String(state.perks.permanentGravity)); setText('fusion-perk-level', String(state.perks.fusionMemory));
  setText('objective-eyebrow', objective.eyebrow); setText('objective-title', objective.title); setText('objective-detail', objective.detail); setText('objective-percent', `${formatNumber(objective.progress, 1)}%`); setWidth('objective-bar', objective.progress);
  setText('temperature', formatTemperature(state.temperature)); setText('temperature-max', scale.label); app.querySelector<HTMLElement>('[data-ui="temperature-bar"]')?.style.setProperty('clip-path', `inset(0 ${100 - scale.progress}% 0 0)`);
  setText('mass', formatCompact(mass)); setText('pressure', formatNumber(pressureProgress(state), 1)); setText('energy', formatCompact(state.energy)); setText('accretion-rate', formatCompact(accretionPerSecond(state))); setText('core-total', `${formatCompact(mass)} ME`);
  MATTER_KEYS.forEach((key) => {
    const percent = matterPercent(state.star[key], starTotal);
    setWidth(`${key}-bar`, key === 'deuterium' && state.star[key] > 0 ? Math.max(1, percent) : percent);
    setText(`${key}-value`, key === 'deuterium' ? formatNumber(state.star[key], 1) : `${formatNumber(percent, 1)}%`);
    setText(`cloud-${key}`, key === 'deuterium' ? formatNumber(state.cloud[key], 1) : formatCompact(state.cloud[key]));
    const coreElement = app.querySelector<HTMLElement>(`[data-matter="${key}"]`);
    const cloudElement = app.querySelector<HTMLElement>(`[data-cloud-matter="${key}"]`);
    const lateElementVisible = key === 'carbon' ? ['helium', 'carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'].includes(state.stage) : key === 'oxygen' && ['carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'].includes(state.stage);
    if (coreElement) coreElement.hidden = state.star[key] <= 0 && CLOUD_TIERS[state.cloudTier].matter[key] <= 0 && !lateElementVisible;
    if (cloudElement) cloudElement.hidden = CLOUD_TIERS[state.cloudTier].matter[key] <= 0;
  });
  const hydrogenOnly = state.cloudTier === 0;
  app.querySelector('.cloud-elements')?.classList.toggle('hydrogen-only', hydrogenOnly);
  app.querySelectorAll<HTMLElement>('[data-auto-particle]').forEach((particle, index) => { particle.textContent = hydrogenOnly || index % 5 !== 4 ? 'H' : 'He'; });
  const stageDetails: Record<Stage, string> = { nebula: 'Kalte Ausgangswolke', protostar: 'Gravitative Kontraktion', deuterium: 'Frühe Kernheizung', hydrogen: 'Wasserstoff wird zu Helium', mainSequence: 'Hydrostatisches Gleichgewicht', redGiant: 'Hülle expandiert', helium: 'Triple-Alpha-Prozess', carbonOxygen: 'Entarteter C/O-Kern', massiveStar: 'Späte Brennphasen', supernova: 'Explosiver Kernkollaps', brownDwarf: 'Unterhalb der Zündmasse', whiteDwarf: 'Freigelegter C/O-Kern', neutronStar: 'Entartete Neutronenmaterie', blackHole: 'Ereignishorizont' };
  setText('stage', STAGE_LABELS[state.stage]); setText('stage-detail', stageDetails[state.stage]); setText('cloud-name', CLOUD_TIERS[state.cloudTier].name);
  const star = app.querySelector<HTMLButtonElement>('.star-button');
  if (star) { star.className = `star-button stage-${state.stage}`; star.disabled = state.completed || remaining <= 0; }
  const chamber = app.querySelector<HTMLElement>('.star-chamber');
  chamber?.style.setProperty('--star-scale', String(Math.min(1, Math.max(.1, mass / 70_000)))); chamber?.style.setProperty('--temp-scale', String(Math.min(1, state.temperature / THRESHOLDS.heliumTemperature)));
  chamber?.style.setProperty('--auto-accretion-duration', `${Math.max(1.45, 3.2 - state.automation.accretion * .2)}s`);
  chamber?.classList.toggle('has-auto-accretion', state.automation.accretion > 0 && !state.completed && remaining > 0);
  setText('click-yield', state.completed ? OUTCOME_LABELS[state.outcome ?? 'legacyMainSequence'].toUpperCase() : remaining <= 0 ? 'WOLKE ERSCHÖPFT' : `+${formatNumber(accretionPerClick(state))} ME`); setText('click-detail', state.completed ? 'Zyklus abgeschlossen' : remaining <= 0 ? 'Entwicklung über Reaktionen fortsetzen' : 'Klicken zum Akkretieren');
  app.querySelectorAll<HTMLElement>('[data-phase]').forEach((dot) => { const normalizedStage = nodes.length <= 1 ? 7 : Math.round(stageIndex / (nodes.length - 1) * 7); dot.classList.toggle('active', Number(dot.dataset.phase) <= normalizedStage); });
  const cloudPercent = remaining / initialCloud * 100; setText('cloud-percent', `${formatNumber(cloudPercent, 1)}%`); setText('cloud-mass', `${formatCompact(remaining)} ME`); setText('cloud-initial', `von ${formatCompact(initialCloud)} ME`); app.querySelector<HTMLElement>('.gauge-ring')?.style.setProperty('--remaining', `${cloudPercent / 100 * 360}deg`);
  const soundButton = app.querySelector<HTMLButtonElement>('[data-action="toggle-sound-menu"]'); if (soundButton) { soundButton.innerHTML = state.soundEnabled ? icons.sound : icons.soundOff; soundButton.ariaLabel = 'Audioeinstellungen öffnen'; }
  const volumeInput = app.querySelector<HTMLInputElement>('[data-action="set-volume"]'); if (volumeInput && Number(volumeInput.value) !== Math.round(state.volume * 100)) volumeInput.value = String(Math.round(state.volume * 100));
  setText('volume-label', `${Math.round(state.volume * 100)}%`); setText('mute-label', state.soundEnabled ? 'Ton stummschalten' : 'Ton einschalten');
  if (forcePanel || stageChanged) { const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(activePanel); lastStage = state.stage; }
  syncNotifications(); syncActivePanel(); syncChronicleDock(); syncOverlay(); syncTutorial(); syncToast();
  if (import.meta.hot) syncDebug();
}

function switchPanel(panel: Panel, markSeen = true): void {
  activePanel = panel;
  app.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => { const active = button.dataset.panel === panel; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(panel);
  syncActivePanel();
  if (markSeen) markOpportunitiesSeen(panel, currentOpportunities());
  syncNotifications();
}

function dispatch(action: GameAction): void {
  const wasCompleted = state.completed;
  state = reduceGame(state, action);
  saveGame(state);
  if (['BUY_DEUTERIUM', 'BUY_GRAVITY', 'BUY_ACCRETION', 'BUY_FUSION', 'BUY_PERK'].includes(action.type)) switchPanel(activePanel, false);
  updateUI(true);
  if (!wasCompleted && state.completed) playSound('complete', state.soundEnabled, state.volume);
}

function showToast(message: string): void {
  const toastMessage: ToastMessage = { id: ++toastSequence, text: message, leaving: false };
  toastMessages = [toastMessage, ...toastMessages]; syncToast();
  toastTimers.set(toastMessage.id, window.setTimeout(() => dismissToast(toastMessage.id), 3_200));
}

function dismissToast(id: number): void {
  const message = toastMessages.find((item) => item.id === id);
  if (!message || message.leaving) return;
  message.leaving = true; syncToast();
  toastTimers.set(id, window.setTimeout(() => {
    toastMessages = toastMessages.filter((item) => item.id !== id); toastTimers.delete(id); syncToast();
  }, 320));
}

function clearToasts(): void {
  toastTimers.forEach((timer) => window.clearTimeout(timer)); toastTimers.clear(); toastMessages = []; syncToast();
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
  if (mode === 'full') { clearSave(); state = createInitialState(); clearToasts(); }
  else state = createInitialState(state.perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: state.tutorial, history: state.history, cloudTier: state.cloudTier, nextCloudTier: state.nextCloudTier, discoveredOutcomes: state.discoveredOutcomes });
  activePanel = 'reactions'; switchPanel('reactions', false); saveGame(state); updateUI(true);
  if (mode === 'run') showToast('Der aktuelle Zyklus wurde neu gestartet.');
}

function createActionFeedback(container: HTMLElement, text: string, kind: string): void {
  const feedback = document.createElement('span'); feedback.className = `action-feedback ${kind}`; feedback.textContent = text; container.append(feedback);
  feedback.addEventListener('animationend', () => feedback.remove(), { once: true });
}

function playAccretionFeedback(event: MouseEvent): void {
  const chamber = app.querySelector<HTMLElement>('.star-chamber'); const star = app.querySelector<HTMLElement>('.star-button');
  if (!chamber || !star) return;
  const chamberRect = chamber.getBoundingClientRect(); const starRect = star.getBoundingClientRect();
  const keyboardTriggered = event.detail === 0 || event.clientX === 0 && event.clientY === 0;
  const targetX = keyboardTriggered ? starRect.left + starRect.width / 2 - chamberRect.left : event.clientX - chamberRect.left;
  const targetY = keyboardTriggered ? starRect.top + starRect.height / 2 - chamberRect.top : event.clientY - chamberRect.top;
  const count = 5 + Math.floor(Math.random() * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2; const radius = Math.max(chamberRect.width, chamberRect.height) * (.32 + Math.random() * .24);
    const particle = document.createElement('span'); particle.className = 'matter-particle';
    particle.style.left = `${targetX}px`; particle.style.top = `${targetY}px`; particle.style.setProperty('--from-x', `${Math.cos(angle) * radius}px`); particle.style.setProperty('--from-y', `${Math.sin(angle) * radius}px`); particle.style.setProperty('--particle-delay', `${index * 28}ms`);
    particle.textContent = state.cloudTier === 0 || Math.random() <= .82 ? 'H' : 'He';
    chamber.append(particle); particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
  const gainX = targetX + (Math.random() - .5) * 36; const gainY = targetY - 20 - Math.random() * 22;
  const gain = document.createElement('span'); gain.className = 'accretion-gain'; gain.textContent = `+${formatNumber(accretionPerClick(state))} ME`; gain.style.left = `${gainX}px`; gain.style.top = `${gainY}px`; gain.style.setProperty('--gain-delay', `${count * 28 + 120}ms`); chamber.append(gain); gain.addEventListener('animationend', () => gain.remove(), { once: true });
  star.animate([{ transform: 'scale(1)' }, { transform: 'scale(.965)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
}

function playActionFeedback(action: string, event: MouseEvent): void {
  const sounds: Partial<Record<string, SoundEffect>> = { accrete: 'accrete', 'buy-deuterium': 'deuterium', 'fuse-hydrogen': 'fusion', 'fuse-helium': 'fusion', 'create-oxygen': 'fusion', 'advance-evolution': 'unlock', 'buy-gravity': 'purchase', 'buy-accretion': 'purchase', 'buy-fusion': 'purchase', 'buy-perk-cloud': 'purchase', 'buy-perk-gravity': 'purchase', 'buy-perk-fusion': 'purchase' };
  if (sounds[action]) playSound(sounds[action], state.soundEnabled, state.volume);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (action === 'accrete') playAccretionFeedback(event);
  if (['fuse-hydrogen', 'fuse-helium', 'create-oxygen'].includes(action)) {
    const selector = action === 'fuse-hydrogen' ? '[data-card="fusion"]' : action === 'fuse-helium' ? '[data-card="helium-fusion"]' : '[data-card="oxygen-fusion"]';
    const card = app.querySelector<HTMLElement>(selector); const button = app.querySelector<HTMLElement>(`[data-action="${action}"]`);
    const feedbackText = action === 'fuse-hydrogen' ? 'H → He + Energie' : action === 'fuse-helium' ? 'He → C + Energie' : 'C + He → O';
    if (card) createActionFeedback(card, feedbackText, 'fusion');
    card?.animate([{ borderColor: 'rgba(242,168,75,.25)' }, { borderColor: 'rgba(242,168,75,.9)', filter: 'brightness(1.35)' }, { borderColor: 'rgba(242,168,75,.25)', filter: 'brightness(1)' }], { duration: 650, easing: 'ease-out' });
    button?.animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    app.querySelector<HTMLElement>('.star-surface')?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }], { duration: 520, easing: 'ease-out' });
  }
}

function setPerksOpen(open: boolean): void {
  perksOpen = open;
  app.querySelector('.resource-menu')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-perks"]')?.setAttribute('aria-expanded', String(open));
}

function setSoundMenuOpen(open: boolean): void {
  soundMenuOpen = open;
  app.querySelector('.sound-menu')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-sound-menu"]')?.setAttribute('aria-expanded', String(open));
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const debugButton = target.closest<HTMLButtonElement>('[data-debug]'); if (debugButton?.dataset.debug) { runDebugAction(debugButton.dataset.debug); return; }
  const insidePerkMenu = target.closest('.resource-menu');
  if (perksOpen && !insidePerkMenu) setPerksOpen(false);
  const insideSoundMenu = target.closest('.sound-menu');
  if (soundMenuOpen && !insideSoundMenu) setSoundMenuOpen(false);
  if (target.dataset.overlayDismiss === 'chronicle') { chronicleOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (target.dataset.overlayDismiss === 'stats') { statsOpen = false; overlaySignature = ''; syncOverlay(); return; }
  const panelButton = target.closest<HTMLButtonElement>('[data-panel]'); if (panelButton) { switchPanel(panelButton.dataset.panel as Panel); advanceTutorial('panel'); return; }
  const button = target.closest<HTMLButtonElement>('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action; if (!action) return;
  if (action === 'start-intro-tutorial') { resolveIntro(true); return; }
  if (action === 'skip-intro-tutorial') { resolveIntro(false); return; }
  if (action === 'acknowledge-objective') {
    const celebrateNewCosmos = state.tutorial.cosmosToastPending;
    dispatch({ type: 'ACKNOWLEDGE_OBJECTIVE', objective: objectiveFor(state).id });
    if (celebrateNewCosmos) { state.tutorial.cosmosToastPending = false; saveGame(state); showToast('Ein neuer Kosmos beginnt.'); }
    overlaySignature = ''; syncOverlay(); return;
  }
  if (action === 'tutorial-next') { advanceTutorial('next'); return; }
  if (action === 'skip-tutorial') { setTutorial(state.tutorial.step, true); showToast('Tutorial übersprungen. Über ? kannst du es erneut starten.'); return; }
  if (action === 'replay-tutorial') { setTutorial(0, false); showToast('Tutorial neu gestartet.'); return; }
  if (action === 'reset-menu') { toggleResetMenu(); return; }
  if (action === 'reset-run') { performReset('run'); return; }
  if (action === 'reset-full') { if (fullResetArmed) performReset('full'); else armFullReset(); return; }
  if (action === 'toggle-perks') { setPerksOpen(!perksOpen); return; }
  if (action === 'toggle-sound-menu') { setSoundMenuOpen(!soundMenuOpen); return; }
  if (action === 'open-stats') { statsOpen = true; chronicleOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (action === 'close-stats') { statsOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (action === 'open-chronicle') { chronicleOpen = true; statsOpen = false; overlaySignature = ''; syncOverlay(); advanceTutorial('open-chronicle'); return; }
  if (action === 'close-chronicle') { chronicleOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (action.startsWith('select-cloud-')) { dispatch({ type: 'SELECT_CLOUD_TIER', tier: Number(action.slice(-1)) as CloudTier }); return; }
  const actions: Record<string, GameAction> = {
    accrete: { type: 'ACCRETE' }, 'fuse-hydrogen': { type: 'FUSE_HYDROGEN' }, 'fuse-helium': { type: 'FUSE_HELIUM' }, 'create-oxygen': { type: 'CREATE_OXYGEN' }, 'advance-evolution': { type: 'ADVANCE_EVOLUTION' }, 'buy-deuterium': { type: 'BUY_DEUTERIUM' }, 'buy-gravity': { type: 'BUY_GRAVITY' }, 'buy-accretion': { type: 'BUY_ACCRETION' }, 'buy-fusion': { type: 'BUY_FUSION' }, 'buy-perk-cloud': { type: 'BUY_PERK', perk: 'largerCloud' }, 'buy-perk-gravity': { type: 'BUY_PERK', perk: 'permanentGravity' }, 'buy-perk-fusion': { type: 'BUY_PERK', perk: 'fusionMemory' }, prestige: { type: 'PRESTIGE' }, 'close-summary': { type: 'CLOSE_SUMMARY' }, 'toggle-sound': { type: 'TOGGLE_SOUND' },
  };
  if (actions[action]) { dispatch(actions[action]); playActionFeedback(action, event as MouseEvent); if (action === 'accrete') advanceTutorial('accrete'); }
  if (action === 'prestige') switchPanel('reactions', false);
  if (action === 'export') exportSave();
  if (action === 'import') document.querySelector<HTMLInputElement>('#save-import')?.click();
});

app.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.action !== 'set-volume') return;
  dispatch({ type: 'SET_VOLUME', volume: Number(input.value) / 100 });
});

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.action === 'set-volume') { playSound('unlock', state.soundEnabled, state.volume); return; }
  if (input.id !== 'save-import' || !input.files?.[0]) return;
  try {
    const imported = normalizeGameState(JSON.parse(await input.files[0].text()));
    if (!imported) throw new Error('Invalid save');
    state = { ...imported, lastTick: Date.now() }; saveGame(state); updateUI(true); showToast('Spielstand erfolgreich importiert.');
  } catch { showToast('Diese Datei ist kein gültiger Spielstand.'); }
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (event) => {
    const x = event.clientX / window.innerWidth - .5; const y = event.clientY / window.innerHeight - .5;
    document.documentElement.style.setProperty('--parallax-x', `${x * -10}px`); document.documentElement.style.setProperty('--parallax-y', `${y * -7}px`); document.documentElement.style.setProperty('--parallax-soft-x', `${x * 5}px`); document.documentElement.style.setProperty('--parallax-soft-y', `${y * 4}px`);
  }, { passive: true });
}

function frame(now: number): void {
  if (now - lastUiUpdate > 100) {
    const delta = Math.min(1, (now - lastFrame) / 1_000);
    lastFrame = now;
    if (state.tutorial.introSeen) state = tick(state, delta);
    updateUI();
    lastUiUpdate = now;
  }
  requestAnimationFrame(frame);
}

window.setInterval(() => saveGame(state), 5_000); window.addEventListener('beforeunload', () => saveGame(state));
window.addEventListener('scroll', queueTutorialSpotlightPosition, { passive: true, capture: true });
window.addEventListener('resize', queueTutorialSpotlightPosition, { passive: true });
renderShell(); if (offlineToast) showToast(offlineToast); requestAnimationFrame(frame);
if (import.meta.hot) Object.assign(window, {
  cosmicDebug: () => {
    debugOpen = !debugOpen;
    syncDebug();
    return debugOpen ? 'Cosmic Debug geöffnet.' : 'Cosmic Debug geschlossen.';
  },
  __cosmicState: () => state,
  __temperature: () => calculateTemperature(state),
  __fusionRate: () => fusionPerSecond(state),
});
