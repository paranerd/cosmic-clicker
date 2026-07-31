import {
  ACCRETION,
  AUTOMATIONS,
  AUTOMATION_ORDER,
  cloudDefinitionForLevel,
  cloudMassForLevel,
  cloudMatterForLevel,
  cloudMatureAccretionMultiplier,
  cloudSolarMasses,
  CORE_COLLAPSE,
  EMPTY_MATTER,
  INITIAL_TEMPERATURE,
  levelValue,
  LIMITS,
  MATTER_KEYS,
  OBJECTIVE_EYEBROWS,
  OBJECTIVE_TEMPLATES,
  OBJECTIVES,
  OUTCOMES,
  PRESTIGE_PERKS,
  prestigePerkValue,
  REACTIONS,
  REACTION_ORDER,
  STAGES,
  stardustReward,
  STELLAR_WIND,
  STRUCTURAL_BURN_REFERENCE_MASS,
  TEMPERATURE_MODEL,
  THRESHOLDS,
  UPGRADES,
  UPGRADE_ORDER,
  type ActiveWarningId,
  type AutomationKind,
  type UpgradeDefinition,
  type UpgradeId,
  type UpgradePurchaseDefinition,
} from '../content';
import type {
  CloudTier,
  GameAction,
  GameState,
  LogEntry,
  Matter,
  PerkState,
  ReactionId,
  RoundRecord,
  RunStatistics,
  Stage,
  StellarOutcome,
  TutorialState,
  UpgradeState,
} from './types';

const END_STAGES: Record<Exclude<StellarOutcome, 'legacyMainSequence'>, Stage> = {
  brownDwarf: 'brownDwarf',
  heliumWhiteDwarf: 'heliumWhiteDwarf',
  whiteDwarf: 'whiteDwarf',
  oxygenNeonWhiteDwarf: 'oxygenNeonWhiteDwarf',
  neutronStar: 'neutronStar',
  blackHole: 'blackHole',
};

const totalMatter = (matter: Matter): number => MATTER_KEYS.reduce((sum, key) => sum + matter[key], 0);
const clampCloudTier = (tier: number): CloudTier => Math.max(0, Math.min(PRESTIGE_PERKS.largerCloud.maxLevel, Math.floor(tier)));
const emptyReactionTotals = (): Record<ReactionId, number> => Object.fromEntries(REACTION_ORDER.map((id) => [id, 0])) as Record<ReactionId, number>;
const emptyUpgradeLevels = (): UpgradeState =>
  Object.fromEntries(UPGRADE_ORDER.map((id) => [id, 0])) as unknown as UpgradeState;

export const starMass = (state: GameState): number => totalMatter(state.star);
export const cloudMass = (state: GameState): number => totalMatter(state.cloud);
export const cloudDefinition = (tier: CloudTier) => cloudDefinitionForLevel(tier);
export const solarMasses = (state: GameState): number => starMass(state) / THRESHOLDS.matterPerSolarMass;

export const upgradeValueAtLevel = (state: GameState, id: UpgradeId, level: number): number => {
  const definition: UpgradeDefinition = UPGRADES[id];
  const persistentPerk = definition.value.persistentPerk;
  const persistentEffect = persistentPerk
    ? prestigePerkValue(persistentPerk, state.perks[persistentPerk])
    : 1;
  return levelValue(level, definition.value.formula) * persistentEffect;
};

export const gravityMultiplier = (state: GameState): number =>
  upgradeValueAtLevel(state, 'gravity', state.upgrades.gravity);
export const stellarFusionMultiplier = (state: GameState): number =>
  prestigePerkValue('fusionMemory', state.perks.fusionMemory);
// Wirkt ausschließlich auf automatische Fusion. Manuelles Klicken bleibt
// davon unberührt, damit die Konvektionszone den Abstand zwischen Automation
// und Dauerklicken tatsächlich schließt, statt ihn mitzuskalieren.
export const convectionMultiplier = (state: GameState): number =>
  upgradeValueAtLevel(state, 'convection', state.upgrades.convection);

const matureAccretionMultiplier = (state: GameState): number =>
  state.unlockedReactions.includes('hydrogen') ? cloudMatureAccretionMultiplier(cloudSolarMasses(state.cloudTier)) : 1;
export const accretionPerClick = (state: GameState): number => ACCRETION.manualBase * matureAccretionMultiplier(state) * gravityMultiplier(state);
export const accretionPerSecond = (state: GameState): number =>
  automationValueAtLevel('accretion', state.automation.accretion) * matureAccretionMultiplier(state) * gravityMultiplier(state);

export const automationValueAtLevel = (kind: AutomationKind, level: number): number =>
  levelValue(level, AUTOMATIONS[kind].value);
export const reactionAutomationPerSecond = (state: GameState, reaction: ReactionId): number => {
  const kind = REACTIONS[reaction].automation;
  return automationValueAtLevel(kind, state.automation[kind]) * stellarFusionMultiplier(state) * convectionMultiplier(state);
};

// Punkt 2: manuelle Fusionsmenge einer Reaktion inklusive Reaktionsausbau
// (universelle Ertragskurve) und Fusionsgedächtnis-Perk.
// reactionManualAmountAtLevel ist von der tatsächlich gespeicherten Stufe
// entkoppelt, damit die Oberfläche den Wert einer hypothetischen nächsten
// Stufe für die "Aktuell/Nächste Stufe"-Anzeige der Reaktionskarte
// vorausberechnen kann (Punkt 7 des Kachel-Redesigns).
export const reactionUpgradeCost = (reaction: ReactionId, level: number): number =>
  Math.round(levelValue(level, REACTIONS[reaction].upgrade.cost));
export const reactionManualAmountAtLevel = (state: GameState, reaction: ReactionId, level: number): number =>
  levelValue(level, REACTIONS[reaction].manualYield) * stellarFusionMultiplier(state);
export const reactionManualAmount = (state: GameState, reaction: ReactionId): number =>
  reactionManualAmountAtLevel(state, reaction, state.reactionUpgrades[reaction]);

export const stellarWindPerSecond = (state: GameState): number => {
  if (state.completed || !STAGES[state.stage].cloudWind) return 0;
  return cloudMassForLevel(state.cloudTier) * STELLAR_WIND.fractionOfInitialCloudPerMinute / 60;
};

const shellWindFractionPerMinute = (stage: Stage): number => {
  const rate = STAGES[stage].shellWindRate;
  return rate ? STELLAR_WIND.shell[rate] : 0;
};

// Hüllenwind (Punkt 6): entfernt ab der Hauptreihe Wasserstoff und Helium
// direkt aus dem Stern selbst, nie schwere Kernelemente einer aktiven
// Spätbrennstufe. Der bestehende Wolkenwind (stellarWindPerSecond) bleibt
// davon unberührt und läuft unverändert weiter, solange die Restwolke Materie
// enthält.
export const shellWindPerSecond = (state: GameState): number => {
  if (state.completed) return 0;
  const fraction = shellWindFractionPerMinute(state.stage);
  if (fraction <= 0) return 0;
  return (state.star.hydrogen + state.star.helium) * fraction / 60;
};

// Struktureller Wasserstoffverbrauch der Hauptreihe (Punkt 6): brennt ab
// Erreichen der Hauptreihe von selbst, unabhängig von gekauften
// Automationen und zusätzlich zu manueller Fusion. Skaliert überproportional
// mit der aktuellen Sternmasse, damit massereichere Sterne die Hauptreihe
// spürbar schneller durchlaufen als leichte.
// Punkt 4: Liste der gerade aktiven Warnungen (laufende Verlustprozesse) mit
// ihrer aktuellen Rate. Die Texte stehen in content/warnings.ts; die
// Oberfläche zeigt bei mindestens einem Eintrag das Warnsymbol in der Star
// Chamber. Der Wolkenwind zählt nur als Warnung, solange die Urwolke noch
// Materie enthält, die verloren gehen kann.
export interface ActiveWarning { id: ActiveWarningId; ratePerSecond: number }
export const activeWarnings = (state: GameState): ActiveWarning[] => {
  const warnings: ActiveWarning[] = [];
  const cloudRate = stellarWindPerSecond(state);
  if (cloudRate > 0 && cloudMass(state) > .001) warnings.push({ id: 'cloudWind', ratePerSecond: cloudRate });
  const shellRate = shellWindPerSecond(state);
  if (shellRate > 0) warnings.push({ id: 'shellWind', ratePerSecond: shellRate });
  return warnings;
};

// Struktureller Grundumsatz einer Brennphase: läuft unabhängig von gekauften
// Automationen und zusätzlich zu manueller Fusion, sobald der Stern in einem
// der bei der Reaktion hinterlegten Stadien steht. Die Rate skaliert
// überproportional mit der Sternmasse, sodass ein massereicher Stern seinen
// Vorrat auch ohne Zutun durchbrennt, ein sonnenähnlicher aber weiterhin von
// der Hand des Spielers lebt.
export const structuralBurnPerSecond = (state: GameState, reaction: ReactionId): number => {
  const burn = REACTIONS[reaction].structuralBurn;
  if (state.completed || !burn || !burn.stages.includes(state.stage)) return 0;
  const massRatio = starMass(state) / STRUCTURAL_BURN_REFERENCE_MASS;
  return burn.ratePerSecond * massRatio ** burn.massExponent;
};

// Gesamter automatischer Durchsatz einer Reaktion (gekaufte Automation plus
// struktureller Grundumsatz). Die Oberfläche zeigt damit die Rate, die der
// Stern tatsächlich ohne Klicks umsetzt.
export const reactionThroughputPerSecond = (state: GameState, reaction: ReactionId): number =>
  reactionAutomationPerSecond(state, reaction) + structuralBurnPerSecond(state, reaction);

export const automationCost = (kind: AutomationKind, level: number): number => {
  const definition = AUTOMATIONS[kind];
  return Math.round(levelValue(level, definition.cost));
};

// Generische Upgrade-Helfer: Jedes Upgrade besitzt ausschließlich eine
// numerische Stufe. Voraussetzungen und Maximalstufe bestimmen, ob und wie oft
// es gekauft werden kann.
export const upgradeLevel = (state: GameState, id: UpgradeId): number => state.upgrades[id];
export const upgradeCost = (id: UpgradeId, level: number): number => {
  const definition: UpgradeDefinition = UPGRADES[id];
  return Math.round(levelValue(level, definition.cost));
};
export const prestigePerkCost = (perk: keyof PerkState, level: number): number =>
  Math.round(levelValue(level, PRESTIGE_PERKS[perk].cost));
export const cloudTierCost = (level: number): number => prestigePerkCost('largerCloud', level);
export const gravityPerkCost = (level: number): number => prestigePerkCost('permanentGravity', level);
export const fusionPerkCost = (level: number): number => prestigePerkCost('fusionMemory', level);

export const effectivePerks = (state: GameState): PerkState => ({
  largerCloud: state.perks.largerCloud + state.pendingPerks.largerCloud,
  permanentGravity: state.perks.permanentGravity + state.pendingPerks.permanentGravity,
  fusionMemory: state.perks.fusionMemory + state.pendingPerks.fusionMemory,
});

export const pressureProgress = (state: GameState): number =>
  Math.min(100, (starMass(state) / THRESHOLDS.hydrogenIgnitionMass) ** ACCRETION.pressureExponent * 100);

export const compressionHeat = (state: GameState): number =>
  (starMass(state) / THRESHOLDS.protostarMass) ** TEMPERATURE_MODEL.compressionExponent
  * (THRESHOLDS.protostarTemperature - INITIAL_TEMPERATURE);

const effectiveCompressionHeat = (state: GameState): number => {
  const raw = compressionHeat(state);
  if (state.upgrades.deuteriumBurning === 0 || state.deuteriumIgnitionCompression === null) {
    return Math.min(raw, THRESHOLDS.hydrogenTemperature - INITIAL_TEMPERATURE);
  }
  const baseline = state.deuteriumIgnitionCompression;
  const multiplier = upgradeValueAtLevel(state, 'deuteriumBurning', state.upgrades.deuteriumBurning);
  const accelerated = baseline + Math.max(0, raw - baseline) * multiplier;
  return Math.min(accelerated, THRESHOLDS.hydrogenTemperature - INITIAL_TEMPERATURE);
};

export const calculateTemperature = (state: GameState): number => {
  const ignitionFloor = state.unlockedReactions.reduce((floor, id) => Math.max(floor, REACTIONS[id].ignitionTemperature), INITIAL_TEMPERATURE);
  return Math.max(
    INITIAL_TEMPERATURE,
    STAGES[state.stage].temperatureFloor,
    ignitionFloor,
    INITIAL_TEMPERATURE + effectiveCompressionHeat(state) + state.contractionHeat + state.heatBonus,
  );
};

// Setzt die aktuelle Kerntemperatur und pflegt gleichzeitig die je Runde
// höchste je erreichte Temperatur (stats.peakTemperature) nach, da die
// aktuelle Temperatur durch abklingenden heatBonus zwischenzeitlich unter
// einen vorher erreichten Spitzenwert sinken kann.
const updateTemperature = (state: GameState): void => {
  state.temperature = calculateTemperature(state);
  if (state.temperature > state.stats.peakTemperature) state.stats.peakTemperature = state.temperature;
};

const log = (state: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info'): void => {
  state.log.unshift({ id: Date.now() + Math.random(), run: state.run, elapsed: state.elapsed, totalElapsed: state.totalElapsed, text, kind });
};

const setStage = (state: GameState, stage: Stage, message?: string): void => {
  if (state.stage === stage) return;
  state.stage = stage;
  if (message) log(state, message, 'discovery');
  updateTemperature(state);
};

export const createRunStatistics = (): RunStatistics => ({
  manualClicks: 0, deuteriumBurns: 0, manualFusionActions: 0, manualHeliumActions: 0,
  matterAccreted: 0, automaticMatterAccreted: 0, matterLostToWind: 0, matterLostToShellWind: 0, envelopeEjected: 0,
  hydrogenFused: 0, automaticHydrogenFused: 0, heliumFused: 0, automaticHeliumFused: 0,
  oxygenCreated: 0, automaticOxygenCreated: 0, energyGenerated: 0, peakTemperature: INITIAL_TEMPERATURE,
  upgradesPurchased: 0, automationsPurchased: 0, offlineSeconds: 0, stardustEarned: 0,
});

const transferMatter = (state: GameState, requested: number): number => {
  const available = cloudMass(state);
  const amount = Math.min(requested, available);
  if (amount <= 0) return 0;
  const ratio = amount / available;
  MATTER_KEYS.forEach((key) => {
    const moved = state.cloud[key] * ratio;
    state.cloud[key] -= moved;
    state.star[key] += moved;
  });
  state.energy += amount * ACCRETION.energyPerMatter;
  return amount;
};

const disperseCloudMatter = (state: GameState, requested: number): number => {
  const available = cloudMass(state);
  const amount = Math.min(requested, available);
  if (amount <= 0) return 0;
  const ratio = amount / available;
  MATTER_KEYS.forEach((key) => { state.cloud[key] -= state.cloud[key] * ratio; });
  return amount;
};

// Hüllenwind entfernt ausschließlich H und He aus dem Stern selbst, nie
// schwere Kernelemente (sonst würde der Wind den Brennstoff der aktiven
// Spätbrennstufe auffressen statt nur die verbliebene Hülle abzutragen).
const disperseStarEnvelope = (state: GameState, requested: number): number => {
  const available = state.star.hydrogen + state.star.helium;
  const amount = Math.min(requested, available);
  if (amount <= 0) return 0;
  const ratio = amount / available;
  state.star.hydrogen -= state.star.hydrogen * ratio;
  state.star.helium -= state.star.helium * ratio;
  return amount;
};

export const reactionCapacity = (state: GameState, reaction: ReactionId): number => {
  const definition = REACTIONS[reaction];
  return Object.entries(definition.inputs).reduce((capacity, [key, ratio]) =>
    Math.min(capacity, state.star[key as keyof Matter] / (ratio ?? 1)), Number.POSITIVE_INFINITY);
};

export const reactionAvailable = (state: GameState, reaction: ReactionId): boolean =>
  !state.completed
  && state.unlockedReactions.includes(reaction)
  && state.temperature >= REACTIONS[reaction].ignitionTemperature
  && reactionCapacity(state, reaction) > 0;

const primaryOutputAmount = (reaction: ReactionId, primaryInput: number): number => {
  const definition = REACTIONS[reaction];
  return primaryInput * (definition.outputs[definition.primaryOutput] ?? 1);
};

const runReaction = (state: GameState, reaction: ReactionId, requested: number, automatic: boolean): number => {
  if (!reactionAvailable(state, reaction)) return 0;
  const definition = REACTIONS[reaction];
  const amount = Math.min(requested, reactionCapacity(state, reaction));
  if (amount <= 0) return 0;
  let inputMass = 0;
  let outputMass = 0;
  Object.entries(definition.inputs).forEach(([key, ratio]) => {
    const consumed = amount * (ratio ?? 0);
    state.star[key as keyof Matter] -= consumed;
    inputMass += consumed;
  });
  Object.entries(definition.outputs).forEach(([key, ratio]) => {
    const created = amount * (ratio ?? 0);
    state.star[key as keyof Matter] += created;
    outputMass += created;
  });
  state.radiatedMass += Math.max(0, inputMass - outputMass);
  const energyBasis = definition.energyBasis === 'input' ? inputMass : outputMass;
  const energy = energyBasis * definition.energyPerUnit;
  state.energy += energy;
  state.heatBonus += amount * definition.heatPerUnit;
  state.reactionTotals[reaction] += amount;
  if (automatic) state.automaticReactionTotals[reaction] += amount;
  state.stats.energyGenerated += energy;
  if (!automatic) {
    state.stats.manualFusionActions += 1;
    // Eine einzige selbst ausgelöste Fusion schaltet ihre Automation frei —
    // in diesem und, weil die Liste den Zyklus überdauert, in jedem weiteren.
    if (!state.experiencedReactions.includes(reaction)) state.experiencedReactions.push(reaction);
  }

  // Datengetriebener Stadienwechsel: z. B. stabilisiert sich der Stern nach
  // genug fusioniertem Wasserstoff auf der Hauptreihe (siehe reactions.ts).
  const stabilization = definition.stabilizesInto;
  if (stabilization && state.reactionTotals[reaction] >= stabilization.fusedAmount && state.stage === definition.stageOnUnlock) {
    setStage(state, stabilization.stage, stabilization.message);
  }

  if (reaction === 'hydrogen') {
    state.fusedHydrogen += amount;
    state.stats.hydrogenFused += amount;
    if (automatic) state.stats.automaticHydrogenFused += amount;
    if (!automatic) state.manualFusions += 1;
  }
  if (reaction === 'helium') {
    state.fusedHelium += amount;
    state.stats.heliumFused += amount;
    if (automatic) state.stats.automaticHeliumFused += amount;
    if (!automatic) state.manualHeliumFusions += 1;
  }
  if (reaction === 'alphaCapture') {
    const oxygen = primaryOutputAmount(reaction, amount);
    state.stats.oxygenCreated += oxygen;
    if (automatic) state.stats.automaticOxygenCreated += oxygen;
  }
  if (state.reactionTotals[reaction] <= amount + .001) log(state, `${definition.fullTitle}: ${definition.equationInput} → ${definition.equationOutput}.`, 'fusion');
  return amount;
};

const addDiscovery = (state: GameState, outcome: StellarOutcome): void => {
  if (!state.discoveredOutcomes.includes(outcome)) state.discoveredOutcomes.push(outcome);
};

const completeRun = (state: GameState, outcome: Exclude<StellarOutcome, 'legacyMainSequence'>): void => {
  if (state.completed) return;
  // Der Ertrag folgt der tatsächlich erreichten Endmasse, nicht mehr allein
  // der Kategorie des Endzustands (siehe stardustReward in content/prestige).
  //
  // Bezugsgröße ist dabei — genau wie bei der Wahl des Sternrests — die Masse
  // VOR einer Abstoßung im Kernkollaps. Sonst würde jeder Klick während der
  // Supernova den Massen-Multiplikator senken und Anwesenheit zur Strafe
  // machen. Der r-Prozess-Bonus aus abgestoßener Hülle kommt obendrauf; er
  // kann nur in einem Kernkollaps überhaupt entstehen.
  const ejectedSolarMasses = state.stats.envelopeEjected / THRESHOLDS.matterPerSolarMass;
  const base = stardustReward(outcome, solarMasses(state) + ejectedSolarMasses);
  const ejectedShare = massBeforeCollapse(state) > 0
    ? state.stats.envelopeEjected / (massBeforeCollapse(state) * CORE_COLLAPSE.maximumEjectedFraction)
    : 0;
  const award = base + Math.round(base * Math.min(1, ejectedShare) * CORE_COLLAPSE.stardustBonusAtFullEjection);
  state.completed = true;
  state.outcome = outcome;
  state.stage = END_STAGES[outcome];
  // Das Zyklusende zeigt zunächst nur den kompakten Abschluss-Hinweis. Die
  // vollständige Zusammenfassung wird anschließend bewusst vom Spieler
  // geöffnet (siehe cycle-end-banner bzw. Stern-Callout).
  state.summaryOpen = false;
  state.stardust += award;
  state.stats.stardustEarned += award;
  addDiscovery(state, outcome);
  updateTemperature(state);
  log(state, `${OUTCOMES[outcome].title} +${award} Sternenstaub`, 'discovery');
};

// Eine Fusion schaltet sich NICHT mehr von selbst frei, sobald Temperatur und
// Mindestmasse erreicht sind: Sie wird dann lediglich freischaltbar und wartet
// auf eine bewusste (kostenlose) Handlung des Spielers — genau wie jedes
// andere Upgrade, zwischen denen ihre Kachel jetzt steht. Bis zum Klick bleibt
// der Stern in seinem aktuellen Stadium stehen; Stadienwechsel,
// Temperaturuntergrenze und die Kontraktion zur nächsten Brennstufe hängen
// alle an `unlockedReactions` und rühren sich deshalb erst danach.
// Eine Fusion darf erst zünden, wenn der Stern seine aktuelle Brennphase
// wirklich beendet hat.
//
// Ohne diese Bedingung genügten Temperatur und Mindestmasse allein — und die
// Fusionswärme der laufenden Phase überschreitet bei großen Sternen die
// nächste Zündtemperatur sofort. Ein Stern mit 4.588 M☉ sprang dadurch nach
// 0,6 Sekunden Hauptreihe direkt ins Heliumbrennen und beendete die Runde mit
// 27 % seiner Masse als nie verbranntem Wasserstoff. Die Zielanzeige
// beschrieb den richtigen Ablauf ohnehin schon („Kernkontraktion“, sobald der
// Brennstoff erschöpft ist); die Zündbedingung folgt ihr jetzt.
const ignitionSequenceReady = (state: GameState, reaction: ReactionId): boolean => {
  // Wasserstoff steht am Anfang der Kette — vor ihm liegt keine Brennphase.
  if (reaction === 'hydrogen') return true;
  // Alpha-Einfang ist ein Nebenkanal der Heliumphase, keine eigene Stufe der
  // Kette: Er teilt sich Zündtemperatur und Mindestmasse mit der
  // Heliumfusion und wird verfügbar, sobald diese gezündet hat.
  if (reaction === 'alphaCapture') return state.unlockedReactions.includes('helium');
  const decision = contractionDecision(state);
  return decision?.kind === 'ignite' && decision.next === reaction;
};

export const reactionUnlockable = (state: GameState, reaction: ReactionId): boolean => {
  if (state.completed || state.unlockedReactions.includes(reaction)) return false;
  const definition = REACTIONS[reaction];
  return state.temperature >= definition.ignitionTemperature
    && starMass(state) >= definition.minimumMass
    && ignitionSequenceReady(state, reaction);
};

// Fortschritt Richtung Freischaltung (0..1) für den Fill des Eck-Buttons:
// die am wenigsten erfüllte der beiden Bedingungen limitiert, exakt wie bei
// Upgrades mit mehreren Voraussetzungen.
export const reactionUnlockProgress = (state: GameState, reaction: ReactionId): number => {
  const definition = REACTIONS[reaction];
  return Math.min(
    1,
    state.temperature / definition.ignitionTemperature,
    starMass(state) / definition.minimumMass,
  );
};

const unlockReaction = (state: GameState, reaction: ReactionId): void => {
  if (!reactionUnlockable(state, reaction)) return;
  const definition = REACTIONS[reaction];
  state.unlockedReactions.push(reaction);
  // Zyklusübergreifend merken: Ab dem nächsten Durchlauf zündet diese
  // Reaktion von selbst (siehe autoIgniteKnownReactions).
  if (!state.ignitedReactions.includes(reaction)) state.ignitedReactions.push(reaction);
  if (reaction !== 'alphaCapture') setStage(state, definition.stageOnUnlock, `${definition.fullTitle} bei ${definition.ignitionTemperature.toLocaleString('de-DE')} K freigeschaltet.`);
  else log(state, `${definition.fullTitle} freigeschaltet.`, 'fusion');
};

// Eine bereits einmal entdeckte Fusion wartet in späteren Zyklen nicht mehr
// auf den Freischaltklick, sondern zündet selbst, sobald Temperatur und
// Mindestmasse erreicht sind.
//
// Die bewusste, kostenlose Freischaltung bleibt damit genau dort erhalten, wo
// sie etwas erzählt — beim ersten Mal. Ohne diese Ausnahme wäre jede Runde
// zwingend an einen anwesenden Spieler gebunden: Ein Stern, der still auf
// einen Klick wartet, macht Offline-Fortschritt unmöglich, egal wie gut alles
// andere automatisiert ist.
const autoIgniteKnownReactions = (state: GameState): void => {
  REACTION_ORDER.forEach((reaction) => {
    if (state.ignitedReactions.includes(reaction) && reactionUnlockable(state, reaction)) unlockReaction(state, reaction);
  });
};

const updateFormationStage = (state: GameState): void => {
  if (state.completed || state.unlockedReactions.includes('hydrogen')) return;
  updateTemperature(state);
  if (state.temperature >= THRESHOLDS.deuteriumTemperature) {
    setStage(state, 'deuterium', '1 Mio. K: Deuteriumbrennen kann aktiviert werden.');
  } else if (state.temperature >= THRESHOLDS.protostarTemperature) {
    setStage(state, 'protostar', '100.000 K: Ein Protostern entsteht und sein Sternwind beginnt.');
  }
};

// Nächster schwerer Brennstoff, der noch in nennenswerter Menge vorliegt.
// Muss dieselbe Schwelle wie fuelDepleted() verwenden: Mit einem Test auf
// `> 0` meldete diese Funktion einen Brennstoff als vorhanden, den
// fuelDepleted() zugleich als erschöpft führte. Der Stern kontrahierte dann
// endlos in Richtung einer Reaktion, die längst gezündet war und deren
// Zündtemperatur er bereits überschritten hatte.
const nextHeavyFuel = (state: GameState): ReactionId | null =>
  (['carbon', 'neon', 'oxygen', 'silicon'] as const).find((key) => !fuelDepleted(state, key)) ?? null;

// Ein Brennstoff gilt als erschöpft, wenn weder Kern noch Restwolke ihn noch
// in nennenswerter Menge liefern können.
//
// Der Vergleich ist bewusst relativ zur Sternmasse statt auf exakt null. Ein
// Test auf `<= 0` versagt in beide Richtungen:
//
// - Zu spät: Die Automationen der früheren Brennstufen laufen weiter und
//   liefern den vermeintlich erschöpften Brennstoff laufend nach. Ein Stern
//   mit 6,8 × 10⁸ ME Masse blieb so dauerhaft im Kontraktionsstadium stehen,
//   weil die Kette H → He → C den Kohlenstoff bei rund 400 ME hielt — die
//   Bedingung wurde nie wieder wahr, und die nächste Zündung kam nie.
// - Zu früh: Ein einzelner Tick, in dem der Vorrat rechnerisch kurz null
//   berührt, schaltet das Stadium unwiderruflich weiter. Danach füllt die
//   Akkretion den Kern wieder auf, und der Stern zündet eine Stufe, deren
//   eigentlichen Brennstoff er noch gar nicht verbraucht hat.
//
// Beide Fälle verschwinden mit einer Schwelle, die mit dem Stern mitwächst.
const DEPLETION_FRACTION = 1e-3;
const fuelDepleted = (state: GameState, key: keyof Matter): boolean =>
  state.star[key] + state.cloud[key] <= Math.max(1, starMass(state) * DEPLETION_FRACTION);

type ContractionDecision = { kind: 'ignite'; next: ReactionId } | { kind: 'settle' } | null;

const contractionDecision = (state: GameState): ContractionDecision => {
  const unlocked = (id: ReactionId): boolean => state.unlockedReactions.includes(id);
  if (!unlocked('hydrogen')) return null;
  if (!unlocked('helium')) return fuelDepleted(state, 'hydrogen') ? { kind: 'ignite', next: 'helium' } : null;
  const stageDepleted = (!unlocked('carbon') && fuelDepleted(state, 'helium'))
    || (unlocked('carbon') && !unlocked('neon') && fuelDepleted(state, 'carbon'))
    || (unlocked('neon') && !unlocked('oxygen') && fuelDepleted(state, 'neon'))
    || (unlocked('oxygen') && !unlocked('silicon') && fuelDepleted(state, 'oxygen'));
  if (!stageDepleted) return null;
  const next = nextHeavyFuel(state);
  return next ? { kind: 'ignite', next } : { kind: 'settle' };
};

const evaluateEvolution = (state: GameState): void => {
  if (state.completed) return;
  updateTemperature(state);
  // Eine leergeräumte Wolke beendet den Zyklus nur, solange die
  // Wasserstofffusion tatsächlich unerreichbar bleibt. Ist sie bereits
  // freischaltbar und wartet nur noch auf den Klick, wäre ein Brauner Zwerg
  // eine Falle: Der Stern hätte Masse und Temperatur zum Zünden.
  if (!state.unlockedReactions.includes('hydrogen') && cloudMass(state) <= .001 && !reactionUnlockable(state, 'hydrogen')) {
    completeRun(state, 'brownDwarf');
    return;
  }
  // Der Eisenkern beendet die Runde nicht mehr unmittelbar, sondern führt in
  // den Kernkollaps. Das Stadium `supernova` war zwar seit jeher definiert,
  // wurde aber nie betreten — der dramatischste Moment des Spiels existierte
  // nur als nachträglicher Eintrag in der Chronik. Jetzt ist er eine eigene,
  // kurze Phase, in der die Restmasse und damit der Sternrest noch beeinflusst
  // werden kann (siehe applyCoreCollapse).
  if (state.stage !== 'supernova' && state.unlockedReactions.includes('silicon') && fuelDepleted(state, 'silicon') && state.star.iron > 0) {
    setStage(state, 'ironCore', 'Ein Eisenkern ist entstanden. Weitere Fusion liefert keine Energie mehr.');
    setStage(state, 'supernova', 'Der Kern kollabiert. Klicks auf den Stern stoßen jetzt Hülle ab und senken die Restmasse.');
    state.collapseElapsed = 0;
    return;
  }
  if (state.stage === 'supernova') return;
  const decision = contractionDecision(state);
  if (!decision) return;
  if (decision.kind === 'settle') {
    if (!state.unlockedReactions.includes('carbon')) completeRun(state, 'whiteDwarf');
    else completeRun(state, 'oxygenNeonWhiteDwarf');
    return;
  }
  const definition = REACTIONS[decision.next];
  if (starMass(state) >= definition.minimumMass) {
    if (decision.next === 'helium') setStage(state, 'redGiant', 'Der wasserstoffarme Kern kontrahiert; die Hülle wächst zum Roten Riesen.');
    else setStage(state, 'massiveStar', `Der Kern kontrahiert in Richtung ${definition.fullTitle}.`);
    return;
  }
  if (decision.next === 'helium') completeRun(state, 'heliumWhiteDwarf');
  else if (!state.unlockedReactions.includes('carbon')) completeRun(state, 'whiteDwarf');
  else completeRun(state, 'oxygenNeonWhiteDwarf');
};

// Masse des Sterns beim Eintritt in den Kernkollaps. Sie entscheidet über den
// Sternrest und ist damit unabhängig davon, wie viel Hülle der Spieler
// während der Phase noch abstößt.
const massBeforeCollapse = (state: GameState): number => starMass(state) + state.stats.envelopeEjected;

const maximumEjectableMass = (state: GameState): number =>
  massBeforeCollapse(state) * CORE_COLLAPSE.maximumEjectedFraction;

export const collapseProgress = (state: GameState): number =>
  Math.min(1, state.collapseElapsed / CORE_COLLAPSE.seconds);

export const collapseEjectionPerClick = (state: GameState): number =>
  Math.max(0, Math.min(
    massBeforeCollapse(state) * CORE_COLLAPSE.ejectionPerClick,
    maximumEjectableMass(state) - state.stats.envelopeEjected,
  ));

// Stößt Materie proportional aus dem gesamten Stern ab — anders als der
// Hüllenwind, der bewusst nur H und He abträgt: Beim Kernkollaps fliegt alles
// außerhalb des kollabierenden Kerns davon, und H/He sind zu diesem Zeitpunkt
// ohnehin längst verbrannt.
const ejectStarMatter = (state: GameState, requested: number): number => {
  const available = starMass(state);
  const amount = Math.min(requested, available);
  if (amount <= 0) return 0;
  const ratio = amount / available;
  MATTER_KEYS.forEach((key) => { state.star[key] -= state.star[key] * ratio; });
  state.radiatedMass += amount;
  state.stats.envelopeEjected += amount;
  return amount;
};

const applyCoreCollapse = (state: GameState, seconds: number): void => {
  if (state.completed || state.stage !== 'supernova') return;
  state.collapseElapsed += seconds;
  if (state.collapseElapsed < CORE_COLLAPSE.seconds) return;
  completeRun(state, massBeforeCollapse(state) >= THRESHOLDS.blackHoleMass ? 'blackHole' : 'neutronStar');
};

const applyContraction = (state: GameState, seconds: number): void => {
  const decision = contractionDecision(state);
  if (decision?.kind !== 'ignite') return;
  const definition = REACTIONS[decision.next];
  if (starMass(state) < definition.minimumMass) return;
  const needed = Math.max(0, definition.ignitionTemperature - calculateTemperature(state));
  if (needed <= 0) return;
  const rate = definition.ignitionTemperature / TEMPERATURE_MODEL.contractionSecondsPerStage;
  state.contractionHeat += Math.min(needed, rate * seconds);
  updateTemperature(state);
};

interface PersistentRunOptions {
  soundEnabled?: boolean; volume?: number; tutorial?: TutorialState; history?: RoundRecord[];
  cloudTier?: CloudTier; nextCloudTier?: CloudTier; discoveredOutcomes?: StellarOutcome[];
  log?: LogEntry[]; totalElapsed?: number;
  // Beide Reaktionsgedächtnisse überdauern den Zyklus (siehe game/types.ts).
  ignitedReactions?: ReactionId[]; experiencedReactions?: ReactionId[];
}

export const createInitialState = (
  perkInput: Partial<PerkState> = {}, stardust = 0, run = 1, persistent: PersistentRunOptions = {},
): GameState => {
  const perks: PerkState = {
    largerCloud: clampCloudTier(perkInput.largerCloud ?? 0),
    permanentGravity: Math.max(0, Math.min(PRESTIGE_PERKS.permanentGravity.maxLevel, perkInput.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(PRESTIGE_PERKS.fusionMemory.maxLevel, perkInput.fusionMemory ?? 0)),
  };
  const unlockedTier = clampCloudTier(perks.largerCloud);
  const requestedTier = persistent.cloudTier ?? persistent.nextCloudTier ?? unlockedTier;
  const cloudTier = run === 1 && persistent.cloudTier === undefined ? 0 : clampCloudTier(Math.min(requestedTier, unlockedTier));
  const totalElapsed = Math.max(0, persistent.totalElapsed ?? 0);
  const now = Date.now();
  return {
    version: 8, run, startedAt: now, lastTick: now, elapsed: 0, totalElapsed, stage: 'nebula', cloudTier,
    nextCloudTier: clampCloudTier(Math.min(persistent.nextCloudTier ?? cloudTier, unlockedTier)),
    cloud: cloudMatterForLevel(cloudTier), star: { ...EMPTY_MATTER }, radiatedMass: 0,
    energy: 0, temperature: INITIAL_TEMPERATURE, heatBonus: 0, contractionHeat: 0, collapseElapsed: 0,
    deuteriumIgnitionCompression: null, unlockedReactions: [],
    ignitedReactions: [...(persistent.ignitedReactions ?? [])],
    experiencedReactions: [...(persistent.experiencedReactions ?? [])],
    reactionTotals: emptyReactionTotals(),
    automaticReactionTotals: emptyReactionTotals(), reactionUpgrades: emptyReactionTotals(), activeReaction: null,
    fusedHydrogen: 0, fusedHelium: 0,
    manualFusions: 0, manualHeliumFusions: 0,
    automation: { accretion: 0, fusion: 0, heliumFusion: 0, oxygenSynthesis: 0, carbonFusion: 0, neonFusion: 0, oxygenFusion: 0, siliconFusion: 0 },
    upgrades: emptyUpgradeLevels(), stardust, perks,
    pendingPerks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
    completed: false, outcome: null, discoveredOutcomes: [...(persistent.discoveredOutcomes ?? [])], summaryOpen: false,
    soundEnabled: persistent.soundEnabled ?? true, volume: Math.max(0, Math.min(1, persistent.volume ?? .35)),
    tutorial: persistent.tutorial ? { ...persistent.tutorial } : { introSeen: false, cosmosToastPending: true, completed: false, step: 0 },
    stats: createRunStatistics(), history: persistent.history ? structuredClone(persistent.history).slice(0, 20) : [],
    seenOpportunities: [], seenObjectives: [],
    log: [
      { id: now, run, elapsed: 0, totalElapsed, text: `${cloudDefinitionForLevel(cloudTier).name} bei 10 K wartet auf ihren ersten Impuls.`, kind: 'info' },
      ...structuredClone(persistent.log ?? []),
    ],
  };
};

export const tick = (state: GameState, seconds: number): GameState => {
  const next = structuredClone(state);
  const dt = Math.max(0, Math.min(seconds, LIMITS.offlineSeconds));
  next.elapsed += dt;
  next.totalElapsed += dt;
  next.lastTick = Date.now();
  if (next.completed) return next;
  const dispersed = disperseCloudMatter(next, stellarWindPerSecond(next) * dt);
  next.stats.matterLostToWind += dispersed;
  const shellDispersed = disperseStarEnvelope(next, shellWindPerSecond(next) * dt);
  next.stats.matterLostToWind += shellDispersed;
  next.stats.matterLostToShellWind += shellDispersed;
  const accreted = transferMatter(next, accretionPerSecond(next) * dt);
  next.stats.matterAccreted += accreted;
  next.stats.automaticMatterAccreted += accreted;
  next.stats.energyGenerated += accreted * ACCRETION.energyPerMatter;
  updateTemperature(next);
  updateFormationStage(next);
  AUTOMATION_ORDER.forEach((kind) => {
    const definition = AUTOMATIONS[kind];
    if (!definition.reaction || next.automation[kind] <= 0) return;
    runReaction(next, definition.reaction, reactionAutomationPerSecond(next, definition.reaction) * dt, true);
  });
  // Struktureller Grundumsatz jeder Brennphase, nicht mehr nur der Hauptreihe.
  REACTION_ORDER.forEach((reaction) => {
    const amount = structuralBurnPerSecond(next, reaction) * dt;
    if (amount > 0) runReaction(next, reaction, amount, true);
  });
  next.heatBonus = Math.max(0, next.heatBonus - dt * TEMPERATURE_MODEL.heatLossPerSecond);
  evaluateEvolution(next);
  applyContraction(next, dt);
  // Bereits bekannte Fusionen zünden ohne Freischaltklick. Erst danach erneut
  // auswerten, damit die Kontraktion zur nächsten Stufe im selben Tick greift
  // und eine unbeaufsichtigte Runde nicht zwischen zwei Stadien hängen bleibt.
  autoIgniteKnownReactions(next);
  applyCoreCollapse(next, dt);
  evaluateEvolution(next);
  return next;
};

// Punkt 1: Ist die in der Definition hinterlegte Nachschubquelle einer
// Automation erschöpft (z. B. keine Restmaterie mehr in der Urwolke), kann
// sie nicht weiter ausgebaut werden.
export const automationSupplyExhausted = (state: GameState, kind: AutomationKind): boolean => {
  const supply = AUTOMATIONS[kind].supply;
  return supply?.kind === 'cloudMatter' ? cloudMass(state) <= .001 : false;
};

// Fortschritt einer Automation Richtung Freischaltung, gemeinsam genutzt von
// Engine und Oberfläche. `manualExperience` kennt nur zwei Zustände: Die
// zugehörige Reaktion wurde schon einmal selbst ausgelöst — oder eben nicht.
export const automationMasteryProgress = (state: GameState, kind: AutomationKind): number => {
  const { mastery } = AUTOMATIONS[kind];
  if (mastery.kind === 'starMass') return Math.min(1, starMass(state) / mastery.threshold);
  return state.experiencedReactions.includes(mastery.reaction) ? 1 : 0;
};

export const automationUnlocked = (state: GameState, kind: AutomationKind): boolean =>
  automationMasteryProgress(state, kind) >= 1 && !automationSupplyExhausted(state, kind);

export const canBuyAutomation = (state: GameState, kind: AutomationKind): boolean => {
  const definition = AUTOMATIONS[kind];
  const visible = !definition.reaction || state.unlockedReactions.includes(definition.reaction);
  return !state.completed
    && visible
    && automationUnlocked(state, kind)
    && state.energy >= automationCost(kind, state.automation[kind])
    && state.automation[kind] < definition.maxLevel;
};

// Kleines Register benannter Kaufwirkungen (Punkt 6): Upgrades referenzieren
// eine Wirkung per Name in ihrer Definition; die Engine kennt keine einzelnen
// Upgrade-IDs mehr.
const UPGRADE_PURCHASE_EFFECTS: Record<NonNullable<UpgradePurchaseDefinition['effect']>, (state: GameState) => void> = {
  captureCompressionBaseline: (state) => { state.deuteriumIgnitionCompression = compressionHeat(state); },
};

const upgradeRequirementsMet = (state: GameState, definition: UpgradeDefinition): boolean =>
  (definition.requirements.minimumStarMass === undefined || starMass(state) >= definition.requirements.minimumStarMass)
  && (definition.requirements.minimumTemperature === undefined || state.temperature >= definition.requirements.minimumTemperature)
  && (definition.requirements.maximumTemperature === undefined || state.temperature < definition.requirements.maximumTemperature)
  && !upgradeSupplyExhausted(state, definition.id);

export const upgradeSupplyExhausted = (state: GameState, id: UpgradeId): boolean => {
  const definition: UpgradeDefinition = UPGRADES[id];
  const supply = definition.supply;
  return supply?.kind === 'cloudMatter' ? cloudMass(state) <= .001 : false;
};

export const canBuyUpgrade = (state: GameState, id: UpgradeId): boolean => {
  const definition: UpgradeDefinition = UPGRADES[id];
  const level = upgradeLevel(state, id);
  return !state.completed
    && level < definition.maxLevel
    && upgradeRequirementsMet(state, definition)
    && state.energy >= upgradeCost(id, level);
};

const buyUpgrade = (state: GameState, id: UpgradeId): void => {
  const definition: UpgradeDefinition = UPGRADES[id];
  const level = upgradeLevel(state, id);
  const cost = upgradeCost(id, level);
  if (!canBuyUpgrade(state, id)) return;
  state.energy -= cost;
  state.upgrades[id] = level + 1;
  state.stats.upgradesPurchased += 1;
  const purchase = definition.purchase;
  if (purchase?.effect) UPGRADE_PURCHASE_EFFECTS[purchase.effect](state);
  if (purchase?.statCounter) state.stats[purchase.statCounter] += 1;
  if (purchase?.log) log(state, purchase.log.text, purchase.log.kind);
};
const buyAutomation = (state: GameState, kind: AutomationKind): void => {
  const definition = AUTOMATIONS[kind];
  const level = state.automation[kind];
  const cost = automationCost(kind, level);
  if (canBuyAutomation(state, kind)) {
    state.energy -= cost;
    state.automation[kind] += 1;
    state.stats.automationsPurchased += 1;
    log(state, `${definition.title} ausgebaut.`, definition.reaction ? 'fusion' : 'info');
  }
};

export const reduceGame = (state: GameState, action: GameAction): GameState => {
  if (action.type === 'PRESTIGE') {
    if (!state.completed || !state.outcome) return state;
    const record: RoundRecord = { ...state.stats, run: state.run, duration: state.elapsed, finalMass: starMass(state), cloudTier: state.cloudTier, outcome: state.outcome };
    return createInitialState(effectivePerks(state), state.stardust, state.run + 1, {
      soundEnabled: state.soundEnabled, volume: state.volume, tutorial: state.tutorial,
      history: [record, ...state.history], cloudTier: state.nextCloudTier, nextCloudTier: state.nextCloudTier,
      discoveredOutcomes: state.discoveredOutcomes, log: state.log, totalElapsed: state.totalElapsed,
      // Was in diesem Zyklus gezündet war, gilt als entdeckt — unabhängig
      // davon, auf welchem Weg es in `unlockedReactions` gelandet ist (eigener
      // Klick, Autozündung oder Migration eines älteren Spielstands).
      ignitedReactions: [...new Set([...state.ignitedReactions, ...state.unlockedReactions])],
      experiencedReactions: state.experiencedReactions,
    });
  }
  const next = structuredClone(state);
  if (action.type === 'TOGGLE_SOUND') { next.soundEnabled = !next.soundEnabled; return next; }
  if (action.type === 'SET_VOLUME') { next.volume = Math.max(0, Math.min(1, action.volume)); if (next.volume > 0) next.soundEnabled = true; return next; }
  if (action.type === 'CLOSE_SUMMARY') { next.summaryOpen = false; return next; }
  if (action.type === 'OPEN_SUMMARY') { if (next.completed) next.summaryOpen = true; return next; }
  if (action.type === 'SELECT_CLOUD_TIER') { if (next.completed && action.tier <= effectivePerks(next).largerCloud) next.nextCloudTier = action.tier; return next; }
  if (action.type === 'BUY_PERK') {
    const level = effectivePerks(next)[action.perk];
    const costs = { largerCloud: cloudTierCost(level), permanentGravity: gravityPerkCost(level), fusionMemory: fusionPerkCost(level) };
    const limits = {
      largerCloud: PRESTIGE_PERKS.largerCloud.maxLevel,
      permanentGravity: PRESTIGE_PERKS.permanentGravity.maxLevel,
      fusionMemory: PRESTIGE_PERKS.fusionMemory.maxLevel,
    };
    const cost = costs[action.perk];
    if (next.completed && level < limits[action.perk] && next.stardust >= cost) {
      next.stardust -= cost; next.pendingPerks[action.perk] += 1;
      if (action.perk === 'largerCloud') next.nextCloudTier = clampCloudTier(effectivePerks(next).largerCloud);
    }
    return next;
  }
  if (action.type === 'REMOVE_PERK') {
    const pending = next.pendingPerks[action.perk];
    if (!next.completed || pending <= 0) return next;
    const removedLevel = next.perks[action.perk] + pending - 1;
    const refunds = { largerCloud: cloudTierCost(removedLevel), permanentGravity: gravityPerkCost(removedLevel), fusionMemory: fusionPerkCost(removedLevel) };
    next.pendingPerks[action.perk] -= 1; next.stardust += refunds[action.perk];
    if (action.perk === 'largerCloud') next.nextCloudTier = clampCloudTier(Math.min(next.nextCloudTier, effectivePerks(next).largerCloud));
    return next;
  }
  if (next.completed) return next;
  // Auswahl der aktiven Fusion (Fusionsring): nur freigeschaltete Reaktionen
  // sind wählbar, alles andere fällt auf Akkretion zurück. Der verfügbare
  // Brennstoff spielt hier bewusst keine Rolle — eine Reaktion darf schon
  // vorgewählt werden, bevor ihr Kern gefüllt ist.
  if (action.type === 'SET_ACTIVE_REACTION') {
    next.activeReaction = action.reaction !== null && next.unlockedReactions.includes(action.reaction) ? action.reaction : null;
    return next;
  }

  if (action.type === 'ACCRETE') {
    const moved = transferMatter(next, accretionPerClick(next));
    next.stats.manualClicks += 1; next.stats.matterAccreted += moved; next.stats.energyGenerated += moved * ACCRETION.energyPerMatter;
  } else if (action.type === 'EJECT_ENVELOPE') {
    if (next.stage === 'supernova') {
      ejectStarMatter(next, collapseEjectionPerClick(next));
      next.stats.manualClicks += 1;
    }
  } else if (action.type === 'BUY_UPGRADE') {
    buyUpgrade(next, action.upgrade);
  } else if (action.type === 'RUN_REACTION') {
    runReaction(next, action.reaction, reactionManualAmount(next, action.reaction), false);
  } else if (action.type === 'BUY_REACTION_UPGRADE') {
    const level = next.reactionUpgrades[action.reaction];
    const cost = reactionUpgradeCost(action.reaction, level);
    if (next.unlockedReactions.includes(action.reaction) && level < REACTIONS[action.reaction].upgrade.maxLevel && next.energy >= cost) {
      next.energy -= cost;
      next.reactionUpgrades[action.reaction] += 1;
      next.stats.upgradesPurchased += 1;
      log(next, `${REACTIONS[action.reaction].fullTitle}: manuelle Fusionsmenge ausgebaut.`, 'fusion');
    }
  } else if (action.type === 'UNLOCK_REACTION') {
    unlockReaction(next, action.reaction);
  } else if (action.type === 'BUY_REACTION_AUTOMATION') {
    buyAutomation(next, REACTIONS[action.reaction].automation);
  } else if (action.type === 'BUY_ACCRETION') buyAutomation(next, 'accretion');

  updateTemperature(next);
  updateFormationStage(next);
  evaluateEvolution(next);
  return next;
};

// Generisch gehalten: objectiveFor() wählt nur noch die passende Ziel-ID und
// berechnet den Fortschritt aus dem Spielzustand; die angezeigten Texte
// (eyebrow/title/detail) kommen vollständig aus content/ — entweder aus
// OBJECTIVES (frühe Formationsphasen, Rundenabschluss) oder generisch aus
// REACTIONS plus den Textvorlagen in OBJECTIVE_TEMPLATES (Kontraktions- und
// Brennphasen aller Reaktionen). Reihenfolge wichtig: die Kontraktions-Prüfung
// muss vor der `stage === 'hydrogen'`-Abfrage stehen, da ein Stern rechnerisch
// noch im Stage `hydrogen` stehen kann, während der Wasserstoffvorrat bereits
// erschöpft ist und der Kern in Richtung Helium kontrahiert.
export const objectiveFor = (state: GameState): { id: string; eyebrow: string; title: string; progress: number; detail: string } => {
  if (state.completed) {
    const objective = OBJECTIVES['review-cycle'];
    return { id: 'review-cycle', eyebrow: objective.eyebrow, title: objective.title, progress: 100, detail: objective.detail };
  }
  const firstMatterObjective = OBJECTIVES['collect-first-matter'];
  if (state.stage === 'nebula' && starMass(state) < firstMatterObjective.target) {
    return {
      id: 'collect-first-matter',
      eyebrow: firstMatterObjective.eyebrow,
      title: firstMatterObjective.title,
      progress: Math.min(100, starMass(state) / firstMatterObjective.target * 100),
      detail: firstMatterObjective.detail,
    };
  }
  const firstEnergyObjective = OBJECTIVES['generate-first-energy'];
  if (state.stage === 'nebula' && state.stats.energyGenerated < firstEnergyObjective.target) {
    return {
      id: 'generate-first-energy',
      eyebrow: firstEnergyObjective.eyebrow,
      title: firstEnergyObjective.title,
      progress: Math.min(100, state.stats.energyGenerated / firstEnergyObjective.target * 100),
      detail: firstEnergyObjective.detail,
    };
  }
  const firstUpgradeObjective = OBJECTIVES['generate-upgrade-energy'];
  if (state.stage === 'nebula' && state.stats.energyGenerated < firstUpgradeObjective.target) {
    return {
      id: 'generate-upgrade-energy',
      eyebrow: firstUpgradeObjective.eyebrow,
      title: firstUpgradeObjective.title,
      progress: Math.min(100, state.stats.energyGenerated / firstUpgradeObjective.target * 100),
      detail: firstUpgradeObjective.detail,
    };
  }
  if (state.stage === 'nebula') {
    const objective = OBJECTIVES['form-protostar'];
    return { id: 'form-protostar', eyebrow: objective.eyebrow, title: objective.title, progress: Math.min(100, starMass(state) / THRESHOLDS.protostarMass * 100), detail: objective.detail };
  }
  if (state.stage === 'protostar') {
    const objective = OBJECTIVES['heat-protostar'];
    return { id: 'heat-protostar', eyebrow: objective.eyebrow, title: objective.title, progress: Math.min(100, state.temperature / THRESHOLDS.deuteriumTemperature * 100), detail: objective.detail };
  }
  if (!state.unlockedReactions.includes('hydrogen')) {
    const objective = OBJECTIVES['ignite-hydrogen'];
    // Punkt 5: Die Zündung verlangt Temperatur UND Mindestmasse. Da die
    // Kompressionswärme bei 10 Mio. K gedeckelt ist, stünde ein reiner
    // Temperatur-Fortschritt schon auf 100 %, während noch Sternmasse zur
    // Zündung fehlt — der Fortschritt bildet daher die strengere der beiden
    // Bedingungen ab.
    const reaction = REACTIONS.hydrogen;
    const progress = Math.min(state.temperature / reaction.ignitionTemperature, starMass(state) / reaction.minimumMass);
    return { id: 'ignite-hydrogen', eyebrow: objective.eyebrow, title: objective.title, progress: Math.min(100, progress * 100), detail: objective.detail };
  }
  const decision = contractionDecision(state);
  if (decision?.kind === 'ignite') {
    const reaction = REACTIONS[decision.next];
    const requiredSolarMasses = (reaction.minimumMass / THRESHOLDS.matterPerSolarMass).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      id: `ignite-${decision.next}`,
      eyebrow: OBJECTIVE_EYEBROWS.contraction,
      title: OBJECTIVE_TEMPLATES.igniteTitle(reaction.fullTitle),
      progress: Math.min(100, state.temperature / reaction.ignitionTemperature * 100),
      detail: OBJECTIVE_TEMPLATES.igniteDetail(reaction.ignitionTemperature, requiredSolarMasses),
    };
  }
  if (state.stage === 'hydrogen') {
    const objective = OBJECTIVES['stabilize-star'];
    return { id: 'stabilize-star', eyebrow: objective.eyebrow, title: objective.title, progress: Math.min(100, state.fusedHydrogen / THRESHOLDS.mainSequenceHydrogen * 100), detail: objective.detail };
  }
  // Punkt 7: Explizites Ziel während der aktiven Brennphase — statt eines
  // fortschrittslosen "Fusioniere den Brennstoff" zeigt das Ziel den Aufbau
  // des nächsten Kerns: Anteil des bereits ins Hauptprodukt umgewandelten
  // Brennstoffs (Kern + Restwolke, konsistent zu fuelDepleted). 100 % fallen
  // damit genau mit der Erschöpfung der Brennstufe zusammen.
  const active = [...REACTION_ORDER].reverse().find((id) => reactionAvailable(state, id)) ?? 'hydrogen';
  const definition = REACTIONS[active];
  const outputKey = Object.keys(definition.outputs)[0] as keyof Matter;
  const outputRatio = Object.values(definition.outputs)[0] ?? 1;
  const fuelLeft = state.star[definition.primaryInput] + state.cloud[definition.primaryInput];
  const built = state.star[outputKey];
  const total = built + fuelLeft * outputRatio;
  return {
    id: `burn-${active}`,
    eyebrow: OBJECTIVE_EYEBROWS.activeBurn,
    title: definition.burnObjective.title,
    progress: total <= 0 ? 0 : Math.min(100, built / total * 100),
    detail: definition.burnObjective.detail,
  };
};
