# Cosmic Clicker – wiederverwendbare Game-Design-Referenz

Stand: 23. Juli 2026
Referenzstand des Spiels: Commit `65a2927`

Dieses Dokument beschreibt die relevanten Designentscheidungen, Systeme,
Formeln und Balancing-Werte des gesamten Spiels. Es ist zugleich
Bestandsaufnahme und Vorlage für ein zukünftiges Projekt. Die konkreten Zahlen
sind erprobte Ausgangswerte, keine universellen Empfehlungen.

## 1. Produktidee

### High Concept

Cosmic Clicker ist ein responsives Browser-Incrementalspiel über die Entstehung
und Entwicklung eines Sterns. Der Spieler beginnt mit einer kalten Urwolke,
sammelt Materie durch Gravitation, heizt den entstehenden Kern auf, startet
Kernreaktionen und verfolgt den Stern bis zu einem von mehreren möglichen
Endzuständen.

### Designversprechen

- **Wissenschaftlich plausibel, spielerisch komprimiert:** Die Abfolge und
  Abhängigkeiten orientieren sich an stellarer Physik; Massen, Zeiträume und
  Reaktionsnetze sind für ein kurzes Spiel abstrahiert.
- **Ursache und Wirkung bleiben sichtbar:** Ein Klick bewegt Materie, erzeugt
  Energie, verändert Masse und Temperatur und öffnet dadurch neue Systeme.
- **Masse bestimmt den Weg:** Der Entwicklungszweig folgt der verfügbaren und
  erhaltenen Sternmasse, nicht einer künstlichen Rundennummer.
- **Aktiv beginnen, schrittweise automatisieren:** Der Spieler lernt jedes
  System zunächst durch eine eigene Handlung und darf es später automatisieren.
- **Ein Zyklus erzählt eine vollständige Geschichte:** Jede Runde reicht von
  der Urwolke bis zu einem Sternrest. Prestige erweitert die möglichen
  Geschichten, statt lediglich Zahlen zurückzusetzen.
- **Informationsdichte mit klarer Hierarchie:** Echtzeitdaten, Ziel,
  Hauptaktion und verfügbare Systeme sind gleichzeitig sichtbar, aber räumlich
  getrennt.

### Zielgefühl

Der Anfang soll neugierig und greifbar wirken, die Mitte planbar und
optimierbar, die späten Brennphasen zunehmend dramatisch. Ein Abschluss ist
kein Scheitern: Auch ein Brauner Zwerg oder Weißer Zwerg liefert Erkenntnis,
Sternenstaub und einen neuen Ausgangspunkt.

### Produkt, Sprache und Plattform

- responsives, deutschsprachiges Browser-Spiel;
- HTML, TypeScript, SCSS und Vite;
- Desktop und kleine Smartphones ab 320 px;
- kein horizontaler Seitenüberlauf;
- später grundsätzlich als mobile App adaptierbar;
- lokale Speicherung sowie JSON-Import und -Export;
- deterministische Regeln mit Vitest, vollständige Abläufe mit Playwright;
- `cosmicDebug()` und Balance-Panel ausschließlich im Vite-Entwicklungsbuild,
  niemals im Produktionsbundle.

Eine spätere Erweiterung kann über einzelne Sterne hinaus zu mehreren Sternen,
Sternsystemen und langfristig Galaxien führen. Der aktuelle Produktkern bleibt
aber ein vollständig erzählter einzelner Sternzyklus.

## 2. Die drei Spielschleifen

### Moment-to-Moment

1. Materie aus der Urwolke akkretieren.
2. Dadurch Sternmasse und Energie gewinnen.
3. Energie in Gravitation, Reaktionsausbau und Automationen investieren.
4. Temperatur- und Druckschwellen erreichen.
5. Verfügbare Kernreaktionen manuell ausführen.
6. Den unmittelbaren Effekt in Kernzusammensetzung, Energie und Visualisierung
   beobachten.

### Entwicklungsloop einer Runde

1. Urwolke
2. Protostern und Sternwind
3. Deuteriumphase
4. Wasserstoffzündung
5. Hauptreihe
6. Brennstofferschöpfung und Kernkontraktion
7. Je nach Masse weitere Brennstufen
8. Sternrest und Rundenauswertung

### Meta-Loop

1. Sternrest entdecken.
2. Sternenstaub erhalten.
3. Permanente Perks kaufen oder zurücknehmen.
4. Eine freigeschaltete Wolkengröße für den nächsten Zyklus wählen.
5. Mit höheren Raten, größerer Wolke oder stärkerer Fusion neu starten.
6. Weitere Entwicklungswege und Endzustände entdecken.

### Zielzeiten

- erster Brauner-Zwerg-Zyklus: ungefähr 7–10 Minuten;
- vollständige stellare Zyklen: ungefähr 20–30 Minuten;
- Vermächtnis-Perks verkürzen spätere Wiederholungen;
- der erste Protostern benötigt ohne Upgrades etwa 53 Klicks und liegt damit
  innerhalb des Zielkorridors von 50–60 aktiven Akkretionsimpulsen.

Diese Zeiten sind Balanceziele, keine harten Timer. Offline-Fortschritt,
Investitionsreihenfolge und aktives Spiel dürfen sie verändern.

## 3. Ressourcen, Einheiten und Startzustand

### Spielressourcen

| Ressource | Einheit | Rolle |
| --- | --- | --- |
| Materie | ME | Gemeinsame Spielmaßeinheit für Stern und Wolke |
| Sternmasse | ME und M☉ | Hauptvoraussetzung für Zündung und Endzustand |
| Energie | ohne eigene Einheit | Kaufwährung innerhalb einer Runde |
| Temperatur | K | Zweite Zündvoraussetzung und Phasenindikator |
| Kerndruck | % | Lesbare Fortschrittsanzeige zur Wasserstoffzündung |
| Sternenstaub | ✦ | Permanente Währung zwischen Zyklen |
| Zeit | Sekunden | Simulation, Offline-Fortschritt und Statistik |

### Materiearten

| Schlüssel | Symbol | Anzeige in Zusammensetzung | Funktion |
| --- | --- | --- | --- |
| Wasserstoff | H | ja | Primärer Start- und Hauptreihenbrennstoff |
| Helium | He | ja | Startbestandteil und Produkt der H-Fusion |
| Deuterium | D | nein | Spurenelement und thematische frühe Brennphase |
| Kohlenstoff | C | ja | Produkt der He-Fusion und schwerer Brennstoff |
| Neon | Ne | ja | Produkt der C-Fusion |
| Sauerstoff | O | ja | Produkt von Alpha-Einfang und Ne-Fusion |
| Silizium | Si | ja | Produkt der O-Fusion |
| Eisen | Fe | ja | Endprodukt; weitere Fusion liefert keine Energie |

Deuterium wird simuliert und gespeichert, aber nicht als eigene Zeile in der
normalen Zusammensetzungsansicht gezeigt. Die Hauptansicht bleibt dadurch
lesbar, während das frühe Upgrade wissenschaftlich verankert bleibt.

Die Kernzusammensetzung zeigt pro sichtbarem Element die absolute Menge in ME
und einen relativen Balkenanteil. Die Gesamtmasse wird dort nicht wiederholt,
sondern ausschließlich in den Kerndaten gezeigt. Intern bilanziert die Engine
zusätzlich abgestrahlte Masse sowie Verluste durch Wolken- und Hüllenwind.

### Umrechnung

`1 M☉ = 150.000 ME`

Die Einheit ist eine bewusste spielerische Kompression. Sie erlaubt
astronomische Schwellen, ohne permanent extrem große Zahlen anzeigen zu müssen.

### Neuer Spielstand

| Wert | Start |
| --- | ---: |
| Zyklus | 1 |
| Stadium | Urwolke |
| Kerntemperatur | 10 K |
| Sternmasse | 0 ME |
| Energie | 0 |
| Sternenstaub | 0 |
| Gravitation | Stufe 0 |
| Automationen | alle Stufe 0 |
| Reaktionen | keine freigeschaltet |
| Sound | an |
| Lautstärke | 35 % |

Der erste Zyklus startet immer mit Wolkenstufe 0, sofern kein expliziter
persistierter Wolkenstand geladen wird.

## 4. Urwolken und skalierende Rundengröße

### Grundentscheidung

Es gibt keine fest verdrahteten Wolkentypen mit voneinander abweichenden
Zusammensetzungen. Stattdessen wächst eine einheitlich zusammengesetzte
Urwolke pro Prestige-Stufe prozentual.

### Formeln

```text
Sonnenmassen(L) = 0,07 × 2^L
Wolkenmasse(L)  = Sonnenmassen(L) × 150.000 ME
```

`L` ist die Wolkenstufe. Jede Stufe verdoppelt die maximale Wolkenmasse.

### Primordiale Zusammensetzung

| Anteil | Wert |
| --- | ---: |
| Deuterium | 0,1 % der Gesamtmasse |
| Helium | 25 % der nach Deuterium verbleibenden Masse |
| Wasserstoff | Rest |
| Schwere Elemente | 0 zu Rundenbeginn |

Für Stufe 0 ergibt das bei 10.500 ME:

| Stoff | Startmenge |
| --- | ---: |
| Wasserstoff | 7.867,125 ME |
| Helium | 2.622,375 ME |
| Deuterium | 10,5 ME |

### Wichtige Wolkenstufen

| Stufe | M☉ | ME | Erwarteter Pfad |
| ---: | ---: | ---: | --- |
| 0 | 0,07 | 10.500 | unter H-Zündmasse, Brauner Zwerg |
| 1 | 0,14 | 21.000 | stellarer Pfad |
| 2 | 0,28 | 42.000 | stellarer Pfad |
| 3 | 0,56 | 84.000 | stellarer Pfad |
| 4 | 1,12 | 168.000 | stellarer Pfad |
| 5 | 2,24 | 336.000 | stellarer Pfad |
| 6 | 4,48 | 672.000 | stellarer Pfad |
| 7 | 8,96 | 1.344.000 | massereicher Pfad |
| 8 | 17,92 | 2.688.000 | massereicher Pfad |
| 9 | 35,84 | 5.376.000 | Schwarzes Loch grundsätzlich erreichbar |

Die tatsächliche Endstufe hängt zusätzlich von Windverlusten und
Brennstoffentwicklung ab.

Der erste Zyklus ist bewusst auf einen Braunen Zwerg angelegt: Stufe 0 enthält
10.500 ME und bleibt damit unter der Wasserstoff-Zündmasse von 12.000 ME. Die
Belohnung von 2 Sternenstaub entspricht exakt den Kosten der ersten
Wolkenmasse-Stufe. Der erste Abschluss demonstriert dadurch eine physikalische
Grenze und finanziert direkt die Möglichkeit, sie im nächsten Zyklus zu
überschreiten.

### Entwicklungspfad

```text
M☉ < 0,08       → kleiner Pfad
0,08 bis < 8    → stellarer Pfad
ab 8 M☉         → massereicher Pfad
```

Diese Grenzen werden aus den echten Zündmassen abgeleitet:

- Wasserstoffzündung: 12.000 ME = 0,08 M☉
- Kohlenstoffzündung: 1.200.000 ME = 8 M☉

### Reife Akkretion

Nach Freischaltung der Wasserstofffusion wird Akkretion großer Wolken
beschleunigt:

```text
Multiplikator = max(1; 6,25 × M☉^1,0566413763)
```

Kalibrierpunkte:

- 1 M☉ → ×6,25
- 25 M☉ → ×187,5

Die Beschleunigung gilt erst nach der H-Zündung. Der Beginn jeder Runde bleibt
dadurch verständlich und handwerklich, während große spätere Wolken nicht zu
unverhältnismäßig langen Klickphasen führen.

## 5. Akkretion, Energie und Gravitation

### Basiswerte

| Wert | Referenz |
| --- | ---: |
| Manuelle Akkretion | 48 ME pro Klick |
| Automatische Akkretion | 17 ME/s je Akkretionsstufe |
| Energie je akkretiertem ME | 0,018 |
| Bonus je Gravitationsstufe | +55 % |
| Permanenter Bonus je Gravitations-Perk | +12 % |
| Maximalstufe Gravitation | 5 |
| Maximalstufe Akkretionsstrom | 8 |

Ein Basisklick erzeugt zu Rundenbeginn `48 × 0,018 = 0,864` Energie.

### Formeln

```text
Gravitationsmultiplikator
  = 1 + 0,55 × Gravitationsstufe
      + 0,12 × permanentes Gravitationsgedächtnis

Materie pro Klick
  = 48 × Reife-Akkretion × Gravitationsmultiplikator

Materie pro Sekunde
  = Akkretionsstufe × 17
    × Reife-Akkretion
    × Gravitationsmultiplikator
```

Materie wird proportional zur aktuellen Wolkenzusammensetzung übertragen. Ein
Klick bevorzugt also kein Element. Dadurch bleibt Massenerhaltung innerhalb
der Wolke nachvollziehbar.

### Angebotsgrenze

Gravitation und Akkretionsstrom lassen sich nicht weiter ausbauen, wenn die
Urwolke praktisch leer ist (`≤ 0,001 ME`). Ein Produktionssystem ohne
verbleibende Quelle soll keine wertlose Investition mehr anbieten.

## 6. Druck- und Temperaturmodell

### Kerndruck

Der sichtbare Druckfortschritt ist eine normierte Anzeige zur
Wasserstoff-Zündmasse:

```text
Druckfortschritt
  = min(100; (Sternmasse / 12.000)^1,18 × 100)
```

Der Inhaltswert `pressureReferenceMass = 34.000 ME` ist aktuell ein
unverwendeter früherer Tuningwert. In einem Folgeprojekt sollte er entweder in
die Formel übernommen oder entfernt werden, damit keine Scheinkonfiguration
entsteht.

### Kompressionswärme

```text
Kompressionswärme
  = (Sternmasse / 2.544)^3 × (100.000 K − 10 K)
```

Ohne Deuteriumbrennen wird der kompressionsbedingte Anteil bei knapp
10.000.000 K gedeckelt.

### Deuteriumbrennen

- ab 2.544 ME Sternmasse
- ab 1.000.000 K
- nur unter 10.000.000 K
- einmalig
- kostet 75 Energie
- multipliziert nur die nach dem Kauf zusätzlich entstehende
  Kompressionswärme mit 1,35

Beim Kauf wird die bis dahin erreichte Kompressionswärme als Basis gespeichert.
Der Effekt wirkt nicht rückwirkend; die Temperatur springt daher nicht.

### Fusions- und Kontraktionswärme

- Jede Reaktion addiert `umgesetzte Menge × heatPerUnit` als temporären
  Wärmebonus.
- Temporäre Fusionswärme fällt mit 180 K/s ab.
- Nach Brennstofferschöpfung baut der Kern die für die nächste Zündung nötige
  Kontraktionswärme in nominal 90 Sekunden auf.
- Stadium, bereits gezündete Reaktionen und Kompressionswärme definieren
  Temperaturuntergrenzen. Eine erreichte Brennphase kühlt deshalb nicht unter
  ihre charakteristische Temperatur.

## 7. Zündschwellen und Massenentscheidungen

| Ereignis | Temperatur | Mindestmasse | M☉ |
| --- | ---: | ---: | ---: |
| Protostern | 100.000 K | 2.544 ME | 0,01696 |
| Deuteriumphase | 1.000.000 K | 2.544 ME für Upgrade | 0,01696 |
| Wasserstofffusion | 10.000.000 K | 12.000 ME | 0,08 |
| Heliumfusion | 100.000.000 K | 75.000 ME | 0,5 |
| Kohlenstofffusion | 600.000.000 K | 1.200.000 ME | 8 |
| Neonfusion | 1.200.000.000 K | 1.350.000 ME | 9 |
| Sauerstofffusion | 1.500.000.000 K | 1.350.000 ME | 9 |
| Siliziumfusion | 2.700.000.000 K | 1.350.000 ME | 9 |
| Schwarzes Loch | nach Eisenkern | 3.000.000 ME Endmasse | 20 |

Weitere Progressionsschwellen:

| Schwelle | Wert |
| --- | ---: |
| Erstes Wasserstoffziel | 1.000 ME |
| Hauptreihe stabilisiert | 15.000 ME fusionierter Wasserstoff |
| Referenz Heliumkern | 4.500 ME |
| Referenz Sauerstoffkern | 1.200 ME |

Die beiden Kernreferenzen sind derzeit Inhaltswerte, werden aber nicht als
harte Zündbedingungen in der Engine verwendet. Zündungen verlangen aktuell
Temperatur und gesamte Sternmasse.

## 8. Kernreaktionen

### Gemeinsame Regeln

- Eine Reaktion benötigt Freischaltung, Zündtemperatur und verfügbaren
  Brennstoff.
- Eingaben werden im angegebenen Verhältnis verbraucht.
- Produkte werden mit einem leicht kleineren Massenverhältnis erzeugt.
- Die Differenz wird als abgestrahlte Masse erfasst.
- Reaktionen verbrauchen keine Energie; sie erzeugen Energie.
- Manuelle und automatische Reaktionen benutzen dieselbe physikalische
  Umwandlung.
- Reicht der Brennstoff nicht für die reguläre manuelle Menge, wird der gesamte
  noch mögliche Rest verarbeitet. Erst bei vollständig fehlender Kapazität ist
  die Aktion deaktiviert.
- Brennstoff gilt erst als erschöpft, wenn weder Stern noch Restwolke ihn
  enthalten. Spätere Akkretion kann dadurch keine bereits beendete Phase
  unerwartet zurücksetzen.
- Frühere gezündete Reaktionen bleiben verfügbar, solange ihr Brennstoff
  vorhanden ist; eine höhere Brennstufe sperrt sie nicht.
- Das Kontrollzentrum zeigt alle freigeschalteten Prozesse und genau die
  unmittelbar nächste gesperrte Reaktion. Spätere Stufen werden nicht auf
  einmal vorweggenommen.

### Reaktionswerte

| Reaktion | Eingabe → Ausgabe | Manuell | Zündung | Mindestmasse | Energie | Wärme |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Wasserstoff | 1 H → 0,993 He | 200 | 10 Mio. K | 12.000 ME | 0,34 je Eingabe | 2,4 |
| Helium | 1 He → 0,998 C | 300 | 100 Mio. K | 75.000 ME | 0,52 je Eingabe | 1,2 |
| Alpha-Einfang | 1 C + ⅓ He → 1,330667 O | 180 | 100 Mio. K | 75.000 ME | 0,68 je Ausgabe | 0,8 |
| Kohlenstoff | 1 C → 0,997 Ne | 150 | 600 Mio. K | 1.200.000 ME | 0,82 je Eingabe | 0,65 |
| Neon | 1 Ne → 0,996 O | 140 | 1,2 Mrd. K | 1.350.000 ME | 0,94 je Eingabe | 0,55 |
| Sauerstoff | 1 O → 0,995 Si | 120 | 1,5 Mrd. K | 1.350.000 ME | 1,08 je Eingabe | 0,45 |
| Silizium | 1 Si → 0,994 Fe | 100 | 2,7 Mrd. K | 1.350.000 ME | 1,2 je Eingabe | 0,3 |

„Manuell“ ist die Basismenge pro Aktion vor Reaktionsausbau und
Fusionsgedächtnis.

### Manueller Reaktionsausbau

```text
Manuelle Menge
  = Basismenge × (1 + 0,25 × Ausbaustufe)
    × (1 + 0,15 × Fusionsgedächtnis)

Kosten der nächsten Stufe
  = runden(Basiskosten × 1,9^aktuelleStufe)
```

| Reaktion | Basiskosten | Maximum |
| --- | ---: | ---: |
| Wasserstoff | 220 | 8 |
| Helium | 420 | 8 |
| Alpha-Einfang | 720 | 8 |
| Kohlenstoff | 1.100 | 8 |
| Neon | 1.500 | 8 |
| Sauerstoff | 2.000 | 8 |
| Silizium | 2.550 | 8 |

Der Ausbau verstärkt bewusst nur die manuelle Aktion. Automationen besitzen
ihre eigene Kurve; beide Systeme bleiben als getrennte Investitionsstrategien
verständlich.

### Hauptreihe

Nach insgesamt 15.000 ME fusioniertem Wasserstoff wechselt der Stern von der
frühen H-Fusionsphase in die Hauptreihe. Ab dann läuft zusätzlich zur manuellen
und automatisierten Fusion ein struktureller Wasserstoffverbrauch:

```text
H-Verbrauch pro Sekunde
  = 300 × (aktuelle Sternmasse / 150.000)^1,46
```

Das Modell komprimiert reale Lebensdauern. Massereiche Sterne durchlaufen die
Hauptreihe deutlich schneller, aber nicht um astronomisch unspielbare Faktoren.

## 9. Upgrades

### Gravitative Verdichtung

| Eigenschaft | Wert |
| --- | --- |
| Typ | wiederholbar |
| Basiskosten | 45 Energie |
| Kostenwachstum | ×2,2 |
| Maximum | 5 |
| Wirkung | +55 % aktive und automatische Akkretion je Stufe |
| Sichtbarkeit | von Beginn an |
| Ende | kein weiterer Kauf bei leerer Urwolke |

Kostenfolge durch Rundung: 45, 99, 218, 479, 1.054 Energie.

### Deuteriumbrennen

| Eigenschaft | Wert |
| --- | --- |
| Typ | einmalig |
| Kosten | 75 Energie |
| Voraussetzung | ≥ 2.544 ME und ≥ 1 Mio. K |
| Ablaufgrenze | < 10 Mio. K |
| Wirkung | ×1,35 auf weitere Kompressionswärme |
| Sichtbarkeit | ab Protosternphase |

### Architekturentscheidung

Kaufwirkung, Statistikzähler und Logeintrag stehen in der Upgrade-Definition.
Die Engine kennt nur generische Kaufregeln und ein kleines Register benannter
Sonderwirkungen. Neue Upgrades erfordern dadurch möglichst keine neue
Verzweigung im Spielkern.

## 10. Automationen

### Freischaltprinzip

- Akkretionsautomation verlangt Sternmasse.
- Reaktionsautomationen verlangen eigene, bereits manuell oder automatisch
  erzeugte Reaktionsleistung.
- Eine Automation wird damit erst angeboten, nachdem der Spieler das
  zugrunde liegende System erlebt hat.
- Sichtbarkeit, Meisterschaft, Kosten, Maximalstufe und verfügbare Quelle
  fließen in eine gemeinsame Kaufbarkeitsprüfung ein.

### Ratenformel

Für Reaktionsautomationen:

```text
Rate(L) = L × Basisrate × (1 + 0,08 × L)
```

Für den Akkretionsstrom ist der Wachstumsanteil 0:

```text
Rate(L) = L × 17 ME/s × Akkretionsmultiplikatoren
```

### Werte

| Automation | Basisrate | Basiskosten | Kostenwachstum | Freischaltung | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Akkretionsstrom | 17 ME/s | 65 | ×1,85 | 2.544 ME Sternmasse | 8 |
| Wasserstofffusion | 64 H/s | 280 | ×1,9 | 5.000 ME He erzeugt | 8 |
| Heliumfusion | 48 He/s | 520 | ×1,9 | 1.500 ME C erzeugt | 8 |
| Alpha-Einfang | 24 O/s | 900 | ×1,9 | 400 ME O erzeugt | 8 |
| Kohlenstofffusion | 18 C/s | 1.400 | ×1,9 | 900 ME Ne erzeugt | 8 |
| Neonfusion | 14 Ne/s | 1.900 | ×1,9 | 700 ME O erzeugt | 8 |
| Sauerstofffusion | 11 O/s | 2.500 | ×1,9 | 550 ME Si erzeugt | 8 |
| Siliziumfusion | 8 Si/s | 3.200 | ×1,9 | 400 ME Fe erzeugt | 8 |

Die Spalte „Basisrate“ ist der Koeffizient der Formel. Auf Stufe 1 liegt die
tatsächliche Reaktionsrate wegen des Wachstumsfaktors bereits bei 108 % dieses
Werts. Alle Reaktionsraten werden zusätzlich mit dem Fusionsgedächtnis
multipliziert.

Die Engine interpretiert den Koeffizienten als umgesetzte Reaktions- bzw.
Primäreingabemenge. Beim Alpha-Einfang trägt die Oberfläche derzeit dennoch
`O/s` als Einheit ein. Wegen des Ausgabeverhältnisses von 1,330667 ist diese
Anzeige nicht identisch mit der tatsächlich erzeugten Sauerstoffmenge. Für ein
Folgeprojekt sollte zwischen „Reaktionsmenge“, „Input pro Sekunde“ und „Output
pro Sekunde“ explizit unterschieden werden.

Kosten:

```text
Nächste Kosten = runden(Basiskosten × Kostenwachstum^aktuelleStufe)
```

## 11. Sternwind und Massenverlust

### Wolkenwind

- beginnt ab dem Protostern;
- entfernt Materie proportional aus der Restwolke;
- Rate: 0,25 % der ursprünglichen Wolkenmasse pro Minute;
- läuft unabhängig von der verbleibenden Wolkenmasse mit einer konstanten
  absoluten Rate, bis die Wolke leer ist;
- verlorene Materie kann nicht wiedergewonnen werden.

### Hüllenwind

Hüllenwind entfernt nur Wasserstoff und Helium aus dem Stern, nie schwere
Kernelemente:

| Phase | Anteil der aktuellen H/He-Hülle pro Minute |
| --- | ---: |
| Hauptreihe | 0,01 % |
| Roter Riese und späte Brennphasen | 0,75 % |

So kann Massenverlust den späteren Sternrest beeinflussen, ohne den Brennstoff
der aktuell sichtbaren schweren Kernreaktion direkt zu vernichten.

### Warnungsdesign

Einmalige Wendepunkte und laufende Gefahren sind getrennt:

- Ziel-Erfolg „Protostern gebildet“ erklärt einmalig den Beginn des Sternwinds.
- Nach der H-Fusion erklärt ein einmaliger Hinweis den stärkeren Hüllenwind.
- Solange ein Verlustprozess aktiv ist, zeigt die Star Chamber ein
  Warnsymbol mit aktueller Verlustrate.

## 12. Stadienmodell

Stadien definieren Name, Beschreibung, Temperaturuntergrenze sowie Wolken- und
Hüllenwind. Reaktionen definieren dagegen ihre eigenen Zündbedingungen und den
Stadienwechsel bei Freischaltung.

| Stadium | Temperaturuntergrenze | Wolkenwind | Hüllenwind |
| --- | ---: | --- | --- |
| Urwolke | 10 K | nein | nein |
| Protostern | 100.000 K | ja | nein |
| Deuteriumphase | 1 Mio. K | ja | nein |
| Wasserstofffusion | 10 Mio. K | ja | nein |
| Hauptreihe | 10 Mio. K | ja | 0,01 %/min |
| Roter Riese | 10 Mio. K | ja | 0,75 %/min |
| Heliumfusion | 100 Mio. K | ja | 0,75 %/min |
| C/O-Kern | 100 Mio. K | ja | 0,75 %/min |
| Kohlenstofffusion | 600 Mio. K | ja | 0,75 %/min |
| Massereicher Stern | 600 Mio. K | ja | 0,75 %/min |
| Neonfusion | 1,2 Mrd. K | ja | 0,75 %/min |
| Sauerstofffusion | 1,5 Mrd. K | ja | 0,75 %/min |
| Siliziumfusion | 2,7 Mrd. K | ja | 0,75 %/min |
| Eisenkern | 2,7 Mrd. K | ja | 0,75 %/min |
| Supernova | 1 Mrd. K | ja | nein |
| Brauner Zwerg | 10 K | ja | nein |
| Helium-Weißer-Zwerg | 10 Mio. K | ja | nein |
| Weißer Zwerg | 120 Mio. K | ja | nein |
| O/Ne-Weißer-Zwerg | 600 Mio. K | ja | nein |
| Neutronenstern | 1 Mrd. K | ja | nein |
| Schwarzes Loch | 1 Mrd. K | ja | nein |

Bei einem abgeschlossenen Zyklus werden Windraten unabhängig von den
Stadienwerten auf 0 gesetzt.

## 13. Entwicklungsentscheidungen und Endzustände

### Entscheidungsregeln

- Wolke leer, bevor Wasserstoff zündet → Brauner Zwerg.
- Wasserstoff erschöpft, Sternmasse unter 75.000 ME → Helium-Weißer-Zwerg.
- Heliumphase endet, ohne möglichen schweren Brennstoff → Weißer Zwerg.
- Kohlenstoff wurde gezündet, aber die schwere Kette kann nicht fortgesetzt
  werden → O/Ne-Weißer-Zwerg.
- Silizium ist verbraucht und ein Eisenkern vorhanden:
  - Endmasse unter 3.000.000 ME → Neutronenstern.
  - Endmasse ab 3.000.000 ME → Schwarzes Loch.

Vor einer möglichen nächsten Zündung kontrahiert der Kern nur, wenn die
Mindestmasse bereits vorhanden ist. Reicht die Masse nicht, endet der Zyklus
als passender Weißer Zwerg.

### Belohnungen

| Endzustand | Sternenstaub |
| --- | ---: |
| Brauner Zwerg | 2 |
| Helium-Weißer-Zwerg | 4 |
| Weißer Zwerg | 5 |
| O/Ne-Weißer-Zwerg | 6 |
| Neutronenstern | 8 |
| Schwarzes Loch | 10 |
| importierter Legacy-Hauptreihenstern | 0 |

### Präsentation des Endes

Das Spiel öffnet nicht sofort eine große Auswertung. Zuerst erscheint ein
kompakter Abschluss-Hinweis; der Spieler öffnet die vollständige
Zusammenfassung bewusst. So bleibt der dramatische Moment sichtbar und wird
nicht direkt von Verwaltungsoptionen überdeckt.

## 14. Prestige und nächste Runde

### Perks

| Perk | Wirkung pro Stufe | Kosten für Stufe `L` | Maximum |
| --- | --- | --- | ---: |
| Wolkenmasse | +100 %, also Verdopplung | `2 + 3L` | 24 |
| Gravitatives Gedächtnis | +12 % Akkretionsrate | `2 + 2L` | 5 |
| Fusionsgedächtnis | +15 % manuelle und gekaufte automatische Fusion | `3 + 3L` | 5 |

Das Maximum 24 der Wolkenmasse ist eine technische Schutzgrenze, keine
kommunizierte Zielstufe. Der Perk soll sich offen anfühlen.

Die kumulierten Kosten für `N` Wolkenstufen sind:

```text
Gesamtkosten(N) = 1,5 × N² + 0,5 × N
```

Beispiele: Stufe 1 kostet kumuliert 2, Stufe 7 kostet 77 und Stufe 9 kostet
126 Sternenstaub.

### Kauf- und Rücknahmemodell

- Perks werden nur am Zyklusende gekauft.
- Käufe sind zunächst `pending`.
- Pending-Stufen können vor dem nächsten Zyklus vollständig und zum exakten
  Preis der zuletzt gekauften Stufe zurückgenommen werden.
- Effektive Perks sind aktive plus pending Stufen.
- Mit Wolkenmasse wird zugleich die größte wählbare Wolke erweitert.
- Der Spieler kann für die nächste Runde jede Wolkenstufe bis zum freigeschalteten
  Maximum wählen; größer ist nicht immer automatisch die gewünschte Geschichte.

### Persistenz zwischen Zyklen

Erhalten bleiben:

- Sternenstaub
- permanente Perks
- Soundeinstellung
- Tutorialstatus
- entdeckte Endzustände
- Gesamtspielzeit
- Sternenlogbuch
- Rundenhistorie

Zurückgesetzt werden:

- aktuelle Materie und Energie
- Temperatur und Wärmezustand
- normale Upgrades
- Automationen
- Reaktionsausbau und Reaktionssummen
- Rundenstatistik

## 15. Ziele, Fortschritt und Erfolge

### Frühe feste Ziele

| ID | Ziel | Abschluss |
| --- | --- | --- |
| `collect-hydrogen` | 1.000 ME Wasserstoff sammeln | H im Stern ≥ 1.000 |
| `form-protostar` | Protostern bilden | Sternmasse ≥ 2.544 ME |
| `heat-protostar` | 1.000.000 K erreichen | Temperatur ≥ 1 Mio. K |
| `ignite-hydrogen` | Wasserstoffkern zünden | Temperatur und 12.000 ME |
| `stabilize-star` | Hauptreihe erreichen | 15.000 ME H fusioniert |
| `review-cycle` | Runde auswerten | Zyklus abgeschlossen |

Bei Zündzielen mit Temperatur und Masse zeigt der Fortschrittsbalken die
schlechter erfüllte Bedingung. Er steht dadurch nicht auf 100 %, solange eine
zweite harte Voraussetzung fehlt.

### Generische spätere Ziele

- Vor einer neuen Reaktion: `ignite-<reaction>`
  - Fortschritt über Temperatur zur nächsten Zündung.
- Während einer Brennphase: `burn-<reaction>`
  - Fortschritt über den Aufbau des nächsten Kerns.

Der Brennfortschritt wird als Anteil des bereits aufgebauten Hauptprodukts an
„Produkt vorhanden plus aus verbleibendem Brennstoff noch erzeugbares Produkt“
berechnet. 100 % fallen damit mit der Brennstofferschöpfung zusammen.

### Zieltexte der Brennphasen

| Reaktion | Spielerziel |
| --- | --- |
| Wasserstoff | Heliumkern aufbauen |
| Helium | Kohlenstoffkern aufbauen |
| Alpha-Einfang | Sauerstoff anreichern |
| Kohlenstoff | Neonkern aufbauen |
| Neon | Sauerstoffkern aufbauen |
| Sauerstoff | Siliziumkern aufbauen |
| Silizium | Eisenkern aufbauen |

### Benachrichtigungen

- Zielwechsel erzeugen Erfolgsmeldungen mit Ausblick auf das nächste Ziel.
- Erfolgsmeldungen liegen in einer FIFO-Warteschlange.
- Ein Erfolg gleitet horizontal zentriert von unten herein, blockiert das Spiel
  nicht und bleibt bis zum manuellen Schließen sichtbar.
- Übergang nach dem Schließen: 340 ms.
- Toasts bleiben 3.200 ms und blenden 320 ms aus.
- Mehrere Toasts stapeln sich und verschwinden unabhängig.
- Neue Reaktionen, Upgrades und Automationen markieren ihren Tab und erzeugen
  bei Bedarf einen Toast.
- Der aktive Tab markiert seine sichtbaren Möglichkeiten als gesehen.
- Tutorial, Zielerfolge, Zyklusende und Toasts besitzen getrennte Render-Ebenen
  und dürfen einander nicht unterdrücken.
- Beim eigentlichen Rundenabschluss erscheint kein zusätzliches Zielbanner;
  der Zyklusende-Hinweis übernimmt diesen Moment.

## 16. Statistik, Chronik und Entdeckung

### Pro Runde erfasste Werte

- manuelle Klicks
- Deuteriumkäufe
- manuelle Fusionsaktionen
- akkretierte Materie, davon automatisch
- Verlust durch Wolken- und Hüllenwind
- fusionierter Wasserstoff und Helium, jeweils automatischer Anteil
- erzeugter Sauerstoff
- erzeugte Energie
- Spitzentemperatur
- gekaufte Upgrades und Automationen
- Offline-Zeit
- verdienter Sternenstaub

### Historie

- maximal 20 Runden werden gespeichert;
- die kompakte Historienansicht zeigt die jüngsten 5;
- ein Rundeneintrag enthält Endzustand, Endmasse, Dauer, Wolkenstufe und
  Statistik;
- das Sternenlogbuch bleibt über Zyklen erhalten und versieht Einträge mit
  Zykluszeit und Gesamtzeit.

### Entwicklungskarte

Die Karte zeigt drei massenbasierte Pfade:

- klein;
- stellar;
- massereich.

Freischaltung folgt der größten verfügbaren Wolke. Entdeckung folgt tatsächlich
erreichten Endzuständen. „Verfügbar“ und „bereits entdeckt“ sind bewusst
verschiedene Zustände.

Die sichtbare Timeline wird deterministisch aus Spitzentemperatur,
freigeschalteten Reaktionen und Reaktionssummen rekonstruiert. Eine zweite,
redundante Stadienhistorie ist nicht nötig.

## 17. Interface- und Informationsarchitektur

### Desktopstruktur

Maximale Inhaltsbreite: 1.460 px.

Der Hauptbereich besteht aus:

1. Ziel- und Fortschrittsleiste
2. linkem Datenpanel
3. zentraler Star Chamber
4. rechtem Kontrollzentrum
5. Chronik-Dock

Referenzbreiten:

| Bereich | Breite |
| --- | --- |
| Linkes Panel | 280–345 px |
| Star Chamber | mindestens 400 px, füllt Rest |
| Kontrollzentrum | `clamp(280px, 24vw, 345px)` |
| Kontrollzentrum auf hohem Desktop | `clamp(330px, 28vw, 360px)` |

### Verantwortlichkeiten

- **Zielleiste:** aktuelles Ziel, Fortschritt und Laufzeit
- **Linkes Panel:** Temperatur, Masse, Druck, Energie, Rate und
  Zusammensetzungen
- **Star Chamber:** Hauptaktion, Entwicklungsstadium, Warnungen und
  Aktionsfeedback
- **Kontrollzentrum:** Reaktionen, Upgrades und Automationen
- **Chronik-Dock:** Entwicklungsweg und jüngste Logeinträge
- **Header:** Marke, Zyklus, Sternenstaub, Sound, Export und Reset

### Kartenprinzipien

- Reaktion, Upgrade und Automation verwenden eine gemeinsame Kartenlogik.
- Bei Upgrades und Automationen folgt das Zustandsicon ausschließlich der
  gekauften Stufe:
  - Schloss → noch keine Stufe gekauft;
  - Doppel-Caret → mindestens eine Stufe gekauft und noch nicht vollständig;
  - Haken → voll ausgebaut.
- Das Schloss bleibt bis zum ersten Kauf sichtbar, selbst wenn die erste Stufe
  bereits bezahlbar ist. Bezahlbarkeit wird separat durch Amber-Glow
  kommuniziert.
- Reaktionsausbau erscheint erst nach Freischaltung der Reaktion und benötigt
  deshalb keinen Schlosszustand: Doppel-Caret → Haken.
- Bezahlbarkeit verändert Glow und Füllung, nicht die Bedeutung des Icons.
- „Aktuell“ und „Nächste Stufe“ stehen direkt gegenüber.
- Level-Pips zeigen die feste Ausbaugrenze.
- Versiegte Quellen erhalten einen eigenen erklärenden Sperrtext.
- Einmalige Upgrades mit `maxLevel = 1` zeigen weder
  Aktuell/Nächste-Stufe-Zeile noch Pips.
- Bei einer gesperrten Automation steht unter „Aktuell“ ein `–`, nicht eine
  irreführende Rate von 0.
- Solange ein System gesperrt ist, zeigt eine eigene Kostenzeile den
  Sperrgrund und Live-Fortschritt. Sobald es ausbaubar ist, wandert der Preis
  in den Eckbutton; bei vollständigem Ausbau verschwindet er.
- Verfügbare Upgrades werden vor gesperrten, abgelaufenen oder abgeschlossenen
  Upgrades sortiert.

### Eck-Ausbaubutton

- Position: oben rechts in jeder Karte;
- Mindestgröße: 38 × 38 px;
- eckig mit 3 px Radius;
- Icon und Preis stehen vertikal zentriert;
- Preis ist direkt sichtbar und nicht in einem nur per Hover erreichbaren
  Tooltip versteckt;
- `aria-label` liefert die ausführliche Erklärung für Screenreader;
- der Hintergrund füllt sich von unten nach oben über `--tile-fill`.

Die Füllung hat je Zustand eine andere Bedeutung:

- gesperrt: Fortschritt zur Freischaltung; bei mehreren Voraussetzungen zählt
  die am schlechtesten erfüllte;
- freigeschaltet, aber zu teuer: Energie geteilt durch Preis;
- bezahlbar: gefüllter Fortschritt plus Amber-Puls;
- vollständig: keine Füllung.

Reaktionskarten übernehmen dieselbe Grundstruktur und ergänzen nur Kicker,
Gleichung und den vollbreiten Fusionsbutton. Zwischen Beschreibung und Pips
gibt es keinen zusätzlichen Abschnitt oder Trennstrich. Der Ausbaupreis steht
genau einmal im Eckbutton.

Wertänderungen aktualisieren vorhandene Karten gezielt. Sie werden nicht bei
jedem Tick neu aufgebaut, damit Hover, Fokus und laufende Interaktion nicht
flackern oder verloren gehen.

### Missionsleiste

Die Missionsleiste ist einklappbar. Im kompakten Zustand bleiben
Fortschrittsbalken und Laufzeit sichtbar; der ausführliche Zieltext
verschwindet. Die Entscheidung wird separat im Browser gespeichert.

### Popup-Exklusivität

Chronik, Statistik und Rundenzusammenfassung sind modale Ansichten. Die
Rundenzusammenfassung hat höchste inhaltliche Priorität und schließt andere
Dialoge, Menüs, Tutorialhinweise, Toasts und Zielbanner. Auf kleinen
Bildschirmen bleibt ihre Scrollposition erhalten, wenn Perks geändert werden.
Außerhalb der Zusammenfassung dürfen nicht blockierende Zielbanner und Toasts
parallel zum Spiel und Tutorial erscheinen.

## 18. Visuelles System

### Farbpalette

| Token | Wert | Rolle |
| --- | --- | --- |
| Hintergrund | `#060910` | Weltraum und Grundfläche |
| Panel | `rgba(12, 18, 30, 0.78)` | transluzente Flächen |
| Linien | `rgba(143, 174, 201, 0.14)` | feine technische Struktur |
| Gedämpfter Text | `#758398` | sekundäre Information |
| Haupttext | `#f4f1e9` | warmer, gut lesbarer Kontrast |
| Cyan | `#78d7df` | Daten, Fokus, aktive Systeme |
| Amber | `#f2a84b` | Energie, Sterne, wichtige Belohnung |
| Orange | `#e77034` | Abschluss, Gefahr, destruktive Handlung |

### Semantische Akzentregeln

- **Cyan** markiert Information, Navigation, Auswahl, Fokus und regulären
  Ausbau.
- **Amber** markiert Energie, unmittelbar verfügbare Aktionen,
  Aufmerksamkeit und laufende Warnungen.
- **Orange** markiert dramatische Abschlüsse, Gefahr und bestätigte
  destruktive Aktionen.
- **Violett** (`#9e8fe5`) bleibt besonderen sekundären Prozessen wie
  Deuterium vorbehalten.
- Flächen bleiben überwiegend neutral und dunkel; Farbe wird sparsam als
  Zustandsinformation eingesetzt.

### Browser- und App-Icon

- Vektorquelle: `public/favicon.svg`, ViewBox 64 × 64 px
- Motiv: vierstrahliger Amber-Stern, heller Kern, Cyan-Orbit und Cyan-Punkt
  auf `#060910`
- Browser-Fallbacks: ICO mit 16, 32 und 48 px sowie PNG mit 32 × 32 px
- Apple-Touch-Icon: PNG mit 180 × 180 px
- Das SVG bleibt die bevorzugte moderne Variante; ICO und PNG sichern ältere
  Safari-Versionen ab.

### Elementfarben

| Element | Text | Rahmen | Hintergrund |
| --- | --- | --- | --- |
| H | `#9bdde3` | Cyan bei 45 % | Cyan bei 8 % |
| He | `#f2be73` | Amber bei 42 % | Amber bei 8 % |
| D | `#b1a6e8` | `#9e8fe5` bei 45 % | `#9e8fe5` bei 8 % |
| C | `#d7dbe0` | `#d7dbe0` bei 42 % | `#d7dbe0` bei 7 % |
| Ne | `#dc9cff` | `#c979f4` bei 48 % | `#c979f4` bei 8 % |
| O | `#88b8ff` | `#6e9fe8` bei 50 % | `#6e9fe8` bei 9 % |
| Si | `#e9b784` | `#d99b60` bei 48 % | `#d99b60` bei 8 % |
| Fe | `#d38b72` | `#c66c54` bei 50 % | `#c66c54` bei 9 % |

### Mess- und Fortschrittsfarben

- Temperaturbalken:
  `Cyan → #78d7df → #e6d379 → Orange → #c64732`
- normaler Fortschritt:
  dunkleres Cyan → Cyan, mit `0 0 12px rgba(Cyan, 0.5)`
- gefüllter Level-Pip:
  Cyan mit `0 0 6px rgba(Cyan, 0.5)`
- ungelesener Tab-Zähler:
  Amber bei 90 %, Rahmen Amber 50 %, dunkler Text `#1b1006`
- bereite Reaktionskarte:
  Rahmen Amber 28 %, horizontaler Amber-Verlauf 4 % → transparent
- ausgewählter Prestige-Perk:
  Rahmen Cyan 42 %, Hintergrund Cyan 4,5 %

### Karten- und Buttonzustände

| Zustand | Rahmen | Hintergrund/Füllung | Text |
| --- | --- | --- | --- |
| Normale Karte | Linienfarbe | Weiß 1,8 % | Haupt-/Sekundärtext |
| Normaler Eckbutton | Cyan 30 % | Cyan-Fill 16 %, Rest Weiß 3 % | `#9db8bd` |
| Eckbutton Hover | Cyan 55 % | unverändert | Haupttext |
| Kaufbereit | Amber 45 % | Amber-Fill 14 %, Rest Amber 7 % | Amber |
| Kaufbereit Hover | Amber 65 % | unverändert | Amber |
| Gesperrt | Linienfarbe | Weiß-Fill 6 % → transparent | `#4f5a68` |
| Vollständig | Cyan 18 % | transparent | `#54606c` |
| Primäraktion | Amber 55 % | Amber/Orange-Verlauf bei 95/94 % | `#1b110a` |
| Primäraktion deaktiviert | Linienfarbe | Weiß 2,5 % | `#596678` |
| Destruktive Bestätigung | Orange 75 % | Orange-Verlauf | dunkler Kontrast |

Der Kaufbereit-Puls verwendet 2,6 s:

```text
0/100 %: box-shadow 0 0 0 0 rgba(Amber, 0,25)
50 %:    box-shadow 0 0 0 7px rgba(Amber, 0)
```

Warnsymbol und kaufbereiter Eckbutton teilen diese Animation. So bedeutet
derselbe Puls überall „jetzt relevant“, ohne unterschiedliche visuelle
Sprachen zu erfinden.

### Hover-, Active- und Fokuswerte

| Element | Hover/Fokus | Active |
| --- | --- | --- |
| Icon-/Headerbutton | Haupttext, Cyan-Rahmen 50 %, Cyan-Fläche 7,5 % | Standard-Buttonfeedback |
| Sidepanel-Werkzeug | Haupttext, Cyan-Rahmen 45 %, Cyan-Fläche 7 % | – |
| Inaktiver Tab | Text 78 %, Cyan-Unterlinie 30 %, Cyan-Fläche 3,5 % | – |
| Primär-/Sekundäraktion | `translateY(-1px)`, Helligkeit 110 %, Schatten `0 8px 24px rgba(Orange, 0.16)` | Rückkehr zur Basis |
| Stern | Skalierung 103,5 %, Helligkeit 112 % | Skalierung 97,5 % |
| Tutorialaktion | Cyan-Rahmen 62 %, Cyan-Fläche 13 %, `translateY(-1px)` | Skalierung 98 %, Helligkeit 90 % |
| Warnsymbol | Amber-Fläche 16 %, Amber-Rahmen 70 % | – |

Übergänge liegen meist bei 180–200 ms. Der Stern reagiert mit 150 ms auf
Skalierung und 300 ms auf Helligkeit.

Globaler Tastaturfokus:

```text
outline: 2px solid #78d7df
outline-offset: 3px
```

Die Klickaufforderung unter dem Stern verwendet einen speziell größeren
Fokusabstand von 7 px und einen 1-px-Amberrahmen bei 55 %.

### Ebenen und Overlays

| Ebene | `z-index` | Inhalt |
| --- | ---: | --- |
| Stern und Hauptaktion | 3–5 | Spielfeld |
| Aktionsfeedback | 10–12 | Partikel und Zahlen |
| Sticky Header | 20 | globale Navigation |
| Warnungssteuerung | 30–40 | Warnbutton und Popover |
| Tutorial-Abdunklung | 41 | blockierter Hintergrund |
| Tutorial-Schutzraum | 42 | undurchsichtiger Highlight-Ring |
| Tutorialziel/-rahmen | 43 | einzig bedienbares Ziel |
| Tutorialkarte | 45 | Erklärung und Aktionen |
| Modaler Backdrop | 50 | Intro, Chronik, Statistik, Summary |
| Zielbanner | 76 | nicht blockierender Erfolg |
| Zyklusende | 78 | Abschluss-Hinweis |
| Toasts | 80 | flüchtige Statusmeldungen |
| Dev-Balancepanel | 90 | ausschließlich Entwicklung |

Wichtige Overlay-Flächen:

| Komponente | Rahmen | Hintergrund | Schatten |
| --- | --- | --- | --- |
| Tutorialkarte | Cyan 42 % | `rgba(8, 13, 22, 0.98)` plus Cyan-Glow | `0 20px 55px rgba(0,0,0,0.5)` |
| Zielbanner | Cyan 42 % | `rgba(8, 14, 23, 0.98)` | `0 20px 55px rgba(0,0,0,0.48)` |
| Zyklusende | Orange 58 % | `rgba(13, 13, 20, 0.985)` plus Orange-Glow | `0 22px 65px rgba(0,0,0,0.55)` |
| Toast | Cyan 30 % | `#0c1420` | `0 15px 40px rgba(0,0,0,0.35)` |
| Statistik/Chronik | Cyan 30 % | `#0a101a` | `0 30px 100px rgba(0,0,0,0.55)` |
| Summary | Amber 35 % | `#0b101a` plus Amber-Glow | `0 30px 100px rgba(0,0,0,0.5)` |

### Typografie

- UI und Fließtext: Inter mit System-Sans-Fallback
- Überschriften und astronomische Begriffe: Georgia
- Messwerte, Zeit und technische Daten: System-Monospace
- Kleine Labels: Versalien mit großzügiger Laufweite

Die Mischung erzeugt drei Ebenen: moderne Bedienung, erzählerische Astronomie
und instrumentenartige Messdaten.

### Kosmischer Hintergrund

- dunkle lineare und radiale Verläufe;
- subtile Noise-Textur mit Soft-Light;
- zwei unterschiedlich schnelle Sternfelder;
- große unscharfe Nebelglut;
- feine Maus-Parallaxe nur bei präzisem Zeiger und erlaubter Bewegung.

Animationswerte:

- Sternfeld A: 32 s
- Sternfeld B: 46 s
- Nebelpuls: 28 s
- Parallaxe primär: maximal etwa 10 px horizontal / 7 px vertikal
- Parallaxe weich: etwa 5 px / 4 px

### Responsive Breakpoints

| Grenze | Verhalten |
| --- | --- |
| ab 1101 px und 800 px Höhe | App füllt genau einen Viewport, kompaktere Panels |
| bis 1100 px | Kontrollzentrum wandert unter Stern und Datenpanel |
| bis 780 px | einspaltiger Ablauf: Stern, Aktionen, Daten |
| bis 430 px | kompakte Header-, Intro-, Statistik- und Summary-Layouts |
| Mindestbreite | 320 px |

### Bewegungsreduktion

Bei `prefers-reduced-motion: reduce`:

- Animationen und Übergänge werden praktisch auf 0 gesetzt;
- Schleifen laufen nur einmal;
- Smooth Scrolling wird deaktiviert;
- Warn- und Aufmerksamkeitspulse entfallen;
- Aktionsfeedback darf ganz ausbleiben.

## 19. Aktionsfeedback

### Akkretion

- pro Klick 5 bis 7 Materiepartikel;
- Partikel stammen zu 82 % aus H, sonst He;
- Startentfernung 32–56 % der größeren Kammerdimension;
- Verzögerung je Partikel: 28 ms;
- Partikelanimation: 680 ms;
- Mengenanzeige steigt nahe der Klick- oder Tastaturposition auf;
- Sternimpuls: 260 ms.

### Fusion

- zeigt die tatsächlich gewonnene Energie statt einer redundanten
  Reaktionsgleichung;
- startet an der Klickposition, bei Tastaturbedienung am Buttonzentrum;
- Kartenblitz: 650 ms;
- Buttonimpuls: 220 ms;
- Sternaufhellung: 520 ms.

### Automatische Akkretion

- acht wiederkehrende H/He-Partikel;
- Referenzdauer 3,2 s;
- unterschiedliche Startvektoren und negative Verzögerungen verteilen die
  Partikel gleichmäßig über den Zyklus.

Direktes Feedback ist an die tatsächliche Aktion gebunden. Es soll nicht an
einer festen Kartenecke erscheinen, weil sonst Ursache und Effekt räumlich
auseinanderfallen.

## 20. Audio

Sound wird zur Laufzeit mit Web Audio erzeugt; es gibt keine Audiodateien.
Gameplay bleibt vollständig verfügbar, wenn Audio blockiert ist.

| Effekt | Start → Ende | Dauer | Wellenform | Gain |
| --- | --- | ---: | --- | ---: |
| Akkretion | 180 → 105 Hz | 0,09 s | Sinus | 0,12 |
| Deuterium | 310 → 620 Hz | 0,24 s | Dreieck | 0,16 |
| Fusion | 420 → 210 Hz | 0,20 s | Sinus | 0,18 |
| Freischaltung | 520 → 780 Hz | 0,28 s | Dreieck | 0,13 |
| Kauf | 260 → 390 Hz | 0,16 s | Rechteck | 0,08 |
| Abschluss | 330 → 880 Hz | 0,65 s | Sinus | 0,18 |

Weitere Werte:

- Gain-Einblendung: 15 ms
- Oszillatorende: 20 ms nach Hüllkurvenende
- Lautstärke: 0–100 %, intern 0–1
- Standard: 35 %, Sound aktiv
- Lautstärke über 0 aktiviert einen zuvor stummgeschalteten Sound wieder

## 21. Zahlenformatierung

- Locale: `de-DE`
- Materie unter 1 Mio.: gerundete ganze Zahl
- ab 1 Mio.: kompakte Schreibweise mit maximal einer Nachkommastelle
- M☉: maximal zwei Nachkommastellen
- kleine Raten:
  - unter 1: zwei Nachkommastellen
  - unter 10: eine Nachkommastelle
  - sonst Materieformat
- Temperaturen:
  - ab 1 Mrd. K in „Mrd. K“
  - ab 1 Mio. K in „Mio. K“
  - darunter in K
- Zeit: `HH:MM:SS`

Die Temperaturskala springt durch fachlich relevante Obergrenzen:
100.000, 1 Mio., 10 Mio., 100 Mio., 600 Mio., 1,2 Mrd., 1,5 Mrd. und
2,7 Mrd. K.

## 22. Einstieg und Tutorial

### Onboarding-Strategie

- Vor der ersten Simulation entscheidet der Spieler zwischen Tutorial und
  direktem Start.
- Bis zu dieser Entscheidung läuft keine Spielzeit.
- Das Intro trägt sichtbar den Namen „Cosmic Clicker“ und verwendet eine kurze
  Einstiegsanimation, die bei reduzierter Bewegung praktisch entfällt.
- Der Grundkurs erklärt nur Daten, Materiequelle, erste Akkretion, Energie und
  Zielsystem.
- Upgrade und Automation werden erst erklärt, wenn sie tatsächlich bezahlbar
  sind.
- Handlungslektionen schließen nur durch die verlangte Aktion.
- Das Tutorial kann bestätigt beendet und über den Hilfe-Button wiederholt
  werden.
- Nach Abschluss oder Überspringen wird das Panel „Reaktionen“ aktiviert.
- Der Toast „Ein neuer Kosmos beginnt.“ erscheint erst nach Abschluss oder
  Überspringen des ersten Tutorialabschnitts, nicht bereits über dem Intro.

### Tutorialschritte

| ID | Inhalt | Verfügbarkeit | Abschluss |
| --- | --- | --- | --- |
| `welcome` | Willkommen | sofort | Weiter |
| `realtime-data` | Sterndaten | sofort | Weiter |
| `primordial-cloud` | Materiereservoir | sofort | Weiter |
| `cloud-composition` | Zusammensetzung | sofort | Weiter |
| `first-accretion` | erste Materie | sofort | Stern anklicken |
| `core-composition` | Ziel der Materie | sofort | Weiter |
| `accretion-energy` | Energiegewinn | sofort | Weiter |
| `first-objective` | Zieltext | sofort | Weiter |
| `objective-progress` | Fortschrittsbalken | sofort | Verstanden; Pause |
| `first-upgrade` | Gravitative Verdichtung | wenn bezahlbar | kaufen |
| `first-automation` | Akkretionsstrom | wenn bezahlbar | kaufen |
| `automatic-accretion-effect` | sichtbare Wirkung | unmittelbar danach | Weiter |

`immediate` bedeutet „sobald der Schritt in der Reihenfolge erreicht ist“,
nicht „am Spielstart“.

### Tutorial-Highlight

| Wert | Referenz |
| --- | ---: |
| Abstand des einzigen Fokusrahmens | Bis zu 12 px; an schmalen Viewports wird er verkleinert, damit der Rahmen mindestens 6 px Abstand zum Fensterrand hält |
| Viewport-Mindestabstand | 6 px |
| Auto-Scroll unter | 1100 px |
| Abdunkelung | `rgba(2, 5, 9, 0.82)` auf Ebene 41 |
| Opaker Abstand zwischen Ziel und Rahmen | `rgba(2, 5, 9, 0.98)`, formgerecht als Schatten beziehungsweise Innenring am Ziel |
| Ziel und Rahmen | Ebene 43 |
| Tutorial-Karte | Ebene 45 |

Es gibt nur einen Fokusrahmen. Er ist als Outline direkt am Zielelement
verankert und bewegt sich deshalb beim Scrollen ohne verzögerte
Neuberechnung mit. Vier Blocker sperren den Bereich außerhalb des Rahmens.
Ein Panel, das das fokussierte Ziel enthält, gibt seinen Überlauf während
dieses Schritts frei, damit die Kontur auch an Panelkanten vollständig
sichtbar bleibt.
Der Raum zwischen Rahmen und Ziel wird ohne separate rechteckige Schutzfläche
durch einen am Ziel verankerten, nahezu opaken Schatten verdeckt. Runde Ziele
wie der Stern erhalten dafür einen kreisförmigen Innenring und eine
viewportweite Abdunklung mit radial ausgesparter Fokusfläche. So bleibt die
runde Form erhalten, ohne dass die rechteckige Elementbox als helles oder
schwarzes Viereck sichtbar wird. Nur das tatsächliche Ziel bleibt interaktiv;
benachbarte Elemente scheinen nicht durch.

## 23. Speicherung, Offline-Fortschritt und Reset

### Speicherung

- Local-Storage-Schlüssel: `cosmic-clicker-save-v1`
- aktuelles Zustandsschema: Version 7
- Speichern:
  - nach Spielaktionen;
  - alle 5 Sekunden;
  - vor dem Schließen;
  - beim Verstecken des Tabs.
- Import und Export verwenden lesbares JSON.
- Exportname: `cosmic-clicker-zyklus-<Runde>.json`

### Offline-Fortschritt

- Maximum: 8 Stunden
- Offline-Zeit wird durch denselben deterministischen Tick wie Live-Zeit
  simuliert.
- Ab 60 Sekunden wird nach Rückkehr ein Hinweis gezeigt.
- Solange die erste Tutorialentscheidung noch offen ist, gibt es keinen
  Offline-Fortschritt.

### Simulationsrhythmus

- UI-/Simulationsintervall: 100 ms
- Zeitdifferenzen werden auf maximal 8 Stunden begrenzt.
- Bei verstecktem Dokument pausieren Timer und CSS-Animationen.
- Beim Zurückkehren wird die vergangene Zeit kontrolliert nachsimuliert.

### Reset

- **Runde neu starten:** behält Meta-Fortschritt, Historie, Entdeckungen,
  Einstellungen, Tutorialstatus, Log und Gesamtzeit.
- **Spielstand löschen:** setzt alles zurück und verlangt eine zusätzliche
  Bestätigung.
- Importierte ältere Zustände werden normalisiert, begrenzt und um fehlende
  Felder ergänzt.

Die Migrationslogik unterstützt die älteren Prototypzustände und ergänzt unter
anderem Reaktionsfreischaltungen, Reaktionssummen, Reaktionsausbau,
Kontraktionswärme, schwere Elemente, zusätzliche Automationen und neue
Endzustände. Alte Reaktionen starten ohne gespeicherte Ausbaustufe auf Stufe 0;
Legacy-Hauptreihenabschlüsse bleiben als Historieneintrag erhalten.

## 24. Architekturentscheidungen für Erweiterbarkeit

### Trennung von Inhalt und Regeln

`src/content/` besitzt:

- Namen und Texte
- Kosten und Raten
- Limits und Schwellen
- Zünd- und Freischaltbedingungen
- Reaktionsprodukte
- Ziele, Erfolge und Warnungen
- Tutorialschritte

`src/game/engine.ts` besitzt:

- deterministische Berechnungen
- Zustandsänderungen
- Evolution und Endzustände
- generische Kauf- und Reaktionslogik

Die UI liest dieselben Definitionen und dupliziert keine Balancewerte.

### Eigentümerschaft von Werten

- Upgrade-Limits stehen am Upgrade.
- Automationswerte stehen an der Automation.
- Reaktionsausbau steht an der Reaktion.
- Prestige-Limits stehen am Perk.
- Stadien besitzen ihre Windregeln.
- Reaktionen besitzen ihre Ziel- und Erfolgstexte.
- Globale Konstanten bleiben nur für systemübergreifende Regeln.

### Datengetriebene Erweiterung

Ein neues System sollte bevorzugt durch eine neue Definition entstehen, nicht
durch eine weitere ID-Verzweigung in Engine und UI. Beispiele:

- Neue Reaktion: Definition plus Reihenfolge und passendes Matter-Feld.
- Neue Automation: Definition mit Meisterschaft und Kostenkurve.
- Neues Upgrade: Definition mit generischer oder registrierter Kaufwirkung.
- Neuer Tutorialschritt: ein Eintrag mit Ziel, Verfügbarkeit und Trigger.

### Stabile Identitäten

- Tutorialschritte werden über stabile IDs gespeichert.
- Ziele verwenden stabile IDs und generische Muster.
- Reaktionen, Upgrades und Automationen verwenden semantische Schlüssel.
- Arraypositionen sind Darstellung, keine dauerhafte Identität.

## 25. Barrierefreiheit und Bedienbarkeit

- Alle Kernaktionen sind echte Buttons.
- Fokus erhält einen 2-px-Cyanrahmen mit 3 px Abstand.
- Hoverzustände werden nach Möglichkeit auch über `:focus-visible` angeboten.
- Tastaturaktivierung positioniert Feedback am Button statt bei Koordinate 0/0.
- Dialoge verwenden `role="dialog"` und `aria-modal="true"`.
- Statusmeldungen nutzen Live-Regionen.
- Deaktivierte Aktionen erklären ihren Zustand textlich.
- Die App funktioniert ab 320 px Breite.
- Reduzierte Bewegung wird systemweit respektiert.
- Audio ist optional und blockiert niemals Gameplay.

## 26. Teststrategie

### Engine-Tests

Abzusichern sind insbesondere:

- Massenerhaltung und Massenverlust;
- Energie- und Wärmeerzeugung;
- Zündtemperatur plus Mindestmasse;
- Reaktionskapazität bei mehreren Inputs;
- Kostenkurven und Maximalstufen;
- versiegte Materiequellen;
- Wolken- und Hüllenwind;
- struktureller Hauptreihenverbrauch;
- alle Endzustände und Massengrenzen;
- Prestige-Kauf, Rücknahme und Rundentransfer;
- Speicher-Normalisierung und Offline-Grenze.

### Browser-Tests

Abzusichern sind:

- responsiver Aufbau auf Desktop und Mobilgeräten;
- vollständiger Tutorialablauf;
- verspätete Upgrade- und Automationslektionen;
- Blockierung außerhalb des Tutorialziels;
- Ziel-, Erfolgs- und Toast-Warteschlangen;
- Tab-Hinweise und Gesehen-Zustände;
- Summary, Prestige und Wolkenauswahl;
- Import, Export und beide Resetarten;
- reduzierte Bewegung;
- Audio- und Lautstärkebedienung;
- Aktionsfeedback an Maus- und Tastaturposition.

### Grundsatz

Tests sollen nicht nur prüfen, ob ein Element existiert. Sie sichern die
Designabsicht: Der richtige Moment, die richtige Bedingung, der richtige
sichtbare Zustand und die richtige Folgeaktion.

## 27. Bekannte bewusste Vereinfachungen

- ME und Zeitmaßstab sind Gameplay-Einheiten, keine reale Simulation.
- Die ursprüngliche Wolke enthält keine Metalle, obwohl das Tutorial allgemein
  erwähnt, dass Urwolken schwerere Elemente enthalten können.
- Das Reaktionsnetz fasst komplexe Pfade zu je einem Hauptprodukt zusammen.
- Alpha-Einfang ist als gemeinsame C+He-Reaktion abstrahiert.
- Neutronenstern und Schwarzes Loch unterscheiden sich über eine einzelne
  Endmassenschwelle.
- Weißer-Zwerg-Zweige werden über freigeschaltete Brennstufen und verfügbare
  Masse statt detaillierter Entartungsphysik entschieden.
- Hauptreihenbrennen und Sternwind sind stark zeitkomprimiert.
- Kerndruck ist ein normierter Progressionswert, keine physikalische
  Druckeinheit.

Diese Vereinfachungen sind akzeptabel, solange das Spiel klar zwischen
„wissenschaftlich plausibel“ und „wissenschaftlich exakt“ unterscheidet.

## 28. Wissenschaftliche Referenzen

Die Werte wurden als spielerisch gerundete Richtwerte an folgenden
Primärquellen orientiert:

- NASA: [Life and Death of a Planetary System – Chapter 1](https://science.nasa.gov/exoplanets/resources/life-and-death/chapter-1/)
  für Sternentstehung und Wasserstoffzündung
- NASA: [The Lives, Times, and Deaths of Stars](https://science.nasa.gov/universe/stories/quick-reads/the-lives-times-and-deaths-of-stars/)
  für masseabhängige Sternentwicklung
- NASA Genesis Mission:
  [Supermarket of the Elements](https://solarsystem.nasa.gov/genesismission/educate/scimodule/PlanetaryDiversity/plandiv_pdf/SupermarketST.pdf)
  für die Brennfolge bis zur Eisengruppe
- NASA Technical Reports Server:
  [Stellar Evolution: A Survey](https://ntrs.nasa.gov/api/citations/19660024135/downloads/19660024135.pdf)
  für Heliumfusion und höhere Brenntemperaturen

Die Gameplay-Grenzen 0,5, 8, 9 und 20 M☉ sind bewusst vereinfacht. Reale
Endzustände hängen zusätzlich von Metallizität, Rotation, Massenverlust,
Binärentwicklung und tatsächlicher Kernmasse ab.

## 29. Mögliche spätere Erweiterungen

Nach dem vollständigen Einzelstern-Zyklus sind folgende Richtungen vorgesehen:

- zusätzliche Reaktionskanäle und Zwischenprodukte;
- Jupitermassen zusätzlich zu ME und M☉;
- Metallizität und alternative Wolkenzusammensetzungen;
- detaillierteres Deuterium- und Lithiumbrennen bei Braunen Zwergen;
- Unterklassen von Weißen Zwergen, Supernovae, Neutronensternen und Schwarzen
  Löchern;
- Rotation und Magnetfelder;
- Binärsterne, Massentransfer und alternative Supernova-Pfade;
- weitere Komfort- und Balancestufen für schwere Automationen;
- Entdeckungsarchiv mit wissenschaftlichen Kurzartikeln;
- planetare Systeme in Abhängigkeit von Sternmasse und Metallizität;
- langfristig mehrere Sterne, Sternsysteme und Galaxien.

Neue Vertiefungen sollen den vorhandenen Kern erweitern, nicht dessen
verständliche Ursache-Wirkungs-Kette verdecken.

## 30. Übertragungs-Checkliste für ein Folgeprojekt

1. High Concept und drei Spielschleifen vor einzelnen Features festlegen.
2. Eine gemeinsame Ressourcenskala und nachvollziehbare Einheiten definieren.
3. Fortschritt aus sichtbaren Ursachen ableiten, nicht aus versteckten
   Rundenzählern.
4. Jedes aktive System vor seiner Automation manuell erfahrbar machen.
5. Physik oder Simulation in wenige erklärbare Formeln komprimieren.
6. Massen-, Temperatur- und Brennstoffbedingungen getrennt modellieren.
7. Dauerhafte Werte in den besitzenden Inhaltsdefinitionen halten.
8. Engine, UI und Tutorial dieselbe Kaufbarkeitslogik verwenden lassen.
9. Einmalige Ereignisse und laufende Warnungen trennen.
10. Meta-Fortschritt neue Möglichkeiten öffnen lassen, nicht nur Zahlen erhöhen.
11. Endzustände als Entdeckungen statt als Erfolg/Misserfolg behandeln.
12. Visuelle Hierarchie, Typografie und Farbbedeutung als System dokumentieren.
13. Bewegung, Audio und Feedback optional, aber Gameplay immer robust halten.
14. Speichermigration und stabile IDs von Anfang an einplanen.
15. Designabsichten mit Engine- und Browser-Tests absichern.

## 31. Quellen im Referenzprojekt

- `src/content/clouds.ts`: Wolkenwachstum und Zusammensetzung
- `src/content/resources.ts`: Elemente und Anzeige
- `src/content/progression.ts`: Schwellen, Wärme, Wind und Stadien
- `src/content/reactions.ts`: Fusionsnetz und Reaktionsausbau
- `src/content/upgrades.ts`: normale Upgrades
- `src/content/automations.ts`: Automationen und Meisterschaft
- `src/content/objectives.ts`: Ziele, Erfolge und Textvorlagen
- `src/content/warnings.ts`: laufende Warnungen
- `src/content/prestige.ts`: Endzustände und Meta-Perks
- `src/content/tutorial.ts`: Tutorialschritte
- `src/game/engine.ts`: Formeln und Evolution
- `src/game/storage.ts`: Migration und Offline-Fortschritt
- `src/audio.ts`: Soundparameter
- `src/styles.scss`: visuelles System und Breakpoints
- `src/ui/format.ts`: Zahlen- und Temperaturskalen
- `src/ui/feedback.ts`: Aktionsfeedback
- `src/ui/notifications.ts`: Erfolge und Toasts
- `tests/engine.test.ts`: Regelspezifikation
- `tests/e2e/smoke.spec.ts`: Interaktions- und Layoutspezifikation
