/** The night menu: build, upgrade, bake, plant, shop and (in winter) tend the fires. */
import { BALANCE } from "../config.js";
import { canBake } from "../core/shop.js";
import { currentSeason, presentCats } from "../core/state.js";
import { availableFires, catsAtFire, fireOf } from "../core/winter.js";
import { FOODS, HATS, ITEMS, RECIPES, RODS } from "../data/items.js";
import { BUILDINGS, DECOR, NOOKS } from "../data/village.js";
import { escapeHtml, qs } from "../engine/dom.js";
import { itemIconHtml } from "../render/sprites.js";
import { currentState } from "../game/runtime.js";
import { actionButton, shopRow, tabBar } from "./components.js";
import { openSheet } from "./sheet.js";

const DONE = (label) => `<em>${label}</em>`;

/** Which tabs exist depends on what has been rebuilt. */
function nightTabs() {
  const state = currentState();
  /** @type {[string, string][]} */
  const tabs = [["build", "Build"]];
  if (state.built.hut) tabs.push(["hut", "Hut"]);
  if (state.built.bakery) tabs.push(["bakery", "Bakery"]);
  if (state.built.greenhouse) tabs.push(["greenhouse", "Greenhouse"]);
  tabs.push(["market", "Market"]);
  if (currentSeason(state).id === "winter") tabs.push(["fires", "Fires"]);
  return tabs;
}

/** @param {string} [tab] */
export function openNightMenu(tab) {
  const state = currentState();
  const active =
    tab ?? (currentSeason(state).id === "winter" ? "fires" : "build");
  qs("#hint").textContent = "Night. Spend your Purrs, then sleep.";
  qs("#next").hidden = true;
  const pages = {
    build: buildPage,
    hut: hutPage,
    bakery: bakeryPage,
    greenhouse: greenhousePage,
    market: marketPage,
    fires: firesPage,
  };
  openSheet(
    `<div class="night-head"><h2>Night ${state.day}</h2><span class="purrs">${state.purrs} Purrs</span></div>
    ${tabBar("night", nightTabs(), active, '<button data-action="journal">Journal</button>')}
    ${(pages[active] ?? buildPage)()}
    ${actionButton("sleep", "Sleep until dawn", { className: "btn big" })}`,
    { className: "wide", closable: false, onClose: () => {} },
  );
}

const canAfford = (cost) => currentState().purrs >= cost;
const buyButton = (action, cost, value, label = `${cost} Purrs`) =>
  actionButton(action, label, { value, disabled: !canAfford(cost) });

function buildPage() {
  const state = currentState();
  const buildings = Object.entries(BUILDINGS).map(([id, b]) =>
    shopRow(
      b.name,
      `${b.description}${state.built[id] ? "" : " A new cat will come home."}`,
      state.built[id] ? DONE("Built") : buyButton("build", b.cost, id),
    ),
  );
  const nooks = shopRow(
    `Shaded nook (${state.nooks} of ${NOOKS.length})`,
    "Each covers two cats in summer.",
    state.nooks < NOOKS.length
      ? buyButton("build-nook", BALANCE.nookCost, "")
      : DONE("All built"),
  );
  const lantern = shopRow(
    "The Great Lantern",
    "Repairs happen at the tower.",
    actionButton("lantern", "Inspect"),
  );
  return `<div class="rows">${buildings.join("")}${nooks}${lantern}</div>`;
}

function hutPage() {
  const state = currentState();
  return `<div class="rows">${RODS.map((rod, level) =>
    shopRow(
      rod.name,
      rod.description,
      state.rod >= level
        ? DONE("Owned")
        : actionButton("rod", `${rod.cost} Purrs`, {
            value: level,
            disabled: !(state.rod === level - 1 && canAfford(rod.cost)),
          }),
    ),
  ).join("")}</div>`;
}

function bakeryPage() {
  const state = currentState();
  return `<p class="dim">Clover gives two milk a day now the bakery is open.</p><div class="rows">${RECIPES.map(
    (recipe, i) => {
      const needs = Object.entries(recipe.ingredients)
        .map(
          ([item, n]) =>
            `${n} ${ITEMS[item].name} (have ${state.bag[item] ?? 0})`,
        )
        .join(", ");
      return shopRow(
        `${itemIconHtml(recipe.output)} ${FOODS[recipe.output].name}`,
        `Needs ${needs}`,
        actionButton("bake", "Bake", {
          value: i,
          disabled: !canBake(state, i),
        }),
      );
    },
  ).join("")}</div>`;
}

function greenhousePage() {
  const state = currentState();
  return `<p class="dim">Plant wild herbs tonight. Catnip is ready two mornings later.</p><div class="rows">${state.plots
    .map((planted, i) =>
      shopRow(
        `Plot ${i + 1}`,
        planted
          ? `Growing. Ready on the morning of day ${planted + 2}.`
          : "Empty soil.",
        planted
          ? DONE("Growing")
          : actionButton("plant", "Plant 1 herb", {
              value: i,
              disabled: !(state.bag.herb > 0),
            }),
      ),
    )
    .join("")}</div>`;
}

function marketPage() {
  const state = currentState();
  const hats = Object.entries(HATS)
    .filter(([, hat]) => hat.cost > 0)
    .map(([id, hat]) =>
      shopRow(
        hat.name,
        "",
        state.hats.includes(id)
          ? DONE("Owned")
          : buyButton("buy-hat", hat.cost, id, String(hat.cost)),
      ),
    );
  const decor = DECOR.map((item) =>
    shopRow(
      item.name,
      "",
      state.decor.includes(item.id)
        ? DONE("Placed")
        : buyButton("buy-decor", item.cost, item.id, String(item.cost)),
    ),
  );
  return `<h3>Hats</h3><div class="rows two">${hats.join("")}</div>
    <h3>Cat comforts</h3><p class="dim">Each piece slows overnight Warmth loss.</p><div class="rows two">${decor.join("")}</div>`;
}

function firesPage() {
  const state = currentState();
  const fires = availableFires(state);
  const fireRows = fires.map((fire) =>
    shopRow(
      fire.name,
      `${catsAtFire(state, fire.id).length} of ${BALANCE.catsPerFire} cats`,
      state.litFires[fire.id]
        ? DONE("Lit")
        : actionButton("light-fire", "Light", {
            value: fire.id,
            disabled: (state.bag.wood ?? 0) < BALANCE.firewoodPerFire,
          }),
    ),
  );
  const groups = presentCats(state).map(
    (c) =>
      `<label class="group" for="fire-${c.id}"><span>${escapeHtml(state.cats[c.id].name)}</span>
      <select id="fire-${c.id}" data-cat="${c.id}">${fires.map((f) => `<option value="${f.id}"${fireOf(state, c.id) === f.id ? " selected" : ""}>${f.name}</option>`).join("")}</select></label>`,
  );
  return `<p class="dim">Lighting a fire costs ${BALANCE.firewoodPerFire} Firewood (you have ${state.bag.wood ?? 0}). A fire warms up to ${BALANCE.catsPerFire} cats. Cats by an unlit fire lose a lot of Warmth.</p>
    <div class="rows">${fireRows.join("")}</div><h3>Groups</h3><div class="rows two">${groups.join("")}</div>`;
}
