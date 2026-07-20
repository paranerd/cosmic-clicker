import './styles.scss';
import { playSound } from './audio';
import { calculateTemperature, createInitialState, reactionAutomationPerSecond, reduceGame, tick } from './game/engine';
import { clearSave, normalizeGameState, saveGame } from './game/storage';
import type { CloudTier, GameAction, ReactionId } from './game/types';
import { isDebugOpen, runDebugAction, setDebugOpen, syncDebug } from './ui/debug';
import { playActionFeedback } from './ui/feedback';
import { formatDuration } from './ui/format';
import {
  armFullReset,
  armPrestigeConfirmation,
  clearPrestigeConfirmation,
  closeResetMenu,
  hasAffordableSummaryPerk,
  hasPendingPerks,
  isFullResetArmed,
  isPerksOpen,
  isPrestigeConfirmationArmed,
  isSoundMenuOpen,
  setPerksOpen,
  setSoundMenuOpen,
  toggleResetMenu,
} from './ui/menus';
import { clearAchievements, clearToasts, dismissAchievement, showToast } from './ui/notifications';
import { makeSummaryExclusive, resetSummaryAttention, setChronicleOpen, setStatsOpen } from './ui/overlay';
import { app, getActivePanel, getState, loaded, setActivePanel, setState, type Panel } from './ui/store';
import { renderShell, switchPanel, updateUI } from './ui/sync';
import { advanceTutorial, queueTutorialSpotlightPosition, resolveIntro, setTutorial } from './ui/tutorial';

type ResetMode = 'run' | 'full';

let lastFrame = performance.now();
let lastUiUpdate = 0;
const offlineToast = loaded.offlineSeconds >= 60
  ? `Während deiner Abwesenheit liefen ${formatDuration(loaded.offlineSeconds)} Simulation.`
  : '';

function dispatch(action: GameAction): void {
  const wasCompleted = getState().completed;
  setState(reduceGame(getState(), action));
  const state = getState();
  saveGame(state);
  if (!wasCompleted && state.completed) {
    makeSummaryExclusive();
    playSound('complete', state.soundEnabled, state.volume);
  }
  if (['BUY_DEUTERIUM', 'BUY_GRAVITY', 'BUY_ACCRETION', 'BUY_REACTION_AUTOMATION', 'BUY_PERK'].includes(action.type)) switchPanel(getActivePanel(), false);
  updateUI(true);
}

function exportSave(): void {
  const state = getState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cosmic-clicker-zyklus-${state.run}.json`; anchor.click(); URL.revokeObjectURL(url); showToast('Spielstand exportiert.');
}

function performReset(mode: ResetMode): void {
  closeResetMenu();
  clearPrestigeConfirmation();
  clearAchievements();
  resetSummaryAttention();
  const state = getState();
  if (mode === 'full') { clearSave(); setState(createInitialState()); clearToasts(); }
  else setState(createInitialState(state.perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: state.tutorial, history: state.history, cloudTier: state.cloudTier, nextCloudTier: state.nextCloudTier, discoveredOutcomes: state.discoveredOutcomes }));
  setActivePanel('reactions'); switchPanel('reactions', false); saveGame(getState()); updateUI(true);
  if (mode === 'run') showToast('Der aktuelle Zyklus wurde neu gestartet.');
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const debugButton = target.closest<HTMLButtonElement>('[data-debug]'); if (debugButton?.dataset.debug) { runDebugAction(debugButton.dataset.debug); return; }
  const insidePerkMenu = target.closest('.resource-menu');
  if (isPerksOpen() && !insidePerkMenu) setPerksOpen(false);
  const insideSoundMenu = target.closest('.sound-menu');
  if (isSoundMenuOpen() && !insideSoundMenu) setSoundMenuOpen(false);
  if (target.dataset.overlayDismiss === 'chronicle') { setChronicleOpen(false); return; }
  if (target.dataset.overlayDismiss === 'stats') { setStatsOpen(false); return; }
  const panelButton = target.closest<HTMLButtonElement>('[data-panel]'); if (panelButton) { switchPanel(panelButton.dataset.panel as Panel); advanceTutorial('panel'); return; }
  const button = target.closest<HTMLButtonElement>('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action; if (!action) return;
  if (action === 'start-intro-tutorial') { resolveIntro(true); return; }
  if (action === 'skip-intro-tutorial') { resolveIntro(false); return; }
  if (action === 'tutorial-next') { advanceTutorial('next'); return; }
  if (action === 'skip-tutorial') { setTutorial(getState().tutorial.step, true); showToast('Tutorial übersprungen. Über ? kannst du es erneut starten.'); return; }
  if (action === 'replay-tutorial') { setTutorial(0, false); showToast('Tutorial neu gestartet.'); return; }
  if (action === 'dismiss-achievement') { dismissAchievement(); return; }
  if (action === 'reset-menu') { toggleResetMenu(); return; }
  if (action === 'reset-run') { performReset('run'); return; }
  if (action === 'reset-full') { if (isFullResetArmed()) performReset('full'); else armFullReset(); return; }
  if (action === 'toggle-perks') { setPerksOpen(!isPerksOpen()); return; }
  if (action === 'toggle-sound-menu') { setSoundMenuOpen(!isSoundMenuOpen()); return; }
  if (action === 'open-stats') { setStatsOpen(true); return; }
  if (action === 'close-stats') { setStatsOpen(false); return; }
  if (action === 'open-chronicle') { setChronicleOpen(true); advanceTutorial('open-chronicle'); return; }
  if (action === 'close-chronicle') { setChronicleOpen(false); return; }
  if (action === 'open-summary') { makeSummaryExclusive(); dispatch({ type: 'OPEN_SUMMARY' }); return; }
  if (action === 'close-summary') { clearPrestigeConfirmation(); dispatch({ type: 'CLOSE_SUMMARY' }); return; }
  if (action === 'prestige') {
    if (!hasPendingPerks() && hasAffordableSummaryPerk() && !isPrestigeConfirmationArmed()) { armPrestigeConfirmation(); return; }
    clearPrestigeConfirmation();
    dispatch({ type: 'PRESTIGE' });
    switchPanel('reactions', false);
    return;
  }
  if (action.startsWith('select-cloud-')) { clearPrestigeConfirmation(); dispatch({ type: 'SELECT_CLOUD_TIER', tier: Number(action.slice(-1)) as CloudTier }); return; }
  if (action.startsWith('buy-perk-') || action.startsWith('remove-perk-')) clearPrestigeConfirmation();
  if (action === 'run-reaction' && button.dataset.reaction) {
    dispatch({ type: 'RUN_REACTION', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  if (action === 'buy-reaction-automation' && button.dataset.reaction) {
    dispatch({ type: 'BUY_REACTION_AUTOMATION', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  const actions: Record<string, GameAction> = {
    accrete: { type: 'ACCRETE' }, 'buy-deuterium': { type: 'BUY_DEUTERIUM' }, 'buy-gravity': { type: 'BUY_GRAVITY' }, 'buy-accretion': { type: 'BUY_ACCRETION' }, 'buy-perk-cloud': { type: 'BUY_PERK', perk: 'largerCloud' }, 'buy-perk-gravity': { type: 'BUY_PERK', perk: 'permanentGravity' }, 'buy-perk-fusion': { type: 'BUY_PERK', perk: 'fusionMemory' }, 'remove-perk-cloud': { type: 'REMOVE_PERK', perk: 'largerCloud' }, 'remove-perk-gravity': { type: 'REMOVE_PERK', perk: 'permanentGravity' }, 'remove-perk-fusion': { type: 'REMOVE_PERK', perk: 'fusionMemory' }, 'toggle-sound': { type: 'TOGGLE_SOUND' },
  };
  if (actions[action]) { dispatch(actions[action]); playActionFeedback(action, event as MouseEvent); if (action === 'accrete') advanceTutorial('accrete'); }
  if (action === 'export') exportSave();
  if (action === 'import') document.querySelector<HTMLInputElement>('#save-import')?.click();
});

app.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.action !== 'set-volume') return;
  dispatch({ type: 'SET_VOLUME', volume: Number(input.value) / 100 });
});

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.action === 'set-volume') { playSound('unlock', getState().soundEnabled, getState().volume); return; }
  if (input.id !== 'save-import' || !input.files?.[0]) return;
  try {
    const imported = normalizeGameState(JSON.parse(await input.files[0].text()));
    if (!imported) throw new Error('Invalid save');
    clearAchievements(); setState({ ...imported, lastTick: Date.now() }); saveGame(getState()); updateUI(true); showToast('Spielstand erfolgreich importiert.');
  } catch { showToast('Diese Datei ist kein gültiger Spielstand.'); }
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (event) => {
    const x = event.clientX / window.innerWidth - .5; const y = event.clientY / window.innerHeight - .5;
    document.documentElement.style.setProperty('--parallax-x', `${x * -10}px`); document.documentElement.style.setProperty('--parallax-y', `${y * -7}px`); document.documentElement.style.setProperty('--parallax-soft-x', `${x * 5}px`); document.documentElement.style.setProperty('--parallax-soft-y', `${y * 4}px`);
  }, { passive: true });
}

function frame(now: number): void {
  if (now - lastUiUpdate > 100) {
    const delta = Math.min(1, (now - lastFrame) / 1_000);
    lastFrame = now;
    if (getState().tutorial.introSeen) {
      const wasCompleted = getState().completed;
      setState(tick(getState(), delta));
      const state = getState();
      if (!wasCompleted && state.completed) {
        makeSummaryExclusive();
        playSound('complete', state.soundEnabled, state.volume);
      }
    }
    updateUI();
    lastUiUpdate = now;
  }
  requestAnimationFrame(frame);
}

window.setInterval(() => saveGame(getState()), 5_000); window.addEventListener('beforeunload', () => saveGame(getState()));
window.addEventListener('scroll', queueTutorialSpotlightPosition, { passive: true, capture: true });
window.addEventListener('resize', queueTutorialSpotlightPosition, { passive: true });
renderShell(); if (offlineToast) showToast(offlineToast); requestAnimationFrame(frame);
if (import.meta.hot) Object.assign(window, {
  cosmicDebug: () => {
    setDebugOpen(!isDebugOpen());
    syncDebug();
    return isDebugOpen() ? 'Cosmic Debug geöffnet.' : 'Cosmic Debug geschlossen.';
  },
  __cosmicState: () => getState(),
  __temperature: () => calculateTemperature(getState()),
  __fusionRate: () => reactionAutomationPerSecond(getState(), 'hydrogen'),
});
