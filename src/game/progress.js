/**
 * Subscribers that turn game events into progress: daily notes, cat wishes and celebrations.
 * Keeping these here means actions do not need to know which goals exist.
 */
import { recordEvent } from "../core/notes.js";
import { grantWish, WISHES } from "../core/wishes.js";
import { playSound } from "../engine/audio.js";
import { spawnBurst } from "../render/effects.js";
import { toast } from "../ui/feedback.js";
import { refreshGoals } from "../ui/goals.js";
import { gameEvents } from "./bus.js";
import { currentState, game } from "./runtime.js";

/** Counts an event towards today's notes and announces anything completed. */
function count(event, amount = 1) {
  const { completed, bonus } = recordEvent(currentState(), event, amount);
  for (const note of completed) {
    playSound("chime");
    toast(`Done: ${note.label}. +${note.reward} Purrs.`);
  }
  if (bonus)
    setTimeout(
      () => toast(`All of today’s notes done. +${bonus} bonus Purrs.`),
      900,
    );
  if (completed.length) refreshGoals({ flash: true });
}

/** Grants a cat's wish if this is what it wanted. */
function tryWish(catId, kind) {
  const state = currentState();
  const result = grantWish(state, catId, kind, game.rng);
  if (!result.granted) return;
  const e = game.cats[catId];
  if (e) {
    spawnBurst(game.particles, e.x, e.y, "#f08aa8", 10, "heart", 14);
    e.emote = { kind: "heart", at: game.time };
  }
  playSound("chime");
  toast(
    `Wish granted: ${state.cats[catId].name} wanted ${WISHES[kind].label}. +8 Warmth, +3 Bond.`,
  );
  if (result.wantsMore)
    game.wishTimers[catId] = game.time + 25 + Math.random() * 20;
  gameEvents.emit("wish:granted", { catId, kind });
}

/** Wires everything up. Call once at start-up. */
export function startProgressTracking() {
  gameEvents.on("fishing:cast", () => count("cast"));
  gameEvents.on("fishing:catch", ({ quantity }) => count("fish", quantity));
  gameEvents.on("item:gathered", ({ quantity }) => count("gather", quantity));
  gameEvents.on("goat:milked", () => count("milk"));
  gameEvents.on("cat:fed", ({ catId, taste, discoveredFavourite }) => {
    count("feed");
    if (discoveredFavourite) count("favourite");
    if (taste !== "hate") setTimeout(() => tryWish(catId, "food"), 300);
  });
  gameEvents.on("cat:petted", ({ catId, success }) => {
    if (!success) return;
    count("pet");
    setTimeout(() => tryWish(catId, "pets"), 400);
  });
  gameEvents.on("cat:played", ({ catId }) => {
    count("play");
    setTimeout(() => tryWish(catId, "play"), 400);
  });
  gameEvents.on("cat:stroked", ({ catId }) => tryWish(catId, "pets"));
  gameEvents.on("cat:coaxed", ({ catId }) => {
    count("coax");
    tryWish(catId, "sit");
  });
  gameEvents.on("photo:taken", ({ isNew }) => {
    if (isNew) count("photo");
  });
  gameEvents.on("wish:granted", () => count("wish"));
}
