import type { AutomationState, ReactionId } from '../game/types';
import { THRESHOLDS } from './progression';

export type AutomationKind = keyof AutomationState;

export interface AutomationDefinition {
  id: AutomationKind;
  reaction?: ReactionId;
  title: string;
  icon: string;
  description: string;
  unit: string;
  baseRate: number;
  rateGrowthPerLevel: number;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  mastery: { kind: 'starMass'; threshold: number; symbol: string } | { kind: 'reaction'; reaction: ReactionId; threshold: number; symbol: string };
  // Punkt 1: Automationen, deren Nachschubquelle versiegen kann, hinterlegen
  // hier die Quelle und den Buttontext für den gesperrten Zustand. Ist die
  // Quelle erschöpft, kann die Automation nicht weiter ausgebaut werden.
  supply?: { kind: 'cloudMatter'; exhaustedLabel: string };
}

export const FUSION_AUTOMATION_HELIUM = 5_000;
export const FUSION_AUTOMATION_CARBON = 1_500;
export const FUSION_AUTOMATION_OXYGEN = 400;

const reactionAutomation = (
  id: AutomationKind,
  reaction: ReactionId,
  title: string,
  icon: string,
  unit: string,
  baseRate: number,
  baseCost: number,
  threshold: number,
  symbol: string,
): AutomationDefinition => ({
  id, reaction, title, icon, unit, baseRate, baseCost,
  description: `Führt ${title.toLowerCase()} automatisch aus. Wird nach ${threshold.toLocaleString('de-DE')} ME eigener Reaktionsleistung verfügbar.`,
  rateGrowthPerLevel: .08, costGrowth: 1.9, maxLevel: 8,
  mastery: { kind: 'reaction', reaction, threshold, symbol },
});

export const AUTOMATIONS: Record<AutomationKind, AutomationDefinition> = {
  accretion: {
    id: 'accretion', title: 'Akkretionsstrom', icon: 'A',
    description: 'Zieht kontinuierlich Materie aus der Wolke. Benötigt einen ausgebildeten Protostern.',
    unit: 'ME/s', baseRate: 1, rateGrowthPerLevel: 0,
    baseCost: 25, costGrowth: 1.85, maxLevel: 8,
    mastery: { kind: 'starMass', threshold: THRESHOLDS.protostarMass, symbol: 'ME' },
    supply: { kind: 'cloudMatter', exhaustedLabel: 'Urwolke erschöpft' },
  },
  fusion: reactionAutomation('fusion', 'hydrogen', 'Stabile Wasserstofffusion', 'H', 'H/s', 64, 280, FUSION_AUTOMATION_HELIUM, 'He'),
  heliumFusion: reactionAutomation('heliumFusion', 'helium', 'Stabile Heliumfusion', 'He', 'He/s', 48, 520, FUSION_AUTOMATION_CARBON, 'C'),
  oxygenSynthesis: reactionAutomation('oxygenSynthesis', 'alphaCapture', 'Stabiler Alpha-Einfang', 'O', 'O/s', 24, 900, FUSION_AUTOMATION_OXYGEN, 'O'),
  carbonFusion: reactionAutomation('carbonFusion', 'carbon', 'Stabile Kohlenstofffusion', 'C', 'C/s', 18, 1_400, 900, 'Ne'),
  neonFusion: reactionAutomation('neonFusion', 'neon', 'Stabile Neonfusion', 'Ne', 'Ne/s', 14, 1_900, 700, 'O'),
  oxygenFusion: reactionAutomation('oxygenFusion', 'oxygen', 'Stabile Sauerstofffusion', 'O', 'O/s', 11, 2_500, 550, 'Si'),
  siliconFusion: reactionAutomation('siliconFusion', 'silicon', 'Stabile Siliziumfusion', 'Si', 'Si/s', 8, 3_200, 400, 'Fe'),
};

export const AUTOMATION_ORDER = ['accretion', 'fusion', 'heliumFusion', 'oxygenSynthesis', 'carbonFusion', 'neonFusion', 'oxygenFusion', 'siliconFusion'] as const satisfies readonly AutomationKind[];
