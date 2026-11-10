/**
 * Runtime state: everything about the current session that is NOT saved
 * (positions, camera, particles, timers, what the player is looking at).
 * The saved game itself is `game.state` (see core/state.js).
 */

/**
 * @typedef {import('../core/state.js').GameState} GameState
 * @typedef {{ x: number, y: number, kind: string, fixed?: boolean, taken?: boolean }} Pickup
 * @typedef {{ x: number, y: number, targetX: number | null, targetY: number | null,
 *   pose: string, idleTimer: number, flip: boolean, seed: number, following: boolean,
 *   startleCooldown: number, greetAt: number, emote: { kind: string, at: number } | null,
 *   rubs: number, rubSide: number, chasing: Butterfly | null }} CatEntity
 * @typedef {{ x: number, y: number, height: number, targetX: number, targetY: number,
 *   color: string, fleeing: boolean }} Butterfly
 * @typedef {{ kind: 'pickup', pickup: Pickup } | { kind: 'cat', catId: string } | { kind: 'lantern' }} Interactable
 */

export const game = {
  /** @type {GameState | null} */ state: null,
  /** @type {GameState | null} The save offered by "Continue" on the title screen. */ savedGame:
    null,
  /** @type {any} */ scene: null,
  /** Seconds since the page loaded (drives animation). */
  time: 0,
  dt: 0,
  /** True while a menu is open: the world stops. */
  paused: false,
  /** The point the camera follows (game coordinates). */
  camera: { x: 800, y: 240 },
  player: {
    x: 800,
    y: 240,
    direction: 'down',
    walkTime: 0,
    moving: false,
    /** Seconds the player has been standing still (friendly cats come to rub against you). */
    stillFor: 0,
    /** @type {{ x: number, y: number } | null} Where a click told the player to walk. */
    walkTarget: null,
    /** @type {Interactable | null} What to use on arrival. */
    goal: null,
    goalRadius: 22,
  },
  /** @type {Record<string, CatEntity>} */ cats: {},
  /** @type {Pickup[]} */ pickups: [],
  /** @type {import('../render/effects.js').Particle[]} */ particles: [],
  /** @type {import('../render/effects.js').Puff[]} */ smoke: [],
  /** @type {import('../render/effects.js').Flake[]} */ weather: [],
  /** @type {{ x: number, y: number, height: number, text: string, color: string, age: number }[]} */ floatingTexts:
    [],
  /** @type {Interactable | null} The nearest thing the player can use. */ focus: null,
  /** @type {string | null} The cat whose menu or minigame is open. */ selectedCatId: null,
  /** @type {string | null} A soulmate cat leading the player to its secret. */ leadingCatId: null,
  /** Is the player sitting quietly? */
  sitting: false,
  /**
   * The selected tool in the tool bar: 'look' opens a cat's card, 'hand' strokes it, and a
   * food id feeds that food directly.
   */
  tool: 'look',
  /** @type {string | null} The cat being stroked right now. */
  strokingCatId: null,
  /** @type {Butterfly[]} */ butterflies: [],
  /** Game time at which a cat will show a new wish. */
  /** @type {Record<string, number>} */ wishTimers: {},
  /** Source of randomness for game rules. Tests may replace it with a seeded generator. */
  rng: Math.random,
};

/** The current game state. Throws if no game is running, which would be a programming error. */
export function currentState() {
  if (!game.state) throw new Error('No game in progress');
  return game.state;
}
