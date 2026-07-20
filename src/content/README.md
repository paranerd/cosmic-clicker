# Spielinhalte und Balance

Dieser Ordner enthält die deklarativen Inhalte des Spiels. Hier gehören Namen,
Beschreibungen, Kosten, Raten, Grenzwerte und Freischaltbedingungen hin. Die
Berechnungen und Zustandsänderungen bleiben dagegen in `src/game/engine.ts`.

- `resources.ts`: Elemente und ihre Darstellung
- `clouds.ts`: Urwolken, Startmaterie und erwartete Entwicklungswege
- `reactions.ts`: manuelle Kernreaktionen, Umwandlungsraten und Energieertrag
- `automations.ts`: Automationen, Kostenkurven, Produktionsraten und Meisterschaftsziele
- `upgrades.ts`: normale Upgrades und ihre Effekte
- `progression.ts`: Schwellenwerte, Stufen, Temperaturmodell und Sternwind
- `prestige.ts`: Sternenstaub, Ergebnisse und dauerhafte Perks
- `tutorial.ts`: Reihenfolge und Texte der Einführung
- `index.ts`: gemeinsamer Einstiegspunkt für Importe

Neue Balancewerte sollten möglichst nur an einer Stelle definiert und von
Spielkern sowie Oberfläche gemeinsam verwendet werden.
