export type TutorialTrigger = 'accrete' | 'next' | 'panel' | 'open-chronicle';

export interface TutorialStep {
  title: string;
  text: string;
  selector: string;
  trigger: TutorialTrigger;
}

export const TUTORIAL_STEPS = [
  { title: 'Materie einsammeln', text: 'Klicke auf den Stern. Ein Teil der Urwolke fällt ins Zentrum und erhöht Masse, Druck und Temperatur.', selector: '.star-button', trigger: 'accrete' },
  { title: 'Den Kern beobachten', text: 'Links siehst du Temperatur, Druck, Energie und Zusammensetzung. Diese Werte bestimmen, welche Reaktionen möglich sind.', selector: '.left-panel', trigger: 'next' },
  { title: 'Energie aus Fusionen', text: 'Jede Fusion im Kern setzt Energie frei. Mit dieser Energie kannst du bestimmte Upgrades und Automationen freischalten.', selector: '.energy-metric', trigger: 'next' },
  { title: 'Sternenstaub sammeln', text: 'Sternenstaub erhältst du am Ende eines stellaren Lebenszyklus. Nutze ihn für dauerhafte Vermächtnis-Upgrades und größere Urwolken.', selector: '.resource-chip', trigger: 'next' },
  { title: 'Sternsysteme steuern', text: 'Öffne einen der drei Tabs. Reaktionen treiben den Stern an, Upgrades verstärken ihn und Automationen übernehmen wiederkehrende Arbeit.', selector: '.side-tabs', trigger: 'panel' },
  { title: 'Entwicklung nachverfolgen', text: 'Öffne die Chronik. Sie zeigt Meilensteine und erklärt, was im Kern deines Sterns geschieht.', selector: '.chronicle-dock', trigger: 'open-chronicle' },
] as const satisfies readonly TutorialStep[];
