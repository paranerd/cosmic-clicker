import { playSound, type SoundEffect } from '../audio';
import { accretionPerClick } from '../game/engine';
import { formatCompact, formatNumber } from './format';
import { app, getState } from './store';

// Punkt 9: Positioniert wie der Materiegewinn beim Stern-Klick — steigt aus
// der Region des Mauszeigers auf (mit demselben Zufalls-Versatz wie
// `gainX`/`gainY` unten), statt immer von derselben festen Stelle in der
// Karte. `x`/`y` sind bereits kartenrelative Pixelkoordinaten.
function createActionFeedback(container: HTMLElement, text: string, kind: string, x: number, y: number): void {
  const feedback = document.createElement('span'); feedback.className = `action-feedback ${kind}`; feedback.textContent = text;
  feedback.style.left = `${x}px`; feedback.style.top = `${y}px`; feedback.style.right = 'auto';
  container.append(feedback);
  feedback.addEventListener('animationend', () => feedback.remove(), { once: true });
}

// Kammerrelative Position des Klicks. Tastatur-Auslösung liefert
// clientX/clientY = 0 — dann wird stattdessen die Mitte des Sterns verwendet,
// damit das Feedback nicht in der Ecke der Kammer erscheint.
function chamberClickPosition(event: MouseEvent): { chamber: HTMLElement; star: HTMLElement; x: number; y: number } | null {
  const chamber = app.querySelector<HTMLElement>('.star-chamber'); const star = app.querySelector<HTMLElement>('.star-button');
  if (!chamber || !star) return null;
  const chamberRect = chamber.getBoundingClientRect(); const starRect = star.getBoundingClientRect();
  const keyboardTriggered = event.detail === 0 || event.clientX === 0 && event.clientY === 0;
  return {
    chamber,
    star,
    x: keyboardTriggered ? starRect.left + starRect.width / 2 - chamberRect.left : event.clientX - chamberRect.left,
    y: keyboardTriggered ? starRect.top + starRect.height / 2 - chamberRect.top : event.clientY - chamberRect.top,
  };
}

function playAccretionFeedback(event: MouseEvent): void {
  const state = getState();
  const position = chamberClickPosition(event);
  if (!position) return;
  const { chamber, star, x: targetX, y: targetY } = position;
  const chamberRect = chamber.getBoundingClientRect();
  const count = 5 + Math.floor(Math.random() * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2; const radius = Math.max(chamberRect.width, chamberRect.height) * (.32 + Math.random() * .24);
    const particle = document.createElement('span'); particle.className = 'matter-particle';
    particle.style.left = `${targetX}px`; particle.style.top = `${targetY}px`; particle.style.setProperty('--from-x', `${Math.cos(angle) * radius}px`); particle.style.setProperty('--from-y', `${Math.sin(angle) * radius}px`); particle.style.setProperty('--particle-delay', `${index * 28}ms`);
    particle.textContent = Math.random() <= .82 ? 'H' : 'He';
    chamber.append(particle); particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
  const gainX = targetX + (Math.random() - .5) * 36; const gainY = targetY - 20 - Math.random() * 22;
  const gain = document.createElement('span'); gain.className = 'accretion-gain'; gain.textContent = `+${formatNumber(accretionPerClick(state))} ME`; gain.style.left = `${gainX}px`; gain.style.top = `${gainY}px`; gain.style.setProperty('--gain-delay', `${count * 28 + 120}ms`); chamber.append(gain); gain.addEventListener('animationend', () => gain.remove(), { once: true });
  star.animate([{ transform: 'scale(1)' }, { transform: 'scale(.965)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
}

// Punkt 8: Beim Fusionieren steigt die tatsächlich gewonnene Energie auf
// (statt der Reaktionsgleichung, die ohnehin unter dem Stern steht).
// main.ts misst die Energiedifferenz des Spielzustands rund um den Dispatch
// und reicht sie als context.energyGained herein.
export interface ActionFeedbackContext { energyGained?: number }

// Fusionen werden am Stern selbst ausgelöst, ihr Feedback entsteht deshalb —
// wie das der Akkretion — in der Star Chamber an der Klickposition, nicht mehr
// in der Reaktionskachel. Zusätzlich pulsiert der zugehörige Ringbutton, damit
// erkennbar bleibt, welche der ringförmig angeordneten Fusionen gelaufen ist.
function playFusionFeedback(event: MouseEvent, context: ActionFeedbackContext): void {
  const position = chamberClickPosition(event);
  if (!position) return;
  const { chamber, star, x, y } = position;
  const feedbackText = context.energyGained !== undefined && context.energyGained > 0
    ? `+${formatCompact(context.energyGained)} Energie`
    : 'Fusion + Energie';
  createActionFeedback(chamber, feedbackText, 'fusion', x + (Math.random() - .5) * 36, y - 20 - Math.random() * 22);
  const pulse = [{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }];
  star.animate(pulse, { duration: 220, easing: 'ease-out' });
  app.querySelector<HTMLElement>('.star-surface')?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }], { duration: 520, easing: 'ease-out' });
  const reaction = getState().activeReaction;
  // Der Ringbutton trägt seine Position in einem eigenen transform (siehe
  // styles.scss) — deshalb wird hier nur die Helligkeit animiert, damit die
  // Animation den Button nicht aus dem Ring schiebt.
  if (reaction) app.querySelector<HTMLElement>(`[data-fusion-ring-button="${reaction}"]`)?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 420, easing: 'ease-out' });
}

export function playActionFeedback(action: string, event: MouseEvent, context: ActionFeedbackContext = {}): void {
  const state = getState();
  const sounds: Partial<Record<string, SoundEffect>> = { accrete: 'accrete', 'buy-deuterium': 'deuterium', 'run-reaction': 'fusion', 'select-reaction': 'unlock', 'unlock-reaction': 'unlock', 'buy-gravity': 'purchase', 'buy-accretion': 'purchase', 'buy-reaction-automation': 'purchase', 'buy-reaction-upgrade': 'purchase', 'buy-perk-cloud': 'purchase', 'buy-perk-gravity': 'purchase', 'buy-perk-fusion': 'purchase' };
  if (sounds[action]) playSound(sounds[action], state.soundEnabled, state.volume);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (action === 'accrete') playAccretionFeedback(event);
  if (action === 'run-reaction') playFusionFeedback(event, context);
}
