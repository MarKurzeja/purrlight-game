import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectTierUps, lanternReady, nextGoal, readMemory } from '../../src/core/progress.js';
import { advanceClock, applyDayWeather, beginDay } from '../../src/core/clock.js';
import { huntReward } from '../../src/core/hunt.js';
import { BALANCE } from '../../src/config.js';
import { BOND_TIERS } from '../../src/data/cats.js';
import { inSeason, newGame } from './helpers.js';

test('the next goal walks through buildings, lantern parts and memories', () => {
  const state = newGame();
  assert.match(nextGoal(state), /Fisherman's Hut: 0 of 40/);
  state.purrs = 40;
  assert.match(nextGoal(state), /You can rebuild the Fisherman's Hut tonight/);
  for (const id of ['hut', 'bakery', 'library', 'observatory', 'greenhouse']) {
    state.built[id] = true;
  }
  assert.match(nextGoal(state), /new wick/);
  state.lantern = { wick: true, lens: true, stair: true };
  assert.match(nextGoal(state), /memories/);
  state.memoriesRead = Array.from({ length: 20 }, (_, i) => `x:${i}`);
  assert.match(nextGoal(state), /light it/);
  assert.equal(lanternReady(state), true);
  state.lanternLit = true;
  assert.equal(lanternReady(state), false);
});

test('memories need the library and a memory the cat has actually given', () => {
  const state = newGame();
  state.cats.biscuit.memories = 1;
  assert.equal(readMemory(state, 'biscuit', 0).ok, false);
  state.built.library = true;
  assert.equal(readMemory(state, 'biscuit', 1).ok, false);
  assert.deepEqual(readMemory(state, 'biscuit', 0), { ok: true, isNew: true });
  assert.deepEqual(readMemory(state, 'biscuit', 0), { ok: true, isNew: false });
  assert.deepEqual(state.memoriesRead, ['biscuit:0']);
  assert.equal(state.cats.biscuit.bond, BALANCE.memoryReadBond);
});

test('each bond tier is celebrated exactly once', () => {
  const state = newGame();
  state.cats.biscuit.bond = BOND_TIERS[2].min + 5;
  assert.deepEqual(collectTierUps(state, ['biscuit', 'pim']), [{ catId: 'biscuit', tier: 2 }]);
  assert.deepEqual(collectTierUps(state, ['biscuit', 'pim']), []);
});

test('the clock runs during dawn and day, not at night or in relax mode', () => {
  const state = newGame();
  assert.equal(advanceClock(state, 50), false);
  assert.equal(advanceClock(state, 60), true);
  beginDay(state);
  assert.equal(state.clock, 0);
  state.phase = 'night';
  assert.equal(advanceClock(state, 1000), false);
  state.phase = 'day';
  state.relaxMode = true;
  assert.equal(advanceClock(state, 1000), false);
});

test('winter days slowly drain warmth', () => {
  const state = inSeason(newGame(), 3);
  state.phase = 'day';
  const before = state.cats.biscuit.warmth;
  applyDayWeather(state, 70);
  assert.ok(Math.abs(state.cats.biscuit.warmth - (before - 6)) < 1e-9);
});

test('a good hunt brings food and warms hunters twice as much', () => {
  const state = newGame();
  state.cats.biscuit.warmth = 50;
  const nettle = state.cats.nettle.warmth;
  const { fish } = huntReward(state, 8);
  assert.equal(fish, 'trout');
  assert.equal(state.bag.herb, 3);
  assert.equal(state.cats.biscuit.warmth, 60);
  assert.equal(state.cats.nettle.warmth, nettle + 20, 'wary hunters still join in');
  assert.equal(state.cats.pim.warmth, 19, 'wary non-hunters stay away');
});
