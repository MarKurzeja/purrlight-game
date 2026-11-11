/** Each cat shows one wish a day. Granting it gives a bonus. */
import { BALANCE } from "../config.js";
import { pickFrom } from "./random.js";
import { addBond, changeWarmth, isWary, presentCats } from "./state.js";

/**
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./state.js').WishKind} WishKind
 * @typedef {import('./random.js').Rng} Rng
 */

export const WISHES = Object.freeze({
  food: { label: "a full bowl" },
  pets: { label: "some pets" },
  play: { label: "a game" },
  sit: { label: "quiet company" },
});

/**
 * A fresh wish for one cat. Wary cats cannot be petted, so they wish for food or company.
 * @param {GameState} state
 * @param {string} catId
 * @param {Rng} rng
 * @returns {WishKind}
 */
export function rollWish(state, catId, rng) {
  return isWary(state, catId)
    ? pickFrom(rng, /** @type {const} */ (["food", "sit", "sit"]))
    : pickFrom(rng, /** @type {const} */ (["food", "pets", "play"]));
}

/** @param {GameState} state @param {Rng} rng */
export function rollWishes(state, rng) {
  for (const cat of presentCats(state))
    state.cats[cat.id].wish = rollWish(state, cat.id, rng);
}

/**
 * Grants a wish if it matches what the cat wanted.
 * @param {GameState} state
 * @param {string} catId
 * @param {WishKind} kind
 * @param {Rng} rng
 * @returns {{ granted: false } | { granted: true, wantsMore: boolean }}
 *   `wantsMore`: the cat will show another wish later today.
 */
export function grantWish(state, catId, kind, rng) {
  const cat = state.cats[catId];
  if (cat.wish !== kind) return { granted: false };
  cat.wish = null;
  changeWarmth(cat, BALANCE.wishWarmth);
  addBond(state, catId, BALANCE.wishBond);
  return { granted: true, wantsMore: rng() < BALANCE.wishRepeatChance };
}
