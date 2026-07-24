import type { LogEntry, PerkState, RunStatistics, Stage, UpgradeState } from '../game/types';
import type { LevelFormula } from './level-formula';
import { THRESHOLDS } from './progression';

export type UpgradeId = keyof UpgradeState;

// Deklarative Kaufwirkung eines Upgrades (Punkt 6): die Engine kennt keine
// einzelnen Upgrades mehr, sondern führt nur noch aus, was hier hinterlegt
// ist. `effect` referenziert eine benannte Zusatzwirkung aus dem kleinen
// Effekt-Register der Engine ('captureCompressionBaseline' speichert die beim
// Kauf erreichte Kompressionswärme als Basiswert der Deuterium-Beschleunigung,
// damit die Temperatur nicht rückwirkend springt).
export interface UpgradePurchaseDefinition {
  effect?: 'captureCompressionBaseline';
  log?: {
    text: string;
    kind: LogEntry['kind'];
  };
  statCounter?: keyof RunStatistics;
}

interface UpgradeRequirements {
  minimumStarMass?: number;
  minimumTemperature?: number;
  maximumTemperature?: number;
}

interface UpgradeValueDefinition {
  formula: LevelFormula;
  persistentPerk?: keyof PerkState;
  detail: {
    inactive: string;
    active: string;
  };
}

export interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  icon: string;
  description: string;
  action: string;
  cardClass?: string;
  hiddenStages: readonly Stage[];
  requirements: UpgradeRequirements;
  supply?: {
    kind: 'cloudMatter';
    exhaustedLabel: string;
  };
  cost: LevelFormula;
  maxLevel: number;
  value: UpgradeValueDefinition;
  button: {
    purchase: string;
    locked: string;
    expired: string;
    complete: string;
  };
  purchase?: UpgradePurchaseDefinition;
}

export const UPGRADES = {
  gravity: {
    id: 'gravity',
    title: 'Gravitative Verdichtung',
    icon: 'G',
    description: 'Erhöht die eingesammelte Materie pro Klick und pro Sekunde.',
    action: 'buy-gravity',
    cardClass: 'featured',
    hiddenStages: [],
    requirements: {},
    supply: {
      kind: 'cloudMatter',
      exhaustedLabel: 'Urwolke erschöpft',
    },
    cost: {
      baseCost: 3,
      growthFactor: 2.5,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 10,
    value: {
      formula: {
        baseCost: 1,
        growthFactor: 1,
        quadraticCoefficient: 0,
        linearCoefficient: 2,
      },
      persistentPerk: 'permanentGravity',
      detail: {
        inactive: '',
        active: '',
      },
    },
    button: {
      purchase: 'Verdichten',
      locked: 'Verdichten',
      expired: 'Phase beendet',
      complete: 'Maximum',
    },
  },
  deuteriumBurning: {
    id: 'deuteriumBurning',
    title: 'Deuteriumbrennen',
    icon: 'D',
    description: 'Beschleunigt die kompressionsbedingte Erwärmung um 35 %. Der Effekt endet beim Freischalten der Wasserstofffusion.',
    action: 'buy-deuterium',
    cardClass: 'deuterium-upgrade',
    hiddenStages: ['nebula'],
    requirements: {
      minimumStarMass: THRESHOLDS.protostarMass,
      minimumTemperature: THRESHOLDS.deuteriumTemperature,
      maximumTemperature: THRESHOLDS.hydrogenTemperature,
    },
    cost: {
      baseCost: 75,
      growthFactor: 1,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
    maxLevel: 1,
    value: {
      formula: {
        baseCost: 1,
        growthFactor: 1,
        quadraticCoefficient: 0,
        linearCoefficient: .35,
      },
      detail: {
        inactive: 'Einmaliges Upgrade für die Protosternphase',
        active: 'Erwärmung beschleunigt',
      },
    },
    button: {
      purchase: 'Aktivieren',
      locked: 'Ab 1 Mio. K',
      expired: 'Phase beendet',
      complete: 'Aktiv',
    },
    purchase: {
      effect: 'captureCompressionBaseline',
      log: {
        text: 'Deuteriumbrennen beschleunigt ab jetzt die weitere Kompressionswärme.',
        kind: 'fusion',
      },
      statCounter: 'deuteriumBurns',
    },
  },
} as const satisfies Record<UpgradeId, UpgradeDefinition>;

export const UPGRADE_ORDER = [
  'gravity',
  'deuteriumBurning',
] as const satisfies readonly UpgradeId[];
