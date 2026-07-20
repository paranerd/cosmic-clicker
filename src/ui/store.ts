import { loadGame } from '../game/storage';
import type { GameState } from '../game/types';

export type Panel = 'reactions' | 'upgrades' | 'automation';

export const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root missing');

export const loaded = loadGame();
let state: GameState = loaded.state;
let activePanel: Panel = 'reactions';

export const getState = (): GameState => state;
export const setState = (next: GameState): void => { state = next; };
export const getActivePanel = (): Panel => activePanel;
export const setActivePanel = (panel: Panel): void => { activePanel = panel; };
