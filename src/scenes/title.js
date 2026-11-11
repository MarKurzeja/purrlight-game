/** The title screen: the village at dusk, three cats waiting by the fire, the camera drifting. */
import { CATS } from "../data/cats.js";
import { LANDMARKS } from "../data/village.js";
import { display } from "../engine/canvas.js";
import {
  drawWeather,
  smokePoints,
  updateSmoke,
  updateWeather,
} from "../render/effects.js";
import { drawCatModel } from "../render/models.js";
import { GRADE } from "../render/palettes.js";
import { worldPoint } from "../render/space.js";
import {
  chimneyTops,
  drawShadow,
  renderStage,
  villageCamera,
} from "../render/stage.js";
import { game } from "../game/runtime.js";

const DUSK = { from: GRADE.dusk, to: GRADE.night, blend: 0.3 };
const SEATS = [
  [-26, 8, "sit"],
  [22, 12, "loaf"],
  [-4, 24, "sleep"],
];

export const TitleScene = {
  name: "title",
  runsWhilePaused: true,
  update(dt) {
    game.weather = updateWeather(game.weather, "summer", dt, game.time);
    game.smoke = updateSmoke(game.smoke, chimneyTops(), dt);
  },
  draw() {
    const fire = LANDMARKS.fire;
    renderStage({
      state: null,
      seasonId: "summer",
      timeOfDay: DUSK,
      time: game.time,
      camera: villageCamera(
        fire.x + Math.sin(game.time * 0.05) * 120,
        fire.y - 10,
        1.05,
      ),
      windowGlow: 0.5,
      fireGlow: 0.8,
      points: smokePoints(game.smoke, 0.5),
      actors: (painter) =>
        SEATS.forEach(([dx, dy, pose], i) => {
          const x = fire.x + dx;
          const y = fire.y + dy;
          drawShadow(x, y, 0.5);
          drawCatModel(
            painter,
            CATS[i].coat,
            /** @type {string} */ (pose),
            worldPoint(x, y),
            {
              heading: Math.atan2(-(fire.y - y), fire.x - x),
              time: game.time + i,
            },
          );
        }),
    });
    drawWeather(display.pixel, game.weather, "summer", game.time);
  },
};
