# Cosmic Clicker

Ein responsives Browser-Spiel über die Entstehung und Entwicklung eines Sterns – von der Urwolke bis zum kompakten Sternrest.

## Enthalten

- Physikalisch neu kalibrierte Urwolken von 0,07 bis 25 Sonnenmassen
- Aktive und automatische Akkretion
- Temperatur- und Druckentwicklung durch gravitative Kontraktion
- Deuteriumbrennen als zeitlich begrenztes Upgrade sowie eine konfigurationsgetriebene Brennkette von Wasserstoff bis zur Eisengruppe
- Massenabhängige Entwicklung zu Braunem Zwerg, mehreren Weißer-Zwerg-Typen, Neutronenstern oder Schwarzem Loch
- Upgrades, Automationen und ein permanentes Prestige-System
- Wissenschaftliche Kurzinfos und Sternenlogbuch
- Automatische Speicherung, bis zu acht Stunden Offline-Fortschritt sowie Import/Export
- Kurzes, überspringbares Tutorial mit jederzeit möglicher Wiederholung
- Synthetisierte Soundeffekte mit gespeichertem Lautstärkeregler und Stummschaltung
- Laufende Statistiken, Rundenauswertung und Chronik der letzten Zyklen
- Responsive Desktop- und Smartphone-Oberfläche
- Unit-Tests sowie Browser-Tests für Produktions- und Entwicklungsmodus

## Entwicklung

```bash
npm install
npm run dev
```

Die lokale App läuft anschließend standardmäßig auf `http://localhost:5173`.

## Prüfen

```bash
npm run build
npm test
npm run test:e2e
npm run test:dev-e2e
```

Nur im Dev-Server steht in der Browser-Konsole `cosmicDebug()` zur Verfügung. Die Funktion öffnet das Balance-Panel für schnelle Rundentests und ist im produktiven Build nicht enthalten.

## Aufbau

- `src/game/engine.ts` enthält die deterministischen Spielregeln.
- `src/content/` bündelt Reaktionen, Upgrades, Automationen, Wolken, Ressourcen, Progression und Prestige-Inhalte.
- `src/game/config.ts` stellt die zentralen Inhalte für ältere Importe gesammelt bereit.
- `src/game/storage.ts` verwaltet Browser-Speicherung und Offline-Fortschritt.
- `src/main.ts` rendert die Oberfläche und verbindet Interaktionen mit der Engine.
- `src/styles.scss` enthält das responsive visuelle System und die Sternanimation.

Die spielbare Brennkette umfasst Wasserstoff-, Helium-, Kohlenstoff-, Neon-, Sauerstoff- und Siliziumbrennen bis zum Eisenkern. Welche Endstufe erreicht wird, hängt von Brennstoff, Temperatur und Sternmasse ab.
