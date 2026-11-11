import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOND_TIERS,
  CATS,
  PERSONALITIES,
  PET_ZONES,
  STARTING_CATS,
} from "../../src/data/cats.js";
import { FOODS, HATS, RECIPES, TOYS, ITEMS } from "../../src/data/items.js";
import { BUILDINGS, BUILDING_LAYOUT, FIRES } from "../../src/data/village.js";
import { MEMORIES } from "../../src/data/story.js";

test("every cat refers to real foods, toys, zones, personalities and hats", () => {
  for (const cat of CATS) {
    for (const food of [...cat.loves, ...cat.likes, ...cat.hates]) {
      assert.ok(FOODS[food], `${cat.id} mentions unknown food ${food}`);
    }
    assert.ok(TOYS[cat.favouriteToy], `${cat.id} has unknown toy`);
    assert.ok(PET_ZONES[cat.sweetSpot], `${cat.id} has unknown sweet spot`);
    assert.ok(
      PERSONALITIES[cat.personality],
      `${cat.id} has unknown personality`,
    );
    assert.ok(HATS[cat.secret.hat], `${cat.id} hides an unknown hat`);
  }
});

test("no cat has contradictory tastes", () => {
  for (const cat of CATS) {
    const all = [...cat.loves, ...cat.likes, ...cat.hates];
    assert.equal(new Set(all).size, all.length, `${cat.id} lists a food twice`);
  }
});

test("every cat has exactly five memories", () => {
  for (const cat of CATS) assert.equal(MEMORIES[cat.id]?.length, 5, cat.id);
});

test("each building brings a different cat that does not start in the village", () => {
  const arrivals = Object.values(BUILDINGS).map((b) => b.bringsCat);
  assert.equal(new Set(arrivals).size, arrivals.length);
  for (const id of arrivals) {
    assert.ok(CATS.some((c) => c.id === id));
    assert.ok(!STARTING_CATS.includes(id));
  }
  assert.equal(
    STARTING_CATS.length + arrivals.length,
    CATS.length,
    "every cat can reach the village",
  );
});

test("every building has a layout and fires refer to real buildings", () => {
  for (const id of Object.keys(BUILDINGS)) {
    assert.ok(
      BUILDING_LAYOUT.some((b) => b.id === id),
      id,
    );
  }
  for (const fire of FIRES)
    if (fire.needs) assert.ok(BUILDINGS[fire.needs], fire.id);
});

test("recipes use known items and bond tiers are increasing", () => {
  for (const r of RECIPES) {
    assert.ok(FOODS[r.output]);
    for (const item of Object.keys(r.ingredients)) assert.ok(ITEMS[item], item);
  }
  for (let i = 1; i < BOND_TIERS.length; i++)
    assert.ok(BOND_TIERS[i].min > BOND_TIERS[i - 1].min);
});

test("every food has its own tool bar icon", async () => {
  const { FOODS } = await import("../../src/data/items.js");
  const { hasToolIcon } = await import("../../src/ui/icons.js");
  const missing = Object.keys(FOODS).filter((id) => !hasToolIcon(id));
  assert.deepEqual(missing, []);
});
