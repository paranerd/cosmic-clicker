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
  offlineSeconds: 8 * 60 * 60,
} as const;

export const ACCRETION = {
  manualBase: 1,
  energyPerMatter: .018,
  pressureExponent: 1.18,
} as const;

export const TEMPERATURE_MODEL = {
  compressionExponent: 3,
  fusionHeatPerHydrogen: 2.4,
  heatLossPerSecond: 180,
  contractionSecondsPerStage: 90,
} as const;

export const STELLAR_WIND = {
  fractionOfInitialCloudPerMinute: .0025,
  // Hüllenwind (Punkt 6): entfernt ab der Hauptreihe H/He direkt aus dem Stern
  // selbst, nie schwere Kernelemente. Basis ist die aktuelle Sternmasse.
  // Welches Stadium mit welcher Rate bläst, steht als `shellWindRate` direkt
  // an der jeweiligen Stage-Definition unten.
  shell: {
    mainSequenceFractionPerMinute: .0001,
    lateStageFractionPerMinute: .0075,
  },
} as const;

// Gemeinsame Bezugsmasse aller strukturellen Brennraten (= 1 M☉). Die Raten
// und Exponenten selbst stehen seit dem Balancing-Umbau als `structuralBurn`
// direkt an der jeweiligen Reaktion in `reactions.ts` — vorher galt ein
// globaler Sonderfall allein für Wasserstoff, weshalb sich jede andere
// Brennphase pro Wolkenstufe verdoppelte.
export const STRUCTURAL_BURN_REFERENCE_MASS = THRESHOLDS.matterPerSolarMass;

// Kernkollaps: Der Eisenkern beendet die Runde nicht mehr sofort, sondern
// führt in ein eigenes, kurzes Stadium — das Stadium `supernova` war seit
// jeher definiert, wurde aber nie betreten.
//
// Die Phase läuft vollständig von selbst ab und ist damit idle-sicher. Wer
// anwesend ist, stößt durch Klicks zusätzlich Hülle ab und wandelt sie in
// Sternenstaub um (r-Prozess). Welcher Sternrest entsteht, ist dabei bereits
// beim Eintritt in den Kollaps entschieden und wird von der Abstoßung nicht
// mehr verändert: Der Vergleich mit `blackHoleMass` verwendet die Masse vor
// der Abstoßung. Anwesenheit ist dadurch ein Bonus, nie eine Voraussetzung
// oder ein Risiko.
export const CORE_COLLAPSE = {
  seconds: 24,
  // Anteil der Masse bei Kollapsbeginn, den ein einzelner Klick abstößt.
  ejectionPerClick: .012,
  maximumEjectedFraction: .6,
  // Zusätzlicher Sternenstaub bei vollständig abgestoßener Hülle, als Anteil
  // der regulären Belohnung dieser Runde.
  //
  // Bewusst relativ und nicht als fester Betrag je abgestoßener Sonnenmasse:
  // Ein linearer Satz wächst mit der Masse, die Basisbelohnung dagegen nur mit
  // `Masse^0,45`. Bei 4.588 M☉ überstieg der Bonus die eigentliche Belohnung
  // dadurch um das Neunfache — aus einem Bonus für Anwesenheit wäre der
  // eigentliche Ertrag der Runde geworden.
  stardustBonusAtFullEjection: .5,
} as const;

export interface StageDefinition {
  label: string;
  detail: string;
  temperatureFloor: number;
  // Datengetriebene Windregeln (Punkt 6), damit die Engine keine einzelnen
  // Stadien unterscheiden muss: `cloudWind` legt fest, ob der Wolkenwind in
  // diesem Stadium Materie aus der Urwolke abträgt; `shellWindRate` verweist
  // auf die Hüllenwind-Rate in STELLAR_WIND.shell (null = kein Hüllenwind).
  cloudWind: boolean;
  shellWindRate: keyof typeof STELLAR_WIND.shell | null;
}

export const STAGES: Record<Stage, StageDefinition> = {
  nebula: { label: 'Urwolke', detail: 'Kalte Ausgangswolke', temperatureFloor: INITIAL_TEMPERATURE, cloudWind: false, shellWindRate: null },
  protostar: { label: 'Protostern', detail: 'Gravitative Kontraktion', temperatureFloor: THRESHOLDS.protostarTemperature, cloudWind: true, shellWindRate: null },
  deuterium: { label: 'Deuteriumphase', detail: 'Frühe Kernheizung', temperatureFloor: THRESHOLDS.deuteriumTemperature, cloudWind: true, shellWindRate: null },
  hydrogen: { label: 'Wasserstofffusion', detail: 'Wasserstoff wird zu Helium', temperatureFloor: THRESHOLDS.hydrogenTemperature, cloudWind: true, shellWindRate: null },
  mainSequence: { label: 'Hauptreihenstern', detail: 'Hydrostatisches Gleichgewicht', temperatureFloor: THRESHOLDS.hydrogenTemperature, cloudWind: true, shellWindRate: 'mainSequenceFractionPerMinute' },
  redGiant: { label: 'Roter Riese', detail: 'Hülle expandiert', temperatureFloor: THRESHOLDS.hydrogenTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  helium: { label: 'Heliumfusion', detail: 'Triple-Alpha-Prozess', temperatureFloor: THRESHOLDS.heliumTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  carbonOxygen: { label: 'Kohlenstoff-Sauerstoff-Kern', detail: 'Entarteter C/O-Kern', temperatureFloor: THRESHOLDS.heliumTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  carbonBurning: { label: 'Kohlenstofffusion', detail: 'Kohlenstoff wird zu Neon', temperatureFloor: THRESHOLDS.carbonTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  neonBurning: { label: 'Neonfusion', detail: 'Neon wird zu Sauerstoff', temperatureFloor: THRESHOLDS.neonTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  oxygenBurning: { label: 'Sauerstofffusion', detail: 'Sauerstoff wird zu Silizium', temperatureFloor: THRESHOLDS.oxygenTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  siliconBurning: { label: 'Siliziumfusion', detail: 'Silizium wird zur Eisengruppe', temperatureFloor: THRESHOLDS.siliconTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  ironCore: { label: 'Eisenkern', detail: 'Fusion liefert keine Energie mehr', temperatureFloor: THRESHOLDS.siliconTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  massiveStar: { label: 'Massereicher Stern', detail: 'Späte Brennphasen', temperatureFloor: THRESHOLDS.lateBurningTemperature, cloudWind: true, shellWindRate: 'lateStageFractionPerMinute' },
  supernova: { label: 'Supernova', detail: 'Explosiver Kernkollaps', temperatureFloor: 1_000_000_000, cloudWind: true, shellWindRate: null },
  brownDwarf: { label: 'Brauner Zwerg', detail: 'Unterhalb der Zündmasse', temperatureFloor: INITIAL_TEMPERATURE, cloudWind: true, shellWindRate: null },
  heliumWhiteDwarf: { label: 'Helium-Weißer-Zwerg', detail: 'Heliumkern unterhalb der Zündmasse', temperatureFloor: THRESHOLDS.hydrogenTemperature, cloudWind: true, shellWindRate: null },
  whiteDwarf: { label: 'Weißer Zwerg', detail: 'Freigelegter C/O-Kern', temperatureFloor: 120_000_000, cloudWind: true, shellWindRate: null },
  oxygenNeonWhiteDwarf: { label: 'O/Ne-Weißer-Zwerg', detail: 'Entarteter Sauerstoff-Neon-Kern', temperatureFloor: THRESHOLDS.carbonTemperature, cloudWind: true, shellWindRate: null },
  neutronStar: { label: 'Neutronenstern', detail: 'Entartete Neutronenmaterie', temperatureFloor: 1_000_000_000, cloudWind: true, shellWindRate: null },
  blackHole: { label: 'Schwarzes Loch', detail: 'Ereignishorizont', temperatureFloor: 1_000_000_000, cloudWind: true, shellWindRate: null },
};

export const STAGE_LABELS = Object.fromEntries(
  Object.entries(STAGES).map(([stage, definition]) => [stage, definition.label]),
) as Record<Stage, string>;

// Erfolgs- und Warntexte fürs Ziel-Banner sind absichtlich nicht hier: die
// IDs sind Ziel-/Reaktionsphasen aus objectiveFor() (z. B. `ignite-carbon`,
// `burn-hydrogen`), keine STAGES-Schlüssel — STAGES kennt weder Reaktionen
// noch den Rundenabschluss, und mehrere STAGES-Einträge (z. B.
// `carbonOxygen`, `supernova`) werden ihrerseits nie als `state.stage`
// gesetzt. Die Titel und Texte der frühen Formationsziele stehen als
// `achievementTitle`/`warning` direkt an ihrem OBJECTIVES-Eintrag in
// `objectives.ts`; die reaktionsbezogenen Erfolgstitel und Windwarnungen
// liegen direkt bei ihrer Reaktion in `reactions.ts`
// (ignitionAchievementTitle/completionAchievementTitle/completionWarning).
