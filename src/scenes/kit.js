/** Shared pieces for the minigame scenes. */
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config.js";
import { clamp } from "../core/math.js";
import { currentSeason, isWary } from "../core/state.js";
import { CAT_BY_ID } from "../data/cats.js";
import {
  display,
  drawText,
  makeCanvas,
  rect,
  ellipse,
} from "../engine/canvas.js";
import { GRADE } from "../render/palettes.js";
import { drawCatModel, dustyCoat } from "../render/models.js";
import { worldPoint } from "../render/space.js";
import {
  drawShadow,
  groundUnder,
  renderStage,
  setCamera,
  villageCamera,
} from "../render/stage.js";
import { saveGame } from "../game/persistence.js";
import { game } from "../game/runtime.js";
import { setScene } from "../game/scenes.js";
import { refreshHud } from "../ui/hud.js";
import { showResult } from "../ui/sheet.js";
import { WorldScene } from "./world.js";

const DAYLIGHT = { from: GRADE.day, to: GRADE.day, blend: 0 };

/**
 * A cat to stand in a minigame, placed by where it should appear on screen.
 * @typedef {{ catId: string, pose: string, sx: number, sy: number, scale?: number,
 *   flip?: boolean, hat?: string | null }} StagedCat
 */

/**
 * Shows a minigame's result card, then returns to the village.
 * @param {string} html
 * @param {() => void} [afterReturn] e.g. reopen the cat's menu.
 */
export function finishMinigame(html, afterReturn) {
  document.body.classList.remove("minigame");
  game.paused = true;
  showResult(html, () => {
    setScene(WorldScene);
    refreshHud();
    afterReturn?.();
    saveGame();
  });
}

/**
 * The valley in daylight behind an outdoor minigame, seen from close to the ground at `x`.
 * Cats are given in screen coordinates (the minigames work in screen space) and stand on the
 * ground under that point.
 * @param {number} x where along the village to look (game x)
 * @param {StagedCat[]} [cats]
 * @param {import('../engine/gl/renderer.js').Camera} [camera]
 */
export function drawOutdoors(
  x,
  cats = [],
  camera = villageCamera(x, 300, 0.62),
) {
  const state = game.state;
  setCamera(camera);
  const placed = cats.map((c) => ({ ...c, ground: groundUnder(c.sx, c.sy) }));
  renderStage({
    state,
    seasonId: state ? currentSeason(state).id : "summer",
    timeOfDay: DAYLIGHT,
    time: game.time,
    camera,
    actors: (painter) => {
      for (const c of placed) {
        if (!c.ground || !state) continue;
        const def = CAT_BY_ID[c.catId];
        const wary = isWary(state, c.catId);
        drawShadow(c.ground.x, c.ground.y, 0.5 * (c.scale ?? 1));
        drawCatModel(
          painter,
          wary ? dustyCoat(def.coat) : def.coat,
          c.pose,
          worldPoint(c.ground.x, c.ground.y),
          {
            heading: c.flip ? Math.PI + 0.45 : -0.45,
            time: game.time,
            scale: c.scale ?? 1,
            hat: wary ? null : c.hat,
          },
        );
      }
    },
  });
}

/** A labelled meter bar in the corner of a minigame. */
export function drawMeter(x, y, width, label, value, color) {
  const ctx = display.pixel;
  rect(ctx, x - 1, y - 1, width + 2, 8, "#33415e");
  rect(ctx, x, y, width, 6, "#eef3f8");
  rect(ctx, x, y, width * clamp(value), 6, color);
  drawText(label, x, y + 13, { size: 7, align: "left" });
}

/** Seconds left, top centre. */
export function drawTimer(seconds) {
  drawText(`${Math.ceil(Math.max(0, seconds))}s`, 240, 18, { size: 9 });
}

/** @type {{ season: string, canvas: HTMLCanvasElement } | null} */
let roomCache = null;

/**
 * A cosy chalet room with a window onto the mountains (the petting scene).
 * @param {string} seasonId
 */
export function drawCozyRoom(seasonId) {
  const ctx = display.pixel;
  renderStage({
    state: game.state,
    seasonId,
    timeOfDay: DAYLIGHT,
    time: game.time,
    camera: { eye: [-30, 9, 6], target: [-18, 13, -60], fov: 40 },
  });
  if (!roomCache || roomCache.season !== seasonId) {
    const { canvas, ctx: c } = makeCanvas(VIEW_WIDTH, VIEW_HEIGHT);
    for (let y = 0; y < VIEW_HEIGHT; y++) {
      rect(
        c,
        0,
        y,
        VIEW_WIDTH,
        1,
        y % 12 === 11 ? "#6e4630" : y % 12 < 2 ? "#a06e48" : "#8e5e3e",
      );
    }
    for (let x = 0; x < VIEW_WIDTH; x += 64) {
      rect(c, x + (x % 3) * 5, 0, 1, VIEW_HEIGHT, "#7a4e36");
    }
    // The window is left clear: the real valley shows through it.
    c.clearRect(52, 22, 104, 98);
    for (const [x, y, w, h] of [
      [48, 18, 112, 4],
      [48, 120, 112, 4],
      [48, 18, 4, 106],
      [156, 18, 4, 106],
      [102, 22, 3, 98],
      [52, 68, 104, 3],
    ]) {
      rect(c, x, y, w, h, "#e6dcc8");
    }
    rect(c, 42, 124, 124, 4, "#6a4630");
    for (let i = 0; i < 26; i++) {
      rect(c, 46 + i * 4, 119 - (i % 2), 3, 4, i % 3 ? "#4f9a50" : "#d83a3a");
    }
    rect(c, 0, 226, VIEW_WIDTH, 44, "#7a5038");
    for (let x = 0; x < VIEW_WIDTH; x += 48) rect(c, x, 226, 1, 44, "#5e3c2c");
    rect(c, 0, 226, VIEW_WIDTH, 2, "#5e3c2c");
    ellipse(c, 270, 240, 170, 22, "#a83a38");
    ellipse(c, 270, 240, 160, 19, "#d8524c");
    ellipse(c, 270, 240, 120, 14, "#f0e0c8");
    ellipse(c, 270, 240, 100, 11, "#a83a38");
    rect(c, 350, 40, 84, 6, "#6a4630");
    for (const [x, y, color] of [
      [358, 28, "#d8524c"],
      [372, 26, "#6fb0cc"],
      [386, 30, "#f7d84e"],
      [404, 27, "#6f9a78"],
    ]) {
      rect(c, x, y, 11, 12, color);
    }
    rect(c, 420, 14, 1, 26, "#54403a");
    roomCache = { season: seasonId, canvas };
  }
  ctx.drawImage(roomCache.canvas, 0, 0);
  // A soft beam of daylight from the window.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.07;
  ctx.beginPath();
  ctx.moveTo(60, 24);
  ctx.lineTo(150, 24);
  ctx.lineTo(340, 226);
  ctx.lineTo(150, 226);
  ctx.fill();
  ctx.restore();
}
