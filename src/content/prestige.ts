import type { PerkState, StellarOutcome } from '../game/types';
import { levelValue, type LevelFormula } from './level-formula';

export type PrestigePerkId = keyof PerkState;

interface PrestigePerkDefinition {
  title: string;
  icon: string;
  description: string;
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

// Sternenstaub wächst mit der tatsächlichen Leistung einer Runde, nicht mehr
// allein mit der Kategorie des Endzustands.
//
// Vorher waren die Belohnungen feste kleine Ganzzahlen (2 bis 10, Spannweite
// 5×), während die Rundendauer über die Wolkenstufen um Faktor 20 wuchs. Das
// Ergebnis war eine invertierte Ökonomie: Eine 4,8-Minuten-Runde auf
// Wolkenstufe 3 warf 62 ✦/h ab, ein 1,6-Stunden-Schwarzes-Loch nur 6,3 ✦/h.
// Wer optimierte, musste dauerhaft klein bleiben — genau gegen die Erzählung
// des Spiels.
//
// Der Multiplikator setzt bei der halben Sonnenmasse an (der Heliumzündmasse)
// und bleibt darunter bei 1, damit die kalibrierten frühen Belohnungen
// unverändert bleiben: Der erste Braune Zwerg zahlt weiterhin exakt 2 ✦ und
// finanziert damit exakt die erste Wolkenstufe.
// Der Exponent liegt bewusst unter dem Kostenwachstum der Wolkenleiter: Die
// Belohnung wächst je Wolkenstufe um Faktor 2^0,45 ≈ 1,37, die nächste Stufe
// kostet aber Faktor 1,55 mehr. Dadurch verlangt jede weitere Stufe etwas mehr
// Runden als die vorige — die Leiter beschleunigt nicht, sondern wird sanft
// steiler und trägt dadurch über Wochen statt über Stunden.
export const STARDUST_MASS_SCALING = {
  referenceSolarMasses: .5,
  exponent: .45,
} as const;

export const stardustMassMultiplier = (finalSolarMasses: number): number =>
  Math.max(1, (Math.max(0, finalSolarMasses) / STARDUST_MASS_SCALING.referenceSolarMasses) ** STARDUST_MASS_SCALING.exponent);

export const stardustReward = (outcome: StellarOutcome, finalSolarMasses: number): number =>
  Math.round(OUTCOMES[outcome].stardust * stardustMassMultiplier(finalSolarMasses));

export const PRESTIGE_PERKS = {
  largerCloud: {
    title: 'Wolkenmasse',
    icon: 'M',
    description: 'Vergrößert die maximal wählbare Urwolke dauerhaft.',
    effectLabel: 'maximale Wolkenmasse',
    comparison: 'relative',
    hideEffectAtMaximum: false,
    // Wolkenwachstum ist ein offener, prozentualer Perk. Diese großzügige
    // technische Obergrenze verhindert lediglich unbrauchbar große Werte.
    maxLevel: 24,
    // Die Kosten wachsen jetzt exponentiell statt linear. Solange die
    // Belohnung fix war, passte eine lineare Kurve (2, 5, 8, …) — mit einem
    // massenabhängigen Ertrag, der sich pro Stufe etwa um Faktor 1,54
    // erhöht, wäre sie sofort kollabiert: Ab Stufe 9 hätte eine einzige Runde
    // mehrere Stufen auf einmal bezahlt. Der Wachstumsfaktor 1,55 hält die
    // Zahl der Runden je Stufe über die gesamte Leiter annähernd konstant.
    //
    // Der lineare Anteil bleibt erhalten, damit die ersten Stufen ihre
    // kalibrierten Preise behalten: Stufe 1 kostet weiterhin exakt 2 ✦ und
    // damit genau die Belohnung des ersten Braunen Zwergs.
    cost: {
      baseCost: 2,
      growthFactor: 1.55,
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
    icon: 'G',
    description: 'Erhöht die Akkretionsrate dauerhaft in jedem Zyklus.',
    effectLabel: 'Akkretionsrate',
    comparison: 'relative',
    hideEffectAtMaximum: true,
    // Von 10 auf 16 angehoben. Die Akkretionsrate bestimmt, wie lange der
    // manuelle Anschub zu Rundenbeginn dauert — die einzige Phase, die auch
    // im späten Spiel Anwesenheit verlangt. Ein Perk, der genau diese Phase
    // verkürzt, ist der passende Dauerabnehmer für Sternenstaub. Die
    // Wertkurve steigt über den gesamten erweiterten Bereich monoton weiter
    // (Stufe 16 ≈ ×11,7), der negative quadratische Anteil kehrt sie nicht um.
    maxLevel: 16,
    cost: {
      baseCost: 2,
      growthFactor: 1.28,
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
    icon: 'F',
    description: 'Erhöht die Ausbeute aller Fusionsreaktionen dauerhaft.',
    effectLabel: 'Fusion',
    comparison: 'base',
    hideEffectAtMaximum: false,
    // Von 5 auf 20 angehoben (Stufe 20 = ×4,0). Mit nur fünf Stufen war der
    // Perk nach rund 45 ✦ erledigt und die permanente Progression bestand
    // faktisch nur noch aus der Wolkengröße.
    maxLevel: 20,
    cost: {
      baseCost: 3,
      growthFactor: 1.35,
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

export const PRESTIGE_PERK_ORDER = [
  'largerCloud',
  'permanentGravity',
  'fusionMemory',
] as const satisfies readonly PrestigePerkId[];

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
