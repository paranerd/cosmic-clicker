export type CloudTier = 0 | 1 | 2;

export type Stage =
  | 'nebula'
  | 'protostar'
  | 'deuterium'
  | 'hydrogen'
  | 'mainSequence'
  | 'redGiant'
  | 'helium'
  | 'carbonOxygen'
  | 'carbonBurning'
  | 'neonBurning'
  | 'oxygenBurning'
  | 'siliconBurning'
  | 'ironCore'
  | 'massiveStar'
  | 'supernova'
  | 'brownDwarf'
  | 'heliumWhiteDwarf'
  | 'whiteDwarf'
  | 'oxygenNeonWhiteDwarf'
  | 'neutronStar'
  | 'blackHole';

export type StellarOutcome = 'brownDwarf' | 'heliumWhiteDwarf' | 'whiteDwarf' | 'oxygenNeonWhiteDwarf' | 'neutronStar' | 'blackHole' | 'legacyMainSequence';

export type ReactionId = 'hydrogen' | 'helium' | 'alphaCapture' | 'carbon' | 'neon' | 'oxygen' | 'silicon';

export interface Matter {
  hydrogen: number;
  helium: number;
  deuterium: number;
  carbon: number;
  neon: number;
  oxygen: number;
  silicon: number;
  iron: number;
}

export interface AutomationState {
  accretion: number;
  fusion: number;
  heliumFusion: number;
  oxygenSynthesis: number;
  carbonFusion: number;
  neonFusion: number;
  oxygenFusion: number;
  siliconFusion: number;
}

export interface UpgradeState {
  gravity: number;
  deuteriumBurning: boolean;
}

export interface PerkState {
  largerCloud: number;
  permanentGravity: number;
  fusionMemory: number;
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
  manualHeliumActions: number;
  matterAccreted: number;
  automaticMatterAccreted: number;
  matterLostToWind: number;
  hydrogenFused: number;
  automaticHydrogenFused: number;
  heliumFused: number;
  automaticHeliumFused: number;
  oxygenCreated: number;
  automaticOxygenCreated: number;
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
  cloudTier: CloudTier;
  outcome: StellarOutcome;
}

export interface TutorialState {
  introSeen: boolean;
  cosmosToastPending: boolean;
  completed: boolean;
  step: number;
}

export interface GameState {
  version: 5;
  run: number;
  startedAt: number;
  lastTick: number;
  elapsed: number;
  stage: Stage;
  cloudTier: CloudTier;
  nextCloudTier: CloudTier;
  cloud: Matter;
  star: Matter;
  radiatedMass: number;
  energy: number;
  temperature: number;
  heatBonus: number;
  contractionHeat: number;
  deuteriumIgnitionCompression: number | null;
  unlockedReactions: ReactionId[];
  reactionTotals: Record<ReactionId, number>;
  automaticReactionTotals: Record<ReactionId, number>;
  fusedHydrogen: number;
  fusedHelium: number;
  manualFusions: number;
  manualHeliumFusions: number;
  automation: AutomationState;
  upgrades: UpgradeState;
  stardust: number;
  perks: PerkState;
  pendingPerks: PerkState;
  completed: boolean;
  outcome: StellarOutcome | null;
  discoveredOutcomes: StellarOutcome[];
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
  | { type: 'FUSE_HELIUM' }
  | { type: 'CREATE_OXYGEN' }
  | { type: 'RUN_REACTION'; reaction: ReactionId }
  | { type: 'BUY_REACTION_AUTOMATION'; reaction: ReactionId }
  | { type: 'ADVANCE_EVOLUTION' }
  | { type: 'BUY_DEUTERIUM' }
  | { type: 'BUY_ACCRETION' }
  | { type: 'BUY_FUSION' }
  | { type: 'BUY_HELIUM_FUSION' }
  | { type: 'BUY_OXYGEN_SYNTHESIS' }
  | { type: 'BUY_GRAVITY' }
  | { type: 'BUY_PERK'; perk: keyof PerkState }
  | { type: 'REMOVE_PERK'; perk: keyof PerkState }
  | { type: 'SELECT_CLOUD_TIER'; tier: CloudTier }
  | { type: 'PRESTIGE' }
  | { type: 'OPEN_SUMMARY' }
  | { type: 'CLOSE_SUMMARY' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'SET_VOLUME'; volume: number };
