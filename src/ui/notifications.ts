import { playSound } from '../audio';
import { achievementTitleFor, OUTCOMES, OUTCOME_LABELS, warningFor } from '../content';
import { objectiveFor } from '../game/engine';
import { saveGame } from '../game/storage';
import { app, getActivePanel, getState, type Panel } from './store';
import { currentOpportunities } from './views';

interface ToastMessage { id: number; text: string; leaving: boolean }
export type Objective = ReturnType<typeof objectiveFor>;
interface AchievementMessage { completedObjective: string; next: Objective }

let toastSequence = 0;
let toastMessages: ToastMessage[] = [];
const toastTimers = new Map<number, number>();
let lastOpportunitySignature = '';
let notificationsInitialized = false;
let lastObjectiveId = objectiveFor(getState()).id;
let lastObjectiveRun = getState().run;
let activeAchievement: AchievementMessage | null = null;
let achievementQueue: AchievementMessage[] = [];
let achievementTransitionTimer = 0;
let cycleEndNoticeRun = getState().completed ? getState().run : 0;
let cycleEndNoticeVisible = false;
let cycleEndTransitionTimer = 0;

function renderCycleEndNotice(): void {
  const state = getState();
  const root = app.querySelector<HTMLElement>('[data-ui="cycle-end-root"]');
  if (!root || !state.completed || !state.outcome || !cycleEndNoticeVisible) return;
  const outcome = OUTCOMES[state.outcome];
  root.innerHTML = `<aside class="cycle-end-banner" role="region" aria-labelledby="cycle-end-title"><div class="cycle-end-announcement" role="status" aria-live="assertive" aria-atomic="true"><small>ZYKLUS ${state.run.toString().padStart(2, '0')} ABGESCHLOSSEN · ${OUTCOME_LABELS[state.outcome]}</small><h2 id="cycle-end-title">${outcome.title}</h2></div><p>${outcome.description} Öffne die Zusammenfassung, um deinen Sternenstaub einzusetzen und den nächsten Zyklus vorzubereiten.</p><button class="primary-action" data-action="open-summary"><span>Zusammenfassung öffnen</span><small>Vermächtnis und nächsten Zyklus planen</small></button></aside>`;
  const banner = root.querySelector<HTMLElement>('.cycle-end-banner');
  window.requestAnimationFrame(() => banner?.classList.add('is-visible'));
}

export function syncCycleEndNotice(): void {
  const state = getState();
  const root = app.querySelector<HTMLElement>('[data-ui="cycle-end-root"]');
  if (!root) return;
  if (!state.completed) {
    cycleEndNoticeRun = 0;
    cycleEndNoticeVisible = false;
    if (root.innerHTML) root.innerHTML = '';
    return;
  }
  if (state.summaryOpen) return;
  if (cycleEndNoticeRun === state.run) return;
  cycleEndNoticeRun = state.run;
  cycleEndNoticeVisible = true;
  renderCycleEndNotice();
}

export function dismissCycleEndNotice(): void {
  cycleEndNoticeVisible = false;
  window.clearTimeout(cycleEndTransitionTimer);
  const root = app.querySelector<HTMLElement>('[data-ui="cycle-end-root"]');
  const banner = root?.querySelector<HTMLElement>('.cycle-end-banner');
  banner?.classList.add('is-leaving');
  banner?.classList.remove('is-visible');
  cycleEndTransitionTimer = window.setTimeout(() => { if (root) root.innerHTML = ''; }, 320);
}

export function clearCycleEndNotice(): void {
  cycleEndNoticeVisible = false;
  cycleEndNoticeRun = 0;
  window.clearTimeout(cycleEndTransitionTimer);
  const root = app.querySelector<HTMLElement>('[data-ui="cycle-end-root"]');
  if (root) root.innerHTML = '';
}

export function showToast(message: string): void {
  const toastMessage: ToastMessage = { id: ++toastSequence, text: message, leaving: false };
  toastMessages = [toastMessage, ...toastMessages]; syncToast();
  toastTimers.set(toastMessage.id, window.setTimeout(() => dismissToast(toastMessage.id), 3_200));
}

function dismissToast(id: number): void {
  const message = toastMessages.find((item) => item.id === id);
  if (!message || message.leaving) return;
  message.leaving = true; syncToast();
  toastTimers.set(id, window.setTimeout(() => {
    toastMessages = toastMessages.filter((item) => item.id !== id); toastTimers.delete(id); syncToast();
  }, 320));
}

export function clearToasts(): void {
  toastTimers.forEach((timer) => window.clearTimeout(timer)); toastTimers.clear(); toastMessages = []; syncToast();
}

export function syncToast(): void {
  const root = app.querySelector<HTMLElement>('[data-ui="toast-root"]');
  if (!root) return;
  if (!toastMessages.length) { if (root.innerHTML) root.innerHTML = ''; return; }
  let stack = root.querySelector<HTMLElement>('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; root.append(stack); }
  const activeIds = new Set(toastMessages.map((message) => String(message.id)));
  stack.querySelectorAll<HTMLElement>('.toast').forEach((element) => {
    if (!activeIds.has(element.dataset.toastId ?? '')) element.remove();
  });
  const entering: HTMLElement[] = [];
  toastMessages.forEach((message) => {
    let element = stack!.querySelector<HTMLElement>(`[data-toast-id="${message.id}"]`);
    if (!element) {
      element = document.createElement('div'); element.className = 'toast is-entering'; element.dataset.toastId = String(message.id); element.setAttribute('role', 'status'); element.setAttribute('aria-atomic', 'true'); element.textContent = message.text; stack!.append(element); entering.push(element);
    }
    element.classList.toggle('is-leaving', message.leaving);
  });
  let offset = 0;
  toastMessages.forEach((message) => {
    const element = stack!.querySelector<HTMLElement>(`[data-toast-id="${message.id}"]`);
    if (!element) return;
    element.style.setProperty('--toast-offset', `${offset}px`);
    offset += element.getBoundingClientRect().height + 8;
  });
  if (entering.length) window.requestAnimationFrame(() => entering.forEach((element) => element.classList.remove('is-entering')));
}

export function markOpportunitiesSeen(panel: Panel, opportunities: Record<Panel, string[]>): void {
  const state = getState();
  let changed = false;
  opportunities[panel].forEach((key) => {
    if (state.seenOpportunities.includes(key)) return;
    state.seenOpportunities.push(key);
    changed = true;
  });
  if (changed) saveGame(state);
}

function flashUnlockedTab(panel: Panel): void {
  const button = app.querySelector<HTMLButtonElement>(`[data-panel="${panel}"]`);
  if (!button) return;
  button.classList.remove('unlock-flash');
  void button.offsetWidth;
  button.classList.add('unlock-flash');
  button.addEventListener('animationend', () => button.classList.remove('unlock-flash'), { once: true });
}

export function syncNotifications(): void {
  const state = getState();
  const activePanel = getActivePanel();
  const opportunities = currentOpportunities();
  const previous = new Set(lastOpportunitySignature ? lastOpportunitySignature.split('|') : []);
  const unseenBeforeOpening = (Object.keys(opportunities) as Panel[]).reduce<Record<Panel, string[]>>((result, panel) => {
    result[panel] = opportunities[panel].filter((key) => !state.seenOpportunities.includes(key));
    return result;
  }, { reactions: [], upgrades: [], automation: [] });
  const newlyUnlocked = notificationsInitialized
    ? (Object.keys(opportunities) as Panel[]).filter((panel) => unseenBeforeOpening[panel].some((key) => !previous.has(key)))
    : [];
  const newlyAvailable = (Object.keys(opportunities) as Panel[]).reduce<Record<Panel, string[]>>((result, panel) => {
    result[panel] = unseenBeforeOpening[panel].filter((key) => !previous.has(key));
    return result;
  }, { reactions: [], upgrades: [], automation: [] });

  markOpportunitiesSeen(activePanel, opportunities);
  (Object.keys(opportunities) as Panel[]).forEach((panel) => {
    const button = app.querySelector<HTMLButtonElement>(`[data-panel="${panel}"]`);
    const count = app.querySelector<HTMLElement>(`[data-tab-count="${panel}"]`);
    const unreadCount = panel === activePanel ? 0 : opportunities[panel].filter((key) => !state.seenOpportunities.includes(key)).length;
    button?.classList.toggle('has-notice', unreadCount > 0);
    if (count) {
      count.textContent = unreadCount ? String(unreadCount) : '';
      count.hidden = unreadCount === 0;
    }
  });

  if (newlyUnlocked.length) {
    newlyUnlocked.forEach(flashUnlockedTab);
    playSound('unlock', state.soundEnabled, state.volume);
    const automationIsNew = newlyAvailable.automation.some((key) => key.endsWith(':0'));
    const messages: Record<Panel, string> = { reactions: 'Neue Reaktion verfügbar.', upgrades: 'Neues Upgrade verfügbar.', automation: automationIsNew ? 'Neue Automation verfügbar.' : 'Automation kann ausgebaut werden.' };
    showToast(newlyUnlocked.length === 1 ? messages[newlyUnlocked[0]] : 'Neue Sternsysteme verfügbar.');
  }
  lastOpportunitySignature = (Object.keys(opportunities) as Panel[]).flatMap((panel) => opportunities[panel]).join('|');
  notificationsInitialized = true;
}

export function markCurrentObjectiveSeen(): void {
  const state = getState();
  const objective = objectiveFor(state);
  lastObjectiveId = objective.id;
  lastObjectiveRun = state.run;
  if (!state.seenObjectives.includes(objective.id)) state.seenObjectives.push(objective.id);
}

function displayNextAchievement(): void {
  const state = getState();
  const root = app.querySelector<HTMLElement>('[data-ui="achievement-root"]');
  if (!root || activeAchievement) return;
  activeAchievement = achievementQueue.shift() ?? null;
  if (!activeAchievement) { root.innerHTML = ''; return; }
  const title = achievementTitleFor(activeAchievement.completedObjective);
  if (!title) { activeAchievement = null; displayNextAchievement(); return; }
  const warning = warningFor(activeAchievement.completedObjective);
  const warningMarkup = warning ? `<div class="achievement-warning"><b>${warning.title}</b><span>${warning.text}</span></div>` : '';
  root.innerHTML = `<aside class="achievement-banner" role="region" aria-labelledby="achievement-title"><button class="achievement-close" data-action="dismiss-achievement" aria-label="Zielhinweis schließen">×</button><div class="achievement-announcement" role="status" aria-live="polite" aria-atomic="true"><small>ZIEL ERREICHT</small><h2 id="achievement-title">${title}</h2></div>${warningMarkup}<div class="achievement-next"><span>Als Nächstes</span><b>${activeAchievement.next.title}</b><p>${activeAchievement.next.detail}</p></div></aside>`;
  const banner = root.querySelector<HTMLElement>('.achievement-banner');
  window.requestAnimationFrame(() => banner?.classList.add('is-visible'));
  playSound('unlock', state.soundEnabled, state.volume);
}

function showAchievement(completedObjective: string, next: Objective): void {
  if (!achievementTitleFor(completedObjective)) return;
  achievementQueue.push({ completedObjective, next });
  displayNextAchievement();
}

export function dismissAchievement(): void {
  if (!activeAchievement) return;
  const root = app.querySelector<HTMLElement>('[data-ui="achievement-root"]');
  const banner = root?.querySelector<HTMLElement>('.achievement-banner');
  window.clearTimeout(achievementTransitionTimer);
  banner?.classList.add('is-leaving');
  banner?.classList.remove('is-visible');
  achievementTransitionTimer = window.setTimeout(() => {
    if (root?.contains(banner ?? null)) root.innerHTML = '';
    activeAchievement = null;
    displayNextAchievement();
  }, 340);
}

export function clearAchievements(): void {
  window.clearTimeout(achievementTransitionTimer);
  achievementQueue = [];
  activeAchievement = null;
  const root = app.querySelector<HTMLElement>('[data-ui="achievement-root"]');
  if (root) root.innerHTML = '';
}

export function syncObjectiveAchievement(objective: Objective): void {
  const state = getState();
  if (state.run !== lastObjectiveRun) {
    markCurrentObjectiveSeen();
    saveGame(state);
    return;
  }
  if (objective.id === lastObjectiveId) return;
  const completedObjective = lastObjectiveId;
  lastObjectiveId = objective.id;
  if (!state.seenObjectives.includes(objective.id)) state.seenObjectives.push(objective.id);
  saveGame(state);
  if (!state.completed) showAchievement(completedObjective, objective);
}
