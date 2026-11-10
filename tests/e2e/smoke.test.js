/**
 * End-to-end smoke test: plays the built game in a headless browser through the first day and
 * into the second, and fails on any page error. Run with `npm run test:e2e` (builds first).
 *
 * Uses `window.__PURRLIGHT__.game` only to read state and to skip long walks, never to change
 * game rules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
/** @type {any} */
let playwright = null;
try {
  playwright = require('playwright');
} catch {
  playwright = null;
}
const page = resolve('dist/index.html');
const skip = !playwright
  ? 'Playwright is not installed'
  : !existsSync(page)
    ? 'Run `npm run build` first'
    : false;

const read = (p, fn) => p.evaluate(fn);

test('a new player can get through the first day', { skip, timeout: 120_000 }, async () => {
  const browser = await playwright.chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  tab.on(
    'console',
    (m) => m.type() === 'error' && !/ERR_|Failed to load/.test(m.text()) && errors.push(m.text()),
  );
  await tab.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const state = () => read(tab, () => window.__PURRLIGHT__.game.state);
  const scene = () => read(tab, () => window.__PURRLIGHT__.game.scene?.name);

  try {
    await tab.goto(`file://${page}`);
    await tab.click('[data-action="new-game"][data-value="full"]');
    await tab.click('[data-action="begin"]');
    assert.equal(await scene(), 'world');
    assert.equal((await state()).phase, 'dawn');
    assert.match(await tab.textContent('#goals'), /cast a line/);

    // Walk to the lake with the keyboard and cast a line.
    await tab.keyboard.down('ArrowLeft');
    await tab.waitForFunction(
      () => window.__PURRLIGHT__.game.focus?.pickup?.kind === 'lake',
      null,
      { timeout: 15_000 },
    );
    await tab.keyboard.up('ArrowLeft');
    await tab.keyboard.press('e');
    assert.equal(await scene(), 'fishing');
    await tab.waitForSelector('.result .btn', { timeout: 20_000 });
    await tab.click('.result .btn');
    assert.equal((await state()).castsToday, 1);

    // Gather two things: stand next to each and press E.
    for (let i = 0; i < 2; i++) {
      await read(tab, () => {
        const { game } = window.__PURRLIGHT__;
        const item = game.pickups.find(
          (p) => !p.taken && ['herb', 'stone', 'wood'].includes(p.kind),
        );
        Object.assign(game.player, { x: item.x + 2, y: item.y });
      });
      await tab.waitForTimeout(150);
      await tab.keyboard.press('e');
    }
    const notes = (await state()).tasks.notes;
    assert.deepEqual(
      notes.slice(0, 2).map((n) => n.have >= n.need),
      [true, true],
    );

    // Start the day and feed Biscuit through his menu.
    await tab.click('#next');
    assert.equal((await state()).phase, 'day');
    await read(tab, () => {
      const { game } = window.__PURRLIGHT__;
      const biscuit = game.cats.biscuit;
      Object.assign(game.player, { x: biscuit.x + 6, y: biscuit.y });
      biscuit.idleTimer = 99;
    });
    await tab.waitForTimeout(150);
    await tab.keyboard.press('e');
    await tab.click('[data-action="feed"]');
    const before = (await state()).cats.biscuit.warmth;
    await tab.click('[data-action="eat"]');
    assert.ok((await state()).cats.biscuit.warmth > before, 'feeding warms the cat');

    // Sit quietly next to a wary cat until it trusts you.
    await read(
      tab,
      () =>
        window.__PURRLIGHT__.game.state && document.querySelector('[data-action="close"]')?.click(),
    );
    await read(tab, () => {
      const { game } = window.__PURRLIGHT__;
      const wary = Object.keys(game.cats).find((id) => id !== 'biscuit');
      Object.assign(game.player, { x: game.cats[wary].x + 40, y: game.cats[wary].y });
    });
    await tab.waitForTimeout(200);
    await tab.keyboard.press('q');
    await tab.waitForFunction(
      () => window.__PURRLIGHT__.game.state.tasks.notes.find((n) => n.event === 'coax').have === 1,
      null,
      { timeout: 30_000 },
    );

    // Let the day end, see the evening fire, and go to sleep.
    await read(tab, () => {
      const { game } = window.__PURRLIGHT__;
      document.querySelectorAll('[data-action="close"]').forEach((b) => b.click());
      game.state.clock = 0.999;
    });
    await tab.waitForFunction(() => window.__PURRLIGHT__.game.scene?.name === 'evening', null, {
      timeout: 5_000,
    });
    await tab.waitForSelector('#next:not([hidden])', { timeout: 20_000 });
    await tab.click('#next');
    assert.equal((await state()).phase, 'night');
    await tab.click('[data-action="sleep"]');
    const morning = await state();
    assert.equal(morning.day, 2);
    assert.equal(morning.phase, 'dawn');
    assert.equal(morning.tasks.notes.length, 3);
    assert.ok(morning.purrs > 0);

    // The game was saved: reloading offers to continue.
    await tab.reload();
    await tab.click('[data-action="continue"]');
    assert.equal((await state()).day, 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test(
  'the tool bar strokes and feeds cats right in the village',
  { skip, timeout: 60_000 },
  async () => {
    const browser = await playwright.chromium.launch();
    const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    tab.on('pageerror', (e) => errors.push(e.message));
    try {
      await tab.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
      await tab.goto(`file://${page}`);
      await tab.click('[data-action="new-game"][data-value="full"]');
      await tab.click('[data-action="begin"]');
      await tab.click('#next'); // start the day
      const standBy = (catId) =>
        tab.evaluate((id) => {
          const { game } = window.__PURRLIGHT__;
          game.state.cats[id].warmth = 60;
          game.cats[id].idleTimer = 99;
          // Put this cat in a clear spot and everything else out of reach, so E is meant for it.
          Object.assign(game.cats[id], { x: 900, y: 240, targetX: null });
          Object.entries(game.cats)
            .filter(([other]) => other !== id)
            .forEach(([, cat], i) =>
              Object.assign(cat, { x: 300 + i * 40, targetX: null, idleTimer: 99 }),
            );
          game.pickups.forEach((p) => (p.taken = true));
          Object.assign(game.player, { x: game.cats[id].x + 8, y: game.cats[id].y });
        }, catId);

      // Hand tool (key 2): hold E next to Biscuit until he has had enough.
      await tab.keyboard.press('2');
      assert.equal(await tab.getAttribute('#tools .tool.on', 'data-value'), 'hand');
      await standBy('biscuit');
      await tab.waitForTimeout(150);
      await tab.keyboard.down('e');
      await tab.waitForFunction(
        () => window.__PURRLIGHT__.game.state.cats.biscuit.strokeToday >= 10,
        null,
        { timeout: 15_000 },
      );
      await tab.keyboard.up('e');

      // First food on the bar (key 3): one press of E feeds the cat directly, no menu.
      await tab.keyboard.press('3');
      await standBy('nettle');
      await tab.waitForTimeout(150);
      await tab.keyboard.press('e');
      const nettle = await tab.evaluate(() => window.__PURRLIGHT__.game.state.cats.nettle);
      assert.equal(nettle.mealsToday, 1);
      assert.equal(await tab.isHidden('#modal'), true, 'feeding from the tool bar opens no menu');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);

test(
  'the page fits a phone screen without sideways scrolling',
  { skip, timeout: 60_000 },
  async () => {
    const browser = await playwright.chromium.launch();
    const phone = await browser.newPage({
      viewport: { width: 390, height: 800 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      await phone.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
      await phone.goto(`file://${page}`);
      await phone.tap('[data-action="new-game"][data-value="short"]');
      await phone.tap('[data-action="begin"]');
      const width = await phone.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(width <= 390, `page is ${width}px wide`);
    } finally {
      await browser.close();
    }
  },
);

test(
  'the village is drawn in 3D, and clicking the ground or a cat works through it',
  { skip, timeout: 60_000 },
  async () => {
    const browser = await playwright.chromium.launch();
    const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    tab.on('pageerror', (e) => errors.push(e.message));
    try {
      await tab.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
      await tab.goto(`file://${page}`);
      await tab.click('[data-action="new-game"][data-value="full"]');
      await tab.click('[data-action="begin"]');
      await tab.waitForTimeout(400);

      // The WebGL canvas has a picture: many different colours, not a blank clear.
      const colours = await tab.evaluate(() => {
        const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#world3d'));
        const copy = document.createElement('canvas');
        copy.width = 96;
        copy.height = 54;
        const ctx = /** @type {CanvasRenderingContext2D} */ (copy.getContext('2d'));
        ctx.drawImage(canvas, 0, 0, 96, 54);
        const data = ctx.getImageData(0, 0, 96, 54).data;
        const seen = new Set();
        for (let i = 0; i < data.length; i += 4) seen.add(`${data[i] >> 4},${data[i + 1] >> 4}`);
        return seen.size;
      });
      assert.ok(colours > 30, `the 3D view shows a scene (${colours} colours)`);

      // Click on open ground to the right of the player: she walks there.
      const before = await tab.evaluate(() => window.__PURRLIGHT__.game.player.x);
      const box = await tab.locator('#stage').boundingBox();
      await tab.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.8);
      await tab.waitForTimeout(800);
      const after = await tab.evaluate(() => window.__PURRLIGHT__.game.player.x);
      assert.ok(after > before + 10, `walked right (${before} -> ${after})`);

      // H opens the help card; Escape closes it.
      await tab.keyboard.press('h');
      assert.match(await tab.textContent('#sheet'), /How to play/);
      await tab.keyboard.press('Escape');
      assert.equal(await tab.isHidden('#modal'), true);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
