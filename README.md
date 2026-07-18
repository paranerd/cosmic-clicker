# Cosmic Clicker

Ein responsiver Browser-Prototyp über die Entstehung eines Sterns – von der Urwolke bis zum stabilen Wasserstoffbrennen.

## Enthalten

- Endliche Urwolke aus Wasserstoff, Helium und einer Spur Deuterium
- Aktive und automatische Akkretion
- Temperatur- und Druckentwicklung durch gravitative Kontraktion
- Begrenztes Deuteriumbrennen und Proton-Proton-Kette
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
- `src/game/config.ts` bündelt Schwellenwerte und Limits.
- `src/game/storage.ts` verwaltet Browser-Speicherung und Offline-Fortschritt.
- `src/main.ts` rendert die Oberfläche und verbindet Interaktionen mit der Engine.
- `src/styles.scss` enthält das responsive visuelle System und die Sternanimation.

Der Vertical Slice endet beim hydrostatischen Gleichgewicht eines Hauptreihensterns. C-, O-, Ne-, Si- und Fe-Brennen sind im Entwicklungsbaum vorbereitet, aber bewusst noch nicht spielbar.
