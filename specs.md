# Cosmic Clicker

## Technische Basis

Es soll zunächst web-basiert laufen mit HTML, TypeScript und SCSS als Basis. Später vielleicht als mobile App. Es soll eine Testsuite geben, um nach jeder Änderung prüfen zu können, ob alles noch funktioniert.

## Thema

Das Setting ist die Entwicklung von der Gaswolke bis zum Stern, später vielleicht mehrere Sterne und sogar Galaxien.

Das Spiel soll sich, soweit es die Spielbarkeit zulässt, möglichst nahe an der Realität halten, damit der Spieler etwas über Astrophysik lernen kann.

## Verbindliche Produktspezifikation

Dieser Abschnitt beschreibt den aktuellen Stand und das unmittelbar angestrebte
Zielbild. Bei Widersprüchen mit älteren Roadmap-Texten gilt die jeweils neuere,
konkretere Festlegung in diesem Abschnitt.

### Produkt und Plattform

- Cosmic Clicker ist ein responsives, deutschsprachiges Browser-Spiel auf Basis
  von HTML, TypeScript, SCSS und Vite.
- Desktop und kleine Smartphone-Bildschirme werden unterstützt. Es darf kein
  horizontaler Seitenüberlauf entstehen.
- Der Spielstand wird automatisch im Browser gespeichert und kann als JSON
  exportiert und importiert werden.
- Offline-Fortschritt wird bis maximal acht Stunden simuliert.
- Die deterministischen Spielregeln werden mit Vitest, die vollständigen
  Nutzerabläufe mit Playwright abgesichert.
- Nur der Entwicklungs-Build stellt `cosmicDebug()` und das Balance-Panel bereit.
  Diese Hilfen dürfen im Produktions-Build nicht vorkommen.

### Leitprinzipien

- Eine Runde beginnt mit einer endlichen Urwolke bei 10 K und grundsätzlich
  offenem Ausgang.
- Masse, Temperatur, Zusammensetzung, verfügbarer Brennstoff und Kernreaktionen
  bestimmen die Entwicklung. Wolkenstufe oder Rundennummer dürfen einen Ausgang
  nicht künstlich erzwingen.
- Die Darstellung ist wissenschaftlich plausibel, darf Zeit, Masse und
  Reaktionsnetze zugunsten eines verständlichen Spiels aber komprimieren.
- Ein Sternstadium beschreibt den strukturellen Zustand des Sterns und ist
  nicht gleichzeitig die alleinige Freischaltbedingung für Reaktionen.
- Eine einmal gezündete Reaktion bleibt verfügbar, solange ihr Brennstoff im
  Kern vorhanden ist und der Stern noch nicht als kompakter Rest abgeschlossen
  wurde.
- Scheitert die Zündung der nächsten Brennstufe, entscheidet die Kern- bzw.
  Sternmasse anhand konfigurierter, realitätsnaher Grenzwerte über Kontraktion,
  nächste Entwicklungsphase oder stellaren Rest.
- Braune und Weiße Zwerge sind erfolgreiche Entdeckungen, keine Niederlagen.

### Einheiten und sichtbare Ressourcen

- `ME` bedeutet Materieeinheiten und ist die abstrakte Massen- und
  Brennstoffeinheit des Prototyps.
- Alle ME-Werte werden in der Benutzeroberfläche auf ganze Zahlen gerundet.
  Interne Berechnungen dürfen weiterhin mit Dezimalzahlen arbeiten.
- Sichtbare Kernelemente sind Wasserstoff (H), Helium (He), Kohlenstoff (C),
  Neon (Ne), Sauerstoff (O), Silizium (Si) und Eisen (Fe).
- Deuterium ist implizit in jeder Wasserstoffwolke vorhanden. Isotope werden in
  der Zusammensetzung nicht separat ausgewiesen.
- Die Kernzusammensetzung zeigt für jedes vorhandene Element die absolute Menge
  in ME und zusätzlich ihren relativen Balkenanteil.
- Die Gesamtmasse des Sterns erscheint nur in den Kerndaten und wird in der
  Zusammensetzung nicht wiederholt.
- Der Spielkern bilanziert zusätzlich abgestrahlte Masse, Energie und durch
  Sternwind verlorene Materie.

### Aktuelle Urwolken

- Die Urwolke wächst stufenlos über den Perk „Wolkenwachstum“: Jede gekaufte
  Stufe verdoppelt die Wolkenmasse gegenüber der vorherigen Stufe
  (+100 % pro Stufe), ausgehend von einer kalibrierten Basisgröße von
  0,07 M☉. Der Perk ist beliebig oft kaufbar; es gibt keine feste Obergrenze
  von wenigen Wolkengrößen mehr.
- Die Elementverteilung ist für jede Wolkengröße einheitlich aus einer
  realistischen Ur-Zusammensetzung abgeleitet (~75 % Wasserstoff, ~25 % Helium
  nach Masse, dazu ein kleiner Deuterium-Spurenanteil) und wird nicht mehr für
  einzelne Stufen fest als absolute Zahl hinterlegt. Auch die kleinste Wolke
  enthält dadurch bereits etwas Helium; der frühere Sonderfall „nur
  Wasserstoff“ entfällt.
- Zur Einordnung im Spiel wird die aktuelle Wolkengröße einem von drei
  Entwicklungspfaden zugeordnet, der sich rein aus der tatsächlichen
  Wolkenmasse ergibt (nicht aus einer künstlich vergebenen Stufennummer):
  „Kleine Urwolke“ unterhalb der Zündmasse für Wasserstoffbrennen (typischer
  Ausgang: Brauner Zwerg), „Stellare Urwolke“ bis zur Zündmasse für
  Kohlenstoffbrennen (typischer Ausgang: Weißer Zwerg) und „Massereiche
  Urwolke“ darüber (öffnet Supernova, Neutronenstern und Schwarzes Loch).
- Beim Rundenwechsel wählt ein Schieberegler stufenlos zwischen der kleinsten
  und der zuletzt freigeschalteten Wolkengröße; bereits freigeschaltete
  kleinere Wolken bleiben so weiterhin auswählbar.
- Die manuelle und automatische Akkretion mit gezündetem Wasserstoff
  skaliert als Formel mit der tatsächlichen Wolkenmasse (kalibriert auf
  ×6,25 bei 1 M☉ und ×187,5 bei 25 M☉) statt als feste Tabelle je Stufe.
- Jede neue Runde startet mit einer vom Spieler bereits freigeschalteten
  Wolkengröße. Freigeschaltete kleinere Wolken bleiben auswählbar.
- Der Sternwind setzt mit der Bildung des Protosterns ein und entfernt pro
  Minute 0,25 % der ursprünglichen Wolkenmasse. Der Verlust gilt auch offline
  und ist nicht rückgängig zu machen.
- Ab Erreichen der Hauptreihe verbrennt der Kern Wasserstoff zusätzlich
  strukturell und automatisch mit einer Basisrate, die unabhängig von
  gekauften Automationen läuft und zusätzlich zu manueller Fusion sowie
  Automationen wirkt. Die Basisrate skaliert überproportional mit der
  aktuellen Sternmasse (Exponent > 1 bezogen auf 150.000 ME), sodass die
  Hauptreihe bei der stellaren Urwolke (1 M☉) rechnerisch rund fünf Minuten
  dauert und bei der massereichen Urwolke (25 M☉) etwa drei- bis fünfmal
  kürzer verläuft als bei der stellaren Urwolke – deutlich komprimiert
  gegenüber dem realen Verhältnis von rund 3.000×. Die Phase endet, sobald
  Kern- und Restwolkenwasserstoff erschöpft sind; die 15.000-H-ME-Grenze
  bleibt weiterhin nur der Startpunkt und schließt Wasserstoffbrennen nicht ab.
- Ab der Hauptreihe verliert der Stern zusätzlich über einen Hüllenwind
  eigenständig Wasserstoff und Helium direkt aus seiner Hülle, nie schwerere
  Kernelemente einer aktiven Brennstufe. Die Rate ist auf der Hauptreihe mit
  rund 0,01 % pro Minute der aktuellen Sternmasse fast vernachlässigbar und
  steigt ab dem Roten Riesen bzw. massereichen Stern sowie allen folgenden
  Brennstufen auf rund 0,75 % pro Minute. Der bestehende Wolkenwind läuft
  unverändert und unabhängig davon weiter, solange die Restwolke Materie
  enthält. Anhaltender Massenverlust durch den Hüllenwind kann den späteren
  stellaren Rest tatsächlich verändern; es gibt dafür keinen
  Schutzmechanismus. Wendepunkte dürfen dabei auch offline durchlaufen
  werden (Acht-Stunden-Cap bleibt bestehen) und sind über Logbuch und
  Chronik nachvollziehbar.
- 150.000 ME entsprechen im Modell einer Sonnenmasse. Die Kerndaten zeigen
  die Sternmasse dauerhaft zusätzlich in M☉ (zwei Nachkommastellen), und
  Ziel-Banner sowie Ziele erläutern an Entwicklungsschwellen ebenfalls die
  M☉-Entsprechung.
- Bis zur ersten Wasserstoffzündung bleibt die Akkretionsmenge bei allen Wolken
  klein und gut beobachtbar. Danach skalieren manuelle und automatische
  Akkretion mit der Wolkengröße, damit große Sterne ohne tausende monotone
  Eingaben spielbar bleiben.
- Beim ersten Einsetzen des Sternwinds erklärt das Ziel-Banner Wirkung und
  Konsequenz ausdrücklich.
- Sobald keine Materie mehr in der Urwolke vorhanden ist, endet die Erwärmung
  durch weitere Akkretion bzw. Kompression. Fusion und spätere strukturelle
  Kontraktion dürfen die Temperatur weiterhin erhöhen.

### Temperatur und frühe Sternentstehung

- Markante Temperaturschwellen sind 100.000 K für den Protostern, 1 Mio. K für
  Deuteriumbrennen, 10 Mio. K für Wasserstoffbrennen, 100 Mio. K für
  Heliumbrennen, 600 Mio. K für Kohlenstoffbrennen, 1,2 Mrd. K für
  Neonbrennen, 1,5 Mrd. K für Sauerstoffbrennen und 2,7 Mrd. K für
  Siliziumbrennen.
- Ohne Upgrades benötigt der Protostern ungefähr 50 bis 60 aktive
  Akkretionsimpulse.
- Die aktuelle Kompressionskurve verwendet einen Exponenten von 3 bezogen auf
  2.544 ME Protosternmasse.
- Akkretion liefert pro Klick 48 ME und erzeugt 0,018 Energie je gebundener ME.
- Gravitative Verdichtung erhöht manuelle und automatische Akkretion pro Stufe
  um 55 %. Gravitatives Gedächtnis addiert dauerhaft 12 % pro Perk-Stufe.
- Deuteriumbrennen kostet 75 Energie, wird ab dem Protostern angezeigt und ist
  zwischen 1 Mio. und 10 Mio. K einmalig aktivierbar.
- Die Aktivierung verändert die Temperatur im Kaufmoment nicht sprunghaft. Der
  Faktor 1,35 gilt nur für zusätzliche Kompressionswärme nach der Zündung des
  Deuteriumbrennens; die beim Kauf erreichte Kompression wird als Basiswert
  gespeichert.

### Reaktionen und Energie

Implementierte manuelle Reaktionen:

| Reaktion | Manuelle Menge | Umwandlung | Energie |
| --- | ---: | --- | ---: |
| Wasserstoffbrennen | 200 H | H → He mit Faktor 0,993 | 0,34 je eingesetzter H-ME |
| Heliumbrennen | 300 He | He → C mit Faktor 0,998 | 0,52 je eingesetzter He-ME |
| Alpha-Einfang | 180 C + 60 He | C + He → O mit Faktor `4/3 × 0,998` | 0,68 je erzeugter O-ME |
| Kohlenstoffbrennen | 150 C | C → Ne mit Faktor 0,997 | 0,82 je eingesetzter C-ME |
| Neonbrennen | 140 Ne | Ne → O mit Faktor 0,996 | 0,94 je eingesetzter Ne-ME |
| Sauerstoffbrennen | 120 O | O → Si mit Faktor 0,995 | 1,08 je eingesetzter O-ME |
| Siliziumbrennen | 100 Si | Si → Fe-Gruppe mit Faktor 0,994 | 1,20 je eingesetzter Si-ME |

- Jede Fusion setzt Energie frei. Energie wird für normale Upgrades und
  Automationen ausgegeben.
- Fusionsgedächtnis erhöht manuelle und automatische Fusionsmengen dauerhaft um
  15 % pro Perk-Stufe.
- Im Kontrollzentrum sollen Reaktionskarten vollständig aus zentralen
  Definitionen erzeugt werden. Eine neue Reaktion darf keine eigene
  Renderfunktion benötigen.
- Verfügbarkeit, Brennstoffe, Temperatur, Beschriftungen, Gleichung,
  Energieertrag und nächster Prozess gehören in die Reaktionsdefinition; die
  Oberfläche verwendet eine gemeinsame Kartenkomponente.
- Die feste Grenze von 15.000 fusionierten H-ME markiert nur die stabilisierte
  Hauptreihe und beendet niemals die Möglichkeit zum Wasserstoffbrennen.
  Wasserstoff kann bis zur Erschöpfung des Kernvorrats fusioniert werden.
- Ab der Hauptreihe läuft Wasserstoffbrennen zusätzlich strukturell und
  automatisch ab, unabhängig von gekauften Automationen (siehe Abschnitt
  „Aktuelle Urwolken“ für Rate und Kalibrierung). Dieser strukturelle
  Verbrauch nutzt dieselbe zentrale Reaktionsdefinition wie manuelle und
  automatische Fusion, damit Massenbilanz, Energie und Statistiken
  konsistent bleiben.
- Höhere Brennstufen sperren frühere, weiterhin mit Brennstoff versorgte
  Reaktionen nicht. Mehrere Reaktionen können deshalb gleichzeitig verfügbar
  sein.

### Automationen

- Akkretionsstrom wird ab dem Protostern kaufbar, besitzt acht Stufen, startet
  mit 17 ME/s je Stufe und kostet anfangs 65 Energie bei Kostenfaktor 1,85.
- Stabiles Wasserstoffbrennen wird erst zusammen mit der manuellen Reaktion
  sichtbar und nach 5.000 selbst erzeugten He-ME kaufbar. Basisrate 64 H/s,
  Anfangskosten 280 Energie, acht Stufen, Kostenfaktor 1,9.
- Stabiles Heliumbrennen wird erst zusammen mit der manuellen Reaktion sichtbar
  und nach 1.500 selbst erzeugten C-ME kaufbar. Basisrate 48 He/s,
  Anfangskosten 520 Energie, acht Stufen, Kostenfaktor 1,9.
- Stabiler Alpha-Einfang wird erst zusammen mit der manuellen Reaktion sichtbar
  und nach 400 selbst erzeugten O-ME kaufbar. Basisrate 24 O/s,
  Anfangskosten 900 Energie, acht Stufen, Kostenfaktor 1,9.
- Stabiles Kohlenstoff-, Neon-, Sauerstoff- und Siliziumbrennen werden ebenfalls
  erst mit ihrer jeweiligen manuellen Reaktion sichtbar. Sie benötigen 900 Ne,
  700 O, 550 Si beziehungsweise 400 Fe eigener Reaktionsleistung und besitzen
  je acht Stufen.
- Produktionsraten wachsen zusätzlich um 8 % je Automationsstufe.
- Alle Automationskarten werden aus derselben datengetriebenen Definitions- und
  Renderpipeline erzeugt.

### Upgrades und zentrale Inhalte

- Normale Upgrades werden in `src/content/upgrades.ts` definiert und durch eine
  gemeinsame `upgradeView()`-/`upgradeCard()`-Pipeline dargestellt.
- Eine Definition enthält Modus, Kostenkurve, Sichtbarkeit, Voraussetzungen,
  Statusanzeige, Beschreibung, Stufenzahl und Buttontexte.
- Verfügbare Upgrades stehen vor noch gesperrten; abgeschlossene oder nicht mehr
  relevante Upgrades stehen dahinter.
- Neue Upgrades benötigen keine eigene Renderfunktion. Neue Zustandsfelder und
  Wirkungen können weiterhin eine Erweiterung des Spielkerns erfordern.
- Deklarative Namen, Texte, Kosten, Schwellenwerte, Raten und Sichtbarkeiten
  liegen nach Fachgebiet in `src/content/`: Ressourcen, Wolken, Reaktionen,
  Automationen, Upgrades, Fortschritt, Prestige und Tutorial.
- `src/game/engine.ts` enthält Berechnungen und Zustandsänderungen;
  `src/main.ts` verbindet den Zustand mit der Benutzeroberfläche.

### Aktueller Lebenszyklus und Physikmodell

- Der bestehende Spielstand unterscheidet Urwolke, Protostern,
  Deuteriumphase, Wasserstoffbrennen, Hauptreihe, Roten Riesen,
  Heliumbrennen, C/O-Kern, massereichen Stern, Supernova und stellare Reste.
- Gezündete Reaktionen werden separat vom strukturellen Sternstadium gespeichert.
- Nach Erschöpfung eines Brennstoffs prüft der Spielkern automatisch:
  erreichte Temperatur, verbleibende Kernzusammensetzung und relevante
  Massengrenze.
- Ein Brennstoff gilt erst dann als erschöpft, wenn ihn weder der Kern noch
  die Restwolke liefern können. Solange die Urwolke das Element noch enthält,
  wartet der Stern mit Kontraktion und Endzustand.
- Ist eine Brennstufe erschöpft und im Kern kein schwererer Brennstoff mehr
  vorhanden, schließt der Stern sofort als zusammensetzungsabhängiger
  Weißer Zwerg ab, statt in einem Zwischenzustand zu verharren.
- Geht Wasserstoff vor 100 Mio. K aus, kontrahiert ein ausreichend massereicher
  Stern automatisch weiter und wächst zum Roten Riesen. Ein zu leichter Kern
  endet als Helium-Weißer-Zwerg.
- Der Richtwert für die Abzweigung zum Helium-Weißen-Zwerg ist 0,5
  Sonnenmassen beziehungsweise 75.000 ME.
- Entsprechende masseabhängige Abzweigungen gelten auch beim Scheitern späterer
  Brennstufen.
- Der Hüllenwind der Hauptreihe und aller folgenden Phasen entnimmt
  fortlaufend Masse aus dem Stern und kann dadurch auch den späteren
  stellaren Rest verändern, etwa wenn eine ursprünglich für ein Schwarzes
  Loch ausreichende Masse durch langes Warten unter die entsprechende
  Schwelle fällt.
- Die vollständige spielbare Brennkette bis zum Eisenkern umfasst
  Wasserstoffbrennen, Heliumbrennen, Alpha-Einfang,
  Kohlenstoffbrennen, Neonbrennen, Sauerstoffbrennen und Siliziumbrennen.
- Vereinfachte Zündtemperaturen sind 10 Mio. K (H), 100 Mio. K (He),
  600 Mio. K (C), 1,2 Mrd. K (Ne), 1,5 Mrd. K (O) und 2,7 Mrd. K (Si).
- Kohlenstoffbrennen und alle folgenden zentralen Brennstufen verlangen einen
  massereichen Stern von mindestens ungefähr 8 M☉. Erreicht ein leichterer
  Stern diese Stufe nicht, bleibt abhängig von der Zusammensetzung ein C/O- oder
  O/Ne-Weißer-Zwerg zurück.

### Rundenabschluss, Sternenstaub und Perks

- Endzustände sind Brauner Zwerg, Helium-Weißer-Zwerg, C/O-Weißer-Zwerg,
  O/Ne-Weißer-Zwerg, Neutronenstern und Schwarzes Loch. Ältere
  Hauptreihenabschlüsse bleiben als Legacy-Eintrag migrierbar.
- Belohnungen: Brauner Zwerg 2, Helium-Weißer-Zwerg 4, C/O-Weißer-Zwerg 5,
  O/Ne-Weißer-Zwerg 6, Neutronenstern 8 und Schwarzes Loch 10 Sternenstaub.
- Permanente Perks sind Wolkenwachstum, Gravitatives Gedächtnis und
  Fusionsgedächtnis. Käufe werden in der Rundenzusammenfassung zunächst
  vorgemerkt und können vor Beginn der nächsten Runde wieder entfernt werden.
- Die Rundenzusammenfassung ist das einzige sichtbare Popup und erhält auf
  kleinen Bildschirmen beim Ändern von Perks ihre Scrollposition.

### Tutorial und Rückmeldungen

- Neue Spielstände zeigen ein Intro mit Wahl zwischen Tutorial und direktem
  Start. Das Tutorial ist überspringbar und über die Hilfe wiederholbar.
- Die sechs Schritte erklären Akkretion, Kerndaten, Energie, Sternenstaub,
  Kontrolltabs und Chronik.
- Nach Abschluss oder Überspringen ist der Tab „Reaktionen“ aktiv.
- Zielwechsel verwenden ein gut sichtbares, nicht blockierendes und manuell
  schließbares Banner, das horizontal zentriert von unten hereingleitet.
- Mehrere Ziel-Banner werden nacheinander in einer Warteschlange gezeigt.
- Kurzmeldungen werden als gestapelte, automatisch verschwindende Toasts von
  oben eingeblendet.
- Die Chronik zeigt den aktuellen Entwicklungspfad, bekannte Endzustände und
  ein Sternenlogbuch.
- Ton, Lautstärke, Tutorialstatus, bekannte Ergebnisse, Statistiken und
  Rundenhistorie werden gespeichert.

### Statistiken und Qualitätssicherung

- Erfasst werden manuelle Klicks und Reaktionen, gesamte und automatische
  Akkretion, gesamter Sternwindverlust (mit gesondertem Zähler für den Anteil
  des Hüllenwinds), fusionierter Wasserstoff und Helium, erzeugter
  Sauerstoff, erzeugte Energie, Käufe, Offline-Zeit, Rundendauer und
  Sternenstaub.
- Speicherstände der Versionen 1 bis 5 werden normalisiert. Version 5 speichert
  Reaktionsfreischaltungen, Reaktionssummen, Kontraktionswärme, schwere
  Elemente und die zusätzlichen Automationen und Endzustände.
- Jeder neue Reaktions- oder Entwicklungspfad benötigt Engine-Tests für
  Brennstoffverbrauch, Massenerhaltung, Energie, Freischaltungen und Endzustand.
- Sichtbarkeit, Sortierung, gerundete ME-Anzeigen, mobile Darstellung,
  Tutorial, Popup-Exklusivität und vollständige Runden werden mit Browser-Tests
  abgesichert.

### Wissenschaftliche Referenzen und Modellgrenzen

- Die Zündtemperaturen sind spielerisch gerundete Richtwerte. Als fachliche
  Grundlage dienen NASAs Übersichten zur [Sternentstehung und
  Wasserstoffzündung](https://science.nasa.gov/exoplanets/resources/life-and-death/chapter-1/),
  zur [masseabhängigen Sternentwicklung](https://science.nasa.gov/universe/stories/quick-reads/the-lives-times-and-deaths-of-stars/)
  und zur [Kernbrennfolge bis zur
  Eisengruppe](https://solarsystem.nasa.gov/genesismission/educate/scimodule/PlanetaryDiversity/plandiv_pdf/SupermarketST.pdf).
- Die Größenordnung von etwa 100 Mio. K für Heliumbrennen sowie die höheren
  Temperaturen für Kohlenstoff-, Neon-, Sauerstoff- und Siliziumbrennen folgen
  dem NASA-Bericht [Stellar Evolution: A
  Survey](https://ntrs.nasa.gov/api/citations/19660024135/downloads/19660024135.pdf).
- Die Grenzwerte 0,5 M☉, 8 M☉, 9 M☉ und 20 M☉ sind bewusst vereinfachte
  Gameplay-Schwellen. Reale Endzustände hängen zusätzlich unter anderem von
  Metallizität, Rotation, Massenverlust, Binärentwicklung und der tatsächlichen
  Kernmasse ab.
- Das Reaktionsnetz bildet dominante Entwicklungsrichtungen ab, keine
  vollständige Nukleosynthese. Insbesondere werden Nebenkanäle und mehrere
  gleichzeitig entstehende Isotope beziehungsweise Elemente zusammengefasst.

## Spielablauf

Der Spieler beginnt mit einer Gaswolke mit festem Vorrat an Wasserstoff. Mit jedem Klick wird ein Wasserstoff gebunden und erhöht somit die Masse, damit den Gravitationsdruck und damit die Temperatur des künftigen Sterns.

Die Menge an Wasserstoff bestimmt die maximale Größe des Sterns, der daraus gebildet werden kann

### Reaktionen

Ab bestimmten Temperaturschwellen können zunächst manuell Reaktionen ausgelöst werden.

Es sollen folgende Elemente fusioniert werden können: H, He, C, O, Ne, Si, Fe

Beispiele:

- Wasserstoffbrennen, um 4 H in 1 He umzuwandeln
- Kohlenstoffbrennen
- Siliziumbrennen

### Automationen

Sobald einige dieser Reaktionen stattgefunden haben, sollen für die jeweilige Stufe Automationen freigeschaltet und aufgelevelt werden können

Beispiel:

- Akkretion: zieht automatisch Wasserstoff aus der Gaswolke (zusätzlich zum aktiven Klicken)
- Wasserstoff wird automatisch zu Helium umgewandelt

### Upgrades

Darüber hinaus soll es weitere Upgrades geben.

Beispiele:

- Erhöhte Gravitation: erhöht die Anzahl der eingezogenen Wasserstoffteilchen pro Zeit (für die Automationen) und pro Klick
- Deuteriumbrennen (ab 1 Mio. Kelvin und nur bis zum Wasserstoffbrennen): einmaliges Upgrade, das die kompressionsbedingte Erwärmung beschleunigt

## Prestige / Perks

Irgendwann zerfällt der Stern z.B. zum Weißen Zwerg oder explodiert in einer Supernova, oder was sonst noch möglich ist. Dann ist eine Runde beendet und der Spieler kann sich gegen Zahlung einer festzulegenden Währung Perks für die nächste Runde kaufen

Beispiele:

- Größere Ausgangswolke
- Dauerhaft höhere Gravitation

## Roadmap

### Meilenstein v0.2 – bestehende Sternentstehung vertiefen

Nach einem Playtest wird der bestehende Vertical Slice von der Urwolke bis zum Hauptreihenstern ausgebaut und besser testbar gemacht:

- Balancing anhand des Playtest-Feedbacks
- Kurzes interaktives Tutorial
- Bessere Rückmeldungen beim Klicken, Fusionieren und Freischalten
- Soundeffekte mit Lautstärkeregler
- Statistik- und Rundenauswertung
- Debug-/Balance-Modus zum schnellen Testen kompletter Runden
- Zusätzliche Tests für Prestige, Speicherstände und Offline-Fortschritt

Festgelegte Ausprägung für den Prototyp:

- Die erste aktive Runde zielt auf eine Spielzeit von 10 bis 15 Minuten.
- Jede neue Urwolke beginnt bei einer Kerntemperatur von 10 K.
- Das Tutorial ist überspringbar und kann über die Hilfe erneut gestartet werden.
- Ein vollständig neuer Spielstand beginnt mit einem kurzen Intro, das Spielziel und Ablauf erklärt und die Wahl zwischen einer geführten Tour und einem direkten Start anbietet.
- Das Intro zeigt den Namen „Cosmic Clicker“ und erscheint mit einer kurzen, bei reduzierter Bewegung deaktivierten Animation. „Ein neuer Kosmos beginnt.“ wird erst nach der Bestätigung des ersten Ziels angezeigt.
- Das erste Ziel steht nach dem Intro direkt in der Missionsleiste. Zielwechsel unterbrechen den Spielfluss nicht mit modalen Dialogen.
- Beim Erreichen eines Ziels gleitet ein horizontal zentriertes, nicht blockierendes Achievement-Banner ruhig von unten herein. Es nennt den Erfolg und das nächste Ziel, bleibt bis zum manuellen Schließen sichtbar und stellt mehrere Erfolge in einer Warteschlange nacheinander dar.
- Das Tutorial dunkelt nicht relevante Bildschirmbereiche ab, scrollt auf Mobilgeräten zum Fokus und zeigt seine Erklärung dort horizontal zentriert.
- Nach Abschluss oder Überspringen des Tutorials wird wieder der Tab „Reaktionen“ ausgewählt.
- In der Oberfläche werden nur chemische Elemente ausgewiesen, keine Isotope. Deuterium ist implizit in jeder Wasserstoffwolke vorhanden.
- Das Deuteriumbrennen wird ab dem Protostern angezeigt und ist in jeder Runde ab 1 Mio. K als einmaliges Upgrade verfügbar: Es kostet 75 Energie und verstärkt die Erwärmung um 35 %, jedoch nicht über die Schwelle des Wasserstoffbrennens hinaus.
- Die Proton-Proton-Kette wird in der Spieleroberfläche verständlich als Wasserstoffbrennen bezeichnet.
- Toast-Meldungen gleiten horizontal zentriert von oben herein, stapeln und verschieben sich bei Folgemeldungen und blenden nach kurzer Zeit einzeln aus.
- Die Soundeffekte werden ohne externe Audiodateien über die Web Audio API erzeugt; Lautstärke (Standard: 35 %) und Stummschaltung werden gespeichert.
- Die Rundenauswertung erfasst Klicks, Reaktionen, akkretierte Materie, erzeugte Energie, Offline-Zeit, Käufe, Rundendauer und erhaltenen Sternenstaub.
- Der Debug-/Balance-Modus wird ausschließlich vom Vite-Dev-Server als `cosmicDebug()` in der Browser-Konsole angeboten und darf im produktiven Build nicht enthalten sein.

### Meilenstein v0.3 – echte Sternentwicklung

Der Hauptreihenstern ist nicht mehr das Ende einer Runde. v0.3 bildet erstmals einen vollständigen, spielerisch komprimierten Lebenszyklus vom kalten Ausgangsgas bis zum stellaren Rest ab.

Festgelegte Progression:

- Jedes vollständig neue Spiel beginnt mit derselben kleinen Wasserstoffwolke bei 10 K. Isotope wie Deuterium werden nicht separat ausgewiesen.
- Jede Runde beginnt ergebnisoffen. Entwicklungsstufen werden ausschließlich aus Masse, Temperatur, Zusammensetzung und Reaktionen abgeleitet; es gibt keinen Sonderfall, der den ersten Zyklus auf einen Braunen Zwerg begrenzt.
- Die kleine Ausgangswolke enthält implizit zu wenig Wasserstoff, um 10 Mio. K und damit dauerhaftes Wasserstoffbrennen zu erreichen. Wird eine Wolke vor der Zündung vollständig gebunden, entsteht daraus ein Brauner Zwerg.
- Der Braune Zwerg gilt als erste erfolgreiche Entdeckung, nicht als Niederlage. Er gewährt garantiert genug Sternenstaub für die erste Stufe des Wolkenwachstums.
- Der permanente Perk „Wolkenwachstum“ vergrößert die Urwolke prozentual in beliebig vielen Stufen, statt eine feste Anzahl Wolkengrößen freizuschalten. Bereits freigeschaltete Größen bleiben für spätere Zyklen über den Schieberegler auswählbar.
- Sobald die Wolkenmasse für Kohlenstoffbrennen ausreicht, ermöglicht sie den vollständigen Pfad über Wasserstoffbrennen, Hauptreihe, Roten Riesen, Heliumbrennen und einen Kohlenstoff-Sauerstoff-Kern bis zum Weißen Zwerg.
- Reicht die Wolkenmasse zusätzlich für Kohlenstoff-, Neon-, Sauerstoff- und Siliziumbrennen, führt der Weg zur Supernova. Die akkretierte Endmasse entscheidet zwischen Neutronenstern und Schwarzem Loch.
- Heliumbrennen wird als Triple-Alpha-Prozess umgesetzt. Kohlenstoff und Sauerstoff sind sichtbare, gespeicherte Kernressourcen; Sauerstoff entsteht durch Alpha-Einfang an Kohlenstoff.
- Kohlenstoff-, Neon-, Sauerstoff- und Siliziumbrennen besitzen eigene Ressourcen, Reaktionskarten und Automationen.
- Der bestehende Sternenstaub bleibt die einzige Prestige-Währung. Der Vermächtnis-Baum erhält die Äste Wolkenwachstum, Akkretion und Fusion.
- Eine interaktive Entwicklungsübersicht in der Chronik zeigt den aktuellen Pfad, bekannte Endzustände und noch nicht entdeckte Abzweigungen.
- Echte Wendepunkte werden weiterhin einmalig im schließbaren Ziel-Banner erklärt; Detailwissen bleibt freiwillig in Reaktionskarten und Chronik.
- Bestehende v0.1- bis v0.2-Spielstände werden auf das neue Zustandsmodell migriert. Abgeschlossene Runden bleiben in der Historie erhalten.
- Die Verdichtung bis zum ersten Protostern benötigt ohne Upgrades ungefähr 50 bis 60 aktive Impulse. Die erste Brauner-Zwerg-Runde zielt auf etwa 7 bis 10 Minuten; vollständige stellare Runden auf etwa 20 bis 30 Minuten und werden durch Vermächtnis-Perks schneller.
- „Stabiles Wasserstoffbrennen“ erscheint erst nach Freischaltung des Wasserstoffbrennens und wird nach 5.000 ME durch Fusion selbst erzeugtem Helium kaufbar.
- Im Reaktionsbereich bleiben alle bereits freigeschalteten Prozesse sowie die unmittelbar nächste, noch gesperrte Reaktion sichtbar. So kündigt sich jede folgende Brennstufe an, ohne frühere nutzbare Brennstoffe zu verstecken.
- Jede manuelle Kernreaktion erhält eine eigene Automation, die erst mit der zugehörigen Reaktion sichtbar wird. Stabiles Heliumbrennen wird nach 1.500 ME selbst erzeugtem Kohlenstoff, stabiler Alpha-Einfang nach 400 ME selbst erzeugtem Sauerstoff kaufbar.
- Die Rundenzusammenfassung ist stets das einzige sichtbare Popup. Sie schließt andere Dialoge, Menüs, Tutorialhinweise, Toasts und Ziel-Banner; Perk-Änderungen erhalten auf kleinen Bildschirmen die aktuelle Scrollposition.
- Die Temperaturskala folgt den markanten Stufen 100.000 K für den Protostern, 1 Mio. K für Deuteriumbrennen und 10 Mio. K für Wasserstoffbrennen.
- Verfügbare Upgrades werden vor gesperrten oder bereits abgeschlossenen Upgrades angezeigt.
- Ab dem Protostern trägt der Sternwind pro Minute 0,25 % der ursprünglichen Wolkenmasse ab, auch während des Offline-Fortschritts. Beim Einsetzen warnt das Achievement-Banner ausdrücklich vor dem unwiederbringlichen Materieverlust.
- Die Kernzusammensetzung zeigt absolute Materieeinheiten pro Element; die redundante Gesamtmasse bleibt ausschließlich in den Kerndaten.

### Weitere Vertiefungen nach der vollständigen Brennkette

Nach dem aktuellen Lebenszyklus können folgende Vertiefungen umgesetzt werden:

- Zusätzliche Reaktionskanäle und Zwischenprodukte innerhalb der bereits spielbaren Brennstufen
- Ergänzende Anzeige in Jupitermassen neben den bereits vorhandenen ME- und M☉-Anzeigen
- Metallizität, unterschiedliche chemische Zusammensetzungen und weitere Typen von Sternentstehungswolken
- Detailliertere Brauner-Zwerg-Entwicklung einschließlich Deuterium- und gegebenenfalls Lithiumbrennen
- Weitere masseabhängige Unterklassen von Weißen Zwergen, Supernovae, Neutronensternen und Schwarzen Löchern
- Rotation und Magnetfelder als neue Einflussgrößen
- Binärsterne, Massentransfer und alternative Supernova-Pfade
- Weitere Balance- und Komfortstufen für die bereits vorhandenen Automationen der schweren Brennphasen
- Entdeckungsarchiv mit wissenschaftlichen Kurzartikeln zu allen beobachteten Entwicklungsstufen
- Erste planetare Systeme und die Abhängigkeit ihrer Entstehung von Sternmasse und Metallizität
