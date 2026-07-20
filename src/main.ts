import './styles.scss';
import { playSound, type SoundEffect } from './audio';
import {
  ACCRETION,
  ACHIEVEMENT_TITLES,
  AUTOMATIONS,
  AUTOMATION_ORDER,
  CLOUD_TIERS,
  DISPLAY_MATTER_KEYS,
  INITIAL_TEMPERATURE,
  LIMITS,
  MATTER_KEYS,
  OUTCOME_LABELS,
  OUTCOMES,
  PRESTIGE_PERKS,
  PROTOSTAR_WIND_WARNING,
  REACTIONS,
  REACTION_ORDER,
  RESOURCES,
  STAGES,
  STAGE_LABELS,
  THRESHOLDS,
  TUTORIAL_STEPS,
  UPGRADE_ORDER,
  UPGRADES,
  type AutomationKind,
  type UpgradeDefinition,
  type UpgradeId,
} from './content';
import {
  automationCost,
  accretionPerClick,
  accretionPerSecond,
  calculateTemperature,
  cloudTierCost,
  cloudMass,
  createInitialState,
  effectivePerks,
  fusionPerkCost,
  gravityPerkCost,
  objectiveFor,
  pressureProgress,
  reactionAutomationPerSecond,
  reactionAvailable,
  reactionCapacity,
  reduceGame,
  starMass,
  stellarFusionMultiplier,
  stellarWindPerSecond,
  tick,
} from './game/engine';
import { clearSave, loadGame, normalizeGameState, saveGame } from './game/storage';
import type { CloudTier, GameAction, ReactionId, Stage, StellarOutcome } from './game/types';

type Panel = 'reactions' | 'upgrades' | 'automation';
type ResetMode = 'run' | 'full';
interface ToastMessage { id: number; text: string; leaving: boolean }
type Objective = ReturnType<typeof objectiveFor>;
interface AchievementMessage { completedObjective: string; next: Objective }

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
let lastUpgradeOrderSignature = '';
let lastDynamicPanelSignature = '';
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
let prestigeConfirmationArmed = false;
let prestigeConfirmationTimer = 0;
let summaryAttentionRun = 0;
let lastObjectiveId = objectiveFor(state).id;
let lastObjectiveRun = state.run;
let activeAchievement: AchievementMessage | null = null;
let achievementQueue: AchievementMessage[] = [];
let achievementTransitionTimer = 0;

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
  : new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(value));
const formatMatter = (value: number): string => formatCompact(Math.round(value));

function formatTemperature(value: number): string {
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 2)} Mrd. K`;
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
  const stops = [100_000, 1_000_000, 10_000_000, 100_000_000, 600_000_000, 1_200_000_000, 1_500_000_000, 2_700_000_000];
  const max = stops.find((stop) => value <= stop) ?? 10 ** Math.ceil(Math.log10(value));
  return { max, label: formatTemperature(max), progress: Math.min(100, value / max * 100) };
}

function levelPips(level: number, max: number): string {
  return Array.from({ length: max }, (_, index) => `<i class="level-pip ${index < level ? 'is-filled' : ''}"></i>`).join('');
}

const automationVisible = (kind: AutomationKind): boolean => {
  const reaction = AUTOMATIONS[kind].reaction;
  return !reaction || state.unlockedReactions.includes(reaction);
};

const reactionOutput = (reaction: ReactionId): number =>
  state.reactionTotals[reaction] * (Object.values(REACTIONS[reaction].outputs)[0] ?? 1);

const automationMastery = (kind: AutomationKind): number => {
  const mastery = AUTOMATIONS[kind].mastery;
  return mastery.kind === 'starMass' ? starMass(state) : reactionOutput(mastery.reaction);
};

function currentOpportunities(): Record<Panel, string[]> {
  const reactions: string[] = [];
  const upgrades: string[] = [];
  const automation: string[] = [];
  if (state.completed) return { reactions, upgrades, automation };
  REACTION_ORDER.forEach((id) => {
    if (reactionAvailable(state, id)) reactions.push(`reaction:${id}`);
  });
  const deuteriumUpgrade = upgradeView('deuteriumBurning');
  const gravityUpgrade = upgradeView('gravity');
  if (!deuteriumUpgrade.complete && deuteriumUpgrade.visible && deuteriumUpgrade.unlocked && state.energy >= deuteriumUpgrade.price) {
    upgrades.push('deuterium-burning');
  }
  if (!gravityUpgrade.complete && gravityUpgrade.unlocked && state.energy >= gravityUpgrade.price) {
    upgrades.push(`gravity:${state.upgrades.gravity}`);
  }
  AUTOMATION_ORDER.forEach((kind) => {
    const definition = AUTOMATIONS[kind];
    const level = state.automation[kind];
    const price = automationCost(kind, level);
    if (automationVisible(kind) && level < definition.maxLevel && automationMastery(kind) >= definition.mastery.threshold && state.energy >= price) automation.push(`${kind}:${level}`);
  });
  return { reactions, upgrades, automation };
}

interface ReactionView {
  id: ReactionId;
  visible: boolean;
  unlocked: boolean;
  available: boolean;
  amount: number;
  energy: number;
  label: string;
  detail: string;
}

function reactionView(id: ReactionId): ReactionView {
  const definition = REACTIONS[id];
  const unlocked = state.unlockedReactions.includes(id);
  const capacity = reactionCapacity(state, id);
  const multiplier = stellarFusionMultiplier(state);
  const amount = Math.min(definition.manualAmount * multiplier, capacity);
  const inputMass = Object.values(definition.inputs).reduce((sum, ratio) => sum + amount * (ratio ?? 0), 0);
  const outputMass = Object.values(definition.outputs).reduce((sum, ratio) => sum + amount * (ratio ?? 0), 0);
  const energy = (definition.energyBasis === 'input' ? inputMass : outputMass) * definition.energyPerUnit;
  const nextLocked = REACTION_ORDER.find((reaction) => !state.unlockedReactions.includes(reaction));
  const visible = unlocked || id === nextLocked;
  const available = reactionAvailable(state, id);
  const label = !unlocked ? `Ab ${formatTemperature(definition.ignitionTemperature)}`
    : capacity <= .001 ? 'Kein Brennstoff im Kern'
      : `${formatMatter(amount)} ${RESOURCES[definition.primaryInput].symbol} fusionieren`;
  return { id, visible, unlocked, available, amount, energy, label, detail: available ? `+${formatCompact(energy)} Energie` : `${formatMatter(capacity)} ${RESOURCES[definition.primaryInput].symbol} verfügbar` };
}

function reactionCard(view: ReactionView): string {
  const definition = REACTIONS[view.id];
  return `<div class="action-card ${view.available ? 'is-ready' : ''}" data-reaction-card="${view.id}">
    <div class="reaction-symbol ${definition.className}">${definition.symbol}</div>
    <div class="action-copy"><span class="card-kicker">${definition.kicker}</span><h3>${definition.title}</h3><p>${definition.description}</p><div class="reaction-equation"><span>${definition.equationInput}</span><b>→</b><span>${definition.equationOutput}</span></div></div>
    <button class="primary-action compact" data-action="run-reaction" data-reaction="${view.id}" ${disabled(!view.available)}><span data-button-label>${view.label}</span><small data-button-detail>${view.detail}</small></button>
  </div>`;
}

function renderReactionPanel(): string {
  const cards = REACTION_ORDER.map(reactionView).filter((view) => view.visible);
  return `<div class="reaction-grid">${cards.map(reactionCard).join('')}</div>`;
}

interface UpgradeView {
  id: UpgradeId;
  definition: UpgradeDefinition;
  level: number;
  price: number;
  visible: boolean;
  unlocked: boolean;
  expired: boolean;
  complete: boolean;
  value: string;
  detail: string;
  label: string;
  priority: number;
}

function upgradeView(id: UpgradeId): UpgradeView {
  const definition: UpgradeDefinition = UPGRADES[id];
  const storedValue = state.upgrades[id];
  const level = typeof storedValue === 'boolean' ? Number(storedValue) : storedValue;
  const price = Math.round(definition.cost.base * definition.cost.growth ** level);
  const visible = !definition.hiddenStages.includes(state.stage);
  const minimumMassReached = definition.requirements.minimumStarMass === undefined
    || starMass(state) >= definition.requirements.minimumStarMass;
  const minimumTemperatureReached = definition.requirements.minimumTemperature === undefined
    || state.temperature >= definition.requirements.minimumTemperature;
  const expired = definition.requirements.maximumTemperature !== undefined
    && state.temperature >= definition.requirements.maximumTemperature;
  const complete = level >= definition.maxLevel;
  const unlocked = visible && minimumMassReached && minimumTemperatureReached && !expired;
  const value = definition.value.kind === 'toggle'
    ? complete ? definition.value.active : definition.value.inactive
    : `×${formatNumber(
      definition.value.base
      + level * definition.value.perLevel
      + (definition.value.persistentPerk ? state.perks[definition.value.persistentPerk] : 0)
        * (definition.value.persistentPerkEffect ?? 0),
      2,
    )}`;
  const detail = complete ? definition.detail.active : definition.detail.inactive;
  const label = complete ? definition.button.complete
    : expired ? definition.button.expired
      : unlocked ? definition.button.purchase : definition.button.locked;
  const priority = complete || expired ? 2 : !unlocked ? 3 : state.energy >= price ? 0 : 1;
  return { id, definition, level, price, visible, unlocked, expired, complete, value, detail, label, priority };
}

function upgradeCard(view: UpgradeView): string {
  const { definition, level, price, unlocked, complete } = view;
  const classes = ['upgrade-card', definition.cardClass].filter(Boolean).join(' ');
  return `
    <article class="${classes}" data-upgrade-card="${view.id}">
      <div class="upgrade-heading"><span class="upgrade-icon">${definition.icon}</span><h3>${definition.title} <b>${view.value}</b></h3></div>
      <p>${definition.description}${view.detail ? `<strong>${view.detail}</strong>` : ''}</p>
      <div class="level-row" data-levels="${view.id}">${levelPips(level, definition.maxLevel)}</div>
      <button class="${complete ? 'terminal-button' : 'progress-button'}" data-action="${definition.action}" ${complete ? '' : `style="--button-progress:${progress(state.energy, price, unlocked)}%"`} ${disabled(complete || !unlocked || state.energy < price)}>${complete ? '' : '<i></i>'}<span data-button-label>${view.label}</span><b data-button-cost>${complete ? '—' : `${price} E`}</b></button>
    </article>`;
}

function automationView(kind: AutomationKind) {
  const definition = AUTOMATIONS[kind];
  const level = state.automation[kind];
  const mastery = automationMastery(kind);
  const rateAt = (nextLevel: number): number => definition.reaction
    ? reactionAutomationPerSecond({ ...state, automation: { ...state.automation, [kind]: nextLevel } }, definition.reaction)
    : nextLevel * definition.baseRate * (accretionPerClick(state) / ACCRETION.manualBase);
  return {
    ...definition,
    level,
    max: definition.maxLevel,
    price: automationCost(kind, level),
    unlocked: mastery >= definition.mastery.threshold,
    lockedLabel: definition.mastery.kind === 'starMass'
      ? 'Protostern erforderlich'
      : `${formatMatter(mastery)} / ${formatMatter(definition.mastery.threshold)} ${definition.mastery.symbol}`,
    action: definition.reaction ? 'buy-reaction-automation' : 'buy-accretion',
    rateAt,
  };
}

function automationCard(kind: AutomationKind): string {
  const view = automationView(kind);
  const { level, max, price, unlocked } = view;
  const isMax = level >= max;
  const label = isMax ? 'Maximum' : unlocked ? 'Ausbauen' : view.lockedLabel;
  const currentRate = view.rateAt(level);
  const nextGain = view.rateAt(Math.min(max, level + 1)) - currentRate;
  return `
    <article class="upgrade-card" data-automation-card="${kind}">
      <div class="upgrade-heading"><span class="upgrade-icon">${view.icon}</span><h3>${view.title} <b>${formatMatter(currentRate)} ${view.unit}</b></h3></div>
      <p>${view.description}<strong>${isMax ? 'Maximum erreicht' : `Nächste Stufe: +${formatMatter(nextGain)} ${view.unit}`}</strong></p>
      <div class="level-row">${levelPips(level, max)}</div>
      <button class="${isMax ? 'terminal-button' : 'progress-button'}" data-action="${view.action}" ${view.reaction ? `data-reaction="${view.reaction}"` : ''} ${isMax ? '' : `style="--button-progress:${progress(state.energy, price, unlocked)}%"`} ${disabled(state.energy < price || !unlocked || isMax)}>${isMax ? '' : '<i></i>'}<span data-button-label>${label}</span><b data-button-cost>${isMax ? '—' : `${price} E`}</b></button>
    </article>`;
}

function timelineNodes(tier: CloudTier = state.cloudTier): [Stage, string, string][] {
  const formation: [Stage, string, string][] = [
    ['nebula', 'Urwolke', CLOUD_TIERS[tier].shortName],
    ['protostar', 'Protostern', '100.000 K'],
    ['deuterium', 'D-Brennen', '1 Mio. K'],
  ];
  if (tier === 0) return [...formation, ['brownDwarf', state.completed ? 'Brauner Zwerg' : 'Sternentwicklung', state.completed ? 'Nicht gezündet' : 'Ausgang offen']];
  const stellar: [Stage, string, string][] = [
    ['hydrogen', REACTIONS.hydrogen.title, formatTemperature(REACTIONS.hydrogen.ignitionTemperature)],
    ['mainSequence', 'Hauptreihe', 'H bleibt aktiv'],
    ['redGiant', 'Roter Riese', 'Kernkontraktion'],
    ['helium', REACTIONS.helium.title, formatTemperature(REACTIONS.helium.ignitionTemperature)],
  ];
  if (tier === 1) return [...formation, ...stellar, ['whiteDwarf', 'Weißer Zwerg', 'Masse entscheidet']];
  const heavy = (['carbon', 'neon', 'oxygen', 'silicon'] as const).map((id): [Stage, string, string] => [
    REACTIONS[id].stageOnUnlock,
    REACTIONS[id].title,
    formatTemperature(REACTIONS[id].ignitionTemperature),
  ]);
  return [...formation, ...stellar, ...heavy, ['ironCore', 'Eisenkern', 'Fusion endet'], ['supernova', 'Supernova', 'Kernkollaps'], [state.outcome === 'blackHole' ? 'blackHole' : 'neutronStar', state.outcome === 'blackHole' ? 'Schwarzes Loch' : 'Sternrest', 'Masse entscheidet']];
}

function timelineMarkup(): string {
  const nodes = timelineNodes();
  const stageIndex = Math.max(0, nodes.findIndex(([key]) => key === state.stage));
  return nodes.map(([key, label, detail], index) => `<div class="timeline-node ${index <= stageIndex ? 'done' : ''} ${key === state.stage ? 'current' : ''}"><i>${index < stageIndex ? '✓' : index + 1}</i><span><b>${label}</b><small>${detail}</small></span></div>`).join('');
}

function evolutionMapMarkup(): string {
  const discovered = new Set(state.discoveredOutcomes);
  const branch = (tier: CloudTier, outcome: StellarOutcome, detail: string) => {
    const unlocked = tier <= state.perks.largerCloud;
    const known = discovered.has(outcome);
    const current = state.cloudTier === tier;
    return `<article class="evolution-branch ${unlocked ? 'is-unlocked' : 'is-locked'} ${known ? 'is-discovered' : ''} ${current ? 'is-current' : ''}"><span>WOLKE ${tier + 1}</span><h3>${unlocked ? CLOUD_TIERS[tier].name : 'Unbekannte Wolke'}</h3><p>${unlocked ? detail : 'Über Wolkenwachstum freischalten.'}</p><strong>${known ? `Entdeckt: ${OUTCOME_LABELS[outcome]}` : unlocked ? 'Noch nicht entdeckt' : 'Gesperrt'}</strong></article>`;
  };
  return `<div class="evolution-map">
    ${branch(0, 'brownDwarf', 'Unterhalb der Zündmasse → Brauner Zwerg')}
    <div class="massive-branches">
      ${branch(1, 'heliumWhiteDwarf', 'Wasserstoff endet früh → Helium-Weißer-Zwerg')}
      ${branch(1, 'whiteDwarf', 'Heliumbrennen → Kohlenstoff-Sauerstoff-Weißer-Zwerg')}
    </div>
    <div class="massive-branches">
      ${branch(2, 'oxygenNeonWhiteDwarf', 'Fortgeschrittenes Brennen stoppt → O/Ne-Weißer-Zwerg')}
      ${branch(2, 'neutronStar', 'Eisenkern kollabiert → Neutronenstern')}
      ${branch(2, 'blackHole', 'Sehr massereicher Eisenkern → Schwarzes Loch')}
    </div>
  </div>`;
}

function logMarkup(limit = 5): string {
  return state.log.slice(0, limit).map((entry) => `<div class="log-entry ${entry.kind}"><i></i><p>${entry.text}</p></div>`).join('');
}

function orderedUpgradeCards(): { view: UpgradeView; markup: string }[] {
  return UPGRADE_ORDER
    .map(upgradeView)
    .filter((view) => view.visible)
    .sort((a, b) => a.priority - b.priority)
    .map((view) => ({ view, markup: upgradeCard(view) }));
}

const upgradeOrderSignature = (): string => orderedUpgradeCards()
  .map(({ view }) => `${view.id}:${view.priority}:${view.level}:${view.expired}`)
  .join('|');

function panelMarkup(panel: Panel): string {
  if (panel === 'reactions') return renderReactionPanel();
  if (panel === 'upgrades') {
    const cards = orderedUpgradeCards();
    return `<div class="upgrade-grid ${cards.length === 1 ? 'single-upgrade' : ''}">${cards.map((card) => card.markup).join('')}</div>`;
  }
  const automations = AUTOMATION_ORDER.filter(automationVisible);
  return `<div class="upgrade-grid automation-grid ${automations.length === 1 ? 'single-upgrade' : ''}">${automations.map(automationCard).join('')}</div>`;
}

function statsEntries(): [string, string, string][] {
  const stats = state.stats;
  const heavyReactions: [string, string, string][] = (['carbon', 'neon', 'oxygen', 'silicon'] as const)
    .filter((id) => state.unlockedReactions.includes(id) || state.reactionTotals[id] > 0)
    .map((id) => [`reaction-${id}`, `${REACTIONS[id].title}: Brennstoff`, `${formatMatter(state.reactionTotals[id])} ${RESOURCES[REACTIONS[id].primaryInput].symbol}`]);
  return [
    ['matter', 'Eingesammelte Materie', `${formatMatter(stats.matterAccreted)} ME`],
    ['automatic-matter', 'Davon automatisch', `${formatMatter(stats.automaticMatterAccreted)} ME`],
    ['stellar-wind', 'Durch Sternwind verloren', `${formatMatter(stats.matterLostToWind)} ME`],
    ['fusion', 'Manuelle Fusionen', formatNumber(stats.manualFusionActions)],
    ['hydrogen', 'Wasserstoff fusioniert', `${formatMatter(stats.hydrogenFused)} H`],
    ['helium', 'Helium fusioniert', `${formatMatter(stats.heliumFused)} He`],
    ['oxygen', 'Sauerstoff erzeugt', `${formatMatter(stats.oxygenCreated)} O`],
    ...heavyReactions,
    ['energy', 'Energie erzeugt', formatCompact(stats.energyGenerated)],
    ['purchases', 'Käufe', formatNumber(stats.upgradesPurchased + stats.automationsPurchased)],
  ];
}

function statsGridMarkup(live = false): string {
  return statsEntries().map(([key, label, value]) => `<div><span>${label}</span><b${live ? ` data-live-stat="${key}"` : ''}>${value}</b></div>`).join('');
}

function historyMarkup(): string {
  if (!state.history.length) return '<p class="empty-history">Noch keine abgeschlossene Runde archiviert.</p>';
  return state.history.slice(0, 5).map((record) => `<article><span>ZYKLUS ${record.run.toString().padStart(2, '0')}</span><b>${OUTCOME_LABELS[record.outcome]}</b><small>${formatMatter(record.finalMass)} ME · ${formatDuration(record.duration)} · +${record.stardustEarned} ✦</small></article>`).join('');
}

function renderShell(): void {
  app.innerHTML = `
    <div class="cosmos" aria-hidden="true"><div class="stars stars-a"></div><div class="stars stars-b"></div><div class="nebula-glow"></div></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Cosmic Clicker Startseite"><span class="brand-mark">${icons.spark}</span><span><b>COSMIC</b><em>CLICKER</em></span></a>
      <div class="run-status"><b data-ui="run">ZYKLUS 01</b></div>
      <div class="header-actions"><div class="resource-menu"><button class="resource-chip" data-action="toggle-perks" aria-label="Sternenstaub und aktive Vermächtnis-Perks anzeigen" aria-expanded="false"><span>✦</span><b data-ui="stardust">0</b></button><div class="perk-popover"><span>Aktive Perks</span><div><b>${PRESTIGE_PERKS.largerCloud.title}</b><small><i data-ui="cloud-perk-name">Kleine Urwolke</i></small></div><div><b>${PRESTIGE_PERKS.permanentGravity.title}</b><small>Stufe <i data-ui="gravity-perk-level">0</i></small></div><div><b>${PRESTIGE_PERKS.fusionMemory.title}</b><small>Stufe <i data-ui="fusion-perk-level">0</i></small></div><p>Neue Stufen werden am Zyklusende gekauft.</p></div></div><div class="sound-menu"><button class="icon-button" data-action="toggle-sound-menu" aria-label="Audioeinstellungen öffnen" aria-expanded="false">${state.soundEnabled ? icons.sound : icons.soundOff}</button><div class="sound-popover"><div><span>Effektlautstärke</span><b data-ui="volume-label">35%</b></div><input data-action="set-volume" aria-label="Effektlautstärke" type="range" min="0" max="100" step="1" value="35"><button data-action="toggle-sound" data-ui="mute-label">Ton stummschalten</button></div></div><button class="icon-button export-button" data-action="export" aria-label="Spielstand exportieren">${icons.download}</button><div class="reset-control"><button class="icon-button reset-button" data-action="reset-menu" aria-label="Neustartoptionen öffnen">${icons.reset}</button><div class="reset-choices"><button data-action="reset-run">Runde neu starten</button><button data-action="reset-full"><span data-full-reset-label>Spielstand löschen</span></button></div></div></div>
    </header>

    <main>
      <section class="mission-strip"><div class="mission-copy"><span data-ui="objective-eyebrow"></span><h2 data-ui="objective-title"></h2><p data-ui="objective-detail"></p></div><div class="mission-progress"><div class="progress-label"><span>Fortschritt</span><b data-ui="objective-percent"></b></div><div class="progress-track"><i data-ui="objective-bar"></i></div></div><div class="elapsed"><span>Laufzeit</span><b data-ui="elapsed"></b></div></section>

      <section class="stellar-lab">
        <aside class="data-panel left-panel">
          <div class="panel-heading"><span class="index">01</span><div><small>Echtzeitdaten</small><h2>Stellarer Kern</h2></div></div>
          <div class="primary-reading"><span>Kerntemperatur</span><b data-ui="temperature"></b><div class="thermal-scale"><i data-ui="temperature-bar"></i></div><small><span>${formatTemperature(INITIAL_TEMPERATURE)}</span><span data-ui="temperature-max"></span></small></div>
          <div class="metric-grid"><div class="metric"><span>Sternmasse</span><b data-ui="mass"></b><small>ME</small></div><div class="metric"><span>Kerndruck</span><b data-ui="pressure"></b><small>% Zünddruck</small></div><div class="metric energy-metric"><span>Energie</span><b data-ui="energy"></b><small>verfügbar</small></div><div class="metric"><span>Akkretion</span><b data-ui="accretion-rate"></b><small>ME / Sek.</small></div></div>
          <div class="composition"><div class="section-label"><span>Kernzusammensetzung</span></div>${DISPLAY_MATTER_KEYS.map((key) => `<div class="composition-row" data-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><div><b>${RESOURCES[key].label}</b><div class="mini-track"><i data-ui="${key}-bar"></i></div></div><strong data-ui="${key}-value"></strong></div>`).join('')}</div>
          <div class="cloud-stats"><div class="section-label"><span data-ui="cloud-name">Urwolke</span></div><div class="cloud-summary"><div><span>Restmaterie</span><b data-ui="cloud-mass"></b><small data-ui="cloud-initial"></small></div><div class="cloud-mini-gauge"><i class="gauge-ring"></i><b data-ui="cloud-percent"></b></div></div><div class="wind-status" data-ui="wind-status"><span>Sternwind</span><b data-ui="wind-rate">inaktiv</b><small>trägt Materie aus der Urwolke ab</small></div><div class="cloud-elements">${DISPLAY_MATTER_KEYS.map((key) => `<div data-cloud-matter="${key}"><span class="element ${RESOURCES[key].className}">${RESOURCES[key].symbol}</span><p><b>${RESOURCES[key].label}</b><strong data-ui="cloud-${key}"></strong></p></div>`).join('')}</div></div>
        </aside>

        <section class="star-chamber">
          <div class="stage-label"><span data-ui="stage"></span><b data-ui="stage-detail"></b></div>
          <div class="automation-particles" aria-hidden="true">${Array.from({ length: 8 }, (_, index) => `<i data-auto-particle="${index}">H</i>`).join('')}</div>
          <button class="star-button" data-action="accrete" aria-label="Materie einsammeln"><span class="star-corona"></span><span class="star-surface"></span><span class="star-core"></span><span class="star-noise"></span></button>
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
    <div data-ui="overlay-root"></div><div data-ui="tutorial-root"></div><div data-ui="achievement-root"></div><div data-ui="debug-root"></div><div data-ui="toast-root"></div>`;

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
  // Reaction cards share one data-driven renderer and are refreshed as a unit.
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
    orderedUpgradeCards().forEach(({ view }) => {
      syncProgressButton(
        view.definition.action,
        view.price,
        view.unlocked,
        view.complete,
        view.label,
        view.label,
      );
    });
  }
  if (activePanel === 'automation') {
    AUTOMATION_ORDER.filter(automationVisible).forEach((kind) => {
      const view = automationView(kind);
      const button = app.querySelector<HTMLButtonElement>(`[data-automation-card="${kind}"] button`);
      if (!button) return;
      const isMax = view.level >= view.max;
      if (!isMax) button.style.setProperty('--button-progress', `${progress(state.energy, view.price, view.unlocked)}%`);
      button.disabled = !view.unlocked || state.energy < view.price || isMax;
      button.querySelector('[data-button-label]')!.textContent = isMax ? 'Maximum' : view.unlocked ? 'Ausbauen' : view.lockedLabel;
      button.querySelector('[data-button-cost]')!.textContent = isMax ? '—' : `${view.price} E`;
    });
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
  const introNeedsDecision = !state.tutorial.introSeen;
  if (!state.summaryOpen && !chronicleOpen && !statsOpen && !introNeedsDecision) { if (root.innerHTML) root.innerHTML = ''; overlaySignature = ''; return; }
  if (introNeedsDecision) {
    if (overlaySignature === 'intro') return;
    overlaySignature = 'intro';
    root.innerHTML = `<div class="modal-backdrop intro-backdrop"><section class="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-description"><div class="intro-brand"><span>COSMIC</span><b>CLICKER</b></div><small>DEIN KOSMISCHES EXPERIMENT</small><span class="intro-star">${icons.spark}</span><h2 id="intro-title">Entdecke das Schicksal der Sterne.</h2><p id="intro-description">Beginne mit einer kleinen Wolke aus kaltem Wasserstoff. Sammle Materie, forme einen Protostern und beobachte, welchen Entwicklungsweg die Physik ermöglicht.</p><div class="intro-pillars"><div><b>01</b><span>Materie sammeln</span><small>Forme aus der Urwolke einen Protostern.</small></div><div><b>02</b><span>Sternentwicklung verfolgen</span><small>Masse und Temperatur bestimmen den möglichen Lebensweg.</small></div><div><b>03</b><span>Kosmos erweitern</span><small>Nutze Sternenstaub für größere Wolken.</small></div></div><div class="intro-actions"><button class="primary-action" data-action="start-intro-tutorial" aria-label="Tutorial starten"><span>Tutorial starten</span><small>Kurze geführte Tour</small></button><button class="intro-secondary" data-action="skip-intro-tutorial">Ohne Tutorial starten</button></div></section></div>`;
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
  const signature = `summary:${state.stardust}:${state.perks.largerCloud}:${state.perks.permanentGravity}:${state.perks.fusionMemory}:${state.pendingPerks.largerCloud}:${state.pendingPerks.permanentGravity}:${state.pendingPerks.fusionMemory}:${state.nextCloudTier}:${state.outcome}`;
  if (signature === overlaySignature) return;
  const previousSummary = root.querySelector<HTMLElement>('.summary-modal');
  const previousSummaryScroll = previousSummary?.scrollTop ?? 0;
  const previousPageScroll = window.scrollY;
  const previousAction = previousSummary?.contains(document.activeElement)
    ? (document.activeElement as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
    : undefined;
  overlaySignature = signature;
  const previewPerks = effectivePerks(state);
  const cloudCost = cloudTierCost(previewPerks.largerCloud);
  const gravityCostValue = gravityPerkCost(previewPerks.permanentGravity);
  const fusionCostValue = fusionPerkCost(previewPerks.fusionMemory);
  const cloudMax = previewPerks.largerCloud >= LIMITS.cloudTier;
  const gravityMax = previewPerks.permanentGravity >= LIMITS.permanentGravity;
  const fusionMax = previewPerks.fusionMemory >= LIMITS.fusionMemory;
  const showPerkAttention = summaryAttentionRun !== state.run;
  const cloudAttention = showPerkAttention && !cloudMax && state.stardust >= cloudCost ? 'perk-attention' : '';
  const gravityAttention = showPerkAttention && !gravityMax && state.stardust >= gravityCostValue ? 'perk-attention' : '';
  const fusionAttention = showPerkAttention && !fusionMax && state.stardust >= fusionCostValue ? 'perk-attention' : '';
  const outcome = state.outcome ?? 'legacyMainSequence';
  const outcomeCopy = OUTCOMES[outcome];
  const cloudChoices = ([0, 1, 2] as CloudTier[]).filter((tier) => tier <= previewPerks.largerCloud).map((tier) => `<button class="cloud-choice ${state.nextCloudTier === tier ? 'is-selected' : ''}" data-action="select-cloud-${tier}"><span>${CLOUD_TIERS[tier].shortName}</span><small>${CLOUD_TIERS[tier].expectedOutcome}</small></button>`).join('');
  const perkControls = (kind: 'cloud' | 'gravity' | 'fusion', label: string, pending: number, max: boolean, cost: number): string => `<div class="summary-perk-controls"><button class="perk-remove" data-action="remove-perk-${kind}" aria-label="${label} abwählen" ${disabled(pending <= 0)}>−</button><button data-action="buy-perk-${kind}" ${disabled(max || state.stardust < cost)}>${max ? 'MAX' : `+${cost} ✦`}</button></div>`;
  root.innerHTML = `<div class="modal-backdrop" role="presentation">
    <section class="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div class="summary-heading"><span class="modal-star">${icons.spark}</span><div><small>ZYKLUS ${state.run.toString().padStart(2, '0')} · ${OUTCOME_LABELS[outcome]}</small><h2 id="summary-title">${outcomeCopy.title}</h2><p>${outcomeCopy.description}</p></div></div>
      <div class="summary-stats"><div><span>Endmasse</span><b>${formatMatter(starMass(state))} ME</b></div><div><span>Rundendauer</span><b>${formatDuration(state.elapsed)}</b></div><div><span>Sternenstaub erhalten</span><b>+${state.stats.stardustEarned} ✦</b></div></div>
      <div class="summary-detail"><div class="summary-section-title"><span>Rundenauswertung</span><small>ZYKLUS ${state.run.toString().padStart(2, '0')}</small></div><div class="run-stat-grid compact">${statsGridMarkup()}</div></div>
      <div class="summary-legacy"><div class="summary-section-title"><span>Vermächtnis wählen</span><small>DAUERHAFTE EFFEKTE</small></div>
        <div class="summary-perk-grid">
          <article class="${cloudAttention} ${state.pendingPerks.largerCloud ? 'has-selection' : ''}"><span class="perk-orbit">01</span><div><h3>${PRESTIGE_PERKS.largerCloud.title}</h3><p>${PRESTIGE_PERKS.largerCloud.description}</p><strong>${CLOUD_TIERS[Math.min(2, previewPerks.largerCloud) as CloudTier].name}${state.pendingPerks.largerCloud ? ` · +${state.pendingPerks.largerCloud} gewählt` : ''}</strong></div>${perkControls('cloud', PRESTIGE_PERKS.largerCloud.title, state.pendingPerks.largerCloud, cloudMax, cloudCost)}</article>
          <article class="${gravityAttention} ${state.pendingPerks.permanentGravity ? 'has-selection' : ''}"><span class="perk-orbit">02</span><div><h3>${PRESTIGE_PERKS.permanentGravity.title}</h3><p>${PRESTIGE_PERKS.permanentGravity.description}</p><strong>Stufe ${previewPerks.permanentGravity}${state.pendingPerks.permanentGravity ? ` · +${state.pendingPerks.permanentGravity} gewählt` : ''}</strong></div>${perkControls('gravity', PRESTIGE_PERKS.permanentGravity.title, state.pendingPerks.permanentGravity, gravityMax, gravityCostValue)}</article>
          <article class="${fusionAttention} ${state.pendingPerks.fusionMemory ? 'has-selection' : ''}"><span class="perk-orbit">03</span><div><h3>${PRESTIGE_PERKS.fusionMemory.title}</h3><p>${PRESTIGE_PERKS.fusionMemory.description}</p><strong>Stufe ${previewPerks.fusionMemory}${state.pendingPerks.fusionMemory ? ` · +${state.pendingPerks.fusionMemory} gewählt` : ''}</strong></div>${perkControls('fusion', PRESTIGE_PERKS.fusionMemory.title, state.pendingPerks.fusionMemory, fusionMax, fusionCostValue)}</article>
        </div>
        <div class="cloud-selection"><div class="summary-section-title"><span>Nächste Urwolke</span><small>${CLOUD_TIERS[state.nextCloudTier].description}</small></div><div>${cloudChoices}</div></div>
      </div>
      <div class="summary-actions"><button class="primary-action" data-action="prestige">Mit ${CLOUD_TIERS[state.nextCloudTier].name} beginnen</button><button class="text-action" data-action="close-summary">Später entscheiden</button></div>
    </section>
  </div>`;
  if (previousSummary) {
    const restoredSummary = root.querySelector<HTMLElement>('.summary-modal');
    const restoreScrollPosition = () => {
      if (!restoredSummary?.isConnected) return;
      restoredSummary.scrollTop = previousSummaryScroll;
      window.scrollTo(window.scrollX, previousPageScroll);
    };
    restoreScrollPosition();
    if (previousAction) root.querySelector<HTMLElement>(`[data-action="${previousAction}"]`)?.focus({ preventScroll: true });
    window.requestAnimationFrame(restoreScrollPosition);
  }
  summaryAttentionRun = state.run;
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

function markCurrentObjectiveSeen(): void {
  const objective = objectiveFor(state);
  lastObjectiveId = objective.id;
  lastObjectiveRun = state.run;
  if (!state.seenObjectives.includes(objective.id)) state.seenObjectives.push(objective.id);
}

function displayNextAchievement(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="achievement-root"]');
  if (!root || activeAchievement) return;
  activeAchievement = achievementQueue.shift() ?? null;
  if (!activeAchievement) { root.innerHTML = ''; return; }
  const title = ACHIEVEMENT_TITLES[activeAchievement.completedObjective];
  if (!title) { activeAchievement = null; displayNextAchievement(); return; }
  const windWarning = activeAchievement.completedObjective === 'form-protostar'
    ? `<div class="achievement-warning"><b>${PROTOSTAR_WIND_WARNING.title}</b><span>${PROTOSTAR_WIND_WARNING.text}</span></div>`
    : '';
  root.innerHTML = `<aside class="achievement-banner" role="region" aria-labelledby="achievement-title"><button class="achievement-close" data-action="dismiss-achievement" aria-label="Zielhinweis schließen">×</button><div class="achievement-announcement" role="status" aria-live="polite" aria-atomic="true"><small>ZIEL ERREICHT</small><h2 id="achievement-title">${title}</h2></div>${windWarning}<div class="achievement-next"><span>Als Nächstes</span><b>${activeAchievement.next.title}</b><p>${activeAchievement.next.detail}</p></div></aside>`;
  const banner = root.querySelector<HTMLElement>('.achievement-banner');
  window.requestAnimationFrame(() => banner?.classList.add('is-visible'));
  playSound('unlock', state.soundEnabled, state.volume);
}

function showAchievement(completedObjective: string, next: Objective): void {
  if (!ACHIEVEMENT_TITLES[completedObjective]) return;
  achievementQueue.push({ completedObjective, next });
  displayNextAchievement();
}

function dismissAchievement(): void {
  if (!activeAchievement) return;
  const root = app.querySelector<HTMLElement>('[data-ui="achievement-root"]');
  const banner = root?.querySelector<HTMLElement>('.achievement-banner');
  window.clearTimeout(achievementTransitionTimer);
  banner?.classList.add('is-leaving');
  banner?.classList.remove('is-visible');
  achievementTransitionTimer = window.setTimeout(() => {
    if (root?.contains(banner ?? null)) root.innerHTML = '';
    activeAchievement = null;
    displayNextAchievement();
  }, 340);
}

function clearAchievements(): void {
  window.clearTimeout(achievementTransitionTimer);
  achievementQueue = [];
  activeAchievement = null;
  const root = app.querySelector<HTMLElement>('[data-ui="achievement-root"]');
  if (root) root.innerHTML = '';
}

function syncObjectiveAchievement(objective: Objective): void {
  if (state.run !== lastObjectiveRun) {
    markCurrentObjectiveSeen();
    saveGame(state);
    return;
  }
  if (objective.id === lastObjectiveId) return;
  const completedObjective = lastObjectiveId;
  lastObjectiveId = objective.id;
  if (!state.seenObjectives.includes(objective.id)) state.seenObjectives.push(objective.id);
  saveGame(state);
  if (state.tutorial.completed && !state.completed) showAchievement(completedObjective, objective);
}

function finishOnboarding(): void {
  switchPanel('reactions', false);
  markCurrentObjectiveSeen();
  if (state.tutorial.cosmosToastPending) {
    state.tutorial.cosmosToastPending = false;
    showToast('Ein neuer Kosmos beginnt.');
  }
}

function setTutorial(step: number, completed = false): void {
  state.tutorial = { ...state.tutorial, step: Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step)), completed };
  if (completed) finishOnboarding();
  saveGame(state);
  syncTutorial();
  overlaySignature = '';
  syncOverlay();
}

function resolveIntro(startTutorial: boolean): void {
  state.tutorial = { ...state.tutorial, introSeen: true, completed: !startTutorial, step: 0 };
  if (!startTutorial) finishOnboarding();
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
    const step = TUTORIAL_STEPS[state.tutorial.step] ?? TUTORIAL_STEPS[0];
    const target = app.querySelector(step.selector);
    if (target) positionTutorialSpotlight(target);
  });
}

function syncTutorial(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="tutorial-root"]');
  if (!root) return;
  app.querySelectorAll('.tutorial-focus').forEach((element) => element.classList.remove('tutorial-focus'));
  if (state.summaryOpen || !state.tutorial.introSeen || state.tutorial.completed) {
    if (root.innerHTML) root.innerHTML = '';
    tutorialSignature = state.summaryOpen ? 'hidden-by-summary' : state.tutorial.introSeen ? 'completed' : 'waiting-for-intro';
    return;
  }
  const step = TUTORIAL_STEPS[state.tutorial.step] ?? TUTORIAL_STEPS[0];
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
    root.innerHTML = `<div class="tutorial-spotlight" aria-hidden="true"></div><aside class="tutorial-card" aria-label="Tutorial"><div><span>TUTORIAL · ${state.tutorial.step + 1}/${TUTORIAL_STEPS.length}</span><button data-action="skip-tutorial">Überspringen</button></div><h2>${step.title}</h2><p>${step.text}</p>${interactionHint ? `<small>${interactionHint}</small>` : `<button class="tutorial-next" data-action="tutorial-next">Weiter</button>`}</aside>`;
  }
  if (target) positionTutorialSpotlight(target);
}

function advanceTutorial(trigger: string): void {
  if (state.tutorial.completed || TUTORIAL_STEPS[state.tutorial.step]?.trigger !== trigger) return;
  if (state.tutorial.step >= TUTORIAL_STEPS.length - 1) setTutorial(state.tutorial.step, true);
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
  if (action === 'protostar') moveDebugMatter(THRESHOLDS.protostarMass);
  if (action === 'deuterium') moveDebugMatter(8_000);
  if (action === 'hydrogen') { moveDebugMatter(34_000); state.energy = Math.max(state.energy, 1_000); state = tick(state, 0); }
  if (action === 'fusion-ready') { moveDebugMatter(THRESHOLDS.hydrogenIgnitionMass); state.reactionTotals.hydrogen = 5_100; state.energy = Math.max(state.energy, 2_000); state = tick(state, 0); }
  if (action === 'main' || action === 'helium' || action === 'oxygen' || action === 'complete') {
    if (state.cloudTier === 0 && action !== 'complete') {
      state = createInitialState({ ...state.perks, largerCloud: Math.max(1, state.perks.largerCloud) }, state.stardust, Math.max(2, state.run), { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: 1, nextCloudTier: 1, discoveredOutcomes: state.discoveredOutcomes });
    }
    if (state.cloudTier === 0) {
      moveDebugMatter(cloudMass(state));
      state = tick(state, 1);
    } else {
      moveDebugMatter(action === 'main' ? THRESHOLDS.hydrogenIgnitionMass : THRESHOLDS.heliumIgnitionMass);
      state.energy = Math.max(state.energy, 10_000);
      state.temperature = action === 'main' ? THRESHOLDS.hydrogenTemperature : THRESHOLDS.heliumTemperature;
      state.unlockedReactions = action === 'main' ? ['hydrogen'] : ['hydrogen', 'helium', 'alphaCapture'];
      state.stage = action === 'main' ? 'mainSequence' : 'helium';
      if (action === 'oxygen') state.star.carbon = Math.max(state.star.carbon, 5_000);
      if (action === 'complete') {
        state.star.hydrogen = 0;
        state.star.helium = 0;
        MATTER_KEYS.forEach((key) => { state.cloud[key] = 0; });
        state = tick(state, 1);
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
  root.innerHTML = `<aside class="debug-panel" aria-label="Debug- und Balance-Modus"><div><span>DEV · BALANCE</span><button data-debug="close" aria-label="Debug-Modus schließen">×</button></div><dl><div><dt>Stufe</dt><dd>${STAGE_LABELS[state.stage]}</dd></div><div><dt>Wolke</dt><dd>${CLOUD_TIERS[state.cloudTier].shortName}</dd></div><div><dt>Masse</dt><dd>${formatMatter(starMass(state))} ME</dd></div><div><dt>Temperatur</dt><dd>${formatTemperature(state.temperature)}</dd></div><div><dt>Energie</dt><dd>${formatCompact(state.energy)}</dd></div><div><dt>Aktionen</dt><dd>${formatNumber(state.stats.manualClicks + state.stats.manualFusionActions + state.stats.manualHeliumActions)}</dd></div></dl><div class="debug-actions"><button data-debug="cloud-0">Kleine Wolke</button><button data-debug="cloud-1">Stellare Wolke</button><button data-debug="cloud-2">Massereiche Wolke</button><button data-debug="energy">+2.000 Energie</button><button data-debug="protostar">Protostern</button><button data-debug="hydrogen">H-Brennen</button><button data-debug="main">Hauptreihe</button><button data-debug="helium">He-Brennen</button><button data-debug="oxygen">C/O-Kern</button><button data-debug="complete">Runde abschließen</button><button data-debug="fresh">Runde zurücksetzen</button></div><p>Die aktuellen Brenn- und Endzustände lassen sich im Dev-Server simulieren.</p></aside>`;
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
  syncObjectiveAchievement(objective);
  setText('temperature', formatTemperature(state.temperature)); setText('temperature-max', scale.label); app.querySelector<HTMLElement>('[data-ui="temperature-bar"]')?.style.setProperty('clip-path', `inset(0 ${100 - scale.progress}% 0 0)`);
  setText('mass', formatMatter(mass)); setText('pressure', formatNumber(pressureProgress(state), 1)); setText('energy', formatCompact(state.energy)); setText('accretion-rate', formatMatter(accretionPerSecond(state)));
  DISPLAY_MATTER_KEYS.forEach((key) => {
    const percent = matterPercent(state.star[key], starTotal);
    setWidth(`${key}-bar`, percent);
    setText(`${key}-value`, `${formatMatter(state.star[key])} ME`);
    setText(`cloud-${key}`, formatMatter(state.cloud[key]));
    const coreElement = app.querySelector<HTMLElement>(`[data-matter="${key}"]`);
    const cloudElement = app.querySelector<HTMLElement>(`[data-cloud-matter="${key}"]`);
    if (coreElement) coreElement.hidden = state.star[key] <= 0 && CLOUD_TIERS[state.cloudTier].matter[key] <= 0;
    if (cloudElement) cloudElement.hidden = CLOUD_TIERS[state.cloudTier].matter[key] <= 0;
  });
  const hydrogenOnly = state.cloudTier === 0;
  app.querySelector('.cloud-elements')?.classList.toggle('hydrogen-only', hydrogenOnly);
  app.querySelectorAll<HTMLElement>('[data-auto-particle]').forEach((particle, index) => { particle.textContent = hydrogenOnly || index % 5 !== 4 ? 'H' : 'He'; });
  setText('stage', STAGE_LABELS[state.stage]); setText('stage-detail', STAGES[state.stage].detail); setText('cloud-name', CLOUD_TIERS[state.cloudTier].name);
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
  const windRate = stellarWindPerSecond(state);
  setText('wind-rate', windRate > 0 ? `−${formatMatter(windRate)} ME/s` : 'inaktiv');
  app.querySelector<HTMLElement>('[data-ui="wind-status"]')?.classList.toggle('is-active', windRate > 0);
  const soundButton = app.querySelector<HTMLButtonElement>('[data-action="toggle-sound-menu"]'); if (soundButton) { soundButton.innerHTML = state.soundEnabled ? icons.sound : icons.soundOff; soundButton.ariaLabel = 'Audioeinstellungen öffnen'; }
  const volumeInput = app.querySelector<HTMLInputElement>('[data-action="set-volume"]'); if (volumeInput && Number(volumeInput.value) !== Math.round(state.volume * 100)) volumeInput.value = String(Math.round(state.volume * 100));
  setText('volume-label', `${Math.round(state.volume * 100)}%`); setText('mute-label', state.soundEnabled ? 'Ton stummschalten' : 'Ton einschalten');
  const currentUpgradeOrder = activePanel === 'upgrades' ? upgradeOrderSignature() : '';
  const upgradeOrderChanged = activePanel === 'upgrades' && currentUpgradeOrder !== lastUpgradeOrderSignature;
  const dynamicPanelSignature = activePanel === 'reactions'
    ? `${state.unlockedReactions.join(',')}:${MATTER_KEYS.map((key) => Math.round(state.star[key])).join(',')}:${Math.round(state.temperature)}`
    : activePanel === 'automation' ? `${state.unlockedReactions.join(',')}:${Object.values(state.automation).join(',')}` : '';
  const dynamicPanelChanged = dynamicPanelSignature !== lastDynamicPanelSignature;
  if (forcePanel || stageChanged || upgradeOrderChanged || dynamicPanelChanged) { const content = app.querySelector<HTMLElement>('[data-ui="deck-content"]'); if (content) content.innerHTML = panelMarkup(activePanel); lastStage = state.stage; lastUpgradeOrderSignature = currentUpgradeOrder; lastDynamicPanelSignature = dynamicPanelSignature; }
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
  if (!wasCompleted && state.completed) {
    makeSummaryExclusive();
    playSound('complete', state.soundEnabled, state.volume);
  }
  if (['BUY_DEUTERIUM', 'BUY_GRAVITY', 'BUY_ACCRETION', 'BUY_REACTION_AUTOMATION', 'BUY_PERK'].includes(action.type)) switchPanel(activePanel, false);
  updateUI(true);
}

function hasAffordableSummaryPerk(): boolean {
  const perks = effectivePerks(state);
  return perks.largerCloud < LIMITS.cloudTier && state.stardust >= cloudTierCost(perks.largerCloud)
    || perks.permanentGravity < LIMITS.permanentGravity && state.stardust >= gravityPerkCost(perks.permanentGravity)
    || perks.fusionMemory < LIMITS.fusionMemory && state.stardust >= fusionPerkCost(perks.fusionMemory);
}

function hasPendingPerks(): boolean {
  return state.pendingPerks.largerCloud + state.pendingPerks.permanentGravity + state.pendingPerks.fusionMemory > 0;
}

function highlightAffordablePerks(): void {
  app.querySelectorAll<HTMLElement>('.summary-perk-grid article').forEach((card) => {
    const buyButton = card.querySelector<HTMLButtonElement>('[data-action^="buy-perk-"]');
    if (!buyButton || buyButton.disabled) return;
    card.classList.remove('perk-attention');
    void card.offsetWidth;
    card.classList.add('perk-attention');
  });
}

function clearPrestigeConfirmation(): void {
  prestigeConfirmationArmed = false;
  window.clearTimeout(prestigeConfirmationTimer);
  const button = app.querySelector<HTMLButtonElement>('[data-action="prestige"]');
  if (!button) return;
  button.classList.remove('is-confirming');
  button.textContent = `Mit ${CLOUD_TIERS[state.nextCloudTier].name} beginnen`;
}

function armPrestigeConfirmation(): void {
  prestigeConfirmationArmed = true;
  const button = app.querySelector<HTMLButtonElement>('[data-action="prestige"]');
  if (button) {
    button.classList.add('is-confirming');
    button.textContent = 'Ohne Upgrades starten';
  }
  highlightAffordablePerks();
  window.clearTimeout(prestigeConfirmationTimer);
  prestigeConfirmationTimer = window.setTimeout(clearPrestigeConfirmation, 5_000);
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

function makeSummaryExclusive(): void {
  chronicleOpen = false;
  statsOpen = false;
  debugOpen = false;
  overlaySignature = '';
  tutorialSignature = '';
  clearAchievements();
  clearToasts();
  clearPrestigeConfirmation();
  closeResetMenu();
  setPerksOpen(false);
  setSoundMenuOpen(false);
  syncDebug();
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
  clearPrestigeConfirmation();
  clearAchievements();
  summaryAttentionRun = 0;
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
  const sounds: Partial<Record<string, SoundEffect>> = { accrete: 'accrete', 'buy-deuterium': 'deuterium', 'run-reaction': 'fusion', 'buy-gravity': 'purchase', 'buy-accretion': 'purchase', 'buy-reaction-automation': 'purchase', 'buy-perk-cloud': 'purchase', 'buy-perk-gravity': 'purchase', 'buy-perk-fusion': 'purchase' };
  if (sounds[action]) playSound(sounds[action], state.soundEnabled, state.volume);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (action === 'accrete') playAccretionFeedback(event);
  if (action === 'run-reaction') {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reaction]');
    const reaction = button?.dataset.reaction as ReactionId | undefined;
    const card = reaction ? app.querySelector<HTMLElement>(`[data-reaction-card="${reaction}"]`) : null;
    const feedbackText = reaction ? `${REACTIONS[reaction].equationInput} → ${REACTIONS[reaction].equationOutput}` : 'Fusion + Energie';
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
  if (action === 'tutorial-next') { advanceTutorial('next'); return; }
  if (action === 'skip-tutorial') { setTutorial(state.tutorial.step, true); showToast('Tutorial übersprungen. Über ? kannst du es erneut starten.'); return; }
  if (action === 'replay-tutorial') { setTutorial(0, false); showToast('Tutorial neu gestartet.'); return; }
  if (action === 'dismiss-achievement') { dismissAchievement(); return; }
  if (action === 'reset-menu') { toggleResetMenu(); return; }
  if (action === 'reset-run') { performReset('run'); return; }
  if (action === 'reset-full') { if (fullResetArmed) performReset('full'); else armFullReset(); return; }
  if (action === 'toggle-perks') { setPerksOpen(!perksOpen); return; }
  if (action === 'toggle-sound-menu') { setSoundMenuOpen(!soundMenuOpen); return; }
  if (action === 'open-stats') { statsOpen = true; chronicleOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (action === 'close-stats') { statsOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (action === 'open-chronicle') { chronicleOpen = true; statsOpen = false; overlaySignature = ''; syncOverlay(); advanceTutorial('open-chronicle'); return; }
  if (action === 'close-chronicle') { chronicleOpen = false; overlaySignature = ''; syncOverlay(); return; }
  if (action === 'open-summary') { makeSummaryExclusive(); dispatch({ type: 'OPEN_SUMMARY' }); return; }
  if (action === 'close-summary') { clearPrestigeConfirmation(); dispatch({ type: 'CLOSE_SUMMARY' }); return; }
  if (action === 'prestige') {
    if (!hasPendingPerks() && hasAffordableSummaryPerk() && !prestigeConfirmationArmed) { armPrestigeConfirmation(); return; }
    clearPrestigeConfirmation();
    dispatch({ type: 'PRESTIGE' });
    switchPanel('reactions', false);
    return;
  }
  if (action.startsWith('select-cloud-')) { clearPrestigeConfirmation(); dispatch({ type: 'SELECT_CLOUD_TIER', tier: Number(action.slice(-1)) as CloudTier }); return; }
  if (action.startsWith('buy-perk-') || action.startsWith('remove-perk-')) clearPrestigeConfirmation();
  if (action === 'run-reaction' && button.dataset.reaction) {
    dispatch({ type: 'RUN_REACTION', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  if (action === 'buy-reaction-automation' && button.dataset.reaction) {
    dispatch({ type: 'BUY_REACTION_AUTOMATION', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  const actions: Record<string, GameAction> = {
    accrete: { type: 'ACCRETE' }, 'buy-deuterium': { type: 'BUY_DEUTERIUM' }, 'buy-gravity': { type: 'BUY_GRAVITY' }, 'buy-accretion': { type: 'BUY_ACCRETION' }, 'buy-perk-cloud': { type: 'BUY_PERK', perk: 'largerCloud' }, 'buy-perk-gravity': { type: 'BUY_PERK', perk: 'permanentGravity' }, 'buy-perk-fusion': { type: 'BUY_PERK', perk: 'fusionMemory' }, 'remove-perk-cloud': { type: 'REMOVE_PERK', perk: 'largerCloud' }, 'remove-perk-gravity': { type: 'REMOVE_PERK', perk: 'permanentGravity' }, 'remove-perk-fusion': { type: 'REMOVE_PERK', perk: 'fusionMemory' }, 'toggle-sound': { type: 'TOGGLE_SOUND' },
  };
  if (actions[action]) { dispatch(actions[action]); playActionFeedback(action, event as MouseEvent); if (action === 'accrete') advanceTutorial('accrete'); }
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
    clearAchievements(); state = { ...imported, lastTick: Date.now() }; saveGame(state); updateUI(true); showToast('Spielstand erfolgreich importiert.');
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
    if (state.tutorial.introSeen) {
      const wasCompleted = state.completed;
      state = tick(state, delta);
      if (!wasCompleted && state.completed) {
        makeSummaryExclusive();
        playSound('complete', state.soundEnabled, state.volume);
      }
    }
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
  __fusionRate: () => reactionAutomationPerSecond(state, 'hydrogen'),
});
