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
- Responsive Desktop- und Smartphone-Oberfläche
- Unit-Tests und Browser-Smoke-Test

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
```

## Aufbau

- `src/game/engine.ts` enthält die deterministischen Spielregeln.
- `src/game/config.ts` bündelt Schwellenwerte und Limits.
- `src/game/storage.ts` verwaltet Browser-Speicherung und Offline-Fortschritt.
- `src/main.ts` rendert die Oberfläche und verbindet Interaktionen mit der Engine.
- `src/styles.scss` enthält das responsive visuelle System und die Sternanimation.

Der Vertical Slice endet beim hydrostatischen Gleichgewicht eines Hauptreihensterns. C-, O-, Ne-, Si- und Fe-Brennen sind im Entwicklungsbaum vorbereitet, aber bewusst noch nicht spielbar.
