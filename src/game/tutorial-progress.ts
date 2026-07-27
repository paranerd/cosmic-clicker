import { OBJECTIVES, TUTORIAL_STEPS } from '../content';
import type { GameState } from './types';

const stepIndex = (id: string): number => TUTORIAL_STEPS.findIndex((step) => step.id === id);
const hasAccretedMatter = (state: GameState): boolean =>
  state.stats.matterAccreted > 0 || Object.values(state.star).some((amount) => amount > 0);

/**
 * Returns the earliest tutorial step that still makes sense for the current
 * run. Informational follow-up steps remain visible, while instructions for
 * actions the player has already completed are skipped.
 */
export function tutorialProgressStepIndex(state: GameState): number {
  if (state.automation.accretion > 0) return stepIndex('automatic-accretion-effect');
  if (state.upgrades.gravity > 0) return stepIndex('first-automation');
  if (state.stats.energyGenerated >= OBJECTIVES['generate-upgrade-energy'].target) return stepIndex('first-upgrade');
  if (state.stats.energyGenerated >= OBJECTIVES['generate-first-energy'].target) return stepIndex('accretion-energy');
  if (hasAccretedMatter(state)) return stepIndex('core-composition');
  return stepIndex('welcome');
}

export function tutorialResumeStepIndex(state: GameState, storedStepIndex: number): number {
  return Math.max(storedStepIndex, tutorialProgressStepIndex(state));
}
