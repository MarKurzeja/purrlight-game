/**
 * Petting close-up. Hold and rub the cat; its tail and eyes hint at how close you are.
 * The rules live in core/petting.js; this scene reads input and draws the cat's reactions.
 */
import { tierOf } from '../core/bond.js';
import { clamp, lerp } from '../core/math.js';
import { createPettingSession, isPurring, stepPetting } from '../core/petting.js';
import { currentSeason } from '../core/state.js';
import { CAT_BY_ID, PERSONALITIES, PET_ZONES } from '../data/cats.js';
import { setPurring } from '../engine/audio.js';
import { display, drawText, ellipse, mixColor, rect } from '../engine/canvas.js';
import { anyHeld, input } from '../engine/input.js';
import { drawCatPortrait, drawHeart } from '../render/sprites.js';
import { finishPetting } from '../game/actions.js';
import { currentState, game } from '../game/runtime.js';
import { openCatMenu } from '../ui/cat-menus.js';
import { setHint } from '../ui/hud.js';
import { pettingResultHtml } from '../ui/results.js';
import { drawCozyRoom, drawMeter, drawTimer, finishMinigame } from './kit.js';

const petting = {
  /** @type {import('../core/petting.js').PettingSession} */
  session: /** @type {any} */ (null),
  catId: '',
  finished: false,
  /** Smoothed body language, for drawing. */
  mood: { squint: 0, earsFlat: 0, tailSpeed: 6, tailSwing: 0.2, tilt: 0 },
  /** Where the hand is, and a separate position driven by the arrow keys. */
  hand: { x: 240, y: 140 },
  keyboardHand: { x: 240, y: 140 },
  /** @type {{ x: number, y: number, age: number }[]} */
  hearts: [],
};

/** A ring around the hand that glows warmer (pink) the closer it is to the sweet spot. */
function drawSearchRing(ctx, x, y) {
  const s = petting.session;
  if (!s.active) return;
  const color = s.inSpot && s.goodSpeed ? '#f08aa8' : mixColor('#9db4c8', '#f3a982', s.closeness);
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(game.time * 8);
  for (let a = 0; a < 24; a++) {
    const angle = (a / 24) * Math.PI * 2;
    rect(ctx, x + Math.cos(angle) * 11, y + Math.sin(angle) * 9, 2, 2, color);
  }
  ctx.globalAlpha = 1;
}

/**
 * How fast you are stroking compared with what this cat likes. Speeds are shown on a log scale,
 * because cats' preferences range from very slow (4 px/s) to brisk (700 px/s).
 */
function drawSpeedGauge(ctx) {
  const s = petting.session;
  const [slowest, fastest] = PERSONALITIES[CAT_BY_ID[petting.catId].personality].strokeSpeed;
  const scale = (speed) => clamp(Math.log(speed + 1) / Math.log(800));
  const x = 165;
  const y = 236;
  const width = 150;
  rect(ctx, x - 1, y - 1, width + 2, 7, '#33415e');
  rect(ctx, x, y, width, 5, '#eef3f8');
  // Once you know the cat a little, its preferred speed is shown as a green band.
  if (petting.session.fill > 0.15 || currentState().cats[petting.catId].knowsSweetSpot) {
    rect(
      ctx,
      x + scale(slowest) * width,
      y,
      (scale(fastest) - scale(slowest)) * width,
      5,
      '#a4dcc4',
    );
  }
  if (s.active) {
    rect(ctx, x + scale(s.speed) * width - 1, y - 2, 2, 9, s.goodSpeed ? '#3f8a70' : '#c8423c');
  }
  drawText('slow', x - 4, y + 3, { size: 6, align: 'right' });
  drawText('fast', x + width + 4, y + 3, { size: 6, align: 'left' });
}

/** A gentle "warmer / colder" hint while searching for the sweet spot. */
function warmerColder() {
  const s = petting.session;
  if (!s.active || s.onBelly) return '';
  if (s.inSpot && s.goodSpeed) return 'Right there!';
  if (s.closeness > 0.6) return 'Warmer...';
  if (s.closeness < 0.25) return 'Colder';
  return '';
}

export const PettingScene = {
  name: 'petting',
  fullscreen: true,

  enter() {
    petting.catId = /** @type {string} */ (game.selectedCatId);
    const def = CAT_BY_ID[petting.catId];
    petting.session = createPettingSession({
      personality: def.personality,
      sweetSpot: def.sweetSpot,
      skittish: currentSeason(currentState()).id === 'spring',
    });
    petting.finished = false;
    petting.hearts = [];
    Object.assign(petting.mood, { squint: 0, earsFlat: 0, tailSpeed: 6, tailSwing: 0.2, tilt: 0 });
    setHint(
      'Hold and rub the cat. Watch the tail and eyes: slow sway and sleepy eyes mean you are close.',
    );
  },

  update(dt) {
    if (petting.finished) return;
    let touching = input.pointer.down;
    petting.hand = { x: input.pointer.x, y: input.pointer.y };
    // Arrow keys move a virtual hand that is always touching.
    const kx = (anyHeld('ArrowRight') ? 1 : 0) - (anyHeld('ArrowLeft') ? 1 : 0);
    const ky = (anyHeld('ArrowDown') ? 1 : 0) - (anyHeld('ArrowUp') ? 1 : 0);
    if (kx || ky) {
      petting.keyboardHand.x += kx * 140 * dt;
      petting.keyboardHand.y += ky * 140 * dt;
      petting.hand = { ...petting.keyboardHand };
      touching = true;
    }
    const outcome = stepPetting(petting.session, { ...petting.hand, touching }, dt, game.rng);
    const purring = isPurring(petting.session);
    setPurring(purring);
    if (purring && Math.random() < dt * 6) {
      petting.hearts.push({
        x: petting.hand.x + (Math.random() - 0.5) * 16,
        y: petting.hand.y - 6,
        age: 0,
      });
    }

    const near = petting.session.active ? petting.session.closeness : 0;
    petting.mood.squint = lerp(petting.mood.squint, purring ? 1 : near * 0.62, 0.06);
    petting.mood.earsFlat = lerp(
      petting.mood.earsFlat,
      clamp(
        petting.session.fear * 1.2 + (petting.session.onBelly && petting.session.active ? 0.5 : 0),
      ),
      0.1,
    );
    petting.mood.tailSpeed = lerp(
      petting.mood.tailSpeed,
      petting.session.active ? lerp(16, 2.4, near) : 4,
      0.05,
    );
    petting.mood.tailSwing = lerp(
      petting.mood.tailSwing,
      petting.session.active ? lerp(0.9, 0.2, near) : 0.25,
      0.05,
    );
    petting.mood.tilt = lerp(petting.mood.tilt, petting.session.active && near > 0.7 ? 5 : 0, 0.05);
    for (const h of petting.hearts) h.age += dt;
    petting.hearts = petting.hearts.filter((h) => h.age < 1);

    if (outcome) {
      petting.finished = true;
      const result = finishPetting(petting.catId, outcome, petting.session.fill);
      finishMinigame(
        pettingResultHtml(petting.catId, result),
        result.success ? () => openCatMenu(petting.catId) : undefined,
      );
    }
  },

  draw() {
    const ctx = display.pixel;
    const state = currentState();
    const def = CAT_BY_ID[petting.catId];
    drawCozyRoom(currentSeason(state).id);
    drawCatPortrait(ctx, def, {
      time: game.time,
      squint: petting.mood.squint,
      earsFlat: petting.mood.earsFlat,
      tailSwing: petting.mood.tailSwing,
      tailSpeed: petting.mood.tailSpeed,
      tilt: petting.mood.tilt,
      hat: state.cats[petting.catId].hat,
      look: Math.round(clamp((petting.hand.x - 176) / 60, -2, 2)),
    });
    for (const h of petting.hearts) {
      drawHeart(ctx, h.x + Math.sin(h.age * 8) * 3, h.y - h.age * 34, '#e87c94');
    }

    // Friendly cats, or ones whose spot you have learned, show a faint glow on the sweet spot.
    const known =
      tierOf(state.cats[petting.catId].bond) >= 2 || state.cats[petting.catId].knowsSweetSpot;
    if (known && !PERSONALITIES[def.personality].sweetSpotMovesEvery) {
      const zone = PET_ZONES[def.sweetSpot];
      ctx.globalAlpha = 0.25 + Math.sin(game.time * 3) * 0.1;
      ellipse(ctx, zone.x, zone.y, 6, 6, '#fff');
      ctx.globalAlpha = 1;
    }

    const { x, y } = petting.hand;
    rect(ctx, x - 5, y - 5, 10, 9, '#f6d3b6');
    rect(ctx, x - 5, y - 9, 2, 5, '#f6d3b6');
    rect(ctx, x - 2, y - 10, 2, 6, '#f6d3b6');
    rect(ctx, x + 1, y - 10, 2, 6, '#f6d3b6');
    rect(ctx, x + 4, y - 8, 2, 4, '#f6d3b6');
    rect(ctx, x - 6, y + 3, 12, 3, '#f3a982');

    drawSearchRing(ctx, x, y);
    drawSpeedGauge(ctx);
    drawMeter(14, 14, 150, 'Purring', petting.session.fill, '#f3a982');
    drawMeter(316, 14, 150, 'Spooked', petting.session.fear, '#8c86c0');
    drawTimer(petting.session.timeLeft);
    const hint = petting.session.hint || warmerColder();
    if (hint) drawText(hint, 240, 254, { size: 9 });
  },
};
