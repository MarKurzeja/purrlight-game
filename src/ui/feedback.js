/** Toasts and big banners. */
import { qs } from '../engine/dom.js';

const MAX_TOASTS = 2;

/** A short message that fades after a few seconds. */
export function toast(text) {
  const list = qs('#toasts');
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = text;
  list.append(item);
  setTimeout(() => item.remove(), 4200);
  while (list.children.length > MAX_TOASTS) list.firstChild?.remove();
}

let celebrationTimer = 0;

/**
 * A card that celebrates something (a cat trusting you more) without stopping play.
 * @param {{ title: string, text: string, image?: string }} card
 */
export function showCelebration({ title, text, image }) {
  const host = qs('#celebration');
  host.replaceChildren();
  if (image) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    host.append(img);
  }
  const words = document.createElement('div');
  const big = document.createElement('b');
  big.textContent = title;
  const small = document.createElement('span');
  small.textContent = text;
  words.append(big, small);
  host.append(words);
  host.hidden = false;
  host.classList.remove('show');
  void host.offsetWidth;
  host.classList.add('show');
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => (host.hidden = true), 5200);
}
/** A large title across the screen, e.g. "Spring / Day 3: dawn". */
export function showBanner(title, subtitle) {
  const banner = qs('#banner');
  banner.replaceChildren();
  const big = document.createElement('b');
  big.textContent = title;
  const small = document.createElement('span');
  small.textContent = subtitle;
  banner.append(big, small);
  banner.classList.remove('show');
  void banner.offsetWidth; // restart the CSS animation
  banner.classList.add('show');
}
