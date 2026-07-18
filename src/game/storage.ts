import { LIMITS } from './config';
import { createInitialState, tick } from './engine';
import type { GameState } from './types';

const SAVE_KEY = 'cosmic-clicker-save-v1';

export const loadGame = (): { state: GameState; offlineSeconds: number } => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: createInitialState(), offlineSeconds: 0 };
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1) return { state: createInitialState(), offlineSeconds: 0 };
    const offlineSeconds = Math.min(LIMITS.offlineSeconds, Math.max(0, (Date.now() - parsed.lastTick) / 1_000));
    return { state: tick(parsed, offlineSeconds), offlineSeconds };
  } catch {
    return { state: createInitialState(), offlineSeconds: 0 };
  }
};

export const saveGame = (state: GameState): void => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastTick: Date.now() }));
};

export const clearSave = (): void => localStorage.removeItem(SAVE_KEY);
