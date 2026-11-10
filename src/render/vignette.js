/** Small watercolour-edged illustrations for the memory letters. */
import { rand } from '../core/random.js';
import { ellipse, fractalNoise, makeCanvas, rect } from '../engine/canvas.js';
import { drawCat } from './sprites.js';

const MOODS = [
  ['#bfe0ee', '#f6e4d6'],
  ['#f3c9a8', '#efe0d8'],
  ['#8c9cc6', '#d9d3ee'],
  ['#3d3a78', '#7a5a92'],
  ['#d6e3f5', '#eef2fb'],
];

/**
 * A data URL picture of a cat for memory number `index` (0-4). Each index has its own mood:
 * morning, sunset, dusk, night with the lantern lit, and snow.
 * @param {{ id: string, coat: any }} cat
 * @param {number} index
 */
export function memoryIllustration(cat, index) {
  const mood = index % 5;
  const { canvas, ctx } = makeCanvas(120, 54);
  const sky = ctx.createLinearGradient(0, 0, 0, 54);
  sky.addColorStop(0, MOODS[mood][0]);
  sky.addColorStop(1, MOODS[mood][1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 120, 54);
  ctx.fillStyle = mood === 4 ? '#f4f6fc' : '#a9cfa0';
  for (let x = 0; x < 120; x++) ctx.fillRect(x, 38 + Math.sin(x * 0.05 + index) * 5, 1, 20);
  rect(ctx, 84, 18, 6, 20, '#c9c3d6');
  rect(ctx, 82, 12, 10, 6, mood === 3 ? '#ffe9a2' : '#8a8fae');
  if (mood === 3) ellipse(ctx, 87, 15, 10, 10, 'rgba(255,226,150,.35)');
  if (mood === 2) [10, 30, 60].forEach((x) => rect(ctx, x, 6 + (x % 9), 2, 2, '#fff'));
  if (mood === 4) for (let k = 0; k < 30; k++) rect(ctx, rand(120), rand(50), 1, 1, '#fff');
  drawCat(ctx, cat, index % 2 ? 'loaf' : 'sit', 38, 46, { time: index });
  // Ragged paper edge, like a watercolour that ran out at the border.
  for (let y = 0; y < 54; y++) {
    for (let x = 0; x < 120; x++) {
      const nearEdge = x < 8 || y < 4 || x > 110 || y > 48;
      if (nearEdge && fractalNoise(x * 0.05 + index, y * 0.05 + cat.id.length) > 0.66) {
        rect(ctx, x, y, 1, 1, '#fbf6ee');
      }
    }
  }
  const big = makeCanvas(360, 162);
  big.ctx.drawImage(canvas, 0, 0, 360, 162);
  return big.canvas.toDataURL();
}
