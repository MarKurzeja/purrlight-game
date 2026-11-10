/**
 * The valley as low-poly meshes: terrain (village meadow, forested hills, the ring of peaks),
 * conifer forest, meadow details, the lake and clouds. Built once per season. Pure: returns
 * mesh data for the renderer to upload.
 */
import { lerp } from '../core/math.js';
import { createRng } from '../core/random.js';
import { MeshBuilder, hexToVec3 } from '../engine/gl/geometry.js';
import { mat4Transform } from '../engine/gl/math3d.js';
import { SEASON_PALETTES } from './palettes.js';
import {
  LAKE_SHAPE,
  WATER_LEVEL,
  heightAt,
  lakeDistance,
  layeredNoise,
  pathAmount,
  smoothNoise,
  toX,
  toZ,
} from './space.js';
import { LANDMARKS } from '../data/village.js';

/** @typedef {import('../engine/gl/geometry.js').MeshData} MeshData */
/** @typedef {[number, number, number]} Rgb */

/** A colour from a hex ramp, `value` 0..1 picks the step, `jitter` varies brightness a little. */
export function rampColor(ramp, value, jitter = 0) {
  const index = Math.min(ramp.length - 1, Math.max(0, Math.floor(value * ramp.length)));
  const rgb = hexToVec3(ramp[index]);
  const k = 1 + jitter;
  return /** @type {Rgb} */ (rgb.map((v) => Math.min(1, v * k)));
}

const SNOW = ['#c4d4ec', '#dce6f4', '#eef3fb', '#ffffff'];

/** Above this height the mountains are snowy. */
export function snowLine(seasonId) {
  return 52 - SEASON_PALETTES[seasonId].snow * 20;
}

/** Terrain colour for a triangle centred at (X, Y, Z) with normal n. */
function terrainColor(seasonId, X, Y, Z, n) {
  const palette = SEASON_PALETTES[seasonId];
  const slope = 1 - n[1];
  const v = layeredNoise(X * 0.06 + 3, Z * 0.06);
  const jitter = (smoothNoise(X * 0.9, Z * 0.9) - 0.5) * 0.06;
  const winter = seasonId === 'winter';

  if (lakeDistance(X, Z) < 1.12 && Y < 0.05) {
    return rampColor(winter ? SNOW : ['#8f8670', '#a89a7c', '#c2b08a'], v, jitter);
  }
  if (Y > snowLine(seasonId) - v * 12 && slope < 0.7) return rampColor(SNOW, 0.4 + v * 0.6, jitter);
  if (slope > 0.5 || (Z < -48 && slope > 0.22)) {
    return rampColor(palette.rock, lerp(0.15, 0.9, v) - slope * 0.3, jitter);
  }
  if (Z < -48) return rampColor(palette.forest, v * 0.6, jitter);
  const path = pathAmount(X, Z);
  if (path > 0.45) return rampColor(palette.path, v, jitter);
  if (Z < -13 || Math.abs(X) > 80) {
    // Forest floor on the hills: the meadow, a shade darker.
    return rampColor(palette.meadow, v * 0.5, jitter - 0.08);
  }
  return rampColor(palette.meadow, lerp(0.15, 1, v), jitter);
}

/**
 * Terrain: a fine grid around the village and a coarse one for the far mountains.
 * @returns {{ near: MeshData, far: MeshData }}
 */
export function buildTerrain(seasonId) {
  const color = (x, y, z, n) => terrainColor(seasonId, x, y, z, n);
  const near = new MeshBuilder().terrain(-124, 124, -50, 36, 124, 43, heightAt, color).build();
  const far = new MeshBuilder().terrain(-330, 330, -270, -44, 88, 38, heightAt, color).build();
  return { near, far };
}

/** One conifer, standing on (X, Y, Z). */
function conifer(b, X, Y, Z, size, colors, snowy) {
  b.cylinder(
    mat4Transform({ x: X, y: Y - 0.3, z: Z, sx: 0.16 * size, sy: 0.9 * size, sz: 0.16 * size }),
    '#5a4234',
    {
      segments: 5,
      caps: false,
    },
  );
  for (let k = 0; k < 3; k++) {
    const radius = (0.95 - k * 0.24) * size;
    const color = snowy && k === 2 ? '#eef3fb' : colors[Math.min(colors.length - 1, k)];
    b.cylinder(
      mat4Transform({
        x: X,
        y: Y + (0.45 + k * 0.62) * size,
        z: Z,
        ry: k + X,
        sx: radius,
        sy: 1.15 * size,
        sz: radius,
      }),
      color,
      { segments: 7, topRadius: 0, caps: k === 0 },
    );
  }
}

/** Is (X, Z) somewhere a tree may grow? */
function treeAllowed(X, Z) {
  if (lakeDistance(X, Z) < 1.45) return false;
  if (Math.hypot(X - toX(LANDMARKS.lanternTower.x), Z - toZ(LANDMARKS.lanternTower.y)) < 6) {
    return false;
  }
  if (Z > 18) return false;
  const village = Math.abs(X) < 78;
  if (village && Z > -21) return false;
  return true;
}

/** Conifer forest on the hills and valley sides. Autumn turns some to golden larches. */
export function buildForest(seasonId) {
  const rng = createRng(1234);
  const palette = SEASON_PALETTES[seasonId];
  const snowy = seasonId === 'winter';
  const b = new MeshBuilder();
  let planted = 0;
  for (let tries = 0; tries < 6000 && planted < 300; tries++) {
    const X = lerp(-140, 140, rng());
    const Z = lerp(-78, 18, Math.pow(rng(), 0.8));
    if (!treeAllowed(X, Z)) continue;
    const Y = heightAt(X, Z);
    if (Y > snowLine(seasonId) - 10) continue;
    // Thicker forest in clumps.
    if (smoothNoise(X * 0.09, Z * 0.09) < (Z > -40 ? 0.5 : 0.35)) continue;
    const size = lerp(1.2, 2.3, rng()) * (Z < -45 ? 1.3 : 1);
    const larch = palette.larches && rng() < 0.4;
    const shade = Math.floor(rng() * 2);
    const colors = larch
      ? ['#b0702a', '#dc9c34', '#f2c44c']
      : palette.forest.slice(shade, shade + 3);
    conifer(b, X, Y, Z, size, colors, snowy);
    planted += 1;
  }
  return b.build();
}

/** Grass tufts, flowers and boulders on the meadow. */
export function buildMeadowDetails(seasonId) {
  const rng = createRng(77);
  const palette = SEASON_PALETTES[seasonId];
  const winter = seasonId === 'winter';
  const b = new MeshBuilder();
  for (let i = 0; i < 900; i++) {
    const X = lerp(-118, 118, rng());
    const Z = lerp(-14, 30, rng());
    if (lakeDistance(X, Z) < 1.15 || pathAmount(X, Z) > 0.3) continue;
    const Y = heightAt(X, Z);
    const roll = rng();
    if (roll < 0.05) {
      const s = lerp(0.25, 0.8, rng());
      b.sphere(
        mat4Transform({ x: X, y: Y, z: Z, sx: s * 1.3, sy: s * 0.7, sz: s, ry: rng() * 6 }),
        rampColor(palette.rock, 0.5 + rng() * 0.5),
        {
          segments: 6,
          rings: 3,
        },
      );
      if (winter) {
        b.sphere(
          mat4Transform({ x: X, y: Y + s * 0.45, z: Z, sx: s * 1.1, sy: s * 0.3, sz: s * 0.85 }),
          '#ffffff',
          { segments: 6, rings: 3 },
        );
      }
    } else if (!winter && roll < 0.42 && palette.flowers.length) {
      const color = palette.flowers[Math.floor(rng() * palette.flowers.length)];
      b.cylinder(mat4Transform({ x: X, y: Y, z: Z, sx: 0.02, sy: 0.32, sz: 0.02 }), '#4f8a48', {
        segments: 3,
        caps: false,
      });
      b.sphere(mat4Transform({ x: X, y: Y + 0.34, z: Z, s: 0.09 }), color, {
        segments: 4,
        rings: 2,
      });
    } else if (!winter) {
      const h = lerp(0.25, 0.6, rng());
      b.cylinder(
        mat4Transform({ x: X, y: Y - 0.05, z: Z, sx: 0.16, sy: h, sz: 0.16, ry: rng() * 6 }),
        rampColor(palette.meadow, rng() * 0.6, -0.12),
        {
          segments: 3,
          topRadius: 0,
          caps: false,
        },
      );
    } else if (roll < 0.6) {
      const s = lerp(0.4, 1.1, rng());
      b.sphere(
        mat4Transform({ x: X, y: Y - s * 0.2, z: Z, sx: s * 1.6, sy: s * 0.45, sz: s }),
        '#f4f8fd',
        { segments: 6, rings: 3 },
      );
    }
  }
  // Reeds along the lake's shore.
  if (!winter) {
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const r = lerp(0.96, 1.08, rng());
      const X = LAKE_SHAPE.x + Math.cos(a) * LAKE_SHAPE.rx * r;
      const Z = LAKE_SHAPE.z + Math.sin(a) * LAKE_SHAPE.rz * r;
      if (Z > LAKE_SHAPE.z + LAKE_SHAPE.rz * 0.6 && rng() < 0.7) continue;
      const h = lerp(0.8, 1.6, rng());
      b.cylinder(
        mat4Transform({
          x: X,
          y: WATER_LEVEL - 0.1,
          z: Z,
          sx: 0.05,
          sy: h,
          sz: 0.05,
          rz: (rng() - 0.5) * 0.3,
        }),
        '#6f8a4a',
        {
          segments: 3,
          caps: false,
        },
      );
      if (rng() < 0.5) {
        b.cylinder(
          mat4Transform({
            x: X,
            y: WATER_LEVEL - 0.1 + h * 0.75,
            z: Z,
            sx: 0.08,
            sy: 0.3,
            sz: 0.08,
          }),
          '#7a5236',
          { segments: 4 },
        );
      }
    }
  }
  return b.build();
}

/** The lake's surface (ice in winter). */
export function buildLake(seasonId) {
  const b = new MeshBuilder();
  const segments = 48;
  const color = seasonId === 'winter' ? '#cfe2ef' : '#4a9bbb';
  const rim = seasonId === 'winter' ? '#e6f0f8' : '#6cb6cc';
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p = (a, r) =>
      /** @type {Rgb} */ ([
        LAKE_SHAPE.x + Math.cos(a) * LAKE_SHAPE.rx * r,
        WATER_LEVEL,
        LAKE_SHAPE.z + Math.sin(a) * LAKE_SHAPE.rz * r,
      ]);
    b.triangle([LAKE_SHAPE.x, WATER_LEVEL, LAKE_SHAPE.z], p(a1, 0.8), p(a0, 0.8), color);
    b.quad(p(a0, 0.8), p(a1, 0.8), p(a1, 1.12), p(a0, 1.12), rim);
  }
  return b.build();
}

/** A few puffy clouds, each its own mesh so they can drift. */
export function buildClouds() {
  const rng = createRng(9);
  return Array.from({ length: 7 }, (_, i) => {
    const b = new MeshBuilder();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < puffs; k++) {
      const s = lerp(4, 8, rng());
      b.sphere(
        mat4Transform({
          x: k * 5 - puffs * 2.5,
          y: rng() * 2,
          z: rng() * 4,
          sx: s * 1.4,
          sy: s * 0.7,
          sz: s,
        }),
        '#ffffff',
        {
          segments: 7,
          rings: 4,
        },
      );
    }
    return {
      mesh: b.build(),
      x: i * 90 - 300 + rng() * 40,
      y: lerp(62, 86, rng()),
      z: lerp(-110, -170, rng()),
    };
  });
}
