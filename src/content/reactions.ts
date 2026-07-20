import type { Stage } from '../game/types';

export type ReactionId = 'hydrogen' | 'helium' | 'oxygen';

export interface ReactionDefinition {
  title: string;
  kicker: string;
  symbol: string;
  className: string;
  description: string;
  equationInput: string;
  equationOutput: string;
  action: string;
  manualAmount: number;
  activeStage: Stage;
  visibleStages: readonly Stage[];
  energyBasis: 'input' | 'output';
  energyPerUnit: number;
}

export const HYDROGEN_TO_HELIUM_RATIO = .993;
export const HELIUM_TO_CARBON_RATIO = .998;
export const CARBON_TO_OXYGEN_RATIO = 4 / 3 * .998;

export const REACTIONS: Record<ReactionId, ReactionDefinition> = {
  hydrogen: {
    title: 'Wasserstoffbrennen',
    kicker: 'Kernfusion',
    symbol: 'H',
    className: 'hydrogen',
    description: 'Wasserstoff verschmilzt zu Helium. Ein kleiner Massendefekt wird zu Energie.',
    equationInput: '4 H',
    equationOutput: 'He + γ',
    action: 'fuse-hydrogen',
    manualAmount: 200,
    activeStage: 'hydrogen',
    visibleStages: ['nebula', 'protostar', 'deuterium', 'hydrogen', 'mainSequence', 'redGiant'],
    energyBasis: 'input',
    energyPerUnit: .34,
  },
  helium: {
    title: 'Heliumbrennen',
    kicker: 'Triple-Alpha',
    symbol: 'He',
    className: 'helium',
    description: 'Drei Heliumkerne verschmelzen bei etwa 100 Mio. K zu Kohlenstoff.',
    equationInput: '3 He',
    equationOutput: 'C + γ',
    action: 'fuse-helium',
    manualAmount: 300,
    activeStage: 'helium',
    visibleStages: ['hydrogen', 'mainSequence', 'redGiant', 'helium'],
    energyBasis: 'input',
    energyPerUnit: .52,
  },
  oxygen: {
    title: 'Sauerstoff bilden',
    kicker: 'Alpha-Einfang',
    symbol: 'O',
    className: 'oxygen',
    description: 'Ein Kohlenstoffkern fängt Helium ein und wächst zu Sauerstoff.',
    equationInput: 'C + He',
    equationOutput: 'O + γ',
    action: 'create-oxygen',
    manualAmount: 180,
    activeStage: 'carbonOxygen',
    visibleStages: ['helium', 'carbonOxygen', 'massiveStar', 'supernova', 'whiteDwarf', 'neutronStar', 'blackHole'],
    energyBasis: 'output',
    energyPerUnit: .68,
  },
};
