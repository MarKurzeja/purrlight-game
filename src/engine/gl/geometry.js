/**
 * Builds low-poly, flat-shaded meshes on the CPU: every triangle gets its own face normal and a
 * vertex colour, which gives the faceted, painted look without textures.
 * Pure (no WebGL), so it can be unit-tested.
 */
import {
  normalMatrix,
  transformDirection,
  transformPoint,
  vec3Cross,
  vec3Normalize,
  vec3Subtract,
} from './math3d.js';

/** @typedef {import('./math3d.js').Vec3} Vec3 */
/** @typedef {import('./math3d.js').Mat4} Mat4 */
/** @typedef {{ positions: Float32Array, normals: Float32Array, colors: Float32Array, count: number }} MeshData */

/** '#rrggbb' to [r, g, b] in 0-1. @returns {Vec3} */
export function hexToVec3(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** @param {string | Vec3} color */
const toColor = (color) => (typeof color === 'string' ? hexToVec3(color) : color);

export class MeshBuilder {
  constructor() {
    /** @type {number[]} */ this.positions = [];
    /** @type {number[]} */ this.normals = [];
    /** @type {number[]} */ this.colors = [];
  }

  /** Adds one triangle (counter-clockwise when seen from the front). */
  triangle(a, b, c, color) {
    const normal = vec3Normalize(vec3Cross(vec3Subtract(b, a), vec3Subtract(c, a)));
    const rgb = toColor(color);
    for (const p of [a, b, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(rgb[0], rgb[1], rgb[2]);
    }
    return this;
  }

  /** Adds a quad a-b-c-d (counter-clockwise). */
  quad(a, b, c, d, color) {
    return this.triangle(a, b, c, color).triangle(a, c, d, color);
  }

  /**
   * Runs `draw` on a scratch builder and appends its triangles transformed by `matrix`.
   * @param {Mat4} matrix
   * @param {(b: MeshBuilder) => void} draw
   */
  transformed(matrix, draw) {
    const local = new MeshBuilder();
    draw(local);
    const nm = normalMatrix(matrix);
    const asMat4 = new Float32Array([
      nm[0],
      nm[1],
      nm[2],
      0,
      nm[3],
      nm[4],
      nm[5],
      0,
      nm[6],
      nm[7],
      nm[8],
      0,
      0,
      0,
      0,
      1,
    ]);
    for (let i = 0; i < local.positions.length; i += 3) {
      const p = transformPoint(matrix, [
        local.positions[i],
        local.positions[i + 1],
        local.positions[i + 2],
      ]);
      const n = vec3Normalize(
        transformDirection(asMat4, [local.normals[i], local.normals[i + 1], local.normals[i + 2]]),
      );
      this.positions.push(...p);
      this.normals.push(...n);
      this.colors.push(local.colors[i], local.colors[i + 1], local.colors[i + 2]);
    }
    return this;
  }

  /**
   * A unit box centred on the origin (size 1), optionally transformed.
   * `colors` is one colour or { top, bottom, side } / per-face.
   */
  box(matrix, colors) {
    const c =
      typeof colors === 'object' && !Array.isArray(colors)
        ? colors
        : { top: colors, bottom: colors, side: colors };
    const side = c.side ?? c.top;
    return this.transformed(matrix, (b) => {
      const h = 0.5;
      const v = (x, y, z) => /** @type {Vec3} */ ([x * h, y * h, z * h]);
      b.quad(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), c.top); // top
      b.quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), c.bottom ?? side); // bottom
      b.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), c.front ?? side); // front (+z)
      b.quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), c.back ?? side); // back
      b.quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), c.right ?? side); // right
      b.quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), c.left ?? side); // left
    });
  }

  /**
   * A cylinder or cone along +y from 0 to 1, radius 1 at the bottom and `topRadius` at the top.
   * @param {Mat4} matrix
   */
  cylinder(matrix, color, { segments = 8, topRadius = 1, capColor = color, caps = true } = {}) {
    return this.transformed(matrix, (b) => {
      const ring = (radius, y) =>
        Array.from({ length: segments }, (_, i) => {
          const a = (i / segments) * Math.PI * 2;
          return /** @type {Vec3} */ ([Math.cos(a) * radius, y, Math.sin(a) * radius]);
        });
      const bottom = ring(1, 0);
      const top = ring(topRadius, 1);
      for (let i = 0; i < segments; i++) {
        const j = (i + 1) % segments;
        if (topRadius > 0) b.quad(bottom[j], bottom[i], top[i], top[j], color);
        else b.triangle(bottom[j], bottom[i], [0, 1, 0], color);
        if (caps) {
          b.triangle([0, 0, 0], bottom[i], bottom[j], capColor);
          if (topRadius > 0) b.triangle([0, 1, 0], top[j], top[i], capColor);
        }
      }
    });
  }

  /** A cone along +y (height 1, radius 1). */
  cone(matrix, color, segments = 8) {
    return this.cylinder(matrix, color, { segments, topRadius: 0 });
  }

  /**
   * A low-poly sphere of radius 1. `colorAt(normal)` may vary the colour per face.
   * @param {Mat4} matrix
   * @param {string | Vec3 | ((n: Vec3) => string | Vec3)} color
   */
  sphere(matrix, color, { segments = 8, rings = 6 } = {}) {
    return this.transformed(matrix, (b) => {
      const point = (ring, seg) => {
        const theta = (ring / rings) * Math.PI;
        const phi = (seg / segments) * Math.PI * 2;
        return /** @type {Vec3} */ ([
          Math.sin(theta) * Math.cos(phi),
          Math.cos(theta),
          Math.sin(theta) * Math.sin(phi),
        ]);
      };
      const pick = (a, c) =>
        typeof color === 'function'
          ? color(vec3Normalize([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2]))
          : color;
      for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segments; s++) {
          const a = point(r, s);
          const bb = point(r + 1, s);
          const c = point(r + 1, s + 1);
          const d = point(r, s + 1);
          if (r === 0) b.triangle(a, c, bb, pick(a, c));
          else if (r === rings - 1) b.triangle(a, d, bb, pick(a, bb));
          else b.quad(a, d, c, bb, pick(a, c));
        }
      }
    });
  }

  /**
   * A gable roof: a triangular prism along x, width 1 (x), depth 1 (z), height 1 (y),
   * sitting on y = 0.
   */
  gable(matrix, roofColor, wallColor) {
    return this.transformed(matrix, (b) => {
      const h = 0.5;
      b.quad([-h, 0, h], [h, 0, h], [h, 1, 0], [-h, 1, 0], roofColor); // front slope
      b.quad([h, 0, -h], [-h, 0, -h], [-h, 1, 0], [h, 1, 0], roofColor); // back slope
      b.triangle([h, 0, h], [h, 0, -h], [h, 1, 0], wallColor); // gable ends
      b.triangle([-h, 0, -h], [-h, 0, h], [-h, 1, 0], wallColor);
    });
  }

  /**
   * A grid of quads over x in [x0, x1], z in [z0, z1], with heights and colours from callbacks.
   * @param {(x: number, z: number) => number} heightAt
   * @param {(x: number, y: number, z: number, normal: Vec3) => string | Vec3} colorAt
   */
  terrain(x0, x1, z0, z1, cellsX, cellsZ, heightAt, colorAt) {
    const dx = (x1 - x0) / cellsX;
    const dz = (z1 - z0) / cellsZ;
    const p = (i, j) => {
      const x = x0 + i * dx;
      const z = z0 + j * dz;
      return /** @type {Vec3} */ ([x, heightAt(x, z), z]);
    };
    for (let i = 0; i < cellsX; i++) {
      for (let j = 0; j < cellsZ; j++) {
        const a = p(i, j);
        const b = p(i, j + 1);
        const c = p(i + 1, j + 1);
        const d = p(i + 1, j);
        for (const tri of (i + j) % 2
          ? [
              [a, b, c],
              [a, c, d],
            ]
          : [
              [a, b, d],
              [b, c, d],
            ]) {
          const n = vec3Normalize(
            vec3Cross(vec3Subtract(tri[1], tri[0]), vec3Subtract(tri[2], tri[0])),
          );
          const centre = [
            (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
            (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
            (tri[0][2] + tri[1][2] + tri[2][2]) / 3,
          ];
          this.triangle(tri[0], tri[1], tri[2], colorAt(centre[0], centre[1], centre[2], n));
        }
      }
    }
    return this;
  }

  /** @returns {MeshData} */
  build() {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      count: this.positions.length / 3,
    };
  }
}
