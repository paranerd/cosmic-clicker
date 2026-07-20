import type { CloudTier, Matter } from '../game/types';

export interface CloudDefinition {
  tier: CloudTier;
  name: string;
  shortName: string;
  description: string;
  expectedOutcome: string;
  matter: Matter;
}

export const CLOUD_TIERS: Record<CloudTier, CloudDefinition> = {
  0: {
    tier: 0,
    name: 'Kleine Urwolke',
    shortName: 'Klein',
    description: 'Eine kompakte Wasserstoffwolke mit noch unbekanntem Entwicklungsweg.',
    expectedOutcome: 'Brauner Zwerg',
    matter: { hydrogen: 12_000, helium: 0, deuterium: 20, carbon: 0, oxygen: 0 },
  },
  1: {
    tier: 1,
    name: 'Stellare Urwolke',
    shortName: 'Stellar',
    description: 'Genug Materie für einen sonnenähnlichen Stern und einen Weißen Zwerg.',
    expectedOutcome: 'Weißer Zwerg',
    matter: { hydrogen: 56_000, helium: 18_900, deuterium: 100, carbon: 0, oxygen: 0 },
  },
  2: {
    tier: 2,
    name: 'Massereiche Urwolke',
    shortName: 'Massereich',
    description: 'Öffnet Supernovae und kompakte Sternreste.',
    expectedOutcome: 'Supernova',
    matter: { hydrogen: 112_000, helium: 37_800, deuterium: 200, carbon: 0, oxygen: 0 },
  },
};

// Compatibility aliases for older imports and save migrations.
export const FIRST_CLOUD_BASE = CLOUD_TIERS[0].matter;
export const CLOUD_BASE = CLOUD_TIERS[1].matter;
