export type SoundEffect = 'accrete' | 'deuterium' | 'fusion' | 'unlock' | 'purchase' | 'complete';

let context: AudioContext | null = null;

const soundShape: Record<SoundEffect, { frequency: number; end: number; duration: number; wave: OscillatorType; gain: number }> = {
  accrete: { frequency: 180, end: 105, duration: .09, wave: 'sine', gain: .12 },
  deuterium: { frequency: 310, end: 620, duration: .24, wave: 'triangle', gain: .16 },
  fusion: { frequency: 420, end: 210, duration: .2, wave: 'sine', gain: .18 },
  unlock: { frequency: 520, end: 780, duration: .28, wave: 'triangle', gain: .13 },
  purchase: { frequency: 260, end: 390, duration: .16, wave: 'square', gain: .08 },
  complete: { frequency: 330, end: 880, duration: .65, wave: 'sine', gain: .18 },
};

export function playSound(effect: SoundEffect, enabled: boolean, volume: number): void {
  if (!enabled || volume <= 0) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const shape = soundShape[effect];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = shape.wave;
    oscillator.frequency.setValueAtTime(shape.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(shape.end, now + shape.duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, shape.gain * volume), now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + shape.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + shape.duration + .02);
  } catch {
    // Audio feedback is optional; gameplay must remain available if Web Audio is blocked.
  }
}
