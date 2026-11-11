/**
 * Characters as little low-poly rigs: cats (with coat patterns, poses and hats), the player
 * and Clover the goat. Each model is a handful of reusable unit meshes drawn with per-part
 * transforms, so poses can animate every frame without rebuilding geometry.
 *
 * Models face +X in their own space, stand on y = 0 and are about 1 m tall (cats) or 2.5 m
 * (the player). Drawing goes through a small `Painter` interface, so this module never touches
 * WebGL directly.
 */
import { MeshBuilder, hexToVec3 } from "../engine/gl/geometry.js";
import { mat4Multiply, mat4Transform } from "../engine/gl/math3d.js";

/**
 * @typedef {import('../engine/gl/geometry.js').MeshData} MeshData
 * @typedef {import('../engine/gl/math3d.js').Mat4} Mat4
 * @typedef {[number, number, number]} Vec3
 * @typedef {{ fur: string, accent: string, belly: string, eye: string, pattern: string }} Coat
 * @typedef {{
 *   part: (key: string, build: () => MeshData) => any,
 *   draw: (mesh: any, model: Mat4, options?: import('../engine/gl/renderer.js').DrawOptions) => void,
 * }} Painter
 */

/** Hat colours, shared with the 2D sprites. */
export const HAT_TINTS = Object.freeze({
  bow: "#e8607e",
  straw: "#e8c46a",
  beret: "#5a6aa8",
  acorn: "#a8743e",
  crown: "#f2c94c",
  nightcap: "#6f8fd8",
  leafcap: "#6fae62",
  eyepatch: "#2d2838",
  spectacles: "#3e3e4e",
  flower: "#f29ab8",
  sunhat: "#f4e0b0",
  tiara: "#c9d8f0",
});

const M = (t) => mat4Transform(t);
const mul = (...ms) => ms.reduce((a, b) => mat4Multiply(a, b));
const mix = (hex, toward, amount) => {
  const a = hexToVec3(hex);
  const b = hexToVec3(toward);
  return /** @type {Vec3} */ (a.map((v, i) => v + (b[i] - v) * amount));
};
const toHex = (rgb) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** A wary cat's coat: dusty and faded. Colour returns as trust grows. @param {Coat} coat */
export function dustyCoat(coat) {
  const fade = (c) => toHex(mix(c, "#a8a4a8", 0.5));
  return {
    fur: fade(coat.fur),
    accent: fade(coat.accent),
    belly: fade(coat.belly),
    eye: coat.eye,
    pattern: coat.pattern,
  };
}

/* ---------- Unit meshes ---------- */

const unitSphere =
  (color, segments = 8, rings = 6) =>
  () =>
    new MeshBuilder().sphere(M({}), color, { segments, rings }).build();
const unitBox = (color) => () => new MeshBuilder().box(M({}), color).build();
const unitCylinder =
  (color, topRadius = 1, segments = 7) =>
  () =>
    new MeshBuilder().cylinder(M({}), color, { segments, topRadius }).build();

/** Patterned coat colour for a direction `n` on the body (part = 'body' | 'head'). */
function coatColor(coat, part, n) {
  const [x, y, z] = n;
  if (y < -0.45) return coat.belly;
  switch (coat.pattern) {
    case "stripes":
      if (part === "body") {
        return Math.sin(x * 11) > 0.25 && y > -0.2 ? coat.accent : coat.fur;
      }
      return y > 0.45 && Math.sin(z * 16) > 0.1 ? coat.accent : coat.fur;
    case "tux":
      if (part === "body") return x > 0.55 && y < 0.5 ? coat.belly : coat.fur;
      return x > 0.55 && y < -0.05 ? coat.belly : coat.fur;
    case "calico": {
      const v = Math.sin(x * 4.5 + z * 3.1) + Math.sin(y * 5.3 - z * 4.2 + 1);
      if (v > 0.75) return coat.accent;
      if (v < -0.8) return coat.belly;
      return coat.fur;
    }
    case "point":
      return part === "head" && x > 0.3 ? coat.accent : coat.fur;
    default:
      return y < -0.25 ? coat.belly : coat.fur;
  }
}

const coatKey = (coat) =>
  `${coat.fur}${coat.accent}${coat.belly}${coat.pattern}`;

/* ---------- Cats ---------- */

/** Pose parameters for a cat. @param {string} pose @param {number} t seconds */
function catPose(pose, t) {
  const sway = Math.sin(t * 2.2);
  switch (pose) {
    case "walk":
    case "walk2": {
      const step = t * 9;
      const bob = Math.abs(Math.sin(step)) * 0.035;
      return {
        body: [0, 0.55 + bob, 0, 0.6, 0.3, 0.27],
        head: [0.6, 0.86 + bob, Math.sin(step * 0.5) * 0.05],
        legs: [
          [0.3, 0.13, Math.sin(step) * 0.5],
          [0.3, -0.13, -Math.sin(step) * 0.5],
          [-0.3, 0.13, -Math.sin(step) * 0.5],
          [-0.3, -0.13, Math.sin(step) * 0.5],
        ].map(([x, z, a]) => ({ x, z, top: 0.52 + bob, len: 0.5, angle: a })),
        haunches: false,
        tail: {
          x: -0.55,
          y: 0.66 + bob,
          pitch: 0.55,
          bends: [-0.2, -0.2, -0.15, -0.1, 0.1].map((b, i) => [
            b,
            Math.sin(t * 4 - i * 0.6) * 0.25,
          ]),
        },
        eyes: "open",
      };
    }
    case "loaf":
      return {
        body: [0, 0.3, 0, 0.55, 0.3, 0.3],
        head: [0.5, 0.56, 0],
        legs: [],
        paws: true,
        haunches: false,
        tail: {
          x: -0.48,
          y: 0.14,
          pitch: 1.5,
          bends: [0, 0, 0, 0, 0].map((_, i) => [
            0,
            -0.45 - i * 0.05 + (i === 4 ? Math.sin(t * 1.5) * 0.2 : 0),
          ]),
        },
        eyes: Math.sin(t * 0.9) > 0.85 ? "closed" : "open",
      };
    case "sleep":
      return {
        body: [0, 0.27, 0, 0.5, 0.27, 0.37],
        head: [0.36, 0.32, 0, 0.55],
        legs: [],
        paws: true,
        haunches: false,
        breathe: Math.sin(t * 1.6) * 0.02,
        tail: {
          x: -0.42,
          y: 0.12,
          pitch: 1.5,
          bends: [0, 0, 0, 0, 0].map(() => [0, -0.55]),
        },
        eyes: "closed",
      };
    default: {
      // Sitting, with variations.
      const groom = pose === "groom";
      return {
        body: [-0.08, 0.5, 0.78, 0.5, 0.3, 0.28],
        head: groom ? [0.32, 0.92, -0.55] : [0.22, 1.08, sway * 0.04],
        legs: [
          {
            x: 0.22,
            z: 0.1,
            top: 0.55,
            len: 0.55,
            angle: groom ? -1.9 + Math.sin(t * 8) * 0.2 : 0,
          },
          { x: 0.22, z: -0.1, top: 0.55, len: 0.55, angle: 0 },
        ],
        haunches: true,
        tail: {
          x: -0.45,
          y: 0.1,
          pitch: 1.5,
          bends: [0, 0, 0, 0, 0].map((_, i) => [
            0,
            -0.42 + (i === 4 ? Math.sin(t * 2.4) * 0.35 : 0),
          ]),
        },
        eyes: pose === "blink" || pose === "purr" || groom ? "closed" : "open",
      };
    }
  }
}

/** Hats, in head space (the head is ~0.3 in radius, the crown at y 0.25). */
function drawCatHat(p, head, hat) {
  const color = HAT_TINTS[hat];
  if (!color) return;
  const dark = toHex(mix(color, "#3a3050", 0.35));
  const at = (t) => mul(head, M(t));
  const sphere = p.part(`s:${color}`, unitSphere(color));
  const cyl = p.part(`c:${color}`, unitCylinder(color, 1, 10));
  const darkCyl = p.part(`c:${dark}`, unitCylinder(dark, 1, 10));
  switch (hat) {
    case "bow":
      for (const side of [-1, 1]) {
        p.draw(
          sphere,
          at({
            x: -0.05,
            y: 0.27,
            z: side * 0.14,
            sx: 0.06,
            sy: 0.09,
            sz: 0.1,
            rx: side * 0.4,
          }),
        );
      }
      p.draw(
        p.part(`s:${dark}`, unitSphere(dark)),
        at({ x: -0.05, y: 0.27, z: 0, s: 0.05 }),
      );
      break;
    case "straw":
    case "sunhat":
      p.draw(
        darkCyl,
        at({
          y: 0.22,
          sx: hat === "sunhat" ? 0.5 : 0.42,
          sy: 0.025,
          sz: hat === "sunhat" ? 0.5 : 0.42,
        }),
      );
      p.draw(cyl, at({ y: 0.22, sx: 0.22, sy: 0.16, sz: 0.22 }));
      break;
    case "beret":
      p.draw(
        sphere,
        at({ x: -0.03, y: 0.26, rz: 0.25, sx: 0.3, sy: 0.08, sz: 0.3 }),
      );
      break;
    case "acorn":
      p.draw(sphere, at({ y: 0.2, sx: 0.24, sy: 0.14, sz: 0.24 }));
      p.draw(darkCyl, at({ y: 0.3, sx: 0.03, sy: 0.1, sz: 0.03 }));
      break;
    case "crown":
    case "tiara": {
      p.draw(cyl, at({ y: 0.22, sx: 0.2, sy: 0.07, sz: 0.2 }));
      const cone = p.part(`k:${color}`, unitCylinder(color, 0, 4));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        p.draw(
          cone,
          at({
            x: Math.cos(a) * 0.18,
            y: 0.28,
            z: Math.sin(a) * 0.18,
            sx: 0.04,
            sy: 0.12,
            sz: 0.04,
          }),
        );
      }
      break;
    }
    case "nightcap": {
      const cone = p.part(`k:${color}`, unitCylinder(color, 0, 8));
      p.draw(cone, at({ y: 0.2, rz: 0.7, sx: 0.22, sy: 0.42, sz: 0.22 }));
      p.draw(
        p.part("s:#ffffff", unitSphere("#ffffff")),
        at({ x: -0.28, y: 0.48, s: 0.06 }),
      );
      break;
    }
    case "leafcap":
      p.draw(sphere, at({ y: 0.24, rz: -0.3, sx: 0.28, sy: 0.07, sz: 0.2 }));
      p.draw(darkCyl, at({ x: 0.04, y: 0.28, sx: 0.02, sy: 0.08, sz: 0.02 }));
      break;
    case "eyepatch":
      p.draw(
        p.part(`b:${color}`, unitBox(color)),
        at({ x: 0.25, y: 0.06, z: 0.13, sx: 0.04, sy: 0.1, sz: 0.1 }),
      );
      p.draw(
        p.part(`b:${color}`, unitBox(color)),
        at({ x: 0.0, y: 0.1, z: 0, rz: -0.2, sx: 0.55, sy: 0.025, sz: 0.62 }),
      );
      break;
    case "spectacles":
      for (const side of [-1, 1]) {
        p.draw(
          darkCyl,
          at({
            x: 0.28,
            y: 0.06,
            z: side * 0.12,
            rz: Math.PI / 2,
            sx: 0.07,
            sy: 0.02,
            sz: 0.07,
          }),
        );
      }
      break;
    case "flower":
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        p.draw(
          sphere,
          at({
            x: Math.cos(a) * 0.05,
            y: 0.26,
            z: 0.12 + Math.sin(a) * 0.05,
            s: 0.045,
          }),
        );
      }
      p.draw(
        p.part("s:#f7d84e", unitSphere("#f7d84e")),
        at({ y: 0.27, z: 0.12, s: 0.035 }),
      );
      break;
    default:
      break;
  }
}

/**
 * Draws a cat at `at` (metres) facing `heading` (radians, 0 = +X).
 * @param {Painter} p
 * @param {Coat} coat
 * @param {string} pose
 * @param {Vec3} at
 * @param {{ heading?: number, time?: number, scale?: number, hat?: string | null,
 *   tint?: number[] }} [options]
 */
export function drawCatModel(
  p,
  coat,
  pose,
  at,
  { heading = 0, time = 0, scale = 1, hat = null, tint } = {},
) {
  const key = coatKey(coat);
  const body = p.part(`body:${key}`, () =>
    new MeshBuilder()
      .sphere(M({}), (n) => coatColor(coat, "body", n), {
        segments: 10,
        rings: 7,
      })
      .build(),
  );
  const headMesh = p.part(`head:${key}`, () =>
    new MeshBuilder()
      .sphere(M({}), (n) => coatColor(coat, "head", n), {
        segments: 10,
        rings: 7,
      })
      .build(),
  );
  const fur = p.part(`s:${coat.fur}`, unitSphere(coat.fur));
  const pointy = coat.pattern === "point";
  const limbColor = pointy ? coat.accent : coat.fur;
  const leg = p.part(`c:${limbColor}`, unitCylinder(limbColor));
  const pawColor = coat.pattern === "tux" ? coat.belly : limbColor;
  const paw = p.part(`s:${pawColor}`, unitSphere(pawColor));
  const earColor =
    pointy || coat.pattern === "stripes" ? coat.accent : coat.fur;
  const ear = p.part(`k4:${earColor}`, unitCylinder(earColor, 0, 4));
  const earInner = p.part("k4:#f2a8b4", unitCylinder("#f2a8b4", 0, 4));
  const muzzle = p.part(`s:${coat.belly}`, unitSphere(coat.belly));
  const eye = p.part(`s:${coat.eye}`, unitSphere(coat.eye, 6, 4));
  const pupil = p.part("s:#1e1a26", unitSphere("#1e1a26", 6, 4));
  const shine = p.part("s:#ffffff", unitSphere("#ffffff", 4, 3));
  const nose = p.part("s:#e88a98", unitSphere("#e88a98", 4, 3));
  const tipColor =
    pointy || coat.pattern === "stripes" ? coat.accent : coat.fur;
  const tailMesh = p.part(`c:${coat.fur}`, unitCylinder(coat.fur));
  const tailTip = p.part(`c:${tipColor}`, unitCylinder(tipColor));
  const opts = tint ? { tint } : undefined;

  const pose_ = catPose(pose, time);
  const root = M({ x: at[0], y: at[1], z: at[2], ry: heading, s: scale });
  const draw = (mesh, t) => p.draw(mesh, mul(root, M(t)), opts);

  const [bx, by, brz, rx, ry, rz] = pose_.body;
  const breathe = pose_.breathe ?? 0;
  draw(body, { x: bx, y: by, rz: brz, sx: rx, sy: ry + breathe, sz: rz });
  if (pose_.haunches) {
    for (const side of [-1, 1]) {
      draw(fur, {
        x: -0.22,
        y: 0.22,
        z: side * 0.17,
        sx: 0.26,
        sy: 0.22,
        sz: 0.14,
      });
      draw(paw, {
        x: 0.02,
        y: 0.05,
        z: side * 0.2,
        sx: 0.12,
        sy: 0.06,
        sz: 0.08,
      });
    }
  }
  for (const l of pose_.legs) {
    const angle = Math.PI + l.angle;
    draw(leg, {
      x: l.x,
      y: l.top,
      z: l.z,
      rz: angle,
      sx: 0.075,
      sy: l.len,
      sz: 0.075,
    });
    const footX = l.x - Math.sin(angle) * l.len;
    const footY = l.top + Math.cos(angle) * l.len;
    draw(paw, {
      x: footX + 0.03,
      y: footY,
      z: l.z,
      sx: 0.1,
      sy: 0.065,
      sz: 0.085,
    });
  }
  if (pose_.paws) {
    for (const side of [-1, 1]) {
      draw(paw, {
        x: pose_.head[0] - 0.02,
        y: 0.06,
        z: side * 0.12,
        sx: 0.12,
        sy: 0.06,
        sz: 0.08,
      });
    }
  }

  // Tail: a chain of segments, each bending a little from the last.
  const tail = pose_.tail;
  let joint = mul(root, M({ x: tail.x, y: tail.y, rz: tail.pitch }));
  tail.bends.forEach(([pitch, curl], i) => {
    joint = mul(joint, M({ rz: pitch, rx: curl }));
    const radius = 0.075 - i * 0.008;
    p.draw(
      i >= 3 ? tailTip : tailMesh,
      mul(joint, M({ sx: radius, sy: 0.19, sz: radius })),
      opts,
    );
    joint = mul(joint, M({ y: 0.17 }));
  });

  // Head, with ears, muzzle and eyes.
  const [hx, hy, hrz, hrx = 0] = pose_.head;
  const head = mul(root, M({ x: hx, y: hy, rz: hrz, rx: hrx }));
  const part = (mesh, t) => p.draw(mesh, mul(head, M(t)), opts);
  part(headMesh, { sx: 0.3, sy: 0.26, sz: 0.3 });
  for (const side of [-1, 1]) {
    part(ear, {
      x: -0.02,
      y: 0.17,
      z: side * 0.15,
      rx: side * -0.35,
      sx: 0.1,
      sy: 0.2,
      sz: 0.09,
    });
    part(earInner, {
      x: 0.01,
      y: 0.18,
      z: side * 0.15,
      rx: side * -0.35,
      sx: 0.055,
      sy: 0.14,
      sz: 0.05,
    });
  }
  part(muzzle, { x: 0.22, y: -0.08, sx: 0.12, sy: 0.08, sz: 0.15 });
  part(nose, { x: 0.33, y: -0.03, sx: 0.035, sy: 0.025, sz: 0.04 });
  for (const side of [-1, 1]) {
    if (pose_.eyes === "closed") {
      part(pupil, {
        x: 0.255,
        y: 0.04,
        z: side * 0.12,
        sx: 0.02,
        sy: 0.012,
        sz: 0.06,
      });
    } else {
      part(eye, {
        x: 0.23,
        y: 0.05,
        z: side * 0.125,
        sx: 0.06,
        sy: 0.07,
        sz: 0.06,
      });
      part(pupil, {
        x: 0.275,
        y: 0.05,
        z: side * 0.13,
        sx: 0.025,
        sy: 0.055,
        sz: 0.035,
      });
      part(shine, { x: 0.29, y: 0.08, z: side * 0.12, s: 0.014 });
    }
  }
  if (hat) drawCatHat(p, head, hat);
}

/** Where on a sitting cat the petting zones are (cat space, metres), for the close-up. */
export const CAT_ANCHORS = Object.freeze({
  head: [0.24, 1.32, 0],
  cheeks: [0.4, 1.02, 0.2],
  chin: [0.42, 0.92, 0],
  back: [-0.2, 0.82, 0],
  belly: [0.18, 0.55, 0.12],
  tail: [-0.62, 0.12, 0.3],
  paws: [0.24, 0.06, 0.12],
});

/* ---------- The player ---------- */

const PLAYER = {
  skin: "#f2c9a8",
  hair: "#7a4a30",
  blouse: "#f6f1e8",
  vest: "#c8423c",
  skirt: "#3f5f88",
  apron: "#f0e6cf",
  stockings: "#f6f1e8",
  boot: "#4e3428",
  hat: "#4f7a52",
};

/**
 * The villager: dirndl, felt hat and braids.
 * @param {Painter} p
 * @param {Vec3} at
 * @param {{ heading?: number, walkTime?: number, moving?: boolean, sitting?: boolean,
 *   time?: number, stroking?: boolean }} [options]
 */
export function drawPlayerModel(
  p,
  at,
  {
    heading = 0,
    walkTime = 0,
    moving = false,
    sitting = false,
    time = 0,
    stroking = false,
  } = {},
) {
  const c = PLAYER;
  const sphere = (color) => p.part(`s:${color}`, unitSphere(color));
  const cyl = (color, top = 1) =>
    p.part(`c:${color}:${top}`, unitCylinder(color, top, 9));
  const root = M({ x: at[0], y: at[1], z: at[2], ry: heading });
  const draw = (mesh, t) => p.draw(mesh, mul(root, M(t)));
  const step = walkTime * 9;
  const swing = moving ? Math.sin(step) * 0.55 : 0;
  const bob = moving
    ? Math.abs(Math.sin(step)) * 0.06
    : Math.sin(time * 2) * 0.01;
  const hip = sitting ? 0.32 : 0.95 + bob;

  // Legs.
  for (const side of [-1, 1]) {
    const z = side * 0.15;
    if (sitting) {
      draw(cyl(c.stockings), {
        x: 0,
        y: hip,
        z,
        rz: -Math.PI / 2,
        sx: 0.11,
        sy: 0.75,
        sz: 0.11,
      });
      draw(sphere(c.boot), {
        x: 0.8,
        y: hip + 0.04,
        z,
        sx: 0.12,
        sy: 0.16,
        sz: 0.11,
      });
    } else {
      const a = Math.PI + swing * side;
      draw(cyl(c.stockings), {
        x: 0,
        y: hip,
        z,
        rz: a,
        sx: 0.1,
        sy: 0.82,
        sz: 0.1,
      });
      const footX = -Math.sin(a) * 0.82;
      draw(sphere(c.boot), {
        x: footX + 0.06,
        y: hip + Math.cos(a) * 0.82 + 0.02,
        z,
        sx: 0.17,
        sy: 0.1,
        sz: 0.11,
      });
    }
  }
  // Skirt, apron, bodice.
  const waist = hip + (sitting ? 0.05 : 0.05);
  draw(cyl(c.skirt, 0.62), {
    x: 0,
    y: waist - (sitting ? 0.3 : 0.42),
    sx: sitting ? 0.62 : 0.5,
    sy: 0.62,
    sz: sitting ? 0.6 : 0.5,
  });
  draw(p.part(`b:${c.apron}`, unitBox(c.apron)), {
    x: sitting ? 0.3 : 0.33,
    y: waist - 0.08,
    rz: sitting ? -0.9 : 0.1,
    sx: 0.06,
    sy: 0.55,
    sz: 0.38,
  });
  draw(cyl(c.blouse, 0.9), {
    x: 0,
    y: waist + 0.15,
    sx: 0.32,
    sy: 0.6,
    sz: 0.3,
  });
  draw(cyl(c.vest, 0.85), {
    x: 0.01,
    y: waist + 0.12,
    sx: 0.335,
    sy: 0.42,
    sz: 0.31,
  });
  const shoulder = waist + 0.68;
  // Arms (one reaches out while stroking).
  for (const side of [-1, 1]) {
    const reach = stroking && side === 1;
    const a = reach
      ? Math.PI / 2 + 0.5 + Math.sin(time * 5) * 0.2
      : Math.PI - swing * side * 0.8 + (sitting ? -0.5 : 0);
    draw(cyl(c.blouse, 0.8), {
      x: 0,
      y: shoulder,
      z: side * 0.36,
      rz: a,
      rx: side * -0.12,
      sx: 0.09,
      sy: 0.62,
      sz: 0.09,
    });
    draw(sphere(c.skin), {
      x: -Math.sin(a) * 0.66,
      y: shoulder + Math.cos(a) * 0.66,
      z: side * 0.4,
      s: 0.09,
    });
  }
  // Head, braids and hat.
  const headY = shoulder + 0.42;
  draw(sphere(c.skin), { x: 0.02, y: headY, sx: 0.31, sy: 0.32, sz: 0.3 });
  draw(sphere(c.hair), {
    x: -0.06,
    y: headY + 0.05,
    sx: 0.31,
    sy: 0.32,
    sz: 0.33,
  });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      draw(sphere(c.hair), {
        x: -0.12,
        y: headY - 0.18 - i * 0.16,
        z: side * 0.26,
        s: 0.085,
      });
    }
    draw(sphere("#c8423c"), {
      x: -0.12,
      y: headY - 0.66,
      z: side * 0.26,
      s: 0.05,
    });
    draw(sphere("#2d2838"), {
      x: 0.29,
      y: headY + 0.02,
      z: side * 0.11,
      sx: 0.02,
      sy: 0.05,
      sz: 0.035,
    });
    draw(sphere("#f2a0a0"), {
      x: 0.27,
      y: headY - 0.08,
      z: side * 0.17,
      sx: 0.03,
      sy: 0.03,
      sz: 0.05,
    });
  }
  draw(cyl(c.hat), { x: 0, y: headY + 0.22, sx: 0.42, sy: 0.04, sz: 0.42 });
  draw(cyl(c.hat, 0.75), {
    x: -0.02,
    y: headY + 0.24,
    sx: 0.24,
    sy: 0.24,
    sz: 0.24,
  });
  draw(cyl("#c8423c"), {
    x: -0.02,
    y: headY + 0.26,
    sx: 0.245,
    sy: 0.05,
    sz: 0.245,
  });
  draw(p.part("b:#f6f1e8", unitBox("#f6f1e8")), {
    x: -0.18,
    y: headY + 0.4,
    z: 0.2,
    rz: 0.5,
    sx: 0.04,
    sy: 0.32,
    sz: 0.06,
  });
}

/* ---------- Clover the goat ---------- */

/** @param {Painter} p @param {Vec3} at */
export function drawGoatModel(p, at, { heading = Math.PI, time = 0 } = {}) {
  const sphere = (color, s = 8) =>
    p.part(`s:${color}:${s}`, unitSphere(color, s, Math.max(3, s - 2)));
  const cyl = (color, top = 1, seg = 7) =>
    p.part(`c:${color}:${top}:${seg}`, unitCylinder(color, top, seg));
  const root = M({ x: at[0], y: at[1], z: at[2], ry: heading });
  const draw = (mesh, t) => p.draw(mesh, mul(root, M(t)));
  const chew = Math.sin(time * 6) * 0.02;
  const graze = Math.max(0, Math.sin(time * 0.4)) > 0.7;
  draw(sphere("#efe8dc", 10), { y: 0.95, sx: 0.72, sy: 0.42, sz: 0.4 });
  draw(sphere("#d9cbb8"), {
    x: -0.2,
    y: 1.1,
    z: 0.25,
    sx: 0.3,
    sy: 0.22,
    sz: 0.18,
  });
  for (const [x, z] of [
    [0.45, 0.2],
    [0.45, -0.2],
    [-0.45, 0.2],
    [-0.45, -0.2],
  ]) {
    draw(cyl("#e2d8ca"), { x, y: 0, z, sx: 0.075, sy: 0.8, sz: 0.075 });
    draw(cyl("#4e3a30"), { x, y: 0, z, sx: 0.085, sy: 0.08, sz: 0.085 });
  }
  draw(cyl("#efe8dc", 0, 4), {
    x: -0.68,
    y: 1.12,
    rz: 0.6,
    sx: 0.08,
    sy: 0.25,
    sz: 0.06,
  });
  const head = mul(
    root,
    M({ x: 0.78, y: graze ? 0.8 : 1.3, rz: graze ? -0.9 : 0.2 + chew }),
  );
  const part = (mesh, t) => p.draw(mesh, mul(head, M(t)));
  part(sphere("#efe8dc"), { sx: 0.24, sy: 0.22, sz: 0.2 });
  part(sphere("#e4d4c2"), { x: 0.22, y: -0.08, sx: 0.16, sy: 0.12, sz: 0.13 });
  part(sphere("#2d2838", 5), {
    x: 0.36,
    y: -0.06,
    sx: 0.02,
    sy: 0.03,
    sz: 0.06,
  });
  part(cyl("#efe8dc", 0, 4), {
    x: 0.12,
    y: -0.22,
    rz: Math.PI,
    sx: 0.06,
    sy: 0.18 + chew,
    sz: 0.05,
  });
  for (const side of [-1, 1]) {
    part(cyl("#9a8f80", 0, 5), {
      x: -0.05,
      y: 0.15,
      z: side * 0.09,
      rz: 0.9,
      rx: side * -0.2,
      sx: 0.05,
      sy: 0.38,
      sz: 0.05,
    });
    part(sphere("#e4d8c8", 5), {
      x: -0.04,
      y: 0.02,
      z: side * 0.24,
      rx: side * 0.6,
      sx: 0.06,
      sy: 0.04,
      sz: 0.14,
    });
    part(sphere("#3a2a24", 5), { x: 0.14, y: 0.06, z: side * 0.15, s: 0.03 });
  }
  draw(sphere("#d8b04a", 6), { x: 0.62, y: 0.92, s: 0.08 });
  draw(cyl("#a83a38", 1, 9), {
    x: 0.6,
    y: 1.0,
    rz: 0.4,
    sx: 0.2,
    sy: 0.05,
    sz: 0.2,
  });
}
