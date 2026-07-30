import { loadGame } from '../game/storage';
import type { GameState } from '../game/types';

// Perks stehen bewusst NICHT mehr als Kontrollbereich hier: Sie sind nichts,
// was im laufenden Zyklus gekauft wird (das passiert ausschließlich in der
// Zyklus-Zusammenfassung), sondern eine reine Statusanzeige. Sie leben deshalb
// im Effekte-Popover unten rechts in der Sternenkammer (siehe ui/sync.ts,
// effectsCornerMarkup) statt in Dock und Reitern.
export type Panel = 'reactions' | 'upgrades' | 'automation';

// Beschriftung der Kontrollbereiche an einer Stelle: Sie steht auf dem
// Desktop-Reiter, im mobilen Dock und als Titel des Dock-Popups.
export const PANEL_LABELS: Record<Panel, string> = {
  reactions: 'Fusionen',
  upgrades: 'Upgrades',
  automation: 'Automationen',
};

export const PANEL_ORDER = ['reactions', 'upgrades', 'automation'] as const satisfies readonly Panel[];

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
