/** The ending: you climb to the Lantern with your cats and light it. */
import { clamp, lerp } from "../core/math.js";
import { currentSeason, presentCats } from "../core/state.js";
import { rand } from "../core/random.js";
import { CAT_BY_ID } from "../data/cats.js";
import { FINALE_LINES } from "../data/story.js";
import { LANDMARKS } from "../data/village.js";
import { playSound } from "../engine/audio.js";
import { drawText } from "../engine/canvas.js";
import { smokePoints, updateSmoke } from "../render/effects.js";
import { drawCatModel, drawPlayerModel } from "../render/models.js";
import { GRADE } from "../render/palettes.js";
import { worldPoint } from "../render/space.js";
import { chimneyTops, drawShadow, renderStage } from "../render/stage.js";
import { currentState, game } from "../game/runtime.js";
import { setHint } from "../ui/hud.js";
import { showFinaleLetter } from "../ui/letters.js";

const LINE_SECONDS = 4.2;
const finale = {
  elapsed: 0,
  line: 0,
  letterShown: false,
  /** @type {{ x: number, y: number, z: number, at: number }[]} */ lamps: [],
};

export const FinaleScene = {
  name: "finale",

  enter() {
    currentState().phase = "night";
    Object.assign(finale, {
      elapsed: 0,
      line: 0,
      letterShown: false,
      // Lanterns that rise from the village, one by one (metres).
      lamps: Array.from({ length: 26 }, () => ({
        x: rand(-30, 60),
        y: rand(0.5, 2),
        z: rand(-6, 8),
        at: rand(8, 15),
      })),
    });
    setHint("");
    playSound("chime");
  },

  update(dt) {
    finale.elapsed += dt;
    if (
      Math.floor(finale.elapsed / LINE_SECONDS) > finale.line &&
      finale.line < FINALE_LINES.length
    ) {
      finale.line += 1;
      playSound("chime");
    }
    game.smoke = updateSmoke(game.smoke, chimneyTops(), dt);
    if (finale.elapsed > 17 && !finale.letterShown) {
      finale.letterShown = true;
      const state = currentState();
      state.lanternLit = true;
      for (const c of presentCats(state)) state.cats[c.id].warmth = 100;
      showFinaleLetter();
    }
  },

  draw() {
    const state = currentState();
    const t = finale.elapsed;
    const glow = clamp((t - 3) / 2);
    const lantern = LANDMARKS.lantern;
    // The camera drifts up the street towards the Lantern, then looks back over the valley.
    const pan = clamp(t / 12);
    const eye = [lerp(30, 60, pan), lerp(5, 9, pan), lerp(16, 12, pan)];
    const target = [lerp(52, 68, pan), lerp(4, 8, pan), lerp(-4, -13, pan)];
    const lamps = finale.lamps
      .filter((lamp) => t > lamp.at)
      .map((lamp, i) => {
        const age = t - lamp.at;
        const flicker = Math.sin(game.time * 3 + i) * 0.15 + 0.85;
        return {
          x: lamp.x + Math.sin(age * 0.4 + i) * 0.6,
          y: lamp.y + age * 1.1,
          z: lamp.z - age * 0.4,
          size: 0.35,
          color: [1, 0.86 * flicker, 0.5, clamp(1.4 - age / 12)],
        };
      });
    renderStage({
      state,
      seasonId: currentSeason(state).id,
      timeOfDay: {
        from: GRADE.night,
        to: GRADE.dusk,
        blend: clamp((t - 3) / 12) * 0.45,
      },
      time: game.time,
      camera: {
        eye: /** @type {any} */ (eye),
        target: /** @type {any} */ (target),
        fov: 42,
      },
      windowGlow: 1,
      fireGlow: 0.8,
      lanternGlow: glow,
      points: [...smokePoints(game.smoke, 1), ...lamps],
      actors: (painter) => {
        drawPlayerModel(painter, worldPoint(lantern.x - 20, lantern.y + 6), {
          heading: Math.PI * 0.62,
          time: game.time,
        });
        presentCats(state).forEach((c, i) => {
          const progress = clamp((t - i * 0.7) / 6);
          const x = lerp(
            1180 + (i % 4) * 20,
            lantern.x - 60 + (i % 5) * 18,
            progress,
          );
          const y = lerp(
            230 + (i % 3) * 22,
            214 + (i % 2) * 14 + Math.floor(i / 5) * 12,
            progress,
          );
          drawShadow(x, y, 0.5);
          drawCatModel(
            painter,
            CAT_BY_ID[c.id].coat,
            progress < 1 ? "walk" : "sit",
            worldPoint(x, y),
            {
              heading: progress < 1 ? 0.1 : Math.PI * 0.7,
              time: game.time + i,
              hat: state.cats[c.id].hat,
            },
          );
        });
      },
    });
    if (finale.line < FINALE_LINES.length) {
      drawText(FINALE_LINES[finale.line], 240, 30, { size: 11 });
    }
  },
};
