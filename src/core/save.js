/**
 * Save files: serialisation and migration of older versions.
 * Storage itself (localStorage, cloud) is handled by game/persistence.js.
 */
import { SAVE_VERSION } from "../config.js";
import { CATS } from "../data/cats.js";
import { createInitialState } from "./state.js";

/** @typedef {import('./state.js').GameState} GameState */

/**
 * @param {GameState} state
 * @param {number} now
 */
export function serializeState(state, now) {
  state.savedAt = now;
  return JSON.stringify(state);
}

/**
 * Reads a save. Returns null for anything unreadable or too old to migrate, so a corrupt
 * save never crashes the game.
 * @param {string | null | undefined} json
 * @returns {GameState | null}
 */
export function parseSave(json) {
  if (!json) return null;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  return migrateSave(raw);
}

/**
 * @param {any} raw
 * @returns {GameState | null}
 */
export function migrateSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const version = raw.version ?? raw.v;
  if (version === SAVE_VERSION) return withDefaults(raw);
  if (version === 2) return withDefaults(fromVersion2(raw));
  return null;
}

/**
 * Fills in any fields missing from an older or partial save.
 * @param {any} raw
 * @returns {GameState}
 */
function withDefaults(raw) {
  const base = createInitialState(raw.mode === "short" ? "short" : "full");
  const state = { ...base, ...raw, version: SAVE_VERSION };
  state.cats = Object.fromEntries(
    CATS.map((cat) => [
      cat.id,
      { ...base.cats[cat.id], ...(raw.cats?.[cat.id] ?? {}) },
    ]),
  );
  return state;
}

/**
 * Version 2 used short field names. Maps them to the current names.
 * @param {any} old
 */
function fromVersion2(old) {
  const cats = Object.fromEntries(
    Object.entries(old.cats ?? {}).map(([id, /** @type {any} */ c]) => [
      id,
      {
        name: c.name,
        warmth: c.warmth,
        bond: c.bond,
        present: !!c.here,
        hat: c.hat ?? null,
        tastes: c.food ?? {},
        knowsToy: !!c.toyKnown,
        knowsSweetSpot: !!c.sweetKnown,
        memories: c.frags ?? 0,
        mealsToday: c.fed ?? 0,
        petsToday: c.pet ?? 0,
        gamesToday: c.play ?? 0,
        lapDay: c.lap ?? 0,
        photos: Object.fromEntries(
          Object.keys(c.photos ?? {}).map((pose) => [
            pose === "ghost" ? "wary" : pose,
            true,
          ]),
        ),
        secretFound: !!c.secret,
        wish: c.wish ?? null,
        coaxToday: c.coax ?? 0,
        sitBondToday: c.sitBond ?? 0,
        tierSeen: c.tierSeen ?? 0,
        renamed: !!c.renamed,
      },
    ]),
  );
  return {
    mode: old.mode,
    day: old.day,
    season: old.season,
    seasonDay: old.sday,
    phase: old.phase,
    clock: old.clock,
    purrs: old.purrs,
    bag: old.bag,
    cats,
    built: old.built,
    nooks: old.nooks,
    rod: old.rod,
    decor: old.decor,
    hats: old.hats,
    plots: old.plots,
    lantern: old.lantern,
    fireAssignments: old.fires ?? {},
    litFires: old.lit ?? {},
    // "biscuit0" became "biscuit:0".
    memoriesRead: (old.read ?? []).map((/** @type {string} */ key) =>
      key.replace(/(\d+)$/, ":$1"),
    ),
    relaxMode: !!old.relax,
    lanternLit: !!old.done,
    castsToday: old.casts ?? 0,
    milkedToday: old.milked ?? 0,
    tasks: old.tasks
      ? {
          day: old.tasks.day,
          bonusPaid: !!old.tasks.bonus,
          notes: old.tasks.list.map((/** @type {any} */ n) => ({
            event: n.ev === "fav" ? "favourite" : n.ev,
            need: n.need,
            have: n.have,
            label: n.l,
            target:
              { pond: "lake", node: "item", warm: "friendly" }[
                /** @type {string} */ (n.t)
              ] ?? n.t,
            reward: n.rew,
          })),
        }
      : null,
    savedAt: old.ts ?? 0,
  };
}
