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
  STAGES,
  STAGE_LABELS,
  THRESHOLDS,
  UPGRADE_ORDER,
  UPGRADES,
  type AutomationKind,
  type CloudGrowthPath,
  type MatterKey,
  type UpgradeDefinition,
  type UpgradeId,
} from '../content';
import {
  automationCost,
  automationValueAtLevel,
  automationSupplyExhausted,
  accretionPerClick,
  cloudDefinition,
  reactionAutomationPerSecond,
  reactionAvailable,
  reactionCapacity,
  reactionManualAmount,
  reactionManualAmountAtLevel,
  reactionUpgradeCost,
  starMass,
  upgradeSupplyExhausted,
  upgradeCost,
  upgradeValueAtLevel,
} from '../game/engine';
import type { CloudTier, ReactionId, Stage, StellarOutcome } from '../game/types';
import { disabled, formatCompact, formatDuration, formatMatter, formatNumber, formatTemperature, icons, levelPips } from './format';
import { getState, type Panel } from './store';

// Gemeinsamer Eck-Ausbaubutton für Automations-, Upgrade- und Reaktionskarten
// (ersetzt den bisherigen Progress-Button unten in der Kachel). Der Preis
// steht — wo relevant — direkt im Button unter dem Icon statt in einem
// Tooltip (Tooltips sind auf Mobilgeräten nicht nutzbar und für Spieler
// schwer zu entdecken); aria-label bleibt für Screenreader erhalten, löst
// aber keinen sichtbaren Hover-Tooltip aus. Ist eine Stufe gerade bezahlbar,
// bekommt der Button zusätzlich denselben Amber-Glow wie das Warnsymbol.
//
// Icon-Folge: Reaktionen zeigen von Anfang an den Doppel-Caret (nie ein
// Schloss) — der Ausbau-Button erscheint dort ohnehin erst, sobald die
// Reaktion selbst freigeschaltet ist, ein Sperrzustand existiert also nicht.
// Upgrades und Automationen starten dagegen IMMER als Schloss und wechseln
// erst NACH der ersten gekauften Stufe zum Doppel-Caret bzw. bei Erreichen
// des Maximums zum Haken — unabhängig davon, ob die Voraussetzungen längst
// erfüllt und der Ausbau bereits möglich/bezahlbar wäre. Das steuert der
// separate `showLock`-Parameter, der bewusst getrennt vom `unlocked`-Status
// ist: `unlocked` entscheidet weiterhin, ob der Preis überhaupt sichtbar ist
// und ob der Button als „gesperrt“ gestylt/deaktiviert wird, `showLock`
// steuert ausschließlich, welches Icon zu sehen ist.
export function tileButtonInner(complete: boolean, unlocked: boolean, showLock: boolean, costText: string): string {
  const icon = complete ? icons.check : showLock ? icons.lock : icons.buildUp;
  const price = !complete && unlocked && costText ? `<span class="tile-action-price" data-tile-price>${costText}</span>` : '';
  return `<span class="tile-action-icon">${icon}</span>${price}`;
}

function tileActionButton(options: {
  action: string;
  dataset?: Record<string, string>;
  complete: boolean;
  unlocked: boolean;
  showLock: boolean;
  affordable: boolean;
  fillPercent: number;
  costText: string;
  ariaLabel: string;
}): string {
  const { action, dataset, complete, unlocked, showLock, affordable, fillPercent, costText, ariaLabel } = options;
  const stateClass = complete ? 'is-complete' : !unlocked ? 'is-locked' : affordable ? 'is-buildable' : '';
  const tileState = complete ? 'complete' : !unlocked ? 'locked' : 'open';
  const fill = Math.max(0, Math.min(100, fillPercent));
  const attrs = Object.entries(dataset ?? {}).map(([key, value]) => ` data-${key}="${value}"`).join('');
  return `<button class="tile-action-button ${stateClass}" data-action="${action}"${attrs} data-tile-state="${tileState}" aria-label="${ariaLabel}" style="--tile-fill:${fill}%" ${disabled(!affordable)}>${tileButtonInner(complete, unlocked, showLock, costText)}</button>`;
}

export const automationVisible = (kind: AutomationKind): boolean => {
  const state = getState();
  const reaction = AUTOMATIONS[kind].reaction;
  return !reaction || state.unlockedReactions.includes(reaction);
};

const reactionOutput = (reaction: ReactionId): number =>
  getState().reactionTotals[reaction] * (REACTIONS[reaction].outputs[REACTIONS[reaction].primaryOutput] ?? 1);

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
  UPGRADE_ORDER.forEach((id) => {
    const view = upgradeView(id);
    if (!view.complete && view.visible && view.unlocked && state.energy >= view.price) {
      upgrades.push(`${id}:${view.level}`);
    }
  });
  AUTOMATION_ORDER.forEach((kind) => {
    const definition = AUTOMATIONS[kind];
    const level = state.automation[kind];
    const price = automationCost(kind, level);
    if (automationVisible(kind) && level < definition.maxLevel && automationMastery(kind) >= definition.mastery.threshold && state.energy >= price && !automationSupplyExhausted(state, kind)) automation.push(`${kind}:${level}`);
  });
  return { reactions, upgrades, automation };
}

export interface ReactionView {
  id: ReactionId;
  visible: boolean;
  unlocked: boolean;
  available: boolean;
  amount: number;
  energy: number;
  label: string;
  detail: string;
  upgradeLevel: number;
  upgradePrice: number;
  upgradeMax: boolean;
  upgradeAffordable: boolean;
}

// Zeigt im manuellen Reaktionsbutton die tatsächlich bei diesem Klick
// umgesetzten Mengen. Damit stimmen auch Teilreaktionen bei fast leerem Kern
// sowie die durch Reaktionsausbauten erhöhte Menge automatisch. γ steht hier
// für die dabei gewonnene Spielenergie.
const formatReactionAmount = (value: number): string => {
  if (value >= 1_000_000) return formatCompact(value);
  if (value < 1) return formatNumber(value, 2);
  if (value < 10) return formatNumber(value, 1);
  return formatNumber(value);
};

function reactionConversionLabel(id: ReactionId, amount: number, energy: number): string {
  const definition = REACTIONS[id];
  const side = (matter: Partial<Record<MatterKey, number>>): string => Object.entries(matter)
    .filter((entry): entry is [MatterKey, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([key, ratio]) => `${formatReactionAmount(amount * ratio)} ${RESOURCES[key].symbol}`)
    .join(' + ');
  return `${side(definition.inputs)} → ${side(definition.outputs)} + ${formatReactionAmount(energy)} γ`;
}

export function reactionView(id: ReactionId): ReactionView {
  const state = getState();
  const definition = REACTIONS[id];
  const unlocked = state.unlockedReactions.includes(id);
  const capacity = reactionCapacity(state, id);
  const amount = Math.min(reactionManualAmount(state, id), capacity);
  const inputMass = Object.values(definition.inputs).reduce((sum, ratio) => sum + amount * (ratio ?? 0), 0);
  const outputMass = Object.values(definition.outputs).reduce((sum, ratio) => sum + amount * (ratio ?? 0), 0);
  const energy = (definition.energyBasis === 'input' ? inputMass : outputMass) * definition.energyPerUnit;
  const nextLocked = REACTION_ORDER.find((reaction) => !state.unlockedReactions.includes(reaction));
  const visible = unlocked || id === nextLocked;
  const available = reactionAvailable(state, id);
  const label = !unlocked ? `Ab ${formatTemperature(definition.ignitionTemperature)}`
    : capacity <= 0 ? 'Kein Brennstoff verfügbar.'
      : 'Fusionieren';
  // Punkt 2: Zustand des Reaktionsausbaus für die Karte.
  const upgradeLevel = state.reactionUpgrades[id];
  const upgradePrice = reactionUpgradeCost(id, upgradeLevel);
  const upgradeMax = upgradeLevel >= definition.upgrade.maxLevel;
  return {
    id, visible, unlocked, available, amount, energy, label,
    detail: !unlocked ? '' : capacity > 0 ? reactionConversionLabel(id, amount, energy) : '',
    upgradeLevel, upgradePrice, upgradeMax, upgradeAffordable: !upgradeMax && state.energy >= upgradePrice,
  };
}

// Punkt 7: Ausbau-Button oben rechts auf der Reaktionskarte, analog zu
// Automationen/Upgrades — nur bei bereits freigeschalteten Reaktionen (eine
// gesperrte Reaktion hat noch keinen Ausbau, daher kein Schloss-Zustand hier).
// Das Icon ist deshalb von Anfang an der Doppel-Caret (showLock: false), nie
// ein Schloss — anders als bei Upgrades/Automationen. Die Kachel zeigt hier
// weiterhin echten Fortschritt im Button-Fill (Energie ⁄ Ausbaupreis).
function reactionUpgradeButton(view: ReactionView): string {
  if (!view.unlocked) return '';
  const fillPercent = view.upgradeMax ? 0 : getState().energy / view.upgradePrice * 100;
  const ariaLabel = view.upgradeMax ? 'Reaktionsausbau voll ausgebaut' : `Reaktionsausbau für ${view.upgradePrice} Energie`;
  return tileActionButton({
    action: 'buy-reaction-upgrade',
    dataset: { reaction: view.id },
    complete: view.upgradeMax,
    unlocked: true,
    showLock: false,
    affordable: view.upgradeAffordable,
    fillPercent,
    costText: view.upgradeMax ? '' : `${view.upgradePrice} E`,
    ariaLabel,
  });
}

// Punkt 7/8: Analog zu Automationen/Upgrades zeigt die Karte den aktuellen
// Wert (manuelle Fusionsmenge inkl. Ausbau) und den Wert der nächsten Stufe
// nebeneinander direkt unter der Titelzeile.
function reactionRateRow(view: ReactionView): string {
  if (!view.unlocked) return '';
  const state = getState();
  const definition = REACTIONS[view.id];
  const symbol = RESOURCES[definition.primaryInput].symbol;
  const nextLevel = Math.min(definition.upgrade.maxLevel, view.upgradeLevel + 1);
  const currentAmount = reactionManualAmount(state, view.id);
  const nextAmount = reactionManualAmountAtLevel(state, view.id, nextLevel);
  return `<div class="tile-rate"><div><span>Aktuell</span><b>${formatMatter(currentAmount)} ${symbol}</b></div><div><span>Nächste Stufe:</span> <b>${view.upgradeMax ? 'Voll ausgebaut' : `${formatMatter(nextAmount)} ${symbol}`}</b></div></div>`;
}

// Ausbaustufen (Pips) stehen ganz unten in der Kachel, exakt wie bei
// Automationen/Upgrades — kein eigener umschließender Abschnitt/Trennstrich
// mehr. Der Ausbaupreis steht NICHT zusätzlich hier (wie früher), sondern nur
// noch einmal im Eck-Ausbaubutton selbst — die doppelte Anzeige war redundant.
function reactionUpgradeFooter(view: ReactionView): string {
  if (!view.unlocked) return '';
  return `<div class="level-row" data-reaction-upgrade-levels="${view.id}">${levelPips(view.upgradeLevel, REACTIONS[view.id].upgrade.maxLevel)}</div>`;
}

// Punkt 4: Reaktionskarten folgen jetzt derselben Grundstruktur wie
// Automations-/Upgradekarten (Icon+Titel-Zeile, Aktuell/Nächste-Stufe,
// Beschreibung, Ausbaustufen, Kosten) — nur der Kicker (Reaktionskette-Label)
// und der Fusions-Button haben dort keine Entsprechung und stehen als
// zusätzliche Zeile zwischen Beschreibung und Pips. Die dynamische Gleichung
// steht direkt als Detailzeile im Button, daher braucht die Karte keine zweite,
// statische Gleichungszeile mehr.
function reactionCard(view: ReactionView): string {
  const definition = REACTIONS[view.id];
  const primaryOutput = RESOURCES[definition.primaryOutput];
  return `<div class="action-card ${view.available ? 'is-ready' : ''}" data-reaction-card="${view.id}">
    ${reactionUpgradeButton(view)}
    <span class="card-kicker">${definition.kicker}</span>
    <div class="upgrade-heading"><span class="upgrade-icon reaction-symbol element ${primaryOutput.className}" aria-label="Erzeugt ${primaryOutput.label}">${primaryOutput.symbol}</span><h3>${definition.title}</h3></div>
    ${reactionRateRow(view)}
    <p>${definition.description}</p>
    <button class="primary-action compact" data-action="run-reaction" data-reaction="${view.id}" ${disabled(!view.available)}><span data-button-label>${view.label}</span><small class="reaction-conversion" data-button-detail>${view.detail}</small></button>
    ${reactionUpgradeFooter(view)}
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
  exhausted: boolean;
  complete: boolean;
  value: string;
  detail: string;
  label: string;
  priority: number;
  // Fortschritt Richtung Freischaltung (0..1), solange noch gesperrt — treibt
  // den Fill des Eck-Ausbaubuttons. Bei mehreren Voraussetzungen (z. B.
  // Deuteriumbrennen: Mindestmasse UND -temperatur) zählt die am wenigsten
  // erfüllte, weil die insgesamt limitierende ist.
  unlockProgress: number;
}

export function upgradeView(id: UpgradeId): UpgradeView {
  const state = getState();
  const definition: UpgradeDefinition = UPGRADES[id];
  const level = state.upgrades[id];
  const price = upgradeCost(id, level);
  const visible = !definition.hiddenStages.includes(state.stage);
  const minimumMassReached = definition.requirements.minimumStarMass === undefined
    || starMass(state) >= definition.requirements.minimumStarMass;
  const minimumTemperatureReached = definition.requirements.minimumTemperature === undefined
    || state.temperature >= definition.requirements.minimumTemperature;
  const expired = definition.requirements.maximumTemperature !== undefined
    && state.temperature >= definition.requirements.maximumTemperature;
  const exhausted = upgradeSupplyExhausted(state, id);
  const complete = level >= definition.maxLevel;
  const unlocked = visible && minimumMassReached && minimumTemperatureReached && !expired && !exhausted;
  const value = `×${formatNumber(upgradeValueAtLevel(state, id, level), 2)}`;
  const detail = complete ? definition.value.detail.active : definition.value.detail.inactive;
  const label = complete ? definition.button.complete
    : expired ? definition.button.expired
      : exhausted && definition.supply ? definition.supply.exhaustedLabel
      : unlocked ? definition.button.purchase : definition.button.locked;
  const priority = complete || expired ? 2 : !unlocked ? 3 : state.energy >= price ? 0 : 1;
  const requirementFractions = [
    definition.requirements.minimumStarMass !== undefined ? starMass(state) / definition.requirements.minimumStarMass : undefined,
    definition.requirements.minimumTemperature !== undefined ? state.temperature / definition.requirements.minimumTemperature : undefined,
  ].filter((fraction): fraction is number => fraction !== undefined);
  const unlockProgress = requirementFractions.length ? Math.min(1, ...requirementFractions) : 1;
  return { id, definition, level, price, visible, unlocked, expired, exhausted, complete, value, detail, label, priority, unlockProgress };
}

// Wert der nächsten Ausbaustufe. Alle Upgrades verwenden dieselbe Formel und
// Darstellung; maxLevel entscheidet allein, wie viele Stufen kaufbar sind.
function upgradeNextValue(view: UpgradeView): string {
  const { definition, level } = view;
  const nextLevel = Math.min(definition.maxLevel, level + 1);
  return `×${formatNumber(upgradeValueAtLevel(getState(), view.id, nextLevel), 2)}`;
}

function upgradeCard(view: UpgradeView): string {
  const state = getState();
  const { definition, level, price, unlocked, complete } = view;
  const classes = ['upgrade-card', definition.cardClass].filter(Boolean).join(' ');
  const affordable = !complete && unlocked && state.energy >= price;
  const locked = !complete && !unlocked;
  // Fortschritts-Fill genau wie bei Reaktionen: gesperrt → Fortschritt Richtung
  // Freischaltung (unlockProgress), ausbaubar → Energie/Preis. Das Icon bleibt
  // davon unabhängig bewusst ein Schloss, bis mindestens eine Stufe gekauft
  // wurde (level === 0, showLock), unabhängig davon, ob die Voraussetzungen
  // längst erfüllt und der Kauf schon möglich wäre.
  const fillPercent = complete ? 0 : locked ? view.unlockProgress * 100 : state.energy / price * 100;
  const showLock = level === 0;
  const ariaLabel = complete ? definition.button.complete
    : locked ? view.label
      : `${definition.button.purchase} für ${price} Energie`;
  // Punkt 5: Kosten verschwinden vollständig, sobald voll ausgebaut. Punkt 9:
  // Solange ausbaubar steht der Preis direkt im Button; der Sperrgrund passt
  // dort nicht hinein und bleibt daher als eigene Textzeile sichtbar.
  return `
    <article class="${classes}" data-upgrade-card="${view.id}">
      ${tileActionButton({ action: definition.action, complete, unlocked, showLock, affordable, fillPercent, costText: complete ? '' : `${price} E`, ariaLabel })}
      <div class="upgrade-heading"><span class="upgrade-icon">${definition.icon}</span><h3>${definition.title}</h3></div>
      <div class="tile-rate"><div><span>Aktuell</span><b>${locked ? '-' : view.value}</b></div><div><span>Nächste Stufe:</span> <b>${complete ? 'Voll ausgebaut' : upgradeNextValue(view)}</b></div></div>
      <p>${definition.description}${view.detail ? `<strong>${view.detail}</strong>` : ''}</p>
      <div class="level-row" data-levels="${view.id}">${levelPips(level, definition.maxLevel)}</div>
      ${locked ? `<div class="tile-cost" data-upgrade-cost="${view.id}">${view.label}</div>` : ''}
    </article>`;
}

export function automationView(kind: AutomationKind) {
  const state = getState();
  const definition = AUTOMATIONS[kind];
  const level = state.automation[kind];
  const mastery = automationMastery(kind);
  const rateAt = (nextLevel: number): number => definition.reaction
    ? reactionAutomationPerSecond({ ...state, automation: { ...state.automation, [kind]: nextLevel } }, definition.reaction)
    : automationValueAtLevel(kind, nextLevel) * (accretionPerClick(state) / ACCRETION.manualBase);
  // Punkt 1: Eine Automation mit versiegter Nachschubquelle (z. B. leere
  // Urwolke) kann nicht weiter ausgebaut werden und zeigt das auch an.
  const exhausted = automationSupplyExhausted(state, kind);
  return {
    ...definition,
    level,
    max: definition.maxLevel,
    price: automationCost(kind, level),
    unlocked: mastery >= definition.mastery.threshold && !exhausted,
    exhausted,
    lockedLabel: exhausted && definition.supply
      ? definition.supply.exhaustedLabel
      : definition.mastery.kind === 'starMass'
        ? 'Protostern erforderlich'
        : `${formatMatter(mastery)} / ${formatMatter(definition.mastery.threshold)} ${definition.mastery.symbol}`,
    // Fortschritt Richtung Freischaltung (0..1) — treibt den Fill des
    // Eck-Ausbaubuttons, solange die Automation noch gesperrt ist.
    unlockProgress: Math.min(1, mastery / definition.mastery.threshold),
    action: definition.reaction ? 'buy-reaction-automation' : 'buy-accretion',
    rateAt,
  };
}

function automationCard(kind: AutomationKind): string {
  const state = getState();
  const view = automationView(kind);
  const { level, max, price, unlocked } = view;
  const isMax = level >= max;
  const currentRate = view.rateAt(level);
  // Punkt 4: "Nächste Stufe" zeigt bei Automationen den Gesamtwert nach der
  // nächsten Ausbaustufe, nicht mehr das Inkrement.
  const nextRate = view.rateAt(Math.min(max, level + 1));
  const affordable = !isMax && unlocked && state.energy >= price;
  // Fortschritts-Fill genau wie bei Reaktionen/Upgrades: gesperrt → Fortschritt
  // Richtung Meisterschaftsschwelle (unlockProgress), ausbaubar → Energie/
  // Preis. Schloss bleibt davon unabhängig bis zur ersten gekauften Stufe,
  // unabhängig von der Freischaltung (Punkt 1, showLock).
  const fillPercent = isMax ? 0 : !unlocked ? view.unlockProgress * 100 : state.energy / price * 100;
  const showLock = level === 0;
  const ariaLabel = isMax ? 'Maximum' : !unlocked ? view.lockedLabel : `Ausbauen für ${price} Energie`;
  return `
    <article class="upgrade-card" data-automation-card="${kind}">
      ${tileActionButton({ action: view.action, dataset: view.reaction ? { reaction: view.reaction } : undefined, complete: isMax, unlocked, showLock, affordable, fillPercent, costText: isMax ? '' : `${price} E`, ariaLabel })}
      <div class="upgrade-heading"><span class="upgrade-icon">${view.icon}</span><h3>${view.title}</h3></div>
      <div class="tile-rate"><div><span>Aktuell</span><b>${!unlocked ? '-' : `${formatMatter(currentRate)} ${view.unit}`}</b></div><div><span>Nächste Stufe:</span> <b>${isMax ? 'Voll ausgebaut' : `${formatMatter(nextRate)} ${view.unit}`}</b></div></div>
      <p>${view.description}</p>
      <div class="level-row">${levelPips(level, max)}</div>
      ${!isMax && !unlocked ? `<div class="tile-cost" data-automation-cost="${kind}">${view.lockedLabel}</div>` : ''}
    </article>`;
}

// Punkt 3: Die Stellare Entwicklung zeigt nur noch den tatsächlich
// durchlaufenen Weg BIS JETZT plus genau einen offenen „?“-Knoten — keine
// Zukunftsprognose mehr, denn der Ausgang hängt vom Verhalten des Spielers ab
// (Akkretion, Windverluste, Brenntempo). Durchlaufene Stadien werden
// deterministisch aus dem Spielzustand rekonstruiert (Spitzentemperatur,
// freigeschaltete Reaktionen, Reaktionssummen), sodass keine zusätzliche
// Historie gespeichert oder migriert werden muss.
export type TimelineNode = [Stage | 'open', string, string];

export function timelineNodes(tier: CloudTier = getState().cloudTier): TimelineNode[] {
  const state = getState();
  const definition = cloudDefinition(tier);
  const unlocked = (id: ReactionId): boolean => state.unlockedReactions.includes(id);
  const nodes: TimelineNode[] = [['nebula', 'Urwolke', definition.shortName]];
  if (state.stats.peakTemperature >= THRESHOLDS.protostarTemperature) nodes.push(['protostar', 'Protostern', '100.000 K']);
  if (state.stats.peakTemperature >= THRESHOLDS.deuteriumTemperature) nodes.push(['deuterium', 'D-Brennen', '1 Mio. K']);
  if (unlocked('hydrogen')) nodes.push(['hydrogen', REACTIONS.hydrogen.title, formatTemperature(REACTIONS.hydrogen.ignitionTemperature)]);
  if (state.reactionTotals.hydrogen >= THRESHOLDS.mainSequenceHydrogen) nodes.push(['mainSequence', 'Hauptreihe', 'H bleibt aktiv']);
  if (state.stage === 'redGiant' || unlocked('helium')) nodes.push(['redGiant', 'Roter Riese', 'Kernkontraktion']);
  if (unlocked('helium')) nodes.push(['helium', REACTIONS.helium.title, formatTemperature(REACTIONS.helium.ignitionTemperature)]);
  const heavyIds = (['carbon', 'neon', 'oxygen', 'silicon'] as const).filter(unlocked);
  if (state.stage === 'massiveStar' || heavyIds.length) nodes.push(['massiveStar', 'Massereicher Stern', 'Späte Brennphasen']);
  heavyIds.forEach((id) => nodes.push([REACTIONS[id].stageOnUnlock, REACTIONS[id].title, formatTemperature(REACTIONS[id].ignitionTemperature)]));
  if (state.stage === 'ironCore' || state.outcome === 'neutronStar' || state.outcome === 'blackHole') nodes.push(['ironCore', 'Eisenkern', 'Fusion endet']);
  if (state.outcome === 'neutronStar' || state.outcome === 'blackHole') nodes.push(['supernova', 'Supernova', 'Kernkollaps']);
  if (state.completed && state.outcome) {
    if (!nodes.some(([key]) => key === state.stage)) nodes.push([state.stage, OUTCOME_LABELS[state.outcome], 'Zyklus abgeschlossen']);
  } else {
    if (!nodes.some(([key]) => key === state.stage)) nodes.push([state.stage, STAGE_LABELS[state.stage], STAGES[state.stage].detail]);
    nodes.push(['open', 'Sternentwicklung', 'Ausgang offen']);
  }
  return nodes;
}

export function timelineMarkup(): string {
  const state = getState();
  const nodes = timelineNodes();
  const stageIndex = Math.max(0, nodes.findIndex(([key]) => key === state.stage));
  return nodes.map(([key, label, detail], index) => {
    const isOpen = key === 'open';
    return `<div class="timeline-node ${!isOpen && index <= stageIndex ? 'done' : ''} ${key === state.stage ? 'current' : ''} ${isOpen ? 'is-open' : ''}"><i>${isOpen ? '?' : index < stageIndex ? '✓' : index + 1}</i><span><b>${label}</b><small>${detail}</small></span></div>`;
  }).join('');
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
    return `<article class="evolution-branch ${unlocked ? 'is-unlocked' : 'is-locked'} ${known ? 'is-discovered' : ''} ${current ? 'is-current' : ''}"><span>${label.shortName.toUpperCase()}</span><h3>${unlocked ? label.name : 'Unbekannte Wolke'}</h3><p>${unlocked ? detail : 'Über Wolkenmasse freischalten.'}</p><strong>${known ? `Entdeckt: ${OUTCOME_LABELS[outcome]}` : unlocked ? 'Noch nicht entdeckt' : 'Gesperrt'}</strong></article>`;
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

export function logMarkup(limit?: number): string {
  const entries = limit === undefined ? getState().log : getState().log.slice(0, limit);
  return entries.map((entry) => `<div class="log-entry ${entry.kind}"><i></i><div><time>Zyklus ${entry.run.toString().padStart(2, '0')} · ${formatDuration(entry.elapsed)} · Gesamt ${formatDuration(entry.totalElapsed)}</time><p>${entry.text}</p></div></div>`).join('');
}

export function orderedUpgradeCards(): { view: UpgradeView; markup: string }[] {
  return UPGRADE_ORDER
    .map(upgradeView)
    .filter((view) => view.visible)
    .sort((a, b) => a.priority - b.priority)
    .map((view) => ({ view, markup: upgradeCard(view) }));
}

export const upgradeOrderSignature = (): string => orderedUpgradeCards()
  .map(({ view }) => `${view.id}:${view.priority}:${view.level}:${view.expired}:${view.exhausted}`)
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
