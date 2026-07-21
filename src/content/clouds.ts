import type { Matter } from '../game/types';
import { THRESHOLDS } from './progression';

// Wolkenwachstum (Umbau): Statt fester Wolkenstufen (0/1/2) wächst die Urwolke
// in offenen, prozentualen Perk-Stufen. Jede Stufe verdoppelt die Wolkenmasse
// (+100 %) gegenüber der vorherigen Stufe; die Elementverteilung wird für
// jede Wolkengröße einheitlich aus einer realistischen Ur-Zusammensetzung
// abgeleitet (kein Sonderfall mehr für die kleinste Wolke).
export const CLOUD_GROWTH = {
  baseSolarMasses: .07,
  growthFactorPerLevel: 2,
  heliumMassFraction: .25,
  deuteriumMassFraction: .001,
  // Akkretionsbonus kalibriert auf die früheren Referenzpunkte "stellare"
  // (1 M☉ → ×6.25) und "massereiche" Urwolke (25 M☉ → ×187.5).
  accretionMultiplierBase: 6.25,
  accretionMultiplierExponent: Math.log(30) / Math.log(25),
} as const;

export type CloudGrowthPath = 'brownDwarf' | 'stellar' | 'massive';

// Reihenfolge der Entwicklungspfade nach benötigter Mindestmasse, für
// Freischalt-Vergleiche (siehe evolutionMapMarkup in ui/views.ts).
export const CLOUD_PATH_ORDER: CloudGrowthPath[] = ['brownDwarf', 'stellar', 'massive'];

const CLOUD_PATH_NAMES: Record<CloudGrowthPath, { name: string; shortName: string; description: string }> = {
  brownDwarf: {
    name: 'Kleine Urwolke',
    shortName: 'Klein',
    description: 'Eine kompakte Wolke mit noch unbekanntem Entwicklungsweg.',
  },
  stellar: {
    name: 'Stellare Urwolke',
    shortName: 'Stellar',
    description: 'Genug Materie für einen sonnenähnlichen Stern und einen Weißen Zwerg.',
  },
  massive: {
    name: 'Massereiche Urwolke',
    shortName: 'Massereich',
    description: 'Öffnet Supernovae und kompakte Sternreste.',
  },
};

// Der Entwicklungspfad hängt allein von der Wolkenmasse ab, nicht von einer
// künstlich festgelegten Wolkenstufe oder Rundennummer.
export const cloudGrowthPath = (solarMasses: number): CloudGrowthPath => {
  if (solarMasses < THRESHOLDS.hydrogenIgnitionMass / THRESHOLDS.matterPerSolarMass) return 'brownDwarf';
  if (solarMasses < THRESHOLDS.carbonIgnitionMass / THRESHOLDS.matterPerSolarMass) return 'stellar';
  return 'massive';
};

export const cloudPathName = (path: CloudGrowthPath) => CLOUD_PATH_NAMES[path];
export const cloudSizeName = (solarMasses: number) => CLOUD_PATH_NAMES[cloudGrowthPath(solarMasses)];

export const cloudExpectedOutcome = (solarMasses: number): string => {
  const path = cloudGrowthPath(solarMasses);
  if (path === 'brownDwarf') return 'Brauner Zwerg';
  if (path === 'stellar') return 'Weißer Zwerg';
  return 'Supernova';
};

export const cloudSolarMasses = (level: number): number =>
  CLOUD_GROWTH.baseSolarMasses * CLOUD_GROWTH.growthFactorPerLevel ** Math.max(0, level);

export const cloudMassForLevel = (level: number): number => cloudSolarMasses(level) * THRESHOLDS.matterPerSolarMass;

// Realistische Ur-Zusammensetzung: ~75 % Wasserstoff, ~25 % Helium (primordiale
// Massenfraktion) und ein kleiner Deuterium-Spurenanteil, einheitlich auf jede
// Wolkengröße angewendet statt für einzelne Stufen fest hinterlegt zu sein.
export const cloudMatterForLevel = (level: number): Matter => {
  const total = cloudMassForLevel(level);
  const deuterium = total * CLOUD_GROWTH.deuteriumMassFraction;
  const remaining = total - deuterium;
  const helium = remaining * CLOUD_GROWTH.heliumMassFraction;
  const hydrogen = remaining - helium;
  return { hydrogen, helium, deuterium, carbon: 0, neon: 0, oxygen: 0, silicon: 0, iron: 0 };
};

export const cloudMatureAccretionMultiplier = (solarMasses: number): number =>
  Math.max(1, CLOUD_GROWTH.accretionMultiplierBase * solarMasses ** CLOUD_GROWTH.accretionMultiplierExponent);

export interface CloudDefinition {
  level: number;
  name: string;
  shortName: string;
  description: string;
  expectedOutcome: string;
  solarMasses: number;
  matureAccretionMultiplier: number;
  matter: Matter;
}

export const cloudDefinitionForLevel = (level: number): CloudDefinition => {
  const solarMasses = cloudSolarMasses(level);
  const { name, shortName, description } = cloudSizeName(solarMasses);
  return {
    level,
    name,
    shortName,
    description,
    expectedOutcome: cloudExpectedOutcome(solarMasses),
    solarMasses,
    matureAccretionMultiplier: cloudMatureAccretionMultiplier(solarMasses),
    matter: cloudMatterForLevel(level),
  };
};
