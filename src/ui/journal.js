/** The journal: your cats, your bag, the photo album, memories and options. */
import { BALANCE } from "../config.js";
import { tierOf } from "../core/bond.js";
import { PHOTO_POSES } from "../core/care.js";
import { isWary, presentCats } from "../core/state.js";
import {
  BOND_TIERS,
  CATS,
  CAT_BY_ID,
  PERSONALITIES,
  PET_ZONES,
} from "../data/cats.js";
import { FOODS, ITEMS, TOYS } from "../data/items.js";
import { MEMORIES } from "../data/story.js";
import { audioSettings } from "../engine/audio.js";
import { escapeHtml } from "../engine/dom.js";
import { memoryIllustration } from "../render/vignette.js";
import { catPicture } from "../render/portraits.js";
import { itemIconHtml } from "../render/sprites.js";
import { currentState } from "../game/runtime.js";
import { actionButton, meter, tabBar } from "./components.js";
import { openSheet } from "./sheet.js";

const TABS = /** @type {[string, string][]} */ ([
  ["cats", "Cats"],
  ["bag", "Bag"],
  ["album", "Album"],
  ["memories", "Memories"],
  ["options", "Options"],
]);
const POSE_LABELS = {
  wary: "Wary",
  sit: "Sitting",
  loaf: "Loafing",
  sleep: "Sleeping",
  walk: "Walking",
};

export function openJournal(tab = "cats") {
  const pages = {
    cats: catsPage,
    bag: bagPage,
    album: albumPage,
    memories: memoriesPage,
    options: optionsPage,
  };
  openSheet(
    `<h2>Journal</h2>${tabBar("journal", TABS, tab)}${(pages[tab] ?? catsPage)()}`,
    {
      className: "wide",
    },
  );
}

function catsPage() {
  const state = currentState();
  const rows = presentCats(state).map((c) => {
    const cat = state.cats[c.id];
    const def = CAT_BY_ID[c.id];
    const traits = PERSONALITIES[def.personality];
    const wary = isWary(state, c.id);
    const known = (taste) =>
      Object.keys(cat.tastes)
        .filter((f) => cat.tastes[f] === taste)
        .map((f) => FOODS[f].name)
        .join(", ") || "unknown";
    const spot = cat.knowsSweetSpot
      ? def.personality === "bandit"
        ? "it moves"
        : PET_ZONES[def.sweetSpot].name
      : "unknown";
    return `<div class="cat-row"><img alt="" src="${catPicture(def, { hat: cat.hat, wary, size: 72 })}"><div>
      <b>${escapeHtml(cat.name)}</b> <span class="tag">${traits.label} · ${traits.rarity} · ${BOND_TIERS[tierOf(cat.bond)].name}</span><br>
      ${meter(cat.warmth, wary ? "#9db4c8" : "#f3a982")} <small>${Math.round(cat.warmth)}% Warmth</small><br>
      <small>Loves: ${known("love")}. Likes: ${known("like")}. Refuses: ${known("hate")}.<br>
      Sweet spot: ${spot}. Toy: ${cat.knowsToy ? TOYS[def.favouriteToy] : "unknown"}.</small></div></div>`;
  });
  return `<div class="rows">${rows.join("")}</div><p class="dim">${rows.length} of ${CATS.length} cats have come home. Rebuilding brings the others.</p>`;
}

function bagPage() {
  const state = currentState();
  const items = Object.keys(ITEMS).filter((k) => (state.bag[k] ?? 0) > 0);
  if (!items.length) return '<p class="note">Your bag is empty.</p>';
  return `<div class="bag">${items
    .map(
      (k) =>
        `<div class="item">${itemIconHtml(k)}<b>${ITEMS[k].name} ×${state.bag[k]}</b><small>${ITEMS[k].description}</small></div>`,
    )
    .join("")}</div>`;
}

function albumPage() {
  const state = currentState();
  const total = CATS.reduce(
    (sum, c) => sum + Object.keys(state.cats[c.id].photos).length,
    0,
  );
  const rows = CATS.map((def) => {
    const cat = state.cats[def.id];
    const frames = PHOTO_POSES.map((pose) =>
      cat.photos[pose]
        ? `<figure><img alt="${POSE_LABELS[pose]}" src="${catPicture(def, { pose: pose === "wary" ? "sit" : pose, wary: pose === "wary", size: 72 })}"><figcaption>${POSE_LABELS[pose]}</figcaption></figure>`
        : `<figure class="empty"><span></span><figcaption>${POSE_LABELS[pose]}</figcaption></figure>`,
    ).join("");
    return `<div class="album-row"><span class="album-name">${cat.present ? escapeHtml(cat.name) : "Not yet home"}</span>${frames}</div>`;
  });
  return `<p class="dim">${total} of ${CATS.length * PHOTO_POSES.length} photos. Catch each cat in every pose, including one while it is still wary.</p><div class="album">${rows.join("")}</div>`;
}

function memoriesPage() {
  const state = currentState();
  const holders = CATS.filter((c) => state.cats[c.id].memories > 0);
  if (!holders.length) {
    return '<p class="note">No memories yet. Warm cats may leave one at the evening fire. Higher bonds unlock deeper memories.</p>';
  }
  if (!state.built.library) {
    const count = holders.reduce(
      (sum, c) => sum + state.cats[c.id].memories,
      0,
    );
    return `<p class="note">You hold ${count} sealed memories. Rebuild the Library to read them.</p>`;
  }
  const rows = holders.map((c) => {
    const cat = state.cats[c.id];
    const pips = Array.from({ length: BALANCE.memoriesPerCat }, (_, i) =>
      i < cat.memories
        ? `<button class="pip ${state.memoriesRead.includes(`${c.id}:${i}`) ? "" : "new"}" data-action="read" data-value="${c.id}:${i}" aria-label="Memory ${i + 1}">${i + 1}</button>`
        : `<i class="pip off">${i + 1}</i>`,
    ).join("");
    return `<div class="memory-row"><b>${escapeHtml(cat.name)}</b><span>${pips}</span></div>`;
  });
  return `<p class="dim">${state.memoriesRead.length} read. The Lantern needs ${BALANCE.memoriesForLantern}.</p><div class="rows">${rows.join("")}</div>`;
}

function optionsPage() {
  const state = currentState();
  return `<div class="actions">
    ${actionButton("toggle-music", `Music: ${audioSettings.music ? "on" : "off"}`)}
    ${actionButton("toggle-sounds", `Sounds: ${audioSettings.effects ? "on" : "off"}`)}
    ${actionButton("save-quit", "Save and return to title")}</div>
    <p class="dim">The game saves itself each morning and evening. Journey: ${state.mode === "short" ? "short, 4-day seasons" : "full, 10-day seasons"}.</p>`;
}

/** A memory letter with its illustration. */
export function openMemoryLetter(catId, index) {
  const state = currentState();
  const body = MEMORIES[catId][index]
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  openSheet(
    `<div class="letter"><img alt="" class="vignette" src="${memoryIllustration(CAT_BY_ID[catId], index)}">
    <p class="from">${escapeHtml(state.cats[catId].name)}, memory ${index + 1} of 5</p>${body}</div>
    ${actionButton("journal", "Back to memories", { value: "memories" })}`,
    { className: "paper" },
  );
}
