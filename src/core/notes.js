/**
 * Daily notes: three small goals each day (a guided tutorial on day one), paid in Purrs.
 * Notes advance when the game publishes matching events, such as "fish" or "pet".
 */
import { BALANCE } from '../config.js';
import { CAT_BY_ID } from '../data/cats.js';
import { shuffled } from './random.js';
import { isWary, presentCats, purrMultiplier } from './state.js';

/**
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./state.js').DailyNote} DailyNote
 * @typedef {import('./random.js').Rng} Rng
 */

/** Events that can only happen once the day has started (cats sleep at dawn). */
export const DAYTIME_EVENTS = Object.freeze([
  'feed',
  'coax',
  'pet',
  'play',
  'wish',
  'photo',
  'favourite',
]);

/**
 * Templates for random daily notes. `amount` is the inclusive range of how many are needed.
 * @type {ReadonlyArray<{event: string, amount: [number, number], label: (n: number) => string,
 *   target: string, available?: (state: GameState) => boolean}>}
 */
const NOTE_TEMPLATES = [
  {
    event: 'fish',
    amount: [1, 2],
    target: 'lake',
    label: (n) => (n > 1 ? `Catch ${n} fish at the lake` : 'Catch a fish at the lake'),
  },
  { event: 'gather', amount: [3, 5], target: 'item', label: (n) => `Gather ${n} things at dawn` },
  { event: 'wish', amount: [2, 3], target: 'wish', label: (n) => `Grant ${n} cat wishes` },
  {
    event: 'pet',
    amount: [1, 2],
    target: 'friendly',
    label: (n) => (n > 1 ? `Win ${n} petting sessions` : 'Win a petting session'),
  },
  {
    event: 'play',
    amount: [1, 2],
    target: 'friendly',
    label: (n) => (n > 1 ? `Play ${n} games with your cats` : 'Play a game with a cat'),
  },
  { event: 'milk', amount: [1, 1], target: 'goat', label: () => 'Milk Clover the goat' },
  {
    event: 'coax',
    amount: [1, 1],
    target: 'wary',
    label: () => 'Win over a wary cat by sitting quietly',
    available: (state) => presentCats(state).some((cat) => isWary(state, cat.id)),
  },
  {
    event: 'favourite',
    amount: [1, 1],
    target: 'cat',
    label: () => 'Discover a cat’s favourite food',
    available: (state) =>
      presentCats(state).some((cat) =>
        CAT_BY_ID[cat.id].loves.some((food) => state.cats[cat.id].tastes[food] !== 'love'),
      ),
  },
  {
    event: 'photo',
    amount: [1, 2],
    target: 'cat',
    label: (n) => (n > 1 ? `Take ${n} new photos for the album` : 'Take a new photo for the album'),
  },
];

/** The guided first day. Order matters: the marker follows the first unfinished note. */
const FIRST_DAY_NOTES = [
  { event: 'cast', need: 1, label: 'Walk left to the lake and cast a line', target: 'lake' },
  {
    event: 'gather',
    need: 2,
    label: 'Pick up 2 things lying around: herbs or stones',
    target: 'item',
  },
  { event: 'feed', need: 1, label: 'Start the day, then feed Biscuit', target: 'cat:biscuit' },
  {
    event: 'coax',
    need: 1,
    label: 'Sit quietly near a wary cat (Q) until it trusts you',
    target: 'wary',
  },
  { event: 'pet', need: 1, label: 'Pet Biscuit: find his sweet spot', target: 'cat:biscuit' },
];

/**
 * Writes today's notes into the state.
 * @param {GameState} state
 * @param {Rng} rng
 */
export function createDailyNotes(state, rng) {
  const multiplier = purrMultiplier(state);
  /** @type {DailyNote[]} */
  let notes;
  if (state.day === 1) {
    notes = FIRST_DAY_NOTES.map((n) => ({ ...n, have: 0, reward: Math.round(6 * multiplier) }));
  } else {
    const candidates = NOTE_TEMPLATES.filter((t) => !t.available || t.available(state));
    notes = shuffled(rng, candidates)
      .slice(0, 3)
      .map((t) => {
        const [min, max] = t.amount;
        const need = min + Math.floor(rng() * (max - min + 1));
        return {
          event: t.event,
          need,
          have: 0,
          label: t.label(need),
          target: t.target,
          reward: Math.round((6 + need * 3) * multiplier),
        };
      });
  }
  state.tasks = { day: state.day, notes, bonusPaid: false };
}

/**
 * Counts an event towards today's notes and pays out any that are completed.
 * @param {GameState} state
 * @param {string} event
 * @returns {{ completed: DailyNote[], bonus: number }}
 */
export function recordEvent(state, event, amount = 1) {
  const result = { completed: /** @type {DailyNote[]} */ ([]), bonus: 0 };
  if (!state.tasks || state.relaxMode) return result;
  for (const note of state.tasks.notes) {
    if (note.event !== event || note.have >= note.need) continue;
    note.have = Math.min(note.need, note.have + amount);
    if (note.have >= note.need) {
      state.purrs += note.reward;
      result.completed.push(note);
    }
  }
  if (!state.tasks.bonusPaid && state.tasks.notes.every((n) => n.have >= n.need)) {
    state.tasks.bonusPaid = true;
    result.bonus = Math.round(BALANCE.allNotesBonus * purrMultiplier(state));
    state.purrs += result.bonus;
  }
  return result;
}

/**
 * The note the on-screen marker should point to. At dawn, notes that need the day to have
 * started are skipped when something else can be done.
 * @param {GameState} state
 * @returns {DailyNote | null}
 */
export function currentNote(state) {
  const open = state.tasks ? state.tasks.notes.filter((n) => n.have < n.need) : [];
  if (state.phase === 'dawn') {
    const doable = open.find((n) => !DAYTIME_EVENTS.includes(n.event));
    if (doable) return doable;
  }
  return open[0] ?? null;
}
