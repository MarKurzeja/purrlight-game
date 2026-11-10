/**
 * Player actions. Each one applies the rules from core/, then publishes an event, plays a
 * sound and spends in-game time. UI code calls these; it never changes the state directly.
 */
import { ACTION_SECONDS, BALANCE } from '../config.js';
import {
  lapTime,
  recordPetting,
  recordPlay,
  renameCat,
  revealSecret,
  takePhoto,
} from '../core/care.js';
import { advanceClock } from '../core/clock.js';
import { feedCat } from '../core/feeding.js';
import { fishingAccuracy, judgeCatch } from '../core/fishing.js';
import { huntReward } from '../core/hunt.js';
import { addToBag, currentSeason, isWary } from '../core/state.js';
import { playSound, setPurring } from '../engine/audio.js';
import { spawnBurst } from '../render/effects.js';
import { gameEvents } from './bus.js';
import { currentState, game } from './runtime.js';

/** @typedef {import('./runtime.js').Pickup} Pickup */

/** Spends in-game time. Relax mode has no clock. */
export function spendTime(seconds) {
  advanceClock(currentState(), seconds);
}

/** Floating text that rises from a point in the world, `height` game pixels above the ground. */
export function floatText(x, y, text, color = '#fff', height = 22) {
  game.floatingTexts.push({ x, y, height, text, color, age: 0 });
}

/* ---------- Dawn foraging ---------- */

/**
 * Picks up a herb, stone or firewood.
 * @param {Pickup} pickup
 */
export function gather(pickup) {
  const state = currentState();
  const quantity = pickup.kind === 'wood' && currentSeason(state).id === 'winter' ? 2 : 1;
  addToBag(state, pickup.kind, quantity);
  pickup.taken = true;
  playSound('get');
  spawnBurst(game.particles, pickup.x, pickup.y, '#fff6c8', 8, 'spark', 4);
  floatText(
    pickup.x,
    pickup.y,
    `+${quantity} ${ITEM_LABELS[pickup.kind] ?? pickup.kind}`,
    '#fff',
    12,
  );
  spendTime(ACTION_SECONDS.gather);
  gameEvents.emit('item:gathered', { item: pickup.kind, quantity });
}

const ITEM_LABELS = { herb: 'Wild herbs', stone: 'Warm stone', wood: 'Firewood' };

/** @returns {{ ok: boolean, reason?: string }} */
export function milkGoat() {
  const state = currentState();
  const limit = state.built.bakery ? 2 : 1;
  if (state.milkedToday >= limit) {
    return { ok: false, reason: 'Clover has given all her milk today.' };
  }
  state.milkedToday += 1;
  addToBag(state, 'milk');
  playSound('get');
  const { x, y } = game.pickups.find((p) => p.kind === 'goat') ?? { x: 0, y: 0 };
  spawnBurst(game.particles, x, y, '#ffffff', 8, 'spark', 12);
  floatText(x, y, '+1 Goat milk', '#fff', 24);
  spendTime(ACTION_SECONDS.milk);
  gameEvents.emit('goat:milked', {});
  return { ok: true };
}

/** @returns {{ ok: boolean, reason?: string }} */
export function canCast() {
  return currentState().castsToday >= BALANCE.castsPerDay
    ? { ok: false, reason: 'The fish have gone deep. Try again tomorrow.' }
    : { ok: true };
}

/**
 * Records a finished fishing session.
 * @param {import('../core/fishing.js').FishingSession} session
 */
export function finishFishing(session) {
  const state = currentState();
  const accuracy = fishingAccuracy(session);
  const { fish, quantity } = judgeCatch(accuracy, state.rod);
  state.castsToday += 1;
  spendTime(ACTION_SECONDS.minigame);
  gameEvents.emit('fishing:cast', {});
  if (fish) {
    addToBag(state, fish, quantity);
    playSound('chime');
    gameEvents.emit('fishing:catch', { fish, quantity });
  }
  return { fish, quantity, accuracy, rod: state.rod };
}

/** Records a finished hunt. */
export function finishHunt(mice) {
  spendTime(ACTION_SECONDS.hunt);
  return { mice, ...huntReward(currentState(), mice) };
}

/* ---------- Caring for cats ---------- */

/**
 * Puts food in a cat's bowl.
 * @returns {{ ok: false, reason: string } | { ok: true, message: string, full: boolean }}
 */
export function feed(catId, food) {
  const state = currentState();
  const result = feedCat(state, catId, food);
  if (!result.ok) return result;
  spendTime(ACTION_SECONDS.feed);
  const name = state.cats[catId].name.split(' ').pop();
  const messages = {
    love: `${name} devours it. A favourite! +${result.warmth}`,
    like: `${name} eats happily. +${result.warmth}`,
    meh: `${name} eats politely. +${result.warmth}`,
    hate: `${name} sniffs, then turns away. +${result.warmth}`,
  };
  playSound(result.taste === 'love' ? 'chime' : result.taste === 'hate' ? 'miss' : 'get');
  if (result.taste === 'love') playSound('meow');
  if (food === 'catnip' || food === 'nipcookie') {
    const e = game.cats[catId];
    if (e) floatText(e.x, e.y, 'zoomies!', '#d7c4f7', 20);
  }
  gameEvents.emit('cat:fed', {
    catId,
    taste: result.taste,
    discoveredFavourite: result.discoveredFavourite,
  });
  return {
    ok: true,
    message: messages[result.taste],
    full: state.cats[catId].mealsToday >= BALANCE.mealsPerDay,
  };
}

/**
 * Records a finished petting session and moves a frightened cat away.
 * @param {string} catId
 * @param {'purring' | 'bolted' | 'timeout'} outcome
 * @param {number} fill
 */
export function finishPetting(catId, outcome, fill) {
  setPurring(false);
  spendTime(ACTION_SECONDS.minigame);
  const success = outcome === 'purring';
  const result = recordPetting(currentState(), catId, {
    success,
    fill,
    timedOut: outcome === 'timeout',
  });
  if (success) playSound('meow');
  else {
    if (outcome === 'bolted') playSound('hiss');
    const e = game.cats[catId];
    if (e) {
      e.targetX = e.x + (Math.random() - 0.5) * 160;
      e.targetY = e.y;
      e.pose = 'walk';
    }
  }
  gameEvents.emit('cat:petted', { catId, success });
  return { ...result, success, outcome };
}

/** Records a finished game with a toy. `score` is 0-1. */
export function finishPlay(catId, toy, score) {
  spendTime(ACTION_SECONDS.minigame);
  const result = recordPlay(currentState(), catId, toy, score);
  playSound(result.favourite ? 'chime' : 'get');
  gameEvents.emit('cat:played', { catId, favourite: result.favourite });
  return { ...result, toy };
}

export function sitOnLap(catId) {
  if (!lapTime(currentState(), catId)) return false;
  spendTime(ACTION_SECONDS.lap);
  playSound('meow');
  setPurring(true);
  setTimeout(() => setPurring(false), 1600);
  for (let i = 0; i < 5; i++) {
    floatText(
      game.player.x + (Math.random() - 0.5) * 28,
      game.player.y,
      '♥',
      '#f4a3b8',
      24 + i * 5,
    );
  }
  return true;
}

/** Starts or stops a cat following the player around. Returns true if it now follows. */
export function toggleFollow(catId) {
  const e = game.cats[catId];
  e.following = !e.following;
  return e.following;
}

export function followToSecret(catId) {
  game.leadingCatId = catId;
}

/** A soulmate cat has reached its secret with the player. Returns the hat found. */
export function discoverSecret(catId) {
  game.leadingCatId = null;
  playSound('chime');
  return revealSecret(currentState(), catId);
}

/** Which album pose a cat is in right now. */
export function currentPose(catId) {
  if (isWary(currentState(), catId)) return 'wary';
  const pose = game.cats[catId]?.pose ?? 'sit';
  return pose === 'walk2' ? 'walk' : pose;
}

export function photograph(catId) {
  const pose = currentPose(catId);
  const result = takePhoto(currentState(), catId, pose);
  playSound('click');
  gameEvents.emit('photo:taken', { catId, isNew: result.isNew });
  return { ...result, pose };
}

export function putOnHat(catId, hat) {
  currentState().cats[catId].hat = hat || null;
  playSound('get');
}

export function rename(catId, name) {
  const result = renameCat(currentState(), catId, name);
  if (result.ok) playSound(result.suits ? 'meow' : 'miss');
  return result;
}
