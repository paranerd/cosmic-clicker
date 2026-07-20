import { describe, expect, it } from 'vitest';
import { CLOUD_TIERS, FUSION_AUTOMATION_HELIUM, HYDROGEN_TO_HELIUM_RATIO, INITIAL_TEMPERATURE, THRESHOLDS } from '../src/game/config';
import { accretionPerClick, cloudMass, createInitialState, objectiveFor, reduceGame, starMass, tick } from '../src/game/engine';
import type { GameState } from '../src/game/types';

const accreteUntil = (initial: GameState, targetMass: number, guardLimit = 2_000): GameState => {
  let state = initial;
  let guard = 0;
  while (!state.completed && starMass(state) < targetMass && guard < guardLimit) {
    state = reduceGame(state, { type: 'ACCRETE' });
    guard += 1;
  }
  return state;
};

const reachMainSequence = (initial: GameState, targetMass = 40_000): GameState => {
  let state = accreteUntil(initial, targetMass);
  let guard = 0;
  while (state.stage === 'hydrogen' && guard < 1_000) {
    state = reduceGame(state, { type: 'FUSE_HYDROGEN' });
    guard += 1;
  }
  return state;
};

const reachCarbonOxygenCore = (initial: GameState, targetMass = 45_000): GameState => {
  let state = reachMainSequence(initial, targetMass);
  state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
  state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
  let guard = 0;
  while (state.stage === 'helium' && guard < 1_000) {
    state = reduceGame(state, { type: 'FUSE_HELIUM' });
    guard += 1;
  }
  while (state.stage === 'carbonOxygen' && state.stats.oxygenCreated < THRESHOLDS.oxygenCore && guard < 2_000) {
    state = reduceGame(state, { type: 'CREATE_OXYGEN' });
    guard += 1;
  }
  return state;
};

const completeMassiveStar = (targetMass: number): GameState => {
  let state = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
  state = reachCarbonOxygenCore(accreteUntil(state, targetMass, 4_000), targetMass);
  state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
  state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
  state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
  return state;
};

describe('stellar engine v0.3', () => {
  it('starts every new cloud at ten kelvin', () => {
    expect(createInitialState().temperature).toBe(INITIAL_TEMPERATURE);
    expect(INITIAL_TEMPERATURE).toBe(10);
  });

  it('starts every cloud with the objective of forming a protostar', () => {
    const small = createInitialState();
    const stellar = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    expect(objectiveFor(small)).toMatchObject({ id: 'form-protostar', title: 'Protostern bilden' });
    expect(objectiveFor(stellar)).toMatchObject({ id: 'form-protostar', title: 'Protostern bilden' });
  });

  it('derives ignition and failed ignition from stellar conditions instead of the cloud tier', () => {
    const small = createInitialState();
    small.star.hydrogen = 3_000;
    small.cloud.hydrogen -= 3_000;
    small.heatBonus = THRESHOLDS.hydrogenTemperature;
    expect(tick(small, 0).stage).toBe('hydrogen');

    const stellar = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    stellar.stage = 'protostar';
    stellar.cloud = { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 };
    stellar.star = { hydrogen: THRESHOLDS.protostarMass, helium: 0, deuterium: 0, carbon: 0, oxygen: 0 };
    const exhausted = tick(stellar, 0);
    expect(exhausted.completed).toBe(true);
    expect(exhausted.outcome).toBe('brownDwarf');
  });

  it('conserves matter during accretion', () => {
    const state = createInitialState();
    const totalBefore = cloudMass(state) + starMass(state);
    const next = reduceGame(state, { type: 'ACCRETE' });
    expect(starMass(next)).toBeCloseTo(accretionPerClick(state), 5);
    expect(cloudMass(next) + starMass(next)).toBeCloseTo(totalBefore, 5);
  });

  it('starts all new games with the same small hydrogen cloud and implicit deuterium', () => {
    const state = createInitialState();
    expect(state.cloudTier).toBe(0);
    expect(state.cloud).toEqual(CLOUD_TIERS[0].matter);
    expect(state.cloud.hydrogen).toBe(12_000);
    expect(state.cloud.helium).toBe(0);
    expect(state.cloud.deuterium).toBeGreaterThan(0);
  });

  it('ends the first cycle as a rewarded brown dwarf and unlocks the stellar cloud', () => {
    let state = accreteUntil(createInitialState(), CLOUD_TIERS[0].matter.hydrogen);
    expect(state.completed).toBe(true);
    expect(state.stage).toBe('brownDwarf');
    expect(state.outcome).toBe('brownDwarf');
    expect(state.stardust).toBe(2);
    expect(state.temperature).toBeLessThan(THRESHOLDS.hydrogenTemperature);

    state = reduceGame(state, { type: 'BUY_PERK', perk: 'largerCloud' });
    expect(state.perks.largerCloud).toBe(0);
    expect(state.pendingPerks.largerCloud).toBe(1);
    expect(state.nextCloudTier).toBe(1);
    expect(state.stardust).toBe(0);

    const next = reduceGame(state, { type: 'PRESTIGE' });
    expect(next.run).toBe(2);
    expect(next.perks.largerCloud).toBe(1);
    expect(next.pendingPerks.largerCloud).toBe(0);
    expect(next.cloudTier).toBe(1);
    expect(next.cloud).toEqual(CLOUD_TIERS[1].matter);
    expect(next.history[0]).toMatchObject({ outcome: 'brownDwarf', cloudTier: 0 });
  });

  it('allows a closed cycle summary to be opened again', () => {
    let state = accreteUntil(createInitialState(), CLOUD_TIERS[0].matter.hydrogen);
    state = reduceGame(state, { type: 'CLOSE_SUMMARY' });
    expect(state.summaryOpen).toBe(false);
    state = reduceGame(state, { type: 'OPEN_SUMMARY' });
    expect(state.summaryOpen).toBe(true);
  });

  it('stages multiple affordable perk levels and refunds deselected levels', () => {
    let state = accreteUntil(createInitialState(), CLOUD_TIERS[0].matter.hydrogen);
    state.stardust = 7;
    state = reduceGame(state, { type: 'BUY_PERK', perk: 'largerCloud' });
    state = reduceGame(state, { type: 'BUY_PERK', perk: 'largerCloud' });
    expect(state.pendingPerks.largerCloud).toBe(2);
    expect(state.perks.largerCloud).toBe(0);
    expect(state.stardust).toBe(0);
    expect(state.nextCloudTier).toBe(2);

    state = reduceGame(state, { type: 'REMOVE_PERK', perk: 'largerCloud' });
    expect(state.pendingPerks.largerCloud).toBe(1);
    expect(state.stardust).toBe(5);
    expect(state.nextCloudTier).toBe(1);

    state = reduceGame(state, { type: 'PRESTIGE' });
    expect(state.perks.largerCloud).toBe(1);
    expect(state.pendingPerks.largerCloud).toBe(0);
  });

  it('takes roughly fifty clicks to form a protostar and seven to ten projected minutes for the first cycle', () => {
    let protostar = createInitialState();
    let protostarActions = 0;
    while (protostar.stage === 'nebula' && protostarActions < 1_000) {
      protostar = reduceGame(protostar, { type: 'ACCRETE' });
      protostarActions += 1;
    }
    expect(protostar.stage).toBe('protostar');
    expect(protostarActions).toBeGreaterThanOrEqual(50);
    expect(protostarActions).toBeLessThanOrEqual(60);

    let state = createInitialState();
    let actions = 0;
    while (!state.completed && actions < 1_000) {
      state = reduceGame(state, { type: 'ACCRETE' });
      actions += 1;
    }
    const projectedSeconds = actions * 2;
    expect(projectedSeconds).toBeGreaterThanOrEqual(7 * 60);
    expect(projectedSeconds).toBeLessThanOrEqual(10 * 60);
  });

  it('allows deuterium burning in the first cycle once the protostar exceeds one million kelvin', () => {
    let state = createInitialState();
    state = accreteUntil(state, 8_000);
    state.energy = 100;
    const normalTemperature = state.temperature;
    const upgraded = reduceGame(state, { type: 'BUY_DEUTERIUM' });
    expect(upgraded.star.deuterium).toBeGreaterThan(0);
    expect(upgraded.upgrades.deuteriumBurning).toBe(true);
    expect(upgraded.energy).toBe(25);
    expect(upgraded.temperature).toBeGreaterThan(normalTemperature);
    expect(upgraded.temperature).toBeLessThan(THRESHOLDS.hydrogenTemperature);
  });

  it('unlocks stable hydrogen burning only after five thousand helium was created by fusion', () => {
    let state = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    state = accreteUntil(state, 40_000);
    state.energy = 10_000;
    while (state.stats.hydrogenFused * HYDROGEN_TO_HELIUM_RATIO < FUSION_AUTOMATION_HELIUM) {
      const beforeThreshold = state.stats.hydrogenFused * HYDROGEN_TO_HELIUM_RATIO < FUSION_AUTOMATION_HELIUM;
      if (beforeThreshold) {
        const attempted = reduceGame(state, { type: 'BUY_FUSION' });
        expect(attempted.automation.fusion).toBe(0);
      }
      state = reduceGame(state, { type: 'FUSE_HYDROGEN' });
    }
    state = reduceGame(state, { type: 'BUY_FUSION' });
    expect(state.automation.fusion).toBe(1);
  });

  it('forms carbon and oxygen before ending a stellar cloud as a white dwarf', () => {
    let state = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    state = reachCarbonOxygenCore(state);
    expect(state.stage).toBe('carbonOxygen');
    expect(state.star.carbon).toBeGreaterThan(0);
    expect(state.star.oxygen).toBeGreaterThanOrEqual(THRESHOLDS.oxygenCore);
    state = reduceGame(state, { type: 'ADVANCE_EVOLUTION' });
    expect(state.completed).toBe(true);
    expect(state.outcome).toBe('whiteDwarf');
    expect(state.stardust).toBe(5);
  });

  it('uses final mass to choose the compact remnant after a supernova', () => {
    const neutronStar = completeMassiveStar(80_000);
    expect(neutronStar.completed).toBe(true);
    expect(neutronStar.outcome).toBe('neutronStar');
    expect(neutronStar.discoveredOutcomes).toContain('neutronStar');

    const blackHole = completeMassiveStar(115_000);
    expect(blackHole.completed).toBe(true);
    expect(blackHole.outcome).toBe('blackHole');
    expect(blackHole.discoveredOutcomes).toContain('blackHole');
  });

  it('applies permanent accretion and fusion perks', () => {
    const base = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    const enhanced = createInitialState({ largerCloud: 1, permanentGravity: 2, fusionMemory: 2 }, 0, 2, { cloudTier: 1 });
    expect(accretionPerClick(enhanced)).toBeGreaterThan(accretionPerClick(base));
    enhanced.star.hydrogen = 40_000;
    enhanced.stage = 'hydrogen';
    enhanced.temperature = THRESHOLDS.hydrogenTemperature;
    const fused = reduceGame(enhanced, { type: 'FUSE_HYDROGEN' });
    expect(fused.stats.hydrogenFused).toBeGreaterThan(200);
  });

  it('caps long offline simulation at eight hours', () => {
    const state = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    state.automation.accretion = 1;
    const next = tick(state, 24 * 60 * 60);
    expect(next.elapsed).toBe(8 * 60 * 60);
  });

  it('archives outcome, cloud tier, statistics and persistent settings during prestige', () => {
    let state = accreteUntil(createInitialState(), CLOUD_TIERS[0].matter.hydrogen);
    state.elapsed = 240;
    state.volume = .62;
    state.soundEnabled = false;
    state.tutorial.completed = true;
    state.tutorial.introSeen = true;
    state.tutorial.cosmosToastPending = false;
    const next = reduceGame(state, { type: 'PRESTIGE' });
    expect(next.run).toBe(2);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({ run: 1, duration: 240, outcome: 'brownDwarf', cloudTier: 0 });
    expect(next.volume).toBe(.62);
    expect(next.soundEnabled).toBe(false);
    expect(next.tutorial.completed).toBe(true);
  });
});
