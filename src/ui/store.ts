import { loadGame } from '../game/storage';
import type { GameState } from '../game/types';

export type Panel = 'reactions' | 'upgrades' | 'automation' | 'perks';

// Beschriftung der Kontrollbereiche an einer Stelle: Sie steht auf dem
// Desktop-Reiter, im mobilen Dock und als Titel des Dock-Popups.
export const PANEL_LABELS: Record<Panel, string> = {
  reactions: 'Fusionen',
  upgrades: 'Upgrades',
  automation: 'Automationen',
  perks: 'Perks',
};

export const PANEL_ORDER = ['reactions', 'upgrades', 'automation', 'perks'] as const satisfies readonly Panel[];

// Auf kleinen Bildschirmen entfällt das Kontrollzentrum vollständig; seine
// Bereiche erreicht man stattdessen über das Dock am unteren Rand, das sie in
// einem Popup öffnet. Weil dabei nicht nur die Optik wechselt, sondern die
// Kachelliste in einen anderen Container umzieht, entscheidet diese Abfrage
// bereits beim Aufbau der Shell — und nicht erst das Stylesheet —, welche
// Fassung überhaupt im DOM steht. So bleibt `[data-ui="deck-content"]`
// eindeutig, und alle In-place-Updates treffen weiterhin genau ein Element.
// Die Grenze ist dieselbe wie im Stylesheet.
const mobileLayoutQuery = window.matchMedia('(max-width: 780px)');
export const isMobileLayout = (): boolean => mobileLayoutQuery.matches;
export const onLayoutChange = (listener: () => void): void => {
  mobileLayoutQuery.addEventListener('change', listener);
};

export const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root missing');

export const loaded = loadGame();
let state: GameState = loaded.state;
let activePanel: Panel = 'reactions';

export const getState = (): GameState => state;
export const setState = (next: GameState): void => { state = next; };
export const getActivePanel = (): Panel => activePanel;
export const setActivePanel = (panel: Panel): void => { activePanel = panel; };
