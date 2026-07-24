import type { LogEntry, PerkState, RunStatistics, Stage, UpgradeState } from '../game/types';
import { ACCRETION, TEMPERATURE_MODEL, THRESHOLDS } from './progression';

export type UpgradeId = keyof UpgradeState;

// Deklarative Kaufwirkung eines Upgrades (Punkt 6): die Engine kennt keine
// einzelnen Upgrades mehr, sondern führt nur noch aus, was hier hinterlegt
// ist. `effect` referenziert eine benannte Zusatzwirkung aus dem kleinen
// Effekt-Register der Engine ('captureCompressionBaseline' speichert die beim
// Kauf erreichte Kompressionswärme als Basiswert der Deuterium-Beschleunigung,
// damit die Temperatur nicht rückwirkend springt).
export interface UpgradePurchaseDefinition {
  effect?: 'captureCompressionBaseline';
  log?: { text: string; kind: LogEntry['kind'] };
  statCounter?: keyof RunStatistics;
}

interface UpgradeCostDefinition {
  base: number;
  growth: number;
}

interface UpgradeRequirements {
  minimumStarMass?: number;
  minimumTemperature?: number;
  maximumTemperature?: number;
}

type UpgradeValueDefinition = {
  kind: 'levelMultiplier';
  base: number;
  perLevel: number;
  persistentPerk?: keyof PerkState;
  persistentPerkEffect?: number;
} | {
  kind: 'toggle';
  inactive: string;
  active: string;
};

export interface UpgradeDefinition {
  id: UpgradeId;
  mode: 'repeatable' | 'single';
  title: string;
  icon: string;
  description: string;
  action: string;
  cardClass?: string;
  hiddenStages: readonly Stage[];
  requirements: UpgradeRequirements;
  supply?: { kind: 'cloudMatter'; exhaustedLabel: string };
  cost: UpgradeCostDefinition;
  maxLevel: number;
  value: UpgradeValueDefinition;
  detail: { inactive: string; active: string };
  button: { purchase: string; locked: string; expired: string; complete: string };
  purchase?: UpgradePurchaseDefinition;
}

export const UPGRADES = {
  gravity: {
    id: 'gravity',
    mode: 'repeatable',
    title: 'Gravitative Verdichtung',
    icon: 'G',
    description: 'Erhöht die eingesammelte Materie pro Klick und pro Sekunde.',
    action: 'buy-gravity',
    cardClass: 'featured',
    hiddenStages: [],
    requirements: {},
    supply: { kind: 'cloudMatter', exhaustedLabel: 'Urwolke erschöpft' },
    cost: { base: 3, growth: 2.5 },
    maxLevel: 5,
    value: {
      kind: 'levelMultiplier',
      base: 1,
      perLevel: ACCRETION.gravityBonusPerLevel,
      persistentPerk: 'permanentGravity',
      persistentPerkEffect: ACCRETION.permanentGravityBonusPerLevel,
    },
    detail: { inactive: '', active: '' },
    button: { purchase: 'Verdichten', locked: 'Verdichten', expired: 'Phase beendet', complete: 'Maximum' },
  },
  deuteriumBurning: {
    id: 'deuteriumBurning',
    mode: 'single',
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
    cost: { base: 75, growth: 1 },
    maxLevel: 1,
    value: { kind: 'toggle', inactive: 'inaktiv', active: '×1,35' },
    detail: { inactive: 'Einmaliges Upgrade für die Protosternphase', active: 'Erwärmung beschleunigt' },
    button: { purchase: 'Aktivieren', locked: 'Ab 1 Mio. K', expired: 'Phase beendet', complete: 'Aktiv' },
    purchase: {
      effect: 'captureCompressionBaseline',
      log: { text: 'Deuteriumbrennen beschleunigt ab jetzt die weitere Kompressionswärme.', kind: 'fusion' },
      statCounter: 'deuteriumBurns',
    },
  },
} as const satisfies Record<UpgradeId, UpgradeDefinition>;

export const UPGRADE_ORDER = ['gravity', 'deuteriumBurning'] as const satisfies readonly UpgradeId[];

export const DEUTERIUM_UPGRADE_COST = UPGRADES.deuteriumBurning.cost.base;
export const DEUTERIUM_TEMPERATURE_MULTIPLIER = TEMPERATURE_MODEL.deuteriumMultiplier;
