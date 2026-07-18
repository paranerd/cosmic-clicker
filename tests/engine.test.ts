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
  });
});
