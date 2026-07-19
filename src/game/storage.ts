import { LIMITS } from './config';
import { createInitialState, createRunStatistics, tick } from './engine';
import type { GameState } from './types';

const SAVE_KEY = 'cosmic-clicker-save-v1';

export const normalizeGameState = (value: unknown): GameState | null => {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<Omit<GameState, 'version'>> & { version?: number };
  if ((parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) || !parsed.cloud || !parsed.star) return null;
  const fallback = createInitialState(parsed.perks, parsed.stardust, parsed.run);
  const migratedTutorial = parsed.version === 1
    ? { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }
    : { ...fallback.tutorial, introSeen: Boolean(parsed.tutorial), cosmosToastPending: false };
  return {
    ...fallback,
    ...parsed,
    version: 3,
    cloud: { ...fallback.cloud, ...parsed.cloud },
    star: { ...fallback.star, ...parsed.star },
    automation: { ...fallback.automation, ...parsed.automation },
    upgrades: { ...fallback.upgrades, ...parsed.upgrades },
    perks: { ...fallback.perks, ...parsed.perks },
    tutorial: { ...migratedTutorial, ...parsed.tutorial },
    stats: { ...createRunStatistics(), ...parsed.stats },
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, 20) : [],
    volume: Math.max(0, Math.min(1, typeof parsed.volume === 'number' ? parsed.volume : .35)),
    seenOpportunities: Array.isArray(parsed.seenOpportunities) ? parsed.seenOpportunities : [],
    seenObjectives: Array.isArray(parsed.seenObjectives) ? parsed.seenObjectives : [],
    log: Array.isArray(parsed.log) ? parsed.log : fallback.log,
  };
};

export const loadGame = (): { state: GameState; offlineSeconds: number } => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: createInitialState(), offlineSeconds: 0 };
    const parsed = normalizeGameState(JSON.parse(raw));
    if (!parsed) return { state: createInitialState(), offlineSeconds: 0 };
    if (!parsed.tutorial.introSeen) return { state: { ...parsed, lastTick: Date.now() }, offlineSeconds: 0 };
    const offlineSeconds = Math.min(LIMITS.offlineSeconds, Math.max(0, (Date.now() - parsed.lastTick) / 1_000));
    const state = tick(parsed, offlineSeconds);
    state.stats.offlineSeconds += offlineSeconds;
    return { state, offlineSeconds };
  } catch {
    return { state: createInitialState(), offlineSeconds: 0 };
  }
};

export const saveGame = (state: GameState): void => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastTick: Date.now() }));
};

export const clearSave = (): void => localStorage.removeItem(SAVE_KEY);
