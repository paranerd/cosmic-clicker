import type { ReactionId, Stage } from '../game/types';
import type { MatterKey } from './resources';
import { THRESHOLDS } from './progression';

// Punkt 4: generische Warnung (vormals "WindWarning") — wird einmalig im
// Ziel-Banner gezeigt, wenn der zugehörige Wendepunkt erreicht ist.
export interface Warning {
  title: string;
  text: string;
}

export interface ReactionDefinition {
  id: ReactionId;
  title: string;
  kicker: string;
  description: string;
  equationInput: string;
  equationOutput: string;
  manualAmount: number;
  // Punkt 2: Energie-Basiskosten der ersten Ausbaustufe (siehe REACTION_UPGRADE).
  upgradeBaseCost: number;
  primaryInput: MatterKey;
  // Haupterzeugnis der Reaktion. Es steuert unter anderem das Element-Icon
  // der Karte und bleibt auch bei späteren Reaktionen mit mehreren Produkten
  // eindeutig, statt von der Reihenfolge der output-Keys abzuhängen.
  primaryOutput: MatterKey;
  inputs: Partial<Record<MatterKey, number>>;
  outputs: Partial<Record<MatterKey, number>>;
  ignitionTemperature: number;
  minimumMass: number;
  stageOnUnlock: Stage;
  energyBasis: 'input' | 'output';
  energyPerUnit: number;
  heatPerUnit: number;
  automation: 'fusion' | 'heliumFusion' | 'oxygenSynthesis' | 'carbonFusion' | 'neonFusion' | 'oxygenFusion' | 'siliconFusion';
  // Erfolgstitel für das Ziel-Banner (siehe objectives.ts/achievementTitleFor):
  // ignitionAchievementTitle erscheint, sobald die Reaktion freigeschaltet wird
  // (Ziel-ID `ignite-<reaktion>`); fehlt bei Reaktionen ohne eigene
  // Kontraktions-/Wartephase (z. B. Alpha-Einfang, das zeitgleich mit
  // Heliumbrennen freigeschaltet wird). completionAchievementTitle erscheint,
  // sobald der Brennstoff der Reaktion erschöpft ist (Ziel-ID `burn-<reaktion>`).
  ignitionAchievementTitle?: string;
  completionAchievementTitle: string;
  // Zusätzlicher Warnhinweis im Ziel-Banner, sobald der Brennstoff dieser
  // Reaktion erschöpft ist (siehe objectives.ts/warningFor). Aktuell nur
  // bei Wasserstoff gesetzt (Hüllenwind verstärkt sich beim Verlassen der
  // Hauptreihe).
  completionWarning?: Warning;
  // Punkt 7: Explizites Ziel für die aktive Brennphase dieser Reaktion.
  // Der Fortschritt wird generisch berechnet: Anteil des bereits in das
  // Hauptprodukt umgewandelten Brennstoffs (Kern + Restwolke), siehe
  // objectiveFor() in game/engine.ts — "den nächsten Kern aufbauen" statt
  // eines passiven "Brennstoff aufbrauchen".
  burnObjective: { title: string; detail: string };
  // Datengetriebener Stadienwechsel (Punkt 6): sobald die Reaktion insgesamt
  // `fusedAmount` ME umgesetzt hat und der Stern noch in `stageOnUnlock`
  // steht, wechselt er in `stage`. Aktuell nur bei Wasserstoff gesetzt
  // (Stabilisierung auf der Hauptreihe nach 15.000 fusionierten H-ME).
  stabilizesInto?: { fusedAmount: number; stage: Stage; message: string };
}

export const HYDROGEN_TO_HELIUM_RATIO = .993;
export const HELIUM_TO_CARBON_RATIO = .998;
export const CARBON_TO_OXYGEN_RATIO = 4 / 3 * .998;

// Punkt 2: Reaktionsausbau direkt auf der Reaktionskarte. Jede Stufe erhöht
// die MANUELLE Fusionsmenge der Reaktion um bonusPerLevel der Basismenge
// (linear, wie die Gravitationsstufen); Automationen bleiben unberührt. Die
// Basiskosten stehen je Reaktion als `upgradeBaseCost` an der Definition und
// liegen bewusst unter den Kosten der zugehörigen Automation.
export const REACTION_UPGRADE = {
  bonusPerLevel: .25,
  maxLevel: 8,
  costGrowth: 1.9,
} as const;

export const REACTIONS: Record<ReactionId, ReactionDefinition> = {
  hydrogen: {
    id: 'hydrogen', title: 'Wasserstofffusion', kicker: 'Proton-Proton-Kette',
    description: 'Wasserstoff verschmilzt zu Helium. Ein kleiner Massendefekt wird zu Energie.',
    equationInput: '4 H', equationOutput: 'He + γ', manualAmount: 200, upgradeBaseCost: 220, primaryInput: 'hydrogen', primaryOutput: 'helium',
    inputs: { hydrogen: 1 }, outputs: { helium: HYDROGEN_TO_HELIUM_RATIO },
    ignitionTemperature: THRESHOLDS.hydrogenTemperature, minimumMass: THRESHOLDS.hydrogenIgnitionMass,
    stageOnUnlock: 'hydrogen', energyBasis: 'input', energyPerUnit: .34, heatPerUnit: 2.4, automation: 'fusion',
    ignitionAchievementTitle: 'Wasserstofffusion freigeschaltet', completionAchievementTitle: 'Wasserstofffusion abgeschlossen',
    burnObjective: { title: 'Heliumkern aufbauen', detail: 'Fusioniere Wasserstoff zu Helium. Ist der Vorrat aus Kern und Restwolke erschöpft, entscheidet die Sternmasse über Kontraktion und Heliumzündung.' },
    completionWarning: {
      title: 'Hüllenwind verstärkt sich',
      text: 'Der Stern verliert ab jetzt spürbar Wasserstoff und Helium aus seiner eigenen Hülle. Hält der Massenverlust an, kann er den späteren Sternrest verändern.',
    },
    stabilizesInto: {
      fusedAmount: THRESHOLDS.mainSequenceHydrogen,
      stage: 'mainSequence',
      message: 'Hydrostatisches Gleichgewicht: Der Stern erreicht die Hauptreihe. Wasserstofffusion bleibt aktiv.',
    },
  },
  helium: {
    id: 'helium', title: 'Heliumfusion', kicker: 'Triple-Alpha',
    description: 'Drei Heliumkerne verschmelzen zu Kohlenstoff.',
    equationInput: '3 He', equationOutput: 'C + γ', manualAmount: 300, upgradeBaseCost: 420, primaryInput: 'helium', primaryOutput: 'carbon',
    inputs: { helium: 1 }, outputs: { carbon: HELIUM_TO_CARBON_RATIO },
    ignitionTemperature: THRESHOLDS.heliumTemperature, minimumMass: THRESHOLDS.heliumIgnitionMass,
    stageOnUnlock: 'helium', energyBasis: 'input', energyPerUnit: .52, heatPerUnit: 1.2, automation: 'heliumFusion',
    ignitionAchievementTitle: 'Heliumkern gezündet', completionAchievementTitle: 'Heliumfusion abgeschlossen',
    burnObjective: { title: 'Kohlenstoffkern aufbauen', detail: 'Fusioniere Helium zu Kohlenstoff — der Grundstock für Alpha-Einfang und eine mögliche Kohlenstoffzündung.' },
  },
  alphaCapture: {
    id: 'alphaCapture', title: 'Alpha-Einfang', kicker: 'Helium + Kohlenstoff',
    description: 'Ein Kohlenstoffkern fängt Helium ein und wächst zu Sauerstoff.',
    equationInput: 'C + He', equationOutput: 'O + γ', manualAmount: 180, upgradeBaseCost: 720, primaryInput: 'carbon', primaryOutput: 'oxygen',
    inputs: { carbon: 1, helium: 1 / 3 }, outputs: { oxygen: CARBON_TO_OXYGEN_RATIO },
    ignitionTemperature: THRESHOLDS.heliumTemperature, minimumMass: THRESHOLDS.heliumIgnitionMass,
    stageOnUnlock: 'helium', energyBasis: 'output', energyPerUnit: .68, heatPerUnit: .8, automation: 'oxygenSynthesis',
    // Kein ignitionAchievementTitle: Alpha-Einfang schaltet zeitgleich mit
    // Heliumbrennen frei (identische Schwellenwerte), es gibt also keine
    // eigenständige Warte-/Zielphase dafür in objectiveFor().
    completionAchievementTitle: 'Alpha-Einfang abgeschlossen',
    burnObjective: { title: 'Sauerstoff anreichern', detail: 'Lasse Kohlenstoffkerne Helium einfangen und reichere den Kern mit Sauerstoff für spätere Brennstufen an.' },
  },
  carbon: {
    id: 'carbon', title: 'Kohlenstofffusion', kicker: 'Schweres Kernbrennen',
    description: 'Kohlenstoffkerne reagieren und bilden im vereinfachten Netz überwiegend Neon.',
    equationInput: 'C + C', equationOutput: 'Ne + γ', manualAmount: 150, upgradeBaseCost: 1_100, primaryInput: 'carbon', primaryOutput: 'neon',
    inputs: { carbon: 1 }, outputs: { neon: .997 },
    ignitionTemperature: THRESHOLDS.carbonTemperature, minimumMass: THRESHOLDS.carbonIgnitionMass,
    stageOnUnlock: 'carbonBurning', energyBasis: 'input', energyPerUnit: .82, heatPerUnit: .65, automation: 'carbonFusion',
    ignitionAchievementTitle: 'Kohlenstofffusion freigeschaltet', completionAchievementTitle: 'Kohlenstofffusion abgeschlossen',
    burnObjective: { title: 'Neonkern aufbauen', detail: 'Fusioniere Kohlenstoff zu Neon und bereite damit die nächste Brennstufe des massereichen Sterns vor.' },
  },
  neon: {
    id: 'neon', title: 'Neonfusion', kicker: 'Schweres Kernbrennen',
    description: 'Neon wird durch Photodisintegration und Alpha-Einfang überwiegend zu Sauerstoff umgebaut.',
    equationInput: 'Ne', equationOutput: 'O + γ', manualAmount: 140, upgradeBaseCost: 1_500, primaryInput: 'neon', primaryOutput: 'oxygen',
    inputs: { neon: 1 }, outputs: { oxygen: .996 },
    ignitionTemperature: THRESHOLDS.neonTemperature, minimumMass: THRESHOLDS.advancedBurningMass,
    stageOnUnlock: 'neonBurning', energyBasis: 'input', energyPerUnit: .94, heatPerUnit: .55, automation: 'neonFusion',
    ignitionAchievementTitle: 'Neonfusion freigeschaltet', completionAchievementTitle: 'Neonfusion abgeschlossen',
    burnObjective: { title: 'Sauerstoffkern aufbauen', detail: 'Baue Neon zu Sauerstoff um — der Brennstoff der folgenden Sauerstofffusion.' },
  },
  oxygen: {
    id: 'oxygen', title: 'Sauerstofffusion', kicker: 'Schweres Kernbrennen',
    description: 'Sauerstoffkerne verschmelzen im vereinfachten Netz zu Silizium.',
    equationInput: 'O + O', equationOutput: 'Si + γ', manualAmount: 120, upgradeBaseCost: 2_000, primaryInput: 'oxygen', primaryOutput: 'silicon',
    inputs: { oxygen: 1 }, outputs: { silicon: .995 },
    ignitionTemperature: THRESHOLDS.oxygenTemperature, minimumMass: THRESHOLDS.advancedBurningMass,
    stageOnUnlock: 'oxygenBurning', energyBasis: 'input', energyPerUnit: 1.08, heatPerUnit: .45, automation: 'oxygenFusion',
    ignitionAchievementTitle: 'Sauerstofffusion freigeschaltet', completionAchievementTitle: 'Sauerstofffusion abgeschlossen',
    burnObjective: { title: 'Siliziumkern aufbauen', detail: 'Fusioniere Sauerstoff zu Silizium, dem letzten exothermen Brennstoff des Sterns.' },
  },
  silicon: {
    id: 'silicon', title: 'Siliziumfusion', kicker: 'Letzte exotherme Brennstufe',
    description: 'Eine Folge von Reaktionen baut Silizium bis zur Eisengruppe um.',
    equationInput: 'Si', equationOutput: 'Fe-Gruppe', manualAmount: 100, upgradeBaseCost: 2_550, primaryInput: 'silicon', primaryOutput: 'iron',
    inputs: { silicon: 1 }, outputs: { iron: .994 },
    ignitionTemperature: THRESHOLDS.siliconTemperature, minimumMass: THRESHOLDS.advancedBurningMass,
    stageOnUnlock: 'siliconBurning', energyBasis: 'input', energyPerUnit: 1.2, heatPerUnit: .3, automation: 'siliconFusion',
    ignitionAchievementTitle: 'Siliziumfusion freigeschaltet', completionAchievementTitle: 'Siliziumfusion abgeschlossen',
    burnObjective: { title: 'Eisenkern aufbauen', detail: 'Silizium wird zur Eisengruppe umgebaut. Ein vollständiger Eisenkern liefert keine Energie mehr und löst den Kollaps aus.' },
  },
};

export const REACTION_ORDER = ['hydrogen', 'helium', 'alphaCapture', 'carbon', 'neon', 'oxygen', 'silicon'] as const satisfies readonly ReactionId[];
