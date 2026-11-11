import { test } from "node:test";
import assert from "node:assert/strict";
import { tierName, tierOf, tierProgress } from "../../src/core/bond.js";
import { BOND_TIERS } from "../../src/data/cats.js";

test("tierOf maps bond points to tiers at the exact boundaries", () => {
  assert.equal(tierOf(0), 0);
  BOND_TIERS.forEach((tier, i) => {
    assert.equal(tierOf(tier.min), i, `${tier.name} starts at ${tier.min}`);
    if (i > 0) assert.equal(tierOf(tier.min - 0.1), i - 1);
  });
  assert.equal(tierOf(99999), BOND_TIERS.length - 1);
});

test("tierProgress is the fraction of the way to the next tier", () => {
  assert.equal(tierProgress(0), 0);
  const [, curious, friendly] = BOND_TIERS;
  assert.equal(tierProgress((curious.min + friendly.min) / 2), 0.5);
  assert.equal(tierProgress(99999), 1);
});

test("tierName names the tier", () => {
  assert.equal(tierName(0), "Wary");
  assert.equal(tierName(BOND_TIERS[4].min), "Soulmate");
});
