import { describe, expect, it } from 'vitest';
import { CLOUD_TIERS, EMPTY_MATTER, REACTIONS, REACTION_ORDER, THRESHOLDS } from '../src/content';
import {
  accretionPerClick,
  calculateTemperature,
  cloudMass,
  createInitialState,
  objectiveFor,
  reactionCapacity,
  reduceGame,
  solarMasses,
  starMass,
  tick,
} from '../src/game/engine';
import type { GameState, ReactionId } from '../src/game/types';

const accreteUntil = (initial: GameState, targetMass: number, guardLimit = 20_000): GameState => {
  let state = initial;
  let guard = 0;
  while (!state.completed && starMass(state) < targetMass && guard < guardLimit) {
    state = reduceGame(state, { type: 'ACCRETE' });
    guard += 1;
  }
  return state;
};

const reactionState = (reaction: ReactionId, fuel = 1_000): GameState => {
  const state = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
  state.cloud = { ...EMPTY_MATTER };
  state.star = { ...EMPTY_MATTER, iron: 2_000_000 };
  const definition = REACTIONS[reaction];
  Object.entries(definition.inputs).forEach(([key, ratio]) => {
    state.star[key as keyof typeof state.star] = fuel * (ratio ?? 0);
  });
  state.unlockedReactions = [...REACTION_ORDER.slice(0, REACTION_ORDER.indexOf(reaction) + 1)];
  if (reaction === 'alphaCapture' && !state.unlockedReactions.includes('helium')) state.unlockedReactions.push('helium');
  state.temperature = definition.ignitionTemperature;
  state.stage = definition.stageOnUnlock;
  return state;
};

describe('data-driven stellar engine v0.4', () => {
  it('uses the calibrated solar-mass scale and cloud masses', () => {
    const small = createInitialState();
    const stellar = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    const massive = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
    expect(cloudMass(small) / THRESHOLDS.matterPerSolarMass).toBeCloseTo(.07, 5);
    expect(cloudMass(stellar) / THRESHOLDS.matterPerSolarMass).toBeCloseTo(1, 5);
    expect(cloudMass(massive) / THRESHOLDS.matterPerSolarMass).toBeCloseTo(25, 5);
  });

  it('forms a protostar after roughly fifty impulses', () => {
    let state = createInitialState();
    let clicks = 0;
    while (state.stage === 'nebula') { state = reduceGame(state, { type: 'ACCRETE' }); clicks += 1; }
    expect(state.stage).toBe('protostar');
    expect(state.temperature).toBeGreaterThanOrEqual(THRESHOLDS.protostarTemperature);
    expect(clicks).toBeGreaterThanOrEqual(50);
    expect(clicks).toBeLessThanOrEqual(60);
  });

  it('activates deuterium burning without a retroactive temperature jump', () => {
    const state = accreteUntil(createInitialState(), 6_000);
    state.energy = 100;
    const before = state.temperature;
    const upgraded = reduceGame(state, { type: 'BUY_DEUTERIUM' });
    expect(upgraded.upgrades.deuteriumBurning).toBe(true);
    expect(upgraded.temperature).toBeCloseTo(before, 5);
    const normalNext = reduceGame(state, { type: 'ACCRETE' });
    const upgradedNext = reduceGame(upgraded, { type: 'ACCRETE' });
    expect(upgradedNext.temperature - upgraded.temperature).toBeGreaterThan(normalNext.temperature - state.temperature);
  });

  it('ends the 0.07 solar-mass cloud as a rewarded brown dwarf', () => {
    const state = accreteUntil(createInitialState(), CLOUD_TIERS[0].matter.hydrogen + CLOUD_TIERS[0].matter.deuterium);
    expect(state.completed).toBe(true);
    expect(state.outcome).toBe('brownDwarf');
    expect(state.stardust).toBe(2);
    expect(state.unlockedReactions).not.toContain('hydrogen');
  });

  it('unlocks hydrogen from temperature and mass rather than cloud tier', () => {
    const state = accreteUntil(createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 }), THRESHOLDS.hydrogenIgnitionMass);
    expect(state.unlockedReactions).toContain('hydrogen');
    expect(state.temperature).toBeGreaterThanOrEqual(THRESHOLDS.hydrogenTemperature);
  });

  it('keeps hydrogen burning available after the main-sequence milestone', () => {
    let state = reactionState('hydrogen', 20_000);
    state.stage = 'hydrogen';
    state.fusedHydrogen = THRESHOLDS.mainSequenceHydrogen - 50;
    state.reactionTotals.hydrogen = state.fusedHydrogen;
    state = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(state.stage).toBe('mainSequence');
    const remaining = state.star.hydrogen;
    state = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(state.star.hydrogen).toBeLessThan(remaining);
    expect(state.reactionTotals.hydrogen).toBeGreaterThan(THRESHOLDS.mainSequenceHydrogen);
  });

  it('allows a final reaction with less fuel than the normal batch', () => {
    const state = reactionState('hydrogen', 37);
    expect(reactionCapacity(state, 'hydrogen')).toBe(37);
    const fused = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(fused.star.hydrogen).toBeCloseTo(0, 5);
    expect(fused.reactionTotals.hydrogen).toBeCloseTo(37, 5);
  });

  it.each(REACTION_ORDER)('executes the centrally configured %s reaction', (reaction) => {
    const state = reactionState(reaction);
    const definition = REACTIONS[reaction];
    const output = Object.keys(definition.outputs)[0] as keyof typeof state.star;
    const before = state.star[output];
    const next = reduceGame(state, { type: 'RUN_REACTION', reaction });
    expect(next.reactionTotals[reaction]).toBeGreaterThan(0);
    expect(next.star[output]).toBeGreaterThan(before);
    expect(next.energy).toBeGreaterThan(0);
  });

  it('creates a helium white dwarf below half a solar mass after hydrogen exhaustion', () => {
    const state = reactionState('hydrogen', 0);
    state.star = { ...EMPTY_MATTER, helium: 60_000 };
    state.cloud = { ...EMPTY_MATTER };
    const result = tick(state, 0);
    expect(solarMasses(result)).toBeLessThan(.5);
    expect(result.outcome).toBe('heliumWhiteDwarf');
    expect(result.stardust).toBe(4);
  });

  it('contracts a sufficiently massive hydrogen-exhausted star to helium ignition', () => {
    const state = reactionState('hydrogen', 0);
    state.star = { ...EMPTY_MATTER, helium: 150_000 };
    state.cloud = { ...EMPTY_MATTER };
    const giant = tick(state, 1);
    expect(['redGiant', 'helium']).toContain(giant.stage);
    const ignited = tick(giant, 100);
    expect(ignited.unlockedReactions).toContain('helium');
    expect(ignited.unlockedReactions).toContain('alphaCapture');
    expect(ignited.temperature).toBeGreaterThanOrEqual(THRESHOLDS.heliumTemperature);
  });

  it('leaves a carbon-oxygen white dwarf when helium ends below eight solar masses', () => {
    const state = reactionState('helium', 0);
    state.unlockedReactions.push('alphaCapture');
    state.star = { ...EMPTY_MATTER, carbon: 90_000, oxygen: 60_000 };
    const result = tick(state, 0);
    expect(result.outcome).toBe('whiteDwarf');
  });

  it('contracts an eight-solar-mass core into carbon burning', () => {
    const state = reactionState('helium', 0);
    state.unlockedReactions.push('alphaCapture');
    state.star = { ...EMPTY_MATTER, carbon: 1_250_000 };
    state.temperature = THRESHOLDS.heliumTemperature;
    const result = tick(state, 100);
    expect(result.unlockedReactions).toContain('carbon');
    expect(result.temperature).toBeGreaterThanOrEqual(THRESHOLDS.carbonTemperature);
  });

  it('uses final mass to choose the compact remnant after silicon burning', () => {
    const finish = (mass: number) => {
      const state = reactionState('silicon', 40);
      state.star.iron = mass - 40;
      return reduceGame(state, { type: 'RUN_REACTION', reaction: 'silicon' });
    };
    expect(finish(2_000_000).outcome).toBe('neutronStar');
    expect(finish(3_200_000).outcome).toBe('blackHole');
  });

  it('unlocks reaction automation from the matching reaction output', () => {
    let state = reactionState('hydrogen', 10_000);
    state.energy = 10_000;
    state.reactionTotals.hydrogen = 5_100;
    state = reduceGame(state, { type: 'BUY_REACTION_AUTOMATION', reaction: 'hydrogen' });
    expect(state.automation.fusion).toBe(1);
    const automatic = tick(state, 1);
    expect(automatic.automaticReactionTotals.hydrogen).toBeGreaterThan(0);
  });

  it('starts stellar wind at the protostar and removes 0.25 percent per minute', () => {
    const protostar = accreteUntil(createInitialState(), THRESHOLDS.protostarMass);
    const before = cloudMass(protostar);
    const after = tick(protostar, 60);
    expect(after.stats.matterLostToWind).toBeCloseTo(cloudMass(createInitialState()) * .0025, 5);
    expect(cloudMass(after)).toBeCloseTo(before - after.stats.matterLostToWind, 5);
  });

  it('stops accretion heating with an empty cloud but still permits fusion heating', () => {
    const state = reactionState('hydrogen', 60_000);
    state.automation.accretion = 8;
    state.temperature = calculateTemperature(state);
    const passive = tick(state, 10);
    expect(passive.stats.automaticMatterAccreted).toBe(0);
    expect(passive.temperature).toBeLessThanOrEqual(state.temperature);
    const fused = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(fused.temperature).toBeGreaterThan(state.temperature);
  });

  it('scales mature accretion with larger calibrated clouds', () => {
    const small = createInitialState();
    const massive = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
    massive.unlockedReactions.push('hydrogen');
    expect(accretionPerClick(massive)).toBeGreaterThan(accretionPerClick(small) * 100);
  });

  it('starts every cloud with the protostar objective and caps offline time', () => {
    const state = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
    expect(objectiveFor(state).id).toBe('form-protostar');
    expect(tick(state, 24 * 60 * 60).elapsed).toBe(8 * 60 * 60);
  });

  it('archives the calibrated outcome and persistent settings during prestige', () => {
    const state = accreteUntil(createInitialState(), cloudMass(createInitialState()));
    state.volume = .62;
    state.soundEnabled = false;
    const next = reduceGame(state, { type: 'PRESTIGE' });
    expect(next.run).toBe(2);
    expect(next.history[0]).toMatchObject({ outcome: 'brownDwarf', cloudTier: 0 });
    expect(next.volume).toBe(.62);
    expect(next.soundEnabled).toBe(false);
  });
});
