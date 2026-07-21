import { cloudMassForLevel, MATTER_KEYS, STAGE_LABELS, THRESHOLDS } from '../content';
import { cloudDefinition, cloudMass, createInitialState, starMass, tick } from '../game/engine';
import { saveGame } from '../game/storage';
import { formatCompact, formatMatter, formatNumber, formatTemperature } from './format';
import { app, getState, setState } from './store';
import { updateUI } from './sync';

let debugOpen = false;
let debugSignature = '';

// Feste Schnellzugriffs-Stufen für den Dev-Debug-Modus. Wolkenwachstum selbst
// ist jetzt offen und stufenlos, aber ein paar kalibrierte Vorschläge
// erleichtern das Balance-Testen (klein/stellar/massereich).
const DEBUG_CLOUD_LEVELS: Record<string, number> = { small: 0, stellar: 4, massive: 9 };

export function isDebugOpen(): boolean {
  return debugOpen;
}

export function setDebugOpen(open: boolean): void {
  debugOpen = open;
}

function moveDebugMatter(targetMass: number): void {
  const state = getState();
  const current = starMass(state);
  const available = cloudMass(state);
  const amount = Math.min(Math.max(0, targetMass - current), available);
  if (amount <= 0) return;
  const ratio = amount / available;
  MATTER_KEYS.forEach((key) => {
    const moved = state.cloud[key] * ratio;
    state.cloud[key] -= moved;
    state.star[key] += moved;
  });
  state.stats.matterAccreted += amount;
  setState(tick(state, 0));
}

export function runDebugAction(action: string): void {
  if (!import.meta.hot) return;
  if (action === 'close') { debugOpen = false; syncDebug(); return; }
  if (action.startsWith('cloud-')) {
    const state = getState();
    const key = action.slice('cloud-'.length);
    const tier = DEBUG_CLOUD_LEVELS[key] ?? 0;
    const perks = { ...state.perks, largerCloud: Math.max(state.perks.largerCloud, tier) };
    setState(createInitialState(perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: tier, nextCloudTier: tier, discoveredOutcomes: state.discoveredOutcomes }));
  }
  if (action === 'energy') getState().energy += 2_000;
  if (action === 'protostar') moveDebugMatter(THRESHOLDS.protostarMass);
  if (action === 'deuterium') moveDebugMatter(8_000);
  if (action === 'hydrogen') { moveDebugMatter(34_000); const state = getState(); state.energy = Math.max(state.energy, 1_000); setState(tick(state, 0)); }
  if (action === 'fusion-ready') { moveDebugMatter(THRESHOLDS.hydrogenIgnitionMass); const state = getState(); state.reactionTotals.hydrogen = 5_100; state.energy = Math.max(state.energy, 2_000); setState(tick(state, 0)); }
  if (action === 'main' || action === 'helium' || action === 'oxygen' || action === 'complete') {
    const tooSmallForIgnition = cloudMassForLevel(getState().cloudTier) < THRESHOLDS.hydrogenIgnitionMass;
    if (tooSmallForIgnition && action !== 'complete') {
      const state = getState();
      const stellarLevel = Math.max(DEBUG_CLOUD_LEVELS.stellar, state.perks.largerCloud);
      setState(createInitialState({ ...state.perks, largerCloud: stellarLevel }, state.stardust, Math.max(2, state.run), { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: stellarLevel, nextCloudTier: stellarLevel, discoveredOutcomes: state.discoveredOutcomes }));
    }
    if (cloudMassForLevel(getState().cloudTier) < THRESHOLDS.hydrogenIgnitionMass) {
      moveDebugMatter(cloudMass(getState()));
      setState(tick(getState(), 1));
    } else {
      moveDebugMatter(action === 'main' ? THRESHOLDS.hydrogenIgnitionMass : THRESHOLDS.heliumIgnitionMass);
      const state = getState();
      state.energy = Math.max(state.energy, 10_000);
      state.temperature = action === 'main' ? THRESHOLDS.hydrogenTemperature : THRESHOLDS.heliumTemperature;
      state.unlockedReactions = action === 'main' ? ['hydrogen'] : ['hydrogen', 'helium', 'alphaCapture'];
      state.stage = action === 'main' ? 'mainSequence' : 'helium';
      if (action === 'oxygen') state.star.carbon = Math.max(state.star.carbon, 5_000);
      if (action === 'complete') {
        state.star.hydrogen = 0;
        state.star.helium = 0;
        MATTER_KEYS.forEach((key) => { state.cloud[key] = 0; });
        setState(tick(state, 1));
      }
    }
  }
  if (action === 'fresh') { const state = getState(); setState(createInitialState(state.perks, state.stardust, state.run, { soundEnabled: state.soundEnabled, volume: state.volume, tutorial: { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }, history: state.history, cloudTier: state.cloudTier, nextCloudTier: state.nextCloudTier, discoveredOutcomes: state.discoveredOutcomes })); }
  saveGame(getState());
  updateUI(true);
  syncDebug();
}

export function syncDebug(): void {
  if (!import.meta.hot) return;
  const root = app.querySelector<HTMLElement>('[data-ui="debug-root"]');
  if (!root) return;
  if (!debugOpen) { if (root.innerHTML) root.innerHTML = ''; debugSignature = 'closed'; return; }
  const state = getState();
  const signature = `${state.stage}:${Math.round(starMass(state))}:${Math.round(state.temperature)}:${Math.round(state.energy)}:${state.stats.manualClicks + state.stats.manualFusionActions + state.stats.deuteriumBurns}`;
  if (signature === debugSignature) return;
  debugSignature = signature;
  root.innerHTML = `<aside class="debug-panel" aria-label="Debug- und Balance-Modus"><div><span>DEV · BALANCE</span><button data-debug="close" aria-label="Debug-Modus schließen">×</button></div><dl><div><dt>Stufe</dt><dd>${STAGE_LABELS[state.stage]}</dd></div><div><dt>Wolke</dt><dd>${cloudDefinition(state.cloudTier).shortName}</dd></div><div><dt>Masse</dt><dd>${formatMatter(starMass(state))} ME</dd></div><div><dt>Temperatur</dt><dd>${formatTemperature(state.temperature)}</dd></div><div><dt>Energie</dt><dd>${formatCompact(state.energy)}</dd></div><div><dt>Aktionen</dt><dd>${formatNumber(state.stats.manualClicks + state.stats.manualFusionActions + state.stats.manualHeliumActions)}</dd></div></dl><div class="debug-actions"><button data-debug="cloud-small">Kleine Wolke</button><button data-debug="cloud-stellar">Stellare Wolke</button><button data-debug="cloud-massive">Massereiche Wolke</button><button data-debug="energy">+2.000 Energie</button><button data-debug="protostar">Protostern</button><button data-debug="hydrogen">H-Brennen</button><button data-debug="main">Hauptreihe</button><button data-debug="helium">He-Brennen</button><button data-debug="oxygen">C/O-Kern</button><button data-debug="complete">Runde abschließen</button><button data-debug="fresh">Runde zurücksetzen</button></div><p>Die aktuellen Brenn- und Endzustände lassen sich im Dev-Server simulieren.</p></aside>`;
}
