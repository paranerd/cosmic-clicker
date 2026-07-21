// Punkt 4: Aktive, zustandsgebundene Warnungen. Sie beschreiben laufende
// Verlustprozesse (nicht einmalige Wendepunkte — die stehen als `warning`
// an Zielen und Reaktionen und erscheinen einmalig im Ziel-Banner). Ob eine
// Warnung gerade aktiv ist und mit welcher Rate, berechnet die Engine in
// `activeWarnings()`; hier stehen nur die Texte. Die Oberfläche zeigt bei
// mindestens einer aktiven Warnung ein Warnsymbol unten rechts in der Star
// Chamber, dessen Popover alle aktiven Warnungen auflistet.
export type ActiveWarningId = 'cloudWind' | 'shellWind';

export interface ActiveWarningDefinition {
  title: string;
  text: string;
}

export const ACTIVE_WARNINGS: Record<ActiveWarningId, ActiveWarningDefinition> = {
  cloudWind: {
    title: 'Sternwind aktiv',
    text: 'Trägt laufend Materie aus der Urwolke ab. Diese Materie kann nicht mehr eingesammelt werden.',
  },
  shellWind: {
    title: 'Hüllenwind aktiv',
    text: 'Der Stern verliert Wasserstoff und Helium aus seiner eigenen Hülle. Anhaltender Verlust kann den späteren Sternrest verändern.',
  },
};

export const ACTIVE_WARNING_ORDER = ['cloudWind', 'shellWind'] as const satisfies readonly ActiveWarningId[];
