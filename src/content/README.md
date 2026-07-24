# Spielinhalte und Balance

Dieser Ordner enthält die deklarativen Inhalte des Spiels. Hier gehören Namen,
Beschreibungen, Kosten, Raten, Grenzwerte und Freischaltbedingungen hin. Die
Zustandsänderungen bleiben dagegen in `src/game/engine.ts`. Die universelle
Stufenformel ist als gemeinsam verwendete Rechenregel Teil der Inhalte.

- `resources.ts`: Elemente und ihre Darstellung
- `level-formula.ts`: universelle Formel für Kosten- und Ertragskurven
- `clouds.ts`: Urwolken, Startmaterie und erwartete Entwicklungswege
- `reactions.ts`: manuelle Kernreaktionen, Umwandlungsraten und Energieertrag
- `automations.ts`: Automationen, Kostenkurven, Produktionsraten und Meisterschaftsziele
- `upgrades.ts`: normale Upgrades und ihre Effekte
- `progression.ts`: Schwellenwerte, Stufen, Temperaturmodell und Sternwind
- `objectives.ts`: Ziel- und Erfolgstexte der frühen Formationsphasen und des
  Rundenabschlusses (`OBJECTIVES`) sowie der generische Auflöser
  `achievementTitleFor()` für das Ziel-Banner; reaktionsbezogene Ziel- und
  Erfolgstexte liegen dagegen direkt bei ihrer Reaktion in `reactions.ts`
  (`ignitionAchievementTitle`/`completionAchievementTitle`)
- `prestige.ts`: Sternenstaub, Ergebnisse und dauerhafte Perks
- `tutorial.ts`: Reihenfolge und Texte der Einführung
- `index.ts`: gemeinsamer Einstiegspunkt für Importe

Neue Balancewerte sollten möglichst nur an einer Stelle definiert und von
Spielkern sowie Oberfläche gemeinsam verwendet werden. Das gilt auch für
Anzeigetexte von `objectiveFor()` (`game/engine.ts`): Die Funktion berechnet
nur noch Fortschritt und wählt die passende Ziel-ID, die Texte selbst kommen
aus `objectives.ts`/`reactions.ts`.

Perks, Upgrades und Automationen speichern ihre berechnete Stufenkurve
einheitlich unter `value` und ihre Kaufkurve unter `cost`.
