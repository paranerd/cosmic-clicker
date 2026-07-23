import { OUTCOMES, OUTCOME_LABELS, PRESTIGE_PERKS } from '../content';
import { cloudDefinition, cloudTierCost, effectivePerks, fusionPerkCost, gravityPerkCost, starMass } from '../game/engine';
import { setDebugOpen, syncDebug } from './debug';
import { disabled, formatDuration, formatMatter, formatSolarMasses, icons } from './format';
import { clearPrestigeConfirmation, closeResetMenu, setPerksOpen, setSoundMenuOpen } from './menus';
import { clearAchievements, clearToasts } from './notifications';
import { app, getState } from './store';
import { evolutionMapMarkup, historyMarkup, logMarkup, statsEntries, statsGridMarkup, timelineMarkup } from './views';
import { invalidateTutorial } from './tutorial';

let chronicleOpen = false;
let statsOpen = false;
let overlaySignature = '';
let summaryAttentionRun = 0;

export const invalidateOverlay = (): void => { overlaySignature = ''; };
export const resetSummaryAttention = (): void => { summaryAttentionRun = 0; };

export function setChronicleOpen(open: boolean): void {
  chronicleOpen = open;
  if (open) statsOpen = false;
  invalidateOverlay();
  syncOverlay();
}

export function setStatsOpen(open: boolean): void {
  statsOpen = open;
  if (open) chronicleOpen = false;
  invalidateOverlay();
  syncOverlay();
}

function syncLiveStats(root: HTMLElement): void {
  statsEntries().forEach(([key, , value]) => {
    const element = root.querySelector<HTMLElement>(`[data-live-stat="${key}"]`);
    if (element && element.textContent !== value) element.textContent = value;
  });
}

export function syncOverlay(): void {
  const state = getState();
  const root = app.querySelector<HTMLElement>('[data-ui="overlay-root"]');
  if (!root) return;
  const introNeedsDecision = !state.tutorial.introSeen;
  if (!state.summaryOpen && !chronicleOpen && !statsOpen && !introNeedsDecision) { if (root.innerHTML) root.innerHTML = ''; overlaySignature = ''; return; }
  if (introNeedsDecision) {
    if (overlaySignature === 'intro') return;
    overlaySignature = 'intro';
    root.innerHTML = `<div class="modal-backdrop intro-backdrop"><section class="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-description"><div class="intro-brand"><span>COSMIC</span><b>CLICKER</b></div><small>DEIN KOSMISCHES EXPERIMENT</small><span class="intro-star">${icons.spark}</span><h2 id="intro-title">Entdecke das Schicksal der Sterne.</h2><p id="intro-description">Beginne mit einer kleinen Wolke aus kaltem Wasserstoff. Sammle Materie, forme einen Protostern und beobachte, welchen Entwicklungsweg die Physik ermöglicht.</p><div class="intro-pillars"><div><b>01</b><span>Materie sammeln</span><small>Forme aus der Urwolke einen Protostern.</small></div><div><b>02</b><span>Sternentwicklung verfolgen</span><small>Masse und Temperatur bestimmen den möglichen Lebensweg.</small></div><div><b>03</b><span>Kosmos erweitern</span><small>Nutze Sternenstaub für größere Wolken.</small></div></div><div class="intro-actions"><button class="primary-action" data-action="start-intro-tutorial" aria-label="Tutorial starten"><span>Tutorial starten</span><small>Kurze geführte Tour</small></button><button class="intro-secondary" data-action="skip-intro-tutorial">Ohne Tutorial starten</button></div></section></div>`;
    return;
  }
  if (chronicleOpen && !state.summaryOpen) {
    const chronicleSignature = `chronicle:${state.stage}:${state.log.map((entry) => entry.id).join(',')}`;
    if (chronicleSignature === overlaySignature) return;
    overlaySignature = chronicleSignature;
    root.innerHTML = `<div class="modal-backdrop" data-overlay-dismiss="chronicle" role="presentation"><section class="chronicle-modal" role="dialog" aria-modal="true" aria-labelledby="chronicle-title"><div class="chronicle-modal-heading"><div><small>KOSMISCHE CHRONIK</small><h2 id="chronicle-title">Lebenswege der Sterne</h2></div><button data-action="close-chronicle" aria-label="Chronik schließen">×</button></div><div class="chronicle-layout"><div class="timeline-card"><div class="section-label"><span>Aktueller Entwicklungspfad</span><small>${cloudDefinition(state.cloudTier).name}</small></div><div class="timeline">${timelineMarkup()}</div>${evolutionMapMarkup()}</div><div class="log-card"><div class="section-label"><span>Sternenlogbuch</span><small>ALLE ZYKLEN</small></div><div class="log-list">${logMarkup()}</div></div></div></section></div>`;
    return;
  }
  if (statsOpen && !state.summaryOpen) {
    const statsSignature = `stats:${state.run}:${state.history.length}`;
    if (statsSignature !== overlaySignature) {
      overlaySignature = statsSignature;
      root.innerHTML = `<div class="modal-backdrop" data-overlay-dismiss="stats" role="presentation"><section class="stats-modal" role="dialog" aria-modal="true" aria-labelledby="stats-title"><div class="chronicle-modal-heading"><div><small>RUNDENANALYSE</small><h2 id="stats-title">Statistik · Zyklus ${state.run.toString().padStart(2, '0')}</h2></div><button data-action="close-stats" aria-label="Statistik schließen">×</button></div><div class="stats-modal-body"><div class="run-stat-grid">${statsGridMarkup(true)}</div><div class="round-history"><div class="section-label"><span>Vergangene Runden</span><small>${state.history.length} ARCHIVIERT</small></div>${historyMarkup()}</div></div></section></div>`;
    }
    syncLiveStats(root);
    return;
  }
  const signature = `summary:${state.stardust}:${state.perks.largerCloud}:${state.perks.permanentGravity}:${state.perks.fusionMemory}:${state.pendingPerks.largerCloud}:${state.pendingPerks.permanentGravity}:${state.pendingPerks.fusionMemory}:${state.nextCloudTier}:${state.outcome}`;
  if (signature === overlaySignature) return;
  const previousSummary = root.querySelector<HTMLElement>('.summary-modal');
  const previousSummaryScroll = previousSummary?.scrollTop ?? 0;
  const previousPageScroll = window.scrollY;
  const previousAction = previousSummary?.contains(document.activeElement)
    ? (document.activeElement as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
    : undefined;
  overlaySignature = signature;
  const previewPerks = effectivePerks(state);
  const cloudCost = cloudTierCost(previewPerks.largerCloud);
  const gravityCostValue = gravityPerkCost(previewPerks.permanentGravity);
  const fusionCostValue = fusionPerkCost(previewPerks.fusionMemory);
  const cloudMax = previewPerks.largerCloud >= PRESTIGE_PERKS.largerCloud.maxLevel;
  const gravityMax = previewPerks.permanentGravity >= PRESTIGE_PERKS.permanentGravity.maxLevel;
  const fusionMax = previewPerks.fusionMemory >= PRESTIGE_PERKS.fusionMemory.maxLevel;
  const showPerkAttention = summaryAttentionRun !== state.run;
  const cloudAttention = showPerkAttention && !cloudMax && state.stardust >= cloudCost ? 'perk-attention' : '';
  const gravityAttention = showPerkAttention && !gravityMax && state.stardust >= gravityCostValue ? 'perk-attention' : '';
  const fusionAttention = showPerkAttention && !fusionMax && state.stardust >= fusionCostValue ? 'perk-attention' : '';
  const outcome = state.outcome ?? 'legacyMainSequence';
  const outcomeCopy = OUTCOMES[outcome];
  const unlockedCloudLevel = previewPerks.largerCloud;
  const selectedCloudLevel = Math.min(state.nextCloudTier, unlockedCloudLevel);
  const selectedCloudDefinition = cloudDefinition(selectedCloudLevel);
  const cloudSlider = unlockedCloudLevel > 0
    ? `<div class="cloud-slider"><input type="range" min="0" max="${unlockedCloudLevel}" step="1" value="${selectedCloudLevel}" data-action="select-cloud-level" aria-label="Wolkenmasse wählen"><div class="cloud-slider-scale"><span>${cloudDefinition(0).shortName}</span><span>${cloudDefinition(unlockedCloudLevel).shortName}</span></div></div>`
    : '';
  const cloudSelector = `${cloudSlider}<p class="cloud-slider-summary"><b>${selectedCloudDefinition.name}</b> · ≈ ${formatSolarMasses(selectedCloudDefinition.solarMasses)} · voraussichtlich ${selectedCloudDefinition.expectedOutcome}</p>`;
  const perkControls = (kind: 'cloud' | 'gravity' | 'fusion', label: string, pending: number, max: boolean, cost: number): string => `<div class="summary-perk-controls"><button class="perk-remove" data-action="remove-perk-${kind}" aria-label="${label} abwählen" ${disabled(pending <= 0)}>−</button><button data-action="buy-perk-${kind}" ${disabled(max || state.stardust < cost)}>${max ? 'MAX' : `+${cost} ✦`}</button></div>`;
  root.innerHTML = `<div class="modal-backdrop" role="presentation">
    <section class="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div class="summary-heading"><span class="modal-star">${icons.spark}</span><div><small>ZYKLUS ${state.run.toString().padStart(2, '0')} · ${OUTCOME_LABELS[outcome]}</small><h2 id="summary-title">${outcomeCopy.title}</h2><p>${outcomeCopy.description}</p></div></div>
      <div class="summary-stats"><div><span>Endmasse</span><b>${formatMatter(starMass(state))} ME</b></div><div><span>Rundendauer</span><b>${formatDuration(state.elapsed)}</b></div><div><span>Sternenstaub erhalten</span><b>+${state.stats.stardustEarned} ✦</b></div></div>
      <div class="summary-detail"><div class="summary-section-title"><span>Rundenauswertung</span><small>ZYKLUS ${state.run.toString().padStart(2, '0')}</small></div><div class="run-stat-grid compact">${statsGridMarkup()}</div></div>
      <div class="summary-legacy"><div class="summary-section-title"><span>Vermächtnis wählen</span><small>DAUERHAFTE EFFEKTE</small></div>
        <div class="summary-perk-grid">
          <article class="${cloudAttention} ${state.pendingPerks.largerCloud ? 'has-selection' : ''}"><span class="perk-orbit">01</span><div><h3>${PRESTIGE_PERKS.largerCloud.title}</h3><p>${PRESTIGE_PERKS.largerCloud.description}</p><strong>Stufe ${previewPerks.largerCloud}${state.pendingPerks.largerCloud ? ` · +${state.pendingPerks.largerCloud} gewählt` : ''}</strong></div>${perkControls('cloud', PRESTIGE_PERKS.largerCloud.title, state.pendingPerks.largerCloud, cloudMax, cloudCost)}</article>
          <article class="${gravityAttention} ${state.pendingPerks.permanentGravity ? 'has-selection' : ''}"><span class="perk-orbit">02</span><div><h3>${PRESTIGE_PERKS.permanentGravity.title}</h3><p>${PRESTIGE_PERKS.permanentGravity.description}</p><strong>Stufe ${previewPerks.permanentGravity}${state.pendingPerks.permanentGravity ? ` · +${state.pendingPerks.permanentGravity} gewählt` : ''}</strong></div>${perkControls('gravity', PRESTIGE_PERKS.permanentGravity.title, state.pendingPerks.permanentGravity, gravityMax, gravityCostValue)}</article>
          <article class="${fusionAttention} ${state.pendingPerks.fusionMemory ? 'has-selection' : ''}"><span class="perk-orbit">03</span><div><h3>${PRESTIGE_PERKS.fusionMemory.title}</h3><p>${PRESTIGE_PERKS.fusionMemory.description}</p><strong>Stufe ${previewPerks.fusionMemory}${state.pendingPerks.fusionMemory ? ` · +${state.pendingPerks.fusionMemory} gewählt` : ''}</strong></div>${perkControls('fusion', PRESTIGE_PERKS.fusionMemory.title, state.pendingPerks.fusionMemory, fusionMax, fusionCostValue)}</article>
        </div>
        <div class="cloud-selection"><div class="summary-section-title"><span>Nächste Urwolke</span><small>${cloudDefinition(state.nextCloudTier).description}</small></div>${cloudSelector}</div>
      </div>
      <div class="summary-actions"><button class="primary-action" data-action="prestige">Neuen Zyklus starten</button><button class="text-action" data-action="close-summary">Später entscheiden</button></div>
    </section>
  </div>`;
  if (previousSummary) {
    const restoredSummary = root.querySelector<HTMLElement>('.summary-modal');
    const restoreScrollPosition = () => {
      if (!restoredSummary?.isConnected) return;
      restoredSummary.scrollTop = previousSummaryScroll;
      window.scrollTo(window.scrollX, previousPageScroll);
    };
    restoreScrollPosition();
    if (previousAction) root.querySelector<HTMLElement>(`[data-action="${previousAction}"]`)?.focus({ preventScroll: true });
    window.requestAnimationFrame(restoreScrollPosition);
  }
  summaryAttentionRun = state.run;
}

export function makeSummaryExclusive(): void {
  chronicleOpen = false;
  statsOpen = false;
  setDebugOpen(false);
  overlaySignature = '';
  invalidateTutorial();
  clearAchievements();
  clearToasts();
  clearPrestigeConfirmation();
  closeResetMenu();
  setPerksOpen(false);
  setSoundMenuOpen(false);
  syncDebug();
}
