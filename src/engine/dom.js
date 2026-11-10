/** Tiny DOM helpers. */

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
export function qs(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return /** @type {HTMLElement} */ (element);
}

/** Escapes text for safe insertion into HTML. */
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );
}

/** True on phones and tablets, where prompts say "Tap" instead of a key. */
export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
