import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSave, parseSave, serializeState } from '../../src/core/save.js';
import { SAVE_VERSION } from '../../src/config.js';
import { newGame } from './helpers.js';

test('a game survives a save and load unchanged', () => {
  const state = newGame('short');
  state.purrs = 77;
  state.cats.pim.tastes.herb = 'love';
  const loaded = parseSave(serializeState(state, 1234));
  assert.deepEqual(loaded, { ...state, savedAt: 1234 });
});

test('corrupt or unknown saves are rejected instead of crashing', () => {
  assert.equal(parseSave(''), null);
  assert.equal(parseSave('{not json'), null);
  assert.equal(parseSave('"a string"'), null);
  assert.equal(parseSave(JSON.stringify({ version: 1 })), null);
});

test('missing fields from a partial save are filled with defaults', () => {
  const loaded = migrateSave({
    version: SAVE_VERSION,
    mode: 'full',
    purrs: 5,
    cats: { pim: { bond: 9 } },
  });
  assert.equal(loaded.purrs, 5);
  assert.equal(loaded.cats.pim.bond, 9);
  assert.equal(loaded.cats.pim.warmth, 19);
  assert.ok(loaded.cats.moss, 'cats missing from the save are added');
  assert.deepEqual(loaded.plots, [0, 0, 0]);
});

test('version 2 saves are migrated to the current field names', () => {
  const v2 = {
    v: 2,
    mode: 'full',
    day: 6,
    season: 1,
    sday: 6,
    phase: 'day',
    clock: 0.3,
    purrs: 55,
    bag: { sardine: 2 },
    cats: {
      biscuit: {
        name: 'Oolong',
        warmth: 71,
        bond: 44,
        here: true,
        hat: 'beret',
        food: { milk: 'love' },
        toyKnown: true,
        sweetKnown: false,
        frags: 2,
        fed: 1,
        pet: 0,
        play: 0,
        lap: 5,
        photos: { sit: 1, ghost: 1 },
        secret: false,
      },
    },
    built: { hut: 1 },
    nooks: 1,
    rod: 1,
    decor: ['bedrose'],
    hats: ['beret'],
    plots: [0, 0, 0],
    lantern: {},
    fires: {},
    lit: {},
    read: ['biscuit0', 'biscuit1'],
    relax: false,
    done: false,
    casts: 2,
    milked: 1,
    tasks: {
      day: 6,
      bonus: false,
      list: [{ ev: 'fav', need: 1, have: 0, l: 'Find a favourite', t: 'cat', rew: 9 }],
    },
    ts: 99,
  };
  const s = migrateSave(v2);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.seasonDay, 6);
  assert.equal(s.cats.biscuit.name, 'Oolong');
  assert.equal(s.cats.biscuit.present, true);
  assert.deepEqual(s.cats.biscuit.tastes, { milk: 'love' });
  assert.equal(s.cats.biscuit.memories, 2);
  assert.deepEqual(s.cats.biscuit.photos, { sit: true, wary: true });
  assert.deepEqual(s.memoriesRead, ['biscuit:0', 'biscuit:1']);
  assert.equal(s.tasks.notes[0].event, 'favourite');
  assert.equal(s.cats.pim.present, true, 'cats absent from the old save get defaults');
});
