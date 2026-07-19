import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../src/game/config';
import { accretionPerClick, cloudMass, createInitialState, reduceGame, starMass, tick } from '../src/game/engine';

describe('stellar engine', () => {
  it('conserves matter during accretion', () => {
    const state = createInitialState();
    const totalBefore = cloudMass(state) + starMass(state);
    const next = reduceGame(state, { type: 'ACCRETE' });
    expect(starMass(next)).toBeCloseTo(accretionPerClick(state), 5);
    expect(cloudMass(next) + starMass(next)).toBeCloseTo(totalBefore, 5);
  });

  it('starts the first cycle with a pure hydrogen cloud and enriches later cycles', () => {
    const first = createInitialState();
    const second = createInitialState({ largerCloud: 0, permanentGravity: 0 }, 0, 2);
    expect(first.cloud).toEqual({ hydrogen: 100_000, helium: 0, deuterium: 0 });
    expect(second.cloud.helium).toBeGreaterThan(0);
    expect(second.cloud.deuterium).toBeGreaterThan(0);
  });

  it('unlocks the protostar after sufficient mass is collected', () => {
    let state = createInitialState();
    for (let index = 0; index < 14; index += 1) state = reduceGame(state, { type: 'ACCRETE' });
    expect(starMass(state)).toBeGreaterThan(THRESHOLDS.protostarMass);
    expect(state.stage).toBe('protostar');
  });

  it('does not fuse hydrogen below ignition temperature', () => {
    const state = createInitialState();
    state.star.hydrogen = 1_000;
    const next = reduceGame(state, { type: 'FUSE_HYDROGEN' });
    expect(next.star.hydrogen).toBe(1_000);
    expect(next.manualFusions).toBe(0);
  });

  it('activates deuterium burning once and accelerates heating only toward hydrogen ignition', () => {
    let state = createInitialState();
    state.star.hydrogen = 8_000;
    state.cloud.hydrogen -= 8_000;
    state.energy = 100;
    state = tick(state, 0);
    const normalTemperature = state.temperature;

    const upgraded = reduceGame(state, { type: 'BUY_DEUTERIUM' });
    expect(upgraded.upgrades.deuteriumBurning).toBe(true);
    expect(upgraded.energy).toBe(25);
    expect(upgraded.temperature).toBeGreaterThan(normalTemperature);
    expect(upgraded.temperature).toBeLessThanOrEqual(THRESHOLDS.hydrogenTemperature);

    const repeated = reduceGame(upgraded, { type: 'BUY_DEUTERIUM' });
    expect(repeated.energy).toBe(upgraded.energy);
  });

  it('applies permanent cloud perks to a new run', () => {
    const state = createInitialState({ largerCloud: 2, permanentGravity: 1 }, 3, 4);
    expect(cloudMass(state)).toBeCloseTo(150_000, 4);
    expect(state.run).toBe(4);
  });

  it('caps long offline simulation at eight hours', () => {
    const state = createInitialState();
    state.automation.accretion = 1;
    const next = tick(state, 24 * 60 * 60);
    expect(next.elapsed).toBe(8 * 60 * 60);
  });

  it('can complete a full first stellar cycle', () => {
    let state = createInitialState();
    let actions = 0;
    while (!state.completed && actions < 2_000) {
      state = state.temperature < THRESHOLDS.hydrogenTemperature
        ? reduceGame(state, { type: 'ACCRETE' })
        : reduceGame(state, { type: 'FUSE_HYDROGEN' });
      actions += 1;
    }
    expect(state.stage).toBe('stable');
    expect(state.summaryOpen).toBe(true);
    expect(state.stardust).toBeGreaterThanOrEqual(2);
    expect(state.stats.manualClicks).toBeGreaterThan(0);
    expect(state.stats.manualFusionActions).toBeGreaterThan(0);
  });

  it('targets a ten to fifteen minute active first run at a deliberate cadence', () => {
    let state = createInitialState();
    let actions = 0;
    while (!state.completed && actions < 2_000) {
      state = state.temperature < THRESHOLDS.hydrogenTemperature
        ? reduceGame(state, { type: 'ACCRETE' })
        : reduceGame(state, { type: 'FUSE_HYDROGEN' });
      actions += 1;
    }
    const projectedSeconds = actions * 2;
    expect(projectedSeconds).toBeGreaterThanOrEqual(10 * 60);
    expect(projectedSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('archives round statistics and persistent settings during prestige', () => {
    const state = createInitialState();
    state.completed = true;
    state.stardust = 3;
    state.elapsed = 720;
    state.stats.manualClicks = 280;
    state.stats.stardustEarned = 3;
    state.volume = .62;
    state.soundEnabled = false;
    state.tutorial.completed = true;
    state.tutorial.introSeen = true;
    state.star.hydrogen = 30_000;

    const next = reduceGame(state, { type: 'PRESTIGE' });
    expect(next.run).toBe(2);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({ run: 1, duration: 720, manualClicks: 280, stardustEarned: 3 });
    expect(next.volume).toBe(.62);
    expect(next.soundEnabled).toBe(false);
    expect(next.tutorial.completed).toBe(true);
    expect(next.tutorial.introSeen).toBe(true);
    expect(next.seenObjectives).toEqual([]);
  });
});
