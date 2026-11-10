import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPettingSession, isOnCat, stepPetting } from '../../src/core/petting.js';
import { PET_ZONES, BELLY_ZONE } from '../../src/data/cats.js';
import { seeded } from './helpers.js';

const DT = 1 / 60;

/** Strokes back and forth over a point at a given speed until the session ends. */
function stroke(session, x, y, speed, rng = seeded()) {
  let outcome = null;
  let t = 0;
  while (!outcome && t < 30) {
    const offset = Math.sin((t * speed) / 10) * 10;
    outcome = stepPetting(session, { x: x + offset, y, touching: true }, DT, rng);
    t += DT;
  }
  return outcome;
}

test('rubbing the sweet spot at the right speed makes the cat purr', () => {
  const session = createPettingSession({ personality: 'lazy', sweetSpot: 'chin', skittish: false });
  const chin = PET_ZONES.chin;
  assert.equal(stroke(session, chin.x, chin.y, 6), 'purring');
  assert.ok(session.fear < 1);
});

test('touching the belly makes any cat bolt', () => {
  const session = createPettingSession({ personality: 'wise', sweetSpot: 'back', skittish: false });
  assert.equal(stroke(session, BELLY_ZONE.x, BELLY_ZONE.y, 6), 'bolted');
});

test('the wrong speed in the right spot gives a hint instead of progress', () => {
  const session = createPettingSession({
    personality: 'hunter',
    sweetSpot: 'ear',
    skittish: false,
  });
  const ear = PET_ZONES.ear;
  for (let i = 0; i < 60; i++) {
    stepPetting(session, { x: ear.x + (i % 2), y: ear.y, touching: true }, DT, seeded());
  }
  assert.equal(session.fill, 0);
  assert.equal(session.hint, 'A little brisker');
});

test('not touching the cat changes nothing', () => {
  const session = createPettingSession({ personality: 'shy', sweetSpot: 'cheek', skittish: true });
  for (let i = 0; i < 120; i++) {
    stepPetting(session, { x: 10, y: 10, touching: true }, DT, seeded());
  }
  assert.equal(session.fill, 0);
  assert.equal(session.fear, 0);
  assert.equal(isOnCat(10, 10), false);
});

test("a bandit's sweet spot keeps moving", () => {
  const session = createPettingSession({
    personality: 'bandit',
    sweetSpot: 'rump',
    skittish: false,
  });
  const seen = new Set([session.sweetSpot]);
  for (let i = 0; i < 60 * 30; i++) {
    stepPetting(session, { x: 0, y: 0, touching: false }, DT, seeded(i));
  }
  for (let i = 0; i < 3; i++) seen.add(session.sweetSpot);
  assert.ok(seen.size > 1);
});

test('running out of time counts as success only past half way', () => {
  const session = createPettingSession({ personality: 'lazy', sweetSpot: 'chin', skittish: false });
  session.fill = 0.6;
  session.timeLeft = DT / 2;
  assert.equal(stepPetting(session, { x: 0, y: 0, touching: false }, DT, seeded()), 'purring');
  const other = createPettingSession({ personality: 'lazy', sweetSpot: 'chin', skittish: false });
  other.timeLeft = DT / 2;
  assert.equal(stepPetting(other, { x: 0, y: 0, touching: false }, DT, seeded()), 'timeout');
});
