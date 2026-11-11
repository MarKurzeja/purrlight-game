import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFishingSession,
  fishingAccuracy,
  judgeCatch,
  pressLane,
  stepFishing,
} from "../../src/core/fishing.js";
import { seeded } from "./helpers.js";

test("better rods mean more notes and wider timing", () => {
  const basic = createFishingSession(0, seeded());
  const best = createFishingSession(2, seeded());
  assert.equal(basic.notes.length, 11);
  assert.equal(best.notes.length, 15);
  assert.ok(best.window > basic.window);
});

test("notes are in time order and in valid lanes", () => {
  const s = createFishingSession(1, seeded(4));
  for (let i = 1; i < s.notes.length; i++)
    assert.ok(s.notes[i].time > s.notes[i - 1].time);
  for (const n of s.notes) assert.ok(n.lane >= 0 && n.lane < 3);
});

test("pressing exactly on the beat is perfect, slightly off is good, early is a miss", () => {
  const s = createFishingSession(0, seeded());
  const [first] = s.notes;
  s.time = first.time;
  assert.equal(pressLane(s, first.lane), "perfect");

  const second = s.notes[1];
  s.time = second.time - s.window * 1.5;
  assert.equal(pressLane(s, second.lane), "good");

  const third = s.notes[2];
  s.time = third.time - 1;
  assert.equal(pressLane(s, third.lane), "miss");
  assert.equal(s.combo, 0);
});

test("a perfect run scores 100% and the session ends after the last note", () => {
  const s = createFishingSession(0, seeded(2));
  let finished = false;
  for (let i = 0; i < 5000 && !finished; i++) {
    for (const n of s.notes) {
      if (n.state === "waiting" && s.time >= n.time - 0.004)
        pressLane(s, n.lane);
    }
    finished = stepFishing(s, 0.005).finished;
  }
  assert.equal(finished, true);
  assert.equal(fishingAccuracy(s), 1);
});

test("notes that pass the line are missed", () => {
  const s = createFishingSession(0, seeded());
  const { missed } = stepFishing(s, s.notes[0].time + 1);
  assert.ok(missed >= 1);
  assert.equal(s.lastJudgement, "Missed");
});

test("the catch depends on accuracy and rod", () => {
  assert.deepEqual(judgeCatch(0.1, 2), { fish: null, quantity: 0 });
  assert.deepEqual(judgeCatch(0.5, 0), { fish: "sardine", quantity: 1 });
  assert.deepEqual(judgeCatch(0.85, 0), { fish: "sardine", quantity: 2 });
  assert.deepEqual(judgeCatch(0.85, 1), { fish: "trout", quantity: 1 });
  assert.deepEqual(judgeCatch(0.95, 2), { fish: "moonkoi", quantity: 1 });
});
