/**
 * The 3D world's pure parts: the valley's shape, coordinate mapping, lighting blends, and
 * that the village and character builders produce sensible geometry.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUND_BOTTOM, GROUND_TOP, WORLD_WIDTH } from "../../src/config.js";
import { CATS } from "../../src/data/cats.js";
import { LANDMARKS } from "../../src/data/village.js";
import {
  LIGHT_PRESETS,
  blendLighting,
  darkness,
  lightingFor,
} from "../../src/render/lighting.js";
import {
  drawCatModel,
  drawGoatModel,
  drawPlayerModel,
} from "../../src/render/models.js";
import {
  WATER_LEVEL,
  fromX,
  fromZ,
  heightAt,
  lakeDistance,
  toX,
  toZ,
  worldPoint,
} from "../../src/render/space.js";
import { buildForest, buildTerrain } from "../../src/render/valley.js";
import { buildVillage } from "../../src/render/village3d.js";

const EMPTY = {
  built: {},
  lantern: {},
  lanternLit: false,
  nooks: 0,
  decor: [],
};
const REBUILT = {
  built: {
    hut: true,
    bakery: true,
    library: true,
    observatory: true,
    greenhouse: true,
  },
  lantern: { wick: true, lens: true, stair: true },
  lanternLit: true,
  nooks: 4,
  decor: ["bedrose", "posttall"],
};

test("game coordinates map to metres and back", () => {
  for (const x of [0, 740, WORLD_WIDTH])
    assert.ok(Math.abs(fromX(toX(x)) - x) < 1e-9);
  for (const y of [GROUND_TOP, 245, GROUND_BOTTOM])
    assert.ok(Math.abs(fromZ(toZ(y)) - y) < 1e-9);
  assert.ok(
    Math.abs(worldPoint(740, 245)[0]) < 1e-9,
    "the origin is the middle of the street",
  );
});

test("the village street is nearly flat, the hills rise behind it and the lake is a basin", () => {
  for (let x = 600; x <= 1300; x += 50) {
    for (let y = GROUND_TOP + 30; y <= GROUND_BOTTOM; y += 30) {
      assert.ok(
        Math.abs(heightAt(toX(x), toZ(y))) < 0.4,
        `street at ${x},${y} is flat`,
      );
    }
  }
  assert.ok(heightAt(0, -60) > 2, "hills behind the houses");
  assert.ok(heightAt(10, -150) > 30, "mountains far behind");
  const lake = worldPoint(220, 172);
  assert.ok(lakeDistance(lake[0], lake[2]) < 0.1);
  assert.ok(
    heightAt(lake[0], lake[2]) < WATER_LEVEL,
    "the lake bed is under water",
  );
  assert.equal(
    worldPoint(220, 172)[1],
    WATER_LEVEL,
    "things in the lake float on its surface",
  );
});

test("the lantern stands on a knoll above the street", () => {
  const tower = worldPoint(LANDMARKS.lanternTower.x, LANDMARKS.lanternTower.y);
  const street = worldPoint(LANDMARKS.lantern.x, LANDMARKS.lantern.y);
  assert.ok(tower[1] > street[1] + 1);
});

test("lighting follows the day and blends smoothly between presets", () => {
  assert.equal(darkness(lightingFor({ phase: "day", clock: 0.3 })), 0);
  assert.equal(darkness(lightingFor({ phase: "night", clock: 0 })), 1);
  const dusk = darkness(lightingFor({ phase: "day", clock: 0.95 }));
  assert.ok(dusk > 0 && dusk < 1);
  const day = blendLighting({ from: 1, to: 1, blend: 0 });
  assert.deepEqual(day.sunColor, LIGHT_PRESETS[1].sunColor);
  const half = blendLighting({ from: 1, to: 3, blend: 0.5 });
  half.skyTop.forEach((v, i) => {
    const a = LIGHT_PRESETS[1].skyTop[i];
    const b = LIGHT_PRESETS[3].skyTop[i];
    assert.ok(v >= Math.min(a, b) && v <= Math.max(a, b));
  });
});

test("terrain meshes are whole triangles with finite vertices", () => {
  const { near, far } = buildTerrain("summer");
  for (const mesh of [near, far]) {
    assert.equal(mesh.count % 3, 0);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.colors.every((c) => c >= 0 && c <= 1));
  }
});

test("the forest is deterministic and keeps out of the village and the lake", () => {
  const a = buildForest("spring");
  const b = buildForest("spring");
  assert.equal(a.count, b.count);
  assert.ok(a.count > 1000);
  for (let i = 0; i < a.positions.length; i += 3) {
    const [x, , z] = [a.positions[i], a.positions[i + 1], a.positions[i + 2]];
    assert.ok(!(Math.abs(x) < 70 && z > -17), "no trees on the street");
    assert.ok(lakeDistance(x, z) > 1.2, "no trees in the lake");
  }
});

test("rebuilding the village adds lit windows, chimney smoke and glass", () => {
  const before = buildVillage(EMPTY, "summer");
  const after = buildVillage(REBUILT, "summer");
  assert.ok(after.windows.count > before.windows.count);
  assert.ok(after.chimneys.length > before.chimneys.length);
  assert.ok(
    after.glass.count > before.glass.count,
    "the greenhouse and lantern lens are glass",
  );
  assert.ok(
    after.lanternLight[1] > 8,
    "the lantern shines from the top of its tower",
  );
});

test("characters draw finite transforms in every pose", () => {
  let draws = 0;
  /** @type {import('../../src/render/models.js').Painter} */
  const painter = {
    part: (key, build) => {
      const mesh = build();
      assert.ok(mesh.count > 0, key);
      return key;
    },
    draw: (_mesh, model) => {
      assert.ok(Array.from(model).every(Number.isFinite));
      draws += 1;
    },
  };
  for (const pose of ["sit", "walk", "loaf", "sleep", "groom", "blink"]) {
    for (const cat of CATS.slice(0, 4)) {
      drawCatModel(painter, cat.coat, pose, [0, 0, 0], {
        time: 1.5,
        hat: "crown",
      });
    }
  }
  drawPlayerModel(painter, [0, 0, 0], { moving: true, walkTime: 0.3 });
  drawPlayerModel(painter, [0, 0, 0], { sitting: true });
  drawGoatModel(painter, [0, 0, 0], { time: 2 });
  assert.ok(draws > 400);
});
