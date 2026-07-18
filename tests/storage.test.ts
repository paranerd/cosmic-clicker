import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../src/game/config';
import { createInitialState } from '../src/game/engine';
import { loadGame, normalizeGameState, saveGame } from '../src/game/storage';

const SAVE_KEY = 'cosmic-clicker-save-v1';

describe('save storage and migration', () => {
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
    const legacy = { ...current, version: 1, energy: 321, run: 4 } as Record<string, unknown>;
    delete legacy.stats;
    delete legacy.history;
    delete legacy.tutorial;
    delete legacy.volume;

    const migrated = normalizeGameState(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({ version: 2, energy: 321, run: 4, volume: .35 });
    expect(migrated?.tutorial.completed).toBe(true);
    expect(migrated?.stats.manualClicks).toBe(0);
  });

  it('persists v2 settings and statistics', () => {
    const state = createInitialState();
    state.volume = .71;
    state.tutorial.completed = true;
    state.stats.manualClicks = 12;
    saveGame(state);

    const loaded = loadGame().state;
    expect(loaded.version).toBe(2);
    expect(loaded.volume).toBe(.71);
    expect(loaded.tutorial.completed).toBe(true);
    expect(loaded.stats.manualClicks).toBe(12);
  });

  it('caps and records offline progress at eight hours', () => {
    const state = createInitialState();
    state.tutorial.completed = true;
    state.automation.accretion = 1;
    state.lastTick = Date.now() - 24 * 60 * 60 * 1_000;
    values.set(SAVE_KEY, JSON.stringify(state));

    const loaded = loadGame();
    expect(loaded.offlineSeconds).toBe(LIMITS.offlineSeconds);
    expect(loaded.state.stats.offlineSeconds).toBe(LIMITS.offlineSeconds);
    expect(loaded.state.stats.automaticMatterAccreted).toBeGreaterThan(0);
  });

  it('falls back safely when a save is malformed', () => {
    values.set(SAVE_KEY, '{not-json');
    const loaded = loadGame();
    expect(loaded.state.version).toBe(2);
    expect(loaded.state.run).toBe(1);
    expect(loaded.offlineSeconds).toBe(0);
  });
});
