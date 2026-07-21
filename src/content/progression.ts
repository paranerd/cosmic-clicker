import type { Stage } from '../game/types';

export const INITIAL_TEMPERATURE = 10;

export const THRESHOLDS = {
  matterPerSolarMass: 150_000,
  protostarMass: 2_544,
  protostarTemperature: 100_000,
  deuteriumTemperature: 1_000_000,
  hydrogenTemperature: 10_000_000,
  heliumTemperature: 100_000_000,
  carbonTemperature: 600_000_000,
  neonTemperature: 1_200_000_000,
  oxygenTemperature: 1_500_000_000,
  siliconTemperature: 2_700_000_000,
  lateBurningTemperature: 600_000_000,
  mainSequenceHydrogen: 15_000,
  heliumCore: 4_500,
  oxygenCore: 1_200,
  hydrogenIgnitionMass: 12_000,
  heliumIgnitionMass: 75_000,
  carbonIgnitionMass: 1_200_000,
  advancedBurningMass: 1_350_000,
  blackHoleMass: 3_000_000,
} as const;

export const LIMITS = {
  gravity: 5,
  accretion: 8,
  fusion: 8,
  heliumFusion: 8,
  oxygenSynthesis: 8,
  carbonFusion: 8,
  neonFusion: 8,
  oxygenFusion: 8,
  siliconFusion: 8,
  permanentGravity: 5,
  fusionMemory: 5,
  // Wolkenwachstum ist jetzt ein offener, prozentualer Perk ohne feste
  // Stufenzahl. Der Wert dient nur als großzügige technische Obergrenze.
  cloudGrowthLevel: 24,
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
  compressionExponent: 3,
  deuteriumMultiplier: 1.35,
  fusionHeatPerHydrogen: 2.4,
  heatLossPerSecond: 180,
  contractionSecondsPerStage: 90,
} as const;

export const STELLAR_WIND = {
  fractionOfInitialCloudPerMinute: .0025,
  startsAtStage: 'protostar' as Stage,
  // Hüllenwind (Punkt 6): entfernt ab der Hauptreihe H/He direkt aus dem Stern
  // selbst, nie schwere Kernelemente. Basis ist die aktuelle Sternmasse.
  shell: {
    mainSequenceFractionPerMinute: .0001,
    lateStageFractionPerMinute: .0075,
  },
} as const;

// Stellare Stadien, in denen der Hüllenwind bereits mit der stärkeren
// Spätphasen-Rate bläst (Roter Riese, massereicher Stern, alle folgenden
// Brennstufen bis zum Eisenkern).
export const LATE_SHELL_WIND_STAGES: readonly Stage[] = [
  'redGiant', 'helium', 'carbonOxygen', 'carbonBurning', 'neonBurning', 'oxygenBurning', 'siliconBurning', 'massiveStar', 'ironCore',
];

// Punkt 6: struktureller Wasserstoffverbrauch ab der Hauptreihe, unabhängig
// von gekauften Automationen. rateReferenceMass entspricht 1 M☉; die Rate
// skaliert überproportional mit der Sternmasse (massExponent > 1), sodass
// massereichere Sterne die Hauptreihe deutlich schneller durchlaufen als
// leichte, aber nicht im realen Verhältnis (~3.000×), sondern komprimiert
// auf den Faktor 3–5 zwischen der 1- und der 25-Sonnenmassen-Wolke.
export const MAIN_SEQUENCE_BURN = {
  ratePerSecond: 300,
  referenceMass: THRESHOLDS.matterPerSolarMass,
  massExponent: 1.46,
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
  hydrogen: { label: 'Wasserstofffusion', detail: 'Wasserstoff wird zu Helium', temperatureFloor: THRESHOLDS.hydrogenTemperature },
  mainSequence: { label: 'Hauptreihenstern', detail: 'Hydrostatisches Gleichgewicht', temperatureFloor: THRESHOLDS.hydrogenTemperature },
  redGiant: { label: 'Roter Riese', detail: 'Hülle expandiert', temperatureFloor: THRESHOLDS.hydrogenTemperature },
  helium: { label: 'Heliumfusion', detail: 'Triple-Alpha-Prozess', temperatureFloor: THRESHOLDS.heliumTemperature },
  carbonOxygen: { label: 'Kohlenstoff-Sauerstoff-Kern', detail: 'Entarteter C/O-Kern', temperatureFloor: THRESHOLDS.heliumTemperature },
  carbonBurning: { label: 'Kohlenstofffusion', detail: 'Kohlenstoff wird zu Neon', temperatureFloor: THRESHOLDS.carbonTemperature },
  neonBurning: { label: 'Neonfusion', detail: 'Neon wird zu Sauerstoff', temperatureFloor: THRESHOLDS.neonTemperature },
  oxygenBurning: { label: 'Sauerstofffusion', detail: 'Sauerstoff wird zu Silizium', temperatureFloor: THRESHOLDS.oxygenTemperature },
  siliconBurning: { label: 'Siliziumfusion', detail: 'Silizium wird zur Eisengruppe', temperatureFloor: THRESHOLDS.siliconTemperature },
  ironCore: { label: 'Eisenkern', detail: 'Fusion liefert keine Energie mehr', temperatureFloor: THRESHOLDS.siliconTemperature },
  massiveStar: { label: 'Massereicher Stern', detail: 'Späte Brennphasen', temperatureFloor: THRESHOLDS.lateBurningTemperature },
  supernova: { label: 'Supernova', detail: 'Explosiver Kernkollaps', temperatureFloor: 1_000_000_000 },
  brownDwarf: { label: 'Brauner Zwerg', detail: 'Unterhalb der Zündmasse', temperatureFloor: INITIAL_TEMPERATURE },
  heliumWhiteDwarf: { label: 'Helium-Weißer-Zwerg', detail: 'Heliumkern unterhalb der Zündmasse', temperatureFloor: THRESHOLDS.hydrogenTemperature },
  whiteDwarf: { label: 'Weißer Zwerg', detail: 'Freigelegter C/O-Kern', temperatureFloor: 120_000_000 },
  oxygenNeonWhiteDwarf: { label: 'O/Ne-Weißer-Zwerg', detail: 'Entarteter Sauerstoff-Neon-Kern', temperatureFloor: THRESHOLDS.carbonTemperature },
  neutronStar: { label: 'Neutronenstern', detail: 'Entartete Neutronenmaterie', temperatureFloor: 1_000_000_000 },
  blackHole: { label: 'Schwarzes Loch', detail: 'Ereignishorizont', temperatureFloor: 1_000_000_000 },
};

export const STAGE_LABELS = Object.fromEntries(
  Object.entries(STAGES).map(([stage, definition]) => [stage, definition.label]),
) as Record<Stage, string>;

export const ACHIEVEMENT_TITLES: Record<string, string> = {
  'form-protostar': 'Protostern gebildet',
  'heat-protostar': '1 Mio. Kelvin erreicht',
  'ignite-hydrogen': 'Wasserstofffusion freigeschaltet',
  'stabilize-star': 'Hauptreihe erreicht',
  'leave-main-sequence': 'Hauptreihe abgeschlossen',
  'ignite-helium': 'Heliumkern gezündet',
  'build-carbon-core': 'Kohlenstoffkern gebildet',
  'build-oxygen-core': 'Kohlenstoff-Sauerstoff-Kern vollendet',
  'collapse-core': 'Kernkollaps ausgelöst',
  'observe-remnant': 'Stellarer Rest entdeckt',
  'ignite-alphaCapture': 'Alpha-Einfang freigeschaltet',
  'ignite-carbon': 'Kohlenstofffusion freigeschaltet',
  'ignite-neon': 'Neonfusion freigeschaltet',
  'ignite-oxygen': 'Sauerstofffusion freigeschaltet',
  'ignite-silicon': 'Siliziumfusion freigeschaltet',
  'burn-hydrogen': 'Wasserstofffusion abgeschlossen',
  'burn-helium': 'Heliumfusion abgeschlossen',
  'burn-alphaCapture': 'Alpha-Einfang abgeschlossen',
  'burn-carbon': 'Kohlenstofffusion abgeschlossen',
  'burn-neon': 'Neonfusion abgeschlossen',
  'burn-oxygen': 'Sauerstofffusion abgeschlossen',
  'burn-silicon': 'Siliziumfusion abgeschlossen',
};

export const PROTOSTAR_WIND_WARNING = {
  title: 'Sternwind setzt ein',
  text: 'Er trägt fortan stetig Materie aus der Urwolke ab. Diese Materie kann nicht mehr eingesammelt werden.',
} as const;

export const SHELL_WIND_WARNING = {
  title: 'Hüllenwind verstärkt sich',
  text: 'Der Stern verliert ab jetzt spürbar Wasserstoff und Helium aus seiner eigenen Hülle. Hält der Massenverlust an, kann er den späteren Sternrest verändern.',
} as const;
