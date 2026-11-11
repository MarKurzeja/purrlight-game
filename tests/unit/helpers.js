/** Shared fixtures for unit tests. */
import { createInitialState } from "../../src/core/state.js";
import { createRng } from "../../src/core/random.js";

/** A fresh full-length game with a fixed random seed. */
export function newGame(mode = "full") {
  return createInitialState(mode);
}

export const seeded = (seed = 1) => createRng(seed);

/** An rng that always returns the same value, for forcing a branch. */
export const always = (value) => () => value;

/** Moves the game into a given season (0 spring ... 3 winter). */
export function inSeason(state, season) {
  state.season = season;
  return state;
}
