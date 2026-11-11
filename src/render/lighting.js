/**
 * Time-of-day lighting for the 3D scene: four presets (dawn, day, dusk, night) and smooth
 * blends between them as the day's clock runs.
 */
import { clamp, lerp } from "../core/math.js";
import { GRADE } from "./palettes.js";

/**
 * @typedef {import('../engine/gl/renderer.js').Lighting} GlLighting
 * @typedef {{ from: number, to: number, blend: number }} TimeOfDay  Cross-fade between presets.
 */

/** @type {readonly GlLighting[]} indexed by GRADE */
export const LIGHT_PRESETS = Object.freeze([
  {
    // dawn: a low pink sun from the east
    sunDir: [-0.72, 0.2, -0.62],
    sunColor: [0.8, 0.56, 0.5],
    sky: [0.42, 0.4, 0.6],
    ground: [0.3, 0.24, 0.3],
    fog: [0.92, 0.76, 0.78],
    fogNear: 40,
    fogFar: 260,
    skyTop: [0.4, 0.47, 0.78],
    skyHorizon: [1.0, 0.8, 0.72],
    skyBottom: [0.62, 0.55, 0.62],
    sunGlow: [1.0, 0.72, 0.52],
    stars: 0,
  },
  {
    // day: high, clear mountain light
    sunDir: [0.42, 0.78, -0.46],
    sunColor: [0.6, 0.56, 0.48],
    sky: [0.4, 0.45, 0.56],
    ground: [0.26, 0.24, 0.2],
    fog: [0.76, 0.86, 0.95],
    fogNear: 50,
    fogFar: 300,
    skyTop: [0.27, 0.53, 0.86],
    skyHorizon: [0.84, 0.92, 0.98],
    skyBottom: [0.68, 0.78, 0.84],
    sunGlow: [1.0, 0.95, 0.82],
    stars: 0,
  },
  {
    // dusk: amber light from the west, violet shadows
    sunDir: [0.78, 0.16, -0.6],
    sunColor: [0.82, 0.46, 0.3],
    sky: [0.38, 0.32, 0.52],
    ground: [0.26, 0.18, 0.24],
    fog: [0.86, 0.56, 0.56],
    fogNear: 40,
    fogFar: 250,
    skyTop: [0.22, 0.25, 0.54],
    skyHorizon: [1.0, 0.62, 0.44],
    skyBottom: [0.48, 0.34, 0.44],
    sunGlow: [1.0, 0.58, 0.34],
    stars: 0,
  },
  {
    // night: cool moonlight and stars
    sunDir: [-0.4, 0.55, -0.73],
    sunColor: [0.26, 0.32, 0.55],
    sky: [0.15, 0.18, 0.34],
    ground: [0.07, 0.07, 0.14],
    fog: [0.09, 0.12, 0.25],
    fogNear: 30,
    fogFar: 230,
    skyTop: [0.03, 0.05, 0.16],
    skyHorizon: [0.14, 0.19, 0.38],
    skyBottom: [0.06, 0.07, 0.14],
    sunGlow: [0, 0, 0],
    stars: 1,
  },
]);

/**
 * Which presets to show for the current time of day.
 * @param {{ phase: string, clock: number } | null} state
 * @returns {TimeOfDay}
 */
export function lightingFor(state) {
  if (!state) return { from: GRADE.dusk, to: GRADE.night, blend: 0.35 };
  switch (state.phase) {
    case "dawn":
      return {
        from: GRADE.dawn,
        to: GRADE.day,
        blend: Math.pow(clamp(state.clock), 1.6),
      };
    case "day":
      return state.clock < 0.72
        ? { from: GRADE.day, to: GRADE.day, blend: 0 }
        : {
            from: GRADE.day,
            to: GRADE.dusk,
            blend: (state.clock - 0.72) / 0.28,
          };
    case "evening":
      return { from: GRADE.dusk, to: GRADE.night, blend: 0.35 };
    default:
      return { from: GRADE.night, to: GRADE.night, blend: 0 };
  }
}

/** How dark it is, 0 (day) to 1 (night). Dusk counts as partly dark. @param {TimeOfDay} t */
export function darkness(t) {
  const level = (grade) =>
    grade === GRADE.night ? 1 : grade === GRADE.dusk ? 0.45 : 0;
  return lerp(level(t.from), level(t.to), t.blend);
}

const mixVec = (a, b, t) =>
  /** @type {[number, number, number]} */ (a.map((v, i) => lerp(v, b[i], t)));

/**
 * Blends two presets into renderer lighting. Winter brightens the ground bounce (snow).
 * @param {TimeOfDay} t
 * @param {string} [seasonId]
 * @returns {GlLighting}
 */
export function blendLighting(t, seasonId = "summer") {
  const a = LIGHT_PRESETS[t.from];
  const b = LIGHT_PRESETS[t.to];
  const k = t.blend;
  /** @type {any} */
  const out = {};
  for (const key of Object.keys(a)) {
    const value = a[key];
    out[key] = Array.isArray(value)
      ? mixVec(value, b[key], k)
      : lerp(value, b[key], k);
  }
  if (seasonId === "winter") {
    out.ground = mixVec(out.ground, out.sky, 0.6);
    out.fog = mixVec(out.fog, [0.92, 0.94, 1], 0.25 * (1 - darkness(t)));
  }
  return out;
}
