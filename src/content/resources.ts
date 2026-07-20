import type { Matter } from '../game/types';

export const MATTER_KEYS = ['hydrogen', 'helium', 'deuterium', 'carbon', 'neon', 'oxygen', 'silicon', 'iron'] as const satisfies readonly (keyof Matter)[];
export type MatterKey = typeof MATTER_KEYS[number];

export interface ResourceDefinition {
  symbol: string;
  label: string;
  className: string;
  visibleInComposition: boolean;
}

export const RESOURCES: Record<MatterKey, ResourceDefinition> = {
  hydrogen: { symbol: 'H', label: 'Wasserstoff', className: 'h', visibleInComposition: true },
  helium: { symbol: 'He', label: 'Helium', className: 'he', visibleInComposition: true },
  deuterium: { symbol: 'D', label: 'Deuterium', className: 'd', visibleInComposition: false },
  carbon: { symbol: 'C', label: 'Kohlenstoff', className: 'c', visibleInComposition: true },
  neon: { symbol: 'Ne', label: 'Neon', className: 'ne', visibleInComposition: true },
  oxygen: { symbol: 'O', label: 'Sauerstoff', className: 'o', visibleInComposition: true },
  silicon: { symbol: 'Si', label: 'Silizium', className: 'si', visibleInComposition: true },
  iron: { symbol: 'Fe', label: 'Eisen', className: 'fe', visibleInComposition: true },
};

export const DISPLAY_MATTER_KEYS = MATTER_KEYS.filter((key) => RESOURCES[key].visibleInComposition);
export const EMPTY_MATTER: Matter = { hydrogen: 0, helium: 0, deuterium: 0, carbon: 0, neon: 0, oxygen: 0, silicon: 0, iron: 0 };
