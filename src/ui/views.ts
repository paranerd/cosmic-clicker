import {
  ACCRETION,
  AUTOMATIONS,
  AUTOMATION_ORDER,
  CLOUD_PATH_ORDER,
  cloudGrowthPath,
  cloudPathName,
  OUTCOME_LABELS,
  REACTIONS,
  REACTION_ORDER,
  RESOURCES,
  UPGRADE_ORDER,
  UPGRADES,
  type AutomationKind,
  type CloudGrowthPath,
  type UpgradeDefinition,
  type UpgradeId,
} from '../content';
import {
  automationCost,
  accretionPerClick,
  cloudDefinition,
  reactionAutomationPerSecond,
  reactionAvailable,
  reactionCapacity,
  starMass,
  stellarFusionMultiplier,
} from '../game/engine';
import type { CloudTier, ReactionId, Stage, StellarOutcome } from '../game/types';
import { disabled, formatCompact, formatDuration, formatMatter, formatNumber, formatTemperature, levelPips, progress } from './format';
import { getState, type Panel } from './store';

export const automationVisible = (kind: AutomationKind): boolean => {
  const state = getState();
  const reaction = AUTOMATIONS[kind].reaction;
  return !reaction || state.unlockedReactions.includes(reaction);
};

const reactionOutput = (reaction: ReactionId): number =>
  getState().reactionTotals[reaction] * (Object.values(REACTIONS[reaction].outputs)[0] ?? 1);

export const automationMastery = (kind: AutomationKind): number => {
  const mastery = AUTOMATIONS[kind].mastery;
  return mastery.kind === 'starMass' ? starMass(getState()) : reactionOutput(mastery.reaction);
};

export function currentOpportunities(): Record<Panel, string[]> {
  const state = getState();
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
  const state = getState();
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

export interface UpgradeView {
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

export function upgradeView(id: UpgradeId): UpgradeView {
  const state = getState();
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
  const state = getState();
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

export function automationView(kind: AutomationKind) {
  const state = getState();
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
  const state = getState();
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

export function timelineNodes(tier: CloudTier = getState().cloudTier): [Stage, string, string][] {
  const state = getState();
  const definition = cloudDefinition(tier);
  const formation: [Stage, string, string][] = [
    ['nebula', 'Urwolke', definition.shortName],
    ['protostar', 'Protostern', '100.000 K'],
    ['deuterium', 'D-Brennen', '1 Mio. K'],
  ];
  const path = cloudGrowthPath(definition.solarMasses);
  if (path === 'brownDwarf') return [...formation, ['brownDwarf', state.completed ? 'Brauner Zwerg' : 'Sternentwicklung', state.completed ? 'Nicht gezündet' : 'Ausgang offen']];
  const stellar: [Stage, string, string][] = [
    ['hydrogen', REACTIONS.hydrogen.title, formatTemperature(REACTIONS.hydrogen.ignitionTemperature)],
    ['mainSequence', 'Hauptreihe', 'H bleibt aktiv'],
    ['redGiant', 'Roter Riese', 'Kernkontraktion'],
    ['helium', REACTIONS.helium.title, formatTemperature(REACTIONS.helium.ignitionTemperature)],
  ];
  if (path === 'stellar') return [...formation, ...stellar, ['whiteDwarf', 'Weißer Zwerg', 'Masse entscheidet']];
  const heavy = (['carbon', 'neon', 'oxygen', 'silicon'] as const).map((id): [Stage, string, string] => [
    REACTIONS[id].stageOnUnlock,
    REACTIONS[id].title,
    formatTemperature(REACTIONS[id].ignitionTemperature),
  ]);
  return [...formation, ...stellar, ...heavy, ['ironCore', 'Eisenkern', 'Fusion endet'], ['supernova', 'Supernova', 'Kernkollaps'], [state.outcome === 'blackHole' ? 'blackHole' : 'neutronStar', state.outcome === 'blackHole' ? 'Schwarzes Loch' : 'Sternrest', 'Masse entscheidet']];
}

export function timelineMarkup(): string {
  const state = getState();
  const nodes = timelineNodes();
  const stageIndex = Math.max(0, nodes.findIndex(([key]) => key === state.stage));
  return nodes.map(([key, label, detail], index) => `<div class="timeline-node ${index <= stageIndex ? 'done' : ''} ${key === state.stage ? 'current' : ''}"><i>${index < stageIndex ? '✓' : index + 1}</i><span><b>${label}</b><small>${detail}</small></span></div>`).join('');
}

export function evolutionMapMarkup(): string {
  const state = getState();
  const discovered = new Set(state.discoveredOutcomes);
  const maxUnlockedSolarMasses = cloudDefinition(state.perks.largerCloud).solarMasses;
  const maxUnlockedPath = cloudGrowthPath(maxUnlockedSolarMasses);
  const currentPath = cloudGrowthPath(cloudDefinition(state.cloudTier).solarMasses);
  const branch = (path: CloudGrowthPath, outcome: StellarOutcome, detail: string) => {
    const unlocked = CLOUD_PATH_ORDER.indexOf(maxUnlockedPath) >= CLOUD_PATH_ORDER.indexOf(path);
    const known = discovered.has(outcome);
    const current = currentPath === path;
    const label = cloudPathName(path);
    return `<article class="evolution-branch ${unlocked ? 'is-unlocked' : 'is-locked'} ${known ? 'is-discovered' : ''} ${current ? 'is-current' : ''}"><span>${label.shortName.toUpperCase()}</span><h3>${unlocked ? label.name : 'Unbekannte Wolke'}</h3><p>${unlocked ? detail : 'Über Wolkenwachstum freischalten.'}</p><strong>${known ? `Entdeckt: ${OUTCOME_LABELS[outcome]}` : unlocked ? 'Noch nicht entdeckt' : 'Gesperrt'}</strong></article>`;
  };
  return `<div class="evolution-map">
    ${branch('brownDwarf', 'brownDwarf', 'Unterhalb der Zündmasse → Brauner Zwerg')}
    <div class="massive-branches">
      ${branch('stellar', 'heliumWhiteDwarf', 'Wasserstoff endet früh → Helium-Weißer-Zwerg')}
      ${branch('stellar', 'whiteDwarf', 'Heliumfusion → Kohlenstoff-Sauerstoff-Weißer-Zwerg')}
    </div>
    <div class="massive-branches">
      ${branch('massive', 'oxygenNeonWhiteDwarf', 'Fortgeschrittenes Brennen stoppt → O/Ne-Weißer-Zwerg')}
      ${branch('massive', 'neutronStar', 'Eisenkern kollabiert → Neutronenstern')}
      ${branch('massive', 'blackHole', 'Sehr massereicher Eisenkern → Schwarzes Loch')}
    </div>
  </div>`;
}

export function logMarkup(limit = 5): string {
  return getState().log.slice(0, limit).map((entry) => `<div class="log-entry ${entry.kind}"><i></i><p>${entry.text}</p></div>`).join('');
}

export function orderedUpgradeCards(): { view: UpgradeView; markup: string }[] {
  return UPGRADE_ORDER
    .map(upgradeView)
    .filter((view) => view.visible)
    .sort((a, b) => a.priority - b.priority)
    .map((view) => ({ view, markup: upgradeCard(view) }));
}

export const upgradeOrderSignature = (): string => orderedUpgradeCards()
  .map(({ view }) => `${view.id}:${view.priority}:${view.level}:${view.expired}`)
  .join('|');

export function panelMarkup(panel: Panel): string {
  if (panel === 'reactions') return renderReactionPanel();
  if (panel === 'upgrades') {
    const cards = orderedUpgradeCards();
    return `<div class="upgrade-grid ${cards.length === 1 ? 'single-upgrade' : ''}">${cards.map((card) => card.markup).join('')}</div>`;
  }
  const automations = AUTOMATION_ORDER.filter(automationVisible);
  return `<div class="upgrade-grid automation-grid ${automations.length === 1 ? 'single-upgrade' : ''}">${automations.map(automationCard).join('')}</div>`;
}

export function statsEntries(): [string, string, string][] {
  const state = getState();
  const stats = state.stats;
  const heavyReactions: [string, string, string][] = (['carbon', 'neon', 'oxygen', 'silicon'] as const)
    .filter((id) => state.unlockedReactions.includes(id) || state.reactionTotals[id] > 0)
    .map((id) => [`reaction-${id}`, `${REACTIONS[id].title}: Brennstoff`, `${formatMatter(state.reactionTotals[id])} ${RESOURCES[REACTIONS[id].primaryInput].symbol}`]);
  return [
    ['matter', 'Eingesammelte Materie', `${formatMatter(stats.matterAccreted)} ME`],
    ['energy', 'Erzeugte Energie', formatCompact(stats.energyGenerated)],
    ['temperature', 'Erreichte Temperatur', formatTemperature(stats.peakTemperature)],
    ['stellar-wind', 'Durch Sternwind verloren', `${formatMatter(stats.matterLostToWind)} ME`],
    ['shell-wind', 'Davon durch Hüllenwind', `${formatMatter(stats.matterLostToShellWind)} ME`],
    ['fusion', 'Manuelle Fusionen', formatNumber(stats.manualFusionActions)],
    ['hydrogen', 'Wasserstoff fusioniert', `${formatMatter(stats.hydrogenFused)} H`],
    ['helium', 'Helium fusioniert', `${formatMatter(stats.heliumFused)} He`],
    ['oxygen', 'Sauerstoff erzeugt', `${formatMatter(stats.oxygenCreated)} O`],
    ...heavyReactions,
  ];
}

export function statsGridMarkup(live = false): string {
  return statsEntries().map(([key, label, value]) => `<div><span>${label}</span><b${live ? ` data-live-stat="${key}"` : ''}>${value}</b></div>`).join('');
}

export function historyMarkup(): string {
  const state = getState();
  if (!state.history.length) return '<p class="empty-history">Noch keine abgeschlossene Runde archiviert.</p>';
  return state.history.slice(0, 5).map((record) => `<article><span>ZYKLUS ${record.run.toString().padStart(2, '0')}</span><b>${OUTCOME_LABELS[record.outcome]}</b><small>${formatMatter(record.finalMass)} ME · ${formatDuration(record.duration)} · +${record.stardustEarned} ✦</small></article>`).join('');
}
