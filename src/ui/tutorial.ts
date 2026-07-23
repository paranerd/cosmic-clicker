import { LEGACY_TUTORIAL_STEP_IDS, TUTORIAL_STEPS, type TutorialStep } from '../content';
import { canBuyAutomation, canBuyUpgrade } from '../game/engine';
import { saveGame } from '../game/storage';
import { markCurrentObjectiveSeen, showToast } from './notifications';
import { invalidateOverlay, syncOverlay } from './overlay';
import { app, getActivePanel, getState } from './store';
import { switchPanel } from './sync';

let tutorialSignature = '';
let tutorialSpotlightFrame = 0;
let tutorialEndConfirmation = false;

const initialTourEnd = TUTORIAL_STEPS.findIndex((step) => 'completesInitialTour' in step && step.completesInitialTour);
const clampStep = (step: number): number => Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step));

function currentTutorialStepIndex(): number {
  const tutorial = getState().tutorial;
  if (tutorial.stepId) {
    const storedIndex = TUTORIAL_STEPS.findIndex((step) => step.id === tutorial.stepId);
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
  showToast('Tutorial beendet. Über ? kannst du es erneut starten.');
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
  if (!startTutorial) showToast('Tutorial übersprungen. Über ? kannst du es erneut starten.');
}

function tutorialStepAvailable(step: TutorialStep): boolean {
  const state = getState();
  if (step.availability.type === 'immediate') return true;
  if (step.availability.type === 'upgrade-affordable') return canBuyUpgrade(state, step.availability.id);
  return canBuyAutomation(state, step.availability.id);
}

function prepareTutorialTarget(step: TutorialStep): void {
  if (step.availability.type === 'immediate' || getActivePanel() === step.availability.panel) return;
  switchPanel(step.availability.panel, false);
}

function tutorialTarget(step: TutorialStep): Element | null {
  return step.selector ? app.querySelector(step.selector) : null;
}

function positionTutorialSpotlight(target: Element): void {
  const spotlight = app.querySelector<HTMLElement>('.tutorial-spotlight');
  const innerFrame = app.querySelector<HTMLElement>('.tutorial-inner-frame');
  if (!spotlight || !innerFrame) return;
  const rect = target.getBoundingClientRect();
  const innerPadding = 12;
  const outerPadding = 28;
  const viewportGap = 6;
  const outerLeft = Math.max(viewportGap, rect.left - outerPadding);
  const outerTop = Math.max(viewportGap, rect.top - outerPadding);
  const outerRight = Math.min(window.innerWidth - viewportGap, rect.right + outerPadding);
  const outerBottom = Math.min(window.innerHeight - viewportGap, rect.bottom + outerPadding);
  const holeLeft = Math.max(0, Math.min(window.innerWidth, rect.left));
  const holeTop = Math.max(0, Math.min(window.innerHeight, rect.top));
  const holeRight = Math.max(holeLeft, Math.min(window.innerWidth, rect.right));
  const holeBottom = Math.max(holeTop, Math.min(window.innerHeight, rect.bottom));
  const setFrame = (frame: HTMLElement, left: number, top: number, right: number, bottom: number): void => {
    frame.style.left = `${left}px`;
    frame.style.top = `${top}px`;
    frame.style.width = `${Math.max(0, right - left)}px`;
    frame.style.height = `${Math.max(0, bottom - top)}px`;
  };
  setFrame(spotlight, outerLeft, outerTop, outerRight, outerBottom);
  setFrame(
    innerFrame,
    Math.max(viewportGap, rect.left - innerPadding),
    Math.max(viewportGap, rect.top - innerPadding),
    Math.min(window.innerWidth - viewportGap, rect.right + innerPadding),
    Math.min(window.innerHeight - viewportGap, rect.bottom + innerPadding),
  );
  const blockerStyles: Record<string, Partial<CSSStyleDeclaration>> = {
    top: { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${outerTop}px` },
    bottom: { left: '0px', top: `${outerBottom}px`, width: `${window.innerWidth}px`, height: `${Math.max(0, window.innerHeight - outerBottom)}px` },
    left: { left: '0px', top: `${outerTop}px`, width: `${outerLeft}px`, height: `${Math.max(0, outerBottom - outerTop)}px` },
    right: { left: `${outerRight}px`, top: `${outerTop}px`, width: `${Math.max(0, window.innerWidth - outerRight)}px`, height: `${Math.max(0, outerBottom - outerTop)}px` },
  };
  const shieldStyles: Record<string, Partial<CSSStyleDeclaration>> = {
    top: { left: `${outerLeft}px`, top: `${outerTop}px`, width: `${Math.max(0, outerRight - outerLeft)}px`, height: `${Math.max(0, holeTop - outerTop)}px` },
    bottom: { left: `${outerLeft}px`, top: `${holeBottom}px`, width: `${Math.max(0, outerRight - outerLeft)}px`, height: `${Math.max(0, outerBottom - holeBottom)}px` },
    left: { left: `${outerLeft}px`, top: `${holeTop}px`, width: `${Math.max(0, holeLeft - outerLeft)}px`, height: `${Math.max(0, holeBottom - holeTop)}px` },
    right: { left: `${holeRight}px`, top: `${holeTop}px`, width: `${Math.max(0, outerRight - holeRight)}px`, height: `${Math.max(0, holeBottom - holeTop)}px` },
  };
  app.querySelectorAll<HTMLElement>('[data-tutorial-blocker]').forEach((blocker) => {
    Object.assign(blocker.style, blockerStyles[blocker.dataset.tutorialBlocker ?? '']);
  });
  app.querySelectorAll<HTMLElement>('[data-tutorial-shield]').forEach((shield) => {
    Object.assign(shield.style, shieldStyles[shield.dataset.tutorialShield ?? '']);
  });
}

export function queueTutorialSpotlightPosition(): void {
  if (tutorialSpotlightFrame) return;
  tutorialSpotlightFrame = window.requestAnimationFrame(() => {
    tutorialSpotlightFrame = 0;
    const state = getState();
    if (!state.tutorial.introSeen || state.tutorial.completed) return;
    const step = TUTORIAL_STEPS[currentTutorialStepIndex()] ?? TUTORIAL_STEPS[0];
    if (!tutorialStepAvailable(step)) return;
    const target = tutorialTarget(step);
    if (target) positionTutorialSpotlight(target);
  });
}

export function syncTutorial(): void {
  const state = getState();
  const root = app.querySelector<HTMLElement>('[data-ui="tutorial-root"]');
  if (!root) return;
  app.querySelectorAll('.tutorial-focus').forEach((element) => element.classList.remove('tutorial-focus'));
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

  prepareTutorialTarget(step);
  const target = tutorialTarget(step);
  target?.classList.add('tutorial-focus');
  const signature = `step:${step.id}:confirm:${tutorialEndConfirmation}`;
  if (signature !== tutorialSignature) {
    tutorialSignature = signature;
    if (target && window.matchMedia('(max-width: 1100px)').matches) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }
    const normalInteraction = step.trigger.type === 'action'
      ? `<small class="tutorial-hint">${step.trigger.hint}</small>`
      : `<button class="tutorial-action tutorial-primary tutorial-next" data-action="tutorial-next">${step.trigger.label}</button>`;
    const interaction = tutorialEndConfirmation
      ? `<section class="tutorial-confirmation" aria-label="Tutorial wirklich beenden?"><p>Möchtest du das Tutorial wirklich beenden?</p><div><button class="tutorial-action tutorial-danger" data-action="confirm-end-tutorial">Tutorial beenden</button><button class="tutorial-action tutorial-secondary" data-action="cancel-end-tutorial">Abbrechen</button></div></section>`
      : normalInteraction;
    const focusLayer = target
      ? `<div class="tutorial-blocker" data-tutorial-blocker="top" aria-hidden="true"></div><div class="tutorial-blocker" data-tutorial-blocker="right" aria-hidden="true"></div><div class="tutorial-blocker" data-tutorial-blocker="bottom" aria-hidden="true"></div><div class="tutorial-blocker" data-tutorial-blocker="left" aria-hidden="true"></div><div class="tutorial-highlight-shield" data-tutorial-shield="top" aria-hidden="true"></div><div class="tutorial-highlight-shield" data-tutorial-shield="right" aria-hidden="true"></div><div class="tutorial-highlight-shield" data-tutorial-shield="bottom" aria-hidden="true"></div><div class="tutorial-highlight-shield" data-tutorial-shield="left" aria-hidden="true"></div><div class="tutorial-inner-frame" aria-hidden="true"></div><div class="tutorial-spotlight" aria-hidden="true"></div>`
      : '<div class="tutorial-blocker tutorial-blocker-full" aria-hidden="true"></div>';
    root.innerHTML = `${focusLayer}<aside class="tutorial-card" aria-label="Tutorial"><div class="tutorial-meta"><span>TUTORIAL · ${stepIndex + 1}/${TUTORIAL_STEPS.length}</span><button data-action="request-end-tutorial">Tutorial beenden</button></div><h2>${step.title}</h2><p>${step.text}</p>${interaction}</aside>`;
  }
  if (target) positionTutorialSpotlight(target);
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
