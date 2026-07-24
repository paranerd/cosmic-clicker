/**
 * Konfigurierbare Kurve für Kosten oder Erträge einer Stufe.
 *
 * Alle vier Parameter liegen direkt am jeweiligen Spielobjekt. Dadurch kann
 * das Balancing angepasst werden, ohne Berechnungslogik in der Engine zu
 * verändern.
 */
export interface LevelFormula {
  baseCost: number;
  growthFactor: number;
  quadraticCoefficient: number;
  linearCoefficient: number;
}

/**
 * Berechnet die Kosten oder den Ertrag eines Spielobjekts für eine Stufe.
 *
 * cost(level) = baseCost × growthFactor^level
 *             + quadraticCoefficient × level²
 *             + linearCoefficient × level
 */
export function upgradeCost(
  level: number,
  baseCost: number,
  growthFactor = 1,
  quadraticCoefficient = 0,
  linearCoefficient = 0,
): number {
  return (
    baseCost * Math.pow(growthFactor, level)
    + quadraticCoefficient * level * level
    + linearCoefficient * level
  );
}

/** Wertet eine am Spielobjekt gespeicherte Formel aus. */
export const levelValue = (level: number, formula: LevelFormula): number =>
  upgradeCost(
    level,
    formula.baseCost,
    formula.growthFactor,
    formula.quadraticCoefficient,
    formula.linearCoefficient,
  );
