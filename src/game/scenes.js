/**
 * Scene switching. A scene is an object with optional `enter()`, `update(dt)` and `draw()`.
 * Scenes marked `fullscreen` hide the HUD (the minigames).
 */
import { setPurring } from '../engine/audio.js';
import { refreshGoals } from '../ui/goals.js';
import { refreshHud } from '../ui/hud.js';
import { refreshTools } from '../ui/tools.js';
import { game } from './runtime.js';

/**
 * @typedef {{ name: string, fullscreen?: boolean, runsWhilePaused?: boolean,
 *   enter?: () => void, update?: (dt: number) => void, draw?: () => void }} Scene
 */

/** @param {Scene} scene */
export function setScene(scene) {
  if (game.scene?.name === 'world' && scene.name !== 'world') {
    game.sitting = false;
    setPurring(false);
  }
  game.scene = scene;
  document.body.classList.toggle('minigame', !!scene.fullscreen);
  scene.enter?.();
  refreshHud();
  refreshGoals();
  refreshTools();
}
