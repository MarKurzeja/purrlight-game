/** Bond tiers: how far a cat trusts you. */
import { BOND_TIERS } from '../data/cats.js';

/**
 * The tier index (0 = Wary ... 4 = Soulmate) for a bond value.
 * @param {number} bond
 */
export function tierOf(bond) {
  let tier = 0;
  BOND_TIERS.forEach((t, i) => {
    if (bond >= t.min) tier = i;
  });
  return tier;
}

/**
 * Progress from the current tier to the next, 0-1. Returns 1 at the top tier.
 * @param {number} bond
 */
export function tierProgress(bond) {
  const tier = tierOf(bond);
  const next = BOND_TIERS[tier + 1];
  if (!next) return 1;
  const start = BOND_TIERS[tier].min;
  return (bond - start) / (next.min - start);
}

/** @param {number} bond */
export const tierName = (bond) => BOND_TIERS[tierOf(bond)].name;
