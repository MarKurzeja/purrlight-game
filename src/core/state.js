/**
 * The persistent game state: everything that goes into a save file.
 * Runtime-only things (positions, particles, timers) live in game/runtime.js instead.
 */
import { BALANCE, SAVE_VERSION } from "../config.js";
import { CATS, STARTING_CATS } from "../data/cats.js";
import { SEASONS } from "../data/seasons.js";

/**
 * @typedef {'full' | 'short'} JourneyMode
 * @typedef {'dawn' | 'day' | 'evening' | 'night'} Phase
 * @typedef {'food' | 'pets' | 'play' | 'sit'} WishKind
 * @typedef {'love' | 'like' | 'meh' | 'hate'} Taste
 *
 * @typedef {Object} CatState
 * @property {string} name          Current name (players can rename cats).
 * @property {number} warmth        0-100. Below BALANCE.waryBelow the cat is a wary stray.
 * @property {number} bond          Grows with care. See BOND_TIERS.
 * @property {boolean} present      Has this cat come to the village yet?
 * @property {string | null} hat
 * @property {Record<string, Taste>} tastes   Foods the player has discovered the reaction to.
 * @property {boolean} knowsToy
 * @property {boolean} knowsSweetSpot
 * @property {number} memories      Memory letters this cat has given (0-5).
 * @property {number} mealsToday
 * @property {number} petsToday
 * @property {number} gamesToday
 * @property {number} lapDay        Last day the cat sat on your lap.
 * @property {Record<string, true>} photos
 * @property {boolean} secretFound
 * @property {WishKind | null} wish
 * @property {number} coaxToday     Warmth gained today from sitting quietly.
 * @property {number} strokeToday   Warmth gained today from being stroked in the village.
 * @property {number} sitBondToday
 * @property {number} tierSeen      Highest bond tier the player has been told about.
 * @property {boolean} renamed
 *
 * @typedef {Object} DailyNote
 * @property {string} event   The game event that advances this note.
 * @property {number} need
 * @property {number} have
 * @property {string} label
 * @property {string} target  Hint for the on-screen marker (see game/guidance.js).
 * @property {number} reward  Purrs paid when completed.
 *
 * @typedef {Object} GameState
 * @property {number} version
 * @property {JourneyMode} mode
 * @property {number} day          Days since the start, from 1.
 * @property {number} season       Index into SEASONS.
 * @property {number} seasonDay    Day within the season, from 1.
 * @property {Phase} phase
 * @property {number} clock        Progress through the current phase, 0-1.
 * @property {number} purrs
 * @property {Record<string, number>} bag
 * @property {Record<string, CatState>} cats
 * @property {Record<string, boolean>} built
 * @property {number} nooks
 * @property {number} rod
 * @property {string[]} decor
 * @property {string[]} hats
 * @property {number[]} plots      Day each greenhouse plot was planted, 0 if empty.
 * @property {Record<string, boolean>} lantern
 * @property {Record<string, string>} fireAssignments  Cat id to fire id (winter).
 * @property {Record<string, boolean>} litFires
 * @property {string[]} memoriesRead  Keys like "biscuit:0".
 * @property {boolean} relaxMode
 * @property {boolean} lanternLit
 * @property {number} castsToday
 * @property {number} milkedToday
 * @property {{ day: number, notes: DailyNote[], bonusPaid: boolean } | null} tasks
 * @property {number} savedAt
 */

/**
 * @param {string} catId
 * @returns {CatState}
 */
function createCatState(catId) {
  const cat = CATS.find((c) => c.id === catId);
  return {
    name: cat ? cat.name : catId,
    warmth: catId === "biscuit" ? 26 : 19,
    bond: 0,
    present: STARTING_CATS.includes(catId),
    hat: null,
    tastes: {},
    knowsToy: false,
    knowsSweetSpot: false,
    memories: 0,
    mealsToday: 0,
    petsToday: 0,
    gamesToday: 0,
    lapDay: 0,
    photos: {},
    secretFound: false,
    wish: null,
    coaxToday: 0,
    strokeToday: 0,
    sitBondToday: 0,
    tierSeen: 0,
    renamed: false,
  };
}

/**
 * A brand new game.
 * @param {JourneyMode} mode
 * @returns {GameState}
 */
export function createInitialState(mode = "full") {
  return {
    version: SAVE_VERSION,
    mode,
    day: 1,
    season: 0,
    seasonDay: 1,
    phase: "dawn",
    clock: 0,
    purrs: mode === "short" ? 12 : 0,
    bag: { sardine: 1, herb: 1 },
    cats: Object.fromEntries(
      CATS.map((cat) => [cat.id, createCatState(cat.id)]),
    ),
    built: {},
    nooks: 0,
    rod: 0,
    decor: [],
    hats: [],
    plots: [0, 0, 0],
    lantern: {},
    fireAssignments: {},
    litFires: {},
    memoriesRead: [],
    relaxMode: false,
    lanternLit: false,
    castsToday: 0,
    milkedToday: 0,
    tasks: null,
    savedAt: 0,
  };
}

/* ---------- Derived values ---------- */

/** @param {GameState} state */
export const currentSeason = (state) => SEASONS[state.season];

/** @param {GameState} state */
export const seasonLength = (state) => BALANCE.seasonDays[state.mode];

/** Short journeys earn Purrs and bond faster. @param {GameState} state */
export const purrMultiplier = (state) =>
  state.mode === "short" ? BALANCE.shortJourneyPace : 1;

/**
 * Changes a cat's bond. Gains are scaled by the journey's pace; bond never drops below zero.
 * @param {GameState} state
 * @param {string} catId
 * @param {number} amount
 */
export function addBond(state, catId, amount) {
  const cat = state.cats[catId];
  cat.bond = Math.max(
    0,
    cat.bond + (amount > 0 ? amount * purrMultiplier(state) : amount),
  );
}

/** Cats currently living in the village. @param {GameState} state */
export const presentCats = (state) =>
  CATS.filter((cat) => state.cats[cat.id].present);

/**
 * Is this cat still a wary stray? Once the Lantern is lit no cat is wary again.
 * @param {GameState} state
 * @param {string} catId
 */
export const isWary = (state, catId) =>
  !state.lanternLit && state.cats[catId].warmth < BALANCE.waryBelow;

/**
 * @param {GameState} state
 * @param {string} item
 */
export function addToBag(state, item, amount = 1) {
  state.bag[item] = (state.bag[item] ?? 0) + amount;
}

/** Adds Warmth, keeping it within bounds. @param {CatState} cat */
export function changeWarmth(cat, amount) {
  cat.warmth = Math.min(
    BALANCE.maxWarmth,
    Math.max(BALANCE.minWarmth, cat.warmth + amount),
  );
}
