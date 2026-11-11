import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bake,
  buildBuilding,
  buildNook,
  buyDecor,
  buyHat,
  buyRod,
  plantHerb,
  repairLantern,
} from "../../src/core/shop.js";
import { newGame } from "./helpers.js";

test("a building costs Purrs and can only be built once", () => {
  const state = newGame();
  state.purrs = 50;
  assert.equal(buildBuilding(state, "hut").ok, true);
  assert.equal(state.purrs, 10);
  assert.equal(buildBuilding(state, "hut").ok, false);
});

test("a failed purchase explains why and spends nothing", () => {
  const state = newGame();
  state.purrs = 10;
  const result = buildBuilding(state, "hut");
  assert.deepEqual(result, { ok: false, reason: "You need 30 more Purrs." });
  assert.equal(state.purrs, 10);
});

test("rods must be bought in order", () => {
  const state = newGame();
  state.purrs = 1000;
  assert.equal(buyRod(state, 2).ok, false);
  assert.equal(buyRod(state, 1).ok, true);
  assert.equal(buyRod(state, 2).ok, true);
  assert.equal(state.rod, 2);
});

test("nooks, hats, decor and lantern parts are one-off purchases", () => {
  const state = newGame();
  state.purrs = 10000;
  for (let i = 0; i < 4; i++) assert.equal(buildNook(state).ok, true);
  assert.equal(buildNook(state).ok, false);
  assert.equal(buyHat(state, "beret").ok, true);
  assert.equal(buyHat(state, "beret").ok, false);
  assert.equal(
    buyHat(state, "nightcap").ok,
    false,
    "secret hats are not for sale",
  );
  assert.equal(buyDecor(state, "bedrose").ok, true);
  assert.equal(buyDecor(state, "bedrose").ok, false);
  assert.equal(repairLantern(state, "wick").ok, true);
  assert.equal(repairLantern(state, "wick").ok, false);
});

test("baking needs the bakery and the ingredients", () => {
  const state = newGame();
  state.bag = { milk: 2 };
  assert.equal(bake(state, 2).ok, false);
  state.built.bakery = true;
  assert.equal(bake(state, 2).ok, true);
  assert.deepEqual(state.bag, { milk: 0, milkbun: 1 });
  assert.equal(bake(state, 2).ok, false);
});

test("planting uses a herb and an empty plot", () => {
  const state = newGame();
  state.built.greenhouse = true;
  state.bag.herb = 1;
  state.day = 3;
  assert.equal(plantHerb(state, 0).ok, true);
  assert.equal(state.plots[0], 3);
  assert.equal(plantHerb(state, 1).ok, false, "no herbs left");
});
