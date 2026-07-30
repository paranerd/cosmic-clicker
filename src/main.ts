import './styles.scss';
import { playSound } from './audio';
import { LIMITS, UPGRADE_ORDER, UPGRADES, type KnowledgeId } from './content';
import { calculateTemperature, createInitialState, reactionAutomationPerSecond, reduceGame, tick } from './game/engine';
import { clearSave, normalizeGameState, saveGame } from './game/storage';
import type { GameAction, ReactionId } from './game/types';
import { registerServiceWorker } from './pwa';
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
  isCloudInfoOpen,
  isFullResetArmed,
  isPrestigeConfirmationArmed,
  isStellarDataOpen,
  isWarningsOpen,
  setCloudInfoOpen,
  setStellarDataOpen,
  setWarningsOpen,
} from './ui/menus';
import { clearAchievements, clearCycleEndNotice, clearToasts, dismissAchievement, dismissCycleEndNotice, showToast } from './ui/notifications';
import { isKnowledgeOpen, isObjectiveOpen, isSettingsOpen, makeSummaryExclusive, openPanelPopup, resetSummaryAttention, setChronicleOpen, setKnowledgeOpen, setObjectiveOpen, setPanelPopupOpen, setSettingsOpen, setStatsOpen } from './ui/overlay';
import { app, getActivePanel, getState, isMobileLayout, loaded, onLayoutChange, setActivePanel, setState, type Panel } from './ui/store';
import { renderShell, switchPanel, updateUI } from './ui/sync';
import {
  advanceTutorial,
  cancelTutorialEnd,
  confirmTutorialEnd,
  requestTutorialEnd,
  resolveIntro,
  setTutorialEnabled,
  syncTutorialFocusPosition,
} from './ui/tutorial';

type ResetMode = 'run' | 'full';

let lastFrame = performance.now();
let frameTimer = 0;
let frameRequest = 0;
const FRAME_INTERVAL_MS = 100;
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
  if (['BUY_UPGRADE', 'BUY_ACCRETION', 'BUY_REACTION_AUTOMATION', 'BUY_REACTION_UPGRADE', 'BUY_PERK'].includes(action.type)) switchPanel(getActivePanel(), false);
  updateUI(true);
}

function exportSave(): void {
  const state = getState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cosmic-clicker-zyklus-${state.run}.json`; anchor.click(); URL.revokeObjectURL(url); showToast('Spielstand exportiert.');
}

function performReset(mode: ResetMode): void {
  closeResetMenu();
  setSettingsOpen(false);
  clearPrestigeConfirmation();
  clearAchievements();
  clearCycleEndNotice();
  resetSummaryAttention();
  const state = getState();
  if (mode === 'full') { clearSave(); setState(createInitialState()); clearToasts(); }
  else setState(createInitialState(state.perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: state.tutorial, history: state.history, cloudTier: state.cloudTier, nextCloudTier: state.nextCloudTier, discoveredOutcomes: state.discoveredOutcomes, log: state.log, totalElapsed: state.totalElapsed }));
  setActivePanel('reactions'); switchPanel('reactions', false); saveGame(getState()); updateUI(true);
  if (mode === 'run') showToast('Der aktuelle Zyklus wurde neu gestartet.');
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const debugButton = target.closest<HTMLButtonElement>('[data-debug]'); if (debugButton?.dataset.debug) { runDebugAction(debugButton.dataset.debug); return; }
  const insideWarningCorner = target.closest('.warning-corner');
  const insideCloudCorner = target.closest('.cloud-corner');
  const insideStellarDataCorner = target.closest('.stellar-data-corner');
  if (isWarningsOpen() && !insideWarningCorner) setWarningsOpen(false);
  if (isCloudInfoOpen() && !insideCloudCorner) setCloudInfoOpen(false);
  if (isStellarDataOpen() && !insideStellarDataCorner) setStellarDataOpen(false);
  if (target.dataset.overlayDismiss === 'chronicle') { setChronicleOpen(false); return; }
  if (target.dataset.overlayDismiss === 'stats') { setStatsOpen(false); return; }
  if (target.dataset.overlayDismiss === 'settings') { setSettingsOpen(false); return; }
  if (target.dataset.overlayDismiss === 'knowledge') { setKnowledgeOpen(null); return; }
  if (target.dataset.overlayDismiss === 'objective') { setObjectiveOpen(false); return; }
  if (target.dataset.overlayDismiss === 'panel') { setPanelPopupOpen(null); return; }
  // Dock und Desktop-Reiter tragen dasselbe data-panel; nur im Dock öffnet der
  // Bereich zusätzlich sein Popup, weil es dort kein Kontrollzentrum gibt, in
  // dem die Kacheln stehen könnten. Das Popup wird vor switchPanel geöffnet,
  // damit dessen Aktualisierung bereits die neue Fläche trifft.
  const panelButton = target.closest<HTMLButtonElement>('[data-panel]');
  if (panelButton) {
    const panel = panelButton.dataset.panel as Panel;
    if (panelButton.closest('.mobile-dock')) setPanelPopupOpen(panel);
    switchPanel(panel);
    advanceTutorial('panel');
    return;
  }
  const button = target.closest<HTMLButtonElement>('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action; if (!action) return;
  if (action === 'start-intro-tutorial') { resolveIntro(true); return; }
  if (action === 'skip-intro-tutorial') { resolveIntro(false); return; }
  if (action === 'tutorial-next') { advanceTutorial('next'); return; }
  if (action === 'request-end-tutorial') { requestTutorialEnd(); return; }
  if (action === 'cancel-end-tutorial') { cancelTutorialEnd(); return; }
  if (action === 'confirm-end-tutorial') { confirmTutorialEnd(); return; }
  if (action === 'toggle-tutorial') { setSettingsOpen(false); setTutorialEnabled(getState().tutorial.completed); return; }
  if (action === 'dismiss-achievement') { dismissAchievement(); return; }
  if (action === 'open-objective') { setObjectiveOpen(true); advanceTutorial(action); if (event.detail > 0) button.blur(); return; }
  if (action === 'close-objective') { setObjectiveOpen(false); return; }
  if (action === 'reset-run') { performReset('run'); return; }
  if (action === 'reset-full') { if (isFullResetArmed()) performReset('full'); else armFullReset(); return; }
  if (action === 'close-panel') { setPanelPopupOpen(null); return; }
  if (action === 'open-settings') { setSettingsOpen(true); return; }
  if (action === 'close-settings') { setSettingsOpen(false); return; }
  if (action === 'toggle-warnings') { setWarningsOpen(!isWarningsOpen()); return; }
  if (action === 'toggle-cloud-info') { setCloudInfoOpen(!isCloudInfoOpen()); return; }
  if (action === 'toggle-stellar-data') { setStellarDataOpen(!isStellarDataOpen()); return; }
  // Wissensdatenbank: Der Eintrag steckt als data-knowledge am Erklär-Button,
  // die Texte kommen aus content/knowledge.ts — neue Erklärstellen brauchen
  // hier keine Änderung.
  if (action === 'open-knowledge' && button.dataset.knowledge) { setKnowledgeOpen(button.dataset.knowledge as KnowledgeId); return; }
  if (action === 'close-knowledge') { setKnowledgeOpen(null); return; }
  if (action === 'open-stats') { setStatsOpen(true); return; }
  if (action === 'close-stats') { setStatsOpen(false); return; }
  if (action === 'open-chronicle') { setChronicleOpen(true); advanceTutorial('open-chronicle'); return; }
  if (action === 'close-chronicle') { setChronicleOpen(false); return; }
  if (action === 'open-summary') { dismissCycleEndNotice(); makeSummaryExclusive(); dispatch({ type: 'OPEN_SUMMARY' }); return; }
  if (action === 'close-summary') { clearPrestigeConfirmation(); dispatch({ type: 'CLOSE_SUMMARY' }); return; }
  if (action === 'prestige') {
    if (!hasPendingPerks() && hasAffordableSummaryPerk() && !isPrestigeConfirmationArmed()) { armPrestigeConfirmation(); return; }
    clearPrestigeConfirmation();
    dispatch({ type: 'PRESTIGE' });
    switchPanel('reactions', false);
    return;
  }
  if (action.startsWith('buy-perk-') || action.startsWith('remove-perk-')) clearPrestigeConfirmation();
  // Fusionsring: Ein Klick wählt die Reaktion aus, ein erneuter Klick auf
  // denselben Ringbutton hebt die Auswahl wieder auf (zurück zur Akkretion).
  if (action === 'select-reaction' && button.dataset.reaction) {
    const reaction = button.dataset.reaction as ReactionId;
    dispatch({ type: 'SET_ACTIVE_REACTION', reaction: getState().activeReaction === reaction ? null : reaction });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  if (action === 'run-reaction' && button.dataset.reaction) {
    // Punkt 8: Energiedifferenz messen, damit das Klick-Feedback die
    // tatsächlich gewonnene Energie aufsteigen lassen kann.
    const energyBefore = getState().energy;
    dispatch({ type: 'RUN_REACTION', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent, { energyGained: getState().energy - energyBefore });
    return;
  }
  if (action === 'buy-reaction-automation' && button.dataset.reaction) {
    dispatch({ type: 'BUY_REACTION_AUTOMATION', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  if (action === 'buy-reaction-upgrade' && button.dataset.reaction) {
    dispatch({ type: 'BUY_REACTION_UPGRADE', reaction: button.dataset.reaction as ReactionId });
    playActionFeedback(action, event as MouseEvent);
    return;
  }
  const actions: Record<string, GameAction> = {
    // Upgrade-Kaufaktionen kommen generisch aus den Definitionen (Punkt 6):
    // ein neues Upgrade in content/upgrades.ts braucht hier keine Änderung.
    ...Object.fromEntries(UPGRADE_ORDER.map((id) => [UPGRADES[id].action, { type: 'BUY_UPGRADE', upgrade: id } satisfies GameAction])),
    accrete: { type: 'ACCRETE' }, 'buy-accretion': { type: 'BUY_ACCRETION' }, 'buy-perk-cloud': { type: 'BUY_PERK', perk: 'largerCloud' }, 'buy-perk-gravity': { type: 'BUY_PERK', perk: 'permanentGravity' }, 'buy-perk-fusion': { type: 'BUY_PERK', perk: 'fusionMemory' }, 'remove-perk-cloud': { type: 'REMOVE_PERK', perk: 'largerCloud' }, 'remove-perk-gravity': { type: 'REMOVE_PERK', perk: 'permanentGravity' }, 'remove-perk-fusion': { type: 'REMOVE_PERK', perk: 'fusionMemory' }, 'toggle-sound': { type: 'TOGGLE_SOUND' },
  };
  if (actions[action]) {
    dispatch(actions[action]);
    playActionFeedback(action, event as MouseEvent);
    advanceTutorial(action);
  }
  if (action === 'export') exportSave();
  if (action === 'import') document.querySelector<HTMLInputElement>('#save-import')?.click();
});

// Escape schließt einen offenen Wissenseintrag, die Zielanzeige oder die
// Einstellungen. Der Listener hängt bewusst am
// window und nicht an `app`: Nach einem Klick auf den Modal-Hintergrund liegt
// der Fokus auf dem <body> und damit außerhalb von `app`.
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || (!isKnowledgeOpen() && !isObjectiveOpen() && !isSettingsOpen() && !openPanelPopup())) return;
  event.preventDefault();
  if (isKnowledgeOpen()) setKnowledgeOpen(null);
  else if (isObjectiveOpen()) setObjectiveOpen(false);
  else if (isSettingsOpen()) setSettingsOpen(false);
  else setPanelPopupOpen(null);
});

// Der Wechsel zwischen mobiler und Desktop-Fassung verschiebt die Kacheln
// zwischen Dock-Popup und Kontrollzentrum. Beides gleichzeitig im DOM zu
// halten würde die In-place-Updates doppeldeutig machen, deshalb baut die
// Shell an dieser Grenze einmal neu auf.
onLayoutChange(() => {
  if (!isMobileLayout() && openPanelPopup()) setPanelPopupOpen(null);
  renderShell();
});

app.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.action === 'set-volume') { dispatch({ type: 'SET_VOLUME', volume: Number(input.value) / 100 }); return; }
  if (input.dataset.action === 'select-cloud-level') { clearPrestigeConfirmation(); dispatch({ type: 'SELECT_CLOUD_TIER', tier: Number(input.value) }); }
});

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.action === 'set-volume') { playSound('unlock', getState().soundEnabled, getState().volume); return; }
  if (input.id !== 'save-import' || !input.files?.[0]) return;
  try {
    const imported = normalizeGameState(JSON.parse(await input.files[0].text()));
    if (!imported) throw new Error('Invalid save');
    clearAchievements(); setState({ ...imported, lastTick: Date.now() }); saveGame(getState()); setSettingsOpen(false); updateUI(true); showToast('Spielstand erfolgreich importiert.');
  } catch { showToast('Diese Datei ist kein gültiger Spielstand.'); }
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.matchMedia('(pointer: fine)').matches) {
  let parallaxFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (parallaxFrame) return;
    parallaxFrame = window.requestAnimationFrame(() => {
      parallaxFrame = 0;
      const x = pointerX / window.innerWidth - .5; const y = pointerY / window.innerHeight - .5;
      const cosmos = app.querySelector<HTMLElement>('.cosmos');
      cosmos?.style.setProperty('--parallax-x', `${x * -10}px`); cosmos?.style.setProperty('--parallax-y', `${y * -7}px`); cosmos?.style.setProperty('--parallax-soft-x', `${x * 5}px`); cosmos?.style.setProperty('--parallax-soft-y', `${y * 4}px`);
    });
  }, { passive: true });
}

function frame(now: number): void {
  frameRequest = 0;
  const delta = Math.min(LIMITS.offlineSeconds, (now - lastFrame) / 1_000);
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
  scheduleFrame();
}

function scheduleFrame(): void {
  window.clearTimeout(frameTimer);
  frameTimer = window.setTimeout(() => {
    frameTimer = 0;
    frameRequest = window.requestAnimationFrame(frame);
  }, FRAME_INTERVAL_MS);
}

window.setInterval(() => saveGame(getState()), 5_000); window.addEventListener('beforeunload', () => saveGame(getState()));
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('is-paused', document.hidden);
  if (document.hidden) {
    window.clearTimeout(frameTimer); frameTimer = 0;
    if (frameRequest) window.cancelAnimationFrame(frameRequest); frameRequest = 0;
    saveGame(getState());
    return;
  }
  lastFrame = performance.now() - Math.min(LIMITS.offlineSeconds, Math.max(0, (Date.now() - getState().lastTick) / 1_000)) * 1_000;
  frameRequest = window.requestAnimationFrame(frame);
});
window.addEventListener('scroll', syncTutorialFocusPosition, { passive: true, capture: true });
window.addEventListener('resize', syncTutorialFocusPosition, { passive: true });
renderShell(); if (offlineToast) showToast(offlineToast); frameRequest = requestAnimationFrame(frame);
registerServiceWorker();
if (import.meta.env.DEV) {
  type CheatApi = { stardust: (amount: number) => number; energy: (amount: number) => number };
  const adjustResource = (resource: 'stardust' | 'energy', amount: number): number => {
    if (!Number.isFinite(amount)) throw new TypeError('Der Cheat-Wert muss eine endliche Zahl sein.');
    const state = structuredClone(getState());
    state[resource] = Math.max(0, state[resource] + amount);
    setState(state);
    saveGame(state);
    updateUI(true);
    return state[resource];
  };
  (window as typeof window & { cheat: CheatApi }).cheat = Object.freeze({
    stardust: (amount) => adjustResource('stardust', amount),
    energy: (amount) => adjustResource('energy', amount),
  });
}
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
