/** Feeding: the player discovers each cat's hidden tastes by trial and error. */
import { BALANCE } from "../config.js";
import { CAT_BY_ID } from "../data/cats.js";
import { FOODS } from "../data/items.js";
import { addBond, changeWarmth, currentSeason } from "./state.js";

/**
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./state.js').Taste} Taste
 */

/**
 * How a cat feels about a food.
 * @param {string} catId
 * @param {string} food
 * @returns {Taste}
 */
export function tasteOf(catId, food) {
  const cat = CAT_BY_ID[catId];
  if (cat.loves.includes(food)) return "love";
  if (cat.likes.includes(food)) return "like";
  if (cat.hates.includes(food)) return "hate";
  return "meh";
}

/**
 * Warmth a meal would give, before it is eaten.
 * @param {GameState} state
 * @param {string} catId
 * @param {string} food
 */
export function mealWarmth(state, catId, food) {
  let factor = BALANCE.tasteFactor[tasteOf(catId, food)];
  if (currentSeason(state).id === "spring") factor *= BALANCE.springMealBonus;
  if (state.cats[catId].mealsToday >= 1) factor *= BALANCE.secondMealFactor;
  return Math.round(FOODS[food].warmth * factor);
}

/**
 * Puts food in a cat's bowl.
 * @param {GameState} state
 * @param {string} catId
 * @param {string} food
 * @returns {{ ok: false, reason: string } |
 *   { ok: true, taste: Taste, warmth: number, discoveredFavourite: boolean }}
 */
export function feedCat(state, catId, food) {
  const cat = state.cats[catId];
  if (!FOODS[food]) return { ok: false, reason: "That is not food." };
  if ((state.bag[food] ?? 0) <= 0) {
    return { ok: false, reason: "You have none left." };
  }
  if (cat.mealsToday >= BALANCE.mealsPerDay) {
    return { ok: false, reason: `${cat.name} is full for today.` };
  }

  const taste = tasteOf(catId, food);
  const warmth = mealWarmth(state, catId, food);
  const discoveredFavourite = taste === "love" && cat.tastes[food] !== "love";

  state.bag[food] -= 1;
  changeWarmth(cat, warmth);
  addBond(state, catId, BALANCE.tasteBond[taste]);
  cat.tastes[food] = taste;
  cat.mealsToday += 1;

  return { ok: true, taste, warmth, discoveredFavourite };
}
