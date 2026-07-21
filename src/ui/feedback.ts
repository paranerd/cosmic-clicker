import { playSound, type SoundEffect } from '../audio';
import { REACTIONS } from '../content';
import { accretionPerClick } from '../game/engine';
import type { ReactionId } from '../game/types';
import { formatNumber } from './format';
import { app, getState } from './store';

function createActionFeedback(container: HTMLElement, text: string, kind: string): void {
  const feedback = document.createElement('span'); feedback.className = `action-feedback ${kind}`; feedback.textContent = text; container.append(feedback);
  feedback.addEventListener('animationend', () => feedback.remove(), { once: true });
}

function playAccretionFeedback(event: MouseEvent): void {
  const state = getState();
  const chamber = app.querySelector<HTMLElement>('.star-chamber'); const star = app.querySelector<HTMLElement>('.star-button');
  if (!chamber || !star) return;
  const chamberRect = chamber.getBoundingClientRect(); const starRect = star.getBoundingClientRect();
  const keyboardTriggered = event.detail === 0 || event.clientX === 0 && event.clientY === 0;
  const targetX = keyboardTriggered ? starRect.left + starRect.width / 2 - chamberRect.left : event.clientX - chamberRect.left;
  const targetY = keyboardTriggered ? starRect.top + starRect.height / 2 - chamberRect.top : event.clientY - chamberRect.top;
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

export function playActionFeedback(action: string, event: MouseEvent): void {
  const state = getState();
  const sounds: Partial<Record<string, SoundEffect>> = { accrete: 'accrete', 'buy-deuterium': 'deuterium', 'run-reaction': 'fusion', 'buy-gravity': 'purchase', 'buy-accretion': 'purchase', 'buy-reaction-automation': 'purchase', 'buy-perk-cloud': 'purchase', 'buy-perk-gravity': 'purchase', 'buy-perk-fusion': 'purchase' };
  if (sounds[action]) playSound(sounds[action], state.soundEnabled, state.volume);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (action === 'accrete') playAccretionFeedback(event);
  if (action === 'run-reaction') {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reaction]');
    const reaction = button?.dataset.reaction as ReactionId | undefined;
    const card = reaction ? app.querySelector<HTMLElement>(`[data-reaction-card="${reaction}"]`) : null;
    const feedbackText = reaction ? `${REACTIONS[reaction].equationInput} → ${REACTIONS[reaction].equationOutput}` : 'Fusion + Energie';
    if (card) createActionFeedback(card, feedbackText, 'fusion');
    card?.animate([{ borderColor: 'rgba(242,168,75,.25)' }, { borderColor: 'rgba(242,168,75,.9)', filter: 'brightness(1.35)' }, { borderColor: 'rgba(242,168,75,.25)', filter: 'brightness(1)' }], { duration: 650, easing: 'ease-out' });
    button?.animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    app.querySelector<HTMLElement>('.star-surface')?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }], { duration: 520, easing: 'ease-out' });
  }
}
