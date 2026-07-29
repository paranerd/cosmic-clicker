# Cosmic Clicker

Ein responsives Browser-Spiel über die Entstehung und Entwicklung eines Sterns – von der Urwolke bis zum kompakten Sternrest.

## Enthalten

- Stufenloses, prozentuales Wolkenwachstum ab einer kalibrierten 0,07-Sonnenmassen-Urwolke mit realistischer, einheitlicher Ur-Zusammensetzung
- Aktive und automatische Akkretion
- Fusionsring um den Stern: eine ausgewählte Reaktion wird durch Klicks auf den Stern ausgeführt
- Temperatur- und Druckentwicklung durch gravitative Kontraktion
- Deuteriumbrennen als zeitlich begrenztes Upgrade sowie eine konfigurationsgetriebene Brennkette von Wasserstoff bis zur Eisengruppe
- Massenabhängige Entwicklung zu Braunem Zwerg, mehreren Weißer-Zwerg-Typen, Neutronenstern oder Schwarzem Loch
- Zeitbasierte Hauptreihe mit strukturellem Wasserstoffbrennen und massenabhängigem Hüllenwind, der den späteren Sternrest beeinflussen kann
- Sternmasse zusätzlich als Sonnenmassen-Anzeige (M☉) in den Kerndaten und an Entwicklungsschwellen
- Upgrades, Automationen und ein permanentes Prestige-System
- Wissenschaftliche Kurzinfos und Sternenlogbuch
- Automatische Speicherung, bis zu acht Stunden Offline-Fortschritt sowie Import/Export
- Kurzes, überspringbares Tutorial mit jederzeit möglicher Wiederholung
- Synthetisierte Soundeffekte mit gespeichertem Lautstärkeregler und Stummschaltung
- Laufende Statistiken, Rundenauswertung und Chronik der letzten Zyklen
- Responsive Desktop- und Smartphone-Oberfläche
- Installierbare PWA mit vollständigem Offline-Betrieb und bestätigtem Update statt stillem Neuladen
- Unit-Tests sowie Browser-Tests für Produktions- und Entwicklungsmodus

## Entwicklung

```bash
npm install
npm run dev
```

Die lokale App läuft anschließend standardmäßig auf `http://localhost:5173`.

## Prüfen

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm run test:dev-e2e
```

Service Worker und Manifest entstehen nur im Build, nicht im Dev-Server. Zum Prüfen der PWA daher `npm run build && npm run preview` verwenden — `tests/e2e/pwa.spec.ts` läuft ohnehin gegen die Vorschau.

Zwei Umgebungsvariablen steuern den Build:

| Variable | Standard | Zweck |
| --- | --- | --- |
| `BASE_PATH` | `/cosmic-clicker/` im Build, `/` im Dev-Server | Basis-Pfad; eine native Hülle lädt aus der Wurzel |
| `DISABLE_PWA` | nicht gesetzt | Auf `1` entfällt der Service Worker |

Ein Build für eine spätere native Hülle (z. B. Capacitor) lautet damit `BASE_PATH=/ DISABLE_PWA=1 npm run build`. In diesem Fall muss `setSaveAdapter` aus `src/game/save-adapter.ts` vor dem ersten Laden auf den nativen Speicher zeigen, weil der WebView-`localStorage` unter iOS nicht dauerhaft ist.

Nur im Dev-Server steht in der Browser-Konsole `cosmicDebug()` zur Verfügung. Die Funktion öffnet das Balance-Panel für schnelle Rundentests und ist im produktiven Build nicht enthalten.

## Aufbau

- `src/game/engine.ts` enthält die deterministischen Spielregeln.
- `src/content/` bündelt Reaktionen, Upgrades, Automationen, Wolken, Ressourcen, Progression, Ziele/Erfolge und Prestige-Inhalte.
- `src/game/storage.ts` verwaltet Browser-Speicherung und Offline-Fortschritt.
- `src/game/save-adapter.ts` kapselt den Plattform-Speicher hinter `read`/`write`/`clear`.
- `src/main.ts` rendert die Oberfläche und verbindet Interaktionen mit der Engine.
- `src/pwa.ts` registriert den Service Worker und meldet Updates über einen bestätigenden Toast.
- `src/styles.scss` enthält das responsive visuelle System und die Sternanimation.

Die spielbare Brennkette umfasst Wasserstoff-, Helium-, Kohlenstoff-, Neon-, Sauerstoff- und Siliziumfusion bis zum Eisenkern. Welche Endstufe erreicht wird, hängt von Brennstoff, Temperatur und Sternmasse ab.
