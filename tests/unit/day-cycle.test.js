import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catsInTheSun,
  eveningGathering,
  overnightLoss,
  passNight,
} from '../../src/core/day-cycle.js';
import { assignFire, lightFire } from '../../src/core/winter.js';
import { BALANCE } from '../../src/config.js';
import { BOND_TIERS } from '../../src/data/cats.js';
import { always, inSeason, newGame, seeded } from './helpers.js';

test('night resets daily counters and moves to the next dawn', () => {
  const state = newGame();
  Object.assign(state.cats.biscuit, { mealsToday: 2, petsToday: 2, gamesToday: 1, coaxToday: 12 });
  Object.assign(state, { phase: 'night', castsToday: 3, milkedToday: 1 });
  passNight(state, seeded());
  assert.equal(state.day, 2);
  assert.equal(state.phase, 'dawn');
  assert.equal(state.clock, 0);
  assert.equal(state.castsToday, 0);
  assert.equal(state.cats.biscuit.mealsToday, 0);
  assert.equal(state.cats.biscuit.coaxToday, 0);
  assert.ok(state.tasks && state.tasks.day === 2, 'new notes are written');
});

test('the season turns after its last day and winter wraps to spring', () => {
  const state = newGame('short');
  state.seasonDay = 4;
  assert.equal(passNight(state, seeded()).newSeason, true);
  assert.equal(state.season, 1);
  assert.equal(state.seasonDay, 1);

  state.season = 3;
  state.seasonDay = 4;
  passNight(state, seeded());
  assert.equal(state.season, 0);
});

test('a rebuilt building brings its cat home the next morning', () => {
  const state = newGame();
  state.built.hut = true;
  const { notes } = passNight(state, seeded());
  assert.equal(state.cats.scrap.present, true);
  assert.ok(notes.some((n) => n.includes('Scrap')));
});

test('overnight loss: decor helps down to a floor, the lantern ends it', () => {
  const state = inSeason(newGame(), 0);
  const none = new Set();
  assert.equal(overnightLoss(state, 'biscuit', none), BALANCE.overnightLoss);
  state.decor = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  assert.equal(overnightLoss(state, 'biscuit', none), BALANCE.overnightLossFloor);
  state.lanternLit = true;
  assert.equal(overnightLoss(state, 'biscuit', none), 0);
});

test('summer: nooks shade the warmest cats, the rest lose extra warmth', () => {
  const state = inSeason(newGame(), 1);
  state.cats.biscuit.warmth = 90;
  state.cats.nettle.warmth = 80;
  state.cats.pim.warmth = 70;
  state.nooks = 1;
  const sunny = catsInTheSun(state);
  assert.deepEqual([...sunny], ['pim']);
  assert.equal(
    overnightLoss(state, 'pim', sunny),
    overnightLoss(state, 'biscuit', sunny) + BALANCE.summerSunLoss,
  );
});

test('winter: a lit fire keeps up to three cats warm', () => {
  const state = inSeason(newGame(), 3);
  for (const id of ['marzipan', 'scrap']) state.cats[id].present = true;
  state.bag.wood = 2;
  assert.equal(lightFire(state, 'bonfire'), true);
  const sunny = new Set();
  // Five cats default to the bonfire: the first three are warm, the rest are cold.
  const losses = ['biscuit', 'nettle', 'pim', 'marzipan', 'scrap'].map((id) =>
    overnightLoss(state, id, sunny),
  );
  assert.deepEqual(losses, [5, 5, 5, 34, 34]);
});

test('winter: you cannot put a fourth cat at one fire', () => {
  const state = inSeason(newGame(), 3);
  state.built.hut = true;
  for (const id of ['scrap']) state.cats[id].present = true;
  assert.equal(assignFire(state, 'scrap', 'hut').ok, true);
  for (const id of ['biscuit', 'nettle']) assignFire(state, id, 'hut');
  assert.equal(assignFire(state, 'pim', 'hut').ok, false);
});

test('catnip planted in the greenhouse is ready two mornings later', () => {
  const state = newGame();
  state.plots = [1, 0, 0];
  passNight(state, seeded());
  assert.equal(state.bag.catnip ?? 0, 0);
  passNight(state, seeded());
  assert.equal(state.bag.catnip, 1);
  assert.deepEqual(state.plots, [0, 0, 0]);
});

test('the observatory pays for the warmest sunbathers', () => {
  const state = newGame();
  state.built.observatory = true;
  state.cats.biscuit.warmth = 99;
  passNight(state, always(0.99));
  assert.ok(state.purrs > 0);
});

test('evening: wary cats give one Purr, warm ones more', () => {
  const state = newGame();
  state.cats.biscuit.warmth = 70;
  const { rows, total } = eveningGathering(state, always(0.99));
  const byCat = Object.fromEntries(rows.map((r) => [r.catId, r.purrs]));
  assert.equal(byCat.pim, 1);
  assert.ok(byCat.biscuit > 1);
  assert.equal(state.purrs, total);
});

test('evening: deeper memories need a deeper bond', () => {
  const state = newGame();
  state.cats.biscuit.warmth = 80;
  eveningGathering(state, always(0)); // tier 0 allows the first memory
  assert.equal(state.cats.biscuit.memories, 1);
  eveningGathering(state, always(0)); // the second needs tier 1
  assert.equal(state.cats.biscuit.memories, 1);
  state.cats.biscuit.bond = BOND_TIERS[1].min;
  eveningGathering(state, always(0));
  assert.equal(state.cats.biscuit.memories, 2);
});
