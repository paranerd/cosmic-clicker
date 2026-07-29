import { PRESTIGE_PERKS } from '../content';
import { cloudTierCost, effectivePerks, fusionPerkCost, gravityPerkCost } from '../game/engine';
import { app, getState } from './store';

let fullResetArmed = false;
let resetTimer = 0;
let warningsOpen = false;
let cloudInfoOpen = false;
let coreDataOpen = false;
let panelSheetOpen = false;
let prestigeConfirmationArmed = false;
let prestigeConfirmationTimer = 0;

export const isFullResetArmed = (): boolean => fullResetArmed;
export const isWarningsOpen = (): boolean => warningsOpen;
export const isCloudInfoOpen = (): boolean => cloudInfoOpen;
export const isCoreDataOpen = (): boolean => coreDataOpen;
export const isPanelSheetOpen = (): boolean => panelSheetOpen;

// Im mobilen Vollbild-Layout liegt der Kerndaten-Bereich als Blende über der
// Sternkammer, statt unter ihr im Seitenfluss zu hängen. Auf breiten Displays
// ist die Klasse wirkungslos — dort steht die Spalte ohnehin dauerhaft.
export function setCoreDataOpen(open: boolean): void {
  coreDataOpen = open;
  if (open) setPanelSheetOpen(false);
  app.querySelector('.left-panel')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-core-data"]')?.setAttribute('aria-expanded', String(open));
}

// Dasselbe Prinzip für die vier Bereiche des Kontrollzentrums: Auf dem Desktop
// steht die Spalte fest, mobil öffnet das Dock sie als Popup über der Kammer.
export function setPanelSheetOpen(open: boolean): void {
  panelSheetOpen = open;
  app.classList.toggle('panel-sheet-open', open);
  app.querySelector('.action-sidepanel')?.classList.toggle('is-open', open);
}
export const isPrestigeConfirmationArmed = (): boolean => prestigeConfirmationArmed;

export function closeResetMenu(): void {
  fullResetArmed = false; window.clearTimeout(resetTimer);
  const fullLabel = app.querySelector<HTMLElement>('[data-full-reset-label]'); if (fullLabel) fullLabel.textContent = 'Spielstand löschen';
  app.querySelector('[data-action="reset-full"]')?.classList.remove('is-armed');
}

export function armFullReset(): void {
  fullResetArmed = true; window.clearTimeout(resetTimer);
  const button = app.querySelector<HTMLElement>('[data-action="reset-full"]'); button?.classList.add('is-armed');
  const label = app.querySelector<HTMLElement>('[data-full-reset-label]'); if (label) label.textContent = 'Wirklich alles löschen?';
  resetTimer = window.setTimeout(closeResetMenu, 5_000);
}

// Punkt 4: Popover mit allen aktiven Warnungen am Warnsymbol der Star Chamber.
export function setWarningsOpen(open: boolean): void {
  if (open) setCloudInfoOpen(false);
  warningsOpen = open;
  app.querySelector('.warning-corner')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-warnings"]')?.setAttribute('aria-expanded', String(open));
}

// Die Urwolken-Details teilen sich den linken unteren Aktionsbereich mit den
// Warnungen. Es kann immer nur eines der beiden Popover geöffnet sein, damit
// sie sich auf kleinen Displays nicht überlagern.
export function setCloudInfoOpen(open: boolean): void {
  if (open) setWarningsOpen(false);
  cloudInfoOpen = open;
  app.querySelector('.cloud-corner')?.classList.toggle('is-open', open);
  app.querySelector('[data-action="toggle-cloud-info"]')?.setAttribute('aria-expanded', String(open));
}

export function hasAffordableSummaryPerk(): boolean {
  const state = getState();
  const perks = effectivePerks(state);
  return perks.largerCloud < PRESTIGE_PERKS.largerCloud.maxLevel && state.stardust >= cloudTierCost(perks.largerCloud)
    || perks.permanentGravity < PRESTIGE_PERKS.permanentGravity.maxLevel && state.stardust >= gravityPerkCost(perks.permanentGravity)
    || perks.fusionMemory < PRESTIGE_PERKS.fusionMemory.maxLevel && state.stardust >= fusionPerkCost(perks.fusionMemory);
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
  button.textContent = 'Neuen Zyklus starten';
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
