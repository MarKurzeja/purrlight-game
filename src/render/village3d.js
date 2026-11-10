/**
 * The village in 3D: Swiss chalets with shutters and flower boxes, the five buildings you
 * rebuild (as ruins until then), the Great Lantern on its knoll, and the props around the
 * square. Pure: returns mesh data, plus the points where smoke and light come from.
 */
import { BUILDING_LINE } from '../config.js';
import { BUILDING_LAYOUT, COTTAGES, DECOR, LANDMARKS, NOOKS } from '../data/village.js';
import { MeshBuilder, hexToVec3 } from '../engine/gl/geometry.js';
import { mat4Transform } from '../engine/gl/math3d.js';
import { LAKE_SHAPE, WATER_LEVEL, heightAt, toX, toZ } from './space.js';

/**
 * @typedef {import('../engine/gl/geometry.js').MeshData} MeshData
 * @typedef {[number, number, number]} Vec3
 * @typedef {{ built: Record<string, any>, lantern: Record<string, any>, lanternLit: boolean,
 *   nooks: number, decor: string[] }} VillageState
 * @typedef {{ solid: MeshData, windows: MeshData, glass: MeshData, chimneys: Vec3[],
 *   lanternLight: Vec3, flagTop: Vec3 }} VillageMeshes
 */

/** Where the houses' front walls stand (metres). */
const FRONT_Z = toZ(BUILDING_LINE) + 0.4;
const T = (x, y, z, sx, sy, sz, ry = 0) => mat4Transform({ x, y, z, sx, sy, sz, ry });

const fade = (hex, amount) =>
  /** @type {Vec3} */ (hexToVec3(hex).map((v) => v * (1 - amount) + 0.62 * amount));

/** A pitched roof shell with its ridge running front to back. */
function roofShell(b, cx, eaveY, cz, span, length, height, color, underside) {
  const h = span / 2;
  const l = length / 2;
  const p = (x, y, z) => /** @type {Vec3} */ ([cx + x, eaveY + y, cz + z]);
  // Outer slopes.
  b.quad(p(-h, 0, l), p(0, height, l), p(0, height, -l), p(-h, 0, -l), color);
  b.quad(p(0, height, l), p(h, 0, l), p(h, 0, -l), p(0, height, -l), color);
  // Underside (seen under the eaves).
  b.quad(
    p(-h, -0.02, -l),
    p(0, height - 0.02, -l),
    p(0, height - 0.02, l),
    p(-h, -0.02, l),
    underside,
  );
  b.quad(
    p(0, height - 0.02, -l),
    p(h, -0.02, -l),
    p(h, -0.02, l),
    p(0, height - 0.02, l),
    underside,
  );
  // Thick fascia boards along the gable edge.
  for (const z of [l, -l]) {
    const dz = z > 0 ? 0.001 : -0.001;
    b.quad(
      p(-h, -0.18, z + dz),
      p(0, height - 0.18, z + dz),
      p(0, height, z + dz),
      p(-h, 0, z + dz),
      underside,
    );
    b.quad(
      p(0, height - 0.18, z + dz),
      p(h, -0.18, z + dz),
      p(h, 0, z + dz),
      p(0, height, z + dz),
      underside,
    );
  }
}

/**
 * A window on a front wall at z: frame, glass (into the windows mesh), shutters and flower box.
 * Closed houses keep their shutters shut.
 */
function frontWindow(m, x, y, z, { shutters, open, flowers = true, w = 0.8, h = 0.95 }) {
  const { solid, windows } = m;
  solid.box(T(x, y, z + 0.04, w + 0.18, h + 0.18, 0.1), '#f4ecdc');
  if (open) {
    windows.box(T(x, y, z + 0.08, w, h, 0.06), '#3d5470');
    solid.box(T(x, y, z + 0.13, 0.06, h, 0.04), '#f4ecdc');
    solid.box(T(x, y + 0.05, z + 0.13, w, 0.05, 0.04), '#f4ecdc');
    for (const side of [-1, 1]) {
      solid.box(T(x + side * (w / 2 + 0.26), y, z + 0.09, 0.42, h + 0.1, 0.06), shutters);
      solid.box(
        T(x + side * (w / 2 + 0.26), y, z + 0.13, 0.3, 0.06, 0.02),
        hexToVec3('#ffffff').map((v) => v * 0.9),
      );
    }
    if (flowers) {
      solid.box(T(x, y - h / 2 - 0.2, z + 0.22, w + 0.3, 0.24, 0.32), '#7a4e34');
      for (let i = 0; i < 5; i++) {
        const fx = x - w / 2 + 0.05 + (i * (w - 0.1)) / 4;
        solid.sphere(
          mat4Transform({ x: fx, y: y - h / 2 - 0.02, z: z + 0.24, s: 0.13 }),
          '#4f8a48',
          { segments: 5, rings: 3 },
        );
        solid.sphere(
          mat4Transform({ x: fx + 0.03, y: y - h / 2 + 0.08, z: z + 0.3, s: 0.08 }),
          i % 2 ? '#e8484a' : '#f27a92',
          {
            segments: 4,
            rings: 2,
          },
        );
      }
    }
  } else {
    solid.box(T(x, y, z + 0.09, w + 0.1, h + 0.1, 0.06), fade(shutters, 0.45));
    solid.box(T(x, y, z + 0.13, 0.04, h + 0.1, 0.02), '#4e3a30');
    solid.box(T(x, y, z + 0.14, w + 0.2, 0.08, 0.04), '#6a5446');
  }
}

/**
 * A Swiss chalet: stone plinth, white plaster ground floor, timber upper floor, deep eaves.
 * @returns {{ chimney: Vec3 | null, ridge: number }} the chimney top (if smoking) and ridge height
 */
function chalet(m, o) {
  const { solid, windows } = m;
  const { cx, width: W, height, open, snowy } = o;
  const D = o.depth ?? 5.2;
  const cz = FRONT_Z - D / 2;
  const front = cz + D / 2;
  const groundFloor = 2.1;
  const upper = Math.max(1.2, height - 2.6 - W * 0.36);
  const wallTop = 0.55 + groundFloor + upper;
  const roofSpan = W + 1.5;
  const roofHeight = W * 0.38 + 0.4;
  const roofLength = D + 1.3;
  const plaster = open ? '#f1e9da' : fade('#e6dccb', 0.3);
  const wood = open ? (o.wood ?? '#8a5638') : fade(o.wood ?? '#8a5638', 0.45);
  const roofColor = snowy ? '#f4f8fc' : open ? (o.roof ?? '#6a4a3e') : '#6f6a6a';

  solid.box(T(cx, -0.4, cz, W + 0.3, 1.9, D + 0.3), { top: '#a59f96', side: '#9a948a' });
  solid.box(T(cx, 0.55 + groundFloor / 2, cz, W, groundFloor, D), plaster);
  solid.box(T(cx, 0.55 + groundFloor + upper / 2, cz, W + 0.16, upper, D + 0.16), wood);
  // Timber bands between the floors.
  solid.box(T(cx, 0.55 + groundFloor, cz, W + 0.24, 0.16, D + 0.24), '#5e3a28');
  // Gable wall under the roof, then the roof itself.
  const eave = wallTop + 0.06 - roofHeight * (1 - W / roofSpan);
  solid.gable(
    mat4Transform({
      x: cx,
      y: wallTop,
      z: cz,
      sx: D + 0.16,
      sy: roofHeight * (W / roofSpan),
      sz: W + 0.16,
      ry: Math.PI / 2,
    }),
    wood,
    wood,
  );
  roofShell(solid, cx, eave, cz, roofSpan, roofLength, roofHeight, roofColor, '#4e3428');
  if (snowy) {
    roofShell(
      solid,
      cx,
      eave + 0.12,
      cz,
      roofSpan + 0.1,
      roofLength + 0.1,
      roofHeight,
      '#ffffff',
      '#dfe8f2',
    );
  }

  // A little round window in the gable.
  if (open) {
    windows.cylinder(
      mat4Transform({
        x: cx,
        y: wallTop + roofHeight * 0.32,
        z: front + 0.1,
        sx: 0.32,
        sy: 0.08,
        sz: 0.32,
        rx: Math.PI / 2,
      }),
      '#3d5470',
      { segments: 8 },
    );
  }

  // Ground floor: door in the middle, a window either side.
  const doorX = cx + (o.doorOffset ?? 0);
  solid.box(T(doorX, 0.55 + 0.9, front + 0.05, 1.1, 1.8, 0.1), '#e8dfcf');
  solid.box(T(doorX, 0.55 + 0.85, front + 0.08, 0.86, 1.7, 0.1), open ? '#7a4a30' : '#54403a');
  solid.box(T(doorX + 0.25, 0.55 + 0.85, front + 0.15, 0.08, 0.08, 0.06), '#e0c070');
  const lower = 0.55 + groundFloor * 0.55;
  for (const side of [-1, 1]) {
    const wx = cx + side * W * 0.3;
    if (Math.abs(wx - doorX) > 1.1) {
      frontWindow(m, wx, lower, front, { shutters: o.shutters, open, w: 0.75, h: 0.85 });
    }
  }
  // Upper floor: two or three windows and, on wide houses, a balcony.
  const upperY = 0.55 + groundFloor + upper * 0.5;
  const count = W > 6.4 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const wx = cx + (i - (count - 1) / 2) * (W / (count + 0.4));
    frontWindow(m, wx, upperY, front + 0.08, {
      shutters: o.shutters,
      open,
      flowers: !(W > 6.4 && open),
      w: 0.7,
      h: 0.8,
    });
  }
  if (W > 6.4 && open) {
    const by = 0.55 + groundFloor + 0.1;
    solid.box(T(cx, by, front + 0.6, W - 0.8, 0.12, 1.0), '#6e4630');
    solid.box(T(cx, by + 0.85, front + 1.05, W - 0.8, 0.1, 0.1), '#6e4630');
    for (let i = 0; i <= 12; i++) {
      solid.box(
        T(cx - (W - 0.9) / 2 + (i * (W - 0.9)) / 12, by + 0.45, front + 1.05, 0.1, 0.75, 0.06),
        i % 2 ? '#8a5a3c' : '#6e4630',
      );
    }
    for (let i = 0; i < 6; i++) {
      solid.sphere(
        mat4Transform({
          x: cx - W / 2 + 0.8 + i * ((W - 1.6) / 5),
          y: by + 1.0,
          z: front + 1.12,
          s: 0.16,
        }),
        i % 2 ? '#e8484a' : '#f6f0f2',
        {
          segments: 5,
          rings: 3,
        },
      );
    }
  }
  // Side windows.
  for (const side of [-1, 1]) {
    const x = cx + side * (W / 2 + 0.1);
    if (open) windows.box(T(x, upperY, cz + 0.6, 0.06, 0.75, 0.7), '#3d5470');
    else solid.box(T(x, upperY, cz + 0.6, 0.08, 0.8, 0.75), fade(o.shutters, 0.45));
  }
  const ridge = eave + roofHeight;
  if (o.chimney === false) return { chimney: null, ridge };
  const chimneyX = cx + W * 0.24;
  const roofAt = eave + roofHeight * (1 - Math.abs(chimneyX - cx) / (roofSpan / 2));
  solid.box(T(chimneyX, roofAt + 0.45, cz - D * 0.15, 0.6, 1.5, 0.6), '#b4aca2');
  solid.box(
    T(chimneyX, roofAt + 1.25, cz - D * 0.15, 0.78, 0.16, 0.78),
    snowy ? '#ffffff' : '#8e867c',
  );
  return { chimney: open ? [chimneyX, roofAt + 1.4, cz - D * 0.15] : null, ridge };
}

/** An unbuilt site: an old foundation, a few scorched beams, planks and a tarp. */
function ruin(m, cx, width) {
  const { solid } = m;
  const D = 5;
  const cz = FRONT_Z - D / 2;
  solid.box(T(cx, -0.3, cz, width + 0.3, 1.3, D + 0.3), { top: '#a59f96', side: '#8e887e' });
  solid.box(T(cx - width / 2 + 0.3, 0.9, cz, 0.5, 1.6, D), '#b4aca2');
  solid.box(T(cx, 0.75, cz - D / 2 + 0.25, width, 1.0 + (width % 1), 0.5), '#b4aca2');
  solid.box(T(cx + width / 2 - 0.3, 0.6, cz - 0.6, 0.5, 0.9, D - 1.2), '#aaa298');
  for (const [dx, h] of [
    [-0.32, 3.2],
    [0.3, 2.4],
  ]) {
    solid.box(
      mat4Transform({
        x: cx + dx * width,
        y: 0.35 + h / 2,
        z: cz + 1.2,
        sx: 0.2,
        sy: h,
        sz: 0.2,
        rz: dx * 0.2,
      }),
      '#4e3a30',
    );
  }
  for (let i = 0; i < 4; i++) {
    solid.box(
      mat4Transform({
        x: cx + 1.2,
        y: 0.4 + i * 0.13,
        z: FRONT_Z + 0.6,
        sx: 2.6,
        sy: 0.12,
        sz: 0.36,
        ry: i * 0.12,
      }),
      i % 2 ? '#c8a676' : '#b48e60',
    );
  }
  solid.gable(
    mat4Transform({ x: cx - 1.4, y: 0.32, z: FRONT_Z + 0.3, sx: 1.6, sy: 0.8, sz: 1.3 }),
    '#c9b48a',
    '#a8956e',
  );
  // A sign: "to be rebuilt".
  solid.box(T(cx + width / 2 + 0.2, 0.7, FRONT_Z + 1.2, 0.1, 1.4, 0.1), '#6a4c3c');
  solid.box(T(cx + width / 2 + 0.2, 1.3, FRONT_Z + 1.25, 0.9, 0.5, 0.08), '#e8dcc4');
}

/** The extra parts that make each rebuilt building itself. */
function buildingExtras(m, b, cx, width, snowy, ridge) {
  const { solid, windows } = m;
  switch (b.id) {
    case 'hut': {
      // A jetty out onto the lake, and a rack of drying nets.
      const jettyZ = LAKE_SHAPE.z + 1.4;
      solid.box(T(cx - width / 2 - 3.6, WATER_LEVEL + 0.32, jettyZ, 7.6, 0.14, 1.4), '#a07a54');
      for (const dx of [-6.6, -4.4, -2.2]) {
        for (const dz of [-0.6, 0.6]) {
          solid.cylinder(
            T(cx - width / 2 + dx, WATER_LEVEL - 0.8, jettyZ + dz, 0.08, 1.2, 0.08),
            '#6a4c3c',
            { segments: 5 },
          );
        }
      }
      solid.box(T(cx + width / 2 + 0.8, 1.0, FRONT_Z - 1, 0.08, 2.0, 0.08), '#6a4c3c');
      solid.box(T(cx + width / 2 + 0.8, 1.9, FRONT_Z - 2, 0.06, 0.06, 2.2), '#6a4c3c');
      solid.box(T(cx + width / 2 + 0.8, 1.4, FRONT_Z - 2, 0.04, 0.9, 2.0), '#c9d2c8');
      break;
    }
    case 'bakery': {
      // A pretzel sign on a bracket.
      const sx = cx + width / 2 + 0.6;
      solid.box(T(sx - 0.3, 3.1, FRONT_Z + 0.2, 0.9, 0.08, 0.08), '#3e3036');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        solid.sphere(
          mat4Transform({
            x: sx + Math.cos(a) * 0.32,
            y: 2.6 + Math.sin(a) * 0.3,
            z: FRONT_Z + 0.2,
            s: 0.11,
          }),
          '#c8843e',
          {
            segments: 5,
            rings: 3,
          },
        );
      }
      solid.box(T(cx - width / 2 - 0.5, 0.45, FRONT_Z + 0.6, 0.6, 0.9, 0.6), '#9a6a42');
      break;
    }
    case 'library': {
      // A school-house bell tower with a clock.
      const tx = cx + width / 2 - 1.1;
      const tz = FRONT_Z + 0.3;
      solid.box(T(tx, 4.6, tz, 2.0, 9.2, 2.0), '#efe6d6');
      solid.box(T(tx, 8.2, tz, 2.1, 0.18, 2.1), '#5e3a28');
      windows.box(T(tx, 8.8, tz + 1.02, 0.5, 0.8, 0.05), '#3d5470');
      solid.cylinder(
        mat4Transform({ x: tx, y: 9.2, z: tz, sx: 1.6, sy: 2.6, sz: 1.6, ry: Math.PI / 4 }),
        snowy ? '#f4f8fc' : '#b0483e',
        {
          segments: 4,
          topRadius: 0,
        },
      );
      solid.cylinder(
        mat4Transform({
          x: tx,
          y: 6.4,
          z: tz + 1.0,
          sx: 0.55,
          sy: 0.08,
          sz: 0.55,
          rx: Math.PI / 2,
        }),
        '#fbf6e8',
        { segments: 10 },
      );
      solid.box(
        mat4Transform({ x: tx, y: 6.55, z: tz + 1.1, sx: 0.06, sy: 0.36, sz: 0.03 }),
        '#33415e',
      );
      solid.box(
        mat4Transform({ x: tx + 0.1, y: 6.4, z: tz + 1.1, sx: 0.26, sy: 0.05, sz: 0.03 }),
        '#33415e',
      );
      break;
    }
    case 'observatory': {
      const top = ridge - 0.2;
      const z = FRONT_Z - 2.6;
      solid.sphere(
        mat4Transform({ x: cx, y: top - 0.1, z, sx: 1.6, sy: 1.4, sz: 1.6 }),
        '#b8d0e0',
        { segments: 10, rings: 6 },
      );
      solid.box(T(cx, top - 0.1, z, 3.4, 0.4, 3.4), '#7c97ad');
      solid.cylinder(
        mat4Transform({
          x: cx + 0.4,
          y: top + 0.6,
          z: z + 0.2,
          sx: 0.22,
          sy: 2.0,
          sz: 0.22,
          rz: -0.9,
        }),
        '#d6b56a',
        { segments: 6 },
      );
      break;
    }
    default:
      break;
  }
}

/** The greenhouse: a white iron frame, glass panes and plants inside. */
function greenhouse(m, cx, width, open) {
  const { solid, glass } = m;
  const D = 4.6;
  const cz = FRONT_Z - D / 2;
  const H = 2.6;
  solid.box(T(cx, -0.2, cz, width + 0.2, 0.9, D + 0.2), '#a59f96');
  const frame = open ? '#f6f6f0' : '#8a8a84';
  for (let i = 0; i <= 6; i++) {
    const x = cx - width / 2 + (i * width) / 6;
    for (const z of [cz - D / 2, cz + D / 2]) {
      solid.box(T(x, 0.25 + H / 2, z, 0.12, H, 0.12), frame);
    }
  }
  solid.box(T(cx, 0.25 + H, cz, width + 0.1, 0.12, D + 0.1), frame);
  solid.gable(
    mat4Transform({ x: cx, y: 0.25 + H, z: cz, sx: width, sy: 1.6, sz: D }),
    open ? '#d8f0ea' : '#a8b4b0',
    frame,
  );
  if (open) {
    for (let i = 0; i < 9; i++) {
      solid.sphere(
        mat4Transform({
          x: cx - width / 2 + 0.8 + (i % 5) * ((width - 1.6) / 4),
          y: 0.8 + (i % 2) * 0.2,
          z: cz + (i < 5 ? 1 : -1),
          s: 0.55,
        }),
        i % 3 ? '#4f9a50' : '#6fb26a',
        {
          segments: 6,
          rings: 4,
        },
      );
      if (i % 2) {
        solid.sphere(
          mat4Transform({
            x: cx - width / 2 + 0.9 + (i % 5) * ((width - 1.6) / 4),
            y: 1.3,
            z: cz + (i < 5 ? 1.3 : -0.7),
            s: 0.14,
          }),
          '#f25e54',
          { segments: 4, rings: 2 },
        );
      }
    }
  }
  glass.box(T(cx, 0.25 + H / 2, cz, width - 0.05, H, D - 0.05), open ? '#cdeee8' : '#9aa6a2');
}

/** The Great Lantern on its knoll. Returns where the light shines from. */
function lanternTower(m, state, snowy) {
  const { solid, glass, windows } = m;
  const X = toX(LANDMARKS.lanternTower.x);
  const Z = toZ(LANDMARKS.lanternTower.y);
  const Y = heightAt(X, Z) - 0.3;
  solid.cylinder(T(X, Y - 1, Z, 2.2, 1.6, 2.2), '#9a948a', { segments: 10 });
  solid.cylinder(T(X, Y, Z, 1.6, 7.4, 1.6), '#d6cfc0', { segments: 10, topRadius: 0.82 });
  for (let i = 0; i < 4; i++) {
    solid.box(
      mat4Transform({
        x: X,
        y: Y + 1.5 + i * 1.6,
        z: Z,
        sx: 0.2,
        sy: 0.6,
        sz: 2.6 - i * 0.18,
        ry: i * 1.3,
      }),
      '#b8b0a2',
    );
  }
  solid.box(T(X, Y + 0.8, Z + 1.55, 0.8, 1.5, 0.2), '#54403a');
  const top = Y + 7.4;
  solid.cylinder(T(X, top, Z, 1.7, 0.32, 1.7), '#8e8680', { segments: 10 });
  for (const [dx, dz] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [-0.8, 0.8],
    [0.8, 0.8],
  ]) {
    solid.box(T(X + dx, top + 1.3, Z + dz, 0.16, 2.0, 0.16), '#3e3e4e');
  }
  const light = /** @type {Vec3} */ ([X, top + 1.3, Z]);
  if (state.lantern.lens) glass.box(T(X, top + 1.3, Z, 1.5, 1.9, 1.5), '#fff2c8');
  else {
    for (const side of [-1, 1]) {
      solid.box(T(X + side * 0.76, top + 1.1, Z, 0.06, 1.4, 1.4), '#8a6a50');
    }
  }
  windows.sphere(
    mat4Transform({ x: X, y: top + 1.2, z: Z, s: 0.45 }),
    state.lanternLit ? '#ffe9a2' : '#6a7090',
    { segments: 8, rings: 5 },
  );
  if (state.lantern.wick) {
    solid.cylinder(T(X, top + 0.32, Z, 0.08, 0.6, 0.08), '#f3a982', { segments: 5 });
  }
  solid.cylinder(T(X, top + 2.3, Z, 1.4, 1.5, 1.4), snowy ? '#f4f8fc' : '#5e5868', {
    segments: 10,
    topRadius: 0,
  });
  solid.sphere(mat4Transform({ x: X, y: top + 3.9, z: Z, s: 0.2 }), '#d6b56a', {
    segments: 6,
    rings: 4,
  });
  if (state.lantern.stair) {
    for (let i = 0; i < 18; i++) {
      const a = i * 0.42 + 1.2;
      const r = 1.95 - i * 0.04;
      solid.box(
        mat4Transform({
          x: X + Math.cos(a) * r,
          y: Y + 0.3 + i * 0.4,
          z: Z + Math.sin(a) * r,
          sx: 0.5,
          sy: 0.12,
          sz: 0.9,
          ry: -a,
        }),
        '#e0d8ca',
      );
    }
  }
  // Stepping stones up the knoll from the street.
  const from = [toX(LANDMARKS.lantern.x), toZ(LANDMARKS.lantern.y)];
  for (let i = 0; i < 7; i++) {
    const k = i / 7;
    const x = from[0] + (X - from[0]) * k + Math.sin(i) * 0.4;
    const z = from[1] + (Z + 2 - from[1]) * k;
    solid.cylinder(T(x, heightAt(x, z) - 0.1, z, 0.55, 0.2, 0.45), '#c4beb2', { segments: 6 });
  }
  return light;
}

/** Fountain, flagpole, campfire ring and benches, goat pasture, front fence. */
function squareProps(m, seasonId) {
  const { solid, windows } = m;
  const winter = seasonId === 'winter';
  const fx = toX(LANDMARKS.fountain.x);
  const fz = toZ(LANDMARKS.fountain.y);
  solid.cylinder(T(fx, -0.1, fz, 1.75, 0.7, 1.75), '#bdb6aa', { segments: 12 });
  windows.cylinder(T(fx, 0.45, fz, 1.5, 0.06, 1.5), winter ? '#dbe9f4' : '#5aa6c4', {
    segments: 12,
  });
  solid.cylinder(T(fx, 0, fz, 0.26, 1.7, 0.26), '#bdb6aa', { segments: 8 });
  solid.cylinder(T(fx, 1.4, fz, 0.55, 0.3, 0.55), '#bdb6aa', { segments: 10, topRadius: 1.4 });
  solid.sphere(mat4Transform({ x: fx, y: 1.95, z: fz, s: 0.2 }), '#a8a29a', {
    segments: 6,
    rings: 4,
  });

  const px = toX(LANDMARKS.flag.x);
  const pz = toZ(LANDMARKS.flag.y);
  solid.cylinder(T(px, 0, pz, 0.08, 5.6, 0.08), '#e6e2da', { segments: 6 });
  solid.sphere(mat4Transform({ x: px, y: 5.65, z: pz, s: 0.13 }), '#d6b56a', {
    segments: 6,
    rings: 4,
  });

  const cx = toX(LANDMARKS.fire.x);
  const cz = toZ(LANDMARKS.fire.y);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    solid.sphere(
      mat4Transform({
        x: cx + Math.cos(a) * 0.95,
        y: 0.05,
        z: cz + Math.sin(a) * 0.95,
        sx: 0.32,
        sy: 0.22,
        sz: 0.28,
        ry: a,
      }),
      '#9a948a',
      {
        segments: 5,
        rings: 3,
      },
    );
  }
  for (let i = 0; i < 3; i++) {
    solid.cylinder(
      mat4Transform({
        x: cx,
        y: 0.15,
        z: cz,
        sx: 0.13,
        sy: 1.5,
        sz: 0.13,
        rz: Math.PI / 2 - 0.25,
        ry: (i * Math.PI * 2) / 3,
      }),
      '#6e4830',
      {
        segments: 5,
      },
    );
  }
  // Log benches around the fire.
  for (const a of [3.5, 4.75, 5.95]) {
    const x = cx + Math.cos(a) * 3.4;
    const z = cz + Math.sin(a) * 2.8;
    const along = -a + Math.PI / 2;
    const ax = Math.cos(along) * 1.1;
    const az = -Math.sin(along) * 1.1;
    solid.cylinder(
      mat4Transform({
        x: x - ax,
        y: 0.3,
        z: z - az,
        sx: 0.3,
        sy: 2.2,
        sz: 0.3,
        rz: -Math.PI / 2,
        ry: along,
      }),
      '#7a5236',
      { segments: 7 },
    );
    if (winter) {
      solid.box(mat4Transform({ x, y: 0.6, z, sx: 1.8, sy: 0.1, sz: 0.4, ry: along }), '#ffffff');
    }
  }

  // The goat's pasture.
  const gx = toX(LANDMARKS.goat.x);
  const gz = toZ(LANDMARKS.goat.y) - 1.6;
  for (let i = 0; i < 9; i++) solid.box(T(gx - 4 + i * 1.1, 0.5, gz, 0.14, 1.1, 0.14), '#8a6a50');
  for (const y of [0.45, 0.85]) solid.box(T(gx + 0.4, y, gz, 9.0, 0.08, 0.06), '#a8865c');
  solid.cylinder(
    mat4Transform({ x: gx + 4.6, y: 0.5, z: gz + 1.4, sx: 0.6, sy: 1.2, sz: 0.6, rz: Math.PI / 2 }),
    winter ? '#e8eef6' : '#d8b860',
    { segments: 8 },
  );

  // A split-rail fence along the front of the meadow.
  for (let X = -26; X < 74; X += 2.2) {
    if (Math.abs(X - 8) < 3) continue;
    const z = 9.8 + Math.sin(X * 0.3) * 0.2;
    solid.box(T(X, heightAt(X, z) + 0.4, z, 0.14, 1.0, 0.14), '#8a6a50');
    solid.box(
      mat4Transform({
        x: X + 1.1,
        y: heightAt(X, z) + 0.7,
        z,
        sx: 2.2,
        sy: 0.08,
        sz: 0.08,
        rz: 0.05,
      }),
      '#a8865c',
    );
  }
}

/** Shade parasols (summer nooks) and the decorations bought at night. */
function nooksAndDecor(m, state) {
  const { solid } = m;
  for (const nook of NOOKS.slice(0, state.nooks)) {
    const x = toX(nook.x);
    const z = toZ(nook.y);
    solid.cylinder(T(x, 0, z, 0.05, 2.0, 0.05), '#8a6a50', { segments: 5 });
    solid.transformed(T(x, 1.85, z, 1.25, 0.5, 1.25), (b) => {
      for (let i = 0; i < 10; i++) {
        const a0 = (i / 10) * Math.PI * 2;
        const a1 = ((i + 1) / 10) * Math.PI * 2;
        b.triangle(
          [Math.cos(a1), 0, Math.sin(a1)],
          [Math.cos(a0), 0, Math.sin(a0)],
          [0, 1, 0],
          i % 2 ? '#f4eadb' : '#c8423c',
        );
        b.triangle(
          [Math.cos(a0), -0.01, Math.sin(a0)],
          [Math.cos(a1), -0.01, Math.sin(a1)],
          [0, 0.98, 0],
          '#8a5050',
        );
      }
    });
    solid.box(T(x, 0.03, z, 2.0, 0.06, 1.4), '#d8c9a2');
  }
  for (const item of DECOR) {
    if (!state.decor.includes(item.id)) continue;
    const x = toX(item.x);
    const z = toZ(item.y);
    if (item.kind === 'bed') {
      solid.cylinder(T(x, 0, z, 0.75, 0.32, 0.6), item.color, { segments: 10 });
      solid.cylinder(
        T(x, 0.05, z, 0.52, 0.32, 0.4),
        hexToVec3(item.color).map((v) => v * 0.55 + 0.45),
        { segments: 10 },
      );
    } else {
      solid.box(T(x, 0.08, z, 0.9, 0.16, 0.9), '#8a6a50');
      solid.cylinder(T(x, 0.1, z, 0.16, 1.7, 0.16), item.color, { segments: 7 });
      solid.box(T(x, 1.85, z, 0.7, 0.12, 0.7), '#8a6a50');
    }
  }
}

/**
 * Builds the whole village for the given progress and season.
 * @param {VillageState} state
 * @param {string} seasonId
 * @returns {VillageMeshes}
 */
export function buildVillage(state, seasonId) {
  const m = { solid: new MeshBuilder(), windows: new MeshBuilder(), glass: new MeshBuilder() };
  const snowy = seasonId === 'winter';
  /** @type {Vec3[]} */
  const chimneys = [];
  const builtCount = Object.keys(state.built).length;
  COTTAGES.forEach((c, i) => {
    const { chimney } = chalet(m, {
      cx: toX(c.x + c.w / 2),
      width: c.w * 0.1 + 1,
      height: c.h * 0.1 + 1.6,
      open: state.lanternLit || builtCount > i * 2,
      snowy,
      roof: ['#7a4a3a', '#5e5a62', '#6a4a3e'][i],
      shutters: ['#3f7a5c', '#a83a38', '#3a6a9a'][i],
      wood: ['#8a5638', '#7a4e34', '#946240'][i],
      depth: 4.8,
    });
    if (chimney) chimneys.push(chimney);
  });
  for (const b of BUILDING_LAYOUT) {
    const cx = toX(b.x + b.w / 2);
    const width = b.w * 0.1;
    if (!state.built[b.id]) {
      ruin(m, cx, width);
      continue;
    }
    if (b.id === 'greenhouse') {
      greenhouse(m, cx, width, true);
      continue;
    }
    const style = {
      hut: { shutters: '#3a6a9a', wood: '#7a5a44', depth: 4.4 },
      bakery: { shutters: '#a83a38', roof: '#7a4a3a' },
      library: { shutters: '#3f7a5c', doorOffset: -1.2, chimney: false },
      observatory: { shutters: '#3f7a5c', chimney: false },
    }[b.id];
    const { chimney, ridge } = chalet(m, {
      cx,
      width,
      height: b.h * 0.1 + 1.4,
      open: true,
      snowy,
      ...style,
    });
    if (chimney) chimneys.push(chimney);
    buildingExtras(m, b, cx, width, snowy, ridge);
  }
  const lanternLight = lanternTower(m, state, snowy);
  squareProps(m, seasonId);
  nooksAndDecor(m, state);
  return {
    solid: m.solid.build(),
    windows: m.windows.build(),
    glass: m.glass.build(),
    chimneys,
    lanternLight,
    flagTop: [toX(LANDMARKS.flag.x), 5.2, toZ(LANDMARKS.flag.y)],
  };
}
