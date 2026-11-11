/** Keyboard and pointer state, polled by the scenes each frame. */
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config.js";

export const input = {
  /** Keys currently held, by lower-case key name ("a", "ArrowLeft", " "). */
  held: /** @type {Record<string, boolean>} */ ({}),
  /** Keys pressed since the last frame. */
  pressed: /** @type {Set<string>} */ (new Set()),
  /** Pointer position in game coordinates. */
  pointer: { x: 0, y: 0, down: false, pressedThisFrame: false, inside: false },
};

const MOVEMENT_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];

const normalise = (key) => (key.length === 1 ? key.toLowerCase() : key);

/** Was this key pressed this frame? */
export const keyPressed = (key) => input.pressed.has(key);

/** Is any of these keys held? */
export const anyHeld = (...keys) => keys.some((k) => input.held[k]);

/**
 * Wires up listeners.
 * @param {HTMLElement} stage The element that receives pointer input.
 * @param {HTMLCanvasElement} surface The canvas whose size maps to game coordinates.
 * @param {{ onGesture: () => void, onKey: (key: string) => void }} hooks
 *   `onGesture` runs on every user gesture (audio can only start after one).
 */
export function bindInput(stage, surface, hooks) {
  const toGame = (event) => {
    const box = surface.getBoundingClientRect();
    input.pointer.x = ((event.clientX - box.left) / box.width) * VIEW_WIDTH;
    input.pointer.y = ((event.clientY - box.top) / box.height) * VIEW_HEIGHT;
  };
  stage.addEventListener("pointerdown", (event) => {
    hooks.onGesture();
    toGame(event);
    input.pointer.down = true;
    input.pointer.pressedThisFrame = true;
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* capture is optional */
    }
    event.preventDefault();
  });
  stage.addEventListener("pointermove", (event) => {
    input.pointer.inside = true;
    toGame(event);
  });
  stage.addEventListener("pointerleave", () => (input.pointer.inside = false));
  addEventListener("pointerup", () => (input.pointer.down = false));

  addEventListener("keydown", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (/INPUT|SELECT|TEXTAREA/.test(target.tagName)) return;
    if (MOVEMENT_KEYS.includes(event.key) && target.tagName !== "BUTTON") {
      event.preventDefault();
    }
    const key = normalise(event.key);
    if (!input.held[key]) input.pressed.add(key);
    input.held[key] = true;
    hooks.onGesture();
    hooks.onKey(key);
  });
  addEventListener("keyup", (event) => {
    input.held[normalise(event.key)] = false;
  });
  addEventListener("blur", () => {
    input.held = {};
  });
}

/** Call once at the end of every frame. */
export function endInputFrame() {
  input.pressed.clear();
  input.pointer.pressedThisFrame = false;
}
