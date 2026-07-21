import {
  ACCRETION,
  AUTOMATIONS,
  AUTOMATION_ORDER,
  CLOUD_TIERS,
  DEUTERIUM_TEMPERATURE_MULTIPLIER,
  DEUTERIUM_UPGRADE_COST,
  EMPTY_MATTER,
  FUSION_MEMORY_BONUS_PER_LEVEL,
  INITIAL_TEMPERATURE,
  LATE_SHELL_WIND_STAGES,
  LIMITS,
  MAIN_SEQUENCE_BURN,
  MATTER_KEYS,
  OUTCOMES,
  PRESTIGE_PERKS,
  REACTIONS,
  REACTION_ORDER,
  STAGES,
  STELLAR_WIND,
  TEMPERATURE_MODEL,
  THRESHOLDS,
  UPGRADES,
  type AutomationKind,
} from '../content';
import type {
  CloudTier,
  GameAction,
  GameState,
  Matter,
  PerkState,
  ReactionId,
  RoundRecord,
  RunStatistics,
  Stage,
  StellarOutcome,
  TutorialState,
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
const clampCloudTier = (tier: number): CloudTier => Math.max(0, Math.min(LIMITS.cloudTier, Math.floor(tier))) as CloudTier;
const emptyReactionTotals = (): Record<ReactionId, number> => Object.fromEntries(REACTION_ORDER.map((id) => [id, 0])) as Record<ReactionId, number>;

export const starMass = (state: GameState): number => totalMatter(state.star);
export const cloudMass = (state: GameState): number => totalMatter(state.cloud);
export const cloudDefinition = (tier: CloudTier) => CLOUD_TIERS[tier];
export const solarMasses = (state: GameState): number => starMass(state) / THRESHOLDS.matterPerSolarMass;

export const gravityMultiplier = (state: GameState): number =>
  1 + state.upgrades.gravity * ACCRETION.gravityBonusPerLevel + state.perks.permanentGravity * ACCRETION.permanentGravityBonusPerLevel;
export const stellarFusionMultiplier = (state: GameState): number => 1 + state.perks.fusionMemory * FUSION_MEMORY_BONUS_PER_LEVEL;

const matureAccretionMultiplier = (state: GameState): number =>
  state.unlockedReactions.includes('hydrogen') ? CLOUD_TIERS[state.cloudTier].matureAccretionMultiplier : 1;
export const accretionPerClick = (state: GameState): number => ACCRETION.manualBase * matureAccretionMultiplier(state) * gravityMultiplier(state);
export const accretionPerSecond = (state: GameState): number =>
  state.automation.accretion * AUTOMATIONS.accretion.baseRate * matureAccretionMultiplier(state) * gravityMultiplier(state);

const automationRate = (kind: AutomationKind, level: number): number => {
  const definition = AUTOMATIONS[kind];
  return level * definition.baseRate * (1 + level * definition.rateGrowthPerLevel);
};
export const reactionAutomationPerSecond = (state: GameState, reaction: ReactionId): number => {
  const kind = REACTIONS[reaction].automation;
  return automationRate(kind, state.automation[kind]) * stellarFusionMultiplier(state);
};

export const stellarWindPerSecond = (state: GameState): number => {
  if (state.completed || state.stage === 'nebula') return 0;
  return totalMatter(CLOUD_TIERS[state.cloudTier].matter) * STELLAR_WIND.fractionOfInitialCloudPerMinute / 60;
};

const shellWindFractionPerMinute = (stage: Stage): number => {
  if (stage === 'mainSequence') return STELLAR_WIND.shell.mainSequenceFractionPerMinute;
  if (LATE_SHELL_WIND_STAGES.includes(stage)) return STELLAR_WIND.shell.lateStageFractionPerMinute;
  return 0;
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
export const structuralHydrogenBurnPerSecond = (state: GameState): number => {
  if (state.completed || state.stage !== 'mainSequence') return 0;
  const massRatio = starMass(state) / MAIN_SEQUENCE_BURN.referenceMass;
  return MAIN_SEQUENCE_BURN.ratePerSecond * massRatio ** MAIN_SEQUENCE_BURN.massExponent;
};

export const automationCost = (kind: AutomationKind, level: number): number => {
  const definition = AUTOMATIONS[kind];
  return Math.round(definition.baseCost * definition.costGrowth ** level);
};
export const gravityCost = (level: number): number => Math.round(UPGRADES.gravity.cost.base * UPGRADES.gravity.cost.growth ** level);
export const cloudTierCost = PRESTIGE_PERKS.largerCloud.cost;
export const gravityPerkCost = PRESTIGE_PERKS.permanentGravity.cost;
export const fusionPerkCost = PRESTIGE_PERKS.fusionMemory.cost;

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
  if (!state.upgrades.deuteriumBurning || state.deuteriumIgnitionCompression === null) {
    return Math.min(raw, THRESHOLDS.hydrogenTemperature - INITIAL_TEMPERATURE);
  }
  const baseline = state.deuteriumIgnitionCompression;
  const accelerated = baseline + Math.max(0, raw - baseline) * DEUTERIUM_TEMPERATURE_MULTIPLIER;
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

const log = (state: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info'): void => {
  state.log.unshift({ id: Date.now() + Math.random(), text, kind });
  state.log = state.log.slice(0, 12);
};

const setStage = (state: GameState, stage: Stage, message?: string): void => {
  if (state.stage === stage) return;
  state.stage = stage;
  if (message) log(state, message, 'discovery');
  state.temperature = calculateTemperature(state);
};

export const createRunStatistics = (): RunStatistics => ({
  manualClicks: 0, deuteriumBurns: 0, manualFusionActions: 0, manualHeliumActions: 0,
  matterAccreted: 0, automaticMatterAccreted: 0, matterLostToWind: 0, matterLostToShellWind: 0,
  hydrogenFused: 0, automaticHydrogenFused: 0, heliumFused: 0, automaticHeliumFused: 0,
  oxygenCreated: 0, automaticOxygenCreated: 0, energyGenerated: 0,
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
  && reactionCapacity(state, reaction) > .001;

const primaryOutputAmount = (reaction: ReactionId, primaryInput: number): number => {
  const firstRatio = Object.values(REACTIONS[reaction].outputs)[0] ?? 1;
  return primaryInput * firstRatio;
};

const runReaction = (state: GameState, reaction: ReactionId, requested: number, automatic: boolean): number => {
  if (!reactionAvailable(state, reaction)) return 0;
  const definition = REACTIONS[reaction];
  const amount = Math.min(requested, reactionCapacity(state, reaction));
  if (amount <= .001) return 0;
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
  if (!automatic) state.stats.manualFusionActions += 1;

  if (reaction === 'hydrogen') {
    state.fusedHydrogen += amount;
    state.stats.hydrogenFused += amount;
    if (automatic) state.stats.automaticHydrogenFused += amount;
    if (!automatic) state.manualFusions += 1;
    if (state.fusedHydrogen >= THRESHOLDS.mainSequenceHydrogen && state.stage === 'hydrogen') {
      setStage(state, 'mainSequence', 'Hydrostatisches Gleichgewicht: Der Stern erreicht die Hauptreihe. Wasserstoffbrennen bleibt aktiv.');
    }
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
  if (state.reactionTotals[reaction] <= amount + .001) log(state, `${definition.title}: ${definition.equationInput} → ${definition.equationOutput}.`, 'fusion');
  return amount;
};

const addDiscovery = (state: GameState, outcome: StellarOutcome): void => {
  if (!state.discoveredOutcomes.includes(outcome)) state.discoveredOutcomes.push(outcome);
};

const completeRun = (state: GameState, outcome: Exclude<StellarOutcome, 'legacyMainSequence'>): void => {
  if (state.completed) return;
  const award = OUTCOMES[outcome].stardust;
  state.completed = true;
  state.outcome = outcome;
  state.stage = END_STAGES[outcome];
  state.summaryOpen = true;
  state.stardust += award;
  state.stats.stardustEarned += award;
  addDiscovery(state, outcome);
  state.temperature = calculateTemperature(state);
  log(state, `${OUTCOMES[outcome].title} +${award} Sternenstaub`, 'discovery');
};

const unlockEligibleReactions = (state: GameState): void => {
  REACTION_ORDER.forEach((id) => {
    if (state.unlockedReactions.includes(id)) return;
    const definition = REACTIONS[id];
    if (state.temperature < definition.ignitionTemperature || starMass(state) < definition.minimumMass) return;
    state.unlockedReactions.push(id);
    if (id !== 'alphaCapture') setStage(state, definition.stageOnUnlock, `${definition.title} bei ${definition.ignitionTemperature.toLocaleString('de-DE')} K freigeschaltet.`);
  });
};

const updateFormationStage = (state: GameState): void => {
  if (state.completed || state.unlockedReactions.includes('hydrogen')) return;
  state.temperature = calculateTemperature(state);
  if (state.temperature >= THRESHOLDS.deuteriumTemperature) {
    setStage(state, 'deuterium', '1 Mio. K: Deuteriumbrennen kann aktiviert werden.');
  } else if (state.temperature >= THRESHOLDS.protostarTemperature) {
    setStage(state, 'protostar', '100.000 K: Ein Protostern entsteht und sein Sternwind beginnt.');
  }
};

const nextHeavyFuel = (state: GameState): ReactionId | null => {
  if (state.star.carbon > .001) return 'carbon';
  if (state.star.neon > .001) return 'neon';
  if (state.star.oxygen > .001) return 'oxygen';
  if (state.star.silicon > .001) return 'silicon';
  return null;
};

// A fuel only counts as exhausted once neither the core nor the residual
// cloud can still supply it; otherwise accretion could flip the stage back.
const fuelDepleted = (state: GameState, key: keyof Matter): boolean => state.star[key] + state.cloud[key] <= .001;

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
  state.temperature = calculateTemperature(state);
  unlockEligibleReactions(state);
  if (!state.unlockedReactions.includes('hydrogen') && cloudMass(state) <= .001) {
    completeRun(state, 'brownDwarf');
    return;
  }
  if (state.unlockedReactions.includes('silicon') && state.star.silicon <= .001 && state.star.iron > .001) {
    setStage(state, 'ironCore', 'Ein Eisenkern ist entstanden. Weitere Fusion liefert keine Energie mehr.');
    completeRun(state, starMass(state) >= THRESHOLDS.blackHoleMass ? 'blackHole' : 'neutronStar');
    return;
  }
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
    else setStage(state, 'massiveStar', `Der Kern kontrahiert in Richtung ${definition.title}.`);
    return;
  }
  if (decision.next === 'helium') completeRun(state, 'heliumWhiteDwarf');
  else if (!state.unlockedReactions.includes('carbon')) completeRun(state, 'whiteDwarf');
  else completeRun(state, 'oxygenNeonWhiteDwarf');
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
  state.temperature = calculateTemperature(state);
};

interface PersistentRunOptions {
  soundEnabled?: boolean; volume?: number; tutorial?: TutorialState; history?: RoundRecord[];
  cloudTier?: CloudTier; nextCloudTier?: CloudTier; discoveredOutcomes?: StellarOutcome[];
}

export const createInitialState = (
  perkInput: Partial<PerkState> = {}, stardust = 0, run = 1, persistent: PersistentRunOptions = {},
): GameState => {
  const perks: PerkState = {
    largerCloud: clampCloudTier(perkInput.largerCloud ?? 0),
    permanentGravity: Math.max(0, Math.min(LIMITS.permanentGravity, perkInput.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(LIMITS.fusionMemory, perkInput.fusionMemory ?? 0)),
  };
  const unlockedTier = clampCloudTier(perks.largerCloud);
  const requestedTier = persistent.cloudTier ?? persistent.nextCloudTier ?? unlockedTier;
  const cloudTier = run === 1 && persistent.cloudTier === undefined ? 0 : clampCloudTier(Math.min(requestedTier, unlockedTier));
  const now = Date.now();
  return {
    version: 5, run, startedAt: now, lastTick: now, elapsed: 0, stage: 'nebula', cloudTier,
    nextCloudTier: clampCloudTier(Math.min(persistent.nextCloudTier ?? cloudTier, unlockedTier)),
    cloud: structuredClone(CLOUD_TIERS[cloudTier].matter), star: { ...EMPTY_MATTER }, radiatedMass: 0,
    energy: 0, temperature: INITIAL_TEMPERATURE, heatBonus: 0, contractionHeat: 0,
    deuteriumIgnitionCompression: null, unlockedReactions: [], reactionTotals: emptyReactionTotals(),
    automaticReactionTotals: emptyReactionTotals(), fusedHydrogen: 0, fusedHelium: 0,
    manualFusions: 0, manualHeliumFusions: 0,
    automation: { accretion: 0, fusion: 0, heliumFusion: 0, oxygenSynthesis: 0, carbonFusion: 0, neonFusion: 0, oxygenFusion: 0, siliconFusion: 0 },
    upgrades: { gravity: 0, deuteriumBurning: false }, stardust, perks,
    pendingPerks: { largerCloud: 0, permanentGravity: 0, fusionMemory: 0 },
    completed: false, outcome: null, discoveredOutcomes: [...(persistent.discoveredOutcomes ?? [])], summaryOpen: false,
    soundEnabled: persistent.soundEnabled ?? true, volume: Math.max(0, Math.min(1, persistent.volume ?? .35)),
    tutorial: persistent.tutorial ? { ...persistent.tutorial } : { introSeen: false, cosmosToastPending: true, completed: false, step: 0 },
    stats: createRunStatistics(), history: persistent.history ? structuredClone(persistent.history).slice(0, 20) : [],
    seenOpportunities: [], seenObjectives: [],
    log: [{ id: now, text: `${CLOUD_TIERS[cloudTier].name} bei 10 K wartet auf ihren ersten Impuls.`, kind: 'info' }],
  };
};

export const tick = (state: GameState, seconds: number): GameState => {
  const next = structuredClone(state);
  const dt = Math.max(0, Math.min(seconds, LIMITS.offlineSeconds));
  next.elapsed += dt;
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
  next.temperature = calculateTemperature(next);
  updateFormationStage(next);
  unlockEligibleReactions(next);
  AUTOMATION_ORDER.forEach((kind) => {
    const definition = AUTOMATIONS[kind];
    if (!definition.reaction || next.automation[kind] <= 0) return;
    runReaction(next, definition.reaction, automationRate(kind, next.automation[kind]) * stellarFusionMultiplier(next) * dt, true);
  });
  const structuralBurn = structuralHydrogenBurnPerSecond(next) * dt;
  if (structuralBurn > 0) runReaction(next, 'hydrogen', structuralBurn, true);
  next.heatBonus = Math.max(0, next.heatBonus - dt * TEMPERATURE_MODEL.heatLossPerSecond);
  evaluateEvolution(next);
  applyContraction(next, dt);
  evaluateEvolution(next);
  return next;
};

const reactionMastery = (state: GameState, reaction: ReactionId): number => primaryOutputAmount(reaction, state.reactionTotals[reaction]);
const buyAutomation = (state: GameState, kind: AutomationKind): void => {
  const definition = AUTOMATIONS[kind];
  const level = state.automation[kind];
  const cost = automationCost(kind, level);
  const visible = !definition.reaction || state.unlockedReactions.includes(definition.reaction);
  const mastery = definition.mastery.kind === 'starMass' ? starMass(state) : reactionMastery(state, definition.mastery.reaction);
  if (visible && mastery >= definition.mastery.threshold && state.energy >= cost && level < definition.maxLevel) {
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
      discoveredOutcomes: state.discoveredOutcomes,
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
    const limits = { largerCloud: LIMITS.cloudTier, permanentGravity: LIMITS.permanentGravity, fusionMemory: LIMITS.fusionMemory };
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

  if (action.type === 'ACCRETE') {
    const moved = transferMatter(next, accretionPerClick(next));
    next.stats.manualClicks += 1; next.stats.matterAccreted += moved; next.stats.energyGenerated += moved * ACCRETION.energyPerMatter;
  } else if (action.type === 'BUY_DEUTERIUM') {
    if (!next.upgrades.deuteriumBurning && starMass(next) >= THRESHOLDS.protostarMass && next.temperature >= THRESHOLDS.deuteriumTemperature && next.temperature < THRESHOLDS.hydrogenTemperature && next.energy >= DEUTERIUM_UPGRADE_COST) {
      next.energy -= DEUTERIUM_UPGRADE_COST;
      next.deuteriumIgnitionCompression = compressionHeat(next);
      next.upgrades.deuteriumBurning = true;
      next.stats.deuteriumBurns += 1; next.stats.upgradesPurchased += 1;
      log(next, 'Deuteriumbrennen beschleunigt ab jetzt die weitere Kompressionswärme.', 'fusion');
    }
  } else if (action.type === 'BUY_GRAVITY') {
    const cost = gravityCost(next.upgrades.gravity);
    if (next.energy >= cost && next.upgrades.gravity < LIMITS.gravity) { next.energy -= cost; next.upgrades.gravity += 1; next.stats.upgradesPurchased += 1; }
  } else if (action.type === 'RUN_REACTION') {
    runReaction(next, action.reaction, REACTIONS[action.reaction].manualAmount * stellarFusionMultiplier(next), false);
  } else if (action.type === 'BUY_REACTION_AUTOMATION') {
    buyAutomation(next, REACTIONS[action.reaction].automation);
  } else if (action.type === 'BUY_ACCRETION') buyAutomation(next, 'accretion');

  next.temperature = calculateTemperature(next);
  updateFormationStage(next);
  unlockEligibleReactions(next);
  evaluateEvolution(next);
  return next;
};

export const objectiveFor = (state: GameState): { id: string; eyebrow: string; title: string; progress: number; detail: string } => {
  if (state.completed) return { id: 'review-cycle', eyebrow: 'Entwicklung abgeschlossen', title: 'Runde auswerten', progress: 100, detail: 'Investiere Sternenstaub oder beginne den nächsten Zyklus.' };
  if (state.stage === 'nebula') return { id: 'form-protostar', eyebrow: 'Erstes Ziel', title: 'Protostern bilden', progress: Math.min(100, starMass(state) / THRESHOLDS.protostarMass * 100), detail: 'Verdichte die Materie der Urwolke im Zentrum.' };
  if (!state.unlockedReactions.includes('hydrogen')) return { id: 'ignite-hydrogen', eyebrow: 'Nächstes Ziel', title: 'Wasserstoffkern zünden', progress: Math.min(100, state.temperature / THRESHOLDS.hydrogenTemperature * 100), detail: 'Erreiche 10 Mio. K durch weitere Verdichtung.' };
  const decision = contractionDecision(state);
  if (decision?.kind === 'ignite') {
    const reaction = REACTIONS[decision.next];
    const requiredSolarMasses = (reaction.minimumMass / THRESHOLDS.matterPerSolarMass).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return { id: `ignite-${decision.next}`, eyebrow: 'Kernkontraktion', title: `${reaction.title} zünden`, progress: Math.min(100, state.temperature / reaction.ignitionTemperature * 100), detail: `Der erschöpfte Kern kontrahiert bis ${reaction.ignitionTemperature.toLocaleString('de-DE')} K (benötigt ≥ ${requiredSolarMasses} M☉).` };
  }
  const active = [...REACTION_ORDER].reverse().find((id) => reactionAvailable(state, id)) ?? 'hydrogen';
  const definition = REACTIONS[active];
  return { id: `burn-${active}`, eyebrow: 'Aktive Brennphase', title: definition.title, progress: 0, detail: `Fusioniere den verfügbaren ${definition.equationInput}-Brennstoff im Kern.` };
};
