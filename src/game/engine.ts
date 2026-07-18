import { CLOUD_BASE, LIMITS, THRESHOLDS } from './config';
import type { GameAction, GameState, Matter, Stage } from './types';

const totalMatter = (matter: Matter) => matter.hydrogen + matter.helium + matter.deuterium;

export const starMass = (state: GameState): number => totalMatter(state.star);
export const cloudMass = (state: GameState): number => totalMatter(state.cloud);

export const gravityMultiplier = (state: GameState): number =>
  1 + state.upgrades.gravity * 0.55 + state.perks.permanentGravity * 0.12;

export const accretionPerClick = (state: GameState): number => 120 * gravityMultiplier(state);
export const accretionPerSecond = (state: GameState): number =>
  state.automation.accretion * 42 * gravityMultiplier(state);
export const fusionPerSecond = (state: GameState): number =>
  state.automation.fusion * 64 * (1 + state.automation.fusion * 0.08);

export const gravityCost = (level: number): number => Math.round(45 * 2.2 ** level);
export const accretionCost = (level: number): number => Math.round(65 * 1.85 ** level);
export const fusionCost = (level: number): number => Math.round(280 * 1.9 ** level);

export const pressureProgress = (state: GameState): number =>
  Math.min(100, (starMass(state) / 34_000) ** 1.18 * 100);

export const calculateTemperature = (state: GameState): number => {
  const compression = (starMass(state) / 32_000) ** 1.5 * 9_500_000;
  return Math.max(2_700, 2_700 + compression + state.heatBonus);
};

const stageFor = (state: GameState): Stage => {
  if (state.completed) return 'stable';
  if (state.temperature >= THRESHOLDS.hydrogenTemperature) return 'hydrogen';
  if (state.temperature >= THRESHOLDS.deuteriumTemperature) return 'deuterium';
  if (starMass(state) >= THRESHOLDS.protostarMass) return 'protostar';
  return 'nebula';
};

const log = (state: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info') => {
  state.log.unshift({ id: Date.now() + Math.random(), text, kind });
  state.log = state.log.slice(0, 8);
};

const transferMatter = (state: GameState, requested: number): number => {
  const available = cloudMass(state);
  const amount = Math.min(requested, available);
  if (amount <= 0) return 0;

  const ratio = amount / available;
  const movedHydrogen = state.cloud.hydrogen * ratio;
  const movedHelium = state.cloud.helium * ratio;
  const movedDeuterium = state.cloud.deuterium * ratio;

  state.cloud.hydrogen -= movedHydrogen;
  state.cloud.helium -= movedHelium;
  state.cloud.deuterium -= movedDeuterium;
  state.star.hydrogen += movedHydrogen;
  state.star.helium += movedHelium;
  state.star.deuterium += movedDeuterium;
  state.energy += amount * 0.018;
  return amount;
};

const fuseHydrogen = (state: GameState, requested: number): number => {
  if (state.temperature < THRESHOLDS.hydrogenTemperature) return 0;
  const amount = Math.min(requested, state.star.hydrogen);
  if (amount <= 0) return 0;

  const heliumCreated = amount * 0.993;
  state.star.hydrogen -= amount;
  state.star.helium += heliumCreated;
  state.radiatedMass += amount - heliumCreated;
  state.fusedHydrogen += amount;
  state.energy += amount * 0.34;
  state.heatBonus += amount * 2.4;
  return amount;
};

const updateStage = (state: GameState) => {
  const before = state.stage;
  state.temperature = calculateTemperature(state);
  state.stage = stageFor(state);
  if (before === state.stage) return;

  if (state.stage === 'protostar') log(state, 'Gravitation formt einen Protostern.', 'discovery');
  if (state.stage === 'deuterium') log(state, '1 Mio. K: Deuterium kann zünden.', 'discovery');
  if (state.stage === 'hydrogen') log(state, '10 Mio. K: Die pp-Kette ist möglich.', 'discovery');
};

const completeRun = (state: GameState) => {
  if (state.completed || state.fusedHydrogen < THRESHOLDS.stableFusedHydrogen) return;
  state.completed = true;
  state.summaryOpen = true;
  state.stage = 'stable';
  const award = Math.max(2, Math.min(5, 2 + Math.floor(starMass(state) / 30_000)));
  state.stardust += award;
  log(state, `Hydrostatisches Gleichgewicht erreicht. +${award} Sternenstaub`, 'discovery');
};

export const createInitialState = (
  perks: GameState['perks'] = { largerCloud: 0, permanentGravity: 0 },
  stardust = 0,
  run = 1,
): GameState => {
  const cloudMultiplier = 1 + perks.largerCloud * 0.25;
  const now = Date.now();
  return {
    version: 1,
    run,
    startedAt: now,
    lastTick: now,
    elapsed: 0,
    stage: 'nebula',
    cloud: {
      hydrogen: CLOUD_BASE.hydrogen * cloudMultiplier,
      helium: CLOUD_BASE.helium * cloudMultiplier,
      deuterium: CLOUD_BASE.deuterium * cloudMultiplier,
    },
    star: { hydrogen: 0, helium: 0, deuterium: 0 },
    radiatedMass: 0,
    energy: 0,
    temperature: 2_700,
    heatBonus: 0,
    fusedHydrogen: 0,
    manualFusions: 0,
    automation: { accretion: 0, fusion: 0 },
    upgrades: { gravity: 0 },
    stardust,
    perks,
    completed: false,
    summaryOpen: false,
    soundEnabled: true,
    seenOpportunities: [],
    log: [{ id: now, text: 'Eine kalte Urwolke wartet auf ihren Impuls.', kind: 'info' }],
  };
};

export const tick = (state: GameState, seconds: number): GameState => {
  const next = structuredClone(state);
  const dt = Math.max(0, Math.min(seconds, LIMITS.offlineSeconds));
  next.elapsed += dt;
  next.lastTick = Date.now();

  if (!next.completed) {
    transferMatter(next, accretionPerSecond(next) * dt);
    next.temperature = calculateTemperature(next);
    fuseHydrogen(next, fusionPerSecond(next) * dt);
    next.heatBonus = Math.max(0, next.heatBonus - dt * 180);
    updateStage(next);
    completeRun(next);
  }
  return next;
};

export const reduceGame = (state: GameState, action: GameAction): GameState => {
  if (action.type === 'PRESTIGE') {
    if (!state.completed) return state;
    return createInitialState(state.perks, state.stardust, state.run + 1);
  }

  const next = structuredClone(state);
  if (action.type === 'TOGGLE_SOUND') {
    next.soundEnabled = !next.soundEnabled;
    return next;
  }
  if (action.type === 'CLOSE_SUMMARY') {
    next.summaryOpen = false;
    return next;
  }
  if (action.type === 'BUY_PERK') {
    const costs = { largerCloud: 2 + next.perks.largerCloud * 2, permanentGravity: 2 + next.perks.permanentGravity * 2 };
    const cost = costs[action.perk];
    if (next.stardust >= cost && next.completed) {
      next.stardust -= cost;
      next.perks[action.perk] += 1;
    }
    return next;
  }
  if (next.completed) return next;

  switch (action.type) {
    case 'ACCRETE': {
      const moved = transferMatter(next, accretionPerClick(next));
      if (moved > 0 && starMass(next) < 600) log(next, 'Materie fällt ins Gravitationszentrum.', 'info');
      break;
    }
    case 'BURN_DEUTERIUM': {
      if (next.temperature >= THRESHOLDS.deuteriumTemperature && next.star.deuterium >= 2) {
        next.star.deuterium -= 2;
        next.star.helium += 1.986;
        next.radiatedMass += 0.014;
        next.heatBonus += 170_000;
        next.energy += 36;
        log(next, 'Deuterium zündet und stabilisiert den Protostern kurzzeitig.', 'fusion');
      }
      break;
    }
    case 'FUSE_HYDROGEN': {
      const fused = fuseHydrogen(next, 200);
      if (fused > 0) {
        next.manualFusions += 1;
        if (next.manualFusions === 1) log(next, 'Erste pp-Kette: Wasserstoff wird zu Helium.', 'fusion');
      }
      break;
    }
    case 'BUY_ACCRETION': {
      const cost = accretionCost(next.automation.accretion);
      if (starMass(next) >= THRESHOLDS.protostarMass && next.energy >= cost && next.automation.accretion < LIMITS.accretion) {
        next.energy -= cost;
        next.automation.accretion += 1;
        log(next, 'Akkretionsstrom verstärkt.', 'info');
      }
      break;
    }
    case 'BUY_FUSION': {
      const cost = fusionCost(next.automation.fusion);
      if (next.manualFusions >= 5 && next.energy >= cost && next.automation.fusion < LIMITS.fusion) {
        next.energy -= cost;
        next.automation.fusion += 1;
        log(next, 'Ein stabiler pp-Zyklus läuft automatisch.', 'fusion');
      }
      break;
    }
    case 'BUY_GRAVITY': {
      const cost = gravityCost(next.upgrades.gravity);
      if (next.energy >= cost && next.upgrades.gravity < LIMITS.gravity) {
        next.energy -= cost;
        next.upgrades.gravity += 1;
        log(next, 'Dichtere Materie erhöht die Akkretionsrate.', 'info');
      }
      break;
    }
  }

  updateStage(next);
  completeRun(next);
  return next;
};

export const objectiveFor = (state: GameState): { eyebrow: string; title: string; progress: number; detail: string } => {
  if (state.completed) return { eyebrow: 'Stern geboren', title: 'Runde auswerten', progress: 100, detail: 'Investiere Sternenstaub oder beginne den nächsten Zyklus.' };
  if (state.temperature < THRESHOLDS.deuteriumTemperature) return {
    eyebrow: 'Nächstes Ziel', title: 'Protostern verdichten',
    progress: Math.min(100, state.temperature / THRESHOLDS.deuteriumTemperature * 100),
    detail: 'Akkretiere Materie, bis der Kern 1 Mio. K erreicht.',
  };
  if (state.temperature < THRESHOLDS.hydrogenTemperature) return {
    eyebrow: 'Nächstes Ziel', title: 'Kern aufheizen',
    progress: Math.min(100, state.temperature / THRESHOLDS.hydrogenTemperature * 100),
    detail: 'Nutze Deuterium und Gravitation, um 10 Mio. K zu erreichen.',
  };
  return {
    eyebrow: 'Nächstes Ziel', title: 'Gleichgewicht herstellen',
    progress: Math.min(100, state.fusedHydrogen / THRESHOLDS.stableFusedHydrogen * 100),
    detail: 'Fusioniere 15.000 Materieeinheiten Wasserstoff.',
  };
};
