/**
 * Character and item sprites. Small sprites are defined as text pixel maps and cached as
 * canvases; the big petting portrait is drawn procedurally.
 */
import {
  ellipse,
  makeCanvas,
  mixColor,
  rect,
  valueNoise,
} from "../engine/canvas.js";
import { HAT_TINTS, dustyCoat } from "./models.js";

/**
 * @typedef {{ fur: string, accent: string, belly: string, eye: string, pattern: string }} Coat
 * @typedef {{ coat: Coat }} HasCoat
 */

/*
 * Cat pixel maps. Legend: o outline, f fur, a accent (stripes), b belly, e eye, n nose,
 * p inner ear, k closed eye.
 */
const CAT_POSES = {
  sit: [
    "..........o...o.",
    ".........opo.opo",
    ".........offfffo",
    ".........ofefefo",
    ".........offnffo",
    "..........ofbfo.",
    ".....ooooooobbo.",
    "....offaffafbbo.",
    "...offfffffffbo.",
    "...offaffafffbo.",
    "...offfffffffbo.",
    "...offfffffofbo.",
    "...offfffffofbo.",
    "...oooooooooooo.",
  ],
  walk: [
    "..............o...o.",
    ".............opo.opo",
    ".............offfffo",
    ".............ofefefo",
    "..oooooooooooooffnfo",
    ".offfaffaffafffffoo.",
    ".offfffffffffffbbo..",
    ".offaffaffaffbbbbo..",
    ".ofbbbbbbbbbbbbbbo..",
    "..oofo.oofo.oofo.oo.",
    "...oo...oo...oo.....",
  ],
  walk2: [
    "..............o...o.",
    ".............opo.opo",
    ".............offfffo",
    ".............ofefefo",
    "..oooooooooooooffnfo",
    ".offfaffaffafffffoo.",
    ".offfffffffffffbbo..",
    ".offaffaffaffbbbbo..",
    ".ofbbbbbbbbbbbbbbo..",
    "...ofo.oofo..ofooo..",
    "....oo..oo....oo....",
  ],
  loaf: [
    "............o...o.",
    "...........opo.opo",
    "..ooooooooooofffffo",
    ".offfaffaffffefefo",
    ".ofaffffffffffnffo",
    ".offfffaffaffbbbo.",
    ".offfffffffffbbbo.",
    ".oofffffffffbbbo..",
    "..ooooooooooooo...",
  ],
  sleep: [
    "..........o..o....",
    ".........opoopo...",
    "....ooooooffffooo.",
    "...offaffaffffffo.",
    "..offffffffkfkfffo",
    "..ofafffaffffnfffo",
    "..offfffffffffffbo",
    "...offaffafffffbo.",
    "....ooooooooooooo.",
  ],
};

/** Variants made by editing rows of the base poses: closed eyes, a yawn, a paw raised to groom. */
const withRows = (base, rows) => base.map((row, i) => rows[i] ?? row);
CAT_POSES.blink = withRows(CAT_POSES.sit, { 3: ".........ofkfkfo" });
CAT_POSES.yawn = withRows(CAT_POSES.sit, {
  3: ".........ofkfkfo",
  4: ".........ofpppfo",
  5: "..........opppo.",
});
CAT_POSES.groom = withRows(CAT_POSES.sit, {
  3: ".........ofkfkfo",
  5: ".........obbbfo.",
  6: ".....oooooobbbo.",
});
CAT_POSES.purr = withRows(CAT_POSES.loaf, { 3: ".offfaffaffffkfkfo" });

/** @type {Map<string, HTMLCanvasElement>} */
const spriteCache = new Map();

/** @param {string} pose @param {Coat} coat */
function catSpriteCanvas(pose, coat) {
  const key = `${pose}|${coat.fur}|${coat.accent}|${coat.belly}|${coat.pattern}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const map = CAT_POSES[pose];
  const { canvas, ctx } = makeCanvas(map[0].length, map.length);
  const outline = mixColor(coat.fur, "#3d2f3a", 0.6);
  map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      let color = null;
      switch (ch) {
        case "o":
        case "k":
          color = outline;
          break;
        case "f":
          color = coat.fur;
          if (
            coat.pattern === "calico" &&
            valueNoise(x * 0.45 + 3, y * 0.45) > 0.56
          ) {
            color = coat.accent;
          }
          if (coat.pattern === "point" && (y < 4 || x < 5)) color = coat.accent;
          break;
        case "a":
          color = coat.pattern === "stripes" ? coat.accent : coat.fur;
          break;
        case "b":
          color = coat.belly;
          break;
        case "e":
          color = coat.eye;
          break;
        case "n":
          color = "#e38e9b";
          break;
        case "p":
          color = "#f2b9bf";
          break;
        default:
          break;
      }
      if (color) rect(ctx, x, y, 1, 1, color);
    }),
  );
  spriteCache.set(key, canvas);
  return canvas;
}

const HAT_COLORS = HAT_TINTS;
/** Where a hat sits on each pose, relative to the sprite's top-left. */
const HAT_OFFSETS = {
  sit: [10, -2],
  blink: [10, -2],
  yawn: [10, -2],
  groom: [10, -2],
  walk: [14, -2],
  walk2: [14, -2],
  loaf: [13, -2],
  purr: [13, -2],
  sleep: [10, -1],
};
/** Poses with a swishing tail. */
const TAIL_POSES = ["sit", "blink", "yawn", "groom", "walk", "walk2"];

/** Draws a tiny hat with its top-left at (x, y). */
export function drawHat(ctx, hat, x, y) {
  const color = HAT_COLORS[hat];
  if (!color) return;
  const dark = mixColor(color, "#3a3050", 0.3);
  switch (hat) {
    case "bow":
      rect(ctx, x, y + 1, 2, 2, color);
      rect(ctx, x + 3, y + 1, 2, 2, color);
      rect(ctx, x + 2, y + 1, 1, 1, dark);
      break;
    case "straw":
    case "sunhat":
      rect(ctx, x - 2, y + 2, 9, 1, dark);
      rect(ctx, x, y, 5, 2, color);
      break;
    case "beret":
      rect(ctx, x - 1, y, 7, 2, color);
      rect(ctx, x + 2, y - 1, 1, 1, dark);
      break;
    case "acorn":
      rect(ctx, x, y, 5, 2, color);
      rect(ctx, x + 2, y - 1, 1, 1, dark);
      break;
    case "crown":
    case "tiara":
      rect(ctx, x, y + 1, 5, 1, color);
      rect(ctx, x, y, 1, 1, color);
      rect(ctx, x + 2, y - 1, 1, 2, color);
      rect(ctx, x + 4, y, 1, 1, color);
      break;
    case "nightcap":
      rect(ctx, x, y + 1, 5, 1, "#fff");
      rect(ctx, x + 1, y - 1, 3, 2, color);
      rect(ctx, x + 4, y - 1, 2, 1, color);
      rect(ctx, x + 6, y, 1, 1, "#fff");
      break;
    case "leafcap":
      rect(ctx, x, y, 5, 2, color);
      rect(ctx, x + 3, y - 1, 2, 1, dark);
      break;
    case "eyepatch":
      rect(ctx, x, y + 3, 6, 1, color);
      rect(ctx, x + 2, y + 3, 2, 2, color);
      break;
    case "spectacles":
      rect(ctx, x, y + 3, 2, 1, color);
      rect(ctx, x + 3, y + 3, 2, 1, color);
      break;
    case "flower":
      [0, 2, 4].forEach((i) => rect(ctx, x + i, y + 1, 1, 1, color));
      rect(ctx, x + 1, y, 1, 1, "#7fae62");
      rect(ctx, x + 3, y, 1, 1, "#7fae62");
      break;
    default:
      break;
  }
}

/**
 * Draws a cat standing on (x, y), with a swishing tail and optional hat.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HasCoat} cat
 * @param {string} pose  'sit' | 'walk' | 'walk2' | 'loaf' | 'sleep'
 */
export function drawCat(
  ctx,
  cat,
  pose,
  x,
  y,
  {
    flip = false,
    time = 0,
    scale = 1,
    hat = /** @type {string | null} */ (null),
  } = {},
) {
  const coat = cat.coat;
  const sprite = catSpriteCanvas(pose, coat);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  if (scale !== 1) ctx.scale(scale, scale);
  const left = -sprite.width / 2;
  const top = -sprite.height;
  ctx.drawImage(sprite, left, top);
  if (TAIL_POSES.includes(pose)) {
    const seated = !pose.startsWith("walk");
    const tailX = left + (seated ? 3 : 1);
    const tailY = top + (seated ? 10 : 5);
    for (let i = 0; i < 6; i++) {
      const sway = Math.sin(time * 3 + i * 0.7) * (i * 0.35);
      rect(
        ctx,
        tailX - i,
        tailY - i * 0.9 + sway,
        2,
        2,
        i > 3 ? coat.accent : coat.fur,
      );
    }
  }
  const hatOffset = hat && HAT_OFFSETS[pose];
  if (hatOffset) drawHat(ctx, hat, left + hatOffset[0], top + hatOffset[1]);
  ctx.restore();
}

/**
 * The big close-up cat for the petting minigame (portrait coordinates are fixed; see PET_ZONES).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HasCoat} cat
 * @param {{ time: number, squint: number, earsFlat: number, tailSwing: number, tailSpeed: number,
 *   tilt: number, hat: string | null, look: number }} mood
 */
export function drawCatPortrait(ctx, cat, mood) {
  const { fur, accent, belly, eye, pattern } = cat.coat;
  const outline = mixColor(fur, "#3a3050", 0.65);
  const breath = Math.sin(mood.time * 2);

  const swing = mood.tailSwing * Math.sin(mood.time * mood.tailSpeed);
  const tailPoint = (i) => {
    const u = i / 33;
    return [
      352 + u * 62 + Math.sin(u * 3 + swing) * swing * 8,
      188 - u * u * 90 + Math.sin(u * 2 + mood.time) * swing * 8,
    ];
  };
  for (let i = 0; i < 34; i++) ellipse(ctx, ...tailPoint(i), 8, 8, outline);
  for (let i = 0; i < 34; i++)
    ellipse(ctx, ...tailPoint(i), 6, 6, i > 24 ? accent : fur);

  ellipse(ctx, 270, 172 + breath, 92, 56, outline);
  ellipse(ctx, 270, 172 + breath, 88, 52, mixColor(fur, "#5a4a5a", 0.14));
  ellipse(ctx, 264, 164 + breath, 80, 42, fur);
  ellipse(ctx, 250, 146 + breath, 50, 14, mixColor(fur, "#ffffff", 0.16));
  if (pattern === "stripes") {
    for (let i = 0; i < 5; i++) {
      rect(
        ctx,
        226 + i * 26,
        122 + breath + Math.abs(i - 2) * 2,
        8,
        26,
        accent,
      );
    }
  }
  if (pattern === "calico") {
    ellipse(ctx, 250, 146, 32, 20, accent);
    ellipse(ctx, 320, 178, 24, 20, accent);
  }
  if (pattern === "point") ellipse(ctx, 330, 170, 22, 34, accent);
  ellipse(ctx, 262, 206, 60, 18, belly);
  for (const [px, py] of [
    [210, 222],
    [238, 226],
    [300, 226],
    [332, 222],
  ]) {
    ellipse(ctx, px, py, 14, 8, outline);
    ellipse(ctx, px, py, 12, 6, mixColor(belly, fur, 0.3));
  }

  const headY = 126 - mood.tilt * 3 + breath * 0.5;
  const headX = 176 + mood.tilt;
  for (const [dx, dy] of [
    [-26, -34],
    [20, -34],
  ]) {
    const flat = mood.earsFlat * 10;
    const tipX = headX + dx + 3;
    const tipY = headY + dy + flat;
    for (let y = 0; y < 26 - flat; y++) {
      const w = Math.round(y * 0.72);
      rect(ctx, tipX - w, tipY + y, w * 2 + 1, 1, outline);
      if (y > 3)
        rect(ctx, tipX - w + 3, tipY + y, Math.max(0, w * 2 - 5), 1, "#f2b9bf");
    }
  }
  const face = pattern === "point" ? accent : fur;
  ellipse(ctx, headX, headY, 46, 40, outline);
  ellipse(ctx, headX, headY, 43, 37, mixColor(face, "#5a4a5a", 0.12));
  ellipse(ctx, headX - 3, headY - 3, 38, 32, face);
  ellipse(ctx, headX - 12, headY - 20, 14, 7, mixColor(fur, "#ffffff", 0.2));
  if (pattern === "stripes") {
    [-14, 0, 14].forEach((d) =>
      rect(ctx, headX + d - 2, headY - 36, 4, 14, accent),
    );
  }
  if (pattern === "tux") ellipse(ctx, headX, headY + 18, 24, 17, belly);
  else ellipse(ctx, headX, headY + 17, 20, 13, belly);

  for (const d of [-18, 18]) {
    const ex = headX + d;
    const ey = headY - 3;
    if (mood.squint > 0.72) {
      rect(ctx, ex - 8, ey + 1, 16, 3, outline);
      rect(ctx, ex - 9, ey - 1, 3, 2, outline);
      rect(ctx, ex + 6, ey - 1, 3, 2, outline);
    } else {
      const r = Math.round(9 * (1 - mood.squint * 0.7));
      ellipse(ctx, ex, ey, 8, Math.max(2, r), "#fff");
      ellipse(ctx, ex, ey, 5, Math.max(2, r - 1), eye);
      ellipse(ctx, ex + mood.look, ey, 2, Math.max(1, r - 2), "#2d2838");
      rect(ctx, ex + 2, ey - 3, 2, 2, "#fff");
    }
  }
  rect(ctx, headX - 4, headY + 9, 8, 4, "#e38e9b");
  rect(ctx, headX - 1, headY + 13, 2, 4, outline);
  rect(ctx, headX - 7, headY + 17, 6, 2, outline);
  rect(ctx, headX + 1, headY + 17, 6, 2, outline);
  for (const side of [-1, 1]) {
    for (const k of [0, 5]) {
      rect(
        ctx,
        headX + side * 34 - (side < 0 ? 20 : 0),
        headY + 8 + k,
        20,
        1,
        "#fff",
      );
    }
  }
  if (mood.hat) {
    ctx.save();
    ctx.translate(headX - 12, headY - 52);
    ctx.scale(5, 5);
    drawHat(ctx, mood.hat, 0, 1);
    ctx.restore();
  }
}

/** A small pixel heart with its top at (x, y). */
export function drawHeart(ctx, x, y, color = "#e8607e") {
  x = Math.round(x);
  y = Math.round(y);
  rect(ctx, x - 2, y, 2, 1, color);
  rect(ctx, x + 1, y, 2, 1, color);
  rect(ctx, x - 3, y + 1, 7, 2, color);
  rect(ctx, x - 2, y + 3, 5, 1, color);
  rect(ctx, x - 1, y + 4, 3, 1, color);
  rect(ctx, x, y + 5, 1, 1, color);
}

/* ---------- Item icons (10x8 pixel maps) ---------- */

const ICON_MAPS = {
  sardine: ".....ss...|.sssssss.s|ssessssss.|.sssssss.s|.....ss...",
  trout: "....tt....|.ttdtdtt.t|ttettttttt|.tdtdttt.t|....tt....",
  moonkoi: "....mm....|.mmmcmmm.m|mmemmmcmm.|.mmcmmmm.m|....mm....",
  herb: "...g......|..gg.g....|.g.gg..g..|...g.gg...|...g.g....|...gg.....|...g......",
  milk: "...kk.....|...ww.....|..wwww....|..wwww....|..wbbw....|..wbbw....|..wwww....",
  stone: "..rrrr....|.rrhhrr...|rrhrrrrr..|rrrrrrrr..|.dddddd...",
  catnip: "..v..v....|.vvvvvv...|..gvvg....|...gg.....|...g......|..gg......",
  biscuit: ".bbbbbb...|bbcbbcbb..|bbbbbbbb..|bcbbcbbb..|.bbbbbb...",
  fishcake: ".oooooo...|ooyyyyoo..|oyyoyyyo..|ooyyyyoo..|.oooooo...",
  milkbun: "..wwww....|.wwwwww...|wwwyywww..|wwwwwwww..|.bbbbbb...",
  tart: "..yyyy....|.yyyyyy...|oyyoyyyo..|oooooooo..|.oooooo...",
  nipcookie: ".bbbbbb...|bbvbbgbb..|bgbbvbbb..|bbbvbbbb..|.bbbbbb...",
  wood: "....oo....|..oobo....|oobboo....|obooo.....|oo........",
};
const ICON_COLORS = {
  s: "#a9bfd4",
  e: "#2d2838",
  t: "#c1a06c",
  d: "#7f6444",
  m: "#e7e4fa",
  c: "#a9bcef",
  g: "#79ad6b",
  k: "#9dd2c0",
  w: "#fbf4e4",
  b: "#d8a772",
  r: "#b5a6c4",
  h: "#f3a982",
  v: "#b18fd8",
  o: "#b0754a",
  y: "#f2cb6c",
};

/** @type {Map<string, HTMLCanvasElement>} */
const iconCache = new Map();

/** A 10x8 canvas for an item. */
export function itemIcon(item) {
  let canvas = iconCache.get(item);
  if (!canvas) {
    const made = makeCanvas(10, 8);
    (ICON_MAPS[item] ?? "").split("|").forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ICON_COLORS[ch]) rect(made.ctx, x, y, 1, 1, ICON_COLORS[ch]);
      }),
    );
    canvas = made.canvas;
    iconCache.set(item, canvas);
  }
  return canvas;
}

/** An <img> tag for an item icon, for use in the HTML menus. */
export function itemIconHtml(item) {
  return `<img class="ico" src="${itemIcon(item).toDataURL()}" alt="">`;
}

/**
 * A data URL of a cat portrait for the menus.
 * @param {HasCoat} cat
 * @param {{ pose?: string, hat?: string | null, wary?: boolean, scale?: number }} [options]
 */
export function catPictureUrl(
  cat,
  { pose = "sit", hat = null, wary = false, scale = 4 } = {},
) {
  const small = makeCanvas(30, 26);
  if (wary)
    drawCat(small.ctx, { coat: dustyCoat(cat.coat) }, pose, 15, 24, {
      time: 1,
    });
  else drawCat(small.ctx, cat, pose, 15, 24, { time: 1, hat });
  const big = makeCanvas(30 * scale, 26 * scale);
  big.ctx.drawImage(small.canvas, 0, 0, 30 * scale, 26 * scale);
  return big.canvas.toDataURL();
}

/** A small hand, drawn stroking a cat in the village. */
export function drawStrokingHand(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  rect(ctx, x - 3, y, 7, 4, "#f0c4a0");
  for (const finger of [-3, -1, 1, 3])
    rect(ctx, x + finger, y + 4, 1, 2, "#f0c4a0");
  rect(ctx, x - 3, y, 7, 1, "#d8a888");
}
