/**
 * The modal "sheet": every menu, letter and result card opens in it. While it is open the
 * world is paused.
 */
import { IS_TOUCH, escapeHtml, qs } from '../engine/dom.js';
import { game } from '../game/runtime.js';

/** @type {(() => void) | null} */
let onCloseHandler = null;
/** Called when a sheet closes without its own handler (set by the night menu). */
/** @type {(() => void) | null} */
let defaultCloseHandler = null;

/** @param {(() => void) | null} handler */
export function setDefaultCloseHandler(handler) {
  defaultCloseHandler = handler;
}

/**
 * @param {string} html
 * @param {{ className?: string, closable?: boolean, onClose?: (() => void) | null }} [options]
 */
export function openSheet(html, { className = '', closable = true, onClose = null } = {}) {
  const sheet = qs('#sheet');
  sheet.className = `sheet ${className}`;
  sheet.innerHTML =
    (closable
      ? '<button class="close" data-action="close" aria-label="Close">Close</button>'
      : '') + html;
  qs('#modal').hidden = false;
  game.paused = true;
  onCloseHandler = onClose;
  sheet.scrollTop = 0;
  const first = /** @type {HTMLElement | null} */ (sheet.querySelector('button:not(.close)'));
  if (first && !IS_TOUCH) first.focus({ preventScroll: true });
}

/** Closes the sheet, running its close handler. */
export function closeSheet() {
  const wasOpen = isSheetOpen();
  qs('#modal').hidden = true;
  game.paused = false;
  const handler = onCloseHandler;
  onCloseHandler = null;
  if (!wasOpen) return;
  if (handler) handler();
  else defaultCloseHandler?.();
}

/** Hides the sheet without running any close handler (used when a minigame takes over). */
export function hideSheet() {
  qs('#modal').hidden = true;
  game.paused = false;
  onCloseHandler = null;
}

export const isSheetOpen = () => !qs('#modal').hidden;

/** A small card with a Continue button. */
export function showResult(html, onContinue = () => {}) {
  openSheet(
    `<div class="result">${html}<button class="btn big" data-action="close">Continue</button></div>`,
    {
      className: 'small',
      closable: false,
      onClose: onContinue,
    },
  );
}

/**
 * A titled message with paragraphs of plain text.
 * @param {string} title
 * @param {string[]} paragraphs
 */
export function showMessage(title, paragraphs, buttonLabel = 'Continue', onContinue = () => {}) {
  openSheet(
    `<div class="result"><h2>${escapeHtml(title)}</h2>${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}<button class="btn big" data-action="close">${escapeHtml(buttonLabel)}</button></div>`,
    { className: 'small', closable: false, onClose: onContinue },
  );
}
