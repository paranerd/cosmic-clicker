export type Stage = 'nebula' | 'protostar' | 'deuterium' | 'hydrogen' | 'stable';

export interface Matter {
  hydrogen: number;
  helium: number;
  deuterium: number;
}

export interface AutomationState {
  accretion: number;
  fusion: number;
}

export interface UpgradeState {
  gravity: number;
}

export interface PerkState {
  largerCloud: number;
  permanentGravity: number;
}

export interface LogEntry {
  id: number;
  text: string;
  kind: 'info' | 'discovery' | 'fusion';
}

export interface GameState {
  version: 1;
  run: number;
  startedAt: number;
  lastTick: number;
  elapsed: number;
  stage: Stage;
  cloud: Matter;
  star: Matter;
  radiatedMass: number;
  energy: number;
  temperature: number;
  heatBonus: number;
  fusedHydrogen: number;
  manualFusions: number;
  automation: AutomationState;
  upgrades: UpgradeState;
  stardust: number;
  perks: PerkState;
  completed: boolean;
  summaryOpen: boolean;
  soundEnabled: boolean;
  log: LogEntry[];
}

export type GameAction =
  | { type: 'ACCRETE' }
  | { type: 'BURN_DEUTERIUM' }
  | { type: 'FUSE_HYDROGEN' }
  | { type: 'BUY_ACCRETION' }
  | { type: 'BUY_FUSION' }
  | { type: 'BUY_GRAVITY' }
  | { type: 'BUY_PERK'; perk: keyof PerkState }
  | { type: 'PRESTIGE' }
  | { type: 'CLOSE_SUMMARY' }
  | { type: 'TOGGLE_SOUND' };
