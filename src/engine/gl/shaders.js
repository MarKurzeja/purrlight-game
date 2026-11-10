/** GLSL ES 3.0 shaders for the renderer. */

/** Lit, flat-shaded meshes with soft cel lighting, fog, optional water waves and shine. */
export const LIT_VERTEX = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec3 aColor;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
uniform float uTime;
uniform float uWave;
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vec3 normal = uNormalMatrix * aNormal;
  if (uWave > 0.0) {
    float a = world.x * 1.3 + uTime * 1.5;
    float b = world.z * 1.7 + uTime * 1.1;
    world.y += (sin(a) + cos(b)) * 0.035 * uWave;
    normal = normalize(vec3(-cos(a) * 0.08 * uWave, 1.0, sin(b) * 0.1 * uWave));
  }
  vColor = aColor;
  vNormal = normal;
  vWorld = world.xyz;
  gl_Position = uViewProj * world;
}`;

export const LIT_FRAGMENT = `#version 300 es
precision mediump float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform vec3 uCameraPos;
uniform vec3 uEmissive;
uniform vec4 uTint;
uniform float uFogNear;
uniform float uFogFar;
uniform float uShine;
uniform float uUnlit;
out vec4 outColor;
void main() {
  vec3 albedo = vColor * uTint.rgb;
  if (uUnlit > 0.5) {
    outColor = vec4(albedo + uEmissive, uTint.a);
    return;
  }
  vec3 n = normalize(vNormal);
  float ndl = dot(n, uSunDir);
  // Two soft bands of light: a gentle, painted cel look.
  float light = smoothstep(-0.05, 0.12, ndl) * 0.55 + smoothstep(0.35, 0.5, ndl) * 0.45;
  vec3 ambient = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
  vec3 color = albedo * (ambient + uSunColor * light) + uEmissive;
  if (uShine > 0.0) {
    vec3 toEye = normalize(uCameraPos - vWorld);
    vec3 halfway = normalize(toEye + uSunDir);
    color += uSunColor * pow(max(dot(n, halfway), 0.0), 48.0) * uShine;
    float fresnel = pow(1.0 - max(dot(n, toEye), 0.0), 3.0);
    color = mix(color, uSkyColor * 1.15, fresnel * 0.55 * uShine);
  }
  float fog = smoothstep(uFogNear, uFogFar, distance(vWorld, uCameraPos));
  outColor = vec4(mix(color, uFogColor, fog), uTint.a);
}`;

/** Full-screen sky: gradient, sun, moon and stars, computed per pixel from the view ray. */
export const SKY_VERTEX = `#version 300 es
in vec2 aCorner;
out vec2 vCorner;
void main() {
  vCorner = aCorner;
  gl_Position = vec4(aCorner, 0.9999, 1.0);
}`;

export const SKY_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vCorner;
uniform mat4 uInverseViewProj;
uniform vec3 uCameraPos;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunGlow;
uniform float uStars;
out vec4 outColor;
void main() {
  vec4 far = uInverseViewProj * vec4(vCorner, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - uCameraPos);
  float h = dir.y;
  vec3 color = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.55)) : mix(uHorizon, uBottom, min(-h * 4.0, 1.0));
  float toSun = dot(dir, uSunDir);
  color += uSunGlow * (smoothstep(0.9990, 0.9994, toSun) * 1.5 + pow(max(toSun, 0.0), 40.0) * 0.35);
  if (uStars > 0.0 && h > 0.02) {
    vec3 cell = floor(dir * 220.0);
    float r = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    color += uStars * step(0.9965, r) * vec3(0.9, 0.92, 1.0);
    float toMoon = dot(dir, normalize(vec3(-0.4, 0.55, -0.73)));
    color = mix(color, vec3(0.97, 0.95, 0.86), uStars * smoothstep(0.9986, 0.999, toMoon));
  }
  outColor = vec4(color, 1.0);
}`;

/** Round particles sized in metres (smoke, spray, fireflies). */
export const POINT_VERTEX = `#version 300 es
in vec3 aPosition;
in vec4 aColor;
in float aSize;
uniform mat4 uViewProj;
uniform float uPixelScale;
out vec4 vColor;
void main() {
  gl_Position = uViewProj * vec4(aPosition, 1.0);
  gl_PointSize = max(1.0, aSize * uPixelScale / gl_Position.w);
  vColor = aColor;
}`;

export const POINT_FRAGMENT = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  outColor = vColor;
}`;
