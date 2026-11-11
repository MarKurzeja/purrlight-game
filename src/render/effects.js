/** Small animated effects: campfire, chimney smoke, weather, particles, bubbles and markers. */
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config.js";
import { pickRandom, rand } from "../core/random.js";
import { ellipse, makeCanvas, rect } from "../engine/canvas.js";
import { drawHeart, itemIcon } from "./sprites.js";

/**
 * Projects a game point (x, y, height above the ground, all in game pixels) to the HUD.
 * @typedef {(x: number, y: number, height: number) => { x: number, y: number, visible: boolean }} Project
 */

/* ---------- Chimney smoke ---------- */

/** @typedef {{ x: number, y: number, z: number, age: number }} Puff  In metres. */

/** @param {Puff[]} puffs @param {number[][]} chimneys chimney tops in metres */
export function updateSmoke(puffs, chimneys, dt) {
  if (chimneys.length && Math.random() < 0.3) {
    const [x, y, z] = pickRandom(chimneys);
    puffs.push({ x, y, z, age: 0 });
  }
  for (const p of puffs) {
    p.age += dt;
    p.y += dt * 0.9;
    p.x += dt * (0.35 + Math.sin(p.age * 2) * 0.4);
  }
  return puffs.filter((p) => p.age < 4);
}

/**
 * Smoke as round particles for the 3D renderer.
 * @param {Puff[]} puffs
 * @returns {import('../engine/gl/renderer.js').Point[]}
 */
export function smokePoints(puffs, dark) {
  const color = dark > 0.5 ? [0.55, 0.58, 0.72] : [0.96, 0.95, 0.93];
  return puffs.map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    size: 0.35 + p.age * 0.35,
    color: [...color, (1 - p.age / 4) * 0.45],
  }));
}

/* ---------- Weather: blossom, fireflies, leaves, snow ---------- */

/** @typedef {{ x: number, y: number, speed: number, phase: number }} Flake */

const WEATHER_DENSITY = { spring: 12, summer: 8, autumn: 22, winter: 50 };

/** @param {Flake[]} flakes */
export function updateWeather(flakes, seasonId, dt, time) {
  if (flakes.length < WEATHER_DENSITY[seasonId]) {
    flakes.push({
      x: rand(VIEW_WIDTH + 40),
      y: -6,
      speed: rand(10, 24),
      phase: rand(7),
    });
  }
  for (const f of flakes) {
    f.y += f.speed * dt * (seasonId === "winter" ? 1.1 : 0.8);
    f.x += Math.sin(time + f.phase) * 0.3 - 0.15;
  }
  return flakes.filter((f) => f.y < VIEW_HEIGHT + 8);
}

/** @param {Flake[]} flakes */
export function drawWeather(ctx, flakes, seasonId, time) {
  for (const f of flakes) {
    switch (seasonId) {
      case "spring":
        rect(ctx, f.x, f.y, 2, 1, "#fbe0ea");
        break;
      case "summer": {
        const y = f.y * 0.6 + 150; // fireflies hover over the meadow
        rect(ctx, f.x, y, 1, 1, "#fff");
        rect(
          ctx,
          f.x + (Math.sin(time * 9 + f.phase) > 0 ? 1 : -1),
          y,
          1,
          1,
          "#f7d84e",
        );
        break;
      }
      case "autumn":
        rect(ctx, f.x, f.y, 1, 2, "#f0c04a");
        break;
      default: {
        const size = f.phase > 4 ? 2 : 1;
        rect(ctx, f.x, f.y, size, size, "#fff");
      }
    }
  }
}

/* ---------- Particles ---------- */

/**
 * A particle on the ground plane: (x, y) in game coordinates and `height` above the ground.
 * @typedef {{ x: number, y: number, height: number, vx: number, vy: number, vh: number,
 *   age: number, life: number, color: string, kind: 'spark' | 'heart' | 'dust' }} Particle
 */

/** @param {Particle[]} particles @param {Particle['kind']} kind */
export function spawnBurst(
  particles,
  x,
  y,
  color,
  count = 8,
  kind = "spark",
  height = 12,
) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      height,
      vx: rand(-30, 30),
      vy: rand(-10, 10),
      vh: rand(10, 46),
      age: 0,
      life: rand(0.6, 1.1),
      color,
      kind,
    });
  }
}

/** @param {Particle[]} particles */
export function spawnDust(particles, x, y, color) {
  particles.push({
    x: x + rand(-3, 3),
    y,
    height: 1,
    vx: rand(-6, 6),
    vy: 0,
    vh: 4,
    age: 0,
    life: 0.5,
    color,
    kind: "dust",
  });
}

/** @param {Particle[]} particles */
export function updateParticles(particles, dt) {
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.height += p.vh * dt;
    if (p.kind !== "dust") p.vh -= 60 * dt;
  }
  return particles.filter((p) => p.age < p.life);
}

/** @param {Particle[]} particles @param {Project} project */
export function drawParticles(ctx, particles, project) {
  for (const p of particles) {
    const fade = 1 - p.age / p.life;
    const at = project(p.x, p.y, Math.max(0, p.height));
    if (!at.visible) continue;
    if (p.kind === "heart") {
      ctx.globalAlpha = fade;
      drawHeart(ctx, at.x, at.y, p.color);
    } else {
      ctx.globalAlpha = fade * 0.7;
      rect(ctx, at.x, at.y, p.kind === "dust" ? 2 : 1, 1, p.color);
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- Speech bubbles and markers ---------- */

/**
 * A speech bubble showing what a cat wants: food, pets, a game or company.
 * @param {'food' | 'pets' | 'play' | 'sit'} wish
 */
export function drawWishBubble(ctx, x, y, wish, time, alpha = 1) {
  x = Math.round(x);
  y = Math.round(y + Math.sin(time * 3) * 1.2);
  ctx.globalAlpha = alpha;
  rect(ctx, x - 8, y - 13, 17, 12, "#33415e");
  rect(ctx, x - 7, y - 12, 15, 10, "#ffffff");
  rect(ctx, x - 1, y - 2, 3, 2, "#33415e");
  rect(ctx, x, y - 2, 1, 1, "#fff");
  switch (wish) {
    case "food":
      ctx.drawImage(itemIcon("sardine"), x - 5, y - 11);
      break;
    case "pets":
      rect(ctx, x - 3, y - 8, 6, 4, "#f0c4a0");
      for (const finger of [-3, -1, 1])
        rect(ctx, x + finger, y - 11, 1, 3, "#f0c4a0");
      rect(ctx, x + 3, y - 9, 1, 2, "#f0c4a0");
      break;
    case "play":
      ellipse(ctx, x, y - 7, 4, 4, "#8c86c0");
      rect(ctx, x - 3, y - 7, 7, 1, "#6a64a0");
      rect(ctx, x + 3, y - 4, 3, 1, "#8c86c0");
      break;
    default:
      for (const d of [-4, 0, 4]) rect(ctx, x + d - 1, y - 7, 2, 2, "#33415e");
  }
  ctx.globalAlpha = 1;
}

/**
 * The red guide marker. Points down at a target on screen, or sideways at the screen edge.
 * @param {-1 | 0 | 1} direction 0 = target is on screen.
 */
export function drawGuideMarker(ctx, x, y, direction, time) {
  if (direction) {
    x += direction * Math.sin(time * 6) * 2;
    rect(ctx, x - direction * 4, y - 2, 5, 5, "#c8423c");
    rect(ctx, x, y - 6, 1, 13, "#c8423c");
    for (let i = 1; i < 7; i++)
      rect(ctx, x + direction * i, y - 6 + i, 1, 13 - 2 * i, "#c8423c");
    rect(ctx, x - direction * 5, y - 2, 1, 5, "#fff");
  } else {
    for (let i = 0; i < 5; i++)
      rect(ctx, x - 4 + i, y + i, 9 - 2 * i, 1, "#c8423c");
    rect(ctx, x - 5, y - 1, 11, 1, "#fff");
  }
}

/** A faint paper texture laid over the game canvas. */
export function paperTextureUrl(noise) {
  const { canvas, ctx } = makeCanvas(240, 135);
  const image = ctx.createImageData(240, 135);
  for (let y = 0; y < 135; y++) {
    for (let x = 0; x < 240; x++) {
      const v = noise(x, y);
      const p = (y * 240 + x) * 4;
      image.data[p] = image.data[p + 1] = image.data[p + 2] = v;
      image.data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/**
 * Butterflies over the meadow: two wings that flap.
 * @param {{ x: number, y: number, height: number, color: string }[]} butterflies
 * @param {Project} project
 */
export function drawButterflies(ctx, butterflies, project, time) {
  for (const b of butterflies) {
    const at = project(b.x, b.y, b.height);
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    if (!at.visible || x < -4 || x > VIEW_WIDTH + 4) continue;
    const open = Math.sin(time * 18 + b.x) > 0;
    rect(ctx, x, y, 1, 2, "#33415e");
    rect(ctx, x - (open ? 2 : 1), y - (open ? 0 : 1), open ? 2 : 1, 2, b.color);
    rect(ctx, x + 1, y - (open ? 0 : 1), open ? 2 : 1, 2, b.color);
  }
}
