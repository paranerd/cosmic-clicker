export const CLOUD_BASE = {
  hydrogen: 74_900,
  helium: 25_000,
  deuterium: 100,
} as const;

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
