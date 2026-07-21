import type { ReactionId } from '../game/types';
import { REACTIONS } from './reactions';
import { THRESHOLDS } from './progression';

export interface ObjectiveDefinition {
  eyebrow: string;
  title: string;
  detail: string;
}

// Ziele der frühen Formationsphasen und des Rundenabschlusses, die keiner
// Reaktion entsprechen. Die reaktionsbezogenen Zielphasen (`ignite-<reaktion>`
// für die Kernkontraktion vor der nächsten Zündung, `burn-<reaktion>` für die
// aktive Brennphase) werden dagegen generisch aus REACTIONS gebaut, siehe
// objectiveFor() in game/engine.ts und OBJECTIVE_EYEBROWS/OBJECTIVE_TEMPLATES
// unten.
export const OBJECTIVES = {
  'review-cycle': {
    eyebrow: 'Entwicklung abgeschlossen',
    title: 'Runde auswerten',
    detail: 'Investiere Sternenstaub oder beginne den nächsten Zyklus.',
  },
  'form-protostar': {
    eyebrow: 'Erstes Ziel',
    title: 'Protostern bilden',
    detail: 'Verdichte die Materie der Urwolke im Zentrum.',
  },
  // Neu (vormals mit „ignite-hydrogen“ zusammengefasst): eigenständiges Ziel
  // für die Protostern-Phase, bis 1 Mio. K erreicht sind und Deuteriumbrennen
  // aktivierbar wird.
  'heat-protostar': {
    eyebrow: 'Nächstes Ziel',
    title: `${THRESHOLDS.deuteriumTemperature.toLocaleString('de-DE')} K erreichen`,
    detail: 'Verdichte weiter, bis Deuteriumbrennen aktiviert werden kann.',
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
  },
} satisfies Record<string, ObjectiveDefinition>;

export type StaticObjectiveId = keyof typeof OBJECTIVES;

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

// Erfolgstitel, die keiner Reaktion entsprechen. Reaktionsbezogene
// Erfolgstitel (`ignite-<reaktion>`/`burn-<reaktion>`) liegen direkt bei der
// jeweiligen Reaktionsdefinition in reactions.ts.
const STATIC_ACHIEVEMENT_TITLES: Partial<Record<StaticObjectiveId, string>> = {
  'form-protostar': 'Protostern gebildet',
  'heat-protostar': '1 Mio. Kelvin erreicht',
  'stabilize-star': 'Hauptreihe erreicht',
};

// Generischer Auflöser für Erfolgstitel: zuerst die statischen Formationsziele
// oben, sonst per Muster `ignite-<reaktion>`/`burn-<reaktion>` direkt aus der
// jeweiligen Reaktionsdefinition. Liefert `undefined`, wenn die ID kein
// bekanntes Ziel ist oder (wie bei Alpha-Einfangs Zündung) keinen eigenen
// Erfolgstitel besitzt — der Aufrufer zeigt dann kein Banner.
export function achievementTitleFor(objectiveId: string): string | undefined {
  if (objectiveId in STATIC_ACHIEVEMENT_TITLES) return STATIC_ACHIEVEMENT_TITLES[objectiveId as StaticObjectiveId];
  const ignited = /^ignite-(.+)$/.exec(objectiveId);
  if (ignited) return REACTIONS[ignited[1] as ReactionId]?.ignitionAchievementTitle;
  const burned = /^burn-(.+)$/.exec(objectiveId);
  if (burned) return REACTIONS[burned[1] as ReactionId]?.completionAchievementTitle;
  return undefined;
}
