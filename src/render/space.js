/**
 * The 3D shape of the valley, and how game coordinates map onto it.
 *
 * Game rules keep their 2D "map" coordinates: x runs along the village street (0 to
 * WORLD_WIDTH) and y is depth (GROUND_TOP at the back to GROUND_BOTTOM at the front). The 3D
 * world uses metres: X = east, Y = up, Z = towards the camera. Heights given in game pixels
 * (e.g. "a bubble 20 px above the cat") are scaled the same way.
 *
 * Everything here is pure and deterministic, so it is unit-tested.
 */
import { METRES_PER_PIXEL, WORLD_ORIGIN } from "../config.js";
import { clamp, lerp } from "../core/math.js";
import { LAKE, LANDMARKS } from "../data/village.js";

/** @typedef {[number, number, number]} Point3 */

/** Map x (game pixels) to X (metres). */
export const toX = (x) => (x - WORLD_ORIGIN.x) * METRES_PER_PIXEL;
/** Map y (game pixels, depth) to Z (metres). */
export const toZ = (y) => (y - WORLD_ORIGIN.y) * METRES_PER_PIXEL;
/** Map X (metres) back to x (game pixels). */
export const fromX = (X) => X / METRES_PER_PIXEL + WORLD_ORIGIN.x;
/** Map Z (metres) back to y (game pixels). */
export const fromZ = (Z) => Z / METRES_PER_PIXEL + WORLD_ORIGIN.y;

const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Deterministic hash noise in [0, 1). */
function hash2(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth, deterministic value noise in [0, 1]. */
export function smoothNoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  return lerp(
    lerp(hash2(xi, zi), hash2(xi + 1, zi), sx),
    lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), sx),
    sz,
  );
}

/** Three octaves of noise, in [0, 1]. */
export function layeredNoise(x, z) {
  return (
    smoothNoise(x, z) * 0.57 +
    smoothNoise(x * 2.03, z * 2.03) * 0.29 +
    smoothNoise(x * 4.1, z * 4.1) * 0.14
  );
}

/** The big peaks around the valley: [X, Z, height, radius]. */
export const PEAKS = Object.freeze([
  [-150, -150, 92, 70],
  [-78, -128, 74, 46],
  [-24, -96, 40, 30],
  [14, -158, 118, 64],
  [58, -92, 38, 28],
  [92, -122, 78, 46],
  [168, -146, 96, 70],
  [-230, -110, 70, 70],
  [240, -100, 64, 70],
]);

const LAKE_X = toX(LAKE.x);
const LAKE_Z = toZ(LAKE.y);
const LAKE_RX = LAKE.rx * METRES_PER_PIXEL;
const LAKE_RZ = LAKE.ry * METRES_PER_PIXEL;
const HILL_X = toX(LANDMARKS.lanternTower.x);
const HILL_Z = toZ(LANDMARKS.lanternTower.y);

/** The lake's ellipse in metres. */
export const LAKE_SHAPE = Object.freeze({
  x: LAKE_X,
  z: LAKE_Z,
  rx: LAKE_RX,
  rz: LAKE_RZ,
});
/** Height of the lake's surface. */
export const WATER_LEVEL = -0.32;

/** How far inside the lake a point is: < 1 inside the water. */
export function lakeDistance(X, Z) {
  return Math.hypot((X - LAKE_X) / LAKE_RX, (Z - LAKE_Z) / LAKE_RZ);
}

/** The dirt path's centre line (Z) at X, and whether the path exists there. */
export function pathCentre(X) {
  return 1.1 * Math.sin(X * 0.05) + 0.6;
}

/** 0 on open meadow, 1 in the middle of the path or a plaza. */
export function pathAmount(X, Z) {
  const onPath =
    X > LAKE_X + LAKE_RX - 6 && X < HILL_X + 2
      ? 1 - smoothstep(1.1, 1.8, Math.abs(Z - pathCentre(X)))
      : 0;
  const fire =
    1 -
    smoothstep(
      3.6,
      4.6,
      Math.hypot(X - toX(LANDMARKS.fire.x), Z - toZ(LANDMARKS.fire.y)),
    );
  const fountain =
    1 -
    smoothstep(
      3,
      3.8,
      Math.hypot(X - toX(LANDMARKS.fountain.x), Z - toZ(LANDMARKS.fountain.y)),
    );
  return Math.max(onPath, fire, fountain);
}

/**
 * Ground height in metres. The village street is flat, hills rise behind the houses, the
 * mountains ring the valley, and the lake sits in a shallow basin.
 */
export function heightAt(X, Z) {
  // Gentle undulation everywhere, fading out on the walkable street.
  const street = 1 - smoothstep(9, 13, Math.abs(Z + 0.5));
  let h = (layeredNoise(X * 0.08, Z * 0.08) - 0.5) * lerp(1.6, 0.25, street);

  // Forested hills behind the village.
  const back = smoothstep(-14, -60, Z);
  h += back * (2 + layeredNoise(X * 0.035 + 7, Z * 0.035) * 6);

  // Valley sides beyond both ends of the street.
  const side = smoothstep(78, 120, Math.abs(X));
  h += side * (6 + layeredNoise(X * 0.05, Z * 0.05 + 3) * 10);

  // The ring of peaks: conical summits plus craggy ridges.
  const far = smoothstep(-40, -95, Z);
  if (far > 0) {
    let peak = 0;
    for (const [px, pz, height, radius] of PEAKS) {
      const d = Math.hypot(X - px, Z - pz) / radius;
      if (d < 1) peak = Math.max(peak, height * Math.pow(1 - d, 1.25));
    }
    const ridge = 1 - Math.abs(layeredNoise(X * 0.02, Z * 0.02) * 2 - 1);
    h += far * (peak * 0.55 + ridge * 12 + 3);
  }

  // The lantern's knoll.
  h += 3.2 * Math.exp(-((X - HILL_X) ** 2 + (Z - HILL_Z) ** 2) / 42);

  // The lake basin.
  const lake = lakeDistance(X, Z);
  if (lake < 1.35) h = lerp(h, -1.4, smoothstep(1.35, 0.75, lake));
  return h;
}

/**
 * A game position (x, y in game pixels) plus a height above the ground (game pixels), in metres.
 * @returns {Point3}
 */
export function worldPoint(x, y, height = 0) {
  const X = toX(x);
  const Z = toZ(y);
  return [
    X,
    Math.max(heightAt(X, Z), WATER_LEVEL) + height * METRES_PER_PIXEL,
    Z,
  ];
}
