/** Three ways to play: a laser pointer, a ribbon wand and a yarn ball. Each scores 0-1. */
import { VIEW_WIDTH } from "../config.js";
import { clamp, distance, lerp } from "../core/math.js";
import { rand } from "../core/random.js";
import { CAT_BY_ID } from "../data/cats.js";
import { playSound } from "../engine/audio.js";
import { display, drawText, ellipse, rect } from "../engine/canvas.js";
import { input, keyPressed } from "../engine/input.js";
import { finishPlay } from "../game/actions.js";
import { currentState, game } from "../game/runtime.js";
import { openCatMenu } from "../ui/cat-menus.js";
import { setHint } from "../ui/hud.js";
import { playResultHtml } from "../ui/results.js";
import { playCamera } from "../render/stage.js";
import { drawMeter, drawOutdoors, drawTimer, finishMinigame } from "./kit.js";

const GAME_SECONDS = 14;

/** Ends a toy game and shows the result. */
function endToyGame(toy, score) {
  const catId = /** @type {string} */ (game.selectedCatId);
  const result = finishPlay(catId, toy, score);
  finishMinigame(playResultHtml(catId, result), () => openCatMenu(catId));
}

const selectedCat = () => {
  const id = /** @type {string} */ (game.selectedCatId);
  return { def: CAT_BY_ID[id], hat: currentState().cats[id].hat };
};

/* ---------- Laser pointer: keep the dot just out of reach ---------- */

const laser = {
  timeLeft: 0,
  thrill: 0,
  catX: 0,
  catY: 0,
  flip: false,
  dotX: 0,
  dotY: 0,
  done: false,
};

export const LaserScene = {
  name: "laser",
  fullscreen: true,
  enter() {
    Object.assign(laser, {
      timeLeft: GAME_SECONDS,
      thrill: 0,
      catX: 120,
      catY: 206,
      flip: false,
      dotX: 240,
      dotY: 180,
      done: false,
    });
    setHint("Move the red dot. Keep it just out of reach. Let the cat run.");
  },
  update(dt) {
    if (laser.done) return;
    const x = clamp(input.pointer.x, 8, VIEW_WIDTH - 8);
    const y = clamp(input.pointer.y, 40, 256);
    const moved = distance(x, y, laser.dotX, laser.dotY);
    laser.dotX = x;
    laser.dotY = y;
    laser.timeLeft -= dt;
    const angle = Math.atan2(y - laser.catY, x - laser.catX);
    const gap = distance(x, y, laser.catX, laser.catY);
    const speed = clamp(gap * 2.2, 30, 190);
    laser.catX += Math.cos(angle) * speed * dt;
    laser.catY = clamp(laser.catY + Math.sin(angle) * speed * dt, 70, 252);
    laser.flip = Math.cos(angle) < 0;
    if (gap > 24 && gap < 100 && moved > 0.2) laser.thrill += dt / 9; // a good chase
    if (gap < 14) laser.thrill = Math.max(0, laser.thrill - dt * 0.2); // caught it: boring
    if (laser.timeLeft <= 0) {
      laser.done = true;
      endToyGame("laser", laser.thrill);
    }
  },
  draw() {
    const ctx = display.pixel;
    const { def, hat } = selectedCat();
    drawOutdoors(
      860,
      [
        {
          catId: def.id,
          pose: "walk",
          sx: laser.catX,
          sy: laser.catY,
          flip: laser.flip,
          scale: 1.4,
          hat,
        },
      ],
      playCamera(860),
    );
    ellipse(ctx, laser.dotX, laser.dotY, 3, 3, "#f0526a");
    ellipse(ctx, laser.dotX, laser.dotY, 1, 1, "#fff");
    drawMeter(14, 14, 150, "Thrill", laser.thrill, "#f3a982");
    drawTimer(laser.timeLeft);
  },
};

/* ---------- Ribbon wand: yank it away the moment the cat pounces ---------- */

const ROUNDS = 6;
const ribbon = {
  round: 0,
  escapes: 0,
  phase: "wiggle",
  timer: 0,
  message: "",
  yank: 0,
  done: false,
};

export const RibbonScene = {
  name: "ribbon",
  fullscreen: true,
  enter() {
    Object.assign(ribbon, {
      round: 0,
      escapes: 0,
      phase: "wiggle",
      timer: rand(1, 2.2),
      message: "",
      yank: 0,
      done: false,
    });
    setHint(
      "Yank the ribbon by tapping, or press Space, the moment the cat crouches and wiggles.",
    );
  },
  update(dt) {
    if (ribbon.done) return;
    ribbon.timer -= dt;
    ribbon.yank = Math.max(0, ribbon.yank - dt * 3);
    const pressed = input.pointer.pressedThisFrame || keyPressed(" ");
    const rest = (message) => {
      ribbon.message = message;
      ribbon.round += 1;
      ribbon.phase = "rest";
      ribbon.timer = 0.8;
    };
    if (ribbon.phase === "wiggle") {
      if (pressed) {
        rest("Too soon");
        playSound("miss");
      } else if (ribbon.timer < 0) {
        ribbon.phase = "crouch";
        // Cats you know well give you a little longer.
        ribbon.timer =
          0.62 +
          (currentState().cats[/** @type {string} */ (game.selectedCatId)]
            .bond > 40
            ? 0.25
            : 0);
      }
    } else if (ribbon.phase === "crouch") {
      if (pressed) {
        ribbon.escapes += 1;
        ribbon.yank = 1;
        playSound("hit", ribbon.escapes);
        rest("Got away!");
      } else if (ribbon.timer < 0) {
        rest("Caught!");
        playSound("miss");
      }
    } else if (ribbon.timer < 0) {
      if (ribbon.round >= ROUNDS) {
        ribbon.done = true;
        endToyGame("ribbon", ribbon.escapes / ROUNDS + 0.1);
      } else {
        ribbon.phase = "wiggle";
        ribbon.timer = rand(0.9, 2.3);
        ribbon.message = "";
      }
    }
  },
  draw() {
    const ctx = display.pixel;
    const { def, hat } = selectedCat();
    const crouching = ribbon.phase === "crouch";
    const catX = 150 + (crouching ? Math.sin(game.time * 30) * 2 : 0);
    drawOutdoors(1100, [
      {
        catId: def.id,
        pose: crouching ? "loaf" : "sit",
        sx: catX,
        sy: 214,
        scale: 1.6,
        hat,
      },
    ]);
    const rx = 350 + ribbon.yank * 90;
    const ry = 200 - ribbon.yank * 50;
    for (let i = 0; i < 20; i++) {
      rect(
        ctx,
        rx - i * 3.2,
        ry + Math.sin(i * 0.8 + game.time * 6) * 5,
        3,
        3,
        i % 2 ? "#e87c94" : "#f4c3d1",
      );
    }
    rect(ctx, rx, ry - 2, 60, 2, "#a58668");
    if (crouching) drawText("!", catX, 120, { size: 18, color: "#e87c94" });
    drawText(
      `Round ${Math.min(ROUNDS, ribbon.round + 1)} of ${ROUNDS}`,
      240,
      18,
      { size: 9 },
    );
    if (ribbon.message) drawText(ribbon.message, 300, 110, { size: 11 });
  },
};

/* ---------- Yarn ball: keep it in the air; the cat bats it when it comes low ---------- */

const ball = {
  timeLeft: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  rally: 0,
  catX: 0,
  flip: false,
  bat: 0,
  done: false,
};

export const BallScene = {
  name: "ball",
  fullscreen: true,
  enter() {
    Object.assign(ball, {
      timeLeft: GAME_SECONDS,
      x: 240,
      y: 60,
      vx: 60,
      vy: 0,
      rally: 0,
      catX: 240,
      flip: false,
      bat: 0,
      done: false,
    });
    setHint(
      "Tap the yarn ball to keep it in the air. The cat bats it when it comes low.",
    );
  },
  update(dt) {
    if (ball.done) return;
    ball.timeLeft -= dt;
    ball.vy += 210 * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < 10 || ball.x > VIEW_WIDTH - 10) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, 10, VIEW_WIDTH - 10);
    }
    ball.bat = Math.max(0, ball.bat - dt * 3);
    const { x: px, y: py, pressedThisFrame } = input.pointer;
    if (pressedThisFrame && distance(px, py, ball.x, ball.y) < 28) {
      ball.vy = -rand(170, 210);
      ball.vx = (ball.x - px) * 4 + rand(-40, 40);
      ball.rally += 0.09;
      playSound("hit", Math.floor(ball.rally * 10));
    }
    if (keyPressed(" ") && ball.y > 90) {
      ball.vy = -190;
      ball.vx = rand(-90, 90);
      ball.rally += 0.07;
      playSound("hit", 3);
    }
    ball.catX = lerp(ball.catX, ball.x, dt * 2.4);
    ball.flip = ball.x < ball.catX;
    if (ball.y > 190 && Math.abs(ball.x - ball.catX) < 26 && ball.vy > 0) {
      ball.vy = -160;
      ball.vx = rand(-110, 110);
      ball.rally += 0.05;
      ball.bat = 1;
      playSound("click");
    }
    if (ball.y > 236) {
      ball.y = 236;
      ball.vy *= -0.5;
      ball.rally = Math.max(0, ball.rally - 0.04);
    }
    if (ball.timeLeft <= 0) {
      ball.done = true;
      endToyGame("ball", ball.rally);
    }
  },
  draw() {
    const ctx = display.pixel;
    const { def, hat } = selectedCat();
    const running = Math.abs(ball.x - ball.catX) > 10;
    const pose = ball.bat > 0 ? "groom" : running ? "walk" : "sit";
    drawOutdoors(1240, [
      {
        catId: def.id,
        pose,
        sx: ball.catX,
        sy: 244,
        flip: ball.flip,
        scale: 1.4,
        hat,
      },
    ]);
    ellipse(ctx, ball.x, ball.y, 8, 8, "#8c86c0");
    ellipse(ctx, ball.x - 2, ball.y - 2, 4, 4, "#a9a4dc");
    rect(
      ctx,
      ball.x - 6,
      ball.y + Math.sin(game.time * 9) * 2,
      12,
      1,
      "#6f69a4",
    );
    drawMeter(14, 14, 150, "Rally", ball.rally, "#f3a982");
    drawTimer(ball.timeLeft);
  },
};
