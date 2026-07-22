import { TUTORIAL_STEPS } from '../content';
import { saveGame } from '../game/storage';
import { markCurrentObjectiveSeen, showToast } from './notifications';
import { invalidateOverlay, syncOverlay } from './overlay';
import { app, getState } from './store';
import { switchPanel } from './sync';

let tutorialSignature = '';
let tutorialSpotlightFrame = 0;

export function invalidateTutorial(): void {
  tutorialSignature = '';
}

function finishOnboarding(): void {
  const state = getState();
  switchPanel('reactions', false);
  markCurrentObjectiveSeen();
  if (state.tutorial.cosmosToastPending) {
    state.tutorial.cosmosToastPending = false;
    showToast('Ein neuer Kosmos beginnt.');
  }
}

export function setTutorial(step: number, completed = false): void {
  const state = getState();
  state.tutorial = { ...state.tutorial, step: Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step)), completed };
  if (completed) finishOnboarding();
  saveGame(state);
  syncTutorial();
  invalidateOverlay();
  syncOverlay();
}

export function resolveIntro(startTutorial: boolean): void {
  const state = getState();
  state.tutorial = { ...state.tutorial, introSeen: true, completed: !startTutorial, step: 0 };
  if (!startTutorial) finishOnboarding();
  saveGame(state);
  invalidateOverlay();
  tutorialSignature = '';
  syncOverlay();
  syncTutorial();
  if (!startTutorial) showToast('Tutorial übersprungen. Über ? kannst du es erneut starten.');
}

function positionTutorialSpotlight(target: Element): void {
  const spotlight = app.querySelector<HTMLElement>('.tutorial-spotlight');
  if (!spotlight) return;
  const rect = target.getBoundingClientRect();
  const padding = 18;
  spotlight.style.left = `${Math.max(4, rect.left - padding)}px`;
  spotlight.style.top = `${Math.max(4, rect.top - padding)}px`;
  spotlight.style.width = `${Math.min(window.innerWidth - 8, rect.width + padding * 2)}px`;
  spotlight.style.height = `${Math.min(window.innerHeight - 8, rect.height + padding * 2)}px`;
}

export function queueTutorialSpotlightPosition(): void {
  if (tutorialSpotlightFrame) return;
  tutorialSpotlightFrame = window.requestAnimationFrame(() => {
    tutorialSpotlightFrame = 0;
    const state = getState();
    if (!state.tutorial.introSeen || state.tutorial.completed) return;
    const step = TUTORIAL_STEPS[state.tutorial.step] ?? TUTORIAL_STEPS[0];
    const target = app.querySelector(step.selector);
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
    return;
  }
  const step = TUTORIAL_STEPS[state.tutorial.step] ?? TUTORIAL_STEPS[0];
  const target = app.querySelector(step.selector);
  target?.classList.add('tutorial-focus');
  const signature = `step:${state.tutorial.step}`;
  if (signature !== tutorialSignature) {
    tutorialSignature = signature;
    if (target && window.matchMedia('(max-width: 1100px)').matches) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }
    const interactionHint = step.trigger === 'accrete' ? 'Klicke auf den markierten Stern.'
      : step.trigger === 'panel' ? 'Öffne einen markierten Tab.'
        : step.trigger === 'open-chronicle' ? 'Öffne die markierte Chronik.' : '';
    root.innerHTML = `<div class="tutorial-spotlight" aria-hidden="true"></div><aside class="tutorial-card" aria-label="Tutorial"><div><span>TUTORIAL · ${state.tutorial.step + 1}/${TUTORIAL_STEPS.length}</span><button data-action="skip-tutorial">Überspringen</button></div><h2>${step.title}</h2><p>${step.text}</p>${interactionHint ? `<small>${interactionHint}</small>` : `<button class="tutorial-next" data-action="tutorial-next">Weiter</button>`}</aside>`;
  }
  if (target) positionTutorialSpotlight(target);
}

export function advanceTutorial(trigger: string): void {
  const state = getState();
  if (state.tutorial.completed || TUTORIAL_STEPS[state.tutorial.step]?.trigger !== trigger) return;
  if (state.tutorial.step >= TUTORIAL_STEPS.length - 1) setTutorial(state.tutorial.step, true);
  else setTutorial(state.tutorial.step + 1);
}
