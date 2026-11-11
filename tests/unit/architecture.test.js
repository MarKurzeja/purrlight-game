/**
 * Guards the layering described in docs/ARCHITECTURE.md:
 *   data, core   pure rules, no browser APIs, only import each other
 *   engine       browser primitives (canvas, audio, input), know nothing about the game
 *   render       drawing, may use engine/core/data but not game state modules or UI
 *   game, scenes, ui   wire everything together
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { bundle } from "../../tools/bundler.js";

const SRC = "src";
const ALLOWED = {
  data: ["data", "config.js"],
  core: ["core", "data", "config.js"],
  engine: ["engine", "core", "config.js"],
  render: ["render", "engine", "core", "data", "config.js"],
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? walk(path)
      : path.endsWith(".js")
        ? [path]
        : [];
  });
}

const layerOf = (path) => relative(SRC, path).split("/")[0];

test("each layer only imports from the layers below it", () => {
  const violations = [];
  for (const file of walk(SRC)) {
    const allowed = ALLOWED[layerOf(file)];
    if (!allowed) continue;
    const source = readFileSync(file, "utf8");
    for (const [, target] of source.matchAll(
      /^import .* from '(\.[^']+)';$/gm,
    )) {
      const targetLayer = layerOf(join(file, "..", target));
      if (!allowed.includes(targetLayer)) {
        violations.push(`${file} imports ${target}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("the whole game bundles into one script with unique top-level names", () => {
  const { code, modules } = bundle("src/main.js");
  assert.ok(modules.length > 40);
  assert.doesNotMatch(code, /^\s*(import|export)\s/m);
});
