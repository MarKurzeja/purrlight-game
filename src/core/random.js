/**
 * Randomness. Game rules take an `rng` argument (a function returning [0, 1)) so tests can pass
 * a seeded generator and get repeatable results. Rendering uses the unseeded helpers.
 */

/** @typedef {() => number} Rng */

/**
 * Creates a deterministic generator (mulberry32).
 * @param {number} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A number in [min, max).
 * @param {Rng} rng
 */
export function randomBetween(rng, min, max) {
  return min + rng() * (max - min);
}

/**
 * A random element of `items`.
 * @template T
 * @param {Rng} rng
 * @param {readonly T[]} items
 * @returns {T}
 */
export function pickFrom(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/**
 * A shuffled copy of `items` (Fisher-Yates).
 * @template T
 * @param {Rng} rng
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function shuffled(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Unseeded helper for visuals: `rand(max)` is in [0, max), `rand(min, max)` in [min, max).
 * @param {number} [a]
 * @param {number} [b]
 */
export function rand(a = 1, b = undefined) {
  return b === undefined ? Math.random() * a : a + Math.random() * (b - a);
}

/**
 * Unseeded helper for visuals.
 * @template T
 * @param {readonly T[]} items
 * @returns {T}
 */
export function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}
