import * as THREE from 'three';
import type { Pack, RigData } from './pack';

/**
 * The look of everything: flat colors from the vertices, a two-step sun, a soft rim and a dark ink line round
 * what moves. It shades in display colors on purpose, so the colors stay as loud as the packs painted them.
 *
 * Bones live in a texture (one row per animation frame, three texels per joint): a whole crowd shares one
 * skeleton's clips, and each figure only says which row it is on.
 */

export interface ClipRange {
  start: number;
  n: number;
  fps: number;
}

/**
 * A joint the file doesn't have, hanging from one that it does (a drake's wings): where it has moved from its place
 * at rest, in the model's own space, at a point of a clip (0 to 1 along it; `clip` null at rest).
 */
export interface ExtraJoint {
  name: string;
  parent: string;
  pose(clip: string | null, phase: number, out: THREE.Matrix4): void;
}

export class RigAnim {
  readonly tex: THREE.DataTexture;
  readonly clips: Record<string, ClipRange> = {};
  readonly joints: string[];
  /** Each joint's place in the model at rest (from its inverse bind matrix). */
  readonly ibm: Float32Array;
  private readonly total: number;
  private readonly data: Float32Array;
  private readonly rowLength: number;

  constructor(rig: RigData, bin: ArrayBuffer, extras: readonly ExtraJoint[] = []) {
    const J = rig.joints.length;
    const K = extras.length;
    this.joints = K ? [...rig.joints, ...extras.map((e) => e.name)] : rig.joints;
    this.ibm = Float32Array.from(rig.ibm);
    // (each clip has a row more than its frames: its first again, for the blend from its last back round to its start)
    let total = 1;
    for (const c of Object.values(rig.clips)) total += c.n + 1;
    this.total = total;
    this.rowLength = (J + K) * 3 * 4;
    const data = new Float32Array(this.rowLength * total);
    this.data = data;
    const world = new Float32Array(J * 16);
    const local = new Float32Array(16);
    const tmp = new Float32Array(16);
    const under = new Float32Array(16);
    const moved = new THREE.Matrix4();
    const parents = extras.map((e) => rig.joints.indexOf(e.parent));
    const write = (frame: number, j: number): void => {
      const at = frame * this.rowLength + j * 12;
      for (let r = 0; r < 3; r++) {
        data[at + r * 4] = tmp[r]!;
        data[at + r * 4 + 1] = tmp[r + 4]!;
        data[at + r * 4 + 2] = tmp[r + 8]!;
        data[at + r * 4 + 3] = tmp[r + 12]!;
      }
    };
    const row = (frame: number, clip: string | null = null, phase = 0): void => {
      for (let j = 0; j < J; j++) {
        // world[j] * ibm[j], top three rows
        mul(tmp, 0, world, j * 16, this.ibm, j * 16);
        write(frame, j);
      }
      for (let k = 0; k < K; k++) {
        const par = parents[k]!;
        mul(under, 0, world, par * 16, this.ibm, par * 16);
        extras[k]!.pose(clip, phase, moved);
        mul(tmp, 0, under, 0, moved.elements as unknown as Float32Array, 0);
        write(frame, J + k);
      }
    };
    const rest = rig.rest;
    const pose = (get: (j: number) => void): void => {
      for (let j = 0; j < J; j++) {
        get(j);
        const par = rig.parents[j]!;
        if (par < 0) mul(world, j * 16, Float32Array.from(rig.base), 0, local, 0);
        else mul(world, j * 16, world, par * 16, local, 0);
      }
    };
    // row 0: at rest
    pose((j) => compose(local, rest[j * 10]!, rest[j * 10 + 1]!, rest[j * 10 + 2]!, rest[j * 10 + 3]!, rest[j * 10 + 4]!, rest[j * 10 + 5]!, rest[j * 10 + 6]!, rest[j * 10 + 7]!, rest[j * 10 + 8]!, rest[j * 10 + 9]!));
    row(0);
    let next = 1;
    for (const [id, c] of Object.entries(rig.clips)) {
      const q = c.own ?? new Int16Array(bin, c.q, c.n * J * 4);
      const t = c.tj.length ? new Float32Array(bin, c.t, c.n * c.tj.length * 3) : null;
      const s = c.sj.length ? new Float32Array(bin, c.s, c.n * c.sj.length * 3) : null;
      for (let at = 0; at <= c.n; at++) {
        const f = at % c.n;
        pose((j) => {
          const ti = c.tj.indexOf(j);
          const si = c.sj.indexOf(j);
          const qa = (f * J + j) * 4;
          const k = 1 / 32767;
          const tx = t && ti >= 0 ? t[(f * c.tj.length + ti) * 3]! : rest[j * 10]!;
          const ty = t && ti >= 0 ? t[(f * c.tj.length + ti) * 3 + 1]! : rest[j * 10 + 1]!;
          const tz = t && ti >= 0 ? t[(f * c.tj.length + ti) * 3 + 2]! : rest[j * 10 + 2]!;
          const sx = s && si >= 0 ? s[(f * c.sj.length + si) * 3]! : rest[j * 10 + 7]!;
          const sy = s && si >= 0 ? s[(f * c.sj.length + si) * 3 + 1]! : rest[j * 10 + 8]!;
          const sz = s && si >= 0 ? s[(f * c.sj.length + si) * 3 + 2]! : rest[j * 10 + 9]!;
          compose(local, tx, ty, tz, q[qa]! * k, q[qa + 1]! * k, q[qa + 2]! * k, q[qa + 3]! * k, sx, sy, sz);
        });
        row(next + at, id, f / c.n);
      }
      this.clips[id] = { start: next, n: c.n, fps: c.fps };
      next += c.n + 1;
    }
    this.tex = new THREE.DataTexture(data, (J + K) * 3, total, THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
  }

  has(clip: string): boolean {
    return clip in this.clips;
  }

  /**
   * Where a clip is at `t` seconds in, as a row of the texture and how far on to the next: looping, or held on its last
   * frame. The shaders blend the two, so that a clip stored at 15 poses a second still moves at the display's rate.
   */
  frame(clip: string, t: number, loop = true): number {
    const c = this.clips[clip];
    if (!c) return 0;
    const f = t * c.fps;
    return c.start + (loop ? ((f % c.n) + c.n) % c.n : Math.min(Math.max(f, 0), c.n - 1));
  }

  /**
   * Where a point of the model at rest has gone in a pose (`a` and `b` rows as `frame()` says them, `k` how far from
   * the first to the second), the same way the shaders work it out: what rides on something moves exactly with it.
   */
  pointAt(a: number, b: number, k: number, joint: number, x: number, y: number, z: number, out: { x: number; y: number; z: number }): void {
    this.onRow(a, joint, x, y, z, out);
    if (k > 0.002) {
      const ax = out.x;
      const ay = out.y;
      const az = out.z;
      this.onRow(b, joint, x, y, z, out);
      out.x = ax + (out.x - ax) * k;
      out.y = ay + (out.y - ay) * k;
      out.z = az + (out.z - az) * k;
    }
  }

  private onRow(f: number, joint: number, x: number, y: number, z: number, out: { x: number; y: number; z: number }): void {
    const row = Math.floor(f);
    const k = f - row;
    const d = this.data;
    const a = row * this.rowLength + joint * 12;
    const b = (k > 0.004 ? row + 1 : row) * this.rowLength + joint * 12;
    const on = (at: number): number => d[at]! * x + d[at + 1]! * y + d[at + 2]! * z + d[at + 3]!;
    out.x = on(a) + (on(b) - on(a)) * k;
    out.y = on(a + 4) + (on(b + 4) - on(a + 4)) * k;
    out.z = on(a + 8) + (on(b + 8) - on(a + 8)) * k;
  }

  /** How long a clip runs, in seconds. */
  length(clip: string): number {
    const c = this.clips[clip];
    return c ? c.n / c.fps : 0;
  }

  dispose(): void {
    this.tex.dispose();
    void this.total;
  }
}

function mul(out: Float32Array, o: number, a: Float32Array, ai: number, b: Float32Array, bi: number): void {
  for (let c = 0; c < 4; c++) {
    const b0 = b[bi + c * 4]!;
    const b1 = b[bi + c * 4 + 1]!;
    const b2 = b[bi + c * 4 + 2]!;
    const b3 = b[bi + c * 4 + 3]!;
    for (let r = 0; r < 4; r++) out[o + c * 4 + r] = a[ai + r]! * b0 + a[ai + r + 4]! * b1 + a[ai + r + 8]! * b2 + a[ai + r + 12]! * b3;
  }
}

function compose(m: Float32Array, tx: number, ty: number, tz: number, x: number, y: number, z: number, w: number, sx: number, sy: number, sz: number): void {
  const l = Math.hypot(x, y, z, w) || 1;
  x /= l;
  y /= l;
  z /= l;
  w /= l;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  m[0] = (1 - 2 * (yy + zz)) * sx;
  m[1] = 2 * (xy + wz) * sx;
  m[2] = 2 * (xz - wy) * sx;
  m[3] = 0;
  m[4] = 2 * (xy - wz) * sy;
  m[5] = (1 - 2 * (xx + zz)) * sy;
  m[6] = 2 * (yz + wx) * sy;
  m[7] = 0;
  m[8] = 2 * (xz + wy) * sz;
  m[9] = 2 * (yz - wx) * sz;
  m[10] = (1 - 2 * (xx + yy)) * sz;
  m[11] = 0;
  m[12] = tx;
  m[13] = ty;
  m[14] = tz;
  m[15] = 1;
}

const rigAnims = new WeakMap<RigData, RigAnim>();
/** A skeleton's clips as a texture, made once. */
export function rigAnimOf(pack: Pack, rigName: string, extras?: readonly ExtraJoint[]): RigAnim {
  const rig = pack.rigs[rigName];
  if (!rig) throw new Error(`no rig ${rigName}`);
  let a = rigAnims.get(rig);
  if (!a) {
    a = new RigAnim(rig, pack.bin, extras);
    rigAnims.set(rig, a);
  }
  return a;
}

/* ------------------------------------------------------------------ what all materials share */

/** The light of the land: set once a frame, every material reads it. */
export const LIGHT = {
  uSun: { value: new THREE.Vector3(-0.42, 0.78, 0.46).normalize() },
  uLit: { value: new THREE.Color(1.08, 1.05, 1.0) },
  uMid: { value: new THREE.Color(0.86, 0.84, 0.88) },
  uShade: { value: new THREE.Color(0.58, 0.56, 0.72) },
  uTime: { value: 0 },
  /** The picture's size in its own pixels: what is thinned away is thinned in a pattern that goes with the figure (dither). */
  uRes: { value: new THREE.Vector2(1, 1) },
  /**
   * Where the hero stands (xyz), for the pool of light round them in a dark place; w 1 where what stands between the
   * camera and them thins away to show them (the world), 0 where nothing does (a portrait, the hall).
   */
  uSee: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** A color laid over everything (a's its strength): dusk, gloom, a land's own veil. */
  uGrade: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** The pool of light in a dark place: darkness (0-1), radius in tiles; xyz in uSee. */
  uDark: { value: new THREE.Vector4(0, 8, 0, 0) },
  /** Fires that light the dark: x, z (tiles) and reach (0: none). */
  uFlames: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
  /**
   * Night over a land (a's how far it has come): the color of the moon's light on things (rgb), which fires and lamps
   * push back with their own. All of it lit, near and far alike: a night, and not a pool of light with nothing past it.
   */
  uNight: { value: new THREE.Vector4(1, 1, 1, 0) },
  /**
   * Under a roof: the room's own dim light (rgb), and how much of it holds (a; 0 out of doors). Its fires push it back
   * in their own color (uFlameCol), and the hero carries a little light with them, so a deep place is dark and what
   * matters in it is lit.
   */
  uAmb: { value: new THREE.Vector4(1, 1, 1, 0) },
  uFlameCol: { value: new THREE.Vector3(1, 0.72, 0.42) },
  /** The light along the edge of whoever moves, turned away from the camera: it lifts them off what's behind them. */
  uRim: { value: new THREE.Vector3(0.5, 0.47, 0.4) },
};

type LightCopy = Record<string, unknown>;

/** Every light's value now, to be put back with `putLight`. */
export function copyLight(): LightCopy {
  const out: LightCopy = {};
  for (const [k, u] of Object.entries(LIGHT) as [string, { value: unknown }][]) {
    const v = u.value;
    out[k] = Array.isArray(v) ? v.map((x: THREE.Vector3) => x.clone()) : typeof v === 'number' ? v : (v as THREE.Vector3).clone();
  }
  return out;
}

/** Puts the lights back as `copyLight` found them. */
export function putLight(c: LightCopy): void {
  for (const [k, u] of Object.entries(LIGHT) as [string, { value: unknown }][]) {
    const v = c[k];
    if (v === undefined) continue;
    if (typeof v === 'number') (u as { value: number }).value = v;
    else if (Array.isArray(v)) (u.value as THREE.Vector3[]).forEach((x, i) => v[i] && x.copy(v[i] as THREE.Vector3));
    else (u.value as THREE.Vector3).copy(v as THREE.Vector3);
  }
}

/** The lights as they start: daylight out of doors, nothing over it. A picture for the menus is taken in them. */
const DAYLIGHT = copyLight();
export const daylight = (): void => putLight(DAYLIGHT);

const COMMON_VERT = /* glsl */ `
attribute vec3 aCol;
attribute vec4 iTint;
varying vec3 vCol;
varying vec3 vN;
varying vec3 vW;
varying float vFlash;
varying float vAlpha;
`;

const SKIN_VERT = /* glsl */ `
attribute vec3 aSkin;
attribute vec3 aSn;
attribute vec4 iAnim;
uniform highp sampler2D uAnim;
mat4 bone(int j, int f) {
  vec4 a = texelFetch(uAnim, ivec2(j * 3, f), 0);
  vec4 b = texelFetch(uAnim, ivec2(j * 3 + 1, f), 0);
  vec4 c = texelFetch(uAnim, ivec2(j * 3 + 2, f), 0);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
mat4 skinAt(int f) {
  float w = aSkin.z / 255.0;
  mat4 m = bone(int(aSkin.x + 0.5), f) * w;
  if (w < 0.995) m += bone(int(aSkin.y + 0.5), f) * (1.0 - w);
  return m;
}
mat4 poseAt(float f) {
  float row = floor(f);
  float k = f - row;
  mat4 m = skinAt(int(row));
  if (k > 0.004) m = m * (1.0 - k) + skinAt(int(row) + 1) * k;
  return m;
}
mat4 posed() {
  mat4 m = poseAt(iAnim.x);
  if (iAnim.z > 0.002) m = m * (1.0 - iAnim.z) + poseAt(iAnim.y) * iAnim.z;
  return m;
}
`;

const FRAG_COMMON = /* glsl */ `
// how much of a night falls on whoever moves in it (the ground takes all of it), and the moon's light along their edges
const float NIGHT_ON_FIGURES = 0.42;
const vec3 MOON_RIM = vec3(0.24, 0.32, 0.58);
uniform vec3 uSun;
uniform vec3 uLit;
uniform vec3 uMid;
uniform vec3 uShade;
uniform vec4 uGrade;
uniform vec4 uDark;
uniform vec4 uSee;
uniform vec3 uFlames[8];
uniform vec4 uNight;
uniform vec4 uAmb;
uniform vec3 uFlameCol;
uniform vec3 uRim;
varying vec3 vCol;
varying vec3 vN;
varying vec3 vW;
varying float vFlash;
varying float vAlpha;
/**
 * What stands between the camera and the hero (a wall, a column, a roof's edge, a tree) thins away round the line from
 * the one to the other: a fine dither, more of it the nearer that line, never all of it, so the hero is always seen and
 * nothing pops in or out (it moves as smoothly as the hero does). The floor and what lies on it are never touched. Off
 * where uSee.w is 0 (a portrait, the hall).
 */
void seeThrough() {
  if (uSee.w <= 0.0 || vW.y < 0.32) return;
  vec3 hc = cameraPosition - uSee.xyz;
  float len = length(hc);
  vec3 dir = hc / len;
  float s = dot(vW - uSee.xyz, dir);
  if (s <= 0.2) return;
  float d = length(vW - (uSee.xyz + dir * s));
  // (wide enough for a fight round the hero, not only the hero: the canopy hid the foes at their feet)
  float R = 1.6 + s * 0.15;
  float k = smoothstep(R, R * 0.3, d) * smoothstep(0.2, 1.1, s) * 0.86;
  if (k <= 0.0) return;
  float dx = mod(gl_FragCoord.x, 4.0);
  float dy = mod(gl_FragCoord.y, 4.0);
  float th = (mod(dx + dy * 2.0, 4.0) + mod(dx * 2.0 + dy, 2.0) * 0.5 + 0.25) / 4.5;
  if (k > th) discard;
}
vec3 toon(vec3 base, vec3 n) {
  float d = dot(n, uSun);
  float a = smoothstep(-0.04, 0.04, d);
  float b = smoothstep(0.42, 0.5, d);
  vec3 c = base * mix(uShade, mix(uMid, uLit, b), a);
  return c;
}
/** The firelight on this spot at night, 0 to 1. */
float fireHere() {
  float fire = 0.0;
  for (int i = 0; i < 8; i++) {
    if (uFlames[i].z > 0.0) {
      float t = 1.0 - clamp(length(vW.xz - uFlames[i].xy) / uFlames[i].z, 0.0, 1.0);
      fire += t * t * (3.0 - 2.0 * t);
    }
  }
  return min(fire, 1.0);
}
vec3 nightOver(vec3 c, float amount) {
  float g = dot(c, vec3(0.3, 0.59, 0.11));
  vec3 moon = mix(vec3(g), c, 0.68) * uNight.rgb;
  vec3 warm = c * vec3(1.08, 0.92, 0.72);
  return mix(c, mix(moon, warm, fireHere()), uNight.a * amount);
}
/**
 * The light of a room under a roof on this spot: its own dimness, each fire's pool in the fire's color (brightest at
 * its foot, never ruled off at an edge), and the light the hero carries. spare is how much of the dark this is spared
 * (who moves is spared some of it, so a figure never muddies into the floor).
 */
vec3 roomLight(float spare) {
  float fire = 0.0;
  for (int i = 0; i < 8; i++) {
    if (uFlames[i].z > 0.0) {
      float t = 1.0 - clamp(length(vW.xz - uFlames[i].xy) / (uFlames[i].z * 1.3), 0.0, 1.0);
      fire += t * t;
    }
  }
  float hero = 1.0 - smoothstep(1.5, 9.5, length(vW.xz - uSee.xz));
  // (toward full light in the fire's color, never past it: a pool of light, not a white hole)
  float f = 1.0 - exp(-fire * 1.5);
  vec3 l = mix(uAmb.rgb, uFlameCol * 1.12, f * 0.78);
  l += (vec3(1.0) - l) * hero * 0.5;
  l = mix(l, max(l, vec3(0.96)), spare);
  return mix(vec3(1.0), l, uAmb.a);
}
vec3 finishWith(vec3 c, float night) {
  c = mix(c, uGrade.rgb, uGrade.a);
  if (uAmb.a > 0.0) c *= roomLight((1.0 - night) * 0.9);
  if (uNight.a > 0.0) c = nightOver(c, night);
  if (uDark.x > 0.0) {
    float d = length(vW.xz - uSee.xz);
    float k = smoothstep(uDark.y * 0.45, uDark.y, d);
    for (int i = 0; i < 8; i++) {
      if (uFlames[i].z > 0.0) k = min(k, smoothstep(uFlames[i].z * 0.3, uFlames[i].z, length(vW.xz - uFlames[i].xy)));
    }
    c *= mix(1.0, 1.0 - uDark.x, k);
  }
  return c;
}
vec3 finish(vec3 c) {
  return finishWith(c, 1.0);
}
`;

/**
 * A figure thinned away (a hero in the shroud, a body sinking): a fine pattern of points left out. The pattern is laid
 * from where the figure stands on the screen (vRoot), so it goes with them as they move. It was laid on the screen
 * itself, and a figure walking through it shimmered, every point of them flickering on and off as it crossed (the
 * owner: "no jiterring of effects on spells and characters (mostly thinking about the jittery rogue gloamknight while
 * moving)": the Nightblade is in the shroud half the match).
 */
const ROOT_VERT = /* glsl */ `
  vec4 rootAt = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vRoot = (rootAt.xy / max(rootAt.w, 0.0001) * 0.5 + 0.5) * uRes;`;

function dither(): string {
  return /* glsl */ `
  if (vAlpha < 0.995) {
    vec2 cell = floor(gl_FragCoord.xy - vRoot);
    float dx = mod(cell.x, 4.0);
    float dy = mod(cell.y, 4.0);
    float th = (mod(dx + dy * 2.0, 4.0) + mod(dx * 2.0 + dy, 2.0) * 0.5 + 0.25) / 4.5;
    if (vAlpha < th) discard;
  }`;
}

/**
 * What moves: skinned from the bone texture, one instance per figure. What glows on it (meshKit.ts glowing: a normal too
 * short to light) shows its own color, unshaded, by day and by night alike.
 */
export function animMaterial(anim: RigAnim): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...LIGHT, uAnim: { value: anim.tex } },
    vertexShader: /* glsl */ `
      ${COMMON_VERT}
      ${SKIN_VERT}
      uniform vec2 uRes;
      varying vec2 vRoot;
      varying float vGlow;
      void main() {
        vGlow = step(dot(normal, normal), 0.0008);
        mat4 m = posed();
        vec4 p = m * vec4(position, 1.0);
        vec3 n = mat3(m) * normal;
        vec4 w = modelMatrix * instanceMatrix * p;
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
        vCol = aCol * iTint.rgb;
        vFlash = iTint.a;
        vAlpha = iAnim.w;
        ${ROOT_VERT}
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_COMMON}
      varying vec2 vRoot;
      varying float vGlow;
      void main() {
        ${dither()}
        if (vGlow > 0.5) {
          gl_FragColor = vec4(mix(min(vCol * 1.08 + 0.03, vec3(1.0)), vec3(1.0, 0.97, 0.9), vFlash), 1.0);
          return;
        }
        vec3 n = normalize(vN);
        vec3 c = toon(vCol, n);
        // a touch of sky on what faces up, so dark armor keeps its shape
        c += vec3(0.05, 0.06, 0.09) * max(n.y, 0.0);
        // and a light along the edge turned from the camera, strongest up top: a figure reads against any floor
        vec3 toEye = normalize(cameraPosition - vW);
        float rim = pow(1.0 - clamp(dot(n, toEye), 0.0, 1.0), 2.6) * smoothstep(-0.35, 0.5, n.y);
        c += uRim * rim * (0.55 + 0.45 * vCol);
        // at night, whoever's out in it stands out of it: less of the dark on them, and the moon along their edges, and
        // their own rim kept (the Prologue's first quarter hour is a night: small figures were lost on its dark ground;
        // POLISH_PLAN.md piece 9)
        c = finishWith(c, NIGHT_ON_FIGURES);
        if (uNight.a > 0.0) {
          c += MOON_RIM * pow(1.0 - clamp(dot(n, vec3(0.0, 0.766, 0.643)), 0.0, 1.0), 2.6) * uNight.a;
          c += uRim * rim * 0.45 * uNight.a;
        }
        c = mix(c, vec3(1.0, 0.97, 0.9), vFlash);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/**
 * A great figure, frozen: its colors washed toward plain stone (iTint.a says how far), and whatever of it is under
 * the ground not drawn.
 */
export function colossusMaterial(anim: RigAnim): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...LIGHT, uAnim: { value: anim.tex } },
    vertexShader: /* glsl */ `
      ${COMMON_VERT}
      ${SKIN_VERT}
      void main() {
        mat4 m = posed();
        vec4 p = m * vec4(position, 1.0);
        vec3 n = mat3(m) * normal;
        vec4 w = modelMatrix * instanceMatrix * p;
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
        float lum = dot(aCol, vec3(0.3, 0.59, 0.11));
        vCol = mix(aCol, vec3(0.45 + lum * 0.65), iTint.a) * iTint.rgb;
        vFlash = 0.0;
        vAlpha = 1.0;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_COMMON}
      void main() {
        if (vW.y < 0.0) discard;
        vec3 n = normalize(vN);
        vec3 c = toon(vCol, n);
        gl_FragColor = vec4(finish(c), 1.0);
      }`,
  });
}

/** The ink line round what moves: the same figure, a little bigger, inside out. */
export function inkMaterial(anim: RigAnim, width: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { ...LIGHT, uAnim: { value: anim.tex }, uInk: { value: width } },
    vertexShader: /* glsl */ `
      ${COMMON_VERT}
      ${SKIN_VERT}
      uniform vec2 uRes;
      varying vec2 vRoot;
      uniform float uInk;
      void main() {
        mat4 m = posed();
        vec4 p = m * vec4(position, 1.0);
        vec3 sn = normalize(mat3(m) * aSn);
        p.xyz += sn * uInk;
        vec4 w = modelMatrix * instanceMatrix * p;
        vW = w.xyz;
        vN = vec3(0.0, 1.0, 0.0);
        vCol = vec3(0.0);
        vFlash = iTint.a;
        vAlpha = iAnim.w;
        ${ROOT_VERT}
        gl_Position = projectionMatrix * viewMatrix * w;
        // (what glows has no ink round it: it's light, not a thing: past the far plane, so never drawn)
        if (dot(normal, normal) < 0.0008) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_COMMON}
      varying vec2 vRoot;
      void main() {
        ${dither()}
        vec3 c = mix(vec3(0.075, 0.05, 0.1), vec3(1.0, 0.95, 0.75), vFlash);
        gl_FragColor = vec4(finish(c), 1.0);
      }`,
  });
}

/** A hero behind a wall or a tree: their shape, in a broken-up color, wherever something else already stands in front. */
export function xrayMaterial(anim: RigAnim): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    uniforms: { uAnim: { value: anim.tex } },
    vertexShader: /* glsl */ `
      ${SKIN_VERT}
      void main() {
        mat4 m = posed();
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * (m * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      void main() {
        if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 0.5) discard;
        gl_FragColor = vec4(0.5, 0.92, 1.0, 1.0);
      }`,
  });
}

/** Rings on the ground that belong to someone (the hero's, an elite's): under feet, behind what stands in front. */
export const ringMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {},
  vertexShader: /* glsl */ `
    attribute vec4 iRing;
    varying vec2 vUv;
    varying vec4 vRing;
    void main() {
      vUv = uv * 2.0 - 1.0;
      vRing = iRing;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying vec4 vRing;
    void main() {
      float d = length(vUv);
      float a = smoothstep(0.78, 0.86, d) * smoothstep(1.0, 0.94, d);
      a += smoothstep(0.86, 0.0, d) * 0.1;
      gl_FragColor = vec4(vRing.rgb, a * vRing.a);
    }`,
});

/** What stands still: trees, houses, furniture. Leaves stir. */
export const staticMaterial = new THREE.ShaderMaterial({
  uniforms: { ...LIGHT },
  vertexShader: /* glsl */ `
    ${COMMON_VERT}
    uniform float uTime;
    void main() {
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      // iTint.a: how much it stirs in the wind
      if (iTint.a > 0.0) {
        float h = max(position.y, 0.0);
        float ph = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.9;
        w.x += sin(uTime * 1.5 + ph + h) * 0.02 * h * iTint.a;
        w.z += cos(uTime * 1.2 + ph) * 0.012 * h * iTint.a;
      }
      vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      vCol = aCol * iTint.rgb;
      vFlash = 0.0;
      vAlpha = 1.0;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    ${FRAG_COMMON}
    void main() {
      seeThrough();
      vec3 n = normalize(vN);
      vec3 c = toon(vCol, n);
      // what stands is darker at its foot, where it meets the ground and the light doesn't reach (not what lies flat),
      // and under a roof a wall goes on darkening down its whole height
      float up = max(n.y, 0.0);
      c *= mix(0.68, 1.0, clamp(smoothstep(0.0, 0.62, vW.y) + up, 0.0, 1.0));
      if (uAmb.a > 0.0) c *= mix(0.86, 1.04, clamp(smoothstep(0.0, 2.4, vW.y) + up, 0.0, 1.0));
      gl_FragColor = vec4(finish(c), 1.0);
    }`,
});

/** The same, on its way into being: there's a little more of it at each point as `uFade` goes from 0 to 1. */
export function fadingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...LIGHT, uFade: { value: 0 } },
    vertexShader: staticMaterial.vertexShader,
    fragmentShader: /* glsl */ `
      ${FRAG_COMMON}
      uniform float uFade;
      void main() {
        float dx = mod(gl_FragCoord.x, 4.0);
        float dy = mod(gl_FragCoord.y, 4.0);
        float th = (mod(dx + dy * 2.0, 4.0) + mod(dx * 2.0 + dy, 2.0) * 0.5 + 0.25) / 4.5;
        if (uFade < th) discard;
        vec3 c = toon(vCol, normalize(vN));
        gl_FragColor = vec4(finish(c), 1.0);
      }`,
  });
}

/** How worked up The Ring's crowd is (0-1): it bounces when something happens, and settles by itself. */
export const CROWD = { uCheer: { value: 0 } };

/** The people watching: each bobs at its own pace from where it stands, and jumps when there's something to cheer. */
export const crowdMaterial = new THREE.ShaderMaterial({
  uniforms: { ...LIGHT, ...CROWD },
  vertexShader: /* glsl */ `
    ${COMMON_VERT}
    uniform float uTime;
    uniform float uCheer;
    void main() {
      float ph = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
      vec3 p = position;
      p.x += sin(uTime * (0.8 + ph) + ph * 6.283) * 0.07 * max(p.y, 0.0);
      vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
      float hop = max(0.0, sin(uTime * (3.2 + ph * 3.0) + ph * 6.283));
      w.y += hop * hop * (0.015 + 0.3 * uCheer);
      vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      vCol = aCol * iTint.rgb;
      vFlash = 0.0;
      vAlpha = 1.0;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: staticMaterial.fragmentShader,
});

/**
 * The same for what stands half in the ground (the ground is a layer of its own under everything that stands, so
 * what is below it has to stop being drawn). Only great things use it: throwing away pixels costs a phone a little.
 */
export const sunkMaterial = new THREE.ShaderMaterial({
  uniforms: staticMaterial.uniforms,
  vertexShader: staticMaterial.vertexShader,
  fragmentShader: /* glsl */ `
    ${FRAG_COMMON}
    void main() {
      if (vW.y < 0.0) discard;
      vec3 c = toon(vCol, normalize(vN));
      gl_FragColor = vec4(finish(c), 1.0);
    }`,
});

/** Soft round shadows on the ground, one quad each. */
export const shadowMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {},
  // a dark contact shadow right under what stands, and its longer, softer shadow thrown away from the sun (the sun is
  // up to the left and in front: shadows fall back and to the right), so a figure sits on the ground and pops off it
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = (uv * 2.0 - 1.0) * 1.9;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position * 1.9, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      float contact = smoothstep(0.95, 0.25, length(vUv * vec2(1.0, 1.15))) * 0.5;
      vec2 dir = normalize(vec2(0.62, 0.5));
      vec2 q = vUv - dir * 0.72;
      // (stretched along the way it falls)
      vec2 r = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
      float thrown = smoothstep(1.0, 0.15, length(r * vec2(0.62, 1.15))) * 0.3;
      float a = max(contact, thrown) + contact * thrown * 0.4;
      gl_FragColor = vec4(0.05, 0.035, 0.12, min(a, 0.62));
    }`,
});
