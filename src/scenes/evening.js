/** The evening gathering: cats sit around the fire and give Purrs, one by one. */
import { eveningGathering } from '../core/day-cycle.js';
import { clamp } from '../core/math.js';
import { currentSeason, isWary } from '../core/state.js';
import { CAT_BY_ID } from '../data/cats.js';
import { LANDMARKS } from '../data/village.js';
import { playSound } from '../engine/audio.js';
import { drawText } from '../engine/canvas.js';
import { input } from '../engine/input.js';
import { smokePoints, updateSmoke } from '../render/effects.js';
import { drawCatModel, dustyCoat } from '../render/models.js';
import { GRADE } from '../render/palettes.js';
import { worldPoint } from '../render/space.js';
import { chimneyTops, drawShadow, renderStage, toScreen, villageCamera } from '../render/stage.js';
import { currentState, game } from '../game/runtime.js';
import { refreshHud, setHint, setNextButton } from '../ui/hud.js';

const evening = {
  /** @type {{ catId: string, purrs: number, memory: boolean, x: number, y: number }[]} */
  rows: [],
  total: 0,
  elapsed: 0,
  revealed: -1,
  nextReveal: 0.9,
  done: false,
};

export const EveningScene = {
  name: 'evening',

  enter() {
    const state = currentState();
    const { rows, total } = eveningGathering(state, game.rng);
    const count = rows.length;
    evening.rows = rows.map((row, i) => {
      // Seat the cats in a ring around the fire, two rows deep if there are many.
      const angle = Math.PI * (0.55 - 1.1 * (count > 1 ? i / (count - 1) : 0.5)) - Math.PI / 2;
      const ring = i % 2;
      return {
        ...row,
        x: LANDMARKS.fire.x + Math.cos(angle) * (20 + ring * 9),
        y: LANDMARKS.fire.y + Math.sin(angle) * (16 + ring * 7),
      };
    });
    Object.assign(evening, { total, elapsed: 0, revealed: -1, nextReveal: 0.9, done: false });
    setHint('The cats gather at the fire.');
    refreshHud();
  },

  update(dt) {
    evening.elapsed += dt;
    evening.nextReveal -= dt;
    if (input.pointer.pressedThisFrame && !evening.done) evening.nextReveal = 0;
    if (evening.nextReveal < 0 && evening.revealed < evening.rows.length - 1) {
      evening.revealed += 1;
      evening.nextReveal = 0.8;
      playSound(evening.rows[evening.revealed].memory ? 'chime' : 'hit', evening.revealed);
    }
    if (!evening.done && evening.revealed >= evening.rows.length - 1 && evening.nextReveal < 0) {
      evening.done = true;
      const state = currentState();
      const gotMemory = evening.rows.some((r) => r.memory);
      setHint(
        gotMemory
          ? state.built.library
            ? 'A cat left you a memory. Read it in the Library.'
            : 'A cat left you a sealed memory. The Library can open it.'
          : 'The fire burns low.',
      );
      setNextButton('Into the night');
    }
    game.smoke = updateSmoke(game.smoke, chimneyTops(), dt);
  },

  draw() {
    const state = currentState();
    const fire = LANDMARKS.fire;
    const deepening = clamp(evening.elapsed / 10);
    renderStage({
      state,
      seasonId: currentSeason(state).id,
      timeOfDay: { from: GRADE.dusk, to: GRADE.night, blend: 0.15 + deepening * 0.7 },
      time: game.time,
      camera: villageCamera(fire.x + Math.sin(evening.elapsed * 0.08) * 12, fire.y + 10, 0.8),
      windowGlow: 0.7 + deepening * 0.3,
      fireGlow: 1,
      lanternGlow: state.lanternLit ? 1 : 0,
      points: smokePoints(game.smoke, 0.8),
      actors: (painter) =>
        evening.rows.forEach((row, i) => {
          const wary = isWary(state, row.catId);
          const coat = CAT_BY_ID[row.catId].coat;
          drawShadow(row.x, row.y, 0.5);
          drawCatModel(
            painter,
            wary ? dustyCoat(coat) : coat,
            wary ? 'loaf' : i % 3 === 1 ? 'loaf' : 'sit',
            worldPoint(row.x, row.y),
            {
              heading: Math.atan2(-(fire.y - row.y), fire.x - row.x),
              time: game.time + i,
              hat: wary ? null : state.cats[row.catId].hat,
            },
          );
        }),
    });
    evening.rows.slice(0, evening.revealed + 1).forEach((row, i) => {
      const at = toScreen(row.x, row.y, 16 + (i % 2) * 5);
      drawText(`+${row.purrs}`, at.x, at.y, { size: 9, color: '#ffe9a2' });
      if (row.memory) drawText('memory', at.x, at.y - 10, { size: 7, color: '#bfe0f4' });
    });
    drawText('Evening at the fire', 240, 24, { size: 13 });
    drawText(
      evening.rows.length
        ? `${evening.total} Purrs`
        : 'No cat trusts you enough to sit close yet. Keep filling their bowls.',
      240,
      40,
      { size: 8 },
    );
  },
};
