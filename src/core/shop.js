/** Night-time spending: buildings, upgrades, baking, planting and the market. */
import { BALANCE } from "../config.js";
import { HATS, RECIPES, RODS } from "../data/items.js";
import { BUILDINGS, DECOR, LANTERN_PARTS, NOOKS } from "../data/village.js";
import { addToBag } from "./state.js";

/**
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {{ ok: true } | { ok: false, reason: string }} Purchase
 */

const OK = /** @type {const} */ ({ ok: true });
/** @param {string} reason @returns {Purchase} */
const fail = (reason) => ({ ok: false, reason });

/**
 * Deducts Purrs if the player can afford it.
 * @param {GameState} state
 * @param {number} cost
 * @returns {Purchase}
 */
function pay(state, cost) {
  if (state.purrs < cost) {
    return fail(`You need ${cost - state.purrs} more Purrs.`);
  }
  state.purrs -= cost;
  return OK;
}

/** @param {GameState} state @param {string} id @returns {Purchase} */
export function buildBuilding(state, id) {
  const building = BUILDINGS[/** @type {keyof typeof BUILDINGS} */ (id)];
  if (!building) return fail("Unknown building.");
  if (state.built[id]) return fail("Already rebuilt.");
  const paid = pay(state, building.cost);
  if (paid.ok) state.built[id] = true;
  return paid;
}

/** @param {GameState} state @returns {Purchase} */
export function buildNook(state) {
  if (state.nooks >= NOOKS.length) return fail("Every nook is built.");
  const paid = pay(state, BALANCE.nookCost);
  if (paid.ok) state.nooks += 1;
  return paid;
}

/** Rods must be bought in order. @param {GameState} state @param {number} level @returns {Purchase} */
export function buyRod(state, level) {
  const rod = RODS[level];
  if (!rod || level <= state.rod) return fail("You already have this rod.");
  if (level !== state.rod + 1) return fail("Buy the rod before it first.");
  const paid = pay(state, rod.cost);
  if (paid.ok) state.rod = level;
  return paid;
}

/** @param {GameState} state @param {string} partId @returns {Purchase} */
export function repairLantern(state, partId) {
  const part = LANTERN_PARTS.find((p) => p.id === partId);
  if (!part) return fail("Unknown repair.");
  if (state.lantern[partId]) return fail("Already repaired.");
  const paid = pay(state, part.cost);
  if (paid.ok) state.lantern[partId] = true;
  return paid;
}

/** @param {GameState} state @param {string} hat @returns {Purchase} */
export function buyHat(state, hat) {
  const item = HATS[/** @type {keyof typeof HATS} */ (hat)];
  if (!item || item.cost <= 0) return fail("That hat is not for sale.");
  if (state.hats.includes(hat)) return fail("You already own it.");
  const paid = pay(state, item.cost);
  if (paid.ok) state.hats.push(hat);
  return paid;
}

/** @param {GameState} state @param {string} id @returns {Purchase} */
export function buyDecor(state, id) {
  const item = DECOR.find((d) => d.id === id);
  if (!item) return fail("Unknown item.");
  if (state.decor.includes(id)) return fail("Already placed.");
  const paid = pay(state, item.cost);
  if (paid.ok) state.decor.push(id);
  return paid;
}

/** @param {GameState} state @param {number} recipeIndex */
export function canBake(state, recipeIndex) {
  const recipe = RECIPES[recipeIndex];
  return (
    !!recipe &&
    Object.entries(recipe.ingredients).every(
      ([item, n]) => (state.bag[item] ?? 0) >= n,
    )
  );
}

/** @param {GameState} state @param {number} recipeIndex @returns {Purchase} */
export function bake(state, recipeIndex) {
  if (!state.built.bakery) return fail("The bakery is not rebuilt yet.");
  if (!canBake(state, recipeIndex)) return fail("Missing ingredients.");
  const recipe = RECIPES[recipeIndex];
  for (const [item, n] of Object.entries(recipe.ingredients)) {
    state.bag[item] -= n;
  }
  addToBag(state, recipe.output);
  return OK;
}

/** Days from planting until catnip is ready. */
export const CATNIP_GROW_DAYS = 2;

/** @param {GameState} state @param {number} plot @returns {Purchase} */
export function plantHerb(state, plot) {
  if (!state.built.greenhouse) {
    return fail("The greenhouse is not rebuilt yet.");
  }
  if (state.plots[plot] !== 0) {
    return fail("Something is already growing there.");
  }
  if ((state.bag.herb ?? 0) <= 0) return fail("You need wild herbs to plant.");
  state.bag.herb -= 1;
  state.plots[plot] = state.day;
  return OK;
}
