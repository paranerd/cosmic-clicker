export const CLOUD_BASE = {
  hydrogen: 74_900,
  helium: 25_000,
  deuterium: 100,
} as const;

export const FIRST_CLOUD_BASE = {
  hydrogen: 100_000,
  helium: 0,
  deuterium: 0,
} as const;

export const DEUTERIUM_UPGRADE_COST = 75;
export const DEUTERIUM_TEMPERATURE_MULTIPLIER = 1.35;

export const THRESHOLDS = {
  protostarMass: 1_500,
  deuteriumTemperature: 1_000_000,
  hydrogenTemperature: 10_000_000,
  stableFusedHydrogen: 15_000,
} as const;

export const LIMITS = {
  gravity: 5,
  accretion: 8,
  fusion: 8,
  offlineSeconds: 8 * 60 * 60,
} as const;

export const STAGE_LABELS = {
  nebula: 'Urwolke',
  protostar: 'Protostern',
  deuterium: 'Deuteriumphase',
  hydrogen: 'Wasserstoffbrennen',
  stable: 'Hauptreihenstern',
} as const;
