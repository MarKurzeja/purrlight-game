import { test } from "node:test";
import assert from "node:assert/strict";
import { feedCat, mealWarmth, tasteOf } from "../../src/core/feeding.js";
import { BALANCE } from "../../src/config.js";
import { inSeason, newGame } from "./helpers.js";

const summerGame = () => inSeason(newGame(), 1);

test("tasteOf reads the hidden preferences", () => {
  assert.equal(tasteOf("biscuit", "milk"), "love");
  assert.equal(tasteOf("biscuit", "sardine"), "like");
  assert.equal(tasteOf("biscuit", "herb"), "hate");
  assert.equal(tasteOf("biscuit", "trout"), "meh");
});

test("a loved food warms far more than a hated one", () => {
  const state = summerGame();
  assert.equal(mealWarmth(state, "biscuit", "milk"), Math.round(15 * 1.9));
  assert.equal(mealWarmth(state, "biscuit", "herb"), Math.round(11 * 0.25));
});

test("spring meals get a bonus", () => {
  const spring = newGame();
  assert.equal(mealWarmth(spring, "biscuit", "trout"), Math.round(20 * 1.25));
});

test("feeding consumes the food, warms the cat and records what was learned", () => {
  const state = summerGame();
  state.bag.milk = 1;
  const before = state.cats.biscuit.warmth;
  const result = feedCat(state, "biscuit", "milk");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.taste, "love");
  assert.equal(result.ok && result.discoveredFavourite, true);
  assert.equal(state.bag.milk, 0);
  assert.equal(state.cats.biscuit.warmth, before + 29);
  assert.equal(state.cats.biscuit.tastes.milk, "love");
  assert.equal(state.cats.biscuit.bond, BALANCE.tasteBond.love);
});

test('a favourite is only "discovered" the first time', () => {
  const state = summerGame();
  state.bag.milk = 2;
  feedCat(state, "biscuit", "milk");
  const second = feedCat(state, "biscuit", "milk");
  assert.equal(second.ok && second.discoveredFavourite, false);
});

test("the second meal of the day is less warming and a third is refused", () => {
  const state = summerGame();
  state.bag.trout = 3;
  const first = feedCat(state, "biscuit", "trout");
  const second = feedCat(state, "biscuit", "trout");
  const third = feedCat(state, "biscuit", "trout");
  assert.ok(first.ok && second.ok);
  assert.ok(second.ok && first.ok && second.warmth < first.warmth);
  assert.equal(third.ok, false);
  assert.equal(state.bag.trout, 1, "a refused meal is not consumed");
});

test("you cannot feed food you do not have, and bond never drops below zero", () => {
  const state = summerGame();
  assert.equal(feedCat(state, "biscuit", "tart").ok, false);
  state.bag.herb = 1;
  feedCat(state, "biscuit", "herb");
  assert.equal(state.cats.biscuit.bond, 0);
});

test("warmth never exceeds the maximum", () => {
  const state = summerGame();
  state.cats.biscuit.warmth = 99;
  state.bag.milk = 1;
  feedCat(state, "biscuit", "milk");
  assert.equal(state.cats.biscuit.warmth, 100);
});
