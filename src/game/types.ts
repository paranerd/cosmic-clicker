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
  deuteriumBurning: boolean;
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

export interface RunStatistics {
  manualClicks: number;
  deuteriumBurns: number;
  manualFusionActions: number;
  matterAccreted: number;
  automaticMatterAccreted: number;
  hydrogenFused: number;
  automaticHydrogenFused: number;
  energyGenerated: number;
  upgradesPurchased: number;
  automationsPurchased: number;
  offlineSeconds: number;
  stardustEarned: number;
}

export interface RoundRecord extends RunStatistics {
  run: number;
  duration: number;
  finalMass: number;
}

export interface TutorialState {
  introSeen: boolean;
  cosmosToastPending: boolean;
  completed: boolean;
  step: number;
}

export interface GameState {
  version: 3;
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
  volume: number;
  tutorial: TutorialState;
  stats: RunStatistics;
  history: RoundRecord[];
  seenOpportunities: string[];
  seenObjectives: string[];
  log: LogEntry[];
}

export type GameAction =
  | { type: 'ACCRETE' }
  | { type: 'FUSE_HYDROGEN' }
  | { type: 'BUY_DEUTERIUM' }
  | { type: 'BUY_ACCRETION' }
  | { type: 'BUY_FUSION' }
  | { type: 'BUY_GRAVITY' }
  | { type: 'BUY_PERK'; perk: keyof PerkState }
  | { type: 'PRESTIGE' }
  | { type: 'CLOSE_SUMMARY' }
  | { type: 'ACKNOWLEDGE_OBJECTIVE'; objective: string }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'SET_VOLUME'; volume: number };
