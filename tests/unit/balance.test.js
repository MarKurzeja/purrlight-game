/**
 * Balance regression tests. A bot plays whole journeys with the real rules (tools/simulate.js).
 * If a tuning change makes the game finish far too early or never, these fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from '../../tools/simulate.js';

test('a full journey ends late in the year, after every season has been seen', () => {
  const { median, finishedRuns, runs } = summarise('full', 12);
  assert.equal(finishedRuns, runs, 'every run can reach the ending');
  assert.ok(
    median['lantern ready'] >= 25 && median['lantern ready'] <= 40,
    `lantern on day ${median['lantern ready']}`,
  );
  assert.ok(median.hut <= 3, 'the first building comes quickly');
  assert.ok(
    median.greenhouse >= 10,
    `the last building is a long-term goal (day ${median.greenhouse})`,
  );
});

test('a short journey ends within its 16 days', () => {
  const { median, finishedRuns, runs } = summarise('short', 12);
  assert.equal(finishedRuns, runs);
  assert.ok(
    median['lantern ready'] >= 10 && median['lantern ready'] <= 16,
    `lantern on day ${median['lantern ready']}`,
  );
});

test('a less skilled player can still finish', () => {
  const { finishedRuns, runs } = summarise('full', 8, { skill: 0.35 });
  assert.equal(finishedRuns, runs);
});
