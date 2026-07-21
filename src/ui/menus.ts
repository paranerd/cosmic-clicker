import { LIMITS } from '../content';
import { cloudDefinition, cloudTierCost, effectivePerks, fusionPerkCost, gravityPerkCost } from '../game/engine';
import { app, getState } from './store';

let resetMenuOpen = false;
let fullResetArmed = false;
let resetTimer = 0;
let perksOpen = false;
let soundMenuOpen = false;
let warningsOpen = false;
let prestigeConfirmationArmed = false;
let prestigeConfirmationTimer = 0;

export const isFullResetArmed = (): boolean => fullResetArmed;
export const isPerksOpen = (): boolean => perksOpen;
export const isSoundMenuOpen = (): boolean => soundMenuOpen;
export const isWarningsOpen = (): boolean => warningsOpen;
export const isPrestigeConfirmationArmed = (): boolean => prestigeConfirmationArmed;

export function closeResetMenu(): void {
  resetMenuOpen = false; fullResetArmed = false; window.clearTimeout(resetTimer);
  const control = app.querySelector<HTMLElement>('.reset-control'); control?.classList.remove('is-open');
  const trigger = app.querySelector<HTMLButtonElement>('[data-action="reset-menu"]'); trigger?.setAttribute('aria-expanded', 'false');
  const fullLabel = app.querySelector<HTMLElement>('[data-full-reset-label]'); if (fullLabel) fullLabel.textContent = 'Spielstand löschen';
  app.querySelector('[data-action="reset-full"]')?.classList.remove('is-armed');
}

export function toggleResetMenu(): void {
  if (resetMenuOpen) { closeResetMenu(); return; }
  resetMenuOpen = true;
  app.querySelector('.reset-control')?.classList.add('is-open');
  app.querySelector('[data-action="reset-menu"]')?.setAttribute('aria-expanded', 'true');
  window.clearTimeout(resetTimer); resetTimer = window.setTimeout(closeResetMenu, 7_000);
}

export function armFullReset(): void {
  fullResetArmed = true; window.clearTimeout(resetTimer);
  const button = app.querySelector<HTMLElement>('[data-action="reset-full"]'); button?.classList.add('is-armed');
  const label = app.querySelector<HTMLElement>('[data-full-reset-label]'); if (label) label.textContent = 'Wirklich alles löschen?';
  resetTimer = window.setTimeout(closeResetMenu, 5_000);
}

export function setPerksOpen(open: boolean): void {
  perksOpen = open;
  app.querySelector('.resource-menu')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-perks"]')?.setAttribute('aria-expanded', String(open));
}

export function setSoundMenuOpen(open: boolean): void {
  soundMenuOpen = open;
  app.querySelector('.sound-menu')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-sound-menu"]')?.setAttribute('aria-expanded', String(open));
}

// Punkt 4: Popover mit allen aktiven Warnungen am Warnsymbol der Star Chamber.
export function setWarningsOpen(open: boolean): void {
  warningsOpen = open;
  app.querySelector('.warning-corner')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-warnings"]')?.setAttribute('aria-expanded', String(open));
}

export function hasAffordableSummaryPerk(): boolean {
  const state = getState();
  const perks = effectivePerks(state);
  return perks.largerCloud < LIMITS.cloudGrowthLevel && state.stardust >= cloudTierCost(perks.largerCloud)
    || perks.permanentGravity < LIMITS.permanentGravity && state.stardust >= gravityPerkCost(perks.permanentGravity)
    || perks.fusionMemory < LIMITS.fusionMemory && state.stardust >= fusionPerkCost(perks.fusionMemory);
}

export function hasPendingPerks(): boolean {
  const state = getState();
  return state.pendingPerks.largerCloud + state.pendingPerks.permanentGravity + state.pendingPerks.fusionMemory > 0;
}

function highlightAffordablePerks(): void {
  app.querySelectorAll<HTMLElement>('.summary-perk-grid article').forEach((card) => {
    const buyButton = card.querySelector<HTMLButtonElement>('[data-action^="buy-perk-"]');
    if (!buyButton || buyButton.disabled) return;
    card.classList.remove('perk-attention');
    void card.offsetWidth;
    card.classList.add('perk-attention');
  });
}

export function clearPrestigeConfirmation(): void {
  prestigeConfirmationArmed = false;
  window.clearTimeout(prestigeConfirmationTimer);
  const button = app.querySelector<HTMLButtonElement>('[data-action="prestige"]');
  if (!button) return;
  button.classList.remove('is-confirming');
  button.textContent = `Mit ${cloudDefinition(getState().nextCloudTier).name} beginnen`;
}

export function armPrestigeConfirmation(): void {
  prestigeConfirmationArmed = true;
  const button = app.querySelector<HTMLButtonElement>('[data-action="prestige"]');
  if (button) {
    button.classList.add('is-confirming');
    button.textContent = 'Ohne Upgrades starten';
  }
  highlightAffordablePerks();
  window.clearTimeout(prestigeConfirmationTimer);
  prestigeConfirmationTimer = window.setTimeout(clearPrestigeConfirmation, 5_000);
}
