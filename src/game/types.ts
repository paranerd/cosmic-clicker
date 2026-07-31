// Wolkenwachstums-Stufe: keine feste 0|1|2-Stufe mehr, sondern eine offene
// Zahl, die über den Perk "Wolkenwachstum" prozentual weiterwächst.
export type CloudTier = number;

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
  deuteriumBurning: number;
  convection: number;
}

export interface PerkState {
  largerCloud: number;
  permanentGravity: number;
  fusionMemory: number;
}

export interface LogEntry {
  id: number;
  run: number;
  elapsed: number;
  totalElapsed: number;
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
  matterLostToShellWind: number;
  hydrogenFused: number;
  automaticHydrogenFused: number;
  heliumFused: number;
  automaticHeliumFused: number;
  oxygenCreated: number;
  automaticOxygenCreated: number;
  energyGenerated: number;
  peakTemperature: number;
  upgradesPurchased: number;
  automationsPurchased: number;
  offlineSeconds: number;
  stardustEarned: number;
  // Während des Kernkollapses aktiv abgestoßene Hüllenmasse. Sie senkt die
  // Restmasse und erhöht dadurch den Sternenstaub-Ertrag der Supernova.
  envelopeEjected: number;
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
  stepId?: string;
}

export interface GameState {
  version: 8;
  run: number;
  startedAt: number;
  lastTick: number;
  elapsed: number;
  totalElapsed: number;
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
  // Zwei zyklusübergreifende Gedächtnisse, die das Spiel ab dem zweiten
  // Durchlauf idle-fähig machen, ohne die erste Entdeckung zu entwerten:
  //
  // `ignitedReactions` merkt sich jede jemals freigeschaltete Fusion. Eine
  // bereits bekannte Reaktion zündet in späteren Zyklen von selbst, sobald
  // Temperatur und Mindestmasse erreicht sind — die bewusste, kostenlose
  // Freischaltung bleibt also genau einmal je Reaktion erhalten.
  //
  // `experiencedReactions` merkt sich jede jemals manuell ausgelöste Fusion.
  // Sie ersetzt die früheren absoluten Mengenschwellen der Reaktions-
  // automationen: Wer eine Reaktion einmal selbst ausgeführt hat, darf sie ab
  // sofort und in jedem weiteren Zyklus automatisieren. Vorher konnte eine
  // Kette dauerhaft blockieren, weil die Automation ihr eigenes Produkt als
  // Freischaltbedingung verlangte und dieses Produkt ohne Automation nur
  // durch Klicks entstand.
  ignitedReactions: ReactionId[];
  experiencedReactions: ReactionId[];
  reactionTotals: Record<ReactionId, number>;
  automaticReactionTotals: Record<ReactionId, number>;
  // Punkt 2: Ausbaustufen der manuellen Fusionsmenge je Reaktion.
  reactionUpgrades: Record<ReactionId, number>;
  // Ausgewählte Fusion (Fusionsring unter dem Stern). Solange sie gesetzt ist,
  // führt ein Klick auf den Stern diese Reaktion aus statt zu akkretieren;
  // `null` bedeutet Akkretion. Die Auswahl bleibt bestehen, bis sie über
  // denselben Ringbutton wieder abgewählt oder gewechselt wird — auch dann,
  // wenn der Brennstoff der Reaktion vorübergehend erschöpft ist (der Stern
  // ist dann nicht klickbar, siehe ui/sync.ts).
  activeReaction: ReactionId | null;
  fusedHydrogen: number;
  fusedHelium: number;
  manualFusions: number;
  manualHeliumFusions: number;
  automation: AutomationState;
  upgrades: UpgradeState;
  stardust: number;
  perks: PerkState;
  pendingPerks: PerkState;
  // Kernkollaps: Sekunden, die der Stern bereits im Stadium `supernova` steht.
  // Die Phase läuft von selbst ab (idle-sicher); Sternklicks stoßen zusätzlich
  // Hülle ab und verschieben dadurch die Restmasse und damit den Sternrest.
  collapseElapsed: number;
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
  // Sternklick während des Kernkollapses: stößt Hülle ab. Optional, die Phase
  // läuft auch ohne Zutun vollständig durch.
  | { type: 'EJECT_ENVELOPE' }
  | { type: 'RUN_REACTION'; reaction: ReactionId }
  | { type: 'SET_ACTIVE_REACTION'; reaction: ReactionId | null }
  // Kostenlose Freischaltung einer Fusion, sobald Temperatur und Mindestmasse
  // erreicht sind (siehe reactionUnlockable in game/engine.ts).
  | { type: 'UNLOCK_REACTION'; reaction: ReactionId }
  | { type: 'BUY_REACTION_AUTOMATION'; reaction: ReactionId }
  | { type: 'BUY_REACTION_UPGRADE'; reaction: ReactionId }
  | { type: 'BUY_UPGRADE'; upgrade: keyof UpgradeState }
  | { type: 'BUY_ACCRETION' }
  | { type: 'BUY_PERK'; perk: keyof PerkState }
  | { type: 'REMOVE_PERK'; perk: keyof PerkState }
  | { type: 'SELECT_CLOUD_TIER'; tier: CloudTier }
  | { type: 'PRESTIGE' }
  | { type: 'OPEN_SUMMARY' }
  | { type: 'CLOSE_SUMMARY' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'SET_VOLUME'; volume: number };
