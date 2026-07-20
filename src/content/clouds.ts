import type { CloudTier, Matter } from '../game/types';

export interface CloudDefinition {
  tier: CloudTier;
  name: string;
  shortName: string;
  description: string;
  expectedOutcome: string;
  solarMasses: number;
  matureAccretionMultiplier: number;
  matter: Matter;
}

export const CLOUD_TIERS: Record<CloudTier, CloudDefinition> = {
  0: {
    tier: 0,
    name: 'Kleine Urwolke',
    shortName: 'Klein',
    description: 'Eine kompakte Wasserstoffwolke mit noch unbekanntem Entwicklungsweg.',
    expectedOutcome: 'Brauner Zwerg',
    solarMasses: .07,
    matureAccretionMultiplier: 1,
    matter: { hydrogen: 10_490, helium: 0, deuterium: 10, carbon: 0, neon: 0, oxygen: 0, silicon: 0, iron: 0 },
  },
  1: {
    tier: 1,
    name: 'Stellare Urwolke',
    shortName: 'Stellar',
    description: 'Genug Materie für einen sonnenähnlichen Stern und einen Weißen Zwerg.',
    expectedOutcome: 'Weißer Zwerg',
    solarMasses: 1,
    matureAccretionMultiplier: 6.25,
    matter: { hydrogen: 105_000, helium: 44_800, deuterium: 200, carbon: 0, neon: 0, oxygen: 0, silicon: 0, iron: 0 },
  },
  2: {
    tier: 2,
    name: 'Massereiche Urwolke',
    shortName: 'Massereich',
    description: 'Öffnet Supernovae und kompakte Sternreste.',
    expectedOutcome: 'Supernova',
    solarMasses: 25,
    matureAccretionMultiplier: 187.5,
    matter: { hydrogen: 2_625_000, helium: 1_123_000, deuterium: 2_000, carbon: 0, neon: 0, oxygen: 0, silicon: 0, iron: 0 },
  },
};

// Compatibility aliases for older imports and save migrations.
export const FIRST_CLOUD_BASE = CLOUD_TIERS[0].matter;
export const CLOUD_BASE = CLOUD_TIERS[1].matter;
