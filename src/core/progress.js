/** Long-term progress: buildings, the Lantern, memories, and what to aim for next. */
import { BALANCE } from '../config.js';
import { BUILDINGS, LANTERN_PARTS } from '../data/village.js';
import { tierOf } from './bond.js';
import { addBond } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */

/** @param {GameState} state */
export function lanternReady(state) {
  return (
    !state.lanternLit &&
    LANTERN_PARTS.every((part) => state.lantern[part.id]) &&
    state.memoriesRead.length >= BALANCE.memoriesForLantern
  );
}

/**
 * A one-line description of the next long-term goal.
 * @param {GameState} state
 */
export function nextGoal(state) {
  if (state.lanternLit || state.relaxMode) return 'Enjoy the village. No more goals, only cats.';
  const nextBuilding = Object.entries(BUILDINGS)
    .filter(([id]) => !state.built[id])
    .sort(([, a], [, b]) => a.cost - b.cost)[0];
  if (nextBuilding) {
    const [, b] = nextBuilding;
    return state.purrs >= b.cost
      ? `You can rebuild the ${b.name} tonight`
      : `Rebuild the ${b.name}: ${state.purrs} of ${b.cost} Purrs`;
  }
  const part = LANTERN_PARTS.find((p) => !state.lantern[p.id]);
  if (part) {
    return `Repair the Lantern’s ${part.name.toLowerCase()}: ${state.purrs} of ${part.cost} Purrs`;
  }
  if (state.memoriesRead.length < BALANCE.memoriesForLantern) {
    return `Read the cats’ memories in the Library: ${state.memoriesRead.length} of ${BALANCE.memoriesForLantern}`;
  }
  return 'Climb to the Lantern tonight and light it';
}

/**
 * Opens a memory letter. Reading one for the first time deepens the bond.
 * @param {GameState} state
 * @param {string} catId
 * @param {number} index
 * @returns {{ ok: boolean, isNew: boolean }}
 */
export function readMemory(state, catId, index) {
  const cat = state.cats[catId];
  if (!state.built.library || index < 0 || index >= cat.memories) {
    return { ok: false, isNew: false };
  }
  const key = `${catId}:${index}`;
  if (state.memoriesRead.includes(key)) return { ok: true, isNew: false };
  state.memoriesRead.push(key);
  addBond(state, catId, BALANCE.memoryReadBond);
  return { ok: true, isNew: true };
}

/**
 * Bond tiers reached but not yet celebrated. Marks them as seen.
 * @param {GameState} state
 * @param {string[]} catIds
 * @returns {{ catId: string, tier: number }[]}
 */
export function collectTierUps(state, catIds) {
  const ups = [];
  for (const catId of catIds) {
    const cat = state.cats[catId];
    const tier = tierOf(cat.bond);
    if (tier > cat.tierSeen) {
      cat.tierSeen = tier;
      ups.push({ catId, tier });
    }
  }
  return ups;
}
