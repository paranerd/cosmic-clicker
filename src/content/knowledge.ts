// Wissensdatenbank: kurze Hintergrundtexte zu den Fachbegriffen, die die
// Oberfläche verwendet. Jeder Eintrag erklärt seinen Begriff zuerst allgemein
// verständlich und stellt danach den Bezug zum Spiel her.
//
// Erreichbar sind die Einträge über unauffällige Fragezeichen-Buttons direkt
// neben dem jeweiligen Begriff (`knowledgeButton()` in `ui/views.ts`); geöffnet
// erscheinen sie als Modal im Stil von Chronik und Statistik (`ui/overlay.ts`).
// Eine weitere Erklärstelle in der Oberfläche braucht deshalb nur einen neuen
// Eintrag hier und einen `knowledgeButton()`-Aufruf an der passenden Stelle —
// keinen neuen Oberflächencode.
export type KnowledgeId = 'coreTemperature';

export interface KnowledgeEntry {
  // Kleine Bereichszeile über dem Titel. Sie steht wie in den übrigen Modalen
  // (Chronik, Statistik) bereits in Großbuchstaben im Text.
  eyebrow: string;
  title: string;
  // Erklärung für Laien; ein Absatz je Eintrag.
  paragraphs: string[];
  // Was der Begriff konkret für die laufende Runde bedeutet.
  inGame: string;
}

export const KNOWLEDGE: Record<KnowledgeId, KnowledgeEntry> = {
  coreTemperature: {
    eyebrow: 'WISSENSARCHIV · STELLARER KERN',
    title: 'Kerntemperatur',
    paragraphs: [
      'Die Kerntemperatur beschreibt, wie heiß es ganz im Inneren eines Sterns ist — dort, wo seine Energie entsteht. Mit der sichtbaren Oberfläche hat sie wenig zu tun: Die Sonne ist außen rund 5.800 K heiß, in ihrem Kern dagegen etwa 15 Millionen K. (Kelvin zählt vom absoluten Nullpunkt aus; bei solchen Werten ist der Unterschied zu Grad Celsius belanglos.)',
      'Diese Hitze stammt aus der Schwerkraft. Eine Gaswolke fällt unter ihrem eigenen Gewicht in sich zusammen und presst das Gas im Zentrum immer stärker zusammen — und zusammengepresstes Gas wird heiß. Mehr Masse bedeutet also mehr Druck, und mehr Druck bedeutet mehr Temperatur.',
      'Ab einer bestimmten Temperatur rasen die Atomkerne so schnell umher, dass sie beim Zusammenstoß ihre gegenseitige elektrische Abstoßung überwinden und miteinander verschmelzen. Diese Kernfusion setzt Energie frei und stemmt sich von innen gegen die Schwerkraft. Jeder Brennstoff hat dabei seine eigene Zündschwelle: Wasserstoff etwa 10 Millionen K, Helium rund 100 Millionen K, Silizium über 2 Milliarden K.',
    ],
    inGame: 'Die Kerntemperatur ist damit dein Türöffner: Sie steigt, während dein Stern Masse sammelt und sich verdichtet, und schaltet eine Fusionsstufe nach der anderen frei. Der Balken unter der Anzeige zeigt, wie weit es noch bis zur nächsten Marke ist.',
  },
};
