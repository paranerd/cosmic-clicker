import type { ReactionId } from '../game/types';
import { REACTIONS, type Warning } from './reactions';
import { THRESHOLDS } from './progression';

export type { Warning };

export interface ObjectiveDefinition {
  eyebrow: string;
  title: string;
  detail: string;
  // Verpflichtender Erfolgstitel für das Ziel-Banner, sobald dieses Ziel
  // abgeschlossen ist. Neue statische Objectives können dadurch nicht mehr
  // versehentlich ohne Achievement-Text angelegt werden.
  achievementTitle: string;
  // Zusätzlicher Warnhinweis, der beim Erreichen dieses Ziels einmalig im
  // Achievement-Banner erscheint (z. B. "Sternwind setzt ein").
  warning?: Warning;
}

export type StaticObjectiveId =
  | 'review-cycle'
  | 'collect-first-matter'
  | 'generate-first-energy'
  | 'generate-upgrade-energy'
  | 'form-protostar'
  | 'heat-protostar'
  | 'ignite-hydrogen'
  | 'stabilize-star';

type TargetedObjectiveId =
  | 'collect-first-matter'
  | 'generate-first-energy'
  | 'generate-upgrade-energy';

type ObjectiveDefinitions = {
  [Id in StaticObjectiveId]: Id extends TargetedObjectiveId
    ? ObjectiveDefinition & { target: number }
    : ObjectiveDefinition;
};

// Ziele der frühen Formationsphasen und des Rundenabschlusses, die keiner
// Reaktion entsprechen. Die reaktionsbezogenen Zielphasen (`ignite-<reaktion>`
// für die Kernkontraktion vor der nächsten Zündung, `burn-<reaktion>` für die
// aktive Brennphase) werden dagegen generisch aus REACTIONS gebaut, siehe
// objectiveFor() in game/engine.ts und OBJECTIVE_EYEBROWS/OBJECTIVE_TEMPLATES
// unten; ihre Erfolgstitel und Warnungen liegen entsprechend direkt bei
// der jeweiligen Reaktionsdefinition in reactions.ts.
export const OBJECTIVES: ObjectiveDefinitions = {
  'review-cycle': {
    eyebrow: 'Entwicklung abgeschlossen',
    title: 'Runde auswerten',
    detail: 'Investiere Sternenstaub oder beginne den nächsten Zyklus.',
    achievementTitle: 'Zyklus ausgewertet',
  },
  'collect-first-matter': {
    target: 1,
    eyebrow: 'Erstes Ziel',
    title: 'Sammle 1 ME Materie ein',
    detail: 'Ziehe die erste Materie aus der Urwolke in den entstehenden Stern.',
    achievementTitle: 'Glückwunsch – die erste Materie ist gesammelt!',
  },
  'generate-first-energy': {
    target: 1,
    eyebrow: 'Nächstes Ziel',
    title: 'Erzeuge 1 MeV Energie',
    detail: 'Sammle weiter Materie. Ihre Verdichtung setzt nach und nach Energie frei.',
    achievementTitle: 'Erste Energie erzeugt',
  },
  'generate-upgrade-energy': {
    target: 3,
    eyebrow: 'Nächstes Ziel',
    title: 'Erzeuge 3 MeV Energie',
    detail: 'Sammle genügend Materie, um dein erstes Upgrade freizuschalten.',
    achievementTitle: 'Erstes Upgrade verfügbar',
  },
  'form-protostar': {
    eyebrow: 'Nächstes Ziel',
    title: 'Bilde einen Protostern',
    detail: 'Sammle weiter Wasserstoff, um die Materie im Zentrum der Urwolke zu verdichten.',
    achievementTitle: 'Protostern gebildet',
    warning: {
      title: 'Sternwind setzt ein',
      text: 'Er trägt fortan stetig Materie aus der Urwolke ab. Diese Materie kann nicht mehr eingesammelt werden.',
    },
  },
  // Neu (vormals mit „ignite-hydrogen“ zusammengefasst): eigenständiges Ziel
  // für die Protostern-Phase, bis 1 Mio. K erreicht sind und Deuteriumbrennen
  // aktivierbar wird.
  'heat-protostar': {
    eyebrow: 'Nächstes Ziel',
    title: `Erreiche ${THRESHOLDS.deuteriumTemperature.toLocaleString('de-DE')} K`,
    detail: 'Verdichte weiter, bis Deuteriumbrennen aktiviert werden kann.',
    achievementTitle: `${THRESHOLDS.deuteriumTemperature.toLocaleString('de-DE')} Kelvin erreicht`,
  },
  'ignite-hydrogen': {
    eyebrow: 'Nächstes Ziel',
    title: 'Zünde den Wasserstoffkern',
    detail: `Erreiche ${THRESHOLDS.hydrogenTemperature.toLocaleString('de-DE')} K und mindestens ${THRESHOLDS.hydrogenIgnitionMass.toLocaleString('de-DE')} ME Sternmasse durch weitere Verdichtung.`,
    achievementTitle: 'Wasserstofffusion gezündet',
  },
  // Neu (vormals nicht von der generischen Brennphase unterschieden): eigenes
  // Ziel für die Wasserstofffusion vor Erreichen der Hauptreihe.
  'stabilize-star': {
    eyebrow: 'Nächstes Ziel',
    title: 'Erreiche die Hauptreihe',
    detail: `Fusioniere ${THRESHOLDS.mainSequenceHydrogen.toLocaleString('de-DE')} ME Wasserstoff, damit der Stern die Hauptreihe erreicht.`,
    achievementTitle: 'Hauptreihe erreicht',
  },
};

export const OBJECTIVE_EYEBROWS = {
  contraction: 'Kernkontraktion',
  activeBurn: 'Aktive Brennphase',
} as const;

// Textvorlagen für die generischen Kontraktions-Zielphasen, damit keine
// Formulierung pro Reaktion dupliziert werden muss. Die Texte der aktiven
// Brennphasen stehen seit Punkt 7 als `burnObjective` direkt an der
// jeweiligen Reaktionsdefinition in reactions.ts.
export const OBJECTIVE_TEMPLATES = {
  igniteTitle: (reactionTitle: string): string => `${reactionTitle} zünden`,
  igniteDetail: (ignitionTemperature: number, requiredSolarMasses: string): string =>
    `Der erschöpfte Kern kontrahiert bis ${ignitionTemperature.toLocaleString('de-DE')} K (benötigt ≥ ${requiredSolarMasses} M☉).`,
} as const;

// Generischer Auflöser für Erfolgstitel: zuerst die statischen Formationsziele
// oben (OBJECTIVES[id].achievementTitle), sonst per Muster
// `ignite-<reaktion>`/`burn-<reaktion>` direkt aus der jeweiligen
// Reaktionsdefinition. Liefert nur für unbekannte IDs `undefined`;
// Alpha-Einfang besitzt keine separate Zündungs-Zielphase und damit auch
// keine entsprechende Ziel-ID.
export function achievementTitleFor(objectiveId: string): string | undefined {
  if (objectiveId in OBJECTIVES) return OBJECTIVES[objectiveId as StaticObjectiveId].achievementTitle;
  const ignited = /^ignite-(.+)$/.exec(objectiveId);
  if (ignited) return REACTIONS[ignited[1] as ReactionId]?.ignitionAchievementTitle;
  const burned = /^burn-(.+)$/.exec(objectiveId);
  if (burned) return REACTIONS[burned[1] as ReactionId]?.completionAchievementTitle;
  return undefined;
}

// Generischer Auflöser für Warnungen (Punkt 4, vormals windWarningFor),
// symmetrisch zu achievementTitleFor: zuerst die statischen Formationsziele
// (OBJECTIVES[id].warning), sonst per Muster `burn-<reaktion>` die
// reaktionseigene completionWarning (aktuell nur bei Wasserstoff gesetzt,
// siehe reactions.ts).
export function warningFor(objectiveId: string): Warning | undefined {
  if (objectiveId in OBJECTIVES) return OBJECTIVES[objectiveId as StaticObjectiveId].warning;
  const burned = /^burn-(.+)$/.exec(objectiveId);
  if (burned) return REACTIONS[burned[1] as ReactionId]?.completionWarning;
  return undefined;
}
