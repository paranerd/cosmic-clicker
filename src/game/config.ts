import type { CloudTier, Matter, Stage, StellarOutcome } from './types';

export interface CloudDefinition {
  tier: CloudTier;
  name: string;
  shortName: string;
  description: string;
  matter: Matter;
}

export const CLOUD_TIERS: Record<CloudTier, CloudDefinition> = {
  0: {
    tier: 0,
    name: 'Kleine Urwolke',
    shortName: 'Klein',
    description: 'Eine kompakte Wasserstoffwolke mit noch unbekanntem Entwicklungsweg.',
    matter: { hydrogen: 12_000, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
  },
  1: {
    tier: 1,
    name: 'Stellare Urwolke',
    shortName: 'Stellar',
    description: 'Genug Materie für einen sonnenähnlichen Stern und einen Weißen Zwerg.',
    matter: { hydrogen: 56_000, helium: 18_900, deuterium: 100, carbon: 0, oxygen: 0 },
  },
  2: {
    tier: 2,
    name: 'Massereiche Urwolke',
    shortName: 'Massereich',
    description: 'Öffnet Supernovae und kompakte Sternreste.',
    matter: { hydrogen: 112_000, helium: 37_800, deuterium: 200, carbon: 0, oxygen: 0 },
  },
};

// Compatibility aliases for older imports and save migrations.
export const FIRST_CLOUD_BASE = CLOUD_TIERS[0].matter;
export const CLOUD_BASE = CLOUD_TIERS[1].matter;

export const INITIAL_TEMPERATURE = 10;
export const ACCRETION_CLICK_BASE = 48;
export const ACCRETION_SECOND_BASE = 17;
export const DEUTERIUM_UPGRADE_COST = 75;
export const DEUTERIUM_TEMPERATURE_MULTIPLIER = 1.35;
export const FUSION_AUTOMATION_HELIUM = 5_000;
export const FUSION_AUTOMATION_CARBON = 1_500;
export const FUSION_AUTOMATION_OXYGEN = 400;
export const HYDROGEN_TO_HELIUM_RATIO = .993;
export const HELIUM_TO_CARBON_RATIO = .998;
export const CARBON_TO_OXYGEN_RATIO = 4 / 3 * .998;
export const STELLAR_WIND_FRACTION_PER_MINUTE = .0025;

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

export const STAGE_LABELS: Record<Stage, string> = {
  nebula: 'Urwolke',
  protostar: 'Protostern',
  deuterium: 'Deuteriumphase',
  hydrogen: 'Wasserstoffbrennen',
  mainSequence: 'Hauptreihenstern',
  redGiant: 'Roter Riese',
  helium: 'Heliumbrennen',
  carbonOxygen: 'Kohlenstoff-Sauerstoff-Kern',
  massiveStar: 'Massereicher Stern',
  supernova: 'Supernova',
  brownDwarf: 'Brauner Zwerg',
  whiteDwarf: 'Weißer Zwerg',
  neutronStar: 'Neutronenstern',
  blackHole: 'Schwarzes Loch',
};

export const OUTCOME_LABELS: Record<StellarOutcome, string> = {
  brownDwarf: 'Brauner Zwerg',
  whiteDwarf: 'Weißer Zwerg',
  neutronStar: 'Neutronenstern',
  blackHole: 'Schwarzes Loch',
  legacyMainSequence: 'Hauptreihenstern · v0.2',
};

export const MATTER_KEYS = ['hydrogen', 'helium', 'deuterium', 'carbon', 'oxygen'] as const;
