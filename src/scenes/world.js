/** The village: walking, gathering, visiting cats, and sitting quietly. */
import {
  BALANCE,
  BUILDING_LINE,
  GROUND_BOTTOM,
  GROUND_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../config.js';
import { sitWith, strokeCat } from '../core/care.js';
import { advanceClock, applyDayWeather } from '../core/clock.js';
import { clamp, distance, lerp } from '../core/math.js';
import { collectTierUps } from '../core/progress.js';
import { currentSeason, isWary, presentCats } from '../core/state.js';
import { rollWish } from '../core/wishes.js';
import { BOND_TIERS, CAT_BY_ID } from '../data/cats.js';
import { FOODS } from '../data/items.js';
import { BUILDING_LAYOUT, LAKE, LANDMARKS } from '../data/village.js';
import { playSound, setPurring } from '../engine/audio.js';
import { display, drawText, ellipse, overlayRect, rect } from '../engine/canvas.js';
import { IS_TOUCH, escapeHtml, qs } from '../engine/dom.js';
import { anyHeld, input, keyPressed } from '../engine/input.js';
import {
  drawButterflies,
  drawGuideMarker,
  drawParticles,
  drawWeather,
  drawWishBubble,
  smokePoints,
  spawnBurst,
  spawnDust,
  updateParticles,
  updateSmoke,
  updateWeather,
} from '../render/effects.js';
import { darkness, lightingFor } from '../render/lighting.js';
import { drawCatModel, drawGoatModel, drawPlayerModel, dustyCoat } from '../render/models.js';
import { SEASON_PALETTES } from '../render/palettes.js';
import { catPicture } from '../render/portraits.js';
import { worldPoint } from '../render/space.js';
import { drawHeart, drawStrokingHand, itemIcon } from '../render/sprites.js';
import {
  chimneyTops,
  drawShadow,
  groundUnder,
  renderStage,
  screenScale,
  toScreen,
  villageCamera,
} from '../render/stage.js';
import { canCast, discoverSecret, feed, floatText, gather, milkGoat } from '../game/actions.js';
import { gameEvents } from '../game/bus.js';
import { guideTarget } from '../game/guidance.js';
import { saveGame } from '../game/persistence.js';
import { currentState, game } from '../game/runtime.js';
import { setScene } from '../game/scenes.js';
import { goToEvening, startDay } from '../game/session.js';
import {
  ensureCatEntities,
  findFocus,
  isBlocked,
  positionOf,
  updateButterflies,
  updateCats,
} from '../game/world.js';
import { openCatMenu } from '../ui/cat-menus.js';
import { showCelebration, toast } from '../ui/feedback.js';
import { refreshGoals } from '../ui/goals.js';
import { refreshHud } from '../ui/hud.js';
import { refreshTools, selectToolByNumber } from '../ui/tools.js';
import { openJournal } from '../ui/journal.js';
import { openLanternMenu } from '../ui/lantern.js';
import { isSheetOpen, openSheet } from '../ui/sheet.js';
import { FishingScene } from './fishing.js';
import { HuntScene } from './hunt.js';

/** @typedef {import('../game/runtime.js').Interactable} Interactable */

const WALK_SPEED = 100;
let lastMeowAt = 0;
let toldAboutSitting = false;

/** Uses whatever the player walked up to. @param {Interactable} target */
export function interact(target) {
  const state = currentState();
  if (target.kind === 'lantern') return openLanternMenu();
  if (target.kind === 'cat') {
    if (state.phase === 'dawn' && !state.relaxMode) {
      toast(
        `${state.cats[target.catId].name} is still curled up against the morning cold. Cat care starts when the day begins.`,
      );
      return;
    }
    if (game.tool === 'hand') return startStroking(target.catId);
    if (FOODS[game.tool]) return feedFromToolBar(target.catId, game.tool);
    return openCatMenu(target.catId);
  }
  const pickup = target.pickup;
  switch (pickup.kind) {
    case 'lake': {
      const ok = canCast();
      if (ok.ok) setScene(FishingScene);
      else toast(/** @type {string} */ (ok.reason));
      break;
    }
    case 'goat': {
      const result = milkGoat();
      if (!result.ok) toast(/** @type {string} */ (result.reason));
      break;
    }
    case 'rustle':
      pickup.taken = true;
      setScene(HuntScene);
      break;
    default:
      gather(pickup);
  }
  refreshHud();
}

/** Gives a cat the food selected in the tool bar, with a reaction right there in the village. */
function feedFromToolBar(catId, food) {
  const result = feed(catId, food);
  const e = game.cats[catId];
  if (!result.ok) {
    toast(result.reason);
    return;
  }
  const taste = currentState().cats[catId].tastes[food];
  if (e) {
    floatText(
      e.x,
      e.y,
      result.message.split(' ').slice(-1)[0],
      taste === 'hate' ? '#bfd0e8' : '#ffe9a2',
      20,
    );
    if (taste === 'love') e.emote = { kind: 'heart', at: game.time };
    if (taste === 'hate') e.emote = { kind: '!', at: game.time };
  }
  if (taste === 'love' || taste === 'hate') toast(result.message);
  refreshTools();
}

/** Starts stroking a cat; it continues for as long as the button or E is held. */
function startStroking(catId) {
  const state = currentState();
  const name = state.cats[catId].name;
  if (isWary(state, catId)) {
    toast(`${name} is too wary to touch yet. Try food, or sit quietly nearby.`);
    return;
  }
  if (state.cats[catId].strokeToday >= BALANCE.strokeDailyCap) {
    toast(`${name} has had enough cuddles for today.`);
    return;
  }
  game.strokingCatId = catId;
  if (!input.pointer.down && !input.held.e) toast('Hold the button (or E) to keep stroking.');
}

/** Stroking continues while held and close enough. @returns {boolean} whether a cat is being stroked */
function updateStroking(dt) {
  const catId = game.strokingCatId;
  if (!catId) return false;
  const state = currentState();
  const e = game.cats[catId];
  const held = input.pointer.down || !!input.held.e;
  if (!e || !held || distance(e.x, e.y, game.player.x, game.player.y) > 40) {
    game.strokingCatId = null;
    return false;
  }
  const result = strokeCat(state, catId, dt);
  if (!result.ok) {
    game.strokingCatId = null;
    return false;
  }
  if (Math.random() < dt * 3) spawnBurst(game.particles, e.x, e.y, '#f08aa8', 1, 'heart', 14);
  if (result.satisfied) {
    game.strokingCatId = null;
    e.emote = { kind: 'heart', at: game.time };
    toast(
      `${state.cats[catId].name} purrs and stretches. That was lovely. +${BALANCE.strokeDailyCap} Warmth today.`,
    );
    gameEvents.emit('cat:stroked', { catId });
  }
  return true;
}

/** Sits down or stands up. Sitting only works once the cats are awake. */
export function toggleSitting(on = !game.sitting) {
  const state = game.state;
  if (!state || game.scene?.name !== 'world' || on === game.sitting) return;
  if (on && !(state.phase === 'day' || state.relaxMode)) {
    toast('The cats are still curled up asleep. Sit with them once the day begins.');
    return;
  }
  game.sitting = on;
  game.player.walkTarget = null;
  game.player.goal = null;
  if (on) {
    game.player.direction = 'down';
    toast(
      toldAboutSitting
        ? 'You sit down quietly.'
        : 'You sit down and keep still. Wary cats nearby will slowly come closer. Move to stand up.',
    );
    toldAboutSitting = true;
  } else {
    setPurring(false);
  }
  refreshHud();
}

function onSecretFound(catId) {
  discoverSecret(catId);
  saveGame();
  const def = CAT_BY_ID[catId];
  openSheet(
    `<div class="result"><h2>A secret</h2><p>${escapeHtml(def.secret.text)}</p><p>A new hat for your collection.</p><button class="btn big" data-action="close">Continue</button></div>`,
    {
      className: 'small',
      closable: false,
    },
  );
}

/* ---------- Update ---------- */

function movePlayer(dt) {
  const p = game.player;
  let dx = 0;
  let dy = 0;
  if (anyHeld('ArrowLeft', 'a')) dx -= 1;
  if (anyHeld('ArrowRight', 'd')) dx += 1;
  if (anyHeld('ArrowUp', 'w')) dy -= 1;
  if (anyHeld('ArrowDown', 's')) dy += 1;
  if (game.sitting || game.strokingCatId) dx = dy = 0;

  if (dx || dy) {
    p.walkTarget = null;
    p.goal = null;
  } else if (p.walkTarget) {
    const d = distance(p.x, p.y, p.walkTarget.x, p.walkTarget.y);
    if (d < 3 || (p.goal && d < p.goalRadius)) {
      const goal = p.goal;
      p.walkTarget = null;
      p.goal = null;
      if (goal) interact(goal);
    } else {
      dx = (p.walkTarget.x - p.x) / d;
      dy = (p.walkTarget.y - p.y) / d;
    }
  }
  p.moving = !!(dx || dy);
  if (!p.moving) {
    p.walkTime = 0;
    p.stillFor += dt;
    return;
  }
  p.stillFor = 0;
  const length = Math.hypot(dx, dy);
  const nx = p.x + (dx / length) * WALK_SPEED * dt;
  const ny = p.y + (dy / length) * WALK_SPEED * dt;
  if (!isBlocked(nx, ny)) {
    p.x = nx;
    p.y = ny;
  } else if (!isBlocked(nx, p.y)) p.x = nx;
  else if (!isBlocked(p.x, ny)) p.y = ny;
  else {
    p.walkTarget = null;
    p.goal = null;
  }
  p.walkTime += dt;
  p.direction =
    Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  game.dustTimer = (game.dustTimer ?? 0) - dt;
  if (game.dustTimer < 0) {
    game.dustTimer = 0.22;
    spawnDust(game.particles, p.x, p.y, SEASON_PALETTES[currentSeason(currentState()).id].path[2]);
  }
}

/**
 * What is under a point on the screen: cats, items, the goat and the Lantern are hit-tested
 * where they appear in 3D; anything else falls through to the ground (and the lake).
 * @returns {Interactable | null}
 */
function pickAt(sx, sy) {
  const state = currentState();
  /** @type {Interactable | null} */
  let best = null;
  let bestScore = 1;
  const consider = (target, x, y, height, radius) => {
    const at = toScreen(x, y, height);
    if (!at.visible) return;
    const score = Math.hypot(at.x - sx, at.y - sy) / Math.max(6, radius * screenScale(x, y));
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  };
  for (const c of presentCats(state)) {
    const e = game.cats[c.id];
    if (e) consider({ kind: 'cat', catId: c.id }, e.x, e.y, 6, 9);
  }
  for (const pickup of game.pickups) {
    if (pickup.taken || pickup.kind === 'lake') continue;
    consider(
      { kind: 'pickup', pickup },
      pickup.x,
      pickup.y,
      pickup.kind === 'goat' ? 10 : 3,
      pickup.kind === 'goat' ? 14 : 9,
    );
  }
  consider({ kind: 'lantern' }, LANDMARKS.lanternTower.x, LANDMARKS.lanternTower.y, 80, 40);
  if (best) return best;
  const ground = groundUnder(sx, sy);
  if (ground && ((ground.x - LAKE.x) / LAKE.rx) ** 2 + ((ground.y - LAKE.y) / LAKE.ry) ** 2 < 1.1) {
    const lake = game.pickups.find((p) => p.kind === 'lake');
    if (lake) return { kind: 'pickup', pickup: lake };
  }
  return null;
}

function setStageCursor(cursor) {
  const stage = qs('#stage');
  if (stage.style.cursor !== cursor) stage.style.cursor = cursor;
}

/** Click or tap: walk there, and use whatever was clicked on arrival. */
function handlePointer() {
  if (!input.pointer.pressedThisFrame || game.sitting || game.strokingCatId) return;
  const p = game.player;
  const hit = pickAt(input.pointer.x, input.pointer.y);
  const ground = hit ? null : groundUnder(input.pointer.x, input.pointer.y);
  if (!hit && !ground) return;
  p.goal = hit;
  p.goalRadius =
    hit?.kind === 'lantern' ? 30 : hit?.kind === 'pickup' && hit.pickup.kind === 'lake' ? 36 : 22;
  const spot = hit ? positionOf(hit) : /** @type {{ x: number, y: number }} */ (ground);
  p.walkTarget = { x: spot.x, y: clamp(spot.y, GROUND_TOP + 1, GROUND_BOTTOM - 1) };
  moveMarker = { ...p.walkTarget, at: game.time };
  if (hit && distance(p.x, p.y, spot.x, spot.y) < p.goalRadius) {
    p.walkTarget = null;
    p.goal = null;
    interact(hit);
  }
}

/** Sitting quietly, greetings, wishes reappearing, and bond level-ups. */
function updateCompanionship(dt) {
  const state = currentState();
  if (game.sitting && (game.player.moving || input.pointer.pressedThisFrame)) toggleSitting(false);
  let someoneClose = false;
  for (const c of presentCats(state)) {
    const e = game.cats[c.id];
    const cat = state.cats[c.id];
    if (!e) continue;
    const toPlayer = distance(e.x, e.y, game.player.x, game.player.y);

    const wishAt = game.wishTimers[c.id];
    if (wishAt && game.time > wishAt && state.phase === 'day') {
      delete game.wishTimers[c.id];
      cat.wish = rollWish(state, c.id, game.rng);
      e.emote = { kind: '!', at: game.time };
    }

    if (game.sitting && toPlayer < 30) {
      someoneClose = true;
      const { completedCoax } = sitWith(state, c.id, dt);
      if (Math.random() < dt * 0.8) {
        e.emote = { kind: 'heart', at: game.time };
        spawnBurst(game.particles, e.x, e.y, '#f08aa8', 2, 'heart', 12);
      }
      if (completedCoax) {
        toast(`${cat.name} settles beside you and lets you be. +${BALANCE.coaxDailyCap} Warmth.`);
        gameEvents.emit('cat:coaxed', { catId: c.id });
      }
    } else if (
      !game.sitting &&
      state.phase === 'day' &&
      !isWary(state, c.id) &&
      cat.bond >= BOND_TIERS[1].min &&
      toPlayer < 34 &&
      e.greetAt < game.time
    ) {
      e.greetAt = game.time + 40;
      e.emote = { kind: 'heart', at: game.time };
      if (game.time > lastMeowAt) {
        playSound('meow');
        lastMeowAt = game.time + 5;
      }
    }
  }
  const stroking = updateStroking(dt);
  setPurring((game.sitting && someoneClose) || stroking);

  if (!isSheetOpen()) {
    const [levelUp] = collectTierUps(
      state,
      presentCats(state).map((c) => c.id),
    );
    if (levelUp) celebrate(levelUp.catId, levelUp.tier);
  }
}

/** A bond level-up: hearts, a chime and a card that does not interrupt play. */
function celebrate(catId, tier) {
  const state = currentState();
  const e = game.cats[catId];
  if (e) spawnBurst(game.particles, e.x, e.y, '#f08aa8', 16, 'heart', 14);
  playSound('chime');
  playSound('meow');
  const cat = state.cats[catId];
  showCelebration({
    title: `${cat.name} is now ${BOND_TIERS[tier].name}`,
    text: `New: ${BOND_TIERS[tier].unlocks}`,
    image: catPicture(CAT_BY_ID[catId], { hat: cat.hat, size: 96 }),
  });
}

/* ---------- Drawing ---------- */

/** @type {Map<string, import('../render/models.js').Coat>} */
const waryCoats = new Map();
/** Smoothed facing directions, so characters turn instead of snapping. */
const facings = new WeakMap();
/** Where the last click sent the player, for a little ring on the ground. */
let moveMarker = /** @type {{ x: number, y: number, at: number } | null} */ (null);
/** What the pointer is hovering over (desktop only). */
let hovered = /** @type {Interactable | null} */ (null);

/** Angle difference wrapped to [-pi, pi]. */
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Turns a character towards where it is moving. Idle cats slowly turn to face the camera.
 * Heading 0 faces +x (east); -PI/2 faces the camera.
 */
function facingOf(
  entity,
  { idleTowardsCamera = false, face = /** @type {number | null} */ (null) } = {},
) {
  let f = facings.get(entity);
  if (!f) {
    f = { x: entity.x, y: entity.y, heading: -Math.PI / 2 + (entity.flip ? -0.7 : 0.7) };
    facings.set(entity, f);
  }
  const dx = entity.x - f.x;
  const dy = entity.y - f.y;
  let goal = f.heading;
  if (face !== null) goal = face;
  else if (Math.hypot(dx, dy) > 0.05) goal = Math.atan2(-dy, dx);
  else if (idleTowardsCamera) goal = -Math.PI / 2 + (Math.cos(f.heading) >= 0 ? 0.75 : -0.75);
  f.heading += wrapAngle(goal - f.heading) * Math.min(1, game.dt * 8);
  f.x = entity.x;
  f.y = entity.y;
  return f.heading;
}

/** Angle from one game point to another, as a model heading. */
const headingTowards = (from, to) => Math.atan2(-(to.y - from.y), to.x - from.x);

function catCoat(state, catId) {
  const def = CAT_BY_ID[catId];
  if (!isWary(state, catId)) return def.coat;
  let coat = waryCoats.get(catId);
  if (!coat) {
    coat = dustyCoat(def.coat);
    waryCoats.set(catId, coat);
  }
  return coat;
}

/** Cats, the player and Clover, as 3D models. @param {import('../render/models.js').Painter} p */
function drawActors(p) {
  const state = currentState();
  const t = game.time;
  const goat = LANDMARKS.goat;
  drawShadow(goat.x, goat.y, 0.9);
  drawGoatModel(p, worldPoint(goat.x, goat.y), {
    heading: Math.PI + 0.5 + Math.sin(t * 0.2) * 0.4,
    time: t,
  });

  const player = game.player;
  const stroked = game.strokingCatId ? game.cats[game.strokingCatId] : null;
  drawShadow(player.x, player.y, 0.55);
  drawPlayerModel(p, worldPoint(player.x, player.y), {
    heading: facingOf(player, { face: stroked ? headingTowards(player, stroked) : null }),
    walkTime: player.walkTime,
    moving: player.moving,
    sitting: game.sitting,
    stroking: !!stroked,
    time: t,
  });

  for (const c of presentCats(state)) {
    const e = game.cats[c.id];
    if (!e) continue;
    let pose = e.pose;
    if (pose === 'sit' && (t + e.seed * 3) % 4.2 < 0.14) pose = 'blink';
    if (isWary(state, c.id) && pose === 'sleep') pose = 'loaf';
    const shiver = isWary(state, c.id) && Math.sin(t * 19 + e.seed) > 0.97 ? 0.4 : 0;
    drawShadow(e.x, e.y, 0.5);
    drawCatModel(p, catCoat(state, c.id), pose, worldPoint(e.x + shiver, e.y), {
      heading: facingOf(e, {
        idleTowardsCamera: true,
        face: stroked === e ? headingTowards(e, player) : null,
      }),
      time: t + e.seed,
      hat: isWary(state, c.id) ? null : state.cats[c.id].hat,
    });
  }

  // With the observatory built, the warmest cats bask on its balcony at dawn.
  if (state.phase === 'dawn' && state.built.observatory) {
    const balcony = BUILDING_LAYOUT.find((b) => b.id === 'observatory');
    if (balcony) {
      [...presentCats(state)]
        .sort((a, b) => state.cats[b.id].warmth - state.cats[a.id].warmth)
        .slice(0, 3)
        .forEach((c, i) => {
          const [X, , Z] = worldPoint(balcony.x + balcony.w / 2 + (i - 1) * 16, BUILDING_LINE + 9);
          drawCatModel(p, CAT_BY_ID[c.id].coat, 'loaf', [X, 2.82, Z], {
            heading: -Math.PI / 2,
            time: t + i,
            scale: 0.8,
          });
        });
    }
  }
}

/** Water from the fountain, as tiny 3D droplets. */
function fountainSpray(seasonId) {
  if (seasonId === 'winter') return [];
  const [X, , Z] = worldPoint(LANDMARKS.fountain.x, LANDMARKS.fountain.y);
  return Array.from({ length: 18 }, (_, i) => {
    const k = (game.time * 0.9 + i / 18) % 1;
    const a = i * 2.4;
    return {
      x: X + Math.cos(a) * k * 0.9,
      y: 2.0 + k * 0.8 - k * k * 2.2,
      z: Z + Math.sin(a) * k * 0.9,
      size: 0.09,
      color: [0.86, 0.95, 1, 0.8],
    };
  });
}

/** Items lying on the ground, drawn as little 2D icons at their spot in the 3D world. */
function drawPickups(ctx) {
  for (const pickup of game.pickups) {
    if (pickup.taken || pickup.fixed) continue;
    const at = toScreen(pickup.x, pickup.y, 3 + Math.sin(game.time * 2 + pickup.x) * 0.8);
    if (!at.visible || at.x < -10 || at.x > VIEW_WIDTH + 10) continue;
    if (pickup.kind === 'rustle') {
      const shake = Math.sin(game.time * 14);
      ellipse(ctx, at.x + shake, at.y + 2, 7, 3, '#c8703f');
      ellipse(ctx, at.x - 3 - shake, at.y, 4, 2, '#f0c04a');
    } else {
      const icon = itemIcon(pickup.kind);
      ctx.drawImage(icon, Math.round(at.x - icon.width / 2), Math.round(at.y - icon.height / 2));
      if (Math.floor(game.time * 2 + pickup.y) % 5 === 0) {
        rect(ctx, at.x + 5, at.y - 5, 1, 1, '#fff');
      }
    }
  }
}

/** Wish bubbles, emotes, sleeping z's, the guide marker and the click marker. */
function drawCatOverlays(ctx) {
  const state = currentState();
  for (const c of presentCats(state)) {
    const e = game.cats[c.id];
    if (!e) continue;
    if (e.emote && game.time - e.emote.at < 1.6) {
      const age = game.time - e.emote.at;
      const at = toScreen(e.x, e.y, 16 + age * 4);
      ctx.globalAlpha = clamp(1.6 - age);
      if (e.emote.kind === 'heart') drawHeart(ctx, at.x, at.y);
      else {
        rect(ctx, at.x, at.y - 2, 2, 5, '#c8423c');
        rect(ctx, at.x, at.y + 4, 2, 2, '#c8423c');
      }
      ctx.globalAlpha = 1;
    }
    if (e.pose === 'sleep' && !game.sitting) {
      const k = (game.time * 0.7 + e.seed) % 1;
      const at = toScreen(e.x, e.y, 8 + k * 8);
      drawText('z', at.x + 6 + k * 4, at.y, { size: 6, alpha: 1 - k });
    }
    const wish = state.cats[c.id].wish;
    if (wish && state.phase === 'day' && !game.paused && game.leadingCatId !== c.id) {
      const focused = game.focus?.kind === 'cat' && game.focus.catId === c.id;
      const at = toScreen(e.x, e.y, focused ? 24 : 15);
      if (at.visible && at.x > -6 && at.x < VIEW_WIDTH + 6) {
        drawWishBubble(ctx, at.x, at.y, wish, game.time);
      } else {
        drawWishBubble(
          ctx,
          at.x < VIEW_WIDTH / 2 ? 12 : VIEW_WIDTH - 12,
          clamp(at.y, 30, VIEW_HEIGHT - 30),
          wish,
          game.time,
          0.85,
        );
      }
    }
  }
  const target = game.paused || game.sitting ? null : guideTarget();
  if (target) {
    const at = toScreen(target.x, target.y, target.height * 0.6);
    const y = clamp(at.y, 24, VIEW_HEIGHT - 30);
    if (at.x < 4) drawGuideMarker(ctx, 8, y, -1, game.time);
    else if (at.x > VIEW_WIDTH - 4) drawGuideMarker(ctx, VIEW_WIDTH - 8, y, 1, game.time);
    else drawGuideMarker(ctx, at.x, at.y + Math.sin(game.time * 5) * 2.5, 0, game.time);
  }
  if (moveMarker && game.player.walkTarget) {
    const age = game.time - moveMarker.at;
    const at = toScreen(moveMarker.x, moveMarker.y, 0);
    const r = 3 + (age % 1) * 3;
    ctx.globalAlpha = 0.8 - (age % 1) * 0.6;
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(
      Math.round(at.x) + 0.5,
      Math.round(at.y) + 0.5,
      r * 1.6,
      r * 0.7,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** The name of what the mouse is over, and what clicking will do. */
function verbFor(target) {
  if (target.kind === 'cat') return 'Visit';
  if (target.kind === 'lantern') return 'Inspect';
  return { rustle: 'Hunt', lake: 'Fish', goat: 'Milk' }[target.pickup.kind] ?? 'Gather';
}

function labelFor(target) {
  const state = currentState();
  if (target.kind === 'cat') return state.cats[target.catId].name;
  if (target.kind === 'lantern') return 'The Great Lantern';
  const kind = target.pickup.kind;
  if (kind === 'lake') return `The lake (${BALANCE.castsPerDay - state.castsToday} casts left)`;
  if (kind === 'goat') return 'Clover the goat';
  if (kind === 'rustle') return 'Something rustles';
  return { herb: 'Wild herbs', stone: 'Warm stone', wood: 'Firewood' }[kind] ?? kind;
}

/** Height above the ground (game pixels) to hang a label over each kind of thing. */
function labelHeight(target) {
  if (target.kind === 'cat') return 18;
  if (target.kind === 'lantern') return 30;
  if (target.pickup.kind === 'goat') return 26;
  if (target.pickup.kind === 'lake') return 4;
  return 9;
}

/** Labels, the focused cat's warmth bar, and the "E: Visit" prompt, on the crisp overlay. */
function drawLabels() {
  const state = currentState();
  if (hovered && !game.paused && !sameTarget(hovered, game.focus)) {
    const at = positionOf(hovered);
    const p = toScreen(at.x, at.y, labelHeight(hovered));
    drawText(`${labelFor(hovered)}: ${verbFor(hovered).toLowerCase()}`, p.x, p.y, {
      size: 7,
      color: '#fdf8ef',
    });
  }
  const focus = game.focus;
  if (!focus || game.paused) return;
  const at = positionOf(focus);
  const top = toScreen(at.x, at.y, labelHeight(focus));
  if (focus.kind === 'cat') {
    const cat = state.cats[focus.catId];
    const x = top.x;
    const y = top.y;
    drawText(cat.name.split(' ').pop() ?? cat.name, x, y - 5, { size: 7 });
    overlayRect(x - 13, y, 26, 2.4, 'rgba(30,40,70,.6)');
    overlayRect(
      x - 13,
      y,
      (26 * cat.warmth) / 100,
      2.4,
      isWary(state, focus.catId) ? '#a9bce6' : '#f3a982',
    );
  } else {
    drawText(labelFor(focus), top.x, top.y - 4, { size: 7 });
  }
  const wishLift =
    focus.kind === 'cat' && state.cats[focus.catId].wish && state.phase === 'day' ? 12 : 0;
  const prompt = toScreen(at.x, at.y, labelHeight(focus) + wishLift);
  drawText(
    `${IS_TOUCH ? 'Tap' : 'E'}: ${verbFor(focus)}`,
    prompt.x,
    prompt.y - (focus.kind === 'cat' ? 12 : 13),
    {
      size: 7,
      color: '#ffe9a2',
    },
  );
}

const sameTarget = (a, b) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  (a.kind !== 'cat' || /** @type {any} */ (b).catId === a.catId) &&
  (a.kind !== 'pickup' || /** @type {any} */ (b).pickup === a.pickup);

function drawFloatingTexts() {
  for (const f of game.floatingTexts) {
    const at = toScreen(f.x, f.y, f.height + f.age * 14);
    drawText(f.text, at.x, at.y, { size: 7, color: f.color, alpha: clamp(2 - f.age) });
  }
}

/** @type {import('../game/scenes.js').Scene & { onKey: (key: string) => void }} */
export const WorldScene = {
  name: 'world',
  runsWhilePaused: true,

  enter() {
    ensureCatEntities();
  },

  onKey(key) {
    if (game.paused) return;
    if ((key === 'e' || key === ' ' || key === 'Enter') && game.focus) interact(game.focus);
    if (key === 'j') openJournal();
    if (key === 'q') toggleSitting();
    if (/^[1-7]$/.test(key)) selectToolByNumber(Number(key));
  },

  update(dt) {
    const state = currentState();
    const timed =
      (state.phase === 'dawn' || state.phase === 'day') && !state.relaxMode && !game.paused;
    if (timed) {
      applyDayWeather(state, dt);
      if (advanceClock(state, dt)) {
        if (state.phase === 'dawn') startDay();
        else goToEvening();
        return;
      }
    }
    game.smoke = updateSmoke(game.smoke, chimneyTops(), dt);
    game.particles = updateParticles(game.particles, dt);
    game.weather = updateWeather(game.weather, currentSeason(state).id, dt, game.time);
    updateButterflies(dt);
    for (const f of game.floatingTexts) f.age += dt;
    game.floatingTexts = game.floatingTexts.filter((f) => f.age < 1.8);
    updateCompanionship(dt);
    if (game.paused) {
      hovered = null;
      return;
    }

    movePlayer(dt);
    const follow = Math.min(1, dt * 3.5);
    game.camera.x = lerp(game.camera.x, game.player.x, follow);
    game.camera.y = lerp(game.camera.y, game.player.y, follow);
    updateCats(dt, { onSecretFound });
    game.focus = findFocus();
    hovered = !IS_TOUCH && input.pointer.inside ? pickAt(input.pointer.x, input.pointer.y) : null;
    setStageCursor(hovered ? 'pointer' : '');
    handlePointer();
    if (keyPressed('Escape')) {
      toggleSitting(false);
      game.strokingCatId = null;
    }
  },

  draw() {
    const state = currentState();
    const seasonId = currentSeason(state).id;
    const timeOfDay = lightingFor(state);
    const dark = darkness(timeOfDay);
    renderStage({
      state,
      seasonId,
      timeOfDay,
      time: game.time,
      camera: villageCamera(game.camera.x, game.camera.y),
      windowGlow: clamp(dark * 1.4),
      fireGlow: dark,
      lanternGlow: state.lanternLit ? 1 : 0,
      points: [...smokePoints(game.smoke, dark), ...fountainSpray(seasonId)],
      actors: drawActors,
    });
    const ctx = display.pixel;
    const project = toScreen;
    drawPickups(ctx);
    drawButterflies(ctx, game.butterflies, project, game.time);
    drawParticles(ctx, game.particles, project);
    const stroked = game.strokingCatId ? game.cats[game.strokingCatId] : null;
    if (stroked) {
      const at = toScreen(stroked.x, stroked.y, 11);
      drawStrokingHand(ctx, at.x + Math.sin(game.time * 5) * 4, at.y);
    }
    drawCatOverlays(ctx);
    drawWeather(ctx, game.weather, seasonId, game.time);
    drawLabels();
    drawFloatingTexts();
    refreshGoals();
    refreshTools();
  },
};
