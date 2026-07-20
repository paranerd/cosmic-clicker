import type { Stage } from '../game/types';

export const INITIAL_TEMPERATURE = 10;

export const THRESHOLDS = {
  protostarMass: 2_544,
  protostarTemperature: 100_000,
  deuteriumTemperature: 1_000_000,
  hydrogenTemperature: 10_000_000,
  heliumTemperature: 100_000_000,
  lateBurningTemperature: 600_000_000,
  mainSequenceHydrogen: 15_000,
  heliumCore: 4_500,
  oxygenCore: 1_200,
  blackHoleMass: 105_000,
} as const;

export const LIMITS = {
  gravity: 5,
  accretion: 8,
  fusion: 8,
  heliumFusion: 8,
  oxygenSynthesis: 8,
  permanentGravity: 5,
  fusionMemory: 5,
  cloudTier: 2,
  offlineSeconds: 8 * 60 * 60,
} as const;

export const ACCRETION = {
  manualBase: 48,
  automaticBasePerLevel: 17,
  energyPerMatter: .018,
  gravityBonusPerLevel: .55,
  permanentGravityBonusPerLevel: .12,
  pressureReferenceMass: 34_000,
  pressureExponent: 1.18,
} as const;

export const TEMPERATURE_MODEL = {
  compressionExponent: 1.5,
  deuteriumMultiplier: 1.35,
  fusionHeatPerHydrogen: 2.4,
  heatLossPerSecond: 180,
} as const;

export const STELLAR_WIND = {
  fractionOfInitialCloudPerMinute: .0025,
  startsAtStage: 'protostar' as Stage,
} as const;

// Aliases retained for older prototype imports.
export const ACCRETION_CLICK_BASE = ACCRETION.manualBase;
export const ACCRETION_SECOND_BASE = ACCRETION.automaticBasePerLevel;
export const STELLAR_WIND_FRACTION_PER_MINUTE = STELLAR_WIND.fractionOfInitialCloudPerMinute;

export interface StageDefinition {
  label: string;
  detail: string;
  temperatureFloor: number;
}

export const STAGES: Record<Stage, StageDefinition> = {
  nebula: { label: 'Urwolke', detail: 'Kalte Ausgangswolke', temperatureFloor: INITIAL_TEMPERATURE },
  protostar: { label: 'Protostern', detail: 'Gravitative Kontraktion', temperatureFloor: THRESHOLDS.protostarTemperature },
  deuterium: { label: 'Deuteriumphase', detail: 'Frühe Kernheizung', temperatureFloor: THRESHOLDS.deuteriumTemperature },
  hydrogen: { label: 'Wasserstoffbrennen', detail: 'Wasserstoff wird zu Helium', temperatureFloor: THRESHOLDS.hydrogenTemperature },
  mainSequence: { label: 'Hauptreihenstern', detail: 'Hydrostatisches Gleichgewicht', temperatureFloor: THRESHOLDS.hydrogenTemperature },
  redGiant: { label: 'Roter Riese', detail: 'Hülle expandiert', temperatureFloor: THRESHOLDS.heliumTemperature },
  helium: { label: 'Heliumbrennen', detail: 'Triple-Alpha-Prozess', temperatureFloor: THRESHOLDS.heliumTemperature },
  carbonOxygen: { label: 'Kohlenstoff-Sauerstoff-Kern', detail: 'Entarteter C/O-Kern', temperatureFloor: 180_000_000 },
  massiveStar: { label: 'Massereicher Stern', detail: 'Späte Brennphasen', temperatureFloor: THRESHOLDS.lateBurningTemperature },
  supernova: { label: 'Supernova', detail: 'Explosiver Kernkollaps', temperatureFloor: 1_000_000_000 },
  brownDwarf: { label: 'Brauner Zwerg', detail: 'Unterhalb der Zündmasse', temperatureFloor: INITIAL_TEMPERATURE },
  whiteDwarf: { label: 'Weißer Zwerg', detail: 'Freigelegter C/O-Kern', temperatureFloor: 120_000_000 },
  neutronStar: { label: 'Neutronenstern', detail: 'Entartete Neutronenmaterie', temperatureFloor: 1_000_000_000 },
  blackHole: { label: 'Schwarzes Loch', detail: 'Ereignishorizont', temperatureFloor: 1_000_000_000 },
};

export const STAGE_LABELS = Object.fromEntries(
  Object.entries(STAGES).map(([stage, definition]) => [stage, definition.label]),
) as Record<Stage, string>;

export const ACHIEVEMENT_TITLES: Record<string, string> = {
  'form-protostar': 'Protostern gebildet',
  'heat-protostar': '1 Mio. Kelvin erreicht',
  'ignite-hydrogen': 'Wasserstoffbrennen freigeschaltet',
  'stabilize-star': 'Hauptreihe erreicht',
  'leave-main-sequence': 'Hauptreihe abgeschlossen',
  'ignite-helium': 'Heliumkern gezündet',
  'build-carbon-core': 'Kohlenstoffkern gebildet',
  'build-oxygen-core': 'Kohlenstoff-Sauerstoff-Kern vollendet',
  'collapse-core': 'Kernkollaps ausgelöst',
  'observe-remnant': 'Stellarer Rest entdeckt',
};

export const PROTOSTAR_WIND_WARNING = {
  title: 'Sternwind setzt ein',
  text: 'Er trägt fortan stetig Materie aus der Urwolke ab. Diese Materie kann nicht mehr eingesammelt werden.',
} as const;
