# Cosmic Clicker – Analyse von Spielfluss und Balancing

Stand: 31. Juli 2026
Analysierter Commit: `33e839f`
Leitfrage: Was trägt das Spiel über viele Tage – und was steht dem im Weg?

Alle Zahlen in diesem Dokument stammen aus Simulationen gegen die echte
Engine (`src/game/engine.ts`), nicht aus Schätzungen. Der simulierte Spieler
klickt durchgehend 6×/s, kauft jede verfügbare Stufe sofort und wählt immer
die tiefste zündbare Reaktion – also deutlich besser als ein Mensch.

---

## 1. Kurzfassung

Die ersten rund 20 Minuten sind sehr gut. Die Kurve von der Urwolke bis zum
Weißen Zwerg ist sauber getaktet, die Kaufentscheidungen reichen bis ans
Rundenende, und jede Wolkenstufe öffnet einen echten neuen Endzustand. Das
Kernversprechen „Physik ist die Progression“ funktioniert.

Danach kippt das Spiel an vier Stellen gleichzeitig:

1. **Inhaltsdecke bei ca. 5–8 Stunden.** Alles Permanente kostet zusammen
   281 ✦. Danach existiert nichts Neues mehr.
2. **Die Meta-Ökonomie ist invertiert.** Eine größere Wolke macht den Spieler
   ärmer, nicht reicher. Optimal ist es, nach dem ersten Schwarzen Loch auf
   Wolkenstufe 3 zurückzugehen und 5-Minuten-Weiße-Zwerge zu farmen.
3. **Idle- und Offline-Fortschritt sind faktisch tot – inklusive eines harten
   Deadlocks.** Eine Runde bleibt ab der Kohlenstoffphase dauerhaft stehen,
   wenn der Spieler nicht am Gerät ist. Nachgewiesen: 12 Stunden simulierte
   Leerlaufzeit, null Fortschritt.
4. **Manuelles Klicken schlägt maximale Automation um Faktor 4–17.** Das
   Spätspiel ist kein „automatisieren und zusehen“, sondern zwei Stunden
   Dauerklicken.

Punkt 3 und 4 sind für das Ziel „über viele Tage Spaß“ die entscheidenden.
Ein Spiel, das nur voranschreitet, solange ein Finger auf der Maustaste
liegt, kann keine Tagesstruktur tragen.

---

## 2. Gemessener Rundenverlauf

Perks maximal, Wolkenstufe variabel, aktiver Spieler:

| Stufe | M☉ | Endzustand | Dauer | Endmasse | Dominante Phase |
| ---: | ---: | --- | ---: | ---: | --- |
| 0 | 0,07 | Brauner Zwerg | 31 s | 0,07 | – |
| 1 | 0,14 | He-Weißer-Zwerg | 51 s | 0,14 | – |
| 2 | 0,28 | He-Weißer-Zwerg | 1,1 min | 0,28 | – |
| 3 | 0,56 | Weißer Zwerg | 4,8 min | 0,54 | Helium 2,3 min |
| 4 | 1,12 | Weißer Zwerg | 6,1 min | 1,08 | Helium 3,5 min |
| 5 | 2,24 | Weißer Zwerg | 8,1 min | 2,15 | Helium 5,3 min |
| 6 | 4,48 | Weißer Zwerg | 11,4 min | 4,24 | Helium 8,4 min |
| 7 | 8,96 | O/Ne-Weißer-Zwerg | 17,8 min | 8,30 | Helium 14,6 min |
| 8 | 17,92 | Neutronenstern | 54,2 min | 15,68 | Helium 27,0 min |
| 9 | 35,84 | **Schwarzes Loch** | 1,6 h | 28,72 | Helium 49,5 min |
| 10 | 71,68 | Schwarzes Loch | 2,7 h | 49,67 | Helium 1,4 h |
| 11 | 143,36 | Schwarzes Loch | 4,2 h | 79,80 | Helium 2,3 h |

Die Zielzeit aus der Design-Referenz („vollständige stellare Zyklen 20–30
Minuten“) wird bis Stufe 7 gehalten und ab Stufe 8 gesprengt.

### Der Heliumwall

Ab Stufe 3 ist Helium in **jeder** Runde die längste Phase, ab Stufe 9 macht
sie über die Hälfte der Gesamtdauer aus. Die Ursache ist strukturell:

- Durch Helium fließt praktisch die **gesamte** Wolkenmasse: 25 % primordial
  plus 99,3 % des gesamten fusionierten Wasserstoffs.
- Wasserstoff hat mit `MAIN_SEQUENCE_BURN` einen strukturellen Verbrauch, der
  mit `Masse^1,46` skaliert. Deshalb wird die Wasserstoffphase mit wachsender
  Wolke sogar **kürzer** (Stufe 3: 27 s → Stufe 11: 10 s).
- Helium hat kein Gegenstück. Es hängt allein an Automation (Koeffizient 48,
  niedriger als Wasserstoffs 64) und an manuellen Klicks – beides mit fester
  Maximalstufe 8.

Ergebnis: Der Brennstoff verdoppelt sich pro Wolkenstufe, der Durchsatz
bleibt konstant. Jede Stufe verdoppelt die Heliumphase.

### Erster Zyklus

| Messung | Wert |
| --- | ---: |
| Erster Brauner Zwerg, 6 Klicks/s | 4,2 min, ~1.500 Klicks |
| Erster Brauner Zwerg, 3 Klicks/s | 7,6 min, ~1.370 Klicks |
| Klicks bis zum ersten Protostern (ohne Perks, Gravitation optimal gekauft) | **652** |

Die Design-Referenz nennt „etwa 53 Klicks“ für den ersten Protostern. Der
gemessene Wert liegt um Faktor 12 darüber. Die Gesamtdauer von 7,6 min bei
realistischer Klickrate trifft den dokumentierten Korridor von 7–10 min
dagegen gut – der Dokumentationswert für die Klickzahl ist veraltet.

---

## 3. Befund: Idle-Deadlock ab der Kohlenstoffphase

Das ist der schwerwiegendste Fund, weil er kein Balancing-Problem ist,
sondern ein Sackgassen-Zustand.

**Reproduktion:** Wolkenstufe 9, Perks maximal, 10 Minuten aktiv spielen,
danach nur noch die Zeit laufen lassen (also exakt das Verhalten eines
Spielers, der den Tab schließt oder das Handy weglegt).

```
[nach 1 h ]  stage=carbonBurning  C=1.568.444  O=2.710.344  Energie=4.382.486
[nach 4 h ]  stage=carbonBurning  C=1.568.444  O=2.710.344  Energie=4.382.486
[nach 12 h]  stage=carbonBurning  C=1.568.444  O=2.710.344  Energie=4.382.486
```

Zwölf Stunden, kein einziges umgesetztes ME. Der Zustand ist bitgleich
eingefroren.

**Ursache:** `canBuyAutomation()` verlangt `mastery.threshold` – und die
Meisterschaft einer Reaktionsautomation misst deren **eigenes Produkt**:

| Automation | Freischaltbedingung |
| --- | --- |
| Kohlenstofffusion | 900 ME **Neon** erzeugt |
| Neonfusion | 700 ME **Sauerstoff** erzeugt |
| Sauerstofffusion | 550 ME **Silizium** erzeugt |
| Siliziumfusion | 400 ME **Eisen** erzeugt |

Neon entsteht ausschließlich durch Kohlenstofffusion. Kohlenstofffusion läuft
ohne Automation ausschließlich durch Sternklicks. Also gilt: **kein Klick →
kein Neon → keine Automation → nie wieder Fortschritt.** Dasselbe Muster
wiederholt sich für jede weitere Brennstufe.

Dabei liegen 4,4 Millionen Energie ungenutzt herum – der Spieler *könnte*
alles kaufen, er *darf* nur nicht.

Die Absicht dahinter ist richtig und steht so in der Design-Referenz („Eine
Automation wird erst angeboten, nachdem der Spieler das zugrunde liegende
System erlebt hat“). Die Umsetzung über eine absolute Mengenschwelle des
Endprodukts macht daraus aber eine harte Sperre statt einer Lektion.

**Folge für das Produktversprechen:** Die im README beworbenen „bis zu acht
Stunden Offline-Fortschritt“ liefern ab der Heliumphase nichts. Für ein
Spiel, das über Tage getragen werden soll, ist das der Kern des Problems.

---

## 4. Befund: Manuell schlägt Automation um Faktor 4–17

Wolkenstufe 9, alle Automationen auf 8, alle Reaktionsausbauten auf 8,
Fusionsgedächtnis 5:

| Reaktion | Automation | Manuell bei 6 Klicks/s | Faktor |
| --- | ---: | ---: | ---: |
| Wasserstoff | 1.469/s | 6.300/s | 4,3× |
| Helium | 1.102/s | 9.450/s | 8,6× |
| Alpha-Einfang | 551/s | 5.670/s | 10,3× |
| Kohlenstoff | 413/s | 4.725/s | 11,4× |
| Neon | 321/s | 4.410/s | 13,7× |
| Sauerstoff | 253/s | 3.780/s | 15,0× |
| Silizium | 184/s | 3.150/s | 17,1× |

Der Abstand **wächst** mit jeder Brennstufe. Das kehrt das Designversprechen
„Aktiv beginnen, schrittweise automatisieren“ genau um: Je weiter der Spieler
kommt, desto irrelevanter wird das, was er sich erkauft hat, und desto
wichtiger wird die Klickfrequenz.

Sichtbar wird das auch in den Gesamtzeiten – Wolkenstufe 9 dauert bei
6 Klicks/s 1,6 h, bei 2 Klicks/s 2,7 h. Fast die gesamte Rundenzeit hängt an
der Handgeschwindigkeit.

---

## 5. Befund: Die Meta-Ökonomie ist invertiert

| Stufe | Endzustand | ✦ | Dauer | **✦ pro Stunde** |
| ---: | --- | ---: | ---: | ---: |
| 3 | Weißer Zwerg | 5 | 4,8 min | **62,5** |
| 4 | Weißer Zwerg | 5 | 6,1 min | 49,2 |
| 5 | Weißer Zwerg | 5 | 8,1 min | 37,0 |
| 6 | Weißer Zwerg | 5 | 11,4 min | 26,3 |
| 7 | O/Ne-Weißer-Zwerg | 6 | 17,8 min | 20,2 |
| 8 | Neutronenstern | 8 | 54,2 min | 8,9 |
| 9 | Schwarzes Loch | 10 | 1,6 h | 6,3 |
| 10 | Schwarzes Loch | 10 | 2,7 h | 3,7 |
| 11 | Schwarzes Loch | 10 | 4,2 h | 2,4 |

Die Belohnung wächst von 5 auf 10 ✦ (Faktor 2), die Rundendauer von 4,8 min
auf 1,6 h (Faktor 20). **Jede Wolkenstufe halbiert ungefähr das Einkommen.**

Damit steht die Ökonomie im direkten Widerspruch zur Erzählung des Spiels.
Das Spiel sagt „werde größer“, die Zahlen sagen „bleib klein“. Ein Spieler,
der optimiert, spielt nach der Entdeckung des Schwarzen Lochs dauerhaft
Wolkenstufe 3.

Ursache: Endzustands-Belohnungen sind feste kleine Ganzzahlen (2/4/5/6/8/10,
Spannweite nur 5×) und völlig unabhängig von Endmasse, Spitzentemperatur,
umgesetztem Brennstoff oder Rundendauer.

---

## 6. Befund: Die Inhaltsdecke liegt bei ca. 5–8 Stunden

Vollständige permanente Progression:

| Posten | Kumulierte Kosten |
| --- | ---: |
| Wolkenmasse bis Stufe 9 (Schwarzes Loch erreichbar) | 126 ✦ |
| Gravitatives Gedächtnis, Stufe 1–10 (Maximum) | 110 ✦ |
| Fusionsgedächtnis, Stufe 1–5 (Maximum) | 45 ✦ |
| **Summe** | **281 ✦** |

Bei rund 60 ✦/h auf der effizientesten Stufe sind das etwa **4,5 Stunden
Grind** – realistisch mit Entdeckungsrunden und Umwegen 5–8 Stunden. Danach:

- alle sechs Endzustände entdeckt,
- zwei von drei Perks am Maximum,
- der dritte Perk (Wolkenmasse, Stufe 10–24) macht Runden nur noch länger,
  ohne mehr zu zahlen,
- keine neue Reaktion, kein neues Stadium, kein neues System.

Das Spiel hat kein Endgame. Es hat ein Ende.

---

## 7. Weitere Auffälligkeiten

### Energie bricht als Währung ab Stufe 8

Die Gesamtkosten *aller* Upgrades, Automationen und Reaktionsausbauten auf
allen Stufen betragen 3.626.853 Energie. Dem steht gegenüber:

| Wolkenstufe | Energieangebot einer Runde | Verhältnis zum Gesamtbedarf |
| ---: | ---: | ---: |
| 6 | 5,3 × 10⁵ | 0,1× |
| 8 | 2,1 × 10⁶ | 0,6× |
| 9 | 4,2 × 10⁶ | 1,2× |
| 11 | 1,7 × 10⁷ | 4,7× |

Bis Stufe 8 ist Energie eine echte Einschränkung, und die Kaufdichte ist
hervorragend: Bei Stufe 5 und 7 fällt der letzte Kauf bei 100 % der
Rundenzeit, es gibt keinen toten Schwanz. Ab Stufe 9 dagegen fällt der letzte
Kauf bei 77 % der Rundenzeit, das letzte Viertel der Runde ist reines
Klicken ohne Entscheidung, und am Ende liegen 1,3 × 10⁷ Energie ungenutzt.

Es fehlt ein **unbegrenzter, exponentiell teurer Energie-Sink**, wie ihn das
Genre üblicherweise hat.

### Neonfusion ist häufig toter Inhalt

`nextHeavyFuel()` prüft Kohlenstoff → Neon → Sauerstoff. Der Alpha-Einfang
(C + He → O) konkurriert aber um denselben Kohlenstoff und ist billiger
freigeschaltet. In der simulierten Stufe-8-Runde wurde die Phase
`neonBurning` **nie betreten** – der Kern ging direkt von Kohlenstoff nach
Sauerstoff. Eine komplette Reaktion samt Automation, Ausbaukurve, Zieltext
und Erfolgsmeldung kann in einem vollständigen Durchlauf unsichtbar bleiben.

### Die Supernova wird nie gespielt

`supernova` ist als Stadium definiert (`progression.ts:95`), wird aber
niemals als `state.stage` gesetzt – die Engine springt vom Eisenkern direkt
in `completeRun()`. Der dramatischste Moment des ganzen Spiels existiert nur
als nachträglicher Eintrag in der Chronik-Timeline (`views.ts:559`). Das ist
verschenkte Dramaturgie genau an der Stelle, an der die längsten Runden ihre
Auszahlung bräuchten.

### Deuteriumbrennen ist kaum eine Entscheidung

Ein einziger Kauf, 75 Energie, festes ×1,35, enges Zeitfenster. Es gibt
keinen Grund, ihn nicht zu tätigen, sobald er verfügbar ist. Als Lehrstück
für „Upgrades gibt es“ in Ordnung, als Entscheidung wertlos.

### Massenverlust ist eine unsichtbare Falle

Wolkenstufe 8 endet bei 15,68 M☉ Endmasse – die Schwarzloch-Schwelle liegt
bei 20 M☉. Der Verlust entsteht überwiegend durch Hüllenwind (0,75 %/min)
während der langen Heliumphase. Ein Spieler, der langsamer spielt, verliert
mehr und fällt unter eine Schwelle, ohne dass ihm das vorher irgendwo
angezeigt wird. Die Mechanik ist gut – „langsam spielen kostet Masse“ ist
echte Spannung –, aber sie ist nicht kommuniziert und nicht steuerbar.

---

## 8. Empfehlungen

Sortiert nach Wirkung auf das Ziel „trägt über viele Tage“.

### P1 – Den Idle-Deadlock auflösen

Ohne diesen Fix ist alles Weitere zweitrangig, weil das Spiel ohne
anwesenden Spieler nicht existiert.

**Empfehlung:** Meisterschaft von „X ME des Produkts erzeugt“ auf zwei
getrennte, jeweils erfüllbare Bedingungen umstellen:

1. *Verstanden:* die Reaktion wurde **mindestens einmal manuell** ausgelöst
   (ein Klick statt 900 ME) – das erhält die Design-Absicht vollständig;
2. *Relevant:* ihr **Eingangsstoff** liegt in nennenswerter Menge vor.

Damit bleibt „erst erleben, dann automatisieren“ erhalten, aber die Kette
kann nicht mehr blockieren, sobald der Spieler sie einmal berührt hat.

Ergänzend: Ist eine Automation der Vorgängerreaktion bereits gekauft, sollte
die Folgeautomation ohne weitere Schwelle kaufbar sein. Wer die Kette
automatisiert hat, hat sie bewiesen.

### P2 – Späten Durchsatz an die Sternmasse koppeln

Das Muster existiert bereits und funktioniert hervorragend: Der strukturelle
Hauptreihenverbrauch skaliert mit `Masse^1,46`, weshalb die Wasserstoffphase
über alle Wolkenstufen hinweg konstant kurz bleibt.

**Empfehlung:** `MAIN_SEQUENCE_BURN` aus `progression.ts` verallgemeinern und
als optionales Feld `structuralBurn: { ratePerSecond, massExponent }` an die
Reaktionsdefinition hängen. Dann bekommt jede Brennphase ihren eigenen
massenabhängigen Grundumsatz – physikalisch korrekt (massereiche Sterne
verbrennen Helium in Jahrtausenden statt Jahrmilliarden) und spielerisch
genau die Kurve, die gebraucht wird.

Wirkung: Die Rundendauer wird über alle Wolkenstufen weitgehend **flach**
statt sich pro Stufe zu verdoppeln. Das löst den Heliumwall, die
Vier-Stunden-Runden und einen Großteil des Klickzwangs in einem Schritt.

Alternativ oder zusätzlich: Automationsraten mit `(M/M_ref)^k`
multiplizieren, statt nur an der Stufe zu hängen.

### P3 – Automation gegenüber manuellem Klicken aufwerten

Ziel: Automation soll im Spätspiel die **primäre** Quelle sein, der Klick
der Beschleuniger. Konkret eine Kombination aus:

- Maximalstufe der Reaktionsautomationen von 8 anheben (oder öffnen) mit
  weiter steigenden Kosten – das schafft nebenbei den fehlenden Energie-Sink;
- die manuelle Ausbaukurve flacher halten als die Automationskurve;
- eine Klick-Obergrenze pro Sekunde in der Wirkung (kein Vorteil aus
  Autoklickern), damit Balancing gegen eine bekannte Rate möglich ist.

### P4 – Sternenstaub an die Leistung koppeln

**Empfehlung:** Belohnung nicht mehr nur aus der Endzustands-Kategorie
ableiten, sondern multiplikativ:

```text
Sternenstaub = Basis(Endzustand) × (Endmasse in M☉ / Referenzmasse)^0,6
```

Zielgröße: ✦ pro Stunde soll über die Wolkenstufen **flach bis leicht
steigend** verlaufen, nie fallend. Zusätzlich sinnvoll: ein
Erkenntnis-Bonus aus Spitzentemperatur und insgesamt umgesetztem Brennstoff,
damit auch *wie* gespielt wurde zählt und nicht nur der Endzustand.

Wenn P2 umgesetzt ist und die Rundendauer flach wird, genügt schon die
bestehende Belohnungsstaffel, um die Inversion zu beseitigen.

### P5 – Neue Systeme gegen die Inhaltsdecke

Vier Vorschläge, absteigend nach Verhältnis von Wirkung zu Aufwand.

#### A. Metallizität – der stärkste Vorschlag

Ein permanenter Meta-Wert, der aus den **schweren Elementen im Sternrest**
der Vorrunde entsteht und die nächste Urwolke anreichert.

- Die Urwolke enthält dann C, O, Ne statt nur H/He/D.
- Kohlenstoff in der Wolke schaltet den **CNO-Zyklus** frei: ein
  Wasserstoffbrennen mit anderer Kurve (stark temperaturabhängig, deutlich
  schneller bei massereichen Sternen) – eine zweite Wasserstoffreaktion mit
  eigener Kachel, eigener Automation, eigenem Ausbau.
- Metallreiche Wolken kühlen effizienter → niedrigere Zündschwellen, dafür
  stärkerer Sternwind. Ein echter Zielkonflikt statt eines weiteren
  Multiplikators.
- Neue Endzustände werden erreichbar (z. B. Paarinstabilitäts-Supernova nur
  bei sehr *metallarmen* massereichen Sternen – gibt der frühen,
  metallfreien Wolke dauerhaft einen Grund).

Das ist der Vorschlag mit dem größten Hebel, weil er den Meta-Loop von „eine
Zahl steigt“ in „ich forme einen Zustand“ verwandelt: Zum ersten Mal ist
relevant, **wie** eine Runde endete, nicht nur **dass** sie endete. Die
Design-Referenz listet Metallizität bereits unter den vorgesehenen
Erweiterungen – sie ist auch die richtige.

#### B. Die Supernova als eigene, spielbare Phase

Der Eisenkern löst derzeit sofort `completeRun()` aus. Stattdessen:

- Stadium `supernova` wird tatsächlich betreten, mit kurzer, intensiver
  Kollapsphase (30–60 s, eigene Optik, eigener Sound).
- Während des Kollapses entscheidet der Spieler aktiv: Wie viel Hülle wird
  abgestoßen? Das bestimmt die Restmasse und damit Neutronenstern gegen
  Schwarzes Loch – der Endzustand wird zur letzten Entscheidung statt zur
  Ableitung.
- Der r-Prozess erzeugt in dieser Phase schwere Elemente jenseits von Eisen,
  die als Metallizität (Vorschlag A) in die nächste Runde fließen.

Das gibt den langen Runden genau den Höhepunkt, der ihnen heute fehlt, und
nutzt ein bereits definiertes, aber ungenutztes Stadium.

#### C. Zweite Prestige-Ebene: „Galaktische Anreicherung“

Setzt Sternenstaub und Perks zurück, zahlt eine höherwertige Währung aus
**Rekorden und Vielfalt** statt aus Masse:

- Anzahl unterschiedlicher entdeckter Endzustände,
- höchste je erreichte Endmasse, schnellstes Schwarzes Loch,
- insgesamt erzeugtes Eisen.

Perks dieser Ebene sind bewusst andere als auf Ebene 1: Startwolkenstufe,
Startgravitation, Anhebung der Automations-Maximalstufen, **Offline-Rate**,
und Zeitraffer-Ladungen. Das ist die klassische und bewährte Antwort auf
„was mache ich in Woche zwei“.

#### D. Herausforderungswolken

Sehr günstig zu bauen, weil rein datengetrieben – ein Satz Multiplikatoren
auf bestehende Werte, wählbar am Zyklusstart:

| Modifikator | Effekt |
| --- | --- |
| Metallarm | kein Deuterium, langsamere Erwärmung |
| Hyperdicht | ×3 Akkretion, ×3 Wolkenwind |
| Binärsystem | ein Begleiter zieht periodisch Masse ab, liefert dafür Energie |
| Zeitdruck | Wolke zerstreut sich 5× schneller |
| Reine Hand | keine Automationen kaufbar |

Jeder Erstabschluss zahlt einen permanenten Perkpunkt. Hoher
Wiederspielwert pro investierter Entwicklungszeit.

### P6 – Kleinere Korrekturen

- **Alpha-Einfang und Kohlenstofffusion zu einer echten Entscheidung machen.**
  Heute frisst der Alpha-Einfang den Kohlenstoff, bevor Neon existiert.
  Besser: Der Spieler wählt bewusst zwischen sauerstoffreichem und
  neonreichem Kern, und diese Wahl beeinflusst den Endzustand oder die
  Supernova-Ausbeute. Damit wird aus totem Inhalt eine Verzweigung.
- **Unbegrenzter Energie-Sink im Spätspiel**, z. B. „Kernrotation“ (+5 %
  Fusion pro Stufe, exponentielle Kosten, kein Maximum). Hält die Kaufschleife
  bis zum Rundenende am Leben und beseitigt die 13 Millionen ungenutzter
  Energie.
- **Deuteriumbrennen zu einer Wahl machen** – etwa: sofort verbrennen für
  schnelle Erwärmung, oder aufsparen für einen späteren Effekt.
- **Massenverlust sichtbar machen.** Eine Prognose der Endmasse beim
  aktuellen Verlusttempo, mit Markierung der nächsten Endzustands-Schwelle.
  Dann wird aus der unsichtbaren Falle spürbarer Zeitdruck.
- **Design-Referenz korrigieren:** Der Wert „etwa 53 Klicks“ für den ersten
  Protostern (Abschnitt 2 der Referenz) liegt gemessen bei 652.

---

## 9. Vorgeschlagene Reihenfolge

1. **Idle-Deadlock beheben** (P1) – kleinster Eingriff, größte Wirkung auf
   die Frage „trägt es über Tage“.
2. **Strukturellen Brand verallgemeinern** (P2) – löst Heliumwall,
   Rundenlänge und Klickzwang gemeinsam.
3. **Sternenstaub an die Leistung koppeln** (P4) – dreht die Meta-Ökonomie
   in die richtige Richtung; nach Schritt 2 nur noch eine kleine Korrektur.
4. **Supernova als Phase** (P5-B) – sichtbarster inhaltlicher Zugewinn bei
   überschaubarem Aufwand, nutzt Vorhandenes.
5. **Metallizität** (P5-A) – das eigentliche neue Spiel für Woche zwei.
6. **Zweite Prestige-Ebene und Herausforderungen** (P5-C, P5-D) – sobald es
   genug Zustände gibt, über die sich Rekorde lohnen.

Schritt 1 bis 3 sind Balancing an bestehenden Systemen und bringen das Spiel
von „5–8 Stunden“ auf „solide zweistellig“. Schritt 4 bis 6 sind neue
Inhalte und öffnen den Zeitraum von Wochen.
