/** The autumn mini-hunt: flush mice out of rustling leaf piles. */
import { CAT_BY_ID } from "../data/cats.js";
import { addToBag, changeWarmth, isWary, presentCats } from "./state.js";

/** @typedef {import('./state.js').GameState} GameState */

/**
 * Rewards for a finished hunt. Every cat enjoys the chase; hunters twice as much,
 * and even wary hunters join in.
 * @param {GameState} state
 * @param {number} mice
 * @returns {{ fish: string | null }}
 */
export function huntReward(state, mice) {
  const fish = mice >= 7 ? "trout" : "sardine";
  const caught = mice >= 3;
  if (caught) addToBag(state, fish);
  if (mice >= 5) addToBag(state, "herb", 2);
  const thrill = Math.min(4 + mice, 10);
  for (const c of presentCats(state)) {
    const hunter = CAT_BY_ID[c.id].personality === "hunter";
    if (!isWary(state, c.id) || hunter)
      changeWarmth(state.cats[c.id], thrill * (hunter ? 2 : 1));
  }
  return { fish: caught ? fish : null };
}
