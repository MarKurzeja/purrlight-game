/** Autumn mini-hunt: tap the mice as they pop out of the leaf piles. */
import { clamp, distance } from "../core/math.js";
import { pickRandom, rand } from "../core/random.js";
import { playSound } from "../engine/audio.js";
import { display, drawText, ellipse, rect } from "../engine/canvas.js";
import { input } from "../engine/input.js";
import { finishHunt } from "../game/actions.js";
import { setHint } from "../ui/hud.js";
import { huntResultHtml } from "../ui/results.js";
import { playCamera } from "../render/stage.js";
import { drawOutdoors, drawTimer, finishMinigame } from "./kit.js";

const LEAF_PILES = [
  [110, 150],
  [240, 120],
  [370, 150],
  [170, 214],
  [310, 214],
];
const MOUSE_SECONDS = 1.1;
const hunt = {
  timeLeft: 0,
  caught: 0,
  spawnTimer: 0,
  done: false,
  /** @type {{ x: number, y: number, age: number, hit?: boolean }[]} */ mice: [],
};

export const HuntScene = {
  name: "hunt",
  fullscreen: true,
  enter() {
    Object.assign(hunt, {
      timeLeft: 11,
      caught: 0,
      spawnTimer: 0,
      done: false,
      mice: [],
    });
    setHint("A leaf pile is rustling. Tap the mice as they pop out.");
  },
  update(dt) {
    if (hunt.done) return;
    hunt.timeLeft -= dt;
    hunt.spawnTimer -= dt;
    if (hunt.spawnTimer < 0) {
      hunt.spawnTimer = rand(0.5, 0.95);
      const [x, y] = pickRandom(LEAF_PILES);
      hunt.mice.push({ x, y, age: 0 });
    }
    for (const mouse of hunt.mice) mouse.age += dt;
    if (input.pointer.pressedThisFrame) {
      for (const mouse of hunt.mice) {
        if (
          !mouse.hit &&
          distance(input.pointer.x, input.pointer.y, mouse.x, mouse.y - 6) < 24
        ) {
          mouse.hit = true;
          hunt.caught += 1;
          playSound("hit", hunt.caught);
        }
      }
    }
    hunt.mice = hunt.mice.filter((m) => m.age < MOUSE_SECONDS && !m.hit);
    if (hunt.timeLeft <= 0) {
      hunt.done = true;
      finishMinigame(huntResultHtml(finishHunt(hunt.caught)));
    }
  },
  draw() {
    const ctx = display.pixel;
    drawOutdoors(560, [], playCamera(560));
    for (const [x, y] of LEAF_PILES) {
      ellipse(ctx, x, y, 26, 12, "#d9744f");
      ellipse(ctx, x - 6, y - 4, 16, 8, "#eba560");
    }
    for (const mouse of hunt.mice) {
      const rise = Math.sin(clamp(mouse.age / MOUSE_SECONDS) * Math.PI) * 14;
      const y = mouse.y - rise;
      ellipse(ctx, mouse.x, y, 7, 5, "#a7adb8");
      rect(ctx, mouse.x - 5, y - 7, 3, 3, "#a7adb8");
      rect(ctx, mouse.x + 2, y - 7, 3, 3, "#a7adb8");
      rect(ctx, mouse.x - 3, y - 2, 1, 1, "#2d2838");
      rect(ctx, mouse.x + 2, y - 2, 1, 1, "#2d2838");
      ellipse(ctx, mouse.x, mouse.y + 3, 26, 8, "#d9744f");
    }
    drawText(`Mice ${hunt.caught}`, 60, 18, { size: 10 });
    drawTimer(hunt.timeLeft);
  },
};
