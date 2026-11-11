import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDailyNotes,
  currentNote,
  recordEvent,
} from "../../src/core/notes.js";
import { newGame, seeded } from "./helpers.js";

test("day one is a guided tutorial in a fixed order", () => {
  const state = newGame();
  createDailyNotes(state, seeded());
  assert.deepEqual(
    state.tasks.notes.map((n) => n.event),
    ["cast", "gather", "feed", "coax", "pet"],
  );
});

test("later days get three different notes", () => {
  const state = newGame();
  state.day = 4;
  createDailyNotes(state, seeded(11));
  const events = state.tasks.notes.map((n) => n.event);
  assert.equal(events.length, 3);
  assert.equal(new Set(events).size, 3);
});

test("the coax note only appears while a cat is wary", () => {
  const state = newGame();
  state.day = 4;
  for (const id of Object.keys(state.cats)) state.cats[id].warmth = 90;
  for (let seed = 0; seed < 30; seed++) {
    createDailyNotes(state, seeded(seed));
    assert.ok(!state.tasks.notes.some((n) => n.event === "coax"));
  }
});

test("events complete notes, pay their reward, and the full set pays a bonus once", () => {
  const state = newGame();
  createDailyNotes(state, seeded());
  const reward = state.tasks.notes[0].reward;

  let result = recordEvent(state, "cast");
  assert.equal(result.completed.length, 1);
  assert.equal(state.purrs, reward);

  result = recordEvent(state, "cast");
  assert.equal(result.completed.length, 0, "a finished note is not paid twice");

  for (const event of ["gather", "gather", "feed", "coax"]) {
    recordEvent(state, event);
  }
  result = recordEvent(state, "pet");
  assert.ok(result.bonus > 0);
  assert.equal(recordEvent(state, "pet").bonus, 0);
});

test("counting stops at the amount needed", () => {
  const state = newGame();
  createDailyNotes(state, seeded());
  recordEvent(state, "gather", 10);
  assert.equal(state.tasks.notes[1].have, 2);
});

test("relax mode ignores notes", () => {
  const state = newGame();
  createDailyNotes(state, seeded());
  state.relaxMode = true;
  recordEvent(state, "cast");
  assert.equal(state.purrs, 0);
});

test("at dawn the marker skips notes that need daytime", () => {
  const state = newGame();
  createDailyNotes(state, seeded());
  recordEvent(state, "cast");
  recordEvent(state, "gather", 2);
  // Only daytime notes remain; at dawn the first of them is shown anyway.
  assert.equal(currentNote(state).event, "feed");

  state.tasks.notes.reverse(); // put "pet" (daytime) before "cast"/"gather"
  state.tasks.notes.forEach((n) => (n.have = n.event === "pet" ? 0 : n.have));
  state.tasks.notes.find((n) => n.event === "cast").have = 0;
  assert.equal(currentNote(state).event, "cast");
  state.phase = "day";
  assert.equal(currentNote(state).event, "pet");
});
