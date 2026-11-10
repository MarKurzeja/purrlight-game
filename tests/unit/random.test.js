import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, pickFrom, shuffled, randomBetween } from '../../src/core/random.js';

test('a seeded generator is repeatable and stays in [0, 1)', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('different seeds give different sequences', () => {
  assert.notEqual(createRng(1)(), createRng(2)());
});

test('shuffled returns a permutation and leaves the input untouched', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffled(createRng(7), input);
  assert.deepEqual([...out].sort(), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
});

test('pickFrom and randomBetween respect their bounds', () => {
  const rng = createRng(3);
  for (let i = 0; i < 200; i++) {
    assert.ok(['a', 'b'].includes(pickFrom(rng, ['a', 'b'])));
    const v = randomBetween(rng, 5, 6);
    assert.ok(v >= 5 && v < 6);
  }
});
