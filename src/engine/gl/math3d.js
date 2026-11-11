/**
 * 3D maths for the renderer: 4x4 matrices (column-major, like WebGL) and small vector helpers.
 * Pure functions, unit-tested in tests/unit/math3d.test.js.
 */

/** @typedef {Float32Array} Mat4 */
/** @typedef {[number, number, number]} Vec3 */

/** @returns {Mat4} */
export function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a × b (apply b first, then a). @param {Mat4} a @param {Mat4} b @returns {Mat4} */
export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** A perspective projection. `fovY` in radians. */
export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

/** A view matrix looking from `eye` towards `target`. @param {Vec3} eye @param {Vec3} target */
export function mat4LookAt(eye, target, up = /** @type {Vec3} */ ([0, 1, 0])) {
  const z = vec3Normalize(vec3Subtract(eye, target));
  const x = vec3Normalize(vec3Cross(up, z));
  const y = vec3Cross(z, x);
  const m = mat4Identity();
  m[0] = x[0];
  m[4] = x[1];
  m[8] = x[2];
  m[1] = y[0];
  m[5] = y[1];
  m[9] = y[2];
  m[2] = z[0];
  m[6] = z[1];
  m[10] = z[2];
  m[12] = -vec3Dot(x, eye);
  m[13] = -vec3Dot(y, eye);
  m[14] = -vec3Dot(z, eye);
  return m;
}

/**
 * A transform from position, rotation (radians, applied Y then X then Z) and scale.
 * @param {{ x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number,
 *   sx?: number, sy?: number, sz?: number, s?: number }} t
 * @returns {Mat4}
 */
export function mat4Transform(t) {
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = t;
  const sx = (t.sx ?? 1) * s;
  const sy = (t.sy ?? 1) * s;
  const sz = (t.sz ?? 1) * s;
  const [cx, snx] = [Math.cos(rx), Math.sin(rx)];
  const [cy, sny] = [Math.cos(ry), Math.sin(ry)];
  const [cz, snz] = [Math.cos(rz), Math.sin(rz)];
  // R = Ry * Rx * Rz
  const r00 = cy * cz + sny * snx * snz;
  const r01 = -cy * snz + sny * snx * cz;
  const r02 = sny * cx;
  const r10 = cx * snz;
  const r11 = cx * cz;
  const r12 = -snx;
  const r20 = -sny * cz + cy * snx * snz;
  const r21 = sny * snz + cy * snx * cz;
  const r22 = cy * cx;
  const m = new Float32Array(16);
  m[0] = r00 * sx;
  m[1] = r10 * sx;
  m[2] = r20 * sx;
  m[4] = r01 * sy;
  m[5] = r11 * sy;
  m[6] = r21 * sy;
  m[8] = r02 * sz;
  m[9] = r12 * sz;
  m[10] = r22 * sz;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  m[15] = 1;
  return m;
}

/** Chains transforms: `mat4Chain(parent, child, grandchild)`. */
export function mat4Chain(...matrices) {
  return matrices.reduce((acc, m) => mat4Multiply(acc, m));
}

/** Transforms a point (w = 1), returning x, y, z after the perspective divide. @returns {Vec3} */
export function transformPoint(m, [x, y, z]) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

/** The clip-space w of a point: negative means it is behind the camera. */
export function clipW(m, [x, y, z]) {
  return m[3] * x + m[7] * y + m[11] * z + m[15];
}

/** Transforms a direction (w = 0) without normalising. @returns {Vec3} */
export function transformDirection(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
}

/** The inverse-transpose of the upper 3x3, used to transform normals. @returns {Float32Array} */
export function normalMatrix(m) {
  const [a, b, c, d, e, f, g, h, i] = [
    m[0],
    m[1],
    m[2],
    m[4],
    m[5],
    m[6],
    m[8],
    m[9],
    m[10],
  ];
  const det =
    a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e) || 1;
  // inverse of [[a d g][b e h][c f i]] (columns), then transposed
  return new Float32Array([
    (e * i - f * h) / det,
    (g * f - d * i) / det,
    (d * h - g * e) / det,
    (h * c - b * i) / det,
    (a * i - g * c) / det,
    (g * b - a * h) / det,
    (b * f - e * c) / det,
    (d * c - a * f) / det,
    (a * e - d * b) / det,
  ]);
}

/** Inverts a 4x4 matrix (for unprojecting clicks). @returns {Mat4 | null} */
export function mat4Invert(m) {
  const inv = new Float32Array(16);
  inv[0] =
    m[5] * m[10] * m[15] -
    m[5] * m[11] * m[14] -
    m[9] * m[6] * m[15] +
    m[9] * m[7] * m[14] +
    m[13] * m[6] * m[11] -
    m[13] * m[7] * m[10];
  inv[4] =
    -m[4] * m[10] * m[15] +
    m[4] * m[11] * m[14] +
    m[8] * m[6] * m[15] -
    m[8] * m[7] * m[14] -
    m[12] * m[6] * m[11] +
    m[12] * m[7] * m[10];
  inv[8] =
    m[4] * m[9] * m[15] -
    m[4] * m[11] * m[13] -
    m[8] * m[5] * m[15] +
    m[8] * m[7] * m[13] +
    m[12] * m[5] * m[11] -
    m[12] * m[7] * m[9];
  inv[12] =
    -m[4] * m[9] * m[14] +
    m[4] * m[10] * m[13] +
    m[8] * m[5] * m[14] -
    m[8] * m[6] * m[13] -
    m[12] * m[5] * m[10] +
    m[12] * m[6] * m[9];
  inv[1] =
    -m[1] * m[10] * m[15] +
    m[1] * m[11] * m[14] +
    m[9] * m[2] * m[15] -
    m[9] * m[3] * m[14] -
    m[13] * m[2] * m[11] +
    m[13] * m[3] * m[10];
  inv[5] =
    m[0] * m[10] * m[15] -
    m[0] * m[11] * m[14] -
    m[8] * m[2] * m[15] +
    m[8] * m[3] * m[14] +
    m[12] * m[2] * m[11] -
    m[12] * m[3] * m[10];
  inv[9] =
    -m[0] * m[9] * m[15] +
    m[0] * m[11] * m[13] +
    m[8] * m[1] * m[15] -
    m[8] * m[3] * m[13] -
    m[12] * m[1] * m[11] +
    m[12] * m[3] * m[9];
  inv[13] =
    m[0] * m[9] * m[14] -
    m[0] * m[10] * m[13] -
    m[8] * m[1] * m[14] +
    m[8] * m[2] * m[13] +
    m[12] * m[1] * m[10] -
    m[12] * m[2] * m[9];
  inv[2] =
    m[1] * m[6] * m[15] -
    m[1] * m[7] * m[14] -
    m[5] * m[2] * m[15] +
    m[5] * m[3] * m[14] +
    m[13] * m[2] * m[7] -
    m[13] * m[3] * m[6];
  inv[6] =
    -m[0] * m[6] * m[15] +
    m[0] * m[7] * m[14] +
    m[4] * m[2] * m[15] -
    m[4] * m[3] * m[14] -
    m[12] * m[2] * m[7] +
    m[12] * m[3] * m[6];
  inv[10] =
    m[0] * m[5] * m[15] -
    m[0] * m[7] * m[13] -
    m[4] * m[1] * m[15] +
    m[4] * m[3] * m[13] +
    m[12] * m[1] * m[7] -
    m[12] * m[3] * m[5];
  inv[14] =
    -m[0] * m[5] * m[14] +
    m[0] * m[6] * m[13] +
    m[4] * m[1] * m[14] -
    m[4] * m[2] * m[13] -
    m[12] * m[1] * m[6] +
    m[12] * m[2] * m[5];
  inv[3] =
    -m[1] * m[6] * m[11] +
    m[1] * m[7] * m[10] +
    m[5] * m[2] * m[11] -
    m[5] * m[3] * m[10] -
    m[9] * m[2] * m[7] +
    m[9] * m[3] * m[6];
  inv[7] =
    m[0] * m[6] * m[11] -
    m[0] * m[7] * m[10] -
    m[4] * m[2] * m[11] +
    m[4] * m[3] * m[10] +
    m[8] * m[2] * m[7] -
    m[8] * m[3] * m[6];
  inv[11] =
    -m[0] * m[5] * m[11] +
    m[0] * m[7] * m[9] +
    m[4] * m[1] * m[11] -
    m[4] * m[3] * m[9] -
    m[8] * m[1] * m[7] +
    m[8] * m[3] * m[5];
  inv[15] =
    m[0] * m[5] * m[10] -
    m[0] * m[6] * m[9] -
    m[4] * m[1] * m[10] +
    m[4] * m[2] * m[9] +
    m[8] * m[1] * m[6] -
    m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (!det) return null;
  for (let i = 0; i < 16; i++) inv[i] /= det;
  return inv;
}

/* ---------- Vectors ---------- */

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const vec3Subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {Vec3} a @param {Vec3} b */
export const vec3Dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const vec3Cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** @param {Vec3} a @returns {Vec3} */
export function vec3Normalize(a) {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}
/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const vec3Lerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
