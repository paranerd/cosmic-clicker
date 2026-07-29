import { LEGACY_TUTORIAL_STEP_ID_ALIASES, LEGACY_TUTORIAL_STEP_IDS, TUTORIAL_STEPS, type TutorialStep } from '../content';
import { canBuyAutomation, canBuyUpgrade } from '../game/engine';
import { saveGame } from '../game/storage';
import { tutorialResumeStepIndex } from '../game/tutorial-progress';
import { isCoreDataOpen, isPanelSheetOpen, setCoreDataOpen, setPanelSheetOpen } from './menus';
import { markCurrentObjectiveSeen, showToast } from './notifications';
import { invalidateOverlay, syncOverlay } from './overlay';
import { app, getActivePanel, getState } from './store';
import { switchPanel } from './sync';

let tutorialSignature = '';
let tutorialEndConfirmation = false;

const initialTourEnd = TUTORIAL_STEPS.findIndex((step) => 'completesInitialTour' in step && step.completesInitialTour);
const clampStep = (step: number): number => Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step));

function currentTutorialStepIndex(): number {
  const tutorial = getState().tutorial;
  if (tutorial.stepId) {
    const canonicalStepId = LEGACY_TUTORIAL_STEP_ID_ALIASES[tutorial.stepId] ?? tutorial.stepId;
    const storedIndex = TUTORIAL_STEPS.findIndex((step) => step.id === canonicalStepId);
    if (storedIndex >= 0) return storedIndex;
  }
  if (!tutorial.introSeen) return 0;
  const legacyId = LEGACY_TUTORIAL_STEP_IDS[tutorial.step];
  const legacyIndex = legacyId ? TUTORIAL_STEPS.findIndex((step) => step.id === legacyId) : -1;
  return legacyIndex >= 0 ? legacyIndex : clampStep(tutorial.step);
}

export function invalidateTutorial(): void {
  tutorialSignature = '';
}

function finishInitialTour(): void {
  const state = getState();
  switchPanel('reactions', false);
  markCurrentObjectiveSeen();
  if (state.tutorial.cosmosToastPending) {
    state.tutorial.cosmosToastPending = false;
    showToast('Ein neuer Kosmos beginnt.');
  }
}

function commitTutorial(step: number, completed: boolean, completeInitialTour = false): void {
  const state = getState();
  const normalizedStep = clampStep(step);
  tutorialEndConfirmation = false;
  state.tutorial = {
    ...state.tutorial,
    step: normalizedStep,
    stepId: TUTORIAL_STEPS[normalizedStep].id,
    completed,
  };
  if (completeInitialTour) finishInitialTour();
  saveGame(state);
  invalidateTutorial();
  syncTutorial();
  invalidateOverlay();
  syncOverlay();
}

export function setTutorial(step: number, completed = false): void {
  const isSkippingInitialTour = completed && currentTutorialStepIndex() <= initialTourEnd;
  commitTutorial(step, completed, isSkippingInitialTour);
}

export function setTutorialEnabled(enabled: boolean): void {
  if (enabled) {
    setTutorial(tutorialResumeStepIndex(getState(), currentTutorialStepIndex()), false);
    showToast('Tutorial eingeschaltet und passend zu deinem Fortschritt fortgesetzt.');
    return;
  }
  setTutorial(currentTutorialStepIndex(), true);
  showToast('Tutorial ausgeschaltet.');
}

export function requestTutorialEnd(): void {
  tutorialEndConfirmation = true;
  invalidateTutorial();
  syncTutorial();
}

export function cancelTutorialEnd(): void {
  tutorialEndConfirmation = false;
  invalidateTutorial();
  syncTutorial();
}

export function confirmTutorialEnd(): void {
  const step = currentTutorialStepIndex();
  commitTutorial(step, true, step <= initialTourEnd);
  showToast('Tutorial beendet. In den Einstellungen kannst du es wieder einschalten.');
}

export function resolveIntro(startTutorial: boolean): void {
  const state = getState();
  state.tutorial = {
    ...state.tutorial,
    introSeen: true,
    completed: !startTutorial,
    step: 0,
    stepId: TUTORIAL_STEPS[0].id,
  };
  tutorialEndConfirmation = false;
  if (!startTutorial) finishInitialTour();
  saveGame(state);
  invalidateOverlay();
  invalidateTutorial();
  syncOverlay();
  syncTutorial();
  if (!startTutorial) showToast('Tutorial übersprungen. In den Einstellungen kannst du es jederzeit einschalten.');
}

function tutorialStepAvailable(step: TutorialStep): boolean {
  const state = getState();
  if (step.availability.type === 'immediate') return true;
  if (step.availability.type === 'energy-at-least') return state.energy >= step.availability.amount;
  if (step.availability.type === 'upgrade-affordable') return canBuyUpgrade(state, step.availability.id);
  return canBuyAutomation(state, step.availability.id);
}

function prepareTutorialTarget(step: TutorialStep): void {
  if (
    step.availability.type === 'immediate'
    || step.availability.type === 'energy-at-least'
    || getActivePanel() === step.availability.panel
  ) return;
  switchPanel(step.availability.panel, false);
}

function tutorialTarget(step: TutorialStep): Element | null {
  return step.selector ? app.querySelector(step.selector) : null;
}

// Im mobilen Layout liegen Kerndaten und Kontrollzentrum hinter Blenden.
// Zeigt ein Schritt dorthin, muss die passende offen sein, bevor der
// Fokusrahmen gesetzt wird. Entschieden wird beim Schrittwechsel, nicht bei
// jedem Sync-Tick — sonst ließen sich die Blenden während des Tutorials nicht
// mehr von Hand öffnen oder schließen.
function syncTutorialSheets(target: Element | null): void {
  const needsCoreSheet = Boolean(target?.closest('.left-panel'));
  const needsPanelSheet = Boolean(target?.closest('.action-sidepanel'));
  if (needsCoreSheet !== isCoreDataOpen()) setCoreDataOpen(needsCoreSheet);
  if (needsPanelSheet !== isPanelSheetOpen()) setPanelSheetOpen(needsPanelSheet);
}

function revealTutorialTarget(target: Element): void {
  const rect = target.getBoundingClientRect();
  const safeGap = 20;
  const fullyVisible = rect.top >= safeGap
    && rect.left >= safeGap
    && rect.right <= window.innerWidth - safeGap
    && rect.bottom <= window.innerHeight - safeGap;
  if (!fullyVisible) {
    target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
  }
}

function positionTutorialFocus(target: Element): void {
  const rect = target.getBoundingClientRect();
  const viewportGap = 6;
  const maxFramePadding = 12;
  const frameBorderWidth = 1;
  const availableFrameSpace = Math.min(
    rect.left - viewportGap - frameBorderWidth,
    window.innerWidth - viewportGap - rect.right - frameBorderWidth,
    rect.top - viewportGap - frameBorderWidth,
    window.innerHeight - viewportGap - rect.bottom - frameBorderWidth,
  );
  // A negative padding draws the element-bound frame inside targets which
  // already touch or slightly cross a viewport edge. Keeping the same value
  // on all sides preserves the frame's shape and, unlike a fixed overlay,
  // still makes it move synchronously with the target while scrolling.
  const framePadding = Math.min(maxFramePadding, availableFrameSpace);
  if (target instanceof HTMLElement) {
    target.style.setProperty('--tutorial-frame-padding', `${framePadding}px`);
  }
  const roundDimmer = app.querySelector<HTMLElement>('[data-tutorial-round-dimmer]');
  if (roundDimmer) {
    roundDimmer.style.setProperty('--tutorial-focus-x', `${rect.left + rect.width / 2}px`);
    roundDimmer.style.setProperty('--tutorial-focus-y', `${rect.top + rect.height / 2}px`);
    roundDimmer.style.setProperty('--tutorial-focus-radius', `${Math.max(rect.width, rect.height) / 2 + framePadding + frameBorderWidth}px`);
  }
  const frameLeft = Math.max(viewportGap, rect.left - framePadding);
  const frameTop = Math.max(viewportGap, rect.top - framePadding);
  const frameRight = Math.min(window.innerWidth - viewportGap, rect.right + framePadding);
  const frameBottom = Math.min(window.innerHeight - viewportGap, rect.bottom + framePadding);
  const blockerStyles: Record<string, Partial<CSSStyleDeclaration>> = {
    top: { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${frameTop}px` },
    bottom: { left: '0px', top: `${frameBottom}px`, width: `${window.innerWidth}px`, height: `${Math.max(0, window.innerHeight - frameBottom)}px` },
    left: { left: '0px', top: `${frameTop}px`, width: `${frameLeft}px`, height: `${Math.max(0, frameBottom - frameTop)}px` },
    right: { left: `${frameRight}px`, top: `${frameTop}px`, width: `${Math.max(0, window.innerWidth - frameRight)}px`, height: `${Math.max(0, frameBottom - frameTop)}px` },
  };
  app.querySelectorAll<HTMLElement>('[data-tutorial-blocker]').forEach((blocker) => {
    Object.assign(blocker.style, blockerStyles[blocker.dataset.tutorialBlocker ?? '']);
  });
}

export function syncTutorialFocusPosition(): void {
  const state = getState();
  if (!state.tutorial.introSeen || state.tutorial.completed) return;
  const step = TUTORIAL_STEPS[currentTutorialStepIndex()] ?? TUTORIAL_STEPS[0];
  if (!tutorialStepAvailable(step)) return;
  const target = tutorialTarget(step);
  if (target) positionTutorialFocus(target);
}

export function syncTutorial(): void {
  const state = getState();
  const root = app.querySelector<HTMLElement>('[data-ui="tutorial-root"]');
  if (!root) return;
  app.classList.remove('tutorial-active');
  const settingsButton = app.querySelector<HTMLElement>('[data-action="open-settings"]');
  settingsButton?.classList.remove('tutorial-settings-access');
  app.querySelectorAll<HTMLElement>('.tutorial-focus').forEach((element) => {
    element.classList.remove('tutorial-focus');
    element.style.removeProperty('--tutorial-frame-padding');
  });
  if (state.completed || state.summaryOpen || !state.tutorial.introSeen || state.tutorial.completed) {
    if (root.innerHTML) root.innerHTML = '';
    tutorialSignature = state.completed ? 'hidden-by-cycle-end' : state.summaryOpen ? 'hidden-by-summary' : state.tutorial.introSeen ? 'completed' : 'waiting-for-intro';
    tutorialEndConfirmation = false;
    return;
  }

  const stepIndex = currentTutorialStepIndex();
  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  if (!tutorialStepAvailable(step)) {
    if (root.innerHTML) root.innerHTML = '';
    tutorialSignature = `waiting:${step.id}`;
    return;
  }

  app.classList.add('tutorial-active');
  settingsButton?.classList.add('tutorial-settings-access');
  prepareTutorialTarget(step);
  const target = tutorialTarget(step);
  target?.classList.add('tutorial-focus');
  const signature = `step:${step.id}:confirm:${tutorialEndConfirmation}`;
  if (signature !== tutorialSignature) {
    tutorialSignature = signature;
    syncTutorialSheets(target);
    if (target) revealTutorialTarget(target);
    const normalInteraction = step.trigger.type === 'action'
      ? `<small class="tutorial-hint">${step.trigger.hint}</small>`
      : `<button class="tutorial-action tutorial-primary tutorial-next" data-action="tutorial-next">${step.trigger.label}</button>`;
    const interaction = tutorialEndConfirmation
      ? `<section class="tutorial-confirmation" aria-label="Tutorial wirklich beenden?"><p>Möchtest du das Tutorial wirklich beenden?</p><div><button class="tutorial-action tutorial-danger" data-action="confirm-end-tutorial">Tutorial beenden</button><button class="tutorial-action tutorial-secondary" data-action="cancel-end-tutorial">Abbrechen</button></div></section>`
      : normalInteraction;
    const roundFocus = target?.matches('.star-button') ?? false;
    const blockerClass = `tutorial-blocker${roundFocus ? ' tutorial-blocker-round' : ''}`;
    const roundDimmer = roundFocus ? '<div class="tutorial-round-dimmer" data-tutorial-round-dimmer aria-hidden="true"></div>' : '';
    const focusLayer = target
      ? `${roundDimmer}<div class="${blockerClass}" data-tutorial-blocker="top" aria-hidden="true"></div><div class="${blockerClass}" data-tutorial-blocker="right" aria-hidden="true"></div><div class="${blockerClass}" data-tutorial-blocker="bottom" aria-hidden="true"></div><div class="${blockerClass}" data-tutorial-blocker="left" aria-hidden="true"></div>`
      : '<div class="tutorial-blocker tutorial-blocker-full" aria-hidden="true"></div>';
    root.innerHTML = `${focusLayer}<aside class="tutorial-card" aria-label="Tutorial"><div class="tutorial-meta"><span>TUTORIAL · ${stepIndex + 1}/${TUTORIAL_STEPS.length}</span><button data-action="request-end-tutorial">Tutorial beenden</button></div><h2>${step.title}</h2><p>${step.text}</p>${interaction}</aside>`;
  }
  if (target) positionTutorialFocus(target);
}

export function advanceTutorial(trigger: string): void {
  const state = getState();
  if (state.tutorial.completed || tutorialEndConfirmation) return;
  const stepIndex = currentTutorialStepIndex();
  const step: TutorialStep | undefined = TUTORIAL_STEPS[stepIndex];
  if (!step) return;
  const matches = step.trigger.type === 'next' ? trigger === 'next' : trigger === step.trigger.action;
  if (!matches || (step.trigger.type === 'next' && !tutorialStepAvailable(step))) return;
  if (stepIndex >= TUTORIAL_STEPS.length - 1) {
    commitTutorial(stepIndex, true);
    return;
  }
  commitTutorial(stepIndex + 1, false, Boolean(step.completesInitialTour));
}
