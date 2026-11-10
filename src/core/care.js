/**
 * Petting, playing, lap time, names and photos: everything you do with one cat.
 * These functions record outcomes; the minigames themselves live in petting.js and the scenes.
 */
import { BALANCE } from '../config.js';
import { CAT_BY_ID } from '../data/cats.js';
import { tierOf } from './bond.js';
import { addBond, changeWarmth, isWary } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */

/**
 * Which actions are available for a cat right now, with a reason when one is not.
 * @param {GameState} state
 * @param {string} catId
 */
export function availableActions(state, catId) {
  const cat = state.cats[catId];
  const wary = isWary(state, catId);
  const tier = tierOf(cat.bond);
  /** @param {boolean} ok @param {string} reason */
  const option = (ok, reason) => ({ ok, reason: ok ? '' : reason });
  return {
    feed: option(cat.mealsToday < BALANCE.mealsPerDay, 'Full today'),
    pet: option(
      !wary && cat.petsToday < BALANCE.petsPerDay,
      wary ? 'Too wary' : 'Enough for today',
    ),
    play: option(!wary && cat.gamesToday < BALANCE.gamesPerDay, wary ? 'Too wary' : 'Tired today'),
    walk: { unlocked: tier >= 1, ...option(!wary, 'Too wary') },
    lap: { unlocked: tier >= 2, ...option(!wary && cat.lapDay < state.day, 'Done today') },
    secret: { unlocked: tier >= 4 && !cat.secretFound, ...option(!wary, 'Too wary') },
  };
}

/**
 * Records a finished petting session.
 * @param {GameState} state
 * @param {string} catId
 * @param {{ success: boolean, fill: number, timedOut: boolean }} result
 *   `fill` is how full the purr meter got (0-1).
 */
export function recordPetting(state, catId, { success, fill, timedOut }) {
  const cat = state.cats[catId];
  cat.petsToday += 1;
  if (!success) {
    if (!timedOut) changeWarmth(cat, -4);
    return { warmth: 0, bond: 0, learnedSweetSpot: false };
  }
  const repeat = cat.petsToday > 1 ? 0.6 : 1;
  const warmth = Math.floor(Math.round(20 + fill * 14) * repeat);
  const bond = BALANCE.petBond;
  changeWarmth(cat, warmth);
  addBond(state, catId, bond);
  const learnedSweetSpot = !cat.knowsSweetSpot && fill >= 0.5;
  if (learnedSweetSpot) cat.knowsSweetSpot = true;
  return { warmth, bond, learnedSweetSpot };
}

/**
 * Records a finished play session. `score` is 0-1.
 * @param {GameState} state
 * @param {string} catId
 * @param {string} toy
 * @param {number} score
 */
export function recordPlay(state, catId, toy, score) {
  const cat = state.cats[catId];
  const favourite = CAT_BY_ID[catId].favouriteToy === toy;
  cat.gamesToday += 1;
  const base = 8 + Math.min(1, Math.max(0, score)) * 18;
  const warmth = Math.round(base * (favourite ? 1.5 : 1) * (cat.gamesToday > 1 ? 0.6 : 1));
  const bond = favourite ? BALANCE.playBond.favourite : BALANCE.playBond.other;
  changeWarmth(cat, warmth);
  addBond(state, catId, bond);
  if (favourite) cat.knowsToy = true;
  return { warmth, bond, favourite };
}

/**
 * Once a day, a friendly cat jumps onto your lap.
 * @param {GameState} state
 * @param {string} catId
 */
export function lapTime(state, catId) {
  const cat = state.cats[catId];
  if (!availableActions(state, catId).lap.ok) return false;
  cat.lapDay = state.day;
  changeWarmth(cat, BALANCE.lapWarmth);
  addBond(state, catId, BALANCE.lapBond);
  return true;
}

/**
 * Each personality has its own taste in names.
 * @param {string} personality
 * @param {string} name
 */
export function nameSuits(personality, name) {
  const n = name.toLowerCase();
  switch (personality) {
    case 'lazy':
      return /[ou]/.test(n) && n.length < 9;
    case 'hunter':
      return /[ktx]/.test(n);
    case 'aristocrat':
      return n.length >= 8;
    case 'bandit':
      return n.length <= 5;
    case 'shy':
      return /[lmn]/.test(n) && !/[kx]/.test(n);
    default:
      return true;
  }
}

/**
 * Renames a cat. The first rename to a name it likes earns some bond.
 * @param {GameState} state
 * @param {string} catId
 * @param {string} rawName
 * @returns {{ ok: false } | { ok: true, name: string, suits: boolean }}
 */
export function renameCat(state, catId, rawName) {
  const name = rawName.trim().slice(0, 20);
  if (!name) return { ok: false };
  const cat = state.cats[catId];
  const suits = nameSuits(CAT_BY_ID[catId].personality, name);
  if (!cat.renamed && suits) addBond(state, catId, BALANCE.renameBond);
  cat.renamed = true;
  cat.name = name;
  return { ok: true, name, suits };
}

/** Photo album poses. Wary is a pose of its own. */
export const PHOTO_POSES = Object.freeze(['wary', 'sit', 'loaf', 'sleep', 'walk']);

/**
 * Adds a photo to the album. New photos earn a little.
 * @param {GameState} state
 * @param {string} catId
 * @param {string} pose
 */
export function takePhoto(state, catId, pose) {
  const photos = state.cats[catId].photos;
  if (photos[pose]) return { isNew: false };
  photos[pose] = true;
  state.purrs += BALANCE.photoPurrs;
  return { isNew: true };
}

/**
 * A soulmate cat has led you to its secret: you get a hat.
 * @param {GameState} state
 * @param {string} catId
 */
export function revealSecret(state, catId) {
  const cat = state.cats[catId];
  const hat = CAT_BY_ID[catId].secret.hat;
  cat.secretFound = true;
  addBond(state, catId, BALANCE.secretBond);
  if (!state.hats.includes(hat)) state.hats.push(hat);
  return hat;
}

/**
 * Sitting quietly next to a cat. Wary cats warm up slowly; everyone grows a little closer.
 * @param {GameState} state
 * @param {string} catId
 * @param {number} seconds
 * @returns {{ completedCoax: boolean }} true the moment the daily coax limit is reached.
 */
export function sitWith(state, catId, seconds) {
  const cat = state.cats[catId];
  let completedCoax = false;
  if (cat.coaxToday < BALANCE.coaxDailyCap) {
    const before = cat.coaxToday;
    cat.coaxToday = Math.min(BALANCE.coaxDailyCap, before + seconds * BALANCE.coaxWarmthPerSecond);
    changeWarmth(cat, cat.coaxToday - before);
    completedCoax = cat.coaxToday >= BALANCE.coaxDailyCap;
  }
  if (cat.sitBondToday < BALANCE.sitBondDailyCap) {
    const gain = Math.min(
      BALANCE.sitBondDailyCap - cat.sitBondToday,
      seconds * BALANCE.sitBondPerSecond,
    );
    cat.sitBondToday += gain;
    addBond(state, catId, gain);
  }
  return { completedCoax };
}

/**
 * Stroking a cat in the village, a gentler alternative to the petting minigame. Only cats that
 * trust you a little (not wary) can be touched, and each cat only wants so much a day.
 * @param {GameState} state
 * @param {string} catId
 * @param {number} seconds
 * @returns {{ ok: false, reason: 'wary' | 'enough' } | { ok: true, warmth: number, satisfied: boolean }}
 *   `satisfied` is true the moment the cat has had enough for today.
 */
export function strokeCat(state, catId, seconds) {
  const cat = state.cats[catId];
  if (isWary(state, catId)) return { ok: false, reason: 'wary' };
  if (cat.strokeToday >= BALANCE.strokeDailyCap) return { ok: false, reason: 'enough' };
  const warmth = Math.min(
    BALANCE.strokeDailyCap - cat.strokeToday,
    seconds * BALANCE.strokeWarmthPerSecond,
  );
  cat.strokeToday += warmth;
  changeWarmth(cat, warmth);
  addBond(state, catId, seconds * BALANCE.strokeBondPerSecond);
  return { ok: true, warmth, satisfied: cat.strokeToday >= BALANCE.strokeDailyCap };
}
