/**
 * Balance simulator. A bot plays whole journeys using only the rules in src/core, so we can see
 * when a reasonably attentive player reaches each milestone without playing for hours.
 *
 *   node tools/simulate.js            summary over many seeds, both journey lengths
 *   node tools/simulate.js --verbose  day-by-day log of one full journey
 */
import { pathToFileURL } from "node:url";
import {
  ACTION_SECONDS,
  BALANCE,
  DAWN_SECONDS,
  DAY_SECONDS,
} from "../src/config.js";
import { tierOf } from "../src/core/bond.js";
import {
  availableActions,
  lapTime,
  recordPetting,
  recordPlay,
  sitWith,
} from "../src/core/care.js";
import { beginDay, beginNight } from "../src/core/clock.js";
import { eveningGathering, passNight } from "../src/core/day-cycle.js";
import { feedCat, mealWarmth } from "../src/core/feeding.js";
import { judgeCatch } from "../src/core/fishing.js";
import { recordEvent } from "../src/core/notes.js";
import { lanternReady, readMemory } from "../src/core/progress.js";
import { createRng, pickFrom } from "../src/core/random.js";
import {
  bake,
  buildBuilding,
  buildNook,
  buyDecor,
  buyRod,
  canBake,
  plantHerb,
  repairLantern,
} from "../src/core/shop.js";
import {
  createInitialState,
  currentSeason,
  isWary,
  presentCats,
  addToBag,
} from "../src/core/state.js";
import { createDailyNotes } from "../src/core/notes.js";
import { grantWish, rollWishes } from "../src/core/wishes.js";
import { assignFire, availableFires, lightFire } from "../src/core/winter.js";
import { CAT_BY_ID } from "../src/data/cats.js";
import { FOODS, RECIPES, RODS, TOYS } from "../src/data/items.js";
import { BUILDINGS, DECOR, LANTERN_PARTS, NOOKS } from "../src/data/village.js";

/** Seconds a player spends walking between things, on top of each action. */
const WALK_SECONDS = 7;

/**
 * Plays one journey to the end (or a day limit).
 * @param {'full' | 'short'} mode
 * @param {number} seed
 * @param {{ skill?: number, verbose?: boolean, maxDays?: number }} [options]
 *   `skill` 0-1: how well the bot plays the minigames.
 */
export function simulateJourney(
  mode,
  seed,
  { skill = 0.7, verbose = false, maxDays = 200 } = {},
) {
  const rng = createRng(seed);
  const state = createInitialState(mode);
  rollWishes(state, rng);
  createDailyNotes(state, rng);
  /** @type {Record<string, number>} */
  const milestones = {};
  const mark = (name) => {
    if (!(name in milestones)) milestones[name] = state.day;
  };
  const note = (event, amount = 1) => recordEvent(state, event, amount);
  const wish = (catId, kind) => {
    if (grantWish(state, catId, kind, rng).granted) note("wish");
  };

  while (state.day <= maxDays && !state.lanternLit) {
    const season = currentSeason(state).id;

    /* Dawn: forage within the time available. */
    let time = DAWN_SECONDS;
    const pickups = {
      herb: season === "spring" ? 9 : season === "winter" ? 3 : 6,
      stone: season === "summer" ? 5 : season === "winter" ? 2 : 3,
      wood: season === "winter" ? 7 : season === "autumn" ? 5 : 1,
    };
    while (state.castsToday < BALANCE.castsPerDay && time > 30) {
      const accuracy = Math.min(1, skill * 0.8 + rng() * 0.35);
      const { fish, quantity } = judgeCatch(accuracy, state.rod);
      state.castsToday += 1;
      note("cast");
      if (fish) {
        addToBag(state, fish, quantity);
        note("fish", quantity);
      }
      time -= ACTION_SECONDS.minigame + WALK_SECONDS;
    }
    for (let i = 0; i < (state.built.bakery ? 2 : 1); i++) {
      addToBag(state, "milk");
      note("milk");
      time -= ACTION_SECONDS.milk + WALK_SECONDS;
    }
    for (const [item, count] of Object.entries(pickups)) {
      for (let i = 0; i < count && time > 0; i++) {
        const amount = item === "wood" && season === "winter" ? 2 : 1;
        addToBag(state, item, amount);
        note("gather", amount);
        time -= ACTION_SECONDS.gather + WALK_SECONDS;
      }
    }
    beginDay(state);

    /* Day: care for the coldest cats first, within the time available. */
    time = DAY_SECONDS;
    const cats = presentCats(state).sort(
      (a, b) => state.cats[a.id].warmth - state.cats[b.id].warmth,
    );
    for (const { id } of cats) {
      if (time <= 0) break;
      const cat = state.cats[id];
      // Feed the warmest food in the bag (a player who has learned their tastes).
      for (let meal = 0; meal < BALANCE.mealsPerDay && time > 0; meal++) {
        const foods = Object.keys(FOODS).filter((f) => (state.bag[f] ?? 0) > 0);
        if (!foods.length) break;
        const best = foods.sort(
          (a, b) => mealWarmth(state, id, b) - mealWarmth(state, id, a),
        )[0];
        const fed = feedCat(state, id, best);
        if (!fed.ok) break;
        note("feed");
        if (fed.discoveredFavourite) note("favourite");
        if (fed.taste !== "hate") wish(id, "food");
        time -= ACTION_SECONDS.feed + WALK_SECONDS;
      }
      if (isWary(state, id) && time > 0) {
        // Sit quietly until the cat trusts you a little.
        const seconds = BALANCE.coaxDailyCap / BALANCE.coaxWarmthPerSecond;
        if (sitWith(state, id, seconds).completedCoax) {
          note("coax");
          wish(id, "sit");
        }
        time -= seconds + WALK_SECONDS;
      }
      if (availableActions(state, id).pet.ok && time > 0) {
        const success = rng() < skill;
        recordPetting(state, id, {
          success,
          fill: success ? 0.8 : 0.3,
          timedOut: false,
        });
        if (success) {
          note("pet");
          wish(id, "pets");
        }
        time -= ACTION_SECONDS.minigame + WALK_SECONDS;
      }
      if (availableActions(state, id).play.ok && time > 0) {
        const toy = cat.knowsToy
          ? CAT_BY_ID[id].favouriteToy
          : pickFrom(rng, Object.keys(TOYS));
        recordPlay(state, id, toy, skill * (0.7 + rng() * 0.4));
        note("play");
        wish(id, "play");
        time -= ACTION_SECONDS.minigame + WALK_SECONDS;
      }
      if (lapTime(state, id)) time -= ACTION_SECONDS.lap;
    }

    /* Evening. */
    const evening = eveningGathering(state, rng);
    beginNight(state);

    /* Night: read memories, then spend. */
    if (state.built.library) {
      for (const { id } of presentCats(state)) {
        for (let i = 0; i < state.cats[id].memories; i++) {
          readMemory(state, id, i);
        }
      }
    }
    const shop = () => {
      const nextBuilding = Object.entries(BUILDINGS)
        .filter(([b]) => !state.built[b])
        .sort(([, a], [, b]) => a.cost - b.cost)[0];
      if (nextBuilding && buildBuilding(state, nextBuilding[0]).ok) return true;
      if (
        state.built.hut &&
        state.rod < RODS.length - 1 &&
        buyRod(state, state.rod + 1).ok
      ) {
        return true;
      }
      if (!nextBuilding) {
        const part = LANTERN_PARTS.find((p) => !state.lantern[p.id]);
        if (part && repairLantern(state, part.id).ok) return true;
      }
      if (
        season === "spring" &&
        state.nooks <
          Math.min(NOOKS.length, Math.ceil(presentCats(state).length / 2)) &&
        state.purrs > 60 &&
        buildNook(state).ok
      ) {
        return true;
      }
      if (!part() && state.decor.length < DECOR.length && state.purrs > 80) {
        const item = DECOR.find((d) => !state.decor.includes(d.id));
        if (item && buyDecor(state, item.id).ok) return true;
      }
      return false;
    };
    const part = () =>
      LANTERN_PARTS.find(
        (p) =>
          !state.lantern[p.id] &&
          Object.keys(BUILDINGS).every((b) => state.built[b]),
      );
    while (shop()) {
      /* keep buying */
    }
    RECIPES.forEach((_, i) => {
      while (canBake(state, i) && state.built.bakery && i !== 0) bake(state, i);
    });
    state.plots.forEach((_, i) => plantHerb(state, i));
    if (season === "winter") {
      const fires = availableFires(state);
      presentCats(state).forEach((c, i) =>
        assignFire(
          state,
          c.id,
          fires[Math.floor(i / BALANCE.catsPerFire) % fires.length].id,
        ),
      );
      for (const f of fires) lightFire(state, f.id);
    }

    for (const id of Object.keys(BUILDINGS)) if (state.built[id]) mark(id);
    if (state.memoriesRead.length) mark("first memory read");
    if (presentCats(state).every((c) => !isWary(state, c.id))) {
      mark("no wary cats");
    }
    if (lanternReady(state)) {
      mark("lantern ready");
      state.lanternLit = true;
    }
    if (verbose) {
      const wary = presentCats(state).filter((c) => isWary(state, c.id)).length;
      const tiers = presentCats(state)
        .map((c) => tierOf(state.cats[c.id].bond))
        .join("");
      console.log(
        `day ${String(state.day).padStart(3)} ${season.padEnd(6)} purrs ${String(state.purrs).padStart(4)} (+${evening.total})  cats ${presentCats(state).length} wary ${wary}  tiers ${tiers}  memories read ${state.memoriesRead.length}`,
      );
    }
    passNight(state, rng);
  }
  return { milestones, days: state.day, finished: state.lanternLit };
}

/** Median of the milestone days over many seeds. */
export function summarise(mode, runs = 40, options = {}) {
  const results = Array.from({ length: runs }, (_, seed) =>
    simulateJourney(mode, seed + 1, options),
  );
  const names = [
    "hut",
    "bakery",
    "library",
    "first memory read",
    "observatory",
    "greenhouse",
    "no wary cats",
    "lantern ready",
  ];
  /** @type {Record<string, number | null>} */
  const median = {};
  for (const name of names) {
    const days = results
      .map((r) => r.milestones[name])
      .filter((d) => d !== undefined)
      .sort((a, b) => a - b);
    median[name] =
      days.length > runs / 2 ? days[Math.floor(days.length / 2)] : null;
  }
  return {
    median,
    finishedRuns: results.filter((r) => r.finished).length,
    runs,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const skillArg = process.argv.find((a) => a.startsWith("--skill="));
  const skill = skillArg ? Number(skillArg.split("=")[1]) : 0.7;
  if (process.argv.includes("--verbose")) {
    simulateJourney("full", 1, { verbose: true, skill });
  } else {
    for (const mode of /** @type {const} */ (["full", "short"])) {
      const { median, finishedRuns, runs } = summarise(mode, 40, { skill });
      const days = mode === "full" ? 40 : 16;
      console.log(
        `\n${mode} journey (${days} days = one year), skill ${skill}, median day each milestone is reached:`,
      );
      for (const [name, day] of Object.entries(median)) {
        console.log(`  ${name.padEnd(18)} ${day ?? "not reached"}`);
      }
      console.log(`  finished in ${finishedRuns} of ${runs} runs`);
    }
  }
}
