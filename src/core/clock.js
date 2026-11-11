/**
 * Time of day. Each phase has a clock from 0 to 1 that runs in real time and also advances
 * when the player does something.
 */
import { DAWN_SECONDS, DAY_SECONDS } from "../config.js";
import { changeWarmth, currentSeason, presentCats } from "./state.js";

/** @typedef {import('./state.js').GameState} GameState */

/** @param {GameState} state */
function phaseSeconds(state) {
  return state.phase === "dawn" ? DAWN_SECONDS : DAY_SECONDS;
}

/**
 * Moves the clock forward. Only dawn and day are timed; relax mode has no clock.
 * @param {GameState} state
 * @param {number} seconds
 * @returns {boolean} true once the phase has run out of time.
 */
export function advanceClock(state, seconds) {
  if (state.relaxMode || (state.phase !== "dawn" && state.phase !== "day"))
    return false;
  state.clock += seconds / phaseSeconds(state);
  return state.clock >= 1;
}

/** Dawn to day. @param {GameState} state */
export function beginDay(state) {
  state.phase = "day";
  state.clock = 0;
}

/** Day to the evening gathering. @param {GameState} state */
export function beginEvening(state) {
  state.phase = "evening";
  state.clock = 0;
}

/** Evening to the night building phase. @param {GameState} state */
export function beginNight(state) {
  state.phase = "night";
  state.clock = 0;
}

/** Winter cold slowly drains Warmth during the day (per second of play). */
export const WINTER_CHILL_PER_SECOND = 0.6 / 7;

/**
 * Applies seasonal effects that happen continuously while the day runs.
 * @param {GameState} state
 * @param {number} seconds
 */
export function applyDayWeather(state, seconds) {
  if (
    state.relaxMode ||
    state.phase !== "day" ||
    currentSeason(state).id !== "winter"
  )
    return;
  for (const cat of presentCats(state)) {
    changeWarmth(state.cats[cat.id], -WINTER_CHILL_PER_SECOND * seconds);
  }
}
