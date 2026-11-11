import { test } from "node:test";
import assert from "node:assert/strict";
import { grantWish, rollWish, rollWishes } from "../../src/core/wishes.js";
import { always, newGame, seeded } from "./helpers.js";
import { BALANCE } from "../../src/config.js";

test("wary cats only wish for food or company", () => {
  const state = newGame();
  const rng = seeded(5);
  for (let i = 0; i < 100; i++)
    assert.ok(["food", "sit"].includes(rollWish(state, "pim", rng)));
});

test("warm cats wish for food, pets or play", () => {
  const state = newGame();
  state.cats.biscuit.warmth = 80;
  const rng = seeded(9);
  const seen = new Set();
  for (let i = 0; i < 100; i++) seen.add(rollWish(state, "biscuit", rng));
  assert.deepEqual([...seen].sort(), ["food", "pets", "play"]);
});

test("rollWishes gives every present cat a wish and absent cats none", () => {
  const state = newGame();
  rollWishes(state, seeded());
  assert.ok(state.cats.biscuit.wish);
  assert.equal(state.cats.moss.wish, null);
});

test("only the matching wish is granted, with a bonus", () => {
  const state = newGame();
  state.cats.biscuit.wish = "food";
  const warmth = state.cats.biscuit.warmth;
  assert.deepEqual(grantWish(state, "biscuit", "pets", always(0.9)), {
    granted: false,
  });
  assert.deepEqual(grantWish(state, "biscuit", "food", always(0.9)), {
    granted: true,
    wantsMore: false,
  });
  assert.equal(state.cats.biscuit.wish, null);
  assert.equal(state.cats.biscuit.warmth, warmth + 8);
  assert.equal(state.cats.biscuit.bond, BALANCE.wishBond);
});

test("a granted wish sometimes leads to another", () => {
  const state = newGame();
  state.cats.biscuit.wish = "food";
  const result = grantWish(state, "biscuit", "food", always(0.1));
  assert.equal(result.granted && result.wantsMore, true);
});
