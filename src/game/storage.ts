import { CLOUD_GROWTH, EMPTY_MATTER, LIMITS, MATTER_KEYS, REACTIONS, REACTION_ORDER, THRESHOLDS } from '../content';
import { compressionHeat, createInitialState, createRunStatistics, tick } from './engine';
import type { CloudTier, GameState, Matter, PerkState, RoundRecord, Stage, StellarOutcome, TutorialState } from './types';

const SAVE_KEY = 'cosmic-clicker-save-v1';
type SavedState = Partial<Omit<GameState, 'version' | 'stage' | 'cloud' | 'star' | 'perks' | 'pendingPerks' | 'history' | 'tutorial'>> & {
  version?: number;
  stage?: Stage | 'stable';
  cloud?: Partial<Matter>;
  star?: Partial<Matter>;
  perks?: Partial<PerkState>;
  pendingPerks?: Partial<PerkState>;
  history?: Partial<RoundRecord>[];
  tutorial?: Partial<TutorialState>;
};

const normalizeMatter = (matter?: Partial<Matter>): Matter => ({ ...EMPTY_MATTER, ...matter });
const matterTotal = (matter: Matter): number => MATTER_KEYS.reduce((sum, key) => sum + matter[key], 0);
const isCloudTier = (value: unknown): value is CloudTier => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Ältere Spielstände kennen keine Wolkenwachstums-Stufe (nur die feste
// 0/1/2-Wolkenstufe oder gar keine). Die Stufe wird aus der ursprünglichen
// Gesamtmasse zurückgerechnet, konsistent mit der Verdopplung pro Perk-Stufe.
const inferCloudTier = (cloud: Matter, star: Matter): CloudTier => {
  const initialMatter = matterTotal(cloud) + matterTotal(star);
  const baseMatter = CLOUD_GROWTH.baseSolarMasses * THRESHOLDS.matterPerSolarMass;
  if (initialMatter <= baseMatter) return 0;
  return Math.max(0, Math.round(Math.log(initialMatter / baseMatter) / Math.log(CLOUD_GROWTH.growthFactorPerLevel)));
};

const normalizeOutcome = (value: unknown, legacyCompleted: boolean): StellarOutcome | null => {
  if (value === 'brownDwarf' || value === 'heliumWhiteDwarf' || value === 'whiteDwarf' || value === 'oxygenNeonWhiteDwarf' || value === 'neutronStar' || value === 'blackHole' || value === 'legacyMainSequence') return value;
  return legacyCompleted ? 'legacyMainSequence' : null;
};

export const normalizeGameState = (value: unknown): GameState | null => {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as SavedState;
  if (![1, 2, 3, 4, 5].includes(parsed.version ?? 0) || !parsed.cloud || !parsed.star) return null;

  const cloud = normalizeMatter(parsed.cloud);
  const star = normalizeMatter(parsed.star);
  const cloudTier = isCloudTier(parsed.cloudTier) ? parsed.cloudTier : inferCloudTier(cloud, star);
  const perks: PerkState = {
    largerCloud: Math.max(0, Math.min(LIMITS.cloudGrowthLevel, parsed.perks?.largerCloud ?? 0)),
    permanentGravity: Math.max(0, Math.min(LIMITS.permanentGravity, parsed.perks?.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(LIMITS.fusionMemory, parsed.perks?.fusionMemory ?? 0)),
  };
  const pendingPerks: PerkState = {
    largerCloud: Math.max(0, Math.min(LIMITS.cloudGrowthLevel - perks.largerCloud, parsed.pendingPerks?.largerCloud ?? 0)),
    permanentGravity: Math.max(0, Math.min(LIMITS.permanentGravity - perks.permanentGravity, parsed.pendingPerks?.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(LIMITS.fusionMemory - perks.fusionMemory, parsed.pendingPerks?.fusionMemory ?? 0)),
  };
  const unlockedTier = Math.min(LIMITS.cloudGrowthLevel, perks.largerCloud + pendingPerks.largerCloud) as CloudTier;
  const nextCloudTier = isCloudTier(parsed.nextCloudTier) && parsed.nextCloudTier <= unlockedTier ? parsed.nextCloudTier : unlockedTier;
  const fallback = createInitialState(perks, parsed.stardust, parsed.run, { cloudTier, nextCloudTier });
  const legacyCompleted = Boolean(parsed.completed);
  const outcome = normalizeOutcome(parsed.outcome, legacyCompleted && parsed.version !== 4);
  const stage: Stage = parsed.stage === 'stable' ? 'mainSequence' : parsed.stage ?? fallback.stage;
  const migratedTutorial: TutorialState = parsed.version === 1
    ? { introSeen: true, cosmosToastPending: false, completed: true, step: 0 }
    : { ...fallback.tutorial, ...parsed.tutorial };
  const stats = { ...createRunStatistics(), ...parsed.stats };
  if (parsed.stats?.hydrogenFused === undefined && typeof parsed.fusedHydrogen === 'number') {
    stats.hydrogenFused = parsed.fusedHydrogen;
  }
  const history = Array.isArray(parsed.history) ? parsed.history.slice(0, 20).map((record): RoundRecord => ({
    ...createRunStatistics(),
    ...record,
    run: record.run ?? 1,
    duration: record.duration ?? 0,
    finalMass: record.finalMass ?? 0,
    cloudTier: isCloudTier(record.cloudTier) ? record.cloudTier : 0,
    outcome: normalizeOutcome(record.outcome, true) ?? 'legacyMainSequence',
  })) : [];
  const discoveredOutcomes: StellarOutcome[] = Array.isArray(parsed.discoveredOutcomes)
    ? parsed.discoveredOutcomes.filter((entry): entry is StellarOutcome => normalizeOutcome(entry, false) !== null)
    : outcome ? [outcome] : [];
  if (outcome && !discoveredOutcomes.includes(outcome)) discoveredOutcomes.push(outcome);
  const unlockedReactions = Array.isArray(parsed.unlockedReactions)
    ? parsed.unlockedReactions.filter((id): id is keyof typeof REACTIONS => id in REACTIONS)
    : REACTION_ORDER.filter((id) => (parsed.temperature ?? fallback.temperature) >= REACTIONS[id].ignitionTemperature);
  const reactionTotals = { ...fallback.reactionTotals, ...parsed.reactionTotals };
  reactionTotals.hydrogen = Math.max(reactionTotals.hydrogen, stats.hydrogenFused);
  reactionTotals.helium = Math.max(reactionTotals.helium, stats.heliumFused);
  reactionTotals.alphaCapture = Math.max(reactionTotals.alphaCapture, stats.oxygenCreated / (Object.values(REACTIONS.alphaCapture.outputs)[0] ?? 1));

  const normalized = {
    ...fallback,
    ...parsed,
    version: 5,
    stage,
    cloudTier,
    nextCloudTier,
    cloud,
    star,
    perks,
    pendingPerks,
    automation: { ...fallback.automation, ...parsed.automation },
    upgrades: { ...fallback.upgrades, ...parsed.upgrades },
    tutorial: migratedTutorial,
    stats,
    contractionHeat: typeof parsed.contractionHeat === 'number' ? parsed.contractionHeat : 0,
    deuteriumIgnitionCompression: typeof parsed.deuteriumIgnitionCompression === 'number'
      ? parsed.deuteriumIgnitionCompression
      : null,
    unlockedReactions,
    reactionTotals,
    automaticReactionTotals: { ...fallback.automaticReactionTotals, ...parsed.automaticReactionTotals },
    history,
    outcome,
    discoveredOutcomes,
    fusedHelium: typeof parsed.fusedHelium === 'number' ? parsed.fusedHelium : 0,
    manualHeliumFusions: typeof parsed.manualHeliumFusions === 'number' ? parsed.manualHeliumFusions : 0,
    volume: Math.max(0, Math.min(1, typeof parsed.volume === 'number' ? parsed.volume : .35)),
    seenOpportunities: Array.isArray(parsed.seenOpportunities) ? parsed.seenOpportunities : [],
    seenObjectives: Array.isArray(parsed.seenObjectives) ? parsed.seenObjectives : [],
    log: Array.isArray(parsed.log) ? parsed.log : fallback.log,
  } as GameState;
  if (normalized.upgrades.deuteriumBurning && normalized.deuteriumIgnitionCompression === null) {
    normalized.deuteriumIgnitionCompression = compressionHeat(normalized);
  }
  return normalized;
};

export const loadGame = (): { state: GameState; offlineSeconds: number } => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: createInitialState(), offlineSeconds: 0 };
    const parsed = normalizeGameState(JSON.parse(raw));
    if (!parsed) return { state: createInitialState(), offlineSeconds: 0 };
    if (!parsed.tutorial.introSeen) return { state: { ...parsed, lastTick: Date.now() }, offlineSeconds: 0 };
    const offlineSeconds = Math.min(LIMITS.offlineSeconds, Math.max(0, (Date.now() - parsed.lastTick) / 1_000));
    const state = tick(parsed, offlineSeconds);
    state.stats.offlineSeconds += offlineSeconds;
    return { state, offlineSeconds };
  } catch {
    return { state: createInitialState(), offlineSeconds: 0 };
  }
};

export const saveGame = (state: GameState): void => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastTick: Date.now() }));
};

export const clearSave = (): void => localStorage.removeItem(SAVE_KEY);
