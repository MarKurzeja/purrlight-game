/**
 * A small WebGL 2 renderer: uploads flat-shaded meshes, draws them with soft cel lighting and
 * fog under a procedural sky, plus particles. Also projects world points to the screen (for
 * labels and clicks) and renders offscreen snapshots (for menu portraits).
 */
import {
  clipW,
  mat4Invert,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  normalMatrix,
  transformPoint,
  vec3Normalize,
  vec3Subtract,
} from "./math3d.js";
import {
  LIT_FRAGMENT,
  LIT_VERTEX,
  POINT_FRAGMENT,
  POINT_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
} from "./shaders.js";

/**
 * @typedef {import('./math3d.js').Vec3} Vec3
 * @typedef {import('./math3d.js').Mat4} Mat4
 * @typedef {{ vao: WebGLVertexArrayObject, buffers: WebGLBuffer[], count: number }} GpuMesh
 * @typedef {{ eye: Vec3, target: Vec3, fov?: number, near?: number, far?: number }} Camera
 * @typedef {{ sunDir: Vec3, sunColor: Vec3, sky: Vec3, ground: Vec3, fog: Vec3, fogNear: number,
 *   fogFar: number, skyTop: Vec3, skyHorizon: Vec3, skyBottom: Vec3, sunGlow: Vec3, stars: number }} Lighting
 * @typedef {{ tint?: number[], emissive?: Vec3, shine?: number, wave?: number, unlit?: boolean,
 *   transparent?: boolean }} DrawOptions
 * @typedef {{ x: number, y: number, z: number, size: number, color: number[] }} Point
 */

function compile(gl, type, source) {
  const shader = /** @type {WebGLShader} */ (gl.createShader(type));
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader error");
  }
  return shader;
}

function program(gl, vertex, fragment) {
  const p = /** @type {WebGLProgram} */ (gl.createProgram());
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "link error");
  }
  /** @type {Record<string, WebGLUniformLocation | null>} */
  const uniforms = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(p, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  return {
    program: p,
    uniforms,
    position: gl.getAttribLocation(p, "aPosition"),
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const context = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  if (!context) throw new Error("WebGL 2 is not available");
  /** @type {WebGL2RenderingContext} */
  const gl = context;
  const lit = program(gl, LIT_VERTEX, LIT_FRAGMENT);
  const sky = program(gl, SKY_VERTEX, SKY_FRAGMENT);
  const points = program(gl, POINT_VERTEX, POINT_FRAGMENT);

  const skyVao = gl.createVertexArray();
  gl.bindVertexArray(skyVao);
  const skyBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const corner = gl.getAttribLocation(sky.program, "aCorner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const pointVao = gl.createVertexArray();
  const pointBuffer = gl.createBuffer();
  gl.bindVertexArray(pointVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  const stride = 8 * 4;
  const attrib = (name, size, offset) => {
    const loc = gl.getAttribLocation(points.program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  };
  attrib("aPosition", 3, 0);
  attrib("aColor", 4, 12);
  attrib("aSize", 1, 28);
  gl.bindVertexArray(null);

  const state = {
    viewProj: /** @type {Mat4} */ (new Float32Array(16)),
    inverseViewProj: /** @type {Mat4} */ (new Float32Array(16)),
    /** @type {Camera} */ camera: { eye: [0, 5, 10], target: [0, 0, 0] },
    /** @type {Lighting | null} */ lighting: null,
    time: 0,
    width: canvas.width,
    height: canvas.height,
    /** @type {{ mesh: GpuMesh, model: Mat4, options: DrawOptions, depth: number }[]} */
    transparent: [],
  };

  /** @param {import('./geometry.js').MeshData} data @returns {GpuMesh} */
  function upload(data) {
    const vao = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    gl.bindVertexArray(vao);
    const buffers = [];
    for (const [name, array] of /** @type {[string, Float32Array][]} */ ([
      ["aPosition", data.positions],
      ["aNormal", data.normals],
      ["aColor", data.colors],
    ])) {
      const buffer = /** @type {WebGLBuffer} */ (gl.createBuffer());
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(lit.program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      buffers.push(buffer);
    }
    gl.bindVertexArray(null);
    return { vao, buffers, count: data.count };
  }

  /** @param {GpuMesh | null | undefined} mesh */
  function release(mesh) {
    if (!mesh) return;
    for (const b of mesh.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(mesh.vao);
  }

  /** @param {Camera} camera */
  function setCamera(camera, aspect = state.width / state.height) {
    state.camera = camera;
    const projection = mat4Perspective(
      ((camera.fov ?? 38) * Math.PI) / 180,
      aspect,
      camera.near ?? 0.3,
      camera.far ?? 400,
    );
    state.viewProj = mat4Multiply(
      projection,
      mat4LookAt(camera.eye, camera.target),
    );
    state.inverseViewProj = mat4Invert(state.viewProj) ?? state.viewProj;
  }

  /** @param {Lighting} lighting */
  function setLighting(lighting) {
    state.lighting = lighting;
  }

  function useLit() {
    const L = /** @type {Lighting} */ (state.lighting);
    const u = lit.uniforms;
    gl.useProgram(lit.program);
    gl.uniformMatrix4fv(u.uViewProj, false, state.viewProj);
    gl.uniform3fv(u.uSunDir, vec3Normalize(L.sunDir));
    gl.uniform3fv(u.uSunColor, L.sunColor);
    gl.uniform3fv(u.uSkyColor, L.sky);
    gl.uniform3fv(u.uGroundColor, L.ground);
    gl.uniform3fv(u.uFogColor, L.fog);
    gl.uniform1f(u.uFogNear, L.fogNear);
    gl.uniform1f(u.uFogFar, L.fogFar);
    gl.uniform3fv(u.uCameraPos, state.camera.eye);
    gl.uniform1f(u.uTime, state.time);
  }

  /**
   * Clears the frame and draws the sky.
   * @param {{ sky?: boolean, clearColor?: number[] }} [options]
   */
  function beginFrame({ sky: drawSky = true, clearColor = [0, 0, 0, 1] } = {}) {
    gl.viewport(0, 0, state.width, state.height);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    state.transparent = [];
    const L = state.lighting;
    if (drawSky && L) {
      gl.useProgram(sky.program);
      const u = sky.uniforms;
      gl.uniformMatrix4fv(u.uInverseViewProj, false, state.inverseViewProj);
      gl.uniform3fv(u.uCameraPos, state.camera.eye);
      gl.uniform3fv(u.uTop, L.skyTop);
      gl.uniform3fv(u.uHorizon, L.skyHorizon);
      gl.uniform3fv(u.uBottom, L.skyBottom);
      gl.uniform3fv(u.uSunDir, vec3Normalize(L.sunDir));
      gl.uniform3fv(u.uSunGlow, L.sunGlow);
      gl.uniform1f(u.uStars, L.stars);
      gl.depthMask(false);
      gl.bindVertexArray(skyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
    }
    useLit();
  }

  /** @param {GpuMesh} mesh @param {Mat4} model @param {DrawOptions} options */
  function drawNow(mesh, model, options) {
    const u = lit.uniforms;
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniformMatrix3fv(u.uNormalMatrix, false, normalMatrix(model));
    gl.uniform4fv(u.uTint, options.tint ?? [1, 1, 1, 1]);
    gl.uniform3fv(u.uEmissive, options.emissive ?? [0, 0, 0]);
    gl.uniform1f(u.uShine, options.shine ?? 0);
    gl.uniform1f(u.uWave, options.wave ?? 0);
    gl.uniform1f(u.uUnlit, options.unlit ? 1 : 0);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  /**
   * Draws a mesh. Transparent meshes are queued and drawn back to front at the end of the frame.
   * @param {GpuMesh} mesh @param {Mat4} model @param {DrawOptions} [options]
   */
  function draw(mesh, model, options = {}) {
    if (options.transparent) {
      const at = [model[12], model[13], model[14]];
      const depth = Math.hypot(
        at[0] - state.camera.eye[0],
        at[1] - state.camera.eye[1],
        at[2] - state.camera.eye[2],
      );
      state.transparent.push({ mesh, model, options, depth });
      return;
    }
    drawNow(mesh, model, options);
  }

  /** Draws square particles. @param {Point[]} list */
  function drawPoints(list) {
    if (!list.length) return;
    const data = new Float32Array(list.length * 8);
    list.forEach((p, i) =>
      data.set(
        [
          p.x,
          p.y,
          p.z,
          p.color[0],
          p.color[1],
          p.color[2],
          p.color[3] ?? 1,
          p.size,
        ],
        i * 8,
      ),
    );
    gl.useProgram(points.program);
    gl.uniformMatrix4fv(points.uniforms.uViewProj, false, state.viewProj);
    // Point sizes are in metres: convert to pixels at distance w (see POINT_VERTEX).
    const fov = ((state.camera.fov ?? 38) * Math.PI) / 180;
    gl.uniform1f(
      points.uniforms.uPixelScale,
      state.height / (2 * Math.tan(fov / 2)),
    );
    gl.bindVertexArray(pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, list.length);
    gl.depthMask(true);
    useLit();
  }

  /** Draws the queued transparent meshes, then any particles. @param {Point[]} [particles] */
  function endFrame(particles = []) {
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    state.transparent.sort((a, b) => b.depth - a.depth);
    for (const item of state.transparent) {
      if (item.options.unlit && item.options.emissive)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawNow(item.mesh, item.model, item.options);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    drawPoints(particles);
  }

  /**
   * Where a world point appears on screen, as 0-1 fractions from the top-left.
   * @param {Vec3} point
   */
  function project(point) {
    const [x, y] = transformPoint(state.viewProj, point);
    return {
      x: (x + 1) / 2,
      y: (1 - y) / 2,
      visible: clipW(state.viewProj, point) > 0,
    };
  }

  /**
   * The ray under a screen point (0-1 fractions from the top-left).
   * @returns {{ origin: Vec3, direction: Vec3 }}
   */
  function unproject(sx, sy) {
    const ndc = [sx * 2 - 1, 1 - sy * 2];
    const nearPoint = transformPoint(state.inverseViewProj, [
      ndc[0],
      ndc[1],
      -1,
    ]);
    const farPoint = transformPoint(state.inverseViewProj, [ndc[0], ndc[1], 1]);
    return {
      origin: nearPoint,
      direction: vec3Normalize(vec3Subtract(farPoint, nearPoint)),
    };
  }

  /** Changes the internal render resolution. */
  function resize(width, height) {
    canvas.width = state.width = width;
    canvas.height = state.height = height;
  }

  /**
   * Renders `drawScene` into an offscreen image (transparent background) and returns a data URL.
   * @param {number} width @param {number} height
   * @param {Camera} camera
   * @param {() => void} drawScene Calls draw() for each mesh.
   */
  function snapshot(width, height, camera, drawScene) {
    const framebuffer = gl.createFramebuffer();
    const color = gl.createTexture();
    const depth = gl.createRenderbuffer();
    gl.bindTexture(gl.TEXTURE_2D, color);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      width,
      height,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      color,
      0,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depth,
    );

    const saved = {
      camera: state.camera,
      width: state.width,
      height: state.height,
      viewProj: state.viewProj,
      inverse: state.inverseViewProj,
    };
    state.width = width;
    state.height = height;
    setCamera(camera, width / height);
    beginFrame({ sky: false, clearColor: [0, 0, 0, 0] });
    drawScene();
    endFrame();
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(color);
    gl.deleteRenderbuffer(depth);
    Object.assign(state, {
      camera: saved.camera,
      width: saved.width,
      height: saved.height,
      viewProj: saved.viewProj,
      inverseViewProj: saved.inverse,
    });

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = /** @type {CanvasRenderingContext2D} */ (out.getContext("2d"));
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      image.data.set(
        pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
        y * width * 4,
      );
    }
    ctx.putImageData(image, 0, 0);
    return out.toDataURL();
  }

  return {
    gl,
    upload,
    release,
    setCamera,
    setLighting,
    beginFrame,
    draw,
    endFrame,
    project,
    unproject,
    resize,
    snapshot,
    /** @param {number} t seconds, for animated water */
    setTime: (t) => (state.time = t),
    get width() {
      return state.width;
    },
    get height() {
      return state.height;
    },
    get camera() {
      return state.camera;
    },
  };
}

/** @typedef {ReturnType<typeof createRenderer>} Renderer */
