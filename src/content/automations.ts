import type { AutomationState, ReactionId } from '../game/types';
import type { LevelFormula } from './level-formula';
import { THRESHOLDS } from './progression';

export type AutomationKind = keyof AutomationState;

export interface AutomationDefinition {
  id: AutomationKind;
  reaction?: ReactionId;
  title: string;
  icon: string;
  description: string;
  unit: string;
  value: LevelFormula;
  cost: LevelFormula;
  maxLevel: number;
  mastery: {
    kind: 'starMass';
    threshold: number;
    symbol: string;
  } | {
    kind: 'reaction';
    reaction: ReactionId;
    threshold: number;
    symbol: string;
  };
  // Punkt 1: Automationen, deren Nachschubquelle versiegen kann, hinterlegen
  // hier die Quelle und den Buttontext für den gesperrten Zustand. Ist die
  // Quelle erschöpft, kann die Automation nicht weiter ausgebaut werden.
  supply?: {
    kind: 'cloudMatter';
    exhaustedLabel: string;
  };
}

export const FUSION_AUTOMATION_HELIUM = 5_000;
export const FUSION_AUTOMATION_CARBON = 1_500;
export const FUSION_AUTOMATION_OXYGEN = 400;

export const AUTOMATIONS: Record<AutomationKind, AutomationDefinition> = {
  accretion: {
    id: 'accretion',
    title: 'Akkretionsstrom',
    icon: 'A',
    description: 'Zieht kontinuierlich Materie aus der Wolke. Benötigt einen ausgebildeten Protostern.',
    unit: 'ME/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: 0,
      linearCoefficient: 1,
    },
    cost: {
      baseCost: 25,
      growthFactor: 1.85,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'starMass',
      threshold: THRESHOLDS.protostarMass,
      symbol: 'ME',
    },
    supply: {
      kind: 'cloudMatter',
      exhaustedLabel: 'Urwolke erschöpft',
    },
  },
  fusion: {
    id: 'fusion',
    reaction: 'hydrogen',
    title: 'Stabile Wasserstofffusion',
    icon: 'H',
    description: `Führt stabile wasserstofffusion automatisch aus. Wird nach ${FUSION_AUTOMATION_HELIUM.toLocaleString('de-DE')} ME eigener Reaktionsleistung verfügbar.`,
    unit: 'H/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: 5.12,
      linearCoefficient: 64,
    },
    cost: {
      baseCost: 280,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'hydrogen',
      threshold: FUSION_AUTOMATION_HELIUM,
      symbol: 'He',
    },
  },
  heliumFusion: {
    id: 'heliumFusion',
    reaction: 'helium',
    title: 'Stabile Heliumfusion',
    icon: 'He',
    description: `Führt stabile heliumfusion automatisch aus. Wird nach ${FUSION_AUTOMATION_CARBON.toLocaleString('de-DE')} ME eigener Reaktionsleistung verfügbar.`,
    unit: 'He/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: 3.84,
      linearCoefficient: 48,
    },
    cost: {
      baseCost: 520,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'helium',
      threshold: FUSION_AUTOMATION_CARBON,
      symbol: 'C',
    },
  },
  oxygenSynthesis: {
    id: 'oxygenSynthesis',
    reaction: 'alphaCapture',
    title: 'Stabiler Alpha-Einfang',
    icon: 'O',
    description: `Führt stabiler alpha-einfang automatisch aus. Wird nach ${FUSION_AUTOMATION_OXYGEN.toLocaleString('de-DE')} ME eigener Reaktionsleistung verfügbar.`,
    unit: 'O/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: 1.92,
      linearCoefficient: 24,
    },
    cost: {
      baseCost: 900,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'alphaCapture',
      threshold: FUSION_AUTOMATION_OXYGEN,
      symbol: 'O',
    },
  },
  carbonFusion: {
    id: 'carbonFusion',
    reaction: 'carbon',
    title: 'Stabile Kohlenstofffusion',
    icon: 'C',
    description: 'Führt stabile kohlenstofffusion automatisch aus. Wird nach 900 ME eigener Reaktionsleistung verfügbar.',
    unit: 'C/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: 1.44,
      linearCoefficient: 18,
    },
    cost: {
      baseCost: 1_400,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'carbon',
      threshold: 900,
      symbol: 'Ne',
    },
  },
  neonFusion: {
    id: 'neonFusion',
    reaction: 'neon',
    title: 'Stabile Neonfusion',
    icon: 'Ne',
    description: 'Führt stabile neonfusion automatisch aus. Wird nach 700 ME eigener Reaktionsleistung verfügbar.',
    unit: 'Ne/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: 1.12,
      linearCoefficient: 14,
    },
    cost: {
      baseCost: 1_900,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'neon',
      threshold: 700,
      symbol: 'O',
    },
  },
  oxygenFusion: {
    id: 'oxygenFusion',
    reaction: 'oxygen',
    title: 'Stabile Sauerstofffusion',
    icon: 'O',
    description: 'Führt stabile sauerstofffusion automatisch aus. Wird nach 550 ME eigener Reaktionsleistung verfügbar.',
    unit: 'O/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: .88,
      linearCoefficient: 11,
    },
    cost: {
      baseCost: 2_500,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'oxygen',
      threshold: 550,
      symbol: 'Si',
    },
  },
  siliconFusion: {
    id: 'siliconFusion',
    reaction: 'silicon',
    title: 'Stabile Siliziumfusion',
    icon: 'Si',
    description: 'Führt stabile siliziumfusion automatisch aus. Wird nach 400 ME eigener Reaktionsleistung verfügbar.',
    unit: 'Si/s',
    value: {
      baseCost: 0,
      growthFactor: 1,
      quadraticCoefficient: .64,
      linearCoefficient: 8,
    },
    cost: {
      baseCost: 3_200,
      growthFactor: 1.9,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 8,
    mastery: {
      kind: 'reaction',
      reaction: 'silicon',
      threshold: 400,
      symbol: 'Fe',
    },
  },
};

export const AUTOMATION_ORDER = [
  'accretion',
  'fusion',
  'heliumFusion',
  'oxygenSynthesis',
  'carbonFusion',
  'neonFusion',
  'oxygenFusion',
  'siliconFusion',
] as const satisfies readonly AutomationKind[];
