import type { StellarOutcome } from '../game/types';
import { CLOUD_GROWTH } from './clouds';
import { ACCRETION, LIMITS } from './progression';

export const FUSION_MEMORY_BONUS_PER_LEVEL = .15;

export const OUTCOME_LABELS: Record<StellarOutcome, string> = {
  brownDwarf: 'Brauner Zwerg',
  heliumWhiteDwarf: 'Helium-Weißer-Zwerg',
  whiteDwarf: 'Weißer Zwerg',
  oxygenNeonWhiteDwarf: 'O/Ne-Weißer-Zwerg',
  neutronStar: 'Neutronenstern',
  blackHole: 'Schwarzes Loch',
  legacyMainSequence: 'Hauptreihenstern · v0.2',
};

export const OUTCOMES: Record<StellarOutcome, { title: string; description: string; stardust: number }> = {
  brownDwarf: { title: 'Eine Massengrenze wird sichtbar.', description: 'Die kleine Wolke wurde vollständig gebunden, blieb aber zu leicht für dauerhafte Wasserstofffusion.', stardust: 2 },
  heliumWhiteDwarf: { title: 'Ein Helium-Weißer-Zwerg bleibt zurück.', description: 'Nach dem Wasserstoffende war der Kern zu leicht, um Helium zu zünden.', stardust: 4 },
  whiteDwarf: { title: 'Ein Weißer Zwerg bleibt zurück.', description: 'Der sonnenähnliche Stern hat seine Hülle abgestoßen. Sein Kohlenstoff-Sauerstoff-Kern glüht weiter.', stardust: 5 },
  oxygenNeonWhiteDwarf: { title: 'Ein O/Ne-Weißer-Zwerg bleibt zurück.', description: 'Kohlenstoff brannte, doch die Masse reichte nicht für den vollständigen Weg bis zum Eisenkern.', stardust: 6 },
  neutronStar: { title: 'Ein Neutronenstern entsteht.', description: 'Die Supernova hat einen extrem dichten kompakten Sternrest hinterlassen.', stardust: 8 },
  blackHole: { title: 'Ein Schwarzes Loch entsteht.', description: 'Die Endmasse war so groß, dass kein bekannter Druck den Kollaps aufhalten konnte.', stardust: 10 },
  legacyMainSequence: { title: 'Ein Hauptreihenstern wurde archiviert.', description: 'Dieser Abschluss stammt aus dem v0.2-Lebenszyklus.', stardust: 0 },
};

export const PRESTIGE_PERKS = {
  largerCloud: {
    title: 'Wolkenmasse',
    description: `+${(CLOUD_GROWTH.growthFactorPerLevel - 1) * 100}% maximale Wolkenmasse`,
    maxLevel: LIMITS.cloudGrowthLevel,
    cost: (level: number): number => 2 + level * 3,
  },
  permanentGravity: {
    title: 'Gravitatives Gedächtnis',
    description: `+${ACCRETION.permanentGravityBonusPerLevel * 100}% Akkretionsrate`,
    maxLevel: LIMITS.permanentGravity,
    cost: (level: number): number => 2 + level * 2,
  },
  fusionMemory: {
    title: 'Fusionsgedächtnis',
    description: `+${FUSION_MEMORY_BONUS_PER_LEVEL * 100}% Fusion`,
    maxLevel: LIMITS.fusionMemory,
    cost: (level: number): number => 3 + level * 3,
  },
} as const;
