import type { AutomationState, Stage } from '../game/types';
import { ACCRETION, LIMITS, THRESHOLDS } from './progression';

export type AutomationKind = keyof AutomationState;

export interface AutomationDefinition {
  title: string;
  icon: string;
  description: string;
  unit: string;
  action: string;
  baseRate: number;
  rateGrowthPerLevel: number;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  visibleStages: readonly Stage[] | 'always';
  mastery: {
    kind: 'starMass' | 'heliumCreated' | 'carbonCreated' | 'oxygenCreated';
    threshold: number;
    symbol: string;
  };
}

export const FUSION_AUTOMATION_HELIUM = 5_000;
export const FUSION_AUTOMATION_CARBON = 1_500;
export const FUSION_AUTOMATION_OXYGEN = 400;

export const AUTOMATIONS: Record<AutomationKind, AutomationDefinition> = {
  accretion: {
    title: 'Akkretionsstrom',
    icon: 'A',
    description: 'Zieht kontinuierlich Materie aus der Wolke. Benötigt einen ausgebildeten Protostern.',
    unit: 'ME/s',
    action: 'buy-accretion',
    baseRate: ACCRETION.automaticBasePerLevel,
    rateGrowthPerLevel: 0,
    baseCost: 65,
    costGrowth: 1.85,
    maxLevel: LIMITS.accretion,
    visibleStages: 'always',
    mastery: { kind: 'starMass', threshold: THRESHOLDS.protostarMass, symbol: 'ME' },
  },
  fusion: {
    title: 'Stabiles Wasserstoffbrennen',
    icon: 'H',
    description: `Fusioniert Wasserstoff automatisch. Wird nach ${FUSION_AUTOMATION_HELIUM.toLocaleString('de-DE')} ME selbst erzeugtem Helium verfügbar.`,
    unit: 'H/s',
    action: 'buy-fusion',
    baseRate: 64,
    rateGrowthPerLevel: .08,
    baseCost: 280,
    costGrowth: 1.9,
    maxLevel: LIMITS.fusion,
    visibleStages: ['hydrogen', 'mainSequence', 'redGiant', 'helium', 'carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'],
    mastery: { kind: 'heliumCreated', threshold: FUSION_AUTOMATION_HELIUM, symbol: 'He' },
  },
  heliumFusion: {
    title: 'Stabiles Heliumbrennen',
    icon: 'He',
    description: `Verschmilzt Helium automatisch. Wird nach ${FUSION_AUTOMATION_CARBON.toLocaleString('de-DE')} ME selbst erzeugtem Kohlenstoff verfügbar.`,
    unit: 'He/s',
    action: 'buy-helium-fusion',
    baseRate: 48,
    rateGrowthPerLevel: .08,
    baseCost: 520,
    costGrowth: 1.9,
    maxLevel: LIMITS.heliumFusion,
    visibleStages: ['helium', 'carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'],
    mastery: { kind: 'carbonCreated', threshold: FUSION_AUTOMATION_CARBON, symbol: 'C' },
  },
  oxygenSynthesis: {
    title: 'Stabiler Alpha-Einfang',
    icon: 'O',
    description: `Bildet Sauerstoff automatisch. Wird nach ${FUSION_AUTOMATION_OXYGEN.toLocaleString('de-DE')} ME selbst erzeugtem Sauerstoff verfügbar.`,
    unit: 'O/s',
    action: 'buy-oxygen-synthesis',
    baseRate: 24,
    rateGrowthPerLevel: .08,
    baseCost: 900,
    costGrowth: 1.9,
    maxLevel: LIMITS.oxygenSynthesis,
    visibleStages: ['carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'],
    mastery: { kind: 'oxygenCreated', threshold: FUSION_AUTOMATION_OXYGEN, symbol: 'O' },
  },
};
