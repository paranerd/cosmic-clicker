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
- Deuteriumbrennen (ab 1M Kelvin und nur bis zum Wasserstoffbrennen / pp-Kette): hilft, die Temperatur schneller zu erhöhen

## Prestige / Perks

Irgendwann zerfällt der Stern z.B. zum Weißen Zwerg oder explodiert in einer Supernova, oder was sonst noch möglich ist. Dann ist eine Runde beendet und der Spieler kann sich gegen Zahlung einer festzulegenden Währung Perks für die nächste Runde kaufen

Beispiele:

- Größere Ausgangswolke
- Dauerhaft höhere Gravitation
