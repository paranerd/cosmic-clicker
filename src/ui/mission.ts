import { app } from './store';

const MISSION_COLLAPSED_KEY = 'cosmic-clicker-mission-collapsed';

function loadMissionCollapsed(): boolean {
  try {
    return localStorage.getItem(MISSION_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

let missionCollapsed = loadMissionCollapsed();
let missionAnimations: Animation[] = [];

export const isMissionCollapsed = (): boolean => missionCollapsed;

export function setMissionCollapsed(collapsed: boolean): void {
  missionCollapsed = collapsed;
  try {
    localStorage.setItem(MISSION_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Die Anzeigepräferenz ist optional; das Spiel bleibt auch ohne Storage nutzbar.
  }

  missionAnimations.forEach((animation) => animation.cancel());
  missionAnimations = [];

  const strip = app.querySelector<HTMLElement>('[data-ui="mission-strip"]');
  const main = app.querySelector<HTMLElement>('main');
  const movingElements = strip
    ? Array.from(strip.querySelectorAll<HTMLElement>('.mission-progress, .elapsed, .mission-collapse'))
    : [];
  const beforeRects = new Map(movingElements.map((element) => [element, element.getBoundingClientRect()]));
  const beforeHeight = strip?.getBoundingClientRect().height ?? 0;
  const beforeRows = main && getComputedStyle(main).display === 'grid' ? getComputedStyle(main).gridTemplateRows : '';

  strip?.classList.toggle('is-collapsed', collapsed);
  main?.classList.toggle('mission-is-collapsed', collapsed);
  strip?.querySelector<HTMLElement>('.mission-copy')?.setAttribute('aria-hidden', String(collapsed));
  const button = strip?.querySelector<HTMLButtonElement>('[data-action="toggle-mission"]');
  if (!button) return;
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', collapsed ? 'Zielbereich vergrößern' : 'Zielbereich verkleinern');
  button.title = collapsed ? 'Zielbereich vergrößern' : 'Zielbereich verkleinern';

  if (!strip || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const duration = 340;
  const easing = 'cubic-bezier(.2,.75,.25,1)';
  const afterHeight = strip.getBoundingClientRect().height;
  const afterRows = main && beforeRows ? getComputedStyle(main).gridTemplateRows : '';
  if (main && beforeRows && afterRows && beforeRows !== afterRows) {
    missionAnimations.push(main.animate(
      [{ gridTemplateRows: beforeRows }, { gridTemplateRows: afterRows }],
      { duration, easing },
    ));
  } else if (beforeHeight !== afterHeight) {
    missionAnimations.push(strip.animate(
      [{ height: `${beforeHeight}px` }, { height: `${afterHeight}px` }],
      { duration, easing },
    ));
  }
  movingElements.forEach((element) => {
    const before = beforeRects.get(element);
    const after = element.getBoundingClientRect();
    if (!before) return;
    const x = before.left - after.left;
    const y = before.top - after.top;
    if (Math.abs(x) < .5 && Math.abs(y) < .5) return;
    missionAnimations.push(element.animate(
      [{ translate: `${x}px ${y}px` }, { translate: '0 0' }],
      { duration, easing },
    ));
  });
}

export const toggleMissionCollapsed = (): void => setMissionCollapsed(!missionCollapsed);
