/**
 * Canvas primitives. The game draws at 480x270 on a pixel canvas that is upscaled with
 * crisp pixels, plus a full-resolution overlay canvas for text.
 */
import { VIEW_WIDTH } from '../config.js';
import { clamp, lerp } from '../core/math.js';

/**
 * The two on-screen canvases. Filled in by initDisplay().
 * `scale` is overlay pixels per game pixel.
 */
export const display = {
  /** @type {CanvasRenderingContext2D} */ pixel: /** @type {any} */ (null),
  /** @type {CanvasRenderingContext2D} */ overlay: /** @type {any} */ (null),
  scale: 2,
};

/**
 * @param {HTMLCanvasElement} pixelCanvas
 * @param {HTMLCanvasElement} overlayCanvas
 */
export function initDisplay(pixelCanvas, overlayCanvas) {
  display.pixel = /** @type {CanvasRenderingContext2D} */ (pixelCanvas.getContext('2d'));
  display.pixel.imageSmoothingEnabled = false;
  display.overlay = /** @type {CanvasRenderingContext2D} */ (overlayCanvas.getContext('2d'));
}

/**
 * Sizes the stage to the largest 16:9 box that fits its container.
 * @param {HTMLElement} container
 * @param {HTMLElement} stage
 * @param {HTMLCanvasElement} overlayCanvas
 */
export function fitStage(container, stage, overlayCanvas) {
  const box = container.getBoundingClientRect();
  let width = box.width;
  let height = (width * 9) / 16;
  if (height > box.height) {
    height = box.height;
    width = (height * 16) / 9;
  }
  stage.style.width = `${Math.floor(width)}px`;
  stage.style.height = `${Math.floor(height)}px`;
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  overlayCanvas.width = Math.round(width * dpr);
  overlayCanvas.height = Math.round(height * dpr);
  display.scale = overlayCanvas.width / VIEW_WIDTH;
}

/**
 * An offscreen canvas with crisp pixels.
 * @param {number} width
 * @param {number} height
 */
export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** A filled rectangle snapped to whole pixels. */
export function rect(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

/** A filled pixel-art ellipse (drawn as horizontal spans, so edges stay crisp). */
export function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  for (let y = -ry; y <= ry; y++) {
    const halfWidth = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
    ctx.fillRect(cx - halfWidth, cy + y, halfWidth * 2 + 1, 1);
  }
}

/** '#rrggbb' to [r, g, b]. */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

/** Blends two '#rrggbb' colours. */
export function mixColor(a, b, t) {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return `#${from
    .map((v, i) =>
      Math.round(lerp(v, to[i], t))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/* ---------- Noise, for organic textures ---------- */

const NOISE_SIZE = 65536;
const noiseTable = new Float32Array(NOISE_SIZE).map(() => Math.random());

/** Smooth 2D value noise in [0, 1]. */
export function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (a, b) => noiseTable[(a * 57 + b * 131) & (NOISE_SIZE - 1)];
  return lerp(
    lerp(at(xi, yi), at(xi + 1, yi), sx),
    lerp(at(xi, yi + 1), at(xi + 1, yi + 1), sx),
    sy,
  );
}

/** Fractal noise: three octaves of value noise. */
export function fractalNoise(x, y) {
  return (
    valueNoise(x, y) * 0.6 +
    valueNoise(x * 2.1, y * 2.1) * 0.28 +
    valueNoise(x * 4.3, y * 4.3) * 0.12
  );
}

/* ---------- Pixel buffers, for per-pixel painting ---------- */

/** @typedef {{ width: number, height: number, data: Uint8ClampedArray }} PixelBuffer */

/** @returns {PixelBuffer} */
export function createPixelBuffer(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** @param {PixelBuffer} buffer @param {number[]} rgb */
export function setPixel(buffer, x, y, rgb) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return;
  const i = (y * buffer.width + x) * 4;
  buffer.data[i] = rgb[0];
  buffer.data[i + 1] = rgb[1];
  buffer.data[i + 2] = rgb[2];
  buffer.data[i + 3] = 255;
}

/** @param {PixelBuffer} buffer */
export function bufferToCanvas(buffer) {
  const { canvas, ctx } = makeCanvas(buffer.width, buffer.height);
  ctx.putImageData(new ImageData(buffer.data, buffer.width, buffer.height), 0, 0);
  return canvas;
}

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold for a pixel, in (0, 1). */
export function bayer(x, y) {
  return (BAYER_4X4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/**
 * Picks a colour from a ramp (dark to light) with soft dithering between steps.
 * @param {number[][]} ramp RGB colours.
 * @param {number} value 0 (darkest) to 1 (lightest).
 */
export function pickFromRamp(ramp, value, x, y) {
  const last = ramp.length - 1;
  const position = clamp(value) * last;
  const base = Math.floor(position);
  const step = position - base > 0.5 + (bayer(x, y) - 0.5) * 0.55 ? 1 : 0;
  return ramp[Math.min(last, base + step)];
}

/* ---------- Text on the overlay canvas ---------- */

/**
 * Draws crisp text at game coordinates on the high-resolution overlay.
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{ size?: number, align?: CanvasTextAlign, color?: string, shadow?: boolean, alpha?: number }} [options]
 */
export function drawText(text, x, y, options = {}) {
  const ctx = display.overlay;
  const s = display.scale;
  ctx.font = `${Math.round((options.size ?? 9) * s)}px "Pixelify Sans", ui-monospace, monospace`;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = options.alpha ?? 1;
  if (options.shadow !== false) {
    ctx.fillStyle = 'rgba(45,35,70,.8)';
    ctx.fillText(text, x * s + s * 0.5, y * s + s * 0.6);
  }
  ctx.fillStyle = options.color ?? '#fdf8ef';
  ctx.fillText(text, x * s, y * s);
  ctx.globalAlpha = 1;
}

/** A filled rectangle on the overlay canvas, in game coordinates. */
export function overlayRect(x, y, width, height, color) {
  const s = display.scale;
  display.overlay.fillStyle = color;
  display.overlay.fillRect(x * s, y * s, width * s, height * s);
}

/** Clears the overlay and the pixel HUD at the start of each frame. */
export function clearOverlay() {
  const canvas = display.overlay.canvas;
  display.overlay.clearRect(0, 0, canvas.width, canvas.height);
  display.pixel.clearRect(0, 0, display.pixel.canvas.width, display.pixel.canvas.height);
}
