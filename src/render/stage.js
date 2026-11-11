/**
 * The 3D stage: owns the WebGL renderer, keeps the valley and village meshes up to date,
 * frames the camera, and draws the scene for any game screen. Also converts between game
 * coordinates and the screen, so 2D labels, bubbles and clicks line up with the 3D world.
 *
 * Game coordinates: x along the street, y depth (see space.js). Screen coordinates: the
 * 480 x 270 HUD canvas.
 */
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config.js";
import { clamp, lerp } from "../core/math.js";
import { createRenderer } from "../engine/gl/renderer.js";
import { MeshBuilder } from "../engine/gl/geometry.js";
import { mat4Identity, mat4Transform } from "../engine/gl/math3d.js";
import { blendLighting } from "./lighting.js";
import { drawCatModel } from "./models.js";
import {
  LAKE_SHAPE,
  WATER_LEVEL,
  fromX,
  fromZ,
  heightAt,
  worldPoint,
} from "./space.js";
import {
  buildClouds,
  buildForest,
  buildLake,
  buildMeadowDetails,
  buildTerrain,
} from "./valley.js";
import { buildVillage } from "./village3d.js";
import { LANDMARKS } from "../data/village.js";

/**
 * @typedef {import('../engine/gl/renderer.js').Renderer} Renderer
 * @typedef {import('../engine/gl/renderer.js').Camera} Camera
 * @typedef {import('../engine/gl/renderer.js').Point} Point
 * @typedef {import('./models.js').Painter} Painter
 * @typedef {import('./lighting.js').TimeOfDay} TimeOfDay
 * @typedef {import('./village3d.js').VillageState} VillageState
 * @typedef {[number, number, number]} Vec3
 */

/** Internal render resolution: twice the HUD, shown with crisp pixels. */
const RENDER_SCALE = 2;
const IDENTITY = mat4Identity();
const EMPTY_VILLAGE = {
  built: {},
  lantern: {},
  lanternLit: false,
  nooks: 0,
  decor: [],
  season: 1,
};

const stageState = {
  /** @type {Renderer | null} */ renderer: null,
  /** @type {Map<string, any>} */ parts: new Map(),
  /** @type {Record<string, any>} */ valley: {},
  /** @type {Record<string, any>} */ village: {},
  /** @type {{ mesh: any, x: number, y: number, z: number }[]} */ clouds: [],
  seasonKey: "",
  villageKey: "",
  /** @type {Vec3[]} */ chimneys: [],
  /** @type {Vec3} */ lanternLight: [0, 0, 0],
  error: "",
};

/** Starts WebGL on the canvas. Returns false (with a reason) if the browser can't. */
export function initStage(canvas) {
  try {
    canvas.width = VIEW_WIDTH * RENDER_SCALE;
    canvas.height = VIEW_HEIGHT * RENDER_SCALE;
    stageState.renderer = createRenderer(canvas);
    return true;
  } catch (error) {
    stageState.error = String(/** @type {Error} */ (error).message ?? error);
    return false;
  }
}

export const stageReady = () => !!stageState.renderer;
export const stageError = () => stageState.error;
/** Chimney tops of lived-in houses (metres), for smoke. */
export const chimneyTops = () => stageState.chimneys;

/** @type {Painter} */
const painter = {
  part(key, build) {
    let mesh = stageState.parts.get(key);
    if (!mesh) {
      mesh = /** @type {Renderer} */ (stageState.renderer).upload(build());
      stageState.parts.set(key, mesh);
    }
    return mesh;
  },
  draw(mesh, model, options) {
    /** @type {Renderer} */ (stageState.renderer).draw(mesh, model, options);
  },
};

/** The painter characters are drawn with. */
export const stagePainter = () => painter;

function replace(store, key, data) {
  const r = /** @type {Renderer} */ (stageState.renderer);
  r.release(store[key]);
  store[key] = data && data.count ? r.upload(data) : null;
}

/**
 * Rebuilds whatever is out of date: the valley when the season changes, the village when
 * something is built or bought. Cheap to call every frame.
 * @param {VillageState | null} state
 * @param {string} seasonId
 */
export function prepareStage(state, seasonId) {
  if (!stageState.renderer) return;
  const village = state ?? EMPTY_VILLAGE;
  if (stageState.seasonKey !== seasonId) {
    stageState.seasonKey = seasonId;
    stageState.villageKey = "";
    const terrain = buildTerrain(seasonId);
    replace(stageState.valley, "near", terrain.near);
    replace(stageState.valley, "far", terrain.far);
    replace(stageState.valley, "forest", buildForest(seasonId));
    replace(stageState.valley, "details", buildMeadowDetails(seasonId));
    replace(stageState.valley, "lake", buildLake(seasonId));
    if (!stageState.clouds.length) {
      stageState.clouds = buildClouds().map((c) => ({
        ...c,
        mesh: stageState.renderer?.upload(c.mesh),
      }));
    }
  }
  const key = [
    seasonId,
    Object.keys(village.built).sort().join(),
    village.lanternLit,
    Object.keys(village.lantern).sort().join(),
    village.nooks,
    village.decor.join(),
  ].join("|");
  if (stageState.villageKey !== key) {
    stageState.villageKey = key;
    const built = buildVillage(village, seasonId);
    replace(stageState.village, "solid", built.solid);
    replace(stageState.village, "windows", built.windows);
    replace(stageState.village, "glass", built.glass);
    stageState.chimneys = built.chimneys;
    stageState.lanternLight = built.lanternLight;
  }
}

/** Forces the village to rebuild next frame (e.g. after loading a different save). */
export function invalidateStage() {
  stageState.villageKey = "";
}

/* ---------- Cameras ---------- */

/**
 * The village follow camera: behind and above a point of interest, looking slightly down.
 * @param {number} x game x
 * @param {number} y game y (depth)
 * @param {number} [zoom] 1 = normal, smaller = closer
 * @returns {Camera}
 */
export function villageCamera(x, y, zoom = 1) {
  const X = clamp((x - 740) * 0.1, -60, 63);
  const Z = lerp(-1.5, (y - 245) * 0.1, 0.6);
  const ground = Math.max(0, heightAt(X, Z));
  return {
    eye: [X, ground + 5.4 * zoom, Z + 19 * zoom],
    target: [X, ground + 3.5, Z - 1.4],
    fov: 40,
  };
}

/**
 * Looking down on a patch of meadow at x, for the play minigames: steep enough that every
 * point on screen is ground nearby, so cats stay a similar size wherever they run.
 * @returns {Camera}
 */
export function playCamera(x) {
  const X = (x - 740) * 0.1;
  return { eye: [X, 10.5, 10.5], target: [X, 0, -1], fov: 46 };
}

/** Looking out over the lake from the shore (the fishing minigame). @returns {Camera} */
export function lakeCamera() {
  return {
    eye: [LAKE_SHAPE.x + 4, 4.2, LAKE_SHAPE.z + 9],
    target: [LAKE_SHAPE.x + 2, -0.6, LAKE_SHAPE.z - 2],
    fov: 50,
  };
}

/** Sets the camera for this frame. @param {Camera} camera */
export function setCamera(camera) {
  stageState.renderer?.setCamera(camera);
}

/* ---------- Projection ---------- */

/**
 * Where a game point (x, y, height above ground in game pixels) appears on the HUD.
 * @returns {{ x: number, y: number, visible: boolean }}
 */
export function toScreen(x, y, height = 0) {
  if (!stageState.renderer) return { x, y: y - height, visible: true };
  const p = stageState.renderer.project(worldPoint(x, y, height));
  return { x: p.x * VIEW_WIDTH, y: p.y * VIEW_HEIGHT, visible: p.visible };
}

/** Where a metre-space point appears on the HUD. @param {Vec3} point */
export function pointToScreen(point) {
  if (!stageState.renderer) return { x: 0, y: 0, visible: false };
  const p = stageState.renderer.project(point);
  return { x: p.x * VIEW_WIDTH, y: p.y * VIEW_HEIGHT, visible: p.visible };
}

/**
 * The ground point (game coordinates) under a HUD position, or null if the ray misses.
 * Marches along the view ray until it dips below the terrain, then refines.
 */
export function groundUnder(screenX, screenY) {
  const r = stageState.renderer;
  if (!r) return { x: screenX, y: screenY };
  const { origin, direction } = r.unproject(
    screenX / VIEW_WIDTH,
    screenY / VIEW_HEIGHT,
  );
  const at = (t) => [
    origin[0] + direction[0] * t,
    origin[1] + direction[1] * t,
    origin[2] + direction[2] * t,
  ];
  const below = (p) => p[1] < Math.max(heightAt(p[0], p[2]), WATER_LEVEL);
  let previous = 0;
  for (let t = 0.5; t < 160; t += 0.5) {
    if (below(at(t))) {
      let lo = previous;
      let hi = t;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (below(at(mid))) hi = mid;
        else lo = mid;
      }
      const p = at(hi);
      return { x: fromX(p[0]), y: fromZ(p[2]) };
    }
    previous = t;
  }
  return null;
}

/** How many HUD pixels a game-pixel length appears as at a point (for hit radii). */
export function screenScale(x, y) {
  const a = toScreen(x, y, 0);
  const b = toScreen(x, y, 10);
  return Math.hypot(a.x - b.x, a.y - b.y) / 10;
}

/* ---------- Drawing ---------- */

const disc = () =>
  new MeshBuilder()
    .cylinder(mat4Transform({}), "#ffffff", { segments: 16 })
    .build();
const flame = (color) => () =>
  new MeshBuilder()
    .cylinder(mat4Transform({}), color, { segments: 5, topRadius: 0 })
    .build();
const unitBoxMesh = (color) => () =>
  new MeshBuilder().box(mat4Transform({}), color).build();

/** A soft blob shadow under a character. */
export function drawShadow(x, y, radius = 0.6) {
  const [X, Y, Z] = worldPoint(x, y, 0);
  painter.draw(
    painter.part("disc", disc),
    mat4Transform({
      x: X,
      y: Y + 0.03,
      z: Z,
      sx: radius,
      sy: 0.01,
      sz: radius * 0.85,
    }),
    {
      unlit: true,
      tint: [0.1, 0.08, 0.16, 0.28],
      transparent: true,
    },
  );
}

/** The campfire's flames and glow. `glow` 0-1 is how much it lights the evening. */
function drawCampfireFlames(time, glow) {
  const [X, Y, Z] = worldPoint(LANDMARKS.fire.x, LANDMARKS.fire.y, 0);
  const colors = ["#f6a55d", "#f7c54f", "#fff0c0"];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = 0.9 + Math.sin(time * 9 + i * 2.3) * 0.25 + (i % 2) * 0.3;
    painter.draw(
      painter.part(`flame:${i % 3}`, flame(colors[i % 3])),
      mat4Transform({
        x: X + Math.cos(a) * 0.28,
        y: Y + 0.15,
        z: Z + Math.sin(a) * 0.28,
        sx: 0.24,
        sy: h,
        sz: 0.24,
        ry: time * 2 + i,
      }),
      { unlit: true },
    );
  }
  painter.draw(
    painter.part("flame:core", flame("#fff6d8")),
    mat4Transform({
      x: X,
      y: Y + 0.15,
      z: Z,
      sx: 0.3,
      sy: 1.5 + Math.sin(time * 11) * 0.2,
      sz: 0.3,
    }),
    { unlit: true },
  );
  if (glow > 0.02) {
    const flicker = 1 + Math.sin(time * 7) * 0.06;
    painter.draw(
      painter.part("disc", disc),
      mat4Transform({
        x: X,
        y: Y + 0.06,
        z: Z,
        sx: 5 * flicker,
        sy: 0.01,
        sz: 5 * flicker,
      }),
      {
        unlit: true,
        tint: [0, 0, 0, 0.22 * glow],
        emissive: [1, 0.55, 0.2],
        transparent: true,
      },
    );
  }
}

/** The Swiss flag, rippling. */
function drawFlag(time) {
  const [X, , Z] = worldPoint(LANDMARKS.flag.x, LANDMARKS.flag.y, 0);
  const red = painter.part("flag:red", unitBoxMesh("#d33838"));
  const white = painter.part("flag:white", unitBoxMesh("#ffffff"));
  for (let i = 0; i < 8; i++) {
    const wave = Math.sin(i * 0.7 - time * 4) * 0.12 * (i / 8);
    const x = X + 0.1 + i * 0.22 + 0.11;
    painter.draw(
      red,
      mat4Transform({
        x,
        y: 4.8,
        z: Z + wave,
        sx: 0.225,
        sy: 1.3,
        sz: 0.04,
        ry: 0,
      }),
    );
    if (i >= 3 && i <= 4) {
      painter.draw(
        white,
        mat4Transform({
          x,
          y: 4.8,
          z: Z + wave + 0.02,
          sx: 0.225,
          sy: 0.8,
          sz: 0.04,
        }),
      );
    }
    if (i >= 2 && i <= 5) {
      painter.draw(
        white,
        mat4Transform({
          x,
          y: 4.8,
          z: Z + wave + 0.02,
          sx: 0.225,
          sy: 0.26,
          sz: 0.04,
        }),
      );
    }
  }
}

/**
 * @typedef {{
 *   state: VillageState | null,
 *   seasonId: string,
 *   timeOfDay: TimeOfDay,
 *   time: number,
 *   camera: Camera,
 *   windowGlow?: number,
 *   fireGlow?: number,
 *   lanternGlow?: number,
 *   points?: Point[],
 *   actors?: (painter: Painter) => void,
 * }} SceneOptions
 */

/**
 * Draws the valley, the village and whatever `actors` adds, from `camera`.
 * @param {SceneOptions} o
 */
export function renderStage(o) {
  const r = stageState.renderer;
  if (!r) return;
  prepareStage(o.state, o.seasonId);
  r.setTime(o.time);
  r.setCamera(o.camera);
  r.setLighting(blendLighting(o.timeOfDay, o.seasonId));
  r.beginFrame();
  const v = stageState.valley;
  for (const mesh of [v.far, v.near, v.forest, v.details])
    if (mesh) r.draw(mesh, IDENTITY);
  const village = stageState.village;
  if (village.solid) r.draw(village.solid, IDENTITY);
  const glow = o.windowGlow ?? 0;
  if (village.windows) {
    r.draw(village.windows, IDENTITY, {
      shine: 1 - glow,
      emissive: [glow * 1.05, glow * 0.68, glow * 0.3],
      tint: [1 - glow * 0.5, 1 - glow * 0.5, 1 - glow * 0.5, 1],
    });
  }
  for (const c of stageState.clouds) {
    const x = ((((c.x + o.time * 0.8 + 360) % 720) + 720) % 720) - 360;
    r.draw(c.mesh, mat4Transform({ x, y: c.y, z: c.z }), {
      tint: [1, 1, 1, 1],
      emissive: [0.18, 0.18, 0.2],
    });
  }
  drawFlag(o.time);
  drawCampfireFlames(o.time, o.fireGlow ?? 0);
  o.actors?.(painter);
  const winter = o.seasonId === "winter";
  if (v.lake) {
    r.draw(v.lake, IDENTITY, {
      shine: winter ? 0.4 : 1,
      wave: winter ? 0 : 1,
      tint: [1, 1, 1, winter ? 1 : 0.86],
      transparent: true,
    });
  }
  if (village.glass) {
    r.draw(village.glass, IDENTITY, {
      shine: 1,
      tint: [1, 1, 1, 0.38],
      transparent: true,
    });
  }
  const lantern = o.lanternGlow ?? 0;
  if (lantern > 0.01) {
    const [X, Y, Z] = stageState.lanternLight;
    for (const [s, a] of [
      [2.2, 0.5],
      [5, 0.22],
      [10, 0.1],
    ]) {
      r.draw(
        painter.part("glow", () =>
          new MeshBuilder()
            .sphere(mat4Transform({}), "#ffffff", { segments: 10, rings: 6 })
            .build(),
        ),
        mat4Transform({ x: X, y: Y, z: Z, s }),
        {
          unlit: true,
          tint: [0, 0, 0, a * lantern],
          emissive: [1, 0.85, 0.5],
          transparent: true,
        },
      );
    }
  }
  r.endFrame(o.points ?? []);
}

/* ---------- Portraits ---------- */

/** @type {Map<string, string>} */
const portraitCache = new Map();

/**
 * A rendered picture of a cat, as a data URL, for menus and cards. Cached.
 * @param {import('./models.js').Coat} coat
 * @param {{ pose?: string, hat?: string | null, size?: number, key: string }} options
 */
export function catPortrait(
  coat,
  { pose = "sit", hat = null, size = 96, key },
) {
  const r = stageState.renderer;
  if (!r) return "";
  const cacheKey = `${key}|${pose}|${hat}|${size}`;
  const cached = portraitCache.get(cacheKey);
  if (cached) return cached;
  r.setLighting(blendLighting({ from: 1, to: 1, blend: 0 }, "summer"));
  const url = r.snapshot(
    size,
    size,
    { eye: [1.9, 1.3, 2.6], target: [0, 0.6, 0], fov: 24 },
    () =>
      drawCatModel(painter, coat, pose, [0, 0, 0], {
        heading: -0.6,
        hat,
        time: 0.4,
      }),
  );
  portraitCache.set(cacheKey, url);
  return url;
}
