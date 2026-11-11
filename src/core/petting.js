/**
 * The petting minigame as a pure state machine. The player rubs the cat; each cat has a
 * hidden sweet spot and a preferred stroke speed. Touching the belly frightens every cat.
 */
import { BELLY_ZONE, PERSONALITIES, PET_ZONES } from "../data/cats.js";
import { clamp, distance, lerp } from "./math.js";
import { pickFrom } from "./random.js";

/** @typedef {import('./random.js').Rng} Rng */

export const PETTING_SECONDS = 22;
/** Seconds of perfect petting needed to fill the purr meter. */
export const SECONDS_TO_FILL = 4.6;

/**
 * @typedef {Object} PettingSession
 * @property {string} personality
 * @property {string} sweetSpot     Current zone id (it moves for bandits).
 * @property {number} moveTimer
 * @property {number} fill          Purr meter, 0-1.
 * @property {number} fear          Spooked meter, 0-1.
 * @property {number} timeLeft
 * @property {number} speed         Smoothed hand speed in pixels per second.
 * @property {{x: number, y: number} | null} lastHand
 * @property {number} closeness     0-1, how near the hand is to the sweet spot.
 * @property {boolean} inSpot
 * @property {boolean} goodSpeed
 * @property {boolean} onBelly
 * @property {boolean} active       Is the player touching the cat right now?
 * @property {string} hint
 * @property {boolean} skittish     Spring makes cats easier to scare.
 */

/**
 * @param {{ personality: string, sweetSpot: string, skittish: boolean }} options
 * @returns {PettingSession}
 */
export function createPettingSession({ personality, sweetSpot, skittish }) {
  return {
    personality,
    sweetSpot,
    moveTimer:
      PERSONALITIES[/** @type {keyof typeof PERSONALITIES} */ (personality)]
        .sweetSpotMovesEvery,
    fill: 0,
    fear: 0,
    timeLeft: PETTING_SECONDS,
    speed: 0,
    lastHand: null,
    closeness: 0,
    inSpot: false,
    goodSpeed: false,
    onBelly: false,
    active: false,
    hint: "",
    skittish,
  };
}

/** Is a point on the cat's body or head (portrait coordinates)? */
export function isOnCat(x, y) {
  return (
    distance(x, y, 176, 126) < 54 || (x > 178 && x < 362 && y > 116 && y < 226)
  );
}

/**
 * Advances the session by `dt` seconds.
 * @param {PettingSession} session
 * @param {{ x: number, y: number, touching: boolean }} hand
 * @param {number} dt
 * @param {Rng} rng
 * @returns {null | 'purring' | 'bolted' | 'timeout'}
 *   'purring' = success, 'bolted' = scared away, 'timeout' = ran out of time without success.
 */
export function stepPetting(session, hand, dt, rng) {
  const traits =
    PERSONALITIES[
      /** @type {keyof typeof PERSONALITIES} */ (session.personality)
    ];
  session.timeLeft -= dt;

  if (traits.sweetSpotMovesEvery > 0) {
    session.moveTimer -= dt;
    if (session.moveTimer < 0) {
      session.moveTimer = traits.sweetSpotMovesEvery;
      session.sweetSpot = pickFrom(
        rng,
        Object.keys(PET_ZONES).filter((z) => z !== session.sweetSpot),
      );
    }
  }

  if (session.lastHand) {
    const instant =
      distance(hand.x, hand.y, session.lastHand.x, session.lastHand.y) /
      Math.max(dt, 0.001);
    session.speed = lerp(session.speed, instant, 0.18);
  }
  session.lastHand = { x: hand.x, y: hand.y };

  const zone =
    PET_ZONES[/** @type {keyof typeof PET_ZONES} */ (session.sweetSpot)];
  const toSpot = distance(hand.x, hand.y, zone.x, zone.y);
  const [slowest, fastest] = traits.strokeSpeed;
  session.closeness = clamp(1 - (toSpot - zone.r) / 170);
  session.inSpot = toSpot < zone.r + 6;
  session.onBelly =
    distance(hand.x, hand.y, BELLY_ZONE.x, BELLY_ZONE.y) < BELLY_ZONE.r;
  session.goodSpeed = session.speed >= slowest && session.speed <= fastest;
  session.active = hand.touching && isOnCat(hand.x, hand.y);

  if (session.active) {
    const startle = session.skittish ? 1.4 : 1;
    if (session.onBelly) {
      session.fear += dt * 0.5 * traits.fright * startle;
      session.hint = "Not the belly!";
    } else if (session.inSpot && session.goodSpeed) {
      session.fill += dt / SECONDS_TO_FILL;
      session.hint = "";
    } else if (session.inSpot) {
      session.fear += dt * 0.03;
      session.hint =
        session.speed > fastest ? "Gentler, slower" : "A little brisker";
    } else {
      session.fear +=
        dt * (0.08 + (1 - session.closeness) * 0.12) * traits.fright * startle;
      session.hint = "";
    }
  }

  if (session.fill >= 1) return "purring";
  if (session.fear >= 1) return "bolted";
  if (session.timeLeft <= 0) return session.fill > 0.5 ? "purring" : "timeout";
  return null;
}

/** Is the hand currently doing exactly the right thing? @param {PettingSession} s */
export const isPurring = (s) => s.active && s.inSpot && s.goodSpeed;
