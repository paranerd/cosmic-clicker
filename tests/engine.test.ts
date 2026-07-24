import { describe, expect, it } from 'vitest';
import { achievementTitleFor, CLOUD_GROWTH, cloudSolarMasses, EMPTY_MATTER, HYDROGEN_TO_HELIUM_RATIO, OBJECTIVES, prestigePerkDescription, REACTIONS, REACTION_ORDER, STAGES, THRESHOLDS, TUTORIAL_STEPS, upgradeCost as calculateLevelValue } from '../src/content';
import type { Stage } from '../src/game/types';
import {
  accretionPerClick,
  accretionPerSecond,
  automationCost,
  automationValueAtLevel,
  calculateTemperature,
  cloudMass,
  createInitialState,
  gravityMultiplier,
  objectiveFor,
  reactionAvailable,
  reactionCapacity,
  reactionManualAmountAtLevel,
  reactionUpgradeCost,
  reduceGame,
  shellWindPerSecond,
  solarMasses,
  starMass,
  structuralHydrogenBurnPerSecond,
  tick,
  upgradeCost,
} from '../src/game/engine';
import type { GameState, Matter, ReactionId } from '../src/game/types';

const accreteUntil = (initial: GameState, targetMass: number, guardLimit = 20_000): GameState => {
  let state = initial;
  let guard = 0;
  while (!state.completed && starMass(state) < targetMass && guard < guardLimit) {
    state = reduceGame(state, { type: 'ACCRETE' });
    guard += 1;
  }
  return state;
};

const reactionState = (reaction: ReactionId, fuel = 1_000): GameState => {
  const state = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
  state.cloud = { ...EMPTY_MATTER };
  state.star = { ...EMPTY_MATTER, iron: 2_000_000 };
  const definition = REACTIONS[reaction];
  Object.entries(definition.inputs).forEach(([key, ratio]) => {
    state.star[key as keyof typeof state.star] = fuel * (ratio ?? 0);
  });
  state.unlockedReactions = [...REACTION_ORDER.slice(0, REACTION_ORDER.indexOf(reaction) + 1)];
  if (reaction === 'alphaCapture' && !state.unlockedReactions.includes('helium')) state.unlockedReactions.push('helium');
  state.temperature = definition.ignitionTemperature;
  state.stage = definition.stageOnUnlock;
  return state;
};

// Realistic primordial composition for an arbitrary target mass, independent
// of any particular cloud-growth level — the structural main-sequence burn
// model (Punkt 6) is calibrated against physical solar masses, not against
// whichever perk level happens to unlock that mass.
const cloudMatterForSolarMasses = (targetSolarMasses: number): Matter => {
  const total = targetSolarMasses * THRESHOLDS.matterPerSolarMass;
  const deuterium = total * CLOUD_GROWTH.deuteriumMassFraction;
  const remaining = total - deuterium;
  const helium = remaining * CLOUD_GROWTH.heliumMassFraction;
  const hydrogen = remaining - helium;
  return { ...EMPTY_MATTER, hydrogen, helium, deuterium };
};

// Punkt 6: a star that just crossed the 15,000-fused-H main-sequence
// milestone with the cloud's full composition already accreted, no residual
// cloud left and no purchased fusion automation — the deterministic floor
// case for structural hydrogen burn and its calibrated duration.
const mainSequenceState = (targetSolarMasses: number): GameState => {
  const state = createInitialState();
  const full = cloudMatterForSolarMasses(targetSolarMasses);
  const fused = THRESHOLDS.mainSequenceHydrogen;
  state.star = {
    ...EMPTY_MATTER,
    hydrogen: full.hydrogen - fused,
    helium: full.helium + fused * HYDROGEN_TO_HELIUM_RATIO,
    deuterium: full.deuterium,
  };
  state.cloud = { ...EMPTY_MATTER };
  state.unlockedReactions = ['hydrogen'];
  state.stage = 'mainSequence';
  state.fusedHydrogen = fused;
  state.reactionTotals.hydrogen = fused;
  state.temperature = THRESHOLDS.hydrogenTemperature;
  return state;
};

const mainSequenceDurationSeconds = (targetSolarMasses: number, guardSeconds = 20 * 60): number => {
  let state = mainSequenceState(targetSolarMasses);
  let seconds = 0;
  while (state.stage === 'mainSequence' && seconds < guardSeconds) {
    state = tick(state, 1);
    seconds += 1;
  }
  return seconds;
};

describe('data-driven stellar engine v0.4', () => {
  it('uses one formula for linear, quadratic and exponential level curves', () => {
    expect([0, 1, 2].map((level) => calculateLevelValue(level, 10, 1.12))).toEqual([
      10,
      11.200000000000001,
      12.544000000000002,
    ]);
    expect([0, 1, 2, 3].map((level) => calculateLevelValue(level, 0, 1, 0, 5))).toEqual([0, 5, 10, 15]);
    expect([0, 1, 2, 3, 4].map((level) => calculateLevelValue(level, 3, 1, .5, .5))).toEqual([3, 4, 6, 9, 13]);
  });

  it('doubles the cloud size with every purchased Wolkenwachstum level from a calibrated 0.07 solar-mass base', () => {
    const small = createInitialState();
    const oneLevelUp = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
    expect(cloudMass(small) / THRESHOLDS.matterPerSolarMass).toBeCloseTo(cloudSolarMasses(0), 5);
    expect(cloudSolarMasses(0)).toBeCloseTo(.07, 5);
    expect(cloudMass(oneLevelUp) / THRESHOLDS.matterPerSolarMass).toBeCloseTo(cloudSolarMasses(1), 5);
    expect(cloudSolarMasses(1)).toBeCloseTo(.14, 5);
    expect(cloudSolarMasses(4)).toBeCloseTo(1.12, 5);
    expect(cloudSolarMasses(9)).toBeCloseTo(35.84, 5);
  });

  it('starts at exactly one ME per impulse and forms a protostar after 2,544 base impulses', () => {
    let state = createInitialState();
    expect(accretionPerClick(state)).toBe(1);
    let clicks = 0;
    while (state.stage === 'nebula') { state = reduceGame(state, { type: 'ACCRETE' }); clicks += 1; }
    expect(state.stage).toBe('protostar');
    expect(state.temperature).toBeGreaterThanOrEqual(THRESHOLDS.protostarTemperature);
    expect(clicks).toBe(THRESHOLDS.protostarMass);
  });

  it('activates deuterium burning without a retroactive temperature jump', () => {
    const state = accreteUntil(createInitialState(), 6_000);
    state.energy = 100;
    const before = state.temperature;
    const upgraded = reduceGame(state, { type: 'BUY_UPGRADE', upgrade: 'deuteriumBurning' });
    expect(upgraded.upgrades.deuteriumBurning).toBe(1);
    expect(upgraded.temperature).toBeCloseTo(before, 5);
    const normalNext = reduceGame(state, { type: 'ACCRETE' });
    const upgradedNext = reduceGame(upgraded, { type: 'ACCRETE' });
    expect(upgradedNext.temperature - upgraded.temperature).toBeGreaterThan(normalNext.temperature - state.temperature);
  });

  it('prevents gravity upgrades after the primordial cloud is exhausted', () => {
    const state = createInitialState();
    state.cloud = { ...EMPTY_MATTER };
    state.star.hydrogen = 20_000;
    state.energy = 1_000;

    const upgraded = reduceGame(state, { type: 'BUY_UPGRADE', upgrade: 'gravity' });
    expect(upgraded.upgrades.gravity).toBe(0);
    expect(upgraded.energy).toBe(1_000);
  });

  it('timestamps new log entries with the current cycle runtime', () => {
    const state = createInitialState();
    state.elapsed = 42.9;
    state.totalElapsed = 142.9;
    state.energy = 100;
    state.star.hydrogen = THRESHOLDS.protostarMass;
    state.cloud.hydrogen -= THRESHOLDS.protostarMass;
    const next = reduceGame(state, { type: 'BUY_ACCRETION' });
    const purchase = next.log.find((entry) => entry.text === 'Akkretionsstrom ausgebaut.');
    expect(purchase).toMatchObject({ run: 1, elapsed: 42.9, totalElapsed: 142.9 });
  });

  it('unlocks the first accretion stream for 25 energy at a slow base rate', () => {
    expect(automationCost('accretion', 0)).toBe(25);
    expect(automationValueAtLevel('accretion', 1)).toBe(1);

    const state = createInitialState();
    state.upgrades.gravity = 3;
    state.automation.accretion = 1;
    expect(accretionPerSecond(state)).toBe(7);
  });

  it('uses the universal configurable curve for all ten gravity prestige levels', () => {
    const state = createInitialState();
    state.upgrades.gravity = 2;
    state.automation.accretion = 1;
    const baseClick = accretionPerClick(state);
    const baseAutomatic = accretionPerSecond(state);

    const expectedPrestigeMultipliers = [
      1,
      2.35,
      3.5256325033403453,
      4.535818771245036,
      5.39133033451593,
      6.105172739443188,
      6.693048882617556,
      7.173918441382695,
      7.570673330163343,
      7.910953246435928,
      8.228130360933495,
    ];
    expectedPrestigeMultipliers.forEach((expected, level) => {
      state.perks.permanentGravity = level;
      expect(gravityMultiplier(state)).toBeCloseTo(5 * expected, 10);
      expect(accretionPerClick(state)).toBeCloseTo(baseClick * expected, 10);
      expect(accretionPerSecond(state)).toBeCloseTo(baseAutomatic * expected, 10);
    });
    expect(prestigePerkDescription('permanentGravity', 0)).toContain('+135% Akkretionsrate');
    expect(prestigePerkDescription('permanentGravity', 1)).toContain('+50% Akkretionsrate');
    expect(prestigePerkDescription('permanentGravity', 10)).toBe('Maximum erreicht.');

    state.perks.permanentGravity = 1;
    state.completed = true;
    state.outcome = 'brownDwarf';
    const nextCycle = reduceGame(state, { type: 'PRESTIGE' });
    expect(nextCycle.perks.permanentGravity).toBe(1);
    expect(accretionPerClick(nextCycle)).toBeCloseTo(2.35, 10);
  });

  it('provides achievement text for every static and generated objective', () => {
    const staticObjectives = Object.keys(OBJECTIVES);
    const ignitionObjectives = REACTION_ORDER
      .filter((reaction) => reaction !== 'hydrogen' && reaction !== 'alphaCapture')
      .map((reaction) => `ignite-${reaction}`);
    const burnObjectives = REACTION_ORDER.map((reaction) => `burn-${reaction}`);

    [...staticObjectives, ...ignitionObjectives, ...burnObjectives].forEach((objectiveId) => {
      expect(achievementTitleFor(objectiveId), `Fehlender Achievement-Text für ${objectiveId}`).toBeTruthy();
    });
  });

  it('ends the 0.07 solar-mass cloud as a rewarded brown dwarf', () => {
    const state = accreteUntil(createInitialState(), cloudMass(createInitialState()));
    expect(state.completed).toBe(true);
    expect(state.outcome).toBe('brownDwarf');
    expect(state.summaryOpen).toBe(false);
    expect(state.stardust).toBe(2);
    expect(state.unlockedReactions).not.toContain('hydrogen');
  });

  it('unlocks hydrogen from temperature and mass rather than cloud tier', () => {
    const state = accreteUntil(createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 }), THRESHOLDS.hydrogenIgnitionMass);
    expect(state.unlockedReactions).toContain('hydrogen');
    expect(state.temperature).toBeGreaterThanOrEqual(THRESHOLDS.hydrogenTemperature);
  });

  it('keeps hydrogen burning available after the main-sequence milestone', () => {
    let state = reactionState('hydrogen', 20_000);
    state.stage = 'hydrogen';
    state.fusedHydrogen = THRESHOLDS.mainSequenceHydrogen - 50;
    state.reactionTotals.hydrogen = state.fusedHydrogen;
    state = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(state.stage).toBe('mainSequence');
    const remaining = state.star.hydrogen;
    state = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(state.star.hydrogen).toBeLessThan(remaining);
    expect(state.reactionTotals.hydrogen).toBeGreaterThan(THRESHOLDS.mainSequenceHydrogen);
  });

  it('allows a final reaction with less fuel than the normal batch', () => {
    const state = reactionState('hydrogen', 37);
    expect(reactionCapacity(state, 'hydrogen')).toBe(37);
    const fused = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(fused.star.hydrogen).toBeCloseTo(0, 5);
    expect(fused.reactionTotals.hydrogen).toBeCloseTo(37, 5);
  });

  it('processes even a tiny positive remainder completely', () => {
    const state = reactionState('hydrogen', .0005);
    expect(reactionAvailable(tick(state, 0), 'hydrogen')).toBe(true);
    const fused = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(fused.star.hydrogen).toBe(0);
    expect(fused.reactionTotals.hydrogen).toBeCloseTo(.0005, 8);
  });

  it.each(REACTION_ORDER)('executes the centrally configured %s reaction', (reaction) => {
    const state = reactionState(reaction);
    const definition = REACTIONS[reaction];
    const output = Object.keys(definition.outputs)[0] as keyof typeof state.star;
    const before = state.star[output];
    const next = reduceGame(state, { type: 'RUN_REACTION', reaction });
    expect(next.reactionTotals[reaction]).toBeGreaterThan(0);
    expect(next.star[output]).toBeGreaterThan(before);
    expect(next.energy).toBeGreaterThan(0);
  });

  it('creates a helium white dwarf below half a solar mass after hydrogen exhaustion', () => {
    const state = reactionState('hydrogen', 0);
    state.star = { ...EMPTY_MATTER, helium: 60_000 };
    state.cloud = { ...EMPTY_MATTER };
    const result = tick(state, 0);
    expect(solarMasses(result)).toBeLessThan(.5);
    expect(result.outcome).toBe('heliumWhiteDwarf');
    expect(result.stardust).toBe(4);
  });

  it('waits for residual cloud hydrogen before contracting or settling', () => {
    const state = reactionState('hydrogen', 0);
    state.star = { ...EMPTY_MATTER, helium: 60_000 };
    state.cloud = { ...EMPTY_MATTER, hydrogen: 5_000 };
    const waiting = tick(state, 1);
    expect(waiting.completed).toBe(false);
    expect(waiting.stage).not.toBe('redGiant');
    waiting.cloud = { ...EMPTY_MATTER };
    const settled = tick(waiting, 0);
    expect(settled.outcome).toBe('heliumWhiteDwarf');
  });

  it('settles a star without any heavier core fuel as a white dwarf', () => {
    const state = reactionState('helium', 0);
    state.unlockedReactions.push('alphaCapture');
    state.star = { ...EMPTY_MATTER };
    const result = tick(state, 0);
    expect(result.completed).toBe(true);
    expect(result.outcome).toBe('whiteDwarf');
  });

  it('contracts a sufficiently massive hydrogen-exhausted star to helium ignition', () => {
    const state = reactionState('hydrogen', 0);
    state.star = { ...EMPTY_MATTER, helium: 150_000 };
    state.cloud = { ...EMPTY_MATTER };
    const giant = tick(state, 1);
    expect(['redGiant', 'helium']).toContain(giant.stage);
    const ignited = tick(giant, 100);
    expect(ignited.unlockedReactions).toContain('helium');
    expect(ignited.unlockedReactions).toContain('alphaCapture');
    expect(ignited.temperature).toBeGreaterThanOrEqual(THRESHOLDS.heliumTemperature);
  });

  it('leaves a carbon-oxygen white dwarf when helium ends below eight solar masses', () => {
    const state = reactionState('helium', 0);
    state.unlockedReactions.push('alphaCapture');
    state.star = { ...EMPTY_MATTER, carbon: 90_000, oxygen: 60_000 };
    const result = tick(state, 0);
    expect(result.outcome).toBe('whiteDwarf');
  });

  it('contracts an eight-solar-mass core into carbon burning', () => {
    const state = reactionState('helium', 0);
    state.unlockedReactions.push('alphaCapture');
    state.star = { ...EMPTY_MATTER, carbon: 1_250_000 };
    state.temperature = THRESHOLDS.heliumTemperature;
    const result = tick(state, 100);
    expect(result.unlockedReactions).toContain('carbon');
    expect(result.temperature).toBeGreaterThanOrEqual(THRESHOLDS.carbonTemperature);
  });

  it('uses final mass to choose the compact remnant after silicon burning', () => {
    const finish = (mass: number) => {
      const state = reactionState('silicon', 40);
      state.star.iron = mass - 40;
      return reduceGame(state, { type: 'RUN_REACTION', reaction: 'silicon' });
    };
    expect(finish(2_000_000).outcome).toBe('neutronStar');
    expect(finish(3_200_000).outcome).toBe('blackHole');
  });

  it('unlocks reaction automation from the matching reaction output', () => {
    let state = reactionState('hydrogen', 10_000);
    state.energy = 10_000;
    state.reactionTotals.hydrogen = 5_100;
    state = reduceGame(state, { type: 'BUY_REACTION_AUTOMATION', reaction: 'hydrogen' });
    expect(state.automation.fusion).toBe(1);
    const automatic = tick(state, 1);
    expect(automatic.automaticReactionTotals.hydrogen).toBeGreaterThan(0);
  });

  it('starts stellar wind at the protostar and removes 0.25 percent per minute', () => {
    const protostar = accreteUntil(createInitialState(), THRESHOLDS.protostarMass);
    const before = cloudMass(protostar);
    const after = tick(protostar, 60);
    expect(after.stats.matterLostToWind).toBeCloseTo(cloudMass(createInitialState()) * .0025, 5);
    expect(cloudMass(after)).toBeCloseTo(before - after.stats.matterLostToWind, 5);
  });

  it('stops accretion heating with an empty cloud but still permits fusion heating', () => {
    const state = reactionState('hydrogen', 60_000);
    state.automation.accretion = 8;
    state.temperature = calculateTemperature(state);
    const passive = tick(state, 10);
    expect(passive.stats.automaticMatterAccreted).toBe(0);
    expect(passive.temperature).toBeLessThanOrEqual(state.temperature);
    const fused = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(fused.temperature).toBeGreaterThan(state.temperature);
  });

  it('scales mature accretion with larger calibrated clouds', () => {
    const small = createInitialState();
    const massive = createInitialState({ largerCloud: 9 }, 0, 3, { cloudTier: 9 });
    massive.unlockedReactions.push('hydrogen');
    expect(accretionPerClick(massive)).toBeGreaterThan(accretionPerClick(small) * 100);
  });

  it('guides every cloud from its first ME through 1 and 3 generated energy before protostar formation', () => {
    const state = createInitialState({ largerCloud: 2 }, 0, 3, { cloudTier: 2 });
    expect(objectiveFor(state)).toMatchObject({
      id: 'collect-first-matter',
      title: 'Sammle 1 ME Materie ein',
      progress: 0,
    });

    const firstMatter = reduceGame(state, { type: 'ACCRETE' });
    expect(starMass(firstMatter)).toBeCloseTo(1, 10);
    expect(objectiveFor(firstMatter)).toMatchObject({ id: 'generate-first-energy' });

    firstMatter.stats.energyGenerated = OBJECTIVES['generate-first-energy'].target;
    firstMatter.energy = OBJECTIVES['generate-first-energy'].target;
    expect(objectiveFor(firstMatter)).toMatchObject({
      id: 'generate-upgrade-energy',
      title: OBJECTIVES['generate-upgrade-energy'].title,
    });

    firstMatter.stats.energyGenerated = OBJECTIVES['generate-upgrade-energy'].target;
    firstMatter.energy = OBJECTIVES['generate-upgrade-energy'].target;
    expect(objectiveFor(firstMatter).id).toBe('form-protostar');
    const upgraded = reduceGame(firstMatter, { type: 'BUY_UPGRADE', upgrade: 'gravity' });
    expect(upgraded.upgrades.gravity).toBe(1);
    expect(upgraded.energy).toBe(0);
    expect(accretionPerClick(upgraded)).toBe(3);
    expect(objectiveFor(upgraded).id).toBe('form-protostar');

    const advanced = tick(upgraded, 24 * 60 * 60);
    expect(advanced.elapsed).toBe(8 * 60 * 60);
    expect(advanced.totalElapsed).toBe(8 * 60 * 60);
  });

  it('gates the energy lesson at 1 energy and prices the first gravity level at 3 energy', () => {
    const tutorialIds = TUTORIAL_STEPS.map((step) => step.id);
    expect(tutorialIds.slice(
      tutorialIds.indexOf('core-composition'),
      tutorialIds.indexOf('first-upgrade') + 1,
    )).toEqual([
      'core-composition',
      'next-objective',
      'objective-progress',
      'accretion-energy',
      'first-upgrade',
    ]);
    expect(TUTORIAL_STEPS.find((step) => step.id === 'accretion-energy')?.availability).toEqual({
      type: 'energy-at-least',
      amount: 1,
    });
    expect([0, 1, 2, 3, 4].map((level) => upgradeCost('gravity', level))).toEqual([3, 8, 19, 47, 117]);
    expect(upgradeCost('gravity', 0)).toBe(OBJECTIVES['generate-upgrade-energy'].target);
  });

  it('frames every active burn phase as building the next core, with real progress (Punkt 7)', () => {
    const state = reactionState('hydrogen', 10_000);
    state.stage = 'mainSequence';
    state.reactionTotals.hydrogen = THRESHOLDS.mainSequenceHydrogen;
    state.fusedHydrogen = THRESHOLDS.mainSequenceHydrogen;
    const before = objectiveFor(state);
    expect(before.id).toBe('burn-hydrogen');
    expect(before.title).toBe(REACTIONS.hydrogen.burnObjective.title);
    expect(before.title).toContain('Heliumkern');
    const halfway = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(objectiveFor(halfway).progress).toBeGreaterThan(before.progress);
    // Kurz vor der Erschöpfung nähert sich der Fortschritt 100 %; ist der
    // Brennstoff ganz aufgebraucht, übernimmt korrekt das Kontraktionsziel.
    const nearlyEmpty = structuredClone(state);
    nearlyEmpty.star.hydrogen = .5;
    nearlyEmpty.star.helium = 5_000;
    expect(objectiveFor(nearlyEmpty).id).toBe('burn-hydrogen');
    expect(objectiveFor(nearlyEmpty).progress).toBeGreaterThan(99.9);
    const empty = structuredClone(state);
    empty.star.hydrogen = 0;
    empty.star.helium = 5_000;
    expect(objectiveFor(empty).id).toBe('ignite-helium');
  });

  it('lets the player expand a reaction so each manual click fuses more (Punkt 2)', () => {
    const state = reactionState('hydrogen', 100_000);
    state.energy = 10_000;
    const baseline = reduceGame(state, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(baseline.reactionTotals.hydrogen).toBeCloseTo(reactionManualAmountAtLevel(state, 'hydrogen', 0), 5);
    const upgraded = reduceGame(state, { type: 'BUY_REACTION_UPGRADE', reaction: 'hydrogen' });
    expect(upgraded.reactionUpgrades.hydrogen).toBe(1);
    expect(upgraded.energy).toBe(10_000 - reactionUpgradeCost('hydrogen', 0));
    expect(upgraded.stats.upgradesPurchased).toBe(1);
    const boosted = reduceGame(upgraded, { type: 'RUN_REACTION', reaction: 'hydrogen' });
    expect(boosted.reactionTotals.hydrogen).toBeCloseTo(reactionManualAmountAtLevel(upgraded, 'hydrogen', 1), 5);
    // Nicht freigeschaltete Reaktionen können nicht ausgebaut werden.
    const locked = reduceGame(state, { type: 'BUY_REACTION_UPGRADE', reaction: 'silicon' });
    expect(locked.reactionUpgrades.silicon).toBe(0);
    expect(locked.energy).toBe(10_000);
    // Die Maximalstufe kommt aus der jeweiligen Reaktionsdefinition.
    const maxed = reactionState('hydrogen', 100_000);
    maxed.energy = 1_000_000;
    maxed.reactionUpgrades.hydrogen = REACTIONS.hydrogen.upgrade.maxLevel;
    const unchanged = reduceGame(maxed, { type: 'BUY_REACTION_UPGRADE', reaction: 'hydrogen' });
    expect(unchanged.reactionUpgrades.hydrogen).toBe(REACTIONS.hydrogen.upgrade.maxLevel);
    expect(unchanged.energy).toBe(1_000_000);
  });

  it('blocks further Akkretionsstrom levels once the primordial cloud is exhausted (Punkt 1)', () => {
    const state = accreteUntil(createInitialState({ largerCloud: 4 }, 0, 2, { cloudTier: 4 }), THRESHOLDS.protostarMass + 500);
    state.energy = 1_000_000;
    const bought = reduceGame(state, { type: 'BUY_ACCRETION' });
    expect(bought.automation.accretion).toBe(1);
    bought.cloud = { ...EMPTY_MATTER };
    bought.energy = 1_000_000;
    const blocked = reduceGame(bought, { type: 'BUY_ACCRETION' });
    expect(blocked.automation.accretion).toBe(1);
    expect(blocked.energy).toBe(1_000_000);
  });

  it('keeps the hydrogen-ignition progress below 100 % until temperature AND mass suffice (Punkt 5)', () => {
    // Die Kompressionswärme deckelt die Temperatur exakt bei 10 Mio. K, kurz
    // bevor die Zündmasse von 12.000 ME erreicht ist. Der Fortschritt darf
    // trotzdem nie 100 % anzeigen, solange die Reaktion nicht freigeschaltet ist.
    const state = accreteUntil(createInitialState({ largerCloud: 4 }, 0, 2, { cloudTier: 4 }), THRESHOLDS.hydrogenIgnitionMass - 150);
    expect(state.temperature).toBe(THRESHOLDS.hydrogenTemperature);
    expect(state.unlockedReactions).not.toContain('hydrogen');
    const objective = objectiveFor(state);
    expect(objective.id).toBe('ignite-hydrogen');
    expect(objective.progress).toBeLessThan(100);
    expect(objective.detail).toContain('ME Sternmasse');
    const ignited = accreteUntil(state, THRESHOLDS.hydrogenIgnitionMass + 200);
    expect(ignited.unlockedReactions).toContain('hydrogen');
  });

  it('archives the calibrated outcome and persistent settings during prestige', () => {
    const state = accreteUntil(createInitialState(), cloudMass(createInitialState()));
    state.volume = .62;
    state.soundEnabled = false;
    state.totalElapsed = 123;
    const next = reduceGame(state, { type: 'PRESTIGE' });
    expect(next.run).toBe(2);
    expect(next.history[0]).toMatchObject({ outcome: 'brownDwarf', cloudTier: 0 });
    expect(next.volume).toBe(.62);
    expect(next.soundEnabled).toBe(false);
    expect(next.totalElapsed).toBe(123);
    expect(next.log[0]).toMatchObject({ run: 2, elapsed: 0, totalElapsed: 123 });
    expect(next.log.slice(1)).toEqual(state.log);
  });

  describe('Punkt 6: zeitbasierte Hauptreihe, massenabhängiger Sternwind, M☉-Anzeige', () => {
    it('burns hydrogen structurally on the main sequence without any purchased automation, keeping mass, energy and stats consistent', () => {
      const state = mainSequenceState(1);
      expect(state.automation.fusion).toBe(0);
      const before = { hydrogen: state.star.hydrogen, helium: state.star.helium, energy: state.energy, reactionTotal: state.reactionTotals.hydrogen };
      const after = tick(state, 10);
      expect(after.automation.fusion).toBe(0);
      expect(after.star.hydrogen).toBeLessThan(before.hydrogen);
      expect(after.star.helium).toBeGreaterThan(before.helium);
      expect(after.energy).toBeGreaterThan(before.energy);
      expect(after.stats.automaticHydrogenFused).toBeGreaterThan(0);
      expect(after.reactionTotals.hydrogen).toBeGreaterThan(before.reactionTotal);
    });

    it('keeps the 1 solar-mass main sequence to roughly five minutes of structural burn', () => {
      const seconds = mainSequenceDurationSeconds(1);
      expect(seconds).toBeGreaterThanOrEqual(240);
      expect(seconds).toBeLessThanOrEqual(420);
    });

    it('runs the 25 solar-mass main sequence three to five times faster than the 1 solar-mass one', () => {
      const factor = mainSequenceDurationSeconds(1) / mainSequenceDurationSeconds(25);
      expect(factor).toBeGreaterThanOrEqual(3);
      expect(factor).toBeLessThanOrEqual(5);
      // per-second structural burn rate itself must scale super-linearly with mass
      // (α > 1) for the compressed 3–5× factor to emerge at all.
      expect(structuralHydrogenBurnPerSecond(mainSequenceState(25))).toBeGreaterThan(structuralHydrogenBurnPerSecond(mainSequenceState(1)) * 3);
    });

    it('keeps the shell wind inactive before the main sequence and only removes H/He afterward', () => {
      const early = reactionState('hydrogen', 1_000);
      expect(early.stage).toBe('hydrogen');
      expect(shellWindPerSecond(early)).toBe(0);

      const main = mainSequenceState(1);
      const mainRate = shellWindPerSecond(main);
      expect(mainRate).toBeGreaterThan(0);

      const late = mainSequenceState(1);
      late.stage = 'redGiant';
      const lateRate = shellWindPerSecond(late);
      expect(lateRate).toBeGreaterThan(mainRate);
    });

    it('never lets the shell wind touch heavier core elements, only the H/He envelope, and only in late stages', () => {
      const lateShellWindStages = (Object.keys(STAGES) as Stage[])
        .filter((stage) => STAGES[stage].shellWindRate === 'lateStageFractionPerMinute');
      expect(lateShellWindStages.length).toBeGreaterThan(0);
      lateShellWindStages.forEach((stage) => {
        const state = mainSequenceState(1);
        state.stage = stage;
        state.star.carbon = 5_000;
        state.star.iron = 8_000;
        const before = { ...state.star };
        const after = tick(state, 60);
        expect(after.star.carbon).toBeCloseTo(before.carbon, 5);
        expect(after.star.iron).toBeCloseTo(before.iron, 5);
        expect(after.star.hydrogen + after.star.helium).toBeLessThan(before.hydrogen + before.helium);
      });
    });

    it('tracks shell-wind loss both in the combined and in a dedicated statistic', () => {
      const state = mainSequenceState(1);
      state.stage = 'redGiant';
      const after = tick(state, 120);
      expect(after.stats.matterLostToShellWind).toBeGreaterThan(0);
      // no residual cloud in this state, so the cloud wind contributes nothing
      // and both counters must agree exactly.
      expect(after.stats.matterLostToWind).toBeCloseTo(after.stats.matterLostToShellWind, 5);
    });

    it('lets extended shell-wind exposure during a slow late burn tip a marginal iron core from black hole to neutron star', () => {
      const buildState = (): GameState => {
        const state = reactionState('silicon', 40);
        state.star.hydrogen = 150_000;
        state.star.helium = 50_000;
        state.star.iron = 2_849_960;
        return state;
      };
      expect(starMass(buildState())).toBeCloseTo(3_050_000, 0);

      const immediate = reduceGame(buildState(), { type: 'RUN_REACTION', reaction: 'silicon' });
      expect(immediate.outcome).toBe('blackHole');

      const afterLongWait = tick(buildState(), 3_000);
      const settled = reduceGame(afterLongWait, { type: 'RUN_REACTION', reaction: 'silicon' });
      expect(settled.outcome).toBe('neutronStar');
      expect(starMass(settled)).toBeLessThan(THRESHOLDS.blackHoleMass);
    });

    it('shows the calibrated M☉ scale for the star mass and mentions M☉ at contraction thresholds', () => {
      const stellar = createInitialState({ largerCloud: 1 }, 0, 2, { cloudTier: 1 });
      expect(solarMasses(stellar)).toBeCloseTo(0, 5);
      const full = { ...EMPTY_MATTER, hydrogen: THRESHOLDS.matterPerSolarMass };
      const oneSolarMass = { ...stellar, star: full };
      expect(solarMasses(oneSolarMass)).toBeCloseTo(1, 5);

      const contracting = reactionState('hydrogen', 0);
      contracting.star = { ...EMPTY_MATTER, helium: 150_000 };
      contracting.cloud = { ...EMPTY_MATTER };
      expect(objectiveFor(contracting).detail).toContain('M☉');
    });
  });
});
