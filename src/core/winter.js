/** Winter: light fires at night and split the cats between them. */
import { BALANCE } from '../config.js';
import { FIRES } from '../data/village.js';
import { presentCats } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */

/** Fires available to light (the bonfire plus one per rebuilt building). @param {GameState} state */
export const availableFires = (state) => FIRES.filter((f) => !f.needs || state.built[f.needs]);

/** @param {GameState} state @param {string} catId */
export const fireOf = (state, catId) => state.fireAssignments[catId] ?? 'bonfire';

/** Cats assigned to a fire, in village order. @param {GameState} state @param {string} fireId */
export const catsAtFire = (state, fireId) =>
  presentCats(state).filter((cat) => fireOf(state, cat.id) === fireId);

/**
 * @param {GameState} state
 * @param {string} catId
 * @param {string} fireId
 */
export function assignFire(state, catId, fireId) {
  if (!availableFires(state).some((f) => f.id === fireId)) {
    return { ok: false, reason: 'No such fire.' };
  }
  if (catsAtFire(state, fireId).length >= BALANCE.catsPerFire) {
    return {
      ok: false,
      reason: `That fire already has ${BALANCE.catsPerFire} cats. Choose another.`,
    };
  }
  state.fireAssignments[catId] = fireId;
  return { ok: true, reason: '' };
}

/** @param {GameState} state @param {string} fireId */
export function lightFire(state, fireId) {
  if ((state.bag.wood ?? 0) < BALANCE.firewoodPerFire) return false;
  state.bag.wood -= BALANCE.firewoodPerFire;
  state.litFires[fireId] = true;
  return true;
}

/**
 * Is this cat warm through a winter night? Each lit fire warms its first three cats.
 * @param {GameState} state
 * @param {string} catId
 */
export function keptWarmByFire(state, catId) {
  const fireId = fireOf(state, catId);
  if (!state.litFires[fireId]) return false;
  const group = catsAtFire(state, fireId).map((c) => c.id);
  return group.indexOf(catId) < BALANCE.catsPerFire;
}
