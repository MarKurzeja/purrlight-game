/**
 * Captures the README screenshots from the built game (run `npm run build` first).
 * Usage: node tools/screenshots.js
 */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { resolve } from "node:path";
const out = resolve("docs/screenshots");
const b = await chromium.launch();
const tab = await b.newPage({ viewport: { width: 1280, height: 720 } });
tab.on("pageerror", (e) => console.log("pageerror", e.message));
await tab.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
await tab.goto("file://" + resolve("dist/index.html"));
await tab.click('[data-action="new-game"][data-value="full"]');
await tab.click('[data-action="begin"]');
await tab.click("#next");
const setup = (fn, arg) => tab.evaluate(fn, arg);
await setup(() => {
  const { game } = window.__PURRLIGHT__;
  const s = game.state;
  Object.assign(s.built, { hut: true, bakery: true });
  s.decor.push("bedrose", "postsisal");
  for (const id of Object.keys(game.cats)) {
    s.cats[id].bond = 40;
    s.cats[id].warmth = 70;
    s.cats[id].tierSeen = 1;
  }
  document.querySelectorAll('[data-action="close"]').forEach((b) => b.click());

  Object.assign(game.player, { x: 760, y: 262 });
  game.camera.x = 760;
  game.camera.y = 262;
  s.clock = 0.35;
  const ids = Object.keys(game.cats);
  ids.forEach((id, i) =>
    Object.assign(game.cats[id], {
      x: 700 + i * 40,
      y: 240 + (i % 2) * 30,
      targetX: null,
      idleTimer: 99,
    }),
  );
});
await tab.waitForTimeout(2500);
await tab.screenshot({ path: `${out}/village.png` });
await setup(() => {
  window.__PURRLIGHT__.game.state.clock = 0.999;
});
await tab.waitForTimeout(7000);
await tab.screenshot({ path: `${out}/evening.png` });
await b.close();

// Winter, and the petting close-up, from a fresh game.
const b2 = await chromium.launch();
const t2 = await b2.newPage({ viewport: { width: 1280, height: 720 } });
await t2.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
await t2.goto("file://" + resolve("dist/index.html"));
await t2.click('[data-action="new-game"][data-value="full"]');
await t2.click('[data-action="begin"]');
await t2.click("#next");
await t2.evaluate(() => {
  const { game } = window.__PURRLIGHT__;
  const s = game.state;
  s.season = 3;
  s.clock = 0.82;
  Object.assign(s.built, { hut: true, bakery: true, library: true });
  document.querySelector('#goals [data-action="toggle-goals"]')?.click();
  Object.assign(game.player, { x: 900, y: 255 });
  game.camera.x = 900;
  game.camera.y = 255;
  const ids = Object.keys(game.cats);
  ids.forEach((id, i) => {
    s.cats[id].bond = 40;
    s.cats[id].warmth = 70;
    s.cats[id].tierSeen = 1;
    Object.assign(game.cats[id], {
      x: 840 + i * 45,
      y: 250 + (i % 2) * 28,
      targetX: null,
      idleTimer: 99,
    });
  });
});
await t2.waitForTimeout(2500);
await t2.screenshot({ path: `${out}/winter.png` });
await t2.evaluate(() => {
  const { game } = window.__PURRLIGHT__;
  game.state.season = 0;
  const c = game.cats.biscuit;
  Object.assign(game.player, { x: c.x + 6, y: c.y });
  game.state.cats.biscuit.bond = 80;
  game.state.cats.biscuit.tierSeen = 3;
});
await t2.waitForTimeout(300);
await t2.keyboard.press("e");
await t2.click('[data-action="pet"]');
await t2.mouse.move(640, 300);
await t2.waitForTimeout(1500);
await t2.screenshot({ path: `${out}/petting.png` });
await b2.close();
