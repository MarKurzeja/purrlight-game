/**
 * The village as a place: what is where, what blocks movement, and how cats wander.
 */
import { GROUND_BOTTOM, GROUND_TOP, WORLD_WIDTH } from "../config.js";
import { tierOf } from "../core/bond.js";
import { catsInTheSun } from "../core/day-cycle.js";
import { clamp, distance } from "../core/math.js";
import { rand } from "../core/random.js";
import { currentSeason, isWary, presentCats } from "../core/state.js";
import { CAT_BY_ID } from "../data/cats.js";
import { LAKE, LANDMARKS, NOOKS } from "../data/village.js";
import { currentState, game } from "./runtime.js";

/** @typedef {import('./runtime.js').Interactable} Interactable */

/** Can the player or a cat stand here? */
export function isBlocked(x, y) {
  if (x < 8 || x > WORLD_WIDTH - 8 || y < GROUND_TOP || y > GROUND_BOTTOM)
    return true;
  if (((x - LAKE.x) / LAKE.rx) ** 2 + ((y - LAKE.y) / LAKE.ry) ** 2 < 1)
    return true;
  if (distance(x, y, LANDMARKS.fire.x, LANDMARKS.fire.y) < 12) return true;
  if (distance(x, y, LANDMARKS.fountain.x, LANDMARKS.fountain.y) < 18)
    return true;
  return false;
}

function freeSpot() {
  for (let i = 0; i < 40; i++) {
    const x = rand(40, WORLD_WIDTH - 90);
    const y = rand(GROUND_TOP + 2, GROUND_BOTTOM - 2);
    if (!isBlocked(x, y) && Math.abs(x - LANDMARKS.fire.x) > 30)
      return { x, y };
  }
  return { x: 800, y: 240 };
}

/** Scatters this morning's herbs, stones and firewood. More of each in the right season. */
export function spawnPickups() {
  const season = currentSeason(currentState()).id;
  const counts = {
    herb: season === "spring" ? 9 : season === "winter" ? 3 : 6,
    stone: season === "summer" ? 5 : season === "winter" ? 2 : 3,
    wood: season === "winter" ? 7 : season === "autumn" ? 5 : 1,
    rustle: season === "autumn" ? 4 : 0,
  };
  game.pickups = Object.entries(counts).flatMap(([kind, n]) =>
    Array.from({ length: n }, () => ({ kind, ...freeSpot() })),
  );
  game.pickups.push(
    { kind: "lake", ...LANDMARKS.lake, fixed: true },
    { kind: "goat", ...LANDMARKS.goat, fixed: true },
  );
}

/** Creates a walking entity for every cat in the village that does not have one yet. */
export function ensureCatEntities() {
  for (const cat of presentCats(currentState())) {
    if (game.cats[cat.id]) continue;
    game.cats[cat.id] = {
      x: rand(670, 940),
      y: rand(GROUND_TOP + 4, GROUND_BOTTOM - 4),
      targetX: null,
      targetY: null,
      pose: "sit",
      idleTimer: rand(1, 4),
      flip: Math.random() < 0.5,
      seed: rand(10),
      following: false,
      startleCooldown: 0,
      greetAt: 0,
      emote: null,
      rubs: 0,
      rubSide: 1,
      chasing: null,
    };
  }
}

/**
 * Decides where each cat wants to go this frame, then moves it.
 * @param {number} dt
 * @param {{ onSecretFound: (catId: string) => void }} hooks
 */
export function updateCats(dt, hooks) {
  const state = currentState();
  const player = game.player;
  const asleep = state.phase === "dawn";
  const season = currentSeason(state).id;
  const sunny = catsInTheSun(state);

  presentCats(state).forEach((cat, index) => {
    const e = game.cats[cat.id];
    if (!e) return;
    const toPlayer = distance(e.x, e.y, player.x, player.y);
    const leading = game.leadingCatId === cat.id;
    const secret = CAT_BY_ID[cat.id].secret;

    if (game.strokingCatId === cat.id) {
      stop(e, "purr");
      e.flip = e.x > player.x;
      return;
    }
    if (leading) {
      // Walk towards the secret, but wait for the player to keep up.
      if (toPlayer < 80) setTarget(e, secret.x, secret.y);
      else stop(e, "sit");
    } else if (e.following) {
      if (toPlayer > 30) {
        setTarget(
          e,
          player.x + (e.flip ? 18 : -18),
          clamp(player.y + 6, GROUND_TOP + 1, GROUND_BOTTOM - 1),
        );
      } else if (e.pose === "walk") stop(e, "sit");
    } else if (game.sitting && toPlayer < 130 && !asleep) {
      // Sitting quietly draws cats in to curl up beside the player.
      const side = e.x < player.x ? -1 : 1;
      const spotX = player.x + side * (13 + (index % 3) * 8);
      if (Math.abs(e.x - spotX) > 3 || Math.abs(e.y - player.y) > 5) {
        setTarget(
          e,
          spotX,
          clamp(
            player.y + (index % 2 ? 3 : -2),
            GROUND_TOP + 1,
            GROUND_BOTTOM - 1,
          ),
        );
      } else {
        stop(e, "loaf");
        e.flip = side > 0;
      }
    } else if (e.rubs > 0) {
      rubAgainstLegs(e);
    } else if (e.chasing) {
      chaseButterfly(e);
    } else {
      wander(e, cat.id, index, { asleep, season, sunny, toPlayer });
    }
    e.startleCooldown -= dt;
    move(e, cat.id, dt, toPlayer);

    if (
      leading &&
      distance(player.x, player.y, secret.x, secret.y) < 34 &&
      distance(e.x, e.y, secret.x, secret.y) < 34
    ) {
      hooks.onSecretFound(cat.id);
    }
  });
}

/** Weaves back and forth around the player's ankles. */
function rubAgainstLegs(e) {
  const player = game.player;
  if (player.moving) {
    e.rubs = 0;
    return;
  }
  const spotX = player.x + e.rubSide * 6;
  if (Math.abs(e.x - spotX) > 2 || Math.abs(e.y - (player.y + 1)) > 3) {
    setTarget(e, spotX, clamp(player.y + 1, GROUND_TOP + 1, GROUND_BOTTOM - 1));
  } else {
    e.rubSide *= -1;
    e.rubs -= 1;
    e.emote = { kind: "heart", at: game.time };
    if (e.rubs === 0) stop(e, "sit");
  }
}

/** Stalks a butterfly, then pounces. The butterfly always gets away. */
function chaseButterfly(e) {
  const b = e.chasing;
  if (!b || b.fleeing) {
    e.chasing = null;
    return;
  }
  const groundY = clamp(b.y, GROUND_TOP + 1, GROUND_BOTTOM - 1);
  if (distance(e.x, e.y, b.x, groundY) > 8) {
    setTarget(e, b.x, groundY);
  } else {
    stop(e, "loaf");
    b.fleeing = true;
    e.chasing = null;
    e.emote = { kind: "!", at: game.time };
    e.idleTimer = 1.5;
  }
}

function setTarget(e, x, y) {
  e.targetX = x;
  e.targetY = y;
  e.pose = "walk";
}

function stop(e, pose) {
  e.targetX = null;
  e.targetY = null;
  e.pose = pose;
}

/** Idle behaviour: nap, sit, loaf or stroll, shaped by the season. */
function wander(e, catId, index, { asleep, season, sunny, toPlayer }) {
  const state = currentState();
  e.idleTimer -= game.dt;
  if (asleep && e.pose !== "sleep" && !isWary(state, catId)) stop(e, "sleep");
  if (e.idleTimer < 0 && !asleep) {
    e.idleTimer = rand(2.5, 7);
    const roll = Math.random();
    const wary = isWary(state, catId);
    const friendly = !wary && tierOf(state.cats[catId].bond) >= 2;
    const butterfly =
      !wary && state.phase === "day" ? nearestButterfly(e) : null;
    if (
      friendly &&
      toPlayer < 60 &&
      game.player.stillFor > 1.5 &&
      roll < 0.35
    ) {
      e.rubs = 4;
      e.rubSide = e.x < game.player.x ? -1 : 1;
      return;
    }
    if (butterfly && roll > 0.85) {
      e.chasing = butterfly;
      return;
    }
    if (roll < 0.45) {
      let x;
      let y;
      if (season === "summer" && state.nooks && !sunny.has(catId)) {
        const nook = NOOKS[index % state.nooks];
        x = nook.x + rand(-12, 12);
        y = nook.y + rand(0, 8);
      } else if (season === "winter") {
        const angle = rand(Math.PI * 2);
        x = LANDMARKS.fire.x + Math.cos(angle) * rand(18, 40);
        y = LANDMARKS.fire.y + Math.sin(angle) * rand(18, 40);
      } else {
        x = clamp(e.x + rand(-90, 90), 620, 980);
        y = clamp(e.y + rand(-40, 40), GROUND_TOP + 2, GROUND_BOTTOM - 2);
      }
      if (!isBlocked(x, y)) setTarget(e, x, y);
    } else {
      // Idle: sit, loaf, nap, wash, or a quick yawn.
      const idle =
        roll < 0.6
          ? "sit"
          : roll < 0.72
            ? "loaf"
            : roll < 0.84
              ? "groom"
              : roll < 0.9
                ? "yawn"
                : "sleep";
      stop(e, idle);
      if (idle === "yawn") e.idleTimer = 1.3;
    }
  }
  // Spring: strangers startle and dart away when you rush at them.
  const stranger = tierOf(state.cats[catId].bond) === 0;
  if (
    season === "spring" &&
    state.phase === "day" &&
    stranger &&
    toPlayer < 26 &&
    game.player.moving &&
    !isWary(state, catId) &&
    e.startleCooldown <= 0
  ) {
    setTarget(
      e,
      clamp(e.x + (e.x - game.player.x) * 3, 30, WORLD_WIDTH - 30),
      clamp(e.y + (e.y - game.player.y) * 2, GROUND_TOP + 2, GROUND_BOTTOM - 2),
    );
    e.startleCooldown = 3;
    e.emote = { kind: "!", at: game.time };
  }
}

function move(e, catId, dt, toPlayer) {
  if (e.targetX === null || e.targetY === null) return;
  const brisk = e.following || game.leadingCatId === catId;
  const speed = (brisk ? 80 : isWary(currentState(), catId) ? 18 : 30) * dt;
  const angle = Math.atan2(e.targetY - e.y, e.targetX - e.x);
  const nx = e.x + Math.cos(angle) * speed;
  const ny = e.y + Math.sin(angle) * speed;
  e.flip = Math.cos(angle) < 0;
  if (!isBlocked(nx, ny)) {
    e.x = nx;
    e.y = ny;
  } else if (!isBlocked(nx, e.y)) {
    e.x = nx;
  } else if (!isBlocked(e.x, ny)) {
    e.y = ny;
  } else if (game.sitting && toPlayer < 130) {
    // Step around the campfire or fountain to reach the player.
    const sidestep = clamp(
      e.y + (e.y < LANDMARKS.fire.y ? -1 : 1) * speed * 1.5,
      GROUND_TOP + 1,
      GROUND_BOTTOM - 1,
    );
    if (!isBlocked(e.x, sidestep)) e.y = sidestep;
    else e.x += (e.x < game.player.x ? 1 : -1) * speed;
  } else if (!e.following && !game.leadingCatId) {
    stop(e, "sit");
  }
  if (
    e.targetX !== null &&
    e.targetY !== null &&
    distance(e.x, e.y, e.targetX, e.targetY) < 4
  ) {
    stop(e, "sit");
  }
}

/** The nearest thing the player can use, within reach. @returns {Interactable | null} */
export function findFocus() {
  const p = game.player;
  /** @type {Interactable | null} */
  let best = null;
  let bestScore = 30;
  const consider = (target, x, y, reach = 30) => {
    const d = distance(p.x, p.y, x, y);
    if (d < reach && d < bestScore + (reach - 30)) {
      bestScore = d;
      best = target;
    }
  };
  for (const pickup of game.pickups) {
    if (!pickup.taken) {
      consider(
        { kind: "pickup", pickup },
        pickup.x,
        pickup.y,
        pickup.kind === "lake" ? 46 : pickup.kind === "goat" ? 40 : 24,
      );
    }
  }
  for (const cat of presentCats(currentState())) {
    const e = game.cats[cat.id];
    if (e) consider({ kind: "cat", catId: cat.id }, e.x, e.y, 28);
  }
  consider({ kind: "lantern" }, LANDMARKS.lantern.x, LANDMARKS.lantern.y, 34);
  return best;
}

/** What is under a click at world position (x, y)? @returns {Interactable | null} */
export function interactableAt(x, y) {
  /** @type {Interactable | null} */
  let hit = null;
  let nearestCat = 18;
  for (const cat of presentCats(currentState())) {
    const e = game.cats[cat.id];
    if (!e) continue;
    const d = distance(x, y, e.x, e.y - 6);
    if (d < nearestCat) {
      nearestCat = d;
      hit = { kind: "cat", catId: cat.id };
    }
  }
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const radius =
      pickup.kind === "lake" ? 50 : pickup.kind === "goat" ? 26 : 14;
    if (
      distance(
        x,
        y,
        pickup.x,
        pickup.kind === "lake" ? pickup.y - 20 : pickup.y,
      ) < radius
    ) {
      hit = { kind: "pickup", pickup };
    }
  }
  if (distance(x, y, LANDMARKS.lantern.x, 110) < 70) hit = { kind: "lantern" };
  return hit;
}

/** World position of an interactable. @param {Interactable} target */
export function positionOf(target) {
  if (target.kind === "cat") return game.cats[target.catId];
  if (target.kind === "pickup") return target.pickup;
  return LANDMARKS.lantern;
}

/* ---------- Butterflies ---------- */

const BUTTERFLY_COLORS = ["#ffffff", "#f7d84e", "#f29ab8", "#a9c6ee"];

/** Butterflies flutter over the meadow on spring and summer days. */
export function updateButterflies(dt) {
  const state = currentState();
  const season = currentSeason(state).id;
  const wanted =
    state.phase === "day" && (season === "spring" || season === "summer")
      ? 6
      : 0;
  while (game.butterflies.filter((b) => !b.fleeing).length < wanted) {
    const x = rand(560, 1000);
    const y = rand(GROUND_TOP + 10, GROUND_BOTTOM - 10);
    game.butterflies.push({
      x,
      y,
      height: rand(4, 12),
      targetX: x,
      targetY: y,
      color: BUTTERFLY_COLORS[Math.floor(rand(4))],
      fleeing: false,
    });
  }
  for (const b of game.butterflies) {
    if (b.fleeing) {
      b.height += 30 * dt;
      b.x += 15 * dt;
      continue;
    }
    if (distance(b.x, b.y, b.targetX, b.targetY) < 4) {
      b.targetX = clamp(b.x + rand(-60, 60), 540, 1020);
      b.targetY = clamp(b.y + rand(-40, 40), GROUND_TOP + 5, GROUND_BOTTOM - 5);
    }
    const angle = Math.atan2(b.targetY - b.y, b.targetX - b.x);
    b.x += Math.cos(angle) * 22 * dt;
    b.y += Math.sin(angle) * 22 * dt;
    b.height = clamp(
      b.height + Math.sin(game.time * 7 + b.targetX) * 12 * dt,
      3,
      14,
    );
  }
  game.butterflies = game.butterflies.filter((b) => b.height < 80);
}

function nearestButterfly(e) {
  return (
    game.butterflies.find((b) => !b.fleeing && Math.abs(b.x - e.x) < 140) ??
    null
  );
}
