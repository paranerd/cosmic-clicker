import type { AutomationKind } from './automations';
import { OBJECTIVES } from './objectives';
import type { UpgradeId } from './upgrades';

export type TutorialAvailability =
  | { type: 'immediate' }
  | { type: 'energy-at-least'; amount: number }
  | { type: 'upgrade-affordable'; id: UpgradeId; panel: 'upgrades' }
  | { type: 'automation-affordable'; id: AutomationKind; panel: 'automation' };

export type TutorialTrigger =
  | { type: 'next'; label: 'Weiter' | 'Verstanden' }
  | { type: 'action'; action: string; hint: string };

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  selector?: string;
  availability: TutorialAvailability;
  trigger: TutorialTrigger;
  completesInitialTour?: boolean;
}

const immediate = { type: 'immediate' } as const;
const next = { type: 'next', label: 'Weiter' } as const;

// Reihenfolge, Zeitpunkt, Ziel und Abschlussbedingung jedes Schritts stehen
// vollständig in dieser Liste. Neue Tutorialschritte brauchen dadurch keine
// zusätzliche Ablaufsteuerung in der UI.
export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Willkommen bei Cosmic Clicker!',
    text: 'Ich zeige dir, wie mit etwas Geduld aus winzig kleinen Materieteilchen ein riesiger Stern entstehen kann. Lass uns gemeinsam die ersten Schritte machen.',
    availability: immediate,
    trigger: next,
  },
  {
    id: 'realtime-data',
    title: 'Dein Stern im Blick',
    text: 'Hier siehst du die wichtigsten Daten deines Sterns: Temperatur, Masse, Kerndruck und Energie. Noch ist er sehr kalt – doch das wird sich gleich ändern!',
    selector: '[data-tutorial="realtime-data"]',
    availability: immediate,
    trigger: next,
  },
  {
    id: 'primordial-cloud',
    title: 'Alles beginnt in der Urwolke',
    text: 'Das ist die Urwolke – der Ausgangspunkt deines Sterns. Mit Hilfe der Gravitation sammelst du daraus gleich Materie ein. Diesen Vorgang nennt man Akkretion. So verdichtet sich die Materie Schritt für Schritt zu einem Stern.',
    selector: '[data-tutorial="matter-reservoir"]',
    availability: immediate,
    trigger: next,
  },
  {
    id: 'cloud-composition',
    title: 'Der kosmische Baustoff',
    text: 'Die Urwolke besteht überwiegend aus Wasserstoff und Helium. Sie kann aber auch bereits schwerere Elemente wie Kohlenstoff und Sauerstoff enthalten.',
    selector: '[data-tutorial="cloud-composition"]',
    availability: immediate,
    trigger: next,
  },
  {
    id: 'first-accretion',
    title: 'Dein erster Akkretionsimpuls',
    text: 'Klicke auf deinen Stern, um zum ersten Mal Materie aus der Urwolke zu akkretieren.',
    selector: '[data-tutorial="star"]',
    availability: immediate,
    trigger: { type: 'action', action: 'accrete', hint: 'Klicke auf den markierten Stern.' },
  },
  {
    id: 'core-composition',
    title: 'Materie für den Sternenkern',
    text: 'Glückwunsch! Deine erste akkretierte Materie ist nun Teil des Sternenkerns. In der Kernzusammensetzung siehst du, welche Elemente sich dort befinden.',
    selector: '[data-tutorial="core-composition"]',
    availability: immediate,
    trigger: next,
  },
  {
    id: 'next-objective',
    title: 'Dein nächstes Ziel',
    text: 'Sammle nun weiter Materie, bis ihre Verdichtung eine volle Energieeinheit erzeugt hat. Hier siehst du dein aktuelles Ziel.',
    selector: '[data-tutorial="objective"]',
    availability: immediate,
    trigger: next,
  },
  {
    id: 'objective-progress',
    title: 'Fortschritt im Blick',
    text: 'Der Fortschrittsbalken zeigt dir, wie nah du deinem aktuellen Ziel bist. Behalte ihn im Auge, um zu sehen, ob du auf dem richtigen Weg bist.',
    selector: '[data-tutorial="objective-progress"]',
    availability: immediate,
    trigger: { type: 'next', label: 'Verstanden' },
    completesInitialTour: true,
  },
  {
    id: 'accretion-energy',
    title: 'Energie für dein Wachstum',
    text: `Geschafft! Durch die Verdichtung deiner gesammelten Materie hast du Energie erzeugt. Sammle weiter, bis du ${OBJECTIVES['generate-upgrade-energy'].target} Energie für dein erstes Upgrade hast.`,
    selector: '[data-tutorial="energy"]',
    availability: { type: 'energy-at-least', amount: 1 },
    trigger: next,
  },
  {
    id: 'first-upgrade',
    title: 'Dein erstes Upgrade',
    text: 'Hurra! Dein erstes Upgrade ist verfügbar. Setze deine gesammelte Energie ein, um die „Gravitative Verdichtung“ freizuschalten. Später kannst du sie noch weiter ausbauen.',
    selector: '[data-upgrade-card="gravity"]',
    availability: { type: 'upgrade-affordable', id: 'gravity', panel: 'upgrades' },
    trigger: { type: 'action', action: 'buy-gravity', hint: 'Schalte das markierte Upgrade frei.' },
  },
  {
    id: 'first-automation',
    title: 'Automatische Akkretion',
    text: 'Was für eine Erleichterung! Dein Stern besitzt nun genügend Masse für einen Akkretionsstrom. Schalte die automatische Akkretion frei, damit sie dich beim Einsammeln von Materie unterstützt.',
    selector: '[data-automation-card="accretion"]',
    availability: { type: 'automation-affordable', id: 'accretion', panel: 'automation' },
    trigger: { type: 'action', action: 'buy-accretion', hint: 'Schalte die markierte Automation frei.' },
  },
  {
    id: 'automatic-accretion-effect',
    title: 'Der Akkretionsstrom arbeitet',
    text: 'Sieh nur! Materie aus der Urwolke wird nun mit Hilfe der Gravitation automatisch im Kern verdichtet.',
    selector: '[data-tutorial="left-panel"]',
    availability: immediate,
    trigger: next,
  },
] as const satisfies readonly TutorialStep[];

// Schritt-IDs der Tutorialfassung vor dem Willkommen-Schritt. Spielstände,
// die noch keine stabile `stepId` besitzen, behalten damit beim Laden exakt
// ihren bisherigen semantischen Schritt.
export const LEGACY_TUTORIAL_STEP_IDS = [
  'realtime-data',
  'primordial-cloud',
  'cloud-composition',
  'first-accretion',
  'core-composition',
  'accretion-energy',
  'first-objective',
  'objective-progress',
  'first-upgrade',
  'first-automation',
] as const;

// Stabile Zuordnung für Spielstände, die den inzwischen präziser benannten
// Schritt noch als `first-objective` gespeichert haben.
export const LEGACY_TUTORIAL_STEP_ID_ALIASES: Readonly<Record<string, string>> = {
  'first-objective': 'next-objective',
};
