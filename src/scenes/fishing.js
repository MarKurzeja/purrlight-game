/** Rhythm fishing at the lake: press A, S or D (or tap a lane) as each ripple reaches the line. */
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config.js";
import {
  createFishingSession,
  pressLane,
  stepFishing,
} from "../core/fishing.js";
import { playSound, setPurring } from "../engine/audio.js";
import { display, drawText, ellipse, rect } from "../engine/canvas.js";
import { input, keyPressed } from "../engine/input.js";
import { finishFishing } from "../game/actions.js";
import { currentState, game } from "../game/runtime.js";
import { setHint } from "../ui/hud.js";
import { fishingResultHtml } from "../ui/results.js";
import { lakeCamera } from "../render/stage.js";
import { drawOutdoors, finishMinigame } from "./kit.js";

const LANE_X = [176, 240, 304];
const HIT_LINE_Y = 212;
const PIXELS_PER_SECOND = 120;
const LANE_KEYS = [
  ["a", "ArrowLeft"],
  ["s", "ArrowDown"],
  ["d", "ArrowRight"],
];

/** @type {import('../core/fishing.js').FishingSession} */
let fishingSession;
let laneFlash = [0, 0, 0];
let judgementTimer = 0;
let fishingDone = false;

function press(lane) {
  laneFlash[lane] = 0.2;
  const result = pressLane(fishingSession, lane);
  if (result === "miss") playSound("miss");
  else {
    playSound("hit", fishingSession.combo);
    judgementTimer = 0.5;
  }
}

export const FishingScene = {
  name: "fishing",
  fullscreen: true,

  enter() {
    fishingSession = createFishingSession(currentState().rod, game.rng);
    laneFlash = [0, 0, 0];
    judgementTimer = 0;
    fishingDone = false;
    setPurring(false);
    setHint("Press A S D, or tap the lanes, as each ripple reaches the line.");
  },

  update(dt) {
    if (fishingDone) return;
    laneFlash = laneFlash.map((f) => Math.max(0, f - dt));
    judgementTimer -= dt;
    LANE_KEYS.forEach((keys, lane) => {
      if (keys.some(keyPressed)) press(lane);
    });
    if (input.pointer.pressedThisFrame) {
      const nearest = LANE_X.reduce(
        (best, x, i) =>
          Math.abs(x - input.pointer.x) <
          Math.abs(LANE_X[best] - input.pointer.x)
            ? i
            : best,
        0,
      );
      press(nearest);
    }
    const { missed, finished: sessionOver } = stepFishing(fishingSession, dt);
    if (missed) judgementTimer = 0.4;
    if (sessionOver) {
      fishingDone = true;
      finishMinigame(fishingResultHtml(finishFishing(fishingSession)));
    }
  },

  draw() {
    const ctx = display.pixel;
    drawOutdoors(300, [], lakeCamera());
    for (let i = 0; i < 18; i++) {
      rect(
        ctx,
        (i * 61 + game.time * 6) % VIEW_WIDTH,
        112 + ((i * 17) % 150),
        8 + (i % 5) * 5,
        1,
        "rgba(255,255,255,.28)",
      );
    }
    for (const [x, y] of [
      [60, 150],
      [420, 170],
      [76, 226],
      [408, 240],
    ]) {
      ellipse(ctx, x, y, 13, 5, "#5e9a70"); // lily pads
      rect(ctx, x + 3, y - 3, 4, 3, "#fbe0ea");
    }
    LANE_X.forEach((x, i) => {
      rect(
        ctx,
        x - 18,
        0,
        36,
        VIEW_HEIGHT,
        `rgba(255,255,255,${0.08 + laneFlash[i] * 1.2})`,
      );
      ellipse(ctx, x, HIT_LINE_Y, 16, 6, "#ffffff55");
      ellipse(
        ctx,
        x,
        HIT_LINE_Y,
        12,
        4,
        laneFlash[i] > 0 ? "#ffe9a2" : "#7fb8d6",
      );
    });
    rect(ctx, 120, HIT_LINE_Y, 240, 1, "#ffffff99");
    for (const note of fishingSession.notes) {
      const y =
        HIT_LINE_Y - (note.time - fishingSession.time) * PIXELS_PER_SECOND;
      if (note.state !== "waiting" || y <= 108) continue;
      const x = LANE_X[note.lane];
      ellipse(ctx, x, y, 9, 5, "#f3a982");
      ellipse(ctx, x, y, 6, 3, "#fff0c0");
      rect(ctx, x - 1, y - 9, 2, 5, "#fff");
    }
    ["A", "S", "D"].forEach((label, i) =>
      drawText(label, LANE_X[i], 244, { size: 9 }),
    );
    drawText(`Timing ${fishingSession.combo} in a row`, 240, 16, { size: 9 });
    if (judgementTimer > 0) {
      drawText(fishingSession.lastJudgement, 240, 175, {
        size: 13,
        color: "#ffe9a2",
      });
    }
  },
};
