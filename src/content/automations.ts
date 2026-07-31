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
  // Freischaltbedingung. `starMass` misst weiterhin eine Materiemenge,
  // `manualExperience` verlangt genau eine selbst ausgelöste Reaktion.
  //
  // Vorher galt hier eine absolute Mengenschwelle auf dem *Produkt* der
  // Automation (z. B. 900 ME Neon für die Kohlenstofffusion). Da dieses
  // Produkt ohne die Automation ausschließlich durch Sternklicks entsteht,
  // konnte die Kette dauerhaft blockieren: kein Klick → kein Produkt → keine
  // Automation → nie wieder Fortschritt. Eine Runde blieb ohne anwesenden
  // Spieler ab der Kohlenstoffphase eingefroren stehen, unabhängig davon, wie
  // viel Energie bereitlag.
  //
  // Die Designabsicht („erst erleben, dann automatisieren“) bleibt vollständig
  // erhalten — sie kostet jetzt eine einzige bewusste Handlung statt einer
  // Menge, die nur durch Dauerklicken erreichbar war. Und weil
  // `experiencedReactions` den Zyklus überdauert, gilt die Lektion ab dem
  // zweiten Durchlauf als gelernt.
  mastery: {
    kind: 'starMass';
    threshold: number;
    symbol: string;
  } | {
    kind: 'manualExperience';
    reaction: ReactionId;
    lockedLabel: string;
  };
  // Punkt 1: Automationen, deren Nachschubquelle versiegen kann, hinterlegen
  // hier die Quelle und den Buttontext für den gesperrten Zustand. Ist die
  // Quelle erschöpft, kann die Automation nicht weiter ausgebaut werden.
  supply?: {
    kind: 'cloudMatter';
    exhaustedLabel: string;
  };
}

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
    description: 'Führt die Wasserstofffusion automatisch aus. Wird verfügbar, sobald du sie einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'hydrogen',
      lockedLabel: 'Einmal selbst fusionieren',
    },
  },
  heliumFusion: {
    id: 'heliumFusion',
    reaction: 'helium',
    title: 'Stabile Heliumfusion',
    icon: 'He',
    description: 'Führt die Heliumfusion automatisch aus. Wird verfügbar, sobald du sie einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'helium',
      lockedLabel: 'Einmal selbst fusionieren',
    },
  },
  oxygenSynthesis: {
    id: 'oxygenSynthesis',
    reaction: 'alphaCapture',
    title: 'Stabiler Alpha-Einfang',
    icon: 'O',
    description: 'Führt den Alpha-Einfang automatisch aus. Wird verfügbar, sobald du ihn einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'alphaCapture',
      lockedLabel: 'Einmal selbst fusionieren',
    },
  },
  carbonFusion: {
    id: 'carbonFusion',
    reaction: 'carbon',
    title: 'Stabile Kohlenstofffusion',
    icon: 'C',
    description: 'Führt die Kohlenstofffusion automatisch aus. Wird verfügbar, sobald du sie einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'carbon',
      lockedLabel: 'Einmal selbst fusionieren',
    },
  },
  neonFusion: {
    id: 'neonFusion',
    reaction: 'neon',
    title: 'Stabile Neonfusion',
    icon: 'Ne',
    description: 'Führt die Neonfusion automatisch aus. Wird verfügbar, sobald du sie einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'neon',
      lockedLabel: 'Einmal selbst fusionieren',
    },
  },
  oxygenFusion: {
    id: 'oxygenFusion',
    reaction: 'oxygen',
    title: 'Stabile Sauerstofffusion',
    icon: 'O',
    description: 'Führt die Sauerstofffusion automatisch aus. Wird verfügbar, sobald du sie einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'oxygen',
      lockedLabel: 'Einmal selbst fusionieren',
    },
  },
  siliconFusion: {
    id: 'siliconFusion',
    reaction: 'silicon',
    title: 'Stabile Siliziumfusion',
    icon: 'Si',
    description: 'Führt die Siliziumfusion automatisch aus. Wird verfügbar, sobald du sie einmal selbst ausgelöst hast.',
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
      kind: 'manualExperience',
      reaction: 'silicon',
      lockedLabel: 'Einmal selbst fusionieren',
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
