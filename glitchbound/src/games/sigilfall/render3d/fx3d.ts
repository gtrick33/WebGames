import * as THREE from 'three';
import { TILE } from '../sim/map';
import { LIGHT } from './toon';

/**
 * Everything that glows, flows or burns, drawn by the graphics card: one quad per effect, all in one draw call, and a
 * fragment shader that knows what water, fire, frost, shadow and the rest look like. They stand in the same world as
 * the people and the walls, so a wall hides what's behind it and what lies on the ground lies under everyone's feet.
 *
 * Output is premultiplied: what adds light has no alpha, what covers has, and a single blend mode does for both.
 */

/** What a quad is. */
export const FX = {
  orb: 0,
  water: 1,
  flame: 2,
  smoke: 3,
  spark: 4,
  ring: 5,
  shadow: 6,
  frost: 7,
  poison: 8,
  holy: 9,
  bolt: 10,
  slash: 11,
  field: 12,
  warn: 13,
  rift: 14,
  glow: 15,
  trail: 16,
  web: 17,
  shaft: 18,
  wave: 19,
  impact: 20,
  blast: 21,
  bubble: 22,
  chip: 23,
  leaf: 24,
  rain: 25,
  gather: 26,
  mark: 27,
  shock: 28,
  collapse: 29,
  ghost: 30,
  wake: 31,
  beam: 32,
  trap: 33,
  ball: 34,
  rune: 35,
  flake: 36,
  spill: 37,
  column: 38,
  crack: 39,
} as const;
export type FxKind = (typeof FX)[keyof typeof FX];

/** A ground field's pattern. */
export const FIELD = { fire: 0, poison: 1, frost: 2, lightning: 3, rift: 4, holy: 5, shadow: 6, nature: 7, arrows: 8, water: 9 } as const;
/** A warning's shape. */
export const WARN = { circle: 0, donut: 1, cone: 2, line: 3 } as const;

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += noise(p) * a;
      p = p * 2.03 + vec2(13.1, 7.7);
      a *= 0.5;
    }
    return s;
  }`;

const vertex = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iSize;
  attribute vec4 iA;
  attribute vec4 iB;
  attribute vec4 iP;
  varying vec2 vUv;
  varying vec4 vA;
  varying vec4 vB;
  varying vec4 vP;
  void main() {
    float c = cos(iSize.z);
    float s = sin(iSize.z);
    // (iSize.w: 0 faces the camera, 1 lies flat, 2 faces the camera standing on its lower edge; 4 more if it's behind,
    // 8 more if it wraps what it stands on)
    float over = step(7.5, iSize.w);
    float rest = iSize.w - over * 8.0;
    float behind = step(3.5, rest);
    float mode = rest - behind * 4.0;
    vec2 r = vec2(position.x * iSize.x, (position.y + step(1.5, mode) * 0.5) * iSize.y);
    r = vec2(r.x * c - r.y * s, r.x * s + r.y * c);
    vec3 w;
    if (mode > 0.5 && mode < 1.5) {
      // its x east, its y south
      w = iPos + vec3(r.x, 0.0, r.y);
    } else {
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      w = iPos + right * r.x + up * r.y;
      // (a spell on someone shows in front of them, not through their middle; a thrown skull's glow, behind it; a
      // fire on a roof, in front of the roof's own dormers and trim)
      w += normalize(cameraPosition - w) * (mix(0.75, -0.3, behind) + over * 2.4);
    }
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    vUv = position.xy * 2.0;
    vA = iA;
    vB = iB;
    vP = iP;
  }`;

const fragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec4 vA;
  varying vec4 vB;
  varying vec4 vP;
  ${NOISE}

  // a ball of its own light: a swirl inside, a hot heart, a bright skin and a halo
  vec4 orb(vec2 uv, float seed) {
    float d = length(uv) / 0.66;
    float halo = exp(-max(d - 0.8, 0.0) * 4.2) * smoothstep(1.5, 0.9, d) * 0.55;
    if (d > 1.0) return vec4(vA.rgb * halo, 0.0);
    vec3 n = vec3(uv / 0.66, sqrt(max(0.0, 1.0 - d * d)));
    float ang = atan(uv.y, uv.x);
    float sw = fbm(vec2(ang * 1.6 + uTime * 2.2 + seed, d * 2.6 - uTime * 2.6));
    vec3 c = mix(vA.rgb * 0.55, vA.rgb * 1.05, smoothstep(0.25, 0.75, sw));
    c = mix(c, vB.rgb, pow(max(0.0, 1.0 - d), 1.6) * 1.1);
    c += vB.rgb * pow(1.0 - n.z, 3.0) * 0.5;
    c += vec3(1.0) * pow(max(dot(n, normalize(vec3(-0.4, 0.55, 0.75))), 0.0), 30.0) * 0.8;
    float a = smoothstep(1.0, 0.9, d);
    return vec4(c * a + vA.rgb * halo * (1.0 - a), a * 0.92);
  }

  // water: a drop that wobbles, darker through its depth, light caught in it, foam where it's torn
  vec4 water(vec2 uv, float seed, float tail) {
    vec2 p = uv * 1.3;
    if (p.x < 0.0) {
      p.y *= 1.0 - tail * p.x * 1.1;
      p.x *= 1.0 - tail * 0.5;
    }
    float wob = (noise(p * 2.2 + vec2(uTime * 1.6, seed)) - 0.5) * 0.14;
    float d = length(p) + wob;
    float a = smoothstep(1.0, 0.94, d);
    if (a <= 0.0) return vec4(0.0);
    float z = sqrt(max(0.02, 1.0 - min(d * d, 1.0)));
    vec2 q = p * 3.0 + vec2(uTime * 1.3 + seed, -uTime * 0.9);
    vec3 n = normalize(vec3(p + (vec2(noise(q), noise(q + 7.3)) - 0.5) * 0.5, z));
    float fres = pow(1.0 - n.z, 2.0);
    // deep at the top, where the light has come through it to the bottom
    vec3 c = mix(vA.rgb, vB.rgb, smoothstep(-0.7, 0.8, -n.y * 0.9 + 0.1));
    float caustic = smoothstep(0.55, 0.85, noise(q * 0.9 + 3.1)) * smoothstep(0.4, 0.8, noise(q * 1.3 - uTime * 0.6));
    c += vB.rgb * caustic * 0.35;
    c = mix(c, vB.rgb * 1.3 + 0.1, fres * 0.75);
    float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.62, 0.64))), 0.0), 48.0);
    c += vec3(1.0) * spec * 1.25;
    float foam = smoothstep(0.82, 0.97, d) * smoothstep(0.32, 0.68, noise(p * 7.0 + uTime * 2.2 + seed));
    c = mix(c, mix(vec3(0.94, 1.0, 1.0), vB.rgb, 0.2), foam * 0.85);
    float al = a * (0.84 + fres * 0.16);
    return vec4(c * al, al);
  }

  // a wave front: a wall of water, foam along its crest and at its foot. Its seed carries on across
  // its neighbors, so a line of them reads as one wave.
  vec4 waveFront(vec2 uv, float seed, float rough) {
    float x = uv.x * 1.2 + seed;
    float crest = 0.34 + rough * (0.2 * sin(x * 2.2 + uTime * 3.4) + (noise(vec2(x * 1.6, uTime * 1.3)) - 0.5) * 0.34);
    float foot = -0.82 + 0.1 * sin(x * 3.4 - uTime * 4.0);
    float y = uv.y;
    float edge = smoothstep(1.0, 0.72, abs(uv.x));
    float body = smoothstep(crest + 0.03, crest - 0.03, y) * smoothstep(foot - 0.04, foot + 0.04, y);
    if (body <= 0.0) return vec4(0.0);
    float depth = clamp((y - foot) / max(0.01, crest - foot), 0.0, 1.0);
    vec3 c = mix(vA.rgb, vB.rgb, smoothstep(0.1, 0.95, depth));
    float s1 = noise(vec2(x * 0.9 + uTime * 0.5, y * 7.0 - uTime * 2.1));
    float s2 = noise(vec2(x * 1.7 - uTime * 0.3, y * 13.0 - uTime * 3.2));
    c += vB.rgb * smoothstep(0.58, 0.82, s1) * smoothstep(0.3, 0.75, s2) * 0.5;
    c *= 0.88 + 0.24 * smoothstep(0.3, 0.7, s2);
    float foamTop = smoothstep(crest - 0.28, crest - 0.02, y + (noise(vec2(x * 6.0, uTime * 2.8)) - 0.5) * 0.3);
    float foamFoot = smoothstep(foot + 0.24, foot + 0.02, y + (noise(vec2(x * 7.0, uTime * 3.2)) - 0.5) * 0.28);
    c = mix(c, mix(vec3(0.95, 1.0, 1.0), vB.rgb, 0.22), clamp(foamTop + foamFoot, 0.0, 1.0));
    float a = body * edge * 0.95;
    return vec4(c * a, a);
  }

  // fire: turbulence rising through a soft column, cooling as it climbs. No outline anywhere, so flames that overlap
  // melt into one mass; from the hot white-yellow of its heart through its own colors to nothing
  vec4 flame(vec2 uv, float seed) {
    float y = (uv.y + 1.0) * 0.5;
    vec2 q = vec2(uv.x * 1.35 + seed, y * 1.9 - uTime * 1.35);
    float warp = fbm(q * 1.2 + vec2(seed * 0.3, -uTime * 0.35));
    float n = fbm(q * 2.1 + warp * 1.4);
    float n2 = noise(q * 4.6 + warp * 2.0);
    float lean = (warp - 0.5) * 0.7 * y;
    float across = abs(uv.x + lean) / mix(0.92, 0.14, pow(y, 0.85));
    float body = max(0.0, 1.0 - across * across);
    float rise = 1.0 - pow(y, 1.4);
    float foot = smoothstep(0.0, 0.2, y);
    float i = body * rise * foot * (0.72 + n * 0.62) + (n - 0.52) * (0.55 + y * 0.9) * foot + (n2 - 0.5) * 0.16 * foot;
    i = clamp(i * smoothstep(1.0, 0.8, y) * smoothstep(1.0, 0.82, abs(uv.x)), 0.0, 1.0);
    float a = smoothstep(0.03, 0.5, i);
    vec3 c = mix(vA.rgb * 0.5, vA.rgb, smoothstep(0.05, 0.32, i));
    c = mix(c, vB.rgb, smoothstep(0.3, 0.6, i));
    c = mix(c, vec3(1.0, 0.94, 0.72), smoothstep(0.66, 1.0, i));
    float glow = exp(-length(vec2(uv.x * 1.1, (y - 0.3) * 2.2)) * 2.8) * 0.3;
    // (the hot parts add light to what's behind them, rather than covering it)
    return vec4(c * a + vA.rgb * glow * (1.0 - a), a * (0.9 - smoothstep(0.4, 1.0, i) * 0.45));
  }

  // smoke: billowing, soft-edged, darker where it's thick, thinning as it goes
  vec4 puff(vec2 uv, float t, float seed) {
    float d = length(uv);
    vec2 q = uv * 1.5 + vec2(seed, seed * 1.7 - uTime * 0.16);
    float warp = fbm(q * 1.1 + uTime * 0.05);
    float n = fbm(q * 1.7 + warp * 1.3);
    float a = smoothstep(1.0, 0.25, d + (0.5 - n) * 1.25);
    vec3 c = vA.rgb * (0.78 + (n - 0.42) * 1.15 + uv.y * 0.14);
    a *= clamp(1.0 - t, 0.0, 1.0) * smoothstep(1.0, 0.72, d);
    return vec4(c * a, a);
  }

  // shadow: a hole in the light, turning, with something bright caught at its edge
  vec4 shadowBall(vec2 uv, float seed) {
    float d = length(uv) / 0.7;
    float ang = atan(uv.y, uv.x);
    float sw = fbm(vec2(ang * 1.3 + d * 3.2 - uTime * 3.4 + seed, d * 2.4 - uTime * 1.4));
    float body = smoothstep(1.02, 0.62, d + (sw - 0.5) * 0.55);
    float rim = smoothstep(0.42, 0.86, d + (sw - 0.5) * 0.4) * body;
    vec3 c = mix(vec3(0.03, 0.01, 0.06), vA.rgb, rim);
    c += vB.rgb * pow(rim, 3.0) * 0.9;
    float halo = exp(-max(d - 0.7, 0.0) * 3.4) * 0.42 * (1.0 - body);
    return vec4(c * body + vA.rgb * halo, body * 0.96);
  }

  // ice: a long crystal, its two faces different, glittering, a glow of cold about it
  vec4 frost(vec2 uv, float seed) {
    vec2 q = abs(uv);
    float sd = q.x * 0.72 + q.y * 2.2;
    float body = smoothstep(1.0, 0.94, sd);
    float halo = exp(-max(sd - 0.9, 0.0) * 3.2) * 0.4 * (1.0 - body);
    float face = uv.y > 0.0 ? 1.0 : 0.0;
    vec3 c = mix(vA.rgb, vB.rgb, face * 0.75 + 0.1 + (uv.x * 0.2));
    c += vec3(1.0) * smoothstep(0.03, 0.0, abs(uv.y)) * 0.6;
    c += vec3(1.0) * pow(max(uv.x, 0.0), 3.0) * 0.5;
    float glit = step(0.93, noise(uv * 11.0 + vec2(uTime * 3.0, seed)));
    c += vec3(1.0) * glit * 0.8;
    return vec4(c * body + vA.rgb * halo, body * 0.92);
  }

  // poison: lumps of slime that won't stay together
  vec4 poisonBlob(vec2 uv, float seed) {
    vec2 p = uv * 1.15;
    float m = 0.0;
    for (int i = 0; i < 4; i++) {
      float k = float(i);
      vec2 c = vec2(sin(uTime * 2.3 + k * 2.1 + seed), cos(uTime * 1.9 + k * 1.3 + seed)) * (k == 0.0 ? 0.08 : 0.36);
      float r = k == 0.0 ? 0.42 : 0.22;
      m += r * r / max(0.001, dot(p - c, p - c));
    }
    float body = smoothstep(0.92, 1.1, m);
    if (body <= 0.0) return vec4(vA.rgb * smoothstep(0.35, 0.9, m) * 0.28, 0.0);
    vec3 c = mix(vA.rgb * 0.7, vB.rgb, smoothstep(1.0, 3.2, m));
    float bub = smoothstep(0.7, 0.74, noise(p * 7.0 + vec2(0.0, -uTime * 1.3) + seed));
    c = mix(c, vB.rgb * 1.2, bub * 0.7);
    vec2 h = p - vec2(-0.16, 0.2);
    c += vec3(1.0) * exp(-dot(h, h) * 34.0) * 0.7;
    return vec4(c * body, body * 0.94);
  }

  // light itself: a hot point, rays turning two ways
  vec4 holyLight(vec2 uv, float seed) {
    float d = length(uv);
    float ang = atan(uv.y, uv.x);
    float rays = pow(max(0.0, cos(ang * 4.0 + uTime * 1.8 + seed)), 12.0) * exp(-d * 2.1) + pow(max(0.0, cos(ang * 6.0 - uTime * 1.2 + seed)), 18.0) * exp(-d * 1.5);
    float core = exp(-d * d * 12.0);
    vec3 c = vA.rgb * (rays * 0.8 + exp(-d * 3.6) * 0.45) + mix(vB.rgb, vec3(1.0), 0.5) * core * 0.95;
    return vec4(c, core * 0.75);
  }

  // lightning: the crooked line and its branches, along the quad
  vec4 boltArc(vec2 uv, float seed) {
    float env = smoothstep(1.0, 0.82, abs(uv.x));
    float s = 0.0;
    float t0 = floor(uTime * 22.0);
    for (int i = 0; i < 3; i++) {
      float k = float(i);
      float off = (noise(vec2(uv.x * (4.0 + k * 2.4) + t0 * 0.61 + k * 9.1, seed + k)) - 0.5) * (0.9 + k * 0.5);
      s += exp(-abs(uv.y - off * (1.0 - abs(uv.x) * 0.6)) * (k == 0.0 ? 16.0 : 26.0)) * (k == 0.0 ? 1.0 : 0.45);
    }
    s *= env;
    return vec4(vA.rgb * s * 1.4 + vec3(1.0) * pow(s, 3.0), min(1.0, pow(s, 2.0)) * 0.7);
  }

  // the path of a blow: a crescent that sweeps out, thin at its tips, white at the blade
  vec4 slash(vec2 uv, float t, float sweep, float heavy) {
    float r = length(uv);
    float ang = atan(uv.y, uv.x);
    float half_ = sweep * 0.5;
    float reveal = min(1.0, t * 2.6 + 0.3);
    float head = -half_ + sweep * reveal;
    if (ang > head || ang < -half_) return vec4(0.0);
    float f = clamp((ang + half_) / max(0.001, head + half_), 0.0, 1.0);
    float pinch = sin(clamp((ang + half_) / sweep, 0.0, 1.0) * 3.14159);
    float th = mix(0.3 + heavy * 0.1, 0.1, t) * pinch + 0.015;
    // (a heavy blow's band is wider than the card it is drawn on: it thins out before the card's edge, or the edge
    // shows as a straight white cut across the swing)
    float band = smoothstep(th, th * 0.35, abs(r - 0.82)) * smoothstep(1.0, 0.86, r);
    float streak = 0.75 + 0.5 * noise(vec2(r * 22.0, ang * 2.0));
    float fade = clamp(1.2 - t * 1.25, 0.0, 1.0);
    float k = band * pow(f, 1.6) * fade * streak;
    // (white at the blade, unless the swing brings a second color for its edge: a blade of shadow is pale violet there
    // and covers more of the ground behind it, so it reads as dark and not as a flash)
    float own = step(0.02, distance(vA.rgb, vB.rgb));
    vec3 c = mix(vA.rgb, mix(vec3(1.0), vB.rgb, own), smoothstep(0.6, 1.0, f) * 0.85);
    return vec4(c * k, k * mix(0.55, 0.8, own));
  }

  // what lies on the ground and keeps hurting
  vec4 field(vec2 uv, float t, float seed, float look, float hostile) {
    float d = length(uv);
    if (d > 1.0) return vec4(0.0);
    float ang = atan(uv.y, uv.x);
    float edge = smoothstep(1.0, 0.9, d);
    vec3 c = vA.rgb;
    float a = 0.0;
    vec3 add = vec3(0.0);
    if (look < 0.5) {
      // fire: the ground itself burning
      float n = fbm(uv * 2.6 + vec2(seed, -uTime * 0.9));
      float n2 = fbm(uv * 5.5 + vec2(uTime * 0.6, seed));
      float heat = clamp(n * 1.5 * (1.15 - d * 0.55) + (n2 - 0.5) * 0.5, 0.0, 1.0);
      c = mix(vec3(0.16, 0.05, 0.03), vA.rgb, smoothstep(0.34, 0.6, heat));
      c = mix(c, vB.rgb, smoothstep(0.58, 0.78, heat));
      c = mix(c, vec3(1.0, 0.96, 0.78), smoothstep(0.78, 0.96, heat));
      a = edge * (0.42 + smoothstep(0.3, 0.6, heat) * 0.55);
    } else if (look < 1.5) {
      // poison: a pool of it, seething
      float n = fbm(uv * 2.4 + vec2(uTime * 0.14, seed));
      c = mix(vA.rgb * 0.34, vA.rgb, smoothstep(0.3, 0.75, n));
      float b = smoothstep(0.71, 0.74, noise(uv * 8.0 + vec2(seed, uTime * 0.5)));
      c = mix(c, vB.rgb, b);
      a = edge * (0.62 + b * 0.3);
    } else if (look < 2.5) {
      // frost: the ground gone to ice, cracked through
      float n = 1.0 - abs(fbm(uv * 3.4 + seed) * 2.0 - 1.0);
      float cracks = pow(n, 9.0);
      float deep = fbm(uv * 1.8 + seed + 4.0);
      c = mix(mix(vA.rgb * 0.75, vA.rgb * 1.2 + 0.08, deep), vec3(1.0), cracks);
      a = edge * (0.62 + cracks * 0.34);
      add = vec3(1.0) * step(0.965, noise(uv * 14.0 + uTime * 2.2)) * 0.8 * edge;
    } else if (look < 3.5) {
      // lightning: arcs crawling over it
      float n = pow(1.0 - abs(fbm(uv * 2.2 + vec2(floor(uTime * 12.0) * 0.37, seed)) * 2.0 - 1.0), 28.0);
      add = (vA.rgb * 1.3 + 0.35) * n * edge;
      a = edge * 0.4;
      c = vec3(0.05, 0.12, 0.28);
    } else if (look < 4.5) {
      // the rift: the ground coming apart
      float sp = sin(ang * 3.0 + d * 8.0 - uTime * 2.6 + (fbm(uv * 3.0 + seed) - 0.5) * 5.0);
      float lit = smoothstep(0.72, 0.98, abs(sp));
      c = mix(vec3(0.05, 0.0, 0.09), mix(vA.rgb, vB.rgb, step(0.0, sp)), lit);
      a = edge * (0.68 + lit * 0.28);
    } else if (look < 5.5) {
      // holy: a ring of runes, consecrated ground
      float rings = exp(-pow((d - 0.92) / 0.03, 2.0)) + exp(-pow((d - 0.7) / 0.018, 2.0)) * 0.8;
      float ticks = step(0.86, cos(ang * 14.0 + uTime * 0.7)) * step(0.72, d) * step(d, 0.9);
      add = vB.rgb * (rings + ticks * 0.8);
      a = edge * 0.2;
      add += vA.rgb * (1.0 - d) * 0.25;
    } else if (look < 6.5) {
      // shadow: a turning dark, thin light at its rim
      float sw = fbm(vec2(ang * 1.4 + d * 3.0 - uTime * 1.3 + seed, d * 3.0));
      c = mix(vec3(0.03, 0.01, 0.06), vA.rgb * 0.8, smoothstep(0.55, 0.8, sw));
      a = edge * 0.74;
      add = vA.rgb * smoothstep(0.86, 0.98, d) * edge * 0.9;
    } else if (look < 7.5) {
      // nature: grass and leaves coming up, a ring turning
      float n = fbm(uv * 4.0 + seed);
      c = mix(vA.rgb * 0.5, vA.rgb, n);
      a = edge * (0.28 + smoothstep(0.5, 0.7, n) * 0.35);
      add = vB.rgb * exp(-pow((d - 0.92) / 0.035, 2.0)) * (0.5 + 0.5 * cos(ang * 10.0 - uTime * 1.6));
    } else if (look < 8.5) {
      // arrows falling here: a shaded circle, its edge drawn
      a = edge * 0.14;
      c = vec3(0.0);
      add = vA.rgb * exp(-pow((d - 0.96) / 0.025, 2.0)) * 0.7;
    } else {
      // water: a shallow pool, ripples going out through it
      float rip = sin(d * 22.0 - uTime * 4.0 + fbm(uv * 3.0 + seed) * 4.0);
      c = mix(vA.rgb, vB.rgb, smoothstep(0.3, 1.0, rip) * 0.7 + (1.0 - d) * 0.2);
      a = edge * 0.72;
      add = vec3(1.0) * smoothstep(0.92, 1.0, rip) * 0.3 * edge;
    }
    float fade = clamp(t * 3.0, 0.0, 1.0);
    // what hurts you has a red edge you can see at a glance
    add += vec3(1.0, 0.24, 0.22) * hostile * exp(-pow((d - 0.965) / 0.022, 2.0)) * 0.9;
    a *= fade;
    return vec4(c * a + add * fade, a);
  }

  // a warning: where it will land, filling up as it comes
  vec4 warn(vec2 uv, float k, float shape, float p2, float flash) {
    float inside;
    float at;
    float line;
    float d = length(uv);
    if (shape < 0.5) {
      inside = step(d, 1.0);
      at = d;
      line = exp(-pow((d - 0.972) / 0.026, 2.0));
    } else if (shape < 1.5) {
      inside = step(d, 1.0) * step(p2, d);
      at = 1.0 - (d - p2) / max(0.01, 1.0 - p2);
      line = exp(-pow((d - 0.975) / 0.018, 2.0)) + exp(-pow((d - p2) / 0.018, 2.0));
    } else if (shape < 2.5) {
      float ang = abs(atan(uv.y, uv.x));
      inside = step(d, 1.0) * step(ang, p2);
      at = d;
      line = (exp(-pow((d - 0.975) / 0.018, 2.0)) + exp(-pow((ang - p2) * d / 0.018, 2.0))) * inside;
    } else {
      inside = step(abs(uv.y), 1.0) * step(abs(uv.x), 1.0);
      at = (uv.x + 1.0) * 0.5;
      line = exp(-pow((abs(uv.y) - 0.94) / 0.05, 2.0));
    }
    if (inside <= 0.0) return vec4(0.0);
    // (a body of color, not only an edge: on a dark crypt floor or under a night sky an outline alone was lost)
    float a = 0.22;
    float filled = step(at, k);
    a += filled * 0.26 + smoothstep(0.7, 1.0, k) * filled * 0.12;
    float head = exp(-pow((at - k) / 0.03, 2.0)) * (k < 0.995 ? 1.0 : 0.0);
    vec3 c = vA.rgb * a;
    c += mix(vA.rgb, vec3(1.0), 0.45) * (line * 0.85 + head * 0.9);
    c += vec3(1.0) * flash * 0.8;
    return vec4(c, clamp(a + line * 0.4 + head * 0.3 + flash * 0.5, 0.0, 1.0));
  }

  // a tear in things: a spiral going down, two colors at war at its lip
  vec4 rift(vec2 uv, float seed) {
    float d = length(uv);
    if (d > 1.0) return vec4(0.0);
    float ang = atan(uv.y, uv.x);
    float sp = sin(ang * 3.0 + d * 12.0 - uTime * 6.0 + seed);
    float n = fbm(uv * 3.2 + uTime * 0.6);
    vec3 c = mix(vec3(0.02, 0.0, 0.05), mix(vA.rgb, vB.rgb, sp * 0.5 + 0.5), smoothstep(0.45, 0.96, d + (n - 0.5) * 0.3));
    float a = smoothstep(1.0, 0.86, d);
    return vec4(c * a + vB.rgb * exp(-pow((d - 0.93) / 0.05, 2.0)) * a, a * 0.95);
  }

  // what comes behind a shot: hot near it, thin far off, broken up
  vec4 trail(vec2 uv, float seed) {
    float along = (uv.x + 1.0) * 0.5;
    float w = mix(0.04, 0.9, pow(along, 0.8));
    float body = smoothstep(w, w * 0.3, abs(uv.y));
    float n = noise(vec2(uv.x * 3.0 - uTime * 7.0 + seed, uv.y * 2.4));
    float k = body * pow(along, 1.5) * (0.55 + 0.75 * n);
    return vec4(mix(vA.rgb, vB.rgb, along * along) * k, k * 0.28);
  }

  // a ball of force, going out: streaks flying off a hot middle
  vec4 impact(vec2 uv, float t, float seed) {
    float d = length(uv);
    float ang = atan(uv.y, uv.x);
    float R = t * 0.95;
    float n = pow(abs(cos(ang * 3.5 + seed)), 12.0) + pow(abs(cos(ang * 5.5 + seed * 1.7)), 18.0) * 0.8;
    float streak = n * smoothstep(R + 0.2, R - 0.05, d) * smoothstep(R - 0.45, R - 0.1, d);
    float core = exp(-d * d / max(0.01, (0.05 + t * 0.18))) * (1.0 - t);
    float ring = exp(-pow((d - R) / (0.05 + t * 0.03), 2.0)) * (1.0 - t) * 0.6;
    vec3 c = vA.rgb * (streak * 1.5 + ring * 1.2) + mix(vB.rgb, vec3(1.0), 0.5) * core * 1.5;
    return vec4(c * (1.0 - t * 0.4), core * 0.6);
  }

  // a great burst: a churning ball that swells, cools and thins
  vec4 blast(vec2 uv, float t, float seed) {
    float d = length(uv);
    float R = 0.35 + 0.65 * sqrt(t);
    float ang = atan(uv.y, uv.x);
    float n = fbm(vec2(ang * 1.5 + seed, d * 3.2 - t * 3.0));
    float n2 = fbm(uv * 3.4 + vec2(seed, t * 2.6));
    float body = smoothstep(R, R * 0.72, d + (n - 0.5) * 0.4);
    float hollow = smoothstep(R * t * 0.9 - 0.05, R * t * 0.9 + 0.2, d + (n2 - 0.5) * 0.4);
    float k = body * hollow * (1.0 - t * t);
    float heat = clamp((1.0 - t * 1.05) * (1.15 - d / max(R, 0.01) * 0.75) + (n2 - 0.5) * 0.7, 0.0, 1.0);
    vec3 c = mix(vA.rgb * 0.35, vA.rgb, smoothstep(0.08, 0.36, heat));
    c = mix(c, vB.rgb, smoothstep(0.34, 0.6, heat));
    c = mix(c, vec3(1.0, 0.98, 0.9), smoothstep(0.62, 0.9, heat));
    return vec4(c * k, k * 0.86);
  }

  // a shield: a skin of light you only see at the edge, with a ripple running over it
  vec4 bubble(vec2 uv, float t) {
    float d = length(uv) / 0.94;
    if (d > 1.0) return vec4(0.0);
    float z = sqrt(max(0.0, 1.0 - d * d));
    float fres = pow(1.0 - z, 2.6);
    float rip = 0.5 + 0.5 * sin(d * 13.0 - uTime * 5.0 + noise(uv * 3.0) * 3.0);
    vec3 c = vA.rgb * (fres * 1.5 + rip * 0.08) + vec3(1.0) * pow(max(dot(vec3(uv, z), normalize(vec3(-0.4, 0.6, 0.7))), 0.0), 40.0) * 0.8;
    return vec4(c * (1.0 - t), fres * 0.45 * (1.0 - t));
  }

  // a chip of something, turning: two faces
  vec4 chip(vec2 uv) {
    vec2 q = abs(uv);
    float s = q.x * 1.15 + q.y * 0.95;
    float a = smoothstep(1.0, 0.86, s);
    vec3 c = uv.y > uv.x * 0.3 ? vA.rgb * 1.2 + 0.12 : vA.rgb * 0.72;
    return vec4(c * a, a);
  }

  // a leaf: a curve down its middle
  // a snowflake: a soft round flake with a bright heart; the bigger ones a six-armed crystal, turning as it falls
  vec4 flake(vec2 uv, float seed) {
    float d = length(uv);
    float soft = smoothstep(1.0, 0.0, d);
    float core = exp(-d * d * 12.0);
    float ang = atan(uv.y, uv.x) + seed * 6.2832 + uTime * (0.3 + fract(seed * 7.13) * 0.7);
    float arms = pow(abs(cos(ang * 3.0)), 24.0) * smoothstep(0.95, 0.15, d) * step(0.45, fract(seed * 3.71));
    float k = core * 0.95 + arms * 0.6 + soft * 0.16;
    vec3 c = mix(vA.rgb, vec3(1.0), core * 0.7);
    return vec4(c * k, min(1.0, k));
  }

  vec4 leaf(vec2 uv) {
    float w = (1.0 - uv.x * uv.x) * 0.55;
    float a = smoothstep(w, w * 0.8, abs(uv.y));
    vec3 c = vA.rgb * (0.82 + 0.3 * step(0.0, uv.y));
    c += vec3(0.1) * smoothstep(0.05, 0.0, abs(uv.y));
    return vec4(c * a, a);
  }

  // light spilling along the ground out of a gateway or a door: its source a quarter of the way in from the quad's
  // near edge, a soft fan ahead of it, a little of it round the source on every side (so it never ends on a line behind
  // the gate), faint slow streaks in it as through dust, and all of it gone well before the quad's edges
  vec4 spill(vec2 uv, float seed) {
    vec2 p = vec2(uv.x, uv.y + 0.5);
    float d = length(p);
    float ang = atan(p.x, p.y);
    float cone = smoothstep(1.35, 0.15, abs(ang));
    float fall = pow(max(0.0, 1.0 - d / 1.45), 2.0);
    float streak = 0.74 + 0.26 * fbm(vec2(ang * 4.0 + seed * 7.0, uTime * 0.1 + seed * 3.0));
    // (the fan fades in a little way out from its source: at the source itself a fan is a hard-edged point, so there
    // the light is only the round glow)
    float fan = cone * fall * streak * smoothstep(0.02, 0.4, d);
    float halo = exp(-d * d * 6.0) * 0.42;
    float edge = smoothstep(1.0, 0.72, abs(uv.x)) * smoothstep(1.0, 0.8, abs(uv.y));
    float k = (fan + halo) * edge;
    return vec4(vA.rgb * k, k * 0.06);
  }

  // a shaft of light from high up, fading toward its top
  vec4 shaft(vec2 uv, float t, float seed) {
    float x = abs(uv.x);
    float up = (uv.y + 1.0) * 0.5;
    float flick = 0.75 + 0.35 * noise(vec2(uv.x * 4.0 + seed, up * 3.0 - uTime * 3.0));
    float k = smoothstep(1.0, 0.1, x) * pow(1.0 - up, 1.2) * flick * (1.0 - t);
    float core = exp(-x * x * 28.0) * pow(1.0 - up, 0.8) * (1.0 - t);
    return vec4(vA.rgb * k * 0.8 + vec3(1.0) * core * 0.5, core * 0.16);
  }

  // specks going up from the ground and winking out: healing, a buff, an ember field
  vec4 rain(vec2 uv, float t, float seed, float tiny) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      float k = float(i);
      float fx = hash(vec2(k, seed)) * 1.7 - 0.85;
      float ph = fract(uTime * (0.45 + hash(vec2(seed, k)) * 0.4) + hash(vec2(k * 1.7, seed)));
      vec2 p = uv - vec2(fx + sin(ph * 6.0 + k) * 0.06, ph * 1.8 - 0.9);
      float s = exp(-dot(p * vec2(1.0, 0.55), p * vec2(1.0, 0.55)) * 420.0 * (1.0 + tiny * 8.0));
      acc += mix(vA.rgb, vec3(1.0), s) * s * (1.0 - ph);
    }
    float life = t < 0.0 ? 1.0 : sin(clamp(t, 0.0, 1.0) * 3.14159);
    return vec4(acc * 1.6 * life, 0.0);
  }

  // power being gathered: streaks falling inward
  vec4 gather(vec2 uv, float t, float seed) {
    float d = length(uv);
    float ang = atan(uv.y, uv.x);
    float n = pow(abs(cos(ang * 4.5 + seed)), 16.0);
    float ph = fract(d * 1.5 + uTime * 2.6);
    float k = n * ph * ph * smoothstep(1.0, 0.7, d) * smoothstep(0.05, 0.25, d);
    float core = exp(-d * d * 22.0) * smoothstep(0.0, 0.5, t);
    return vec4(vA.rgb * k * 1.5 + mix(vB.rgb, vec3(1.0), 0.5) * core, core * 0.4);
  }

  // where a shot in the air really is: a soft shadow, ringed
  vec4 markRing(vec2 uv) {
    float d = length(uv);
    float rim = exp(-pow((d - 0.82) / 0.085, 2.0));
    float a = smoothstep(1.0, 0.7, d) * 0.22 + rim * 0.5;
    return vec4(vA.rgb * rim * 0.7, a);
  }

  // a ring of force racing out along the ground: R and W are its radius and width in the quad
  vec4 shock(vec2 uv, float R, float W, float seed) {
    float d = length(uv);
    float x = (d - R) / max(W, 0.001);
    if (abs(x) > 1.0) return vec4(0.0);
    float ang = atan(uv.y, uv.x);
    float n = fbm(vec2(ang * 5.0 + seed, d * 6.0 - uTime * 2.0));
    float band = smoothstep(1.0, 0.25, abs(x));
    float heat = band * (0.55 + n * 0.9);
    vec3 c = mix(vA.rgb * 0.5, vA.rgb, smoothstep(0.2, 0.6, heat));
    c = mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.75, 1.0, heat));
    return vec4(c * band, band * 0.7);
  }

  // the arena closing in: everything past the line is lost
  vec4 collapseZone(vec2 uv, float R, float seed) {
    float d = length(uv);
    float ang = atan(uv.y, uv.x);
    float wob = (noise(vec2(ang * 18.0, uTime * 1.6)) - 0.5) * 0.012;
    float x = d - R + wob;
    float dark = smoothstep(-0.002, 0.012, x);
    float n = fbm(uv * 26.0 + vec2(uTime * 0.5, seed));
    vec3 c = mix(vec3(0.05, 0.0, 0.08), vec3(0.2, 0.02, 0.24), n);
    float rim = exp(-pow(x / 0.006, 2.0));
    vec3 rc = mix(vA.rgb, vB.rgb, 0.5 + 0.5 * sin(ang * 6.0 + uTime * 7.0));
    float a = dark * 0.62;
    return vec4(c * a + rc * rim * 1.3, clamp(a + rim * 0.5, 0.0, 1.0));
  }

  // someone's last breath, going up: a pale sheet with two dark eyes
  vec4 ghost(vec2 uv) {
    float top = length(vec2(uv.x * 1.5, max(uv.y - 0.1, 0.0) * 1.4));
    float hem = -0.85 + sin(uv.x * 11.0 + uTime * 5.0) * 0.08;
    float body = smoothstep(1.0, 0.86, top) * smoothstep(hem - 0.03, hem + 0.05, uv.y);
    vec2 e = vec2(abs(uv.x) - 0.2, uv.y - 0.25);
    float eye = smoothstep(0.1, 0.07, length(e * vec2(1.0, 0.75)));
    vec3 c = mix(vA.rgb, vec3(0.08, 0.06, 0.14), eye);
    float a = body * (0.72 + 0.2 * (uv.y + 1.0) * 0.5);
    return vec4(c * a, a);
  }

  // the water a wave leaves behind it: shallow, streaked with foam
  vec4 wake(vec2 uv, float seed) {
    float along = (uv.x + 1.0) * 0.5;
    float edge = smoothstep(1.0, 0.6, abs(uv.y)) * smoothstep(0.0, 0.25, along) * smoothstep(1.0, 0.9, along);
    float x = uv.y * 1.3 + seed;
    float n = noise(vec2(x * 3.0, along * 3.0 - uTime * 1.2));
    float streak = pow(1.0 - abs(noise(vec2(x * 5.0, along * 2.0 - uTime * 2.2)) - 0.5) * 2.0, 4.0);
    vec3 c = mix(vA.rgb, vB.rgb, along * 0.6 + n * 0.4);
    c = mix(c, mix(vec3(0.95, 1.0, 1.0), vB.rgb, 0.2), streak * along);
    float a = edge * (0.25 + along * 0.45);
    return vec4(c * a, a);
  }

  // a ray: its heart white-hot, its sides flowing
  vec4 beam(vec2 uv, float seed) {
    float y = abs(uv.y);
    float flow = noise(vec2(uv.x * 4.0 - uTime * 6.0, uv.y * 3.0 + seed));
    float side = smoothstep(1.0, 0.25, y + (flow - 0.5) * 0.35);
    float core = exp(-y * y * 24.0);
    float ends = smoothstep(1.0, 0.92, abs(uv.x));
    vec3 c = mix(vA.rgb, vB.rgb, flow) * side + vec3(1.0) * core;
    return vec4(c * ends, side * ends * 0.75);
  }

  // iron jaws seen from above, their catch winking when they're set
  vec4 trapJaws(vec2 uv, float armed) {
    float d = length(uv);
    float ang = atan(uv.y, uv.x);
    float tooth = abs(fract(ang * 1.9099) - 0.5) * 2.0;
    float outer = 0.66 + tooth * 0.3;
    float jaw = smoothstep(outer, outer - 0.06, d) * smoothstep(0.34, 0.4, d);
    float plate = smoothstep(0.3, 0.24, d);
    vec3 iron = vec3(0.5, 0.52, 0.58) * (0.72 + 0.34 * smoothstep(-0.6, 0.6, uv.y * -1.0 + uv.x * -0.3));
    vec3 c = iron * jaw + vec3(0.22, 0.22, 0.27) * plate;
    float wink = armed * (0.5 + 0.5 * sin(uTime * 8.0));
    c += vA.rgb * smoothstep(0.17, 0.05, d) * (0.3 + wink);
    float a = max(jaw, plate);
    return vec4(c * a, a);
  }

  // a ball of iron: lit from above, a gleam, its color only at its rim
  vec4 ironBall(vec2 uv) {
    float d = length(uv) / 0.8;
    if (d > 1.0) return vec4(0.0);
    vec3 n = vec3(uv / 0.8, sqrt(max(0.0, 1.0 - d * d)));
    float l = max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
    vec3 c = vA.rgb * (0.3 + l * 0.85);
    c += vec3(1.0) * pow(l, 26.0) * 0.8;
    c += vB.rgb * pow(1.0 - n.z, 3.0) * 0.4;
    float a = smoothstep(1.0, 0.94, d);
    return vec4(c * a, a);
  }

  // a column standing up out of the ground (a pillar of fire, of light, of shadow): a churning body nearly as wide as
  // its quad, a hot heart up its middle, its sides eaten by the noise and its top frayed. t: it shoots up in the first
  // fifth of its life, stands, then burns down thinner from the top and is gone
  vec4 column(vec2 uv, float t, float seed) {
    float y = (uv.y + 1.0) * 0.5;
    float reach = mix(0.08, 1.0, smoothstep(0.0, 0.2, t)) - smoothstep(0.5, 1.0, t) * 0.55;
    vec2 q = vec2(uv.x * 1.8 + seed, y * 2.6 - uTime * 2.4);
    float warp = fbm(q * 0.9 + vec2(seed, -uTime * 0.5));
    float n = fbm(q * 1.7 + warp * 1.2);
    float wide = mix(0.92, 0.55, pow(y, 0.8)) * (1.0 - smoothstep(0.45, 1.0, t) * 0.45);
    float across = abs(uv.x + (warp - 0.5) * 0.3 * y) / wide;
    float body = smoothstep(1.0, 0.45, across + (n - 0.5) * 0.55);
    float top = smoothstep(reach, reach - 0.3, y + (n - 0.5) * 0.25);
    float foot = smoothstep(0.0, 0.05, y);
    float core = exp(-across * across * 6.0);
    float n2 = noise(q * 4.2 + warp * 2.0);
    float i = clamp((body * (0.28 + n * 0.7 + (n2 - 0.5) * 0.34) + core * 0.22) * top * foot * (1.0 - smoothstep(0.7, 1.0, t)), 0.0, 1.0);
    float a = smoothstep(0.04, 0.42, i);
    vec3 c = mix(vA.rgb * 0.5, vA.rgb, smoothstep(0.08, 0.34, i));
    c = mix(c, vB.rgb, smoothstep(0.4, 0.7, i));
    c = mix(c, vec3(1.0, 0.97, 0.88), smoothstep(0.8, 1.0, i));
    float glow = exp(-abs(uv.x) * 2.2) * top * foot * 0.3 * (1.0 - t);
    return vec4(c * a + vA.rgb * glow * (1.0 - a), a * (0.88 - smoothstep(0.5, 1.0, i) * 0.4));
  }

  // the ground broken by a blow: jagged cracks running out from where it landed, lit from below by what struck it (fire,
  // light, shadow), over a scorched patch. t: fresh at 0, cold and gone at 1
  vec4 crack(vec2 uv, float t, float seed) {
    float d = length(uv);
    if (d > 1.0) return vec4(0.0);
    float ang = atan(uv.y, uv.x);
    float wob = (noise(vec2(d * 5.0, seed * 7.0)) - 0.5) * 0.8 + (noise(vec2(d * 13.0, seed * 3.0 + 4.0)) - 0.5) * 0.3;
    // eight long cracks round, and a finer set between them
    float s = ang * 1.2732 + seed * 3.1 + wob;
    float len = 0.5 + 0.5 * hash(vec2(floor(s), seed));
    float w = mix(0.045, 0.008, clamp(d / len, 0.0, 1.0));
    float line = smoothstep(w, w * 0.25, abs(fract(s) - 0.5) * 0.7854 * d) * smoothstep(len, len * 0.8, d);
    float s2 = ang * 2.5465 + seed * 5.3 + wob * 1.6 + 0.5;
    float len2 = 0.25 + 0.4 * hash(vec2(floor(s2), seed + 3.0));
    float line2 = smoothstep(0.012, 0.003, abs(fract(s2) - 0.5) * 0.3927 * d) * smoothstep(len2, len2 * 0.7, d) * 0.7;
    float cracks = max(line, line2);
    float cool = pow(1.0 - t, 1.6);
    float pit = exp(-d * d * 14.0);
    vec3 hot = mix(vA.rgb, vB.rgb, smoothstep(0.6, 0.0, d));
    vec3 add = (hot * (cracks * 1.4 + pit * 0.9) + vec3(1.0) * pow(cracks, 3.0) * 0.4 * smoothstep(0.5, 0.0, d)) * cool;
    float scorch = smoothstep(1.0, 0.25, d + (noise(uv * 6.0 + seed) - 0.5) * 0.3) * 0.5 * (1.0 - smoothstep(0.55, 1.0, t));
    return vec4(vec3(0.05, 0.035, 0.03) * scorch + add, scorch + cracks * 0.3 * cool);
  }

  // a magic circle underfoot: rings, a turning band of ticks, a star, coming up and going out
  vec4 rune(vec2 uv, float t, float seed) {
    float d = length(uv);
    if (d > 1.0) return vec4(0.0);
    float ang = atan(uv.y, uv.x);
    float fade = smoothstep(0.0, 0.2, t) * smoothstep(1.0, 0.65, t);
    float rings = exp(-pow((d - 0.93) / 0.03, 2.0)) + exp(-pow((d - 0.66) / 0.022, 2.0)) * 0.85;
    float ticks = step(0.72, cos(ang * 12.0 + uTime * 1.6 + seed)) * step(0.7, d) * step(d, 0.89);
    float star = 0.0;
    for (int i = 0; i < 3; i++) {
      float a0 = uTime * -0.7 + float(i) * 2.0944 + seed;
      vec2 nrm = vec2(cos(a0), sin(a0));
      star += exp(-pow((abs(dot(uv, nrm)) - 0.33) / 0.016, 2.0)) * step(d, 0.66);
    }
    float k = rings + ticks * 0.7 + star * 0.65;
    vec3 c = mix(vA.rgb, vB.rgb, smoothstep(0.3, 1.1, k));
    return vec4(c * k * fade, min(1.0, k) * 0.35 * fade);
  }

  void main() {
    float kind = vB.a;
    float t = vP.x;
    float seed = vP.y;
    vec4 o;
    if (kind < 0.5) o = orb(vUv, seed);
    else if (kind < 1.5) o = water(vUv, seed, vP.z);
    else if (kind < 2.5) o = flame(vUv, seed);
    else if (kind < 3.5) o = puff(vUv, t, seed);
    else if (kind < 4.5) {
      float d = length(vUv);
      float core = exp(-d * d * 9.0);
      float star = exp(-abs(vUv.x) * 9.0) * exp(-abs(vUv.y) * 2.4) + exp(-abs(vUv.y) * 9.0) * exp(-abs(vUv.x) * 2.4);
      float fade = clamp(1.3 - t * 1.3, 0.0, 1.0);
      o = vec4((vA.rgb * (core + star * 0.6) + vec3(1.0) * core * core) * fade, core * 0.4 * fade);
    } else if (kind < 5.5) {
      float d = length(vUv);
      float R = 0.2 + 0.78 * (1.0 - (1.0 - t) * (1.0 - t));
      float w = mix(0.1, 0.018, t);
      float n = 0.7 + 0.5 * noise(vec2(atan(vUv.y, vUv.x) * 3.0, seed));
      float band = exp(-pow((d - R) / w, 2.0));
      float fade = clamp(1.05 - t, 0.0, 1.0);
      o = vec4((vA.rgb * band * n * 1.1 + vec3(1.0) * pow(band, 5.0) * 0.28) * fade, band * 0.42 * fade);
    } else if (kind < 6.5) o = shadowBall(vUv, seed);
    else if (kind < 7.5) o = frost(vUv, seed);
    else if (kind < 8.5) o = poisonBlob(vUv, seed);
    else if (kind < 9.5) o = holyLight(vUv, seed);
    else if (kind < 10.5) o = boltArc(vP.z > 0.5 ? vUv.yx : vUv, seed);
    else if (kind < 11.5) o = slash(vUv, t, vP.z, vP.w);
    else if (kind < 12.5) o = field(vUv, t, seed, vP.z, vP.w);
    else if (kind < 13.5) o = warn(vUv, t, vP.z, vP.w, seed);
    else if (kind < 14.5) o = rift(vUv, seed);
    else if (kind < 15.5) {
      float d = length(vUv);
      float k = pow(max(0.0, 1.0 - d), 2.2);
      o = vec4(vA.rgb * k, k * 0.08);
    } else if (kind < 16.5) o = trail(vUv, seed);
    else if (kind < 17.5) {
      float d = length(vUv);
      float ang = atan(vUv.y, vUv.x) + seed + uTime * 1.5;
      float threads = exp(-abs(sin(ang * 3.0)) * 11.0);
      float rings = exp(-abs(fract(d * 3.0) - 0.5) * 13.0) * 0.8;
      float a = min(1.0, threads + rings) * smoothstep(1.0, 0.8, d) + exp(-d * d * 22.0);
      o = vec4(vA.rgb * a, min(1.0, a));
    } else if (kind < 18.5) o = shaft(vUv, t, seed);
    else if (kind < 19.5) o = waveFront(vUv, seed, vP.z);
    else if (kind < 20.5) o = impact(vUv, t, seed);
    else if (kind < 21.5) o = blast(vUv, t, seed);
    else if (kind < 22.5) o = bubble(vUv, t);
    else if (kind < 23.5) o = chip(vUv);
    else if (kind < 24.5) o = leaf(vUv);
    else if (kind < 25.5) o = rain(vUv, t, seed, vP.z);
    else if (kind < 26.5) o = gather(vUv, t, seed);
    else if (kind < 27.5) o = markRing(vUv);
    else if (kind < 28.5) o = shock(vUv, vP.z, vP.w, seed);
    else if (kind < 29.5) o = collapseZone(vUv, vP.z, seed);
    else if (kind < 30.5) o = ghost(vUv);
    else if (kind < 31.5) o = wake(vUv, seed);
    else if (kind < 32.5) o = beam(vUv, seed);
    else if (kind < 33.5) o = trapJaws(vUv, t);
    else if (kind < 34.5) o = ironBall(vUv);
    else if (kind < 35.5) o = rune(vUv, t, seed);
    else if (kind < 36.5) o = flake(vUv, seed);
    else if (kind < 37.5) o = spill(vUv, seed);
    else if (kind < 38.5) o = column(vUv, t, seed);
    else o = crack(vUv, t, seed);
    if (o.a <= 0.002 && dot(o.rgb, o.rgb) < 0.0001) discard;
    gl_FragColor = o * vA.a;
  }`;

const CAP = 1400;
const colors = new Map<string, readonly [number, number, number]>();
/** A CSS color's numbers: `#rgb`, `#rrggbb` or `rgb(a)(...)`. */
export function colorOf(css: string): readonly [number, number, number] {
  let c = colors.get(css);
  if (c) return c;
  if (css[0] === '#') {
    const h = css.length < 6 ? css.slice(1, 4).replace(/./g, (x) => x + x) : css.slice(1, 7);
    const n = parseInt(h, 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  } else {
    const m = css.match(/[\d.]+/g);
    c = m && m.length >= 3 ? [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255] : [1, 1, 1];
  }
  colors.set(css, c);
  return c;
}

/** One effect, in world pixels. */
export interface FxQuad {
  kind: FxKind;
  x: number;
  y: number;
  /** How far off the ground. */
  up?: number;
  /** Across and tall (or along the ground), world pixels. */
  w: number;
  h?: number;
  /** Radians, on the screen (or on the ground, if it lies flat). */
  rot?: number;
  /** Lies on the ground (or `up` over it), instead of facing the camera. */
  flat?: boolean;
  /** Faces the camera standing on its lower edge, rather than around its middle. */
  base?: boolean;
  /** Stays behind whoever or whatever is at its spot, rather than showing in front. */
  behind?: boolean;
  /** Wraps the big thing it stands on (a fire on a roof), rather than being cut by its parts. */
  over?: boolean;
  a: string;
  b?: string;
  alpha?: number;
  /** How far through its life (0 to 1). */
  t?: number;
  seed?: number;
  p1?: number;
  p2?: number;
}

export class Fx3D {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly pos = new Float32Array(CAP * 3);
  private readonly size = new Float32Array(CAP * 4);
  private readonly ca = new Float32Array(CAP * 4);
  private readonly cb = new Float32Array(CAP * 4);
  private readonly parm = new Float32Array(CAP * 4);
  private readonly attrs: THREE.InstancedBufferAttribute[];
  private n = 0;

  constructor(parent: THREE.Object3D) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    const attr = (name: string, data: Float32Array, n: number): THREE.InstancedBufferAttribute => {
      const a = new THREE.InstancedBufferAttribute(data, n).setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(name, a);
      return a;
    };
    this.attrs = [attr('iPos', this.pos, 3), attr('iSize', this.size, 4), attr('iA', this.ca, 4), attr('iB', this.cb, 4), attr('iP', this.parm, 4)];
    this.geo.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: LIGHT.uTime },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    // (after everything solid)
    this.mesh.renderOrder = 6;
    parent.add(this.mesh);
  }

  begin(): void {
    this.n = 0;
  }

  put(q: FxQuad): void {
    if (this.n >= CAP) return;
    const i = this.n++;
    this.pos[i * 3] = q.x / TILE;
    this.pos[i * 3 + 1] = (q.up ?? 0) / TILE + (q.flat ? 0.03 : 0);
    this.pos[i * 3 + 2] = q.y / TILE;
    this.size[i * 4] = q.w / TILE;
    this.size[i * 4 + 1] = (q.h ?? q.w) / TILE;
    this.size[i * 4 + 2] = q.rot ?? 0;
    this.size[i * 4 + 3] = q.flat ? 1 : (q.base ? 2 : 0) + (q.behind ? 4 : 0) + (q.over ? 8 : 0);
    const a = colorOf(q.a);
    const b = q.b ? colorOf(q.b) : a;
    this.ca[i * 4] = a[0];
    this.ca[i * 4 + 1] = a[1];
    this.ca[i * 4 + 2] = a[2];
    this.ca[i * 4 + 3] = q.alpha ?? 1;
    this.cb[i * 4] = b[0];
    this.cb[i * 4 + 1] = b[1];
    this.cb[i * 4 + 2] = b[2];
    this.cb[i * 4 + 3] = q.kind;
    this.parm[i * 4] = q.t ?? 0;
    this.parm[i * 4 + 1] = q.seed ?? 0;
    this.parm[i * 4 + 2] = q.p1 ?? 0;
    this.parm[i * 4 + 3] = q.p2 ?? 0;
  }

  end(): void {
    this.geo.instanceCount = this.n;
    if (this.n) for (const a of this.attrs) a.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
