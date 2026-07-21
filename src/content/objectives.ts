import type { ReactionId } from '../game/types';
import { REACTIONS, type WindWarning } from './reactions';
import { THRESHOLDS } from './progression';

export type { WindWarning };

export interface ObjectiveDefinition {
  eyebrow: string;
  title: string;
  detail: string;
  // Erfolgstitel für das Ziel-Banner, sobald dieses Ziel abgeschlossen ist.
  // Fehlt bei Zielen, die selbst nie als "completedObjective" auftauchen
  // (aktuell nur `review-cycle`, siehe achievementTitleFor unten).
  achievementTitle?: string;
  // Zusätzlicher Warnhinweis, der beim Erreichen dieses Ziels einmalig im
  // Achievement-Banner erscheint (z. B. "Sternwind setzt ein").
  windWarning?: WindWarning;
}

export type StaticObjectiveId = 'review-cycle' | 'form-protostar' | 'heat-protostar' | 'ignite-hydrogen' | 'stabilize-star';

// Ziele der frühen Formationsphasen und des Rundenabschlusses, die keiner
// Reaktion entsprechen. Die reaktionsbezogenen Zielphasen (`ignite-<reaktion>`
// für die Kernkontraktion vor der nächsten Zündung, `burn-<reaktion>` für die
// aktive Brennphase) werden dagegen generisch aus REACTIONS gebaut, siehe
// objectiveFor() in game/engine.ts und OBJECTIVE_EYEBROWS/OBJECTIVE_TEMPLATES
// unten; ihre Erfolgstitel und Windwarnungen liegen entsprechend direkt bei
// der jeweiligen Reaktionsdefinition in reactions.ts.
export const OBJECTIVES: Record<StaticObjectiveId, ObjectiveDefinition> = {
  'review-cycle': {
    eyebrow: 'Entwicklung abgeschlossen',
    title: 'Runde auswerten',
    detail: 'Investiere Sternenstaub oder beginne den nächsten Zyklus.',
  },
  'form-protostar': {
    eyebrow: 'Erstes Ziel',
    title: 'Protostern bilden',
    detail: 'Verdichte die Materie der Urwolke im Zentrum.',
    achievementTitle: 'Protostern gebildet',
    windWarning: {
      title: 'Sternwind setzt ein',
      text: 'Er trägt fortan stetig Materie aus der Urwolke ab. Diese Materie kann nicht mehr eingesammelt werden.',
    },
  },
  // Neu (vormals mit „ignite-hydrogen“ zusammengefasst): eigenständiges Ziel
  // für die Protostern-Phase, bis 1 Mio. K erreicht sind und Deuteriumbrennen
  // aktivierbar wird.
  'heat-protostar': {
    eyebrow: 'Nächstes Ziel',
    title: `${THRESHOLDS.deuteriumTemperature.toLocaleString('de-DE')} K erreichen`,
    detail: 'Verdichte weiter, bis Deuteriumbrennen aktiviert werden kann.',
    achievementTitle: '1 Mio. Kelvin erreicht',
  },
  'ignite-hydrogen': {
    eyebrow: 'Nächstes Ziel',
    title: 'Wasserstoffkern zünden',
    detail: `Erreiche ${THRESHOLDS.hydrogenTemperature.toLocaleString('de-DE')} K durch weitere Verdichtung.`,
  },
  // Neu (vormals nicht von der generischen Brennphase unterschieden): eigenes
  // Ziel für die Wasserstofffusion vor Erreichen der Hauptreihe.
  'stabilize-star': {
    eyebrow: 'Nächstes Ziel',
    title: 'Hauptreihe erreichen',
    detail: `Fusioniere weiter Wasserstoff, bis ${THRESHOLDS.mainSequenceHydrogen.toLocaleString('de-DE')} ME umgesetzt sind und der Stern die Hauptreihe erreicht.`,
    achievementTitle: 'Hauptreihe erreicht',
  },
};

export const OBJECTIVE_EYEBROWS = {
  contraction: 'Kernkontraktion',
  activeBurn: 'Aktive Brennphase',
} as const;

// Textvorlagen für die generischen, reaktionsbasierten Zielphasen, damit
// keine Formulierung pro Reaktion dupliziert werden muss.
export const OBJECTIVE_TEMPLATES = {
  igniteTitle: (reactionTitle: string): string => `${reactionTitle} zünden`,
  igniteDetail: (ignitionTemperature: number, requiredSolarMasses: string): string =>
    `Der erschöpfte Kern kontrahiert bis ${ignitionTemperature.toLocaleString('de-DE')} K (benötigt ≥ ${requiredSolarMasses} M☉).`,
  burnDetail: (equationInput: string): string => `Fusioniere den verfügbaren ${equationInput}-Brennstoff im Kern.`,
} as const;

// Generischer Auflöser für Erfolgstitel: zuerst die statischen Formationsziele
// oben (OBJECTIVES[id].achievementTitle), sonst per Muster
// `ignite-<reaktion>`/`burn-<reaktion>` direkt aus der jeweiligen
// Reaktionsdefinition. Liefert `undefined`, wenn die ID kein bekanntes Ziel
// ist oder (wie bei Alpha-Einfangs Zündung) keinen eigenen Erfolgstitel
// besitzt — der Aufrufer zeigt dann kein Banner.
export function achievementTitleFor(objectiveId: string): string | undefined {
  if (objectiveId in OBJECTIVES) return OBJECTIVES[objectiveId as StaticObjectiveId].achievementTitle;
  const ignited = /^ignite-(.+)$/.exec(objectiveId);
  if (ignited) return REACTIONS[ignited[1] as ReactionId]?.ignitionAchievementTitle;
  const burned = /^burn-(.+)$/.exec(objectiveId);
  if (burned) return REACTIONS[burned[1] as ReactionId]?.completionAchievementTitle;
  return undefined;
}

// Generischer Auflöser für Windwarnungen, symmetrisch zu achievementTitleFor:
// zuerst die statischen Formationsziele (OBJECTIVES[id].windWarning), sonst
// per Muster `burn-<reaktion>` die reaktionseigene completionWindWarning
// (aktuell nur bei Wasserstoff gesetzt, siehe reactions.ts).
export function windWarningFor(objectiveId: string): WindWarning | undefined {
  if (objectiveId in OBJECTIVES) return OBJECTIVES[objectiveId as StaticObjectiveId].windWarning;
  const burned = /^burn-(.+)$/.exec(objectiveId);
  if (burned) return REACTIONS[burned[1] as ReactionId]?.completionWindWarning;
  return undefined;
}
