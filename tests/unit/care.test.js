import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableActions,
  lapTime,
  nameSuits,
  recordPetting,
  recordPlay,
  renameCat,
  revealSecret,
  sitWith,
  strokeCat,
  takePhoto,
} from "../../src/core/care.js";
import { BALANCE } from "../../src/config.js";
import { BOND_TIERS } from "../../src/data/cats.js";
import { newGame } from "./helpers.js";

const warmCat = (state, id = "biscuit", bond = 0) => {
  state.cats[id].warmth = 60;
  state.cats[id].bond = bond;
  return state.cats[id];
};

test("wary cats can be fed but not petted or played with", () => {
  const state = newGame();
  const actions = availableActions(state, "pim");
  assert.equal(actions.feed.ok, true);
  assert.equal(actions.pet.ok, false);
  assert.equal(actions.pet.reason, "Too wary");
  assert.equal(actions.play.ok, false);
});

test("bond tiers unlock walks, lap time and secrets", () => {
  const state = newGame();
  warmCat(state, "biscuit", 0);
  assert.equal(availableActions(state, "biscuit").walk.unlocked, false);
  state.cats.biscuit.bond = BOND_TIERS[1].min;
  assert.equal(availableActions(state, "biscuit").walk.unlocked, true);
  assert.equal(availableActions(state, "biscuit").lap.unlocked, false);
  state.cats.biscuit.bond = BOND_TIERS[4].min;
  assert.equal(availableActions(state, "biscuit").secret.unlocked, true);
});

test("a successful petting session warms the cat and may reveal the sweet spot", () => {
  const state = newGame();
  const cat = warmCat(state);
  const result = recordPetting(state, "biscuit", {
    success: true,
    fill: 1,
    timedOut: false,
  });
  assert.equal(result.warmth, 34);
  assert.equal(cat.warmth, 94);
  assert.equal(cat.bond, BALANCE.petBond);
  assert.equal(result.learnedSweetSpot, true);
  assert.equal(cat.petsToday, 1);
});

test("the second session of the day is worth less", () => {
  const state = newGame();
  warmCat(state);
  const first = recordPetting(state, "biscuit", {
    success: true,
    fill: 1,
    timedOut: false,
  });
  state.cats.biscuit.warmth = 60;
  const second = recordPetting(state, "biscuit", {
    success: true,
    fill: 1,
    timedOut: false,
  });
  assert.ok(second.warmth < first.warmth);
});

test("scaring a cat costs warmth, running out of time does not", () => {
  const state = newGame();
  const cat = warmCat(state);
  recordPetting(state, "biscuit", {
    success: false,
    fill: 0.2,
    timedOut: false,
  });
  assert.equal(cat.warmth, 56);
  recordPetting(state, "biscuit", {
    success: false,
    fill: 0.2,
    timedOut: true,
  });
  assert.equal(cat.warmth, 56);
});

test("playing with the favourite toy is worth 50% more and is remembered", () => {
  const state = newGame();
  warmCat(state);
  const fav = recordPlay(state, "biscuit", "ball", 1);
  assert.equal(fav.favourite, true);
  assert.equal(fav.warmth, 39);
  assert.equal(state.cats.biscuit.knowsToy, true);

  const other = newGame();
  warmCat(other);
  const meh = recordPlay(other, "biscuit", "laser", 1);
  assert.equal(meh.favourite, false);
  assert.equal(meh.warmth, 26);
});

test("lap time works once per day and only for friendly cats", () => {
  const state = newGame();
  warmCat(state, "biscuit", BOND_TIERS[2].min);
  assert.equal(lapTime(state, "biscuit"), true);
  assert.equal(lapTime(state, "biscuit"), false);
  state.day += 1;
  assert.equal(lapTime(state, "biscuit"), true);
});

test("each personality prefers different names", () => {
  assert.equal(nameSuits("lazy", "Oolong"), true);
  assert.equal(nameSuits("lazy", "Bartholomew"), false);
  assert.equal(nameSuits("hunter", "Kix"), true);
  assert.equal(nameSuits("aristocrat", "Wilhelmina"), true);
  assert.equal(nameSuits("aristocrat", "Bo"), false);
  assert.equal(nameSuits("shy", "Lumi"), true);
  assert.equal(nameSuits("wise", "anything"), true);
});

test("renaming trims the name and pays a bond bonus only the first time", () => {
  const state = newGame();
  assert.deepEqual(renameCat(state, "biscuit", "   "), { ok: false });
  const result = renameCat(state, "biscuit", "  Oolong  ");
  assert.deepEqual(result, { ok: true, name: "Oolong", suits: true });
  assert.equal(state.cats.biscuit.bond, BALANCE.renameBond);
  renameCat(state, "biscuit", "Toffo");
  assert.equal(state.cats.biscuit.bond, BALANCE.renameBond);
});

test("new photos pay Purrs, duplicates do not", () => {
  const state = newGame();
  assert.deepEqual(takePhoto(state, "pim", "wary"), { isNew: true });
  assert.deepEqual(takePhoto(state, "pim", "wary"), { isNew: false });
  assert.equal(state.purrs, BALANCE.photoPurrs);
});

test("sitting quietly coaxes a wary cat up to a daily cap", () => {
  const state = newGame();
  const cat = state.cats.pim;
  const start = cat.warmth;
  let completed = 0;
  for (let i = 0; i < 100; i++)
    if (sitWith(state, "pim", 0.5).completedCoax) completed++;
  assert.ok(Math.abs(cat.warmth - (start + BALANCE.coaxDailyCap)) < 1e-9);
  assert.equal(cat.coaxToday, BALANCE.coaxDailyCap);
  assert.ok(completed >= 1);
  assert.ok(Math.abs(cat.bond - BALANCE.sitBondDailyCap) < 1e-9);
});

test("a revealed secret gives its hat once", () => {
  const state = newGame();
  assert.equal(revealSecret(state, "biscuit"), "nightcap");
  revealSecret(state, "biscuit");
  assert.deepEqual(state.hats, ["nightcap"]);
  assert.equal(state.cats.biscuit.secretFound, true);
});

test("stroking warms a trusting cat up to a daily limit, but not a wary one", () => {
  const state = newGame();
  assert.deepEqual(strokeCat(state, "pim", 1), { ok: false, reason: "wary" });
  const cat = warmCat(state);
  let satisfied = false;
  for (let i = 0; i < 100 && !satisfied; i++) {
    const r = strokeCat(state, "biscuit", 0.1);
    assert.equal(r.ok, true);
    satisfied = r.ok && r.satisfied;
  }
  assert.ok(Math.abs(cat.warmth - (60 + BALANCE.strokeDailyCap)) < 1e-9);
  assert.ok(cat.bond > 0);
  assert.deepEqual(strokeCat(state, "biscuit", 1), {
    ok: false,
    reason: "enough",
  });
});
