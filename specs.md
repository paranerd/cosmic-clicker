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
- Das Tutorial ist überspringbar und kann über die Hilfe erneut gestartet werden.
- Ein vollständig neuer Spielstand beginnt mit einem kurzen Intro, das Spielziel und Ablauf erklärt und die Wahl zwischen einer geführten Tour und einem direkten Start anbietet.
- Das Intro zeigt den Namen „Cosmic Clicker“ und erscheint mit einer kurzen, bei reduzierter Bewegung deaktivierten Animation. „Ein neuer Kosmos beginnt.“ wird erst nach der Bestätigung des ersten Ziels angezeigt.
- Beim Start der geführten Tour erscheint das erste Ziel-Popup erst nach Abschluss oder Überspringen des Tutorials; beim direkten Start erscheint es unmittelbar nach dem Intro.
- Jeder neue Zielabschnitt wird einmalig als zu bestätigendes Popup gezeigt.
- Das Tutorial dunkelt nicht relevante Bildschirmbereiche ab, scrollt auf Mobilgeräten zum Fokus und zeigt seine Erklärung dort horizontal zentriert.
- Die erste Urwolke besteht zur Vereinfachung ausschließlich aus Wasserstoff; ab Zyklus 2 gilt wieder die kosmische Mischung aus Wasserstoff, Helium und einer Spur Deuterium.
- Das Deuteriumbrennen ist ein einmaliges Upgrade ab 1 Mio. K: Es kostet 75 Energie und verstärkt die Erwärmung um 35 %, jedoch nicht über die Schwelle des Wasserstoffbrennens hinaus.
- Die Proton-Proton-Kette wird in der Spieleroberfläche verständlich als Wasserstoffbrennen bezeichnet.
- Toast-Meldungen erscheinen horizontal zentriert im oberen Bildschirmbereich.
- Die Soundeffekte werden ohne externe Audiodateien über die Web Audio API erzeugt; Lautstärke (Standard: 35 %) und Stummschaltung werden gespeichert.
- Die Rundenauswertung erfasst Klicks, Reaktionen, akkretierte Materie, erzeugte Energie, Offline-Zeit, Käufe, Rundendauer und erhaltenen Sternenstaub.
- Der Debug-/Balance-Modus wird ausschließlich vom Vite-Dev-Server als `cosmicDebug()` in der Browser-Konsole angeboten und darf im produktiven Build nicht enthalten sein.

### Meilenstein v0.3 – echte Sternentwicklung

Erst nach v0.2 beginnt der große Ausbau über den Hauptreihenstern hinaus:

- Verschiedene Wolkengrößen
- Brauner Zwerg als alternativer Ausgang
- Heliumbrennen und Triple-Alpha-Prozess
- Kohlenstoff und Sauerstoff
- Masseabhängige Entwicklungszweige
- Weißer Zwerg, Supernova, Neutronenstern und Schwarzes Loch
- Umfangreicherer Prestige-Baum
