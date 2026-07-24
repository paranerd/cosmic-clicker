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
export type KnowledgeId = 'coreTemperature' | 'starMass' | 'corePressure' | 'energy' | 'accretion';

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
  starMass: {
    eyebrow: 'WISSENSARCHIV · STELLARER KERN',
    title: 'Sternmasse',
    paragraphs: [
      'Die Sternmasse ist die Menge Materie, die dein Stern bereits an sich gebunden hat. Sie ist die wichtigste Größe der gesamten Sternentwicklung — in der Astronomie heißt es dazu kurz: Masse ist Schicksal. Sie entscheidet, wie heiß der Kern wird, welche Brennstoffe überhaupt zünden, wie lange der Stern lebt und was am Ende von ihm übrig bleibt.',
      'Der Grund dafür ist einfach: Mehr Masse drückt stärker auf das Zentrum, und stärkerer Druck bedeutet höhere Temperatur. Schwere Sterne erreichen deshalb Zündschwellen, die leichte nie schaffen — sie verbrennen ihren Vorrat dafür aber in wenigen Millionen statt in vielen Milliarden Jahren.',
      'Gemessen wird üblicherweise in Sonnenmassen (M☉). Unterhalb von etwa 0,08 M☉ zündet der Wasserstoff nie richtig, das Objekt bleibt ein Brauner Zwerg. Oberhalb von rund 8 M☉ läuft die Fusion dagegen bis zum Eisen weiter und endet in einer Supernova.',
    ],
    inGame: 'Angezeigt wird die Masse in Masseeinheiten (ME); 150.000 ME entsprechen einer Sonnenmasse. Sie wächst mit jedem Klick und mit jeder Akkretionsstufe und ist neben der Temperatur die zweite Bedingung, die über jede Zündung entscheidet.',
  },
  corePressure: {
    eyebrow: 'WISSENSARCHIV · STELLARER KERN',
    title: 'Kerndruck',
    paragraphs: [
      'Ein Stern ist ein Kräftegleichgewicht. Die Schwerkraft zieht alle Materie nach innen, im Zentrum staut sich dadurch ein gewaltiger Druck auf — und die Energie der Fusion hält von innen dagegen. Solange beide Kräfte sich die Waage halten, bleibt der Stern stabil. Fachleute nennen das hydrostatisches Gleichgewicht.',
      'Wie groß dieser Druck ist, lässt sich kaum vorstellen: Im Kern der Sonne herrscht rund das 250-Milliarden-fache des Luftdrucks auf der Erdoberfläche. Genau diese Presswirkung heizt das Gas auf und bringt die Atomkerne nahe genug zusammen, dass sie verschmelzen können.',
      'Fällt die Fusion aus, gewinnt die Schwerkraft: Der Kern zieht sich zusammen, wird dabei noch heißer und dichter — und zündet so oft den nächsten, schwereren Brennstoff. Dieser Wechsel aus Kontraktion und neuer Zündung ist der eigentliche Motor der Sternentwicklung.',
    ],
    inGame: 'Die Anzeige rechnet den Druck in Prozent des Zünddrucks um, den dein Stern für die Wasserstofffusion braucht. 100 % heißt deshalb nicht „maximal", sondern: Die Masse für diese Zündung ist beisammen.',
  },
  energy: {
    eyebrow: 'WISSENSARCHIV · STELLARER KERN',
    title: 'Energie',
    paragraphs: [
      'Energie entsteht hier dort, wo sie auch im echten Stern entsteht: Verschmelzen leichte Atomkerne zu schwereren, wiegt das Ergebnis ein winziges bisschen weniger als die Ausgangsstoffe zusammen. Diese fehlende Masse wird nach Einsteins E = mc² als Energie frei.',
      'Gemessen wird sie in Megaelektronenvolt (MeV), der üblichen Einheit der Kernphysik. Ein Elektronenvolt ist winzig: Chemische Reaktionen wie eine Verbrennung setzen pro Reaktion nur wenige davon frei, Kernreaktionen dagegen Millionen. Genau deshalb hält ein Stern Milliarden Jahre durch und ein Lagerfeuer nur einen Abend.',
      'Zum Vergleich: Werden vier Wasserstoffkerne zu einem Heliumkern, werden dabei rund 26,7 MeV frei. Die Sonne setzt auf diesem Weg jede Sekunde etwa vier Millionen Tonnen ihrer eigenen Masse in Energie um.',
    ],
    inGame: 'Energie ist deine Währung innerhalb einer Runde: Du erhältst sie beim Einsammeln von Materie und bei jeder Fusion und bezahlst damit Upgrades, Automationen und Reaktionsausbauten. In den nächsten Zyklus wird sie nicht mitgenommen — dafür gibt es Sternenstaub.',
  },
  accretion: {
    eyebrow: 'WISSENSARCHIV · STELLARER KERN',
    title: 'Akkretion',
    paragraphs: [
      'Akkretion ist der Fachbegriff dafür, dass ein Körper durch seine eigene Schwerkraft Materie aus seiner Umgebung einsammelt. Sterne entstehen genau so: Eine kalte Gaswolke fällt in sich zusammen, das Gas sammelt sich in der Mitte, und der wachsende Klumpen zieht immer weiteren Nachschub an.',
      'Weil die Wolke sich dabei dreht, fällt das Gas nicht geradewegs hinein, sondern sammelt sich zunächst in einer flachen, rotierenden Scheibe um den jungen Stern. Aus den Resten solcher Akkretionsscheiben entstehen später die Planeten — auch unsere Erde.',
      'Irgendwann endet die Akkretion: Entweder ist die Wolke aufgebraucht, oder der junge Stern bläst den Rest mit seiner Strahlung und seinem Sternwind selbst fort. Was er bis dahin gesammelt hat, bleibt seine Masse.',
    ],
    inGame: 'Der Wert zeigt, wie viel Materie deine Automationen pro Sekunde von allein einsammeln; Handklicks kommen zusätzlich obendrauf. Er steigt mit jeder Akkretionsstufe und mit der Gravitativen Verdichtung — und versiegt, sobald die Urwolke leer ist.',
  },
};
