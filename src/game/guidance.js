/** The red guide marker: where in the world the current daily note wants the player to go. */
import { distance } from '../core/math.js';
import { currentNote } from '../core/notes.js';
import { isWary, presentCats } from '../core/state.js';
import { LANDMARKS } from '../data/village.js';
import { currentState, game } from './runtime.js';

/**
 * @returns {{ x: number, y: number, height: number } | null}
 *   `height` is how far above the point to draw the marker.
 */
export function guideTarget() {
  const state = currentState();
  const note = currentNote(state);
  if (!note) return null;
  const p = game.player;
  const nearest = (points) =>
    points
      .filter(Boolean)
      .sort((a, b) => distance(a.x, a.y, p.x, p.y) - distance(b.x, b.y, p.x, p.y))[0] ?? null;
  const catWhere = (test) =>
    nearest(
      presentCats(state)
        .filter((c) => test(c.id))
        .map((c) => game.cats[c.id]),
    );

  let point = null;
  let height = 34;
  if (note.target === 'lake') {
    point = LANDMARKS.lake;
    height = 36;
  } else if (note.target === 'goat') {
    point = LANDMARKS.goat;
  } else if (note.target === 'item') {
    point = nearest(game.pickups.filter((x) => !x.taken && !x.fixed && x.kind !== 'rustle'));
    height = 20;
  } else if (note.target.startsWith('cat:')) {
    point = game.cats[note.target.slice(4)];
  } else if (note.target === 'wary') {
    point = catWhere((id) => isWary(state, id));
  } else if (note.target === 'wish') {
    point = catWhere((id) => !!state.cats[id].wish);
  } else if (note.target === 'friendly') {
    point = catWhere((id) => !isWary(state, id));
  } else {
    point = catWhere(() => true);
  }
  return point ? { x: point.x, y: point.y, height } : null;
}
