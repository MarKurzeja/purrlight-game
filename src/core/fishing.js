/**
 * The rhythm fishing minigame as a pure state machine: notes fall down three lanes and the
 * player presses the lane as each note reaches the line.
 */
import { pickFrom } from './random.js';

/** @typedef {import('./random.js').Rng} Rng */

export const FISHING_BPM = 84;
export const LANES = 3;

/**
 * @typedef {{ time: number, lane: number, state: 'waiting' | 'hit' | 'missed' }} FishingNote
 * @typedef {Object} FishingSession
 * @property {FishingNote[]} notes
 * @property {number} time       Seconds since the start.
 * @property {number} duration
 * @property {number} window     Seconds either side of a note that count as perfect.
 * @property {number} score      Perfect hits count 1, good hits 0.6.
 * @property {number} combo
 * @property {string} lastJudgement  'Perfect', 'Good', 'Missed' or ''.
 */

/**
 * Better rods give more notes and wider timing.
 * @param {number} rod
 * @param {Rng} rng
 * @returns {FishingSession}
 */
export function createFishingSession(rod, rng) {
  const beat = 60 / FISHING_BPM;
  const count = 11 + rod * 2;
  /** @type {FishingNote[]} */
  const notes = [];
  let time = 1.6;
  let lane = 1;
  for (let i = 0; i < count; i++) {
    if (rng() >= 0.45) lane = Math.floor(rng() * LANES);
    notes.push({ time, lane, state: 'waiting' });
    time += beat * pickFrom(rng, i > 6 ? [0.5, 1, 1] : [1, 1, 1.5]);
  }
  return {
    notes,
    time: 0,
    duration: time + 1,
    window: 0.11 + rod * 0.022,
    score: 0,
    combo: 0,
    lastJudgement: '',
  };
}

/**
 * The player presses a lane.
 * @param {FishingSession} session
 * @param {number} lane
 * @returns {'perfect' | 'good' | 'miss'}
 */
export function pressLane(session, lane) {
  /** @type {FishingNote | null} */
  let best = null;
  let bestOffset = Infinity;
  for (const note of session.notes) {
    if (note.state !== 'waiting' || note.lane !== lane) continue;
    const offset = Math.abs(note.time - session.time);
    if (offset < bestOffset) {
      bestOffset = offset;
      best = note;
    }
  }
  if (!best || bestOffset >= session.window * 2) {
    session.combo = 0;
    return 'miss';
  }
  const perfect = bestOffset < session.window;
  best.state = 'hit';
  session.score += perfect ? 1 : 0.6;
  session.combo += 1;
  session.lastJudgement = perfect ? 'Perfect' : 'Good';
  return perfect ? 'perfect' : 'good';
}

/**
 * Advances time and marks notes that went past as missed.
 * @param {FishingSession} session
 * @param {number} dt
 * @returns {{ missed: number, finished: boolean }}
 */
export function stepFishing(session, dt) {
  session.time += dt;
  let missed = 0;
  for (const note of session.notes) {
    if (note.state === 'waiting' && session.time > note.time + session.window * 2) {
      note.state = 'missed';
      missed += 1;
    }
  }
  if (missed) {
    session.combo = 0;
    session.lastJudgement = 'Missed';
  }
  return { missed, finished: session.time > session.duration };
}

/** Timing accuracy 0-1. @param {FishingSession} session */
export const fishingAccuracy = (session) => session.score / session.notes.length;

/**
 * What bites, given timing accuracy and rod.
 * @param {number} accuracy 0-1
 * @param {number} rod
 * @returns {{ fish: string | null, quantity: number }}
 */
export function judgeCatch(accuracy, rod) {
  if (accuracy >= 0.92 && rod >= 2) return { fish: 'moonkoi', quantity: 1 };
  if (accuracy >= 0.68 && rod >= 1) return { fish: 'trout', quantity: 1 };
  if (accuracy >= 0.45) return { fish: 'sardine', quantity: accuracy >= 0.8 ? 2 : 1 };
  if (accuracy >= 0.2) return { fish: 'sardine', quantity: 1 };
  return { fish: null, quantity: 0 };
}
