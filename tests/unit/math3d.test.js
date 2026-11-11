import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mat4Identity,
  mat4Invert,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  mat4Transform,
  normalMatrix,
  transformPoint,
} from "../../src/engine/gl/math3d.js";
import { MeshBuilder, hexToVec3 } from "../../src/engine/gl/geometry.js";

const near = (a, b, eps = 1e-5) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test("the identity matrix leaves points alone", () => {
  assert.ok(near(transformPoint(mat4Identity(), [1, 2, 3]), [1, 2, 3]));
});

test("transforms translate, scale and rotate in a right-handed space", () => {
  assert.ok(
    near(
      transformPoint(mat4Transform({ x: 1, y: 2, z: 3 }), [0, 0, 0]),
      [1, 2, 3],
    ),
  );
  assert.ok(
    near(transformPoint(mat4Transform({ s: 2 }), [1, 1, 1]), [2, 2, 2]),
  );
  assert.ok(
    near(
      transformPoint(mat4Transform({ ry: Math.PI / 2 }), [1, 0, 0]),
      [0, 0, -1],
    ),
  );
  assert.ok(
    near(
      transformPoint(mat4Transform({ rx: Math.PI / 2 }), [0, 1, 0]),
      [0, 0, 1],
    ),
  );
});

test("multiplying applies the right-hand matrix first", () => {
  const move = mat4Transform({ x: 10 });
  const grow = mat4Transform({ s: 2 });
  assert.ok(
    near(transformPoint(mat4Multiply(move, grow), [1, 0, 0]), [12, 0, 0]),
  );
  assert.ok(
    near(transformPoint(mat4Multiply(grow, move), [1, 0, 0]), [22, 0, 0]),
  );
});

test("a camera puts what it looks at in the middle of the screen", () => {
  const view = mat4LookAt([0, 5, 10], [0, 0, 0]);
  const projection = mat4Perspective(Math.PI / 4, 16 / 9, 0.1, 100);
  const [x, y, z] = transformPoint(mat4Multiply(projection, view), [0, 0, 0]);
  assert.ok(Math.abs(x) < 1e-5 && Math.abs(y) < 1e-5);
  assert.ok(z > -1 && z < 1, "inside the depth range");
});

test("inverting a matrix undoes it", () => {
  const m = mat4Transform({ x: 3, y: -2, z: 5, ry: 0.7, rx: 0.3, s: 1.5 });
  const back = mat4Multiply(/** @type {Float32Array} */ (mat4Invert(m)), m);
  assert.ok(near(Array.from(back), Array.from(mat4Identity()), 1e-4));
});

test("normals stay perpendicular under non-uniform scale", () => {
  const nm = normalMatrix(mat4Transform({ sx: 4, sy: 1, sz: 1 }));
  // A 45-degree surface normal (1,1,0) squashed in x tilts towards y.
  const n = [nm[0] + nm[3], nm[1] + nm[4], 0];
  assert.ok(n[1] > n[0]);
});

test("a box has 12 triangles with unit normals pointing outwards", () => {
  const mesh = new MeshBuilder().box(mat4Identity(), "#ffffff").build();
  assert.equal(mesh.count, 36);
  for (let i = 0; i < mesh.count; i++) {
    const n = [
      mesh.normals[i * 3],
      mesh.normals[i * 3 + 1],
      mesh.normals[i * 3 + 2],
    ];
    const p = [
      mesh.positions[i * 3],
      mesh.positions[i * 3 + 1],
      mesh.positions[i * 3 + 2],
    ];
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5);
    assert.ok(
      n[0] * p[0] + n[1] * p[1] + n[2] * p[2] > 0,
      "normal faces away from the centre",
    );
  }
});

test("spheres, cylinders and gables face outwards too", () => {
  const check = (mesh, centre) => {
    for (let i = 0; i < mesh.count; i += 3) {
      const c = [0, 1, 2].map(
        (k) =>
          (mesh.positions[i * 3 + k] +
            mesh.positions[i * 3 + 3 + k] +
            mesh.positions[i * 3 + 6 + k]) /
          3,
      );
      const n = [
        mesh.normals[i * 3],
        mesh.normals[i * 3 + 1],
        mesh.normals[i * 3 + 2],
      ];
      const out = c.map((v, k) => v - centre[k]);
      assert.ok(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] > -1e-6);
    }
  };
  check(new MeshBuilder().sphere(mat4Identity(), "#fff").build(), [0, 0, 0]);
  check(
    new MeshBuilder().cylinder(mat4Identity(), "#fff").build(),
    [0, 0.5, 0],
  );
  check(
    new MeshBuilder().gable(mat4Identity(), "#fff", "#fff").build(),
    [0, 0.3, 0],
  );
});

test("terrain follows its height function and faces up", () => {
  const mesh = new MeshBuilder()
    .terrain(
      0,
      10,
      0,
      10,
      5,
      5,
      (x) => x * 0.1,
      () => "#00ff00",
    )
    .build();
  assert.equal(mesh.count, 5 * 5 * 6);
  for (let i = 0; i < mesh.count; i++) assert.ok(mesh.normals[i * 3 + 1] > 0.9);
  assert.deepEqual(hexToVec3("#00ff00"), [0, 1, 0]);
});
