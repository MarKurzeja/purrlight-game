/** The notes panel in the corner: the next big goal and today's three notes. */
import { escapeHtml, qs } from "../engine/dom.js";
import { DAYTIME_EVENTS, currentNote } from "../core/notes.js";
import { nextGoal } from "../core/progress.js";
import { game } from "../game/runtime.js";

/** Collapsed shows only the current note. Defaults to collapsed on small screens. */
let collapsed = /** @type {boolean | null} */ (null);
let lastHtml = "";
let flashUntil = 0;

export function toggleGoals() {
  collapsed = !collapsed;
  refreshGoals({ force: true });
}

/** @param {{ flash?: boolean, force?: boolean }} [options] */
export function refreshGoals({ flash = false, force = false } = {}) {
  const panel = qs("#goals");
  const state = game.state;
  const visible =
    !!state &&
    game.scene?.name === "world" &&
    (state.phase === "dawn" || state.phase === "day");
  panel.hidden = !visible;
  if (!visible || !state) return;
  if (collapsed === null) collapsed = qs("#stage").clientWidth < 640;
  if (flash) flashUntil = game.time + 1.2;

  const notes = state.tasks?.notes ?? [];
  const current = currentNote(state);
  const row = (note) => {
    const done = note.have >= note.need;
    const waitForDay =
      note === current &&
      state.phase === "dawn" &&
      DAYTIME_EVENTS.includes(note.event);
    return `<li class="${done ? "done" : ""}${note === current ? " current" : ""}">
      <span class="check" aria-hidden="true">${done ? "✓" : ""}</span>
      <span class="label">${escapeHtml(note.label)}${waitForDay ? " <i>(after dawn)</i>" : ""}</span>
      <span class="count">${note.need > 1 ? `${note.have}/${note.need} ` : ""}<em>+${note.reward}</em></span></li>`;
  };
  const title = state.day === 1 ? "Getting started" : "Today’s notes";
  const body = collapsed
    ? current
      ? `<ul>${row(current)}</ul>`
      : ""
    : `<p class="goal">${escapeHtml(nextGoal(state))}</p><ul>${notes.map(row).join("")}</ul>`;
  const html = `<button class="goals-head" data-action="toggle-goals" aria-expanded="${!collapsed}"><span>${title}</span><small>${collapsed ? "show" : "hide"}</small></button>${body}`;
  if (html !== lastHtml || force) {
    lastHtml = html;
    panel.innerHTML = html;
  }
  panel.classList.toggle("flash", game.time < flashUntil);
}
