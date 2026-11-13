import * as THREE from 'three';
import { hexRgb } from './kits';
import { LIGHT } from './toon';

/**
 * What fills a gate out of a land: the way through to the next one, a sheet of that land's own light turning slowly
 * in on itself from post to post and from the road to the arch. Flat bands of color with a bright edge, drawn in the
 * hand of the rest of the game, and nothing of it on the ground (the owner, of a first try that threw banded light
 * down the road: "this looks broken ... i want to do something like [a] portal gate, just through the whole 'hole'
 * of our gate, without illuminating anything on the floor").
 *
 * It is a real surface standing in the gate (not a picture turned to the camera), so the posts and the arch cut it
 * as they would a door, and it is solid to the eye: nothing past the land's edge shows through it.
 */
export const PORTAL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const PORTAL_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec2 uSize;
  uniform float uSeed;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 9.1) * 0.1; }

  void main() {
    float t = uTime + uSeed * 40.0;
    // (in tiles, from a little above the middle of the opening; one turn of it is as tall as the gate)
    vec2 q = (vUv - vec2(0.5, 0.54)) * uSize / (uSize.y * 0.5);
    q.x *= 0.82;
    float r = length(q);
    float a = atan(q.y, q.x);
    // it is liquid: everything in it drifts a little off true
    vec2 drift = vec2(fbm(q * 1.5 + vec2(uSeed * 9.0, t * 0.22)), fbm(q * 1.5 + vec2(5.2, -t * 0.2))) - 0.5;
    // two arms winding in to the middle, turning
    float arms = sin(a * 2.0 - log(r + 0.07) * 4.4 + t * 1.25 + drift.x * 3.2);
    float v = 0.5 + 0.5 * arms;
    v = v * 0.72 + fbm(q * 2.4 + drift * 1.6 - vec2(0.0, t * 0.28)) * 0.46;
    // (deep at its heart, where the arms meet)
    v -= (1.0 - smoothstep(0.0, 0.75, r)) * 0.2;

    // four flat tones of the next land's light, and no shading between them
    vec3 sat = uColor * uColor;
    vec3 deep = sat * 0.34 + uColor * 0.06;
    vec3 mid = mix(sat, uColor, 0.5) * 0.66;
    vec3 lite = uColor * 0.98 + 0.03;
    vec3 pale = mix(uColor, vec3(1.0), 0.62);
    vec3 col = deep;
    col = mix(col, mid, step(0.4, v));
    col = mix(col, lite, step(0.6, v));
    col = mix(col, pale, step(0.84, v));

    // motes of it rising
    vec2 g = vec2(vUv.x * uSize.x * 1.6, vUv.y * uSize.y * 1.1 - t * 0.55);
    vec2 cell = floor(g);
    float pick = hash(cell + uSeed * 17.0);
    vec2 at = fract(g) - vec2(0.3 + pick * 0.4, 0.3 + fract(pick * 7.3) * 0.4);
    col = mix(col, pale, step(length(at * vec2(1.0, 0.8)), 0.075 * step(0.72, pick)));

    // its edge against the posts and the arch: a wavering line of white, a band of light inside that
    float side = min(vUv.x, 1.0 - vUv.x) * uSize.x;
    float top = (1.0 - vUv.y) * uSize.y;
    float wave = sin(vUv.y * uSize.y * 4.6 + t * 2.1) * 0.05 + sin(vUv.x * uSize.x * 3.9 - t * 1.6) * 0.05 + drift.y * 0.22;
    float edge = min(side, top) + wave;
    col = mix(col, lite, step(edge, 0.3));
    col = mix(col, vec3(0.99, 0.99, 0.97), step(edge, 0.14));
    // and where it meets the road: it wells up bright
    float foot = vUv.y * uSize.y + sin(vUv.x * uSize.x * 5.2 + t * 2.6) * 0.06 + drift.x * 0.2;
    col = mix(col, pale, step(foot, 0.36));
    col = mix(col, vec3(0.99, 0.99, 0.97), step(foot, 0.15));

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * A gate's portal: `half` tiles each side of its middle, `high` tiles tall, standing on the ground at its origin and
 * facing along z. `color` is the next land's light.
 */
export function portalMesh(half: number, high: number, color: string, seed = 0): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(half * 2, high);
  geo.translate(0, high / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: LIGHT.uTime,
      uColor: { value: new THREE.Vector3(...hexRgb(color)) },
      uSize: { value: new THREE.Vector2(half * 2, high) },
      uSeed: { value: seed % 1 },
    },
    vertexShader: PORTAL_VERT,
    fragmentShader: PORTAL_FRAG,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'gate-portal';
  return mesh;
}
