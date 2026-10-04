/**
 * Stage 3 backdrop: nine glowing sine ribbons that undulate on a dark canvas.
 *
 * Scroll velocity feeds amplitude and frequency. The cursor warps the
 * trajectories locally, so the lines bow away from the pointer instead of
 * just sliding past it.
 *
 * Drawn as a clip-space quad so it fills the viewport whatever the camera
 * is doing, then composited additively over the scene background.
 */

export const waveRibbonsVertex = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  // the plane is 2x2, so position.xy is already clip space
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const waveRibbonsFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uEnergy;    // 0..1 smoothed scroll speed
uniform float uScroll;    // 0..1 progress through the stage
uniform float uOpacity;   // stage fade in / out
uniform float uAspect;
uniform vec2  uPointer;   // -1..1
uniform vec3  uColA;
uniform vec3  uColB;

varying vec2 vUv;

const int RIBBONS = 7;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);

  vec2 ptr = vec2(uPointer.x * uAspect * 0.5, uPointer.y * 0.5);
  float pd = distance(p, ptr);
  float influence = 1.0 - smoothstep(0.0, 0.6, pd);
  float warp = influence * (0.13 + uEnergy * 0.2);

  float amp = 1.0 + uEnergy * 1.9;
  float freqBoost = 1.0 + uEnergy * 0.5;

  vec3 glow = vec3(0.0);
  float core = 0.0;

  for (int i = 0; i < RIBBONS; i++) {
    float fi = float(i);

    float baseY = -0.42 + fi * 0.14;
    float freq = (2.1 + fi * 1.3) * freqBoost;
    float speed = 0.34 + fi * 0.12;
    float phase = fi * 1.37 + uTime * speed;
    float a = (0.05 + fi * 0.011) * amp;

    // three harmonics keep it organic rather than machine-regular
    float y = baseY;
    y += sin(p.x * freq + phase) * a;
    y += sin(p.x * freq * 1.87 - phase * 0.61 + fi) * a * 0.34;
    y += sin(p.x * freq * 0.53 + phase * 0.31) * a * 0.52;

    // the cursor bends the ribbon near the pointer
    y += warp * sin((p.x - ptr.x) * 3.2 + uTime * 0.8 + fi) * 0.5;

    float d = abs(p.y - y);
    float thick = 0.006 + 0.0012 * fi;
    float line = thick / (d + thick);
    // the halo falls off fast, otherwise seven of them stack into a whiteout
    float halo = 0.1 / (d * d * 90.0 + 0.6);

    vec3 col = mix(uColA, uColB, fract(fi * 0.37 + 0.12 + uScroll * 0.2));
    glow += col * (line * 0.26 + halo * 0.05);
    core += line;
  }

  // fall off toward the edges so the ribbons read as light
  float vign = 1.0 - smoothstep(0.28, 0.92, length(p * vec2(0.7, 1.0)));
  glow *= mix(0.25, 1.0, vign);

  // a touch of grain stops the dark gradients from banding
  float g = hash(uv.x * 913.0 + uv.y * 571.0 + uTime) - 0.5;
  glow += g * 0.01;

  gl_FragColor = vec4(glow * uOpacity, 1.0);
}
`