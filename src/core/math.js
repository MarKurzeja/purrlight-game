/** Small numeric helpers shared by logic and rendering. */

/** Restricts `value` to the range [min, max]. */
export function clamp(value, min = 0, max = 1) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation from `a` to `b`. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Euclidean distance between two points. */
export function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}
