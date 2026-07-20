import { EMPTY_MATTER, LIMITS, MATTER_KEYS } from '../content';
import { createInitialState, createRunStatistics, tick } from './engine';
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
const isCloudTier = (value: unknown): value is CloudTier => value === 0 || value === 1 || value === 2;

const inferCloudTier = (cloud: Matter, star: Matter): CloudTier => {
  const initialMatter = matterTotal(cloud) + matterTotal(star);
  if (initialMatter <= 20_000) return 0;
  if (initialMatter <= 100_000) return 1;
  return 2;
};

const normalizeOutcome = (value: unknown, legacyCompleted: boolean): StellarOutcome | null => {
  if (value === 'brownDwarf' || value === 'whiteDwarf' || value === 'neutronStar' || value === 'blackHole' || value === 'legacyMainSequence') return value;
  return legacyCompleted ? 'legacyMainSequence' : null;
};

export const normalizeGameState = (value: unknown): GameState | null => {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as SavedState;
  if (![1, 2, 3, 4].includes(parsed.version ?? 0) || !parsed.cloud || !parsed.star) return null;

  const cloud = normalizeMatter(parsed.cloud);
  const star = normalizeMatter(parsed.star);
  const cloudTier = isCloudTier(parsed.cloudTier) ? parsed.cloudTier : inferCloudTier(cloud, star);
  const perks: PerkState = {
    largerCloud: Math.max(0, Math.min(LIMITS.cloudTier, parsed.perks?.largerCloud ?? 0)),
    permanentGravity: Math.max(0, Math.min(LIMITS.permanentGravity, parsed.perks?.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(LIMITS.fusionMemory, parsed.perks?.fusionMemory ?? 0)),
  };
  const pendingPerks: PerkState = {
    largerCloud: Math.max(0, Math.min(LIMITS.cloudTier - perks.largerCloud, parsed.pendingPerks?.largerCloud ?? 0)),
    permanentGravity: Math.max(0, Math.min(LIMITS.permanentGravity - perks.permanentGravity, parsed.pendingPerks?.permanentGravity ?? 0)),
    fusionMemory: Math.max(0, Math.min(LIMITS.fusionMemory - perks.fusionMemory, parsed.pendingPerks?.fusionMemory ?? 0)),
  };
  const unlockedTier = Math.min(LIMITS.cloudTier, perks.largerCloud + pendingPerks.largerCloud) as CloudTier;
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
    cloudTier: isCloudTier(record.cloudTier) ? record.cloudTier : 1,
    outcome: normalizeOutcome(record.outcome, true) ?? 'legacyMainSequence',
  })) : [];
  const discoveredOutcomes: StellarOutcome[] = Array.isArray(parsed.discoveredOutcomes)
    ? parsed.discoveredOutcomes.filter((entry): entry is StellarOutcome => normalizeOutcome(entry, false) !== null)
    : outcome ? [outcome] : [];
  if (outcome && !discoveredOutcomes.includes(outcome)) discoveredOutcomes.push(outcome);

  return {
    ...fallback,
    ...parsed,
    version: 4,
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
