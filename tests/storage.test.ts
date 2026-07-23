import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../src/content';
import { compressionHeat, createInitialState } from '../src/game/engine';
import { loadGame, normalizeGameState, saveGame } from '../src/game/storage';

const SAVE_KEY = 'cosmic-clicker-save-v1';

describe('save storage and version 7 migration', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('migrates a v1 save without losing stellar progress', () => {
    const current = createInitialState();
    const legacy = { ...current, version: 1, energy: 321, run: 4, fusedHydrogen: 4_800 } as Record<string, unknown>;
    delete legacy.stats;
    delete legacy.history;
    delete legacy.tutorial;
    delete legacy.volume;
    delete legacy.cloudTier;
    delete legacy.nextCloudTier;
    delete legacy.discoveredOutcomes;
    delete legacy.outcome;
    delete legacy.fusedHelium;

    const migrated = normalizeGameState(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({ version: 7, energy: 321, run: 4, volume: .35 });
    expect(migrated?.tutorial.completed).toBe(true);
    expect(migrated?.tutorial.introSeen).toBe(true);
    expect(migrated?.stats.manualClicks).toBe(0);
    expect(migrated?.stats.hydrogenFused).toBe(4_800);
    expect(migrated?.star.carbon).toBe(0);
    expect(migrated?.perks.fusionMemory).toBe(0);
    expect(migrated?.automation.heliumFusion).toBe(0);
    expect(migrated?.automation.oxygenSynthesis).toBe(0);
  });

  it('maps a completed v3 main-sequence save to a legacy outcome', () => {
    const current = createInitialState({ largerCloud: 1 }, 3, 2, { cloudTier: 1 });
    const legacy = { ...current, version: 3, stage: 'stable', completed: true };
    delete (legacy as Partial<typeof legacy>).outcome;
    const migrated = normalizeGameState(legacy);
    expect(migrated).toMatchObject({ version: 7, completed: true, stage: 'mainSequence', outcome: 'legacyMainSequence' });
    expect(migrated?.discoveredOutcomes).toContain('legacyMainSequence');
  });

  it('persists v4 settings, objectives, discoveries and statistics', () => {
    const state = createInitialState();
    state.volume = .71;
    state.tutorial.completed = true;
    state.tutorial.introSeen = true;
    state.tutorial.cosmosToastPending = false;
    state.stats.manualClicks = 12;
    state.seenObjectives.push('discover-mass-limit');
    state.discoveredOutcomes.push('brownDwarf');
    state.pendingPerks.permanentGravity = 2;
    saveGame(state);

    const loaded = loadGame().state;
    expect(loaded.version).toBe(7);
    expect(loaded.volume).toBe(.71);
    expect(loaded.tutorial.completed).toBe(true);
    expect(loaded.stats.manualClicks).toBe(12);
    expect(loaded.seenObjectives).toContain('discover-mass-limit');
    expect(loaded.discoveredOutcomes).toContain('brownDwarf');
    expect(loaded.pendingPerks.permanentGravity).toBe(2);
  });

  it('migrates an active legacy deuterium upgrade without retroactive heat', () => {
    const legacy = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    legacy.star.hydrogen = 5_000;
    legacy.cloud.hydrogen -= 5_000;
    legacy.upgrades.deuteriumBurning = true;
    const rawCompression = compressionHeat(legacy);
    const migrated = normalizeGameState({ ...legacy, version: 4, deuteriumIgnitionCompression: undefined });

    expect(migrated?.deuteriumIgnitionCompression).toBeCloseTo(rawCompression);
  });

  it('reconstructs cycle and runtime timestamps for legacy log entries', () => {
    const current = createInitialState();
    const startedAt = Date.now() - 60_000;
    const legacyLog = [{ id: startedAt + 12_500, text: 'Alter Meilenstein', kind: 'discovery' as const }];
    const legacy = { ...current, version: 5, run: 3, startedAt, elapsed: 60, log: legacyLog } as Record<string, unknown>;
    delete legacy.totalElapsed;
    const migrated = normalizeGameState(legacy);

    expect(migrated?.log[0]).toMatchObject({ run: 3, elapsed: 12.5, totalElapsed: 12.5, text: 'Alter Meilenstein' });
    expect(migrated?.totalElapsed).toBe(60);
  });

  it('caps and records offline progress at eight hours', () => {
    const state = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    state.tutorial.introSeen = true;
    state.tutorial.completed = true;
    state.automation.accretion = 1;
    state.lastTick = Date.now() - 24 * 60 * 60 * 1_000;
    values.set(SAVE_KEY, JSON.stringify(state));

    const loaded = loadGame();
    expect(loaded.offlineSeconds).toBe(LIMITS.offlineSeconds);
    expect(loaded.state.stats.offlineSeconds).toBe(LIMITS.offlineSeconds);
    expect(loaded.state.stats.automaticMatterAccreted).toBeGreaterThan(0);
  });

  it('pauses offline time until the intro has been decided', () => {
    const state = createInitialState();
    state.lastTick = Date.now() - 60 * 60 * 1_000;
    values.set(SAVE_KEY, JSON.stringify(state));

    const loaded = loadGame();
    expect(loaded.offlineSeconds).toBe(0);
    expect(loaded.state.elapsed).toBe(0);
  });

  it('falls back safely when a save is malformed', () => {
    values.set(SAVE_KEY, '{not-json');
    const loaded = loadGame();
    expect(loaded.state.version).toBe(7);
    expect(loaded.state.run).toBe(1);
    expect(loaded.state.cloudTier).toBe(0);
    expect(loaded.offlineSeconds).toBe(0);
  });
});
