import {
  CLOUD_TIERS,
  DEUTERIUM_TEMPERATURE_MULTIPLIER,
  DEUTERIUM_UPGRADE_COST,
  INITIAL_TEMPERATURE,
  LIMITS,
  MATTER_KEYS,
  THRESHOLDS,
} from './config';
import type {
  CloudTier,
  GameAction,
  GameState,
  Matter,
  PerkState,
  RoundRecord,
  RunStatistics,
  Stage,
  StellarOutcome,
  TutorialState,
} from './types';

const EMPTY_MATTER: Matter = { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 };
const END_STAGES: Record<Exclude<StellarOutcome, 'legacyMainSequence'>, Stage> = {
  brownDwarf: 'brownDwarf',
  whiteDwarf: 'whiteDwarf',
  neutronStar: 'neutronStar',
  blackHole: 'blackHole',
};

const totalMatter = (matter: Matter): number => MATTER_KEYS.reduce((sum, key) => sum + matter[key], 0);
const clampCloudTier = (tier: number): CloudTier => Math.max(0, Math.min(LIMITS.cloudTier, Math.floor(tier))) as CloudTier;

export const starMass = (state: GameState): number => totalMatter(state.star);
export const cloudMass = (state: GameState): number => totalMatter(state.cloud);
export const cloudDefinition = (tier: CloudTier) => CLOUD_TIERS[tier];

export const gravityMultiplier = (state: GameState): number =>
  1 + state.upgrades.gravity * 0.55 + state.perks.permanentGravity * 0.12;

export const stellarFusionMultiplier = (state: GameState): number => 1 + state.perks.fusionMemory * 0.15;
export const accretionPerClick = (state: GameState): number => 120 * gravityMultiplier(state);
export const accretionPerSecond = (state: GameState): number =>
  state.automation.accretion * 42 * gravityMultiplier(state);
export const fusionPerSecond = (state: GameState): number =>
  state.automation.fusion * 64 * (1 + state.automation.fusion * 0.08) * stellarFusionMultiplier(state);

export const gravityCost = (level: number): number => Math.round(45 * 2.2 ** level);
export const accretionCost = (level: number): number => Math.round(65 * 1.85 ** level);
export const fusionCost = (level: number): number => Math.round(280 * 1.9 ** level);
export const cloudTierCost = (level: number): number => level === 0 ? 2 : level === 1 ? 5 : Number.POSITIVE_INFINITY;
export const gravityPerkCost = (level: number): number => 2 + level * 2;
export const fusionPerkCost = (level: number): number => 3 + level * 3;

export const pressureProgress = (state: GameState): number =>
  Math.min(100, (starMass(state) / 34_000) ** 1.18 * 100);

const stageTemperatureFloor = (stage: Stage): number => {
  if (stage === 'redGiant' || stage === 'helium') return THRESHOLDS.heliumTemperature;
  if (stage === 'carbonOxygen') return 180_000_000;
  if (stage === 'massiveStar') return THRESHOLDS.lateBurningTemperature;
  if (stage === 'supernova' || stage === 'neutronStar' || stage === 'blackHole') return 1_000_000_000;
  if (stage === 'whiteDwarf') return 120_000_000;
  return INITIAL_TEMPERATURE;
};

export const calculateTemperature = (state: GameState): number => {
  const compression = (starMass(state) / 32_000) ** 1.5 * 9_500_000;
  const normalTemperature = INITIAL_TEMPERATURE + compression + state.heatBonus;
  const compressedTemperature = state.upgrades.deuteriumBurning && normalTemperature < THRESHOLDS.hydrogenTemperature
    ? INITIAL_TEMPERATURE + compression * DEUTERIUM_TEMPERATURE_MULTIPLIER + state.heatBonus
    : normalTemperature;
  return Math.max(INITIAL_TEMPERATURE, stageTemperatureFloor(state.stage), compressedTemperature);
};

const log = (state: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info') => {
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
  manualClicks: 0,
  deuteriumBurns: 0,
  manualFusionActions: 0,
  manualHeliumActions: 0,
  matterAccreted: 0,
  automaticMatterAccreted: 0,
  hydrogenFused: 0,
  automaticHydrogenFused: 0,
  heliumFused: 0,
  oxygenCreated: 0,
  energyGenerated: 0,
  upgradesPurchased: 0,
  automationsPurchased: 0,
  offlineSeconds: 0,
  stardustEarned: 0,
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
  state.energy += amount * 0.018;
  return amount;
};

const updatePreFusionStage = (state: GameState): void => {
  if (state.completed || !['nebula', 'protostar', 'deuterium', 'hydrogen'].includes(state.stage)) return;
  state.temperature = calculateTemperature(state);
  if (state.cloudTier > 0 && state.temperature >= THRESHOLDS.hydrogenTemperature) {
    setStage(state, 'hydrogen', '10 Mio. K: Dauerhaftes Wasserstoffbrennen ist möglich.');
    return;
  }
  if (state.cloudTier > 0 && state.star.deuterium > 0 && state.temperature >= THRESHOLDS.deuteriumTemperature) {
    setStage(state, 'deuterium', '1 Mio. K: Deuteriumbrennen kann aktiviert werden.');
    return;
  }
  if (starMass(state) >= THRESHOLDS.protostarMass) setStage(state, 'protostar', 'Gravitation formt einen Protostern.');
};

const addDiscovery = (state: GameState, outcome: StellarOutcome): void => {
  if (!state.discoveredOutcomes.includes(outcome)) state.discoveredOutcomes.push(outcome);
};

const rewardForOutcome = (outcome: Exclude<StellarOutcome, 'legacyMainSequence'>): number => ({
  brownDwarf: 2,
  whiteDwarf: 5,
  neutronStar: 8,
  blackHole: 10,
})[outcome];

const completeRun = (state: GameState, outcome: Exclude<StellarOutcome, 'legacyMainSequence'>): void => {
  if (state.completed) return;
  const award = rewardForOutcome(outcome);
  state.completed = true;
  state.outcome = outcome;
  state.stage = END_STAGES[outcome];
  state.summaryOpen = true;
  state.stardust += award;
  state.stats.stardustEarned += award;
  addDiscovery(state, outcome);
  state.temperature = calculateTemperature(state);
  log(state, `${CLOUD_TIERS[state.cloudTier].name}: ${outcome === 'brownDwarf' ? 'Die Zündmasse wurde nicht erreicht.' : 'Der stellare Lebenszyklus ist abgeschlossen.'} +${award} Sternenstaub`, 'discovery');
};

const completeBrownDwarfIfNeeded = (state: GameState): void => {
  if (!state.completed && state.cloudTier === 0 && cloudMass(state) <= 0.001) completeRun(state, 'brownDwarf');
};

const fuseHydrogen = (state: GameState, requested: number): number => {
  if (state.stage !== 'hydrogen' || state.temperature < THRESHOLDS.hydrogenTemperature) return 0;
  const amount = Math.min(requested, state.star.hydrogen, THRESHOLDS.mainSequenceHydrogen - state.fusedHydrogen);
  if (amount <= 0) return 0;
  const heliumCreated = amount * 0.993;
  state.star.hydrogen -= amount;
  state.star.helium += heliumCreated;
  state.radiatedMass += amount - heliumCreated;
  state.fusedHydrogen += amount;
  state.energy += amount * 0.34;
  state.heatBonus += amount * 2.4;
  if (state.fusedHydrogen >= THRESHOLDS.mainSequenceHydrogen) {
    setStage(state, 'mainSequence', 'Hydrostatisches Gleichgewicht: Ein Hauptreihenstern ist entstanden.');
  }
  return amount;
};

const fuseHelium = (state: GameState, requested: number): number => {
  if (state.stage !== 'helium') return 0;
  const amount = Math.min(requested, state.star.helium, THRESHOLDS.heliumCore - state.fusedHelium);
  if (amount <= 0) return 0;
  const carbonCreated = amount * 0.998;
  state.star.helium -= amount;
  state.star.carbon += carbonCreated;
  state.radiatedMass += amount - carbonCreated;
  state.fusedHelium += amount;
  state.energy += amount * 0.52;
  if (state.fusedHelium >= THRESHOLDS.heliumCore) {
    setStage(state, 'carbonOxygen', 'Der Kern reichert sich mit Kohlenstoff an. Alpha-Einfang kann Sauerstoff bilden.');
  }
  return amount;
};

const createOxygen = (state: GameState, requestedCarbon: number): number => {
  if (state.stage !== 'carbonOxygen') return 0;
  const carbon = Math.min(requestedCarbon, state.star.carbon, state.star.helium * 3, THRESHOLDS.oxygenCore - state.stats.oxygenCreated);
  if (carbon <= 0) return 0;
  const helium = carbon / 3;
  const oxygen = (carbon + helium) * 0.998;
  state.star.carbon -= carbon;
  state.star.helium -= helium;
  state.star.oxygen += oxygen;
  state.radiatedMass += carbon + helium - oxygen;
  state.stats.oxygenCreated += oxygen;
  state.energy += oxygen * 0.68;
  return oxygen;
};

interface PersistentRunOptions {
  soundEnabled?: boolean;
  volume?: number;
  tutorial?: TutorialState;
  history?: RoundRecord[];
  cloudTier?: CloudTier;
  nextCloudTier?: CloudTier;
  discoveredOutcomes?: StellarOutcome[];
}

export const createInitialState = (
  perkInput: Partial<PerkState> = {},
  stardust = 0,
  run = 1,
  persistent: PersistentRunOptions = {},
): GameState => {
  const perks: PerkState = {
    largerCloud: clampCloudTier(perkInput.largerCloud ?? 0),
    permanentGravity: Math.max(0, Math.min(LIMITS.permanentGravity, perkInput.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(LIMITS.fusionMemory, perkInput.fusionMemory ?? 0)),
  };
  const unlockedTier = clampCloudTier(perks.largerCloud);
  const requestedTier = persistent.cloudTier ?? persistent.nextCloudTier ?? unlockedTier;
  const cloudTier = run === 1 && persistent.cloudTier === undefined ? 0 : clampCloudTier(Math.min(requestedTier, unlockedTier));
  const cloud = structuredClone(CLOUD_TIERS[cloudTier].matter);
  const now = Date.now();
  return {
    version: 4,
    run,
    startedAt: now,
    lastTick: now,
    elapsed: 0,
    stage: 'nebula',
    cloudTier,
    nextCloudTier: clampCloudTier(Math.min(persistent.nextCloudTier ?? cloudTier, unlockedTier)),
    cloud,
    star: { ...EMPTY_MATTER },
    radiatedMass: 0,
    energy: 0,
    temperature: INITIAL_TEMPERATURE,
    heatBonus: 0,
    fusedHydrogen: 0,
    fusedHelium: 0,
    manualFusions: 0,
    manualHeliumFusions: 0,
    automation: { accretion: 0, fusion: 0 },
    upgrades: { gravity: 0, deuteriumBurning: false },
    stardust,
    perks,
    completed: false,
    outcome: null,
    discoveredOutcomes: [...(persistent.discoveredOutcomes ?? [])],
    summaryOpen: false,
    soundEnabled: persistent.soundEnabled ?? true,
    volume: Math.max(0, Math.min(1, persistent.volume ?? .35)),
    tutorial: persistent.tutorial ? { ...persistent.tutorial } : { introSeen: false, cosmosToastPending: true, completed: false, step: 0 },
    stats: createRunStatistics(),
    history: persistent.history ? structuredClone(persistent.history).slice(0, 20) : [],
    seenOpportunities: [],
    seenObjectives: [],
    log: [{ id: now, text: `${CLOUD_TIERS[cloudTier].name} bei 10 K wartet auf ihren ersten Impuls.`, kind: 'info' }],
  };
};

export const tick = (state: GameState, seconds: number): GameState => {
  const next = structuredClone(state);
  const dt = Math.max(0, Math.min(seconds, LIMITS.offlineSeconds));
  next.elapsed += dt;
  next.lastTick = Date.now();
  if (next.completed) return next;

  const accreted = transferMatter(next, accretionPerSecond(next) * dt);
  next.stats.matterAccreted += accreted;
  next.stats.automaticMatterAccreted += accreted;
  next.stats.energyGenerated += accreted * .018;
  updatePreFusionStage(next);

  const fused = fuseHydrogen(next, fusionPerSecond(next) * dt);
  next.stats.hydrogenFused += fused;
  next.stats.automaticHydrogenFused += fused;
  next.stats.energyGenerated += fused * .34;
  next.heatBonus = Math.max(0, next.heatBonus - dt * 180);
  next.temperature = calculateTemperature(next);
  completeBrownDwarfIfNeeded(next);
  return next;
};

const canAdvance = (state: GameState): boolean => {
  if (state.stage === 'mainSequence' || state.stage === 'redGiant' || state.stage === 'massiveStar' || state.stage === 'supernova') return true;
  return state.stage === 'carbonOxygen' && state.stats.oxygenCreated >= THRESHOLDS.oxygenCore;
};

export const evolutionActionFor = (state: GameState): { label: string; detail: string; available: boolean } | null => {
  if (state.stage === 'mainSequence') return { label: 'Hauptreihe verlassen', detail: 'Der Wasserstoffvorrat im Kern ist erschöpft.', available: true };
  if (state.stage === 'redGiant') return { label: 'Heliumkern zünden', detail: 'Der verdichtete Kern erreicht 100 Mio. K.', available: true };
  if (state.stage === 'carbonOxygen') return { label: state.cloudTier === 1 ? 'Hülle abstoßen' : 'Späte Brennphasen', detail: state.stats.oxygenCreated >= THRESHOLDS.oxygenCore ? 'Der C/O-Kern ist bereit.' : `${Math.round(state.stats.oxygenCreated)}/${THRESHOLDS.oxygenCore} O`, available: canAdvance(state) };
  if (state.stage === 'massiveStar') return { label: 'Supernova auslösen', detail: 'Der schwere Kern kollabiert.', available: true };
  if (state.stage === 'supernova') return { label: 'Sternrest beobachten', detail: 'Die Endmasse entscheidet über den kompakten Rest.', available: true };
  return null;
};

export const reduceGame = (state: GameState, action: GameAction): GameState => {
  if (action.type === 'PRESTIGE') {
    if (!state.completed || !state.outcome) return state;
    const record: RoundRecord = { ...state.stats, run: state.run, duration: state.elapsed, finalMass: starMass(state), cloudTier: state.cloudTier, outcome: state.outcome };
    return createInitialState(state.perks, state.stardust, state.run + 1, {
      soundEnabled: state.soundEnabled,
      volume: state.volume,
      tutorial: state.tutorial,
      history: [record, ...state.history],
      cloudTier: state.nextCloudTier,
      nextCloudTier: state.nextCloudTier,
      discoveredOutcomes: state.discoveredOutcomes,
    });
  }

  const next = structuredClone(state);
  if (action.type === 'TOGGLE_SOUND') { next.soundEnabled = !next.soundEnabled; return next; }
  if (action.type === 'SET_VOLUME') {
    next.volume = Math.max(0, Math.min(1, action.volume));
    if (next.volume > 0) next.soundEnabled = true;
    return next;
  }
  if (action.type === 'CLOSE_SUMMARY') { next.summaryOpen = false; return next; }
  if (action.type === 'OPEN_SUMMARY') {
    if (next.completed) next.summaryOpen = true;
    return next;
  }
  if (action.type === 'ACKNOWLEDGE_OBJECTIVE') {
    if (!next.seenObjectives.includes(action.objective)) next.seenObjectives.push(action.objective);
    return next;
  }
  if (action.type === 'SELECT_CLOUD_TIER') {
    if (next.completed && action.tier <= next.perks.largerCloud) next.nextCloudTier = action.tier;
    return next;
  }
  if (action.type === 'BUY_PERK') {
    const level = next.perks[action.perk];
    const costs = {
      largerCloud: cloudTierCost(level),
      permanentGravity: gravityPerkCost(level),
      fusionMemory: fusionPerkCost(level),
    };
    const limits = { largerCloud: LIMITS.cloudTier, permanentGravity: LIMITS.permanentGravity, fusionMemory: LIMITS.fusionMemory };
    const cost = costs[action.perk];
    if (next.completed && level < limits[action.perk] && next.stardust >= cost) {
      next.stardust -= cost;
      next.perks[action.perk] += 1;
      if (action.perk === 'largerCloud') next.nextCloudTier = clampCloudTier(next.perks.largerCloud);
    }
    return next;
  }
  if (next.completed) return next;

  switch (action.type) {
    case 'ACCRETE': {
      const moved = transferMatter(next, accretionPerClick(next));
      next.stats.manualClicks += 1;
      next.stats.matterAccreted += moved;
      next.stats.energyGenerated += moved * .018;
      if (moved > 0 && starMass(next) < 600) log(next, 'Materie fällt ins Gravitationszentrum.', 'info');
      break;
    }
    case 'BUY_DEUTERIUM': {
      if (!next.upgrades.deuteriumBurning && next.star.deuterium > 0 && next.temperature >= THRESHOLDS.deuteriumTemperature && next.temperature < THRESHOLDS.hydrogenTemperature && next.energy >= DEUTERIUM_UPGRADE_COST) {
        next.energy -= DEUTERIUM_UPGRADE_COST;
        next.upgrades.deuteriumBurning = true;
        next.stats.deuteriumBurns += 1;
        next.stats.upgradesPurchased += 1;
        log(next, 'Deuteriumbrennen beschleunigt die Erwärmung des Kerns.', 'fusion');
      }
      break;
    }
    case 'FUSE_HYDROGEN': {
      const fused = fuseHydrogen(next, 200 * stellarFusionMultiplier(next));
      if (fused > 0) {
        next.manualFusions += 1;
        next.stats.manualFusionActions += 1;
        next.stats.hydrogenFused += fused;
        next.stats.energyGenerated += fused * .34;
        if (next.manualFusions === 1) log(next, 'Erstes Wasserstoffbrennen: Wasserstoff wird zu Helium.', 'fusion');
      }
      break;
    }
    case 'FUSE_HELIUM': {
      const fused = fuseHelium(next, 300 * stellarFusionMultiplier(next));
      if (fused > 0) {
        next.manualHeliumFusions += 1;
        next.stats.manualHeliumActions += 1;
        next.stats.heliumFused += fused;
        next.stats.energyGenerated += fused * .52;
        if (next.manualHeliumFusions === 1) log(next, 'Triple-Alpha-Prozess: Drei Heliumkerne bilden Kohlenstoff.', 'fusion');
      }
      break;
    }
    case 'CREATE_OXYGEN': {
      const oxygen = createOxygen(next, 180 * stellarFusionMultiplier(next));
      if (oxygen > 0) {
        next.stats.manualHeliumActions += 1;
        next.stats.energyGenerated += oxygen * .68;
        if (next.stats.oxygenCreated <= oxygen + 0.001) log(next, 'Alpha-Einfang: Kohlenstoff und Helium bilden Sauerstoff.', 'fusion');
      }
      break;
    }
    case 'ADVANCE_EVOLUTION': {
      if (next.stage === 'mainSequence') setStage(next, 'redGiant', 'Der Kern zieht sich zusammen, während die äußere Hülle zum Roten Riesen anschwillt.');
      else if (next.stage === 'redGiant') setStage(next, 'helium', '100 Mio. K: Der Triple-Alpha-Prozess beginnt.');
      else if (next.stage === 'carbonOxygen' && next.stats.oxygenCreated >= THRESHOLDS.oxygenCore) {
        if (next.cloudTier === 1) completeRun(next, 'whiteDwarf');
        else setStage(next, 'massiveStar', 'Kohlenstoff und Sauerstoff nähren die komprimierten späten Brennphasen.');
      } else if (next.stage === 'massiveStar') setStage(next, 'supernova', 'Der schwere Kern kollabiert: Eine Supernova zerreißt den Stern.');
      else if (next.stage === 'supernova') completeRun(next, starMass(next) >= THRESHOLDS.blackHoleMass ? 'blackHole' : 'neutronStar');
      break;
    }
    case 'BUY_ACCRETION': {
      const cost = accretionCost(next.automation.accretion);
      if (starMass(next) >= THRESHOLDS.protostarMass && next.energy >= cost && next.automation.accretion < LIMITS.accretion) {
        next.energy -= cost;
        next.automation.accretion += 1;
        next.stats.automationsPurchased += 1;
        log(next, 'Akkretionsstrom verstärkt.', 'info');
      }
      break;
    }
    case 'BUY_FUSION': {
      const cost = fusionCost(next.automation.fusion);
      if (next.manualFusions >= 5 && next.energy >= cost && next.automation.fusion < LIMITS.fusion) {
        next.energy -= cost;
        next.automation.fusion += 1;
        next.stats.automationsPurchased += 1;
        log(next, 'Stabiles Wasserstoffbrennen läuft automatisch.', 'fusion');
      }
      break;
    }
    case 'BUY_GRAVITY': {
      const cost = gravityCost(next.upgrades.gravity);
      if (next.energy >= cost && next.upgrades.gravity < LIMITS.gravity) {
        next.energy -= cost;
        next.upgrades.gravity += 1;
        next.stats.upgradesPurchased += 1;
        log(next, 'Dichtere Materie erhöht die Akkretionsrate.', 'info');
      }
      break;
    }
  }

  updatePreFusionStage(next);
  next.temperature = calculateTemperature(next);
  completeBrownDwarfIfNeeded(next);
  return next;
};

export const objectiveFor = (state: GameState): { id: string; eyebrow: string; title: string; progress: number; detail: string } => {
  if (state.completed) return { id: 'review-cycle', eyebrow: 'Entwicklung abgeschlossen', title: 'Runde auswerten', progress: 100, detail: 'Investiere Sternenstaub, wähle eine Wolkengröße oder beginne den nächsten Zyklus.' };
  if (state.cloudTier === 0) return {
    id: 'discover-mass-limit', eyebrow: 'Erste Entdeckung', title: 'Die kleine Urwolke verdichten',
    progress: Math.min(100, (1 - cloudMass(state) / totalMatter(CLOUD_TIERS[0].matter)) * 100),
    detail: 'Akkretiere die gesamte Wolke und finde heraus, ob ihre Masse für Wasserstoffbrennen reicht.',
  };
  if (state.temperature < THRESHOLDS.deuteriumTemperature) return {
    id: 'heat-protostar', eyebrow: 'Nächstes Ziel', title: 'Protostern verdichten',
    progress: Math.min(100, state.temperature / THRESHOLDS.deuteriumTemperature * 100),
    detail: 'Akkretiere Materie, bis der Kern 1 Mio. K erreicht.',
  };
  if (state.temperature < THRESHOLDS.hydrogenTemperature && ['nebula', 'protostar', 'deuterium'].includes(state.stage)) return {
    id: 'ignite-hydrogen', eyebrow: 'Nächstes Ziel', title: 'Wasserstoffkern zünden',
    progress: Math.min(100, state.temperature / THRESHOLDS.hydrogenTemperature * 100),
    detail: state.upgrades.deuteriumBurning ? 'Deuteriumbrennen beschleunigt die Erwärmung bis 10 Mio. K.' : 'Aktiviere Deuteriumbrennen und verstärke die Gravitation.',
  };
  if (state.stage === 'hydrogen') return {
    id: 'stabilize-star', eyebrow: 'Nächstes Ziel', title: 'Hauptreihe erreichen',
    progress: Math.min(100, state.fusedHydrogen / THRESHOLDS.mainSequenceHydrogen * 100),
    detail: `Fusioniere ${THRESHOLDS.mainSequenceHydrogen.toLocaleString('de-DE')} Materieeinheiten Wasserstoff.`,
  };
  if (state.stage === 'mainSequence') return { id: 'leave-main-sequence', eyebrow: 'Stellare Wende', title: 'Zum Roten Riesen entwickeln', progress: 100, detail: 'Der Wasserstoff im Kern ist verbraucht. Setze die Entwicklung über die Reaktionen fort.' };
  if (state.stage === 'redGiant') return { id: 'ignite-helium', eyebrow: 'Stellare Wende', title: 'Heliumkern zünden', progress: 100, detail: 'Verdichte den inerten Heliumkern bis zum Triple-Alpha-Prozess.' };
  if (state.stage === 'helium') return {
    id: 'build-carbon-core', eyebrow: 'Nächstes Ziel', title: 'Kohlenstoffkern aufbauen',
    progress: Math.min(100, state.fusedHelium / THRESHOLDS.heliumCore * 100),
    detail: 'Verschmelze Helium im Triple-Alpha-Prozess zu Kohlenstoff.',
  };
  if (state.stage === 'carbonOxygen') return {
    id: 'build-oxygen-core', eyebrow: 'Nächstes Ziel', title: 'Sauerstoff bilden',
    progress: Math.min(100, state.stats.oxygenCreated / THRESHOLDS.oxygenCore * 100),
    detail: 'Fange weitere Heliumkerne an Kohlenstoff ein und forme einen C/O-Kern.',
  };
  if (state.stage === 'massiveStar') return { id: 'collapse-core', eyebrow: 'Letzte Brennphasen', title: 'Kernkollaps auslösen', progress: 100, detail: 'Die späten Brennphasen enden am schweren Kern. Bereite die Supernova vor.' };
  return { id: 'observe-remnant', eyebrow: 'Kosmisches Finale', title: 'Sternrest beobachten', progress: 100, detail: 'Die akkretierte Endmasse entscheidet zwischen Neutronenstern und Schwarzem Loch.' };
};
