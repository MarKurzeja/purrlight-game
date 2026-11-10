/** The heads-up display: season and day, phase, sun bar, Purrs, and the bottom hint bar. */
import { IS_TOUCH, qs } from '../engine/dom.js';
import { clamp } from '../core/math.js';
import { currentSeason, isWary, presentCats, seasonLength } from '../core/state.js';
import { game } from '../game/runtime.js';

const PHASE_LABELS = {
  dawn: 'Dawn: forage',
  day: 'Day: cat care',
  evening: 'Evening',
  night: 'Night: build',
};

export function setHudVisible(visible) {
  qs('#hud').hidden = !visible;
  qs('#bar').hidden = !visible;
}

/** Sets the hint text and hides the bar's buttons (used by minigames). */
export function setHint(text) {
  qs('#hint').textContent = text;
  qs('#next').hidden = true;
  qs('#sit').hidden = true;
}

/** @param {string | null} label null hides the button. */
export function setNextButton(label) {
  const next = qs('#next');
  next.hidden = !label;
  if (label) next.textContent = label;
}

/** Updates everything from the current state. Called twice a second and after actions. */
export function refreshHud() {
  const state = game.state;
  if (!state) return;
  qs('#when').textContent =
    `${currentSeason(state).name}, day ${state.seasonDay} of ${seasonLength(state)}`;
  qs('#phase').textContent = state.relaxMode ? 'Relaxing' : PHASE_LABELS[state.phase];
  qs('#purrs').textContent = String(state.purrs);
  qs('#sun').style.width = `${(state.relaxMode ? 1 : clamp(state.clock)) * 100}%`;

  const inWorld = game.scene?.name === 'world';
  const sit = qs('#sit');
  sit.hidden = !(inWorld && (state.phase === 'day' || state.relaxMode));
  sit.textContent = game.sitting ? 'Stand up' : IS_TOUCH ? 'Sit quietly' : 'Sit quietly (Q)';
  if (!inWorld) return;

  if (state.phase === 'dawn') {
    qs('#hint').textContent = IS_TOUCH
      ? 'Tap to walk. Tap herbs, stones, the lake or the goat to gather.'
      : 'WASD or click to walk. E to gather. H for help. Follow the red marker.';
    setNextButton('Start the day');
  } else if (state.phase === 'day') {
    const wary = presentCats(state).filter((c) => isWary(state, c.id)).length;
    let hint = wary
      ? `${wary} ${wary > 1 ? 'cats are' : 'cat is'} still wary. Wary cats won't let you touch them, but they will eat.`
      : 'Bubbles show what each cat wants. Visit a cat, or sit quietly and let them come to you.';
    if (state.clock > 0.85 && !state.relaxMode) {
      hint = 'The sun is getting low. The cats will gather at the fire soon.';
    }
    qs('#hint').textContent = hint;
    setNextButton('Go to the evening fire');
  } else {
    setNextButton(null);
  }
}
