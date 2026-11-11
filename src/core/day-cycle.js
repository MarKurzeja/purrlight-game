/**
 * The evening gathering and the passage of night into the next morning.
 * These are the two big state transitions of each day.
 */
import { BALANCE } from "../config.js";
import { CAT_BY_ID, PERSONALITIES } from "../data/cats.js";
import { ITEMS } from "../data/items.js";
import { BUILDINGS } from "../data/village.js";
import { tierOf } from "./bond.js";
import { createDailyNotes } from "./notes.js";
import { pickFrom } from "./random.js";
import { CATNIP_GROW_DAYS } from "./shop.js";
import {
  addToBag,
  changeWarmth,
  currentSeason,
  isWary,
  presentCats,
  purrMultiplier,
  seasonLength,
} from "./state.js";
import { rollWishes } from "./wishes.js";
import { keptWarmByFire } from "./winter.js";

/**
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./random.js').Rng} Rng
 */

/**
 * In summer, each shaded nook covers two cats (warmest first). Returns the cats left in the sun.
 * @param {GameState} state
 * @returns {Set<string>}
 */
export function catsInTheSun(state) {
  if (currentSeason(state).id !== "summer") return new Set();
  const byWarmth = presentCats(state)
    .map((c) => c.id)
    .sort((a, b) => state.cats[b].warmth - state.cats[a].warmth);
  return new Set(byWarmth.slice(state.nooks * BALANCE.catsPerNook));
}

/**
 * The evening fire: warm cats give Purrs and sometimes a memory. Wary cats sit at the edge
 * and give a single Purr.
 * @param {GameState} state
 * @param {Rng} rng
 * @returns {{ rows: { catId: string, purrs: number, memory: boolean }[], total: number }}
 */
export function eveningGathering(state, rng) {
  const sunny = catsInTheSun(state);
  const multiplier = purrMultiplier(state);
  const rows = presentCats(state).map((c) => {
    const cat = state.cats[c.id];
    const tier = tierOf(cat.bond);
    let purrs = isWary(state, c.id)
      ? 1
      : (BALANCE.eveningBasePurrs +
          cat.warmth / BALANCE.eveningWarmthDivisor +
          tier) *
        multiplier;
    if (sunny.has(c.id)) purrs *= 0.7;
    purrs = Math.max(1, Math.round(purrs));

    let memory = false;
    const memoryUnlocked = tier >= cat.memories; // deeper memories need a deeper bond
    if (
      cat.warmth >= BALANCE.memoryMinWarmth &&
      cat.memories < BALANCE.memoriesPerCat &&
      memoryUnlocked &&
      rng() < BALANCE.memoryChance
    ) {
      cat.memories += 1;
      memory = true;
    }
    return { catId: c.id, purrs, memory };
  });
  const total = rows.reduce((sum, r) => sum + r.purrs, 0);
  state.purrs += total;
  return { rows, total };
}

/**
 * Warmth a cat loses overnight.
 * @param {GameState} state
 * @param {string} catId
 * @param {Set<string>} sunny Cats left in the summer sun.
 */
export function overnightLoss(state, catId, sunny) {
  if (state.relaxMode || state.lanternLit) return 0;
  if (currentSeason(state).id === "winter") {
    return keptWarmByFire(state, catId)
      ? BALANCE.winterLitLoss
      : BALANCE.winterColdLoss;
  }
  let loss = Math.max(
    BALANCE.overnightLossFloor,
    BALANCE.overnightLoss - state.decor.length,
  );
  if (sunny.has(catId)) loss += BALANCE.summerSunLoss;
  return loss;
}

/** Items a trusting cat may leave at your door. */
const GIFTS = /** @type {const} */ ([
  "sardine",
  "herb",
  "stone",
  "wood",
  "trout",
]);

/**
 * Night passes: cats cool down, counters reset, the season may turn, and new cats, crops,
 * sunbeams and gifts arrive. Produces tomorrow's wishes and notes.
 * @param {GameState} state
 * @param {Rng} rng
 * @returns {{ notes: string[], newSeason: boolean }}
 *   `notes` are messages for the player to read in the morning.
 */
export function passNight(state, rng) {
  const sunny = catsInTheSun(state);
  for (const c of presentCats(state)) {
    const cat = state.cats[c.id];
    changeWarmth(cat, -overnightLoss(state, c.id, sunny));
    cat.mealsToday = 0;
    cat.petsToday = 0;
    cat.gamesToday = 0;
    cat.coaxToday = 0;
    cat.strokeToday = 0;
    cat.sitBondToday = 0;
  }

  state.day += 1;
  state.seasonDay += 1;
  state.castsToday = 0;
  state.milkedToday = 0;
  state.litFires = {};
  let newSeason = false;
  if (state.seasonDay > seasonLength(state)) {
    state.seasonDay = 1;
    state.season = (state.season + 1) % 4;
    newSeason = true;
  }
  state.phase = "dawn";
  state.clock = 0;

  const notes = [];
  for (const [buildingId, building] of Object.entries(BUILDINGS)) {
    const arrival = state.cats[building.bringsCat];
    if (state.built[buildingId] && !arrival.present) {
      arrival.present = true;
      const def = CAT_BY_ID[building.bringsCat];
      notes.push(
        `Someone has been watching from the woodpile: ${def.name}, ${PERSONALITIES[def.personality].label}, has come home.`,
      );
    }
  }

  state.plots = state.plots.map((planted) => {
    if (planted && state.day >= planted + CATNIP_GROW_DAYS) {
      addToBag(state, "catnip");
      notes.push("Catnip is ready in the greenhouse. +1 Catnip.");
      return 0;
    }
    return planted;
  });

  if (state.built.observatory) {
    const sunbathers = presentCats(state)
      .filter((c) => state.cats[c.id].warmth >= 55)
      .sort((a, b) => state.cats[b.id].warmth - state.cats[a.id].warmth)
      .slice(0, 3);
    if (sunbathers.length) {
      const earned = Math.round(
        sunbathers.reduce(
          (sum, c) => sum + 3 + tierOf(state.cats[c.id].bond),
          0,
        ) * purrMultiplier(state),
      );
      state.purrs += earned;
      const names = sunbathers
        .map((c) => state.cats[c.id].name.split(" ").pop())
        .join(", ");
      notes.push(`${names} caught the sunbeams at dawn. +${earned} Purrs.`);
    }
  }

  for (const c of presentCats(state)) {
    if (tierOf(state.cats[c.id].bond) >= 3 && rng() < 0.5) {
      const gift = pickFrom(rng, GIFTS);
      addToBag(state, gift);
      notes.push(
        `${state.cats[c.id].name} left a gift at your door: ${ITEMS[gift].name}.`,
      );
    }
  }

  rollWishes(state, rng);
  createDailyNotes(state, rng);
  return { notes, newSeason };
}
