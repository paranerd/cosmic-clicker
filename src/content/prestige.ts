import type { PerkState, StellarOutcome } from '../game/types';
import { levelValue, type LevelFormula } from './level-formula';

export type PrestigePerkId = keyof PerkState;

interface PrestigePerkDefinition {
  title: string;
  maxLevel: number;
  cost: LevelFormula;
  value: LevelFormula;
  effectLabel: string;
  comparison: 'relative' | 'base';
  hideEffectAtMaximum: boolean;
}

const formatPercent = (value: number): string =>
  value.toLocaleString('de-DE', {
    maximumFractionDigits: 0,
  });

export const OUTCOME_LABELS: Record<StellarOutcome, string> = {
  brownDwarf: 'Brauner Zwerg',
  heliumWhiteDwarf: 'Helium-Weißer-Zwerg',
  whiteDwarf: 'Weißer Zwerg',
  oxygenNeonWhiteDwarf: 'O/Ne-Weißer-Zwerg',
  neutronStar: 'Neutronenstern',
  blackHole: 'Schwarzes Loch',
  legacyMainSequence: 'Hauptreihenstern · v0.2',
};

export const OUTCOMES: Record<StellarOutcome, {
  title: string;
  description: string;
  stardust: number;
}> = {
  brownDwarf: {
    title: 'Eine Massengrenze wird sichtbar.',
    description: 'Die kleine Wolke wurde vollständig gebunden, blieb aber zu leicht für dauerhafte Wasserstofffusion.',
    stardust: 2,
  },
  heliumWhiteDwarf: {
    title: 'Ein Helium-Weißer-Zwerg bleibt zurück.',
    description: 'Nach dem Wasserstoffende war der Kern zu leicht, um Helium zu zünden.',
    stardust: 4,
  },
  whiteDwarf: {
    title: 'Ein Weißer Zwerg bleibt zurück.',
    description: 'Der sonnenähnliche Stern hat seine Hülle abgestoßen. Sein Kohlenstoff-Sauerstoff-Kern glüht weiter.',
    stardust: 5,
  },
  oxygenNeonWhiteDwarf: {
    title: 'Ein O/Ne-Weißer-Zwerg bleibt zurück.',
    description: 'Kohlenstoff brannte, doch die Masse reichte nicht für den vollständigen Weg bis zum Eisenkern.',
    stardust: 6,
  },
  neutronStar: {
    title: 'Ein Neutronenstern entsteht.',
    description: 'Die Supernova hat einen extrem dichten kompakten Sternrest hinterlassen.',
    stardust: 8,
  },
  blackHole: {
    title: 'Ein Schwarzes Loch entsteht.',
    description: 'Die Endmasse war so groß, dass kein bekannter Druck den Kollaps aufhalten konnte.',
    stardust: 10,
  },
  legacyMainSequence: {
    title: 'Ein Hauptreihenstern wurde archiviert.',
    description: 'Dieser Abschluss stammt aus dem v0.2-Lebenszyklus.',
    stardust: 0,
  },
};

export const PRESTIGE_PERKS = {
  largerCloud: {
    title: 'Wolkenmasse',
    effectLabel: 'maximale Wolkenmasse',
    comparison: 'relative',
    hideEffectAtMaximum: false,
    // Wolkenwachstum ist ein offener, prozentualer Perk. Diese großzügige
    // technische Obergrenze verhindert lediglich unbrauchbar große Werte.
    maxLevel: 24,
    cost: {
      baseCost: 2,
      growthFactor: 1,
      quadraticCoefficient: 0,
      linearCoefficient: 3,
    },
    value: {
      baseCost: 1,
      growthFactor: 2,
      quadraticCoefficient: 0,
      linearCoefficient: 0,
    },
  },
  permanentGravity: {
    title: 'Gravitatives Gedächtnis',
    effectLabel: 'Akkretionsrate',
    comparison: 'relative',
    hideEffectAtMaximum: true,
    maxLevel: 10,
    cost: {
      baseCost: 2,
      growthFactor: 1,
      quadraticCoefficient: 0,
      linearCoefficient: 2,
    },
    // Allgemeine Kurve mit starken frühen und schwächeren späten Zuwächsen.
    // Die Parameter erhalten den bisherigen Start (×2,35 auf Stufe 1) und
    // Endwert (≈ ×8,23 auf Stufe 10), ohne eine Perk-spezifische Formel.
    value: {
      baseCost: 1,
      growthFactor: 1.2074,
      quadraticCoefficient: -.10869112832982737,
      linearCoefficient: 1.2512911283298274,
    },
  },
  fusionMemory: {
    title: 'Fusionsgedächtnis',
    effectLabel: 'Fusion',
    comparison: 'base',
    hideEffectAtMaximum: false,
    maxLevel: 5,
    cost: {
      baseCost: 3,
      growthFactor: 1,
      quadraticCoefficient: 0,
      linearCoefficient: 3,
    },
    value: {
      baseCost: 1,
      growthFactor: 1,
      quadraticCoefficient: 0,
      linearCoefficient: .15,
    },
  },
} as const satisfies Record<PrestigePerkId, PrestigePerkDefinition>;

export const prestigePerkValue = (perk: PrestigePerkId, level: number): number => {
  const definition = PRESTIGE_PERKS[perk];
  const safeLevel = Math.max(0, Math.min(definition.maxLevel, Math.floor(level)));
  return levelValue(safeLevel, definition.value);
};

export const prestigePerkDescription = (perk: PrestigePerkId, level: number): string => {
  const definition = PRESTIGE_PERKS[perk];
  if (definition.hideEffectAtMaximum && level >= definition.maxLevel) return 'Maximum erreicht.';
  const current = prestigePerkValue(perk, level);
  const next = prestigePerkValue(perk, level + 1);
  const reference = definition.comparison === 'relative' ? current : prestigePerkValue(perk, 0);
  const increasePercent = reference === 0 ? 0 : (next - current) / reference * 100;
  return `+${formatPercent(increasePercent)}% ${definition.effectLabel}`;
};
