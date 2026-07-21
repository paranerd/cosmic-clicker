import type { ReactionId, Stage } from '../game/types';
import type { MatterKey } from './resources';
import { THRESHOLDS } from './progression';

export interface WindWarning {
  title: string;
  text: string;
}

export interface ReactionDefinition {
  id: ReactionId;
  title: string;
  kicker: string;
  symbol: string;
  className: string;
  description: string;
  equationInput: string;
  equationOutput: string;
  manualAmount: number;
  primaryInput: MatterKey;
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
  // Reaktion erschöpft ist (siehe objectives.ts/windWarningFor). Aktuell nur
  // bei Wasserstoff gesetzt (Hüllenwind verstärkt sich beim Verlassen der
  // Hauptreihe).
  completionWindWarning?: WindWarning;
}

export const HYDROGEN_TO_HELIUM_RATIO = .993;
export const HELIUM_TO_CARBON_RATIO = .998;
export const CARBON_TO_OXYGEN_RATIO = 4 / 3 * .998;

export const REACTIONS: Record<ReactionId, ReactionDefinition> = {
  hydrogen: {
    id: 'hydrogen', title: 'Wasserstofffusion', kicker: 'Proton-Proton-Kette', symbol: 'H', className: 'hydrogen',
    description: 'Wasserstoff verschmilzt zu Helium. Ein kleiner Massendefekt wird zu Energie.',
    equationInput: '4 H', equationOutput: 'He + γ', manualAmount: 200, primaryInput: 'hydrogen',
    inputs: { hydrogen: 1 }, outputs: { helium: HYDROGEN_TO_HELIUM_RATIO },
    ignitionTemperature: THRESHOLDS.hydrogenTemperature, minimumMass: THRESHOLDS.hydrogenIgnitionMass,
    stageOnUnlock: 'hydrogen', energyBasis: 'input', energyPerUnit: .34, heatPerUnit: 2.4, automation: 'fusion',
    ignitionAchievementTitle: 'Wasserstofffusion freigeschaltet', completionAchievementTitle: 'Wasserstofffusion abgeschlossen',
    completionWindWarning: {
      title: 'Hüllenwind verstärkt sich',
      text: 'Der Stern verliert ab jetzt spürbar Wasserstoff und Helium aus seiner eigenen Hülle. Hält der Massenverlust an, kann er den späteren Sternrest verändern.',
    },
  },
  helium: {
    id: 'helium', title: 'Heliumfusion', kicker: 'Triple-Alpha', symbol: 'He', className: 'helium',
    description: 'Drei Heliumkerne verschmelzen zu Kohlenstoff.',
    equationInput: '3 He', equationOutput: 'C + γ', manualAmount: 300, primaryInput: 'helium',
    inputs: { helium: 1 }, outputs: { carbon: HELIUM_TO_CARBON_RATIO },
    ignitionTemperature: THRESHOLDS.heliumTemperature, minimumMass: THRESHOLDS.heliumIgnitionMass,
    stageOnUnlock: 'helium', energyBasis: 'input', energyPerUnit: .52, heatPerUnit: 1.2, automation: 'heliumFusion',
    ignitionAchievementTitle: 'Heliumkern gezündet', completionAchievementTitle: 'Heliumfusion abgeschlossen',
  },
  alphaCapture: {
    id: 'alphaCapture', title: 'Alpha-Einfang', kicker: 'Helium + Kohlenstoff', symbol: 'O', className: 'oxygen',
    description: 'Ein Kohlenstoffkern fängt Helium ein und wächst zu Sauerstoff.',
    equationInput: 'C + He', equationOutput: 'O + γ', manualAmount: 180, primaryInput: 'carbon',
    inputs: { carbon: 1, helium: 1 / 3 }, outputs: { oxygen: CARBON_TO_OXYGEN_RATIO },
    ignitionTemperature: THRESHOLDS.heliumTemperature, minimumMass: THRESHOLDS.heliumIgnitionMass,
    stageOnUnlock: 'helium', energyBasis: 'output', energyPerUnit: .68, heatPerUnit: .8, automation: 'oxygenSynthesis',
    // Kein ignitionAchievementTitle: Alpha-Einfang schaltet zeitgleich mit
    // Heliumbrennen frei (identische Schwellenwerte), es gibt also keine
    // eigenständige Warte-/Zielphase dafür in objectiveFor().
    completionAchievementTitle: 'Alpha-Einfang abgeschlossen',
  },
  carbon: {
    id: 'carbon', title: 'Kohlenstofffusion', kicker: 'Schweres Kernbrennen', symbol: 'C', className: 'carbon',
    description: 'Kohlenstoffkerne reagieren und bilden im vereinfachten Netz überwiegend Neon.',
    equationInput: 'C + C', equationOutput: 'Ne + γ', manualAmount: 150, primaryInput: 'carbon',
    inputs: { carbon: 1 }, outputs: { neon: .997 },
    ignitionTemperature: THRESHOLDS.carbonTemperature, minimumMass: THRESHOLDS.carbonIgnitionMass,
    stageOnUnlock: 'carbonBurning', energyBasis: 'input', energyPerUnit: .82, heatPerUnit: .65, automation: 'carbonFusion',
    ignitionAchievementTitle: 'Kohlenstofffusion freigeschaltet', completionAchievementTitle: 'Kohlenstofffusion abgeschlossen',
  },
  neon: {
    id: 'neon', title: 'Neonfusion', kicker: 'Schweres Kernbrennen', symbol: 'Ne', className: 'neon',
    description: 'Neon wird durch Photodisintegration und Alpha-Einfang überwiegend zu Sauerstoff umgebaut.',
    equationInput: 'Ne', equationOutput: 'O + γ', manualAmount: 140, primaryInput: 'neon',
    inputs: { neon: 1 }, outputs: { oxygen: .996 },
    ignitionTemperature: THRESHOLDS.neonTemperature, minimumMass: THRESHOLDS.advancedBurningMass,
    stageOnUnlock: 'neonBurning', energyBasis: 'input', energyPerUnit: .94, heatPerUnit: .55, automation: 'neonFusion',
    ignitionAchievementTitle: 'Neonfusion freigeschaltet', completionAchievementTitle: 'Neonfusion abgeschlossen',
  },
  oxygen: {
    id: 'oxygen', title: 'Sauerstofffusion', kicker: 'Schweres Kernbrennen', symbol: 'O', className: 'oxygen',
    description: 'Sauerstoffkerne verschmelzen im vereinfachten Netz zu Silizium.',
    equationInput: 'O + O', equationOutput: 'Si + γ', manualAmount: 120, primaryInput: 'oxygen',
    inputs: { oxygen: 1 }, outputs: { silicon: .995 },
    ignitionTemperature: THRESHOLDS.oxygenTemperature, minimumMass: THRESHOLDS.advancedBurningMass,
    stageOnUnlock: 'oxygenBurning', energyBasis: 'input', energyPerUnit: 1.08, heatPerUnit: .45, automation: 'oxygenFusion',
    ignitionAchievementTitle: 'Sauerstofffusion freigeschaltet', completionAchievementTitle: 'Sauerstofffusion abgeschlossen',
  },
  silicon: {
    id: 'silicon', title: 'Siliziumfusion', kicker: 'Letzte exotherme Brennstufe', symbol: 'Si', className: 'silicon',
    description: 'Eine Folge von Reaktionen baut Silizium bis zur Eisengruppe um.',
    equationInput: 'Si', equationOutput: 'Fe-Gruppe', manualAmount: 100, primaryInput: 'silicon',
    inputs: { silicon: 1 }, outputs: { iron: .994 },
    ignitionTemperature: THRESHOLDS.siliconTemperature, minimumMass: THRESHOLDS.advancedBurningMass,
    stageOnUnlock: 'siliconBurning', energyBasis: 'input', energyPerUnit: 1.2, heatPerUnit: .3, automation: 'siliconFusion',
    ignitionAchievementTitle: 'Siliziumfusion freigeschaltet', completionAchievementTitle: 'Siliziumfusion abgeschlossen',
  },
};

export const REACTION_ORDER = ['hydrogen', 'helium', 'alphaCapture', 'carbon', 'neon', 'oxygen', 'silicon'] as const satisfies readonly ReactionId[];
