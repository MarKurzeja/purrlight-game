/** Result cards shown after each minigame. */
import { RODS, FOODS, TOYS } from "../data/items.js";
import { CAT_BY_ID, PERSONALITIES, PET_ZONES } from "../data/cats.js";
import { escapeHtml } from "../engine/dom.js";
import { itemIconHtml } from "../render/sprites.js";
import { currentState } from "../game/runtime.js";

/** @param {{ fish: string | null, quantity: number, accuracy: number, rod: number }} r */
export function fishingResultHtml(r) {
  const upgrade =
    r.rod < RODS.length - 1
      ? " A rod from the Fisherman’s Hut lets better fish bite."
      : "";
  const catchLine = r.fish
    ? `${itemIconHtml(r.fish)} ${r.quantity > 1 ? `${r.quantity} × ` : ""}${FOODS[r.fish].name}`
    : "Nothing bit. Follow the beat and try again.";
  return `<h2>${r.fish ? "A catch!" : "The line went slack"}</h2><p>${catchLine}</p><p class="dim">Timing ${Math.round(r.accuracy * 100)}%.${r.rod < 1 ? upgrade : ""}</p>`;
}

/** @param {string} catId @param {{ success: boolean, outcome: string, warmth: number, bond: number }} r */
export function pettingResultHtml(catId, r) {
  const name = escapeHtml(currentState().cats[catId].name);
  const def = CAT_BY_ID[catId];
  if (r.success) {
    const cat = currentState().cats[catId];
    const learned = cat.knowsSweetSpot
      ? `<p class="dim">Noted in your journal: ${def.personality === "bandit" ? "the sweet spot moves" : `sweet spot ${PET_ZONES[def.sweetSpot].name}`}.</p>`
      : "";
    return `<h2>${name} purrs</h2><p>Warmth +${r.warmth}. Bond +${r.bond}.</p>${learned}`;
  }
  return r.outcome === "timeout"
    ? `<h2>${name} wandered off</h2><p>You ran out of time before the cat settled.</p>`
    : `<h2>${name} bolted</h2><p>Wrong move. ${PERSONALITIES[def.personality].tip}</p>`;
}

/** @param {string} catId @param {{ favourite: boolean, warmth: number, bond: number, toy: string }} r */
export function playResultHtml(catId, r) {
  const name = escapeHtml(currentState().cats[catId].name);
  return r.favourite
    ? `<h2>${name} loves the ${TOYS[r.toy].toLowerCase()}!</h2><p>Warmth +${r.warmth}. Bond +${r.bond}.</p>`
    : `<h2>Good game</h2><p>Warmth +${r.warmth}. Bond +${r.bond}.</p><p class="dim">Another toy might excite this cat more.</p>`;
}

/** @param {{ mice: number, fish: string | null }} r */
export function huntResultHtml(r) {
  const haul = r.fish
    ? `${itemIconHtml(r.fish)} +1 ${FOODS[r.fish].name}`
    : "Too few to bring home a meal.";
  return `<h2>Hunt over</h2><p>You flushed out ${r.mice} ${r.mice === 1 ? "mouse" : "mice"}. Your cats enjoyed the chase and warmed up. Hunters warmed twice as much.</p><p>${haul}</p>`;
}
