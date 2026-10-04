/**
 * Full-screen liquid distortion pass.
 *
 * Runs after the scene is rendered and offsets the UV it samples from, so the
 * whole frame swims a little. Three things drive it:
 *
 *   scroll speed  -> global wobble amplitude
 *   cursor        -> a soft lens that pushes pixels around
 *   hover ripples -> expanding rings, pushed into scroll.ripples on hover
 *
 * A small chromatic split rides on top, scaled by scroll speed.
 */

export const liquidDistortionShader = {
  name: 'RubyLiquidDistortion',
  uniforms: {
    tDiffuse: { value: null as unknown },
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uAspect: { value: 1 },
    uPointer: { value: null as unknown },
    /** xy = uv, z = age in seconds, w = strength */
    uRipples: { value: null as unknown },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uAspect;
    uniform vec2  uPointer;
    uniform vec4  uRipples[6];

    varying vec2 vUv;

    const int MAX_RIPPLES = 6;

    void main() {
      vec2 uv = vUv;
      vec2 p = uv - 0.5;

      // base liquid wobble
      float wob = sin(uv.y * 9.0 + uTime * 0.7) * 0.0016
                + sin(uv.x * 7.0 - uTime * 0.55 + uv.y * 3.0) * 0.0013
                + sin((uv.x + uv.y) * 12.0 + uTime * 0.9) * 0.0008;
      wob *= 1.0 + uEnergy * 5.0;

      vec2 off = vec2(wob, wob * 0.55);

      // cursor lens: pushes pixels away from the pointer
      vec2 asp = vec2(uAspect, 1.0);
      vec2 toPointer = uv * asp - uPointer * asp;
      float pd = length(toPointer);
      float lens = 1.0 - smoothstep(0.0, 0.45, pd);
      off += normalize(toPointer + 1e-6) * lens * (0.0035 + uEnergy * 0.008)
             * sin(pd * 34.0 - uTime * 3.0);

      // expanding rings from hover
      for (int i = 0; i < MAX_RIPPLES; i++) {
        vec4 rp = uRipples[i];
        if (rp.w <= 0.0) continue;
        vec2 d = (uv - rp.xy) * asp;
        float dist = length(d);
        float age = uTime - rp.z;
        float ring = sin((dist - age * 0.55) * 46.0);
        float envelope = exp(-dist * 6.5) * exp(-age * 1.7) * smoothstep(0.0, 0.05, age);
        off += normalize(d + 1e-6) * ring * envelope * 0.006 * rp.w;
      }

      uv += off;

      // chromatic split, wider the faster you scroll. Kept small at rest so
      // high-contrast edges do not fringe while the page is still.
      float ca = 0.0003 + uEnergy * 0.0028;
      vec2 dir = normalize(p + 1e-6);

      vec4 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;
      col.a = 1.0;

      gl_FragColor = col;
    }
  `,
}