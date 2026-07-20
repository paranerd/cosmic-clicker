# Cosmic Clicker

## Technische Basis

Es soll zunächst web-basiert laufen mit HTML, TypeScript und SCSS als Basis. Später vielleicht als mobile App. Es soll eine Testsuite geben, um nach jeder Änderung prüfen zu können, ob alles noch funktioniert.

## Thema

Das Setting ist die Entwicklung von der Gaswolke bis zum Stern, später vielleicht mehrere Sterne und sogar Galaxien.

Das Spiel soll sich, soweit es die Spielbarkeit zulässt, möglichst nahe an der Realität halten, damit der Spieler etwas über Astrophysik lernen kann.

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
- Beim Start der geführten Tour erscheint das erste Ziel-Popup erst nach Abschluss oder Überspringen des Tutorials; beim direkten Start erscheint es unmittelbar nach dem Intro.
- Jeder neue Zielabschnitt wird einmalig als zu bestätigendes Popup gezeigt.
- Das Tutorial dunkelt nicht relevante Bildschirmbereiche ab, scrollt auf Mobilgeräten zum Fokus und zeigt seine Erklärung dort horizontal zentriert.
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
- Der Braune Zwerg gilt als erste erfolgreiche Entdeckung, nicht als Niederlage. Er gewährt garantiert genug Sternenstaub für die nächste Wolkenstufe.
- Der permanente Perk „Wolkenwachstum“ schaltet nacheinander eine stellare und eine massereiche Urwolke frei. Bereits freigeschaltete Größen bleiben für spätere Zyklen auswählbar.
- Die stellare Urwolke ermöglicht den Pfad über Wasserstoffbrennen, Hauptreihe, Roten Riesen, Heliumbrennen und einen Kohlenstoff-Sauerstoff-Kern bis zum Weißen Zwerg.
- Die massereiche Urwolke führt nach den detaillierten Wasserstoff- und Heliumphasen über zusammengefasste späte Brennphasen zur Supernova. Die akkretierte Endmasse entscheidet zwischen Neutronenstern und Schwarzem Loch.
- Heliumbrennen wird als Triple-Alpha-Prozess umgesetzt. Kohlenstoff und Sauerstoff sind sichtbare, gespeicherte Kernressourcen; Sauerstoff entsteht durch Alpha-Einfang an Kohlenstoff.
- Neon-, Sauerstoff- und Siliziumbrennen werden in v0.3 bewusst als „Späte Brennphasen“ zusammengefasst.
- Der bestehende Sternenstaub bleibt die einzige Prestige-Währung. Der Vermächtnis-Baum erhält die Äste Wolkenwachstum, Akkretion und Fusion.
- Eine interaktive Entwicklungsübersicht in der Chronik zeigt den aktuellen Pfad, bekannte Endzustände und noch nicht entdeckte Abzweigungen.
- Echte Wendepunkte werden weiterhin einmalig als Ziel-Popup erklärt; Detailwissen bleibt freiwillig in Reaktionskarten und Chronik.
- Bestehende v0.1- bis v0.2-Spielstände werden auf das neue Zustandsmodell migriert. Abgeschlossene Runden bleiben in der Historie erhalten.
- Die Verdichtung bis zum ersten Protostern benötigt ohne Upgrades ungefähr 50 bis 60 aktive Impulse. Die erste Brauner-Zwerg-Runde zielt auf etwa 7 bis 10 Minuten; vollständige stellare Runden auf etwa 20 bis 30 Minuten und werden durch Vermächtnis-Perks schneller.
- „Stabiles Wasserstoffbrennen“ erscheint erst nach Freischaltung des Wasserstoffbrennens und wird nach 5.000 ME durch Fusion selbst erzeugtem Helium kaufbar.

### Meilenstein v0.4 – detaillierte Sternphysik und neue Systeme

Nach dem vollständigen v0.3-Lebenszyklus können folgende Vertiefungen umgesetzt werden:

- Einzelne Reaktionen und Ressourcen für Kohlenstoff-, Neon-, Sauerstoff- und Siliziumbrennen bis zum Eisenkern
- Physikalisch kalibrierte Massen in Sonnen- und Jupitermassen statt ausschließlich abstrakter Materieeinheiten
- Metallizität, unterschiedliche chemische Zusammensetzungen und weitere Typen von Sternentstehungswolken
- Detailliertere Brauner-Zwerg-Entwicklung einschließlich Deuterium- und gegebenenfalls Lithiumbrennen
- Zeitabhängige Hauptreihen- und Abkühlphasen mit stärkerer Offline-Progression
- Weitere masseabhängige Unterklassen von Weißen Zwergen, Supernovae, Neutronensternen und Schwarzen Löchern
- Rotation, Magnetfelder, Masseverlust und stellare Winde als neue Einflussgrößen
- Binärsterne, Massentransfer und alternative Supernova-Pfade
- Ausgebaute Automationen für Helium- und schwere Brennphasen
- Entdeckungsarchiv mit wissenschaftlichen Kurzartikeln zu allen beobachteten Entwicklungsstufen
- Erste planetare Systeme und die Abhängigkeit ihrer Entstehung von Sternmasse und Metallizität
