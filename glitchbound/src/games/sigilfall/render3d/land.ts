import * as THREE from 'three';
import { hash2 } from '../core/math';
import { modelOnLot, picBody } from '../data/buildingArt';
import { ARENAS, type Floor } from '../data/dungeongen';
import { REGIONS } from '../data/regions';
import { GREAT, type GreatPart } from '../data/greatworks';
import { THEMES, type ThemeLook, type TreeKind } from '../data/themes';
import type { RegionDef } from '../data/types';
import { ART_TILE, K, TILE, type PlacedMarker, type TileMap } from '../sim/map';
import { hexRgb } from './kits';
import type { Colossus } from './cast';
import { PROPS, type PropDef } from '../data/props';
import { loadPack, type MeshData, type Pack } from './pack';
import { fadingMaterial, LIGHT, shadowMaterial, staticMaterial } from './toon';
import { Stand } from './crowd';
import { caveMouth, DOORWAYS } from './doorways';
import { builtProp } from './propsBuilt';

/**
 * A land in 3D, from the same tile map the game's rules walk on: a painted ground (one draw call), solid blocks
 * for walls and cliffs, and trees, houses and furniture placed tile by tile. Only what is near the camera is
 * drawn, however big the land is.
 */

/** Tiles per world pixel. */
export const UNIT = 1 / TILE;
/** How far the camera looks down from level. */
export const PITCH = (50 * Math.PI) / 180;

export interface LandPacks {
  /** The people's parts and weapons: a giant's sword is the same sword. */
  hero: Pack;
  nature: Pack;
  town: Pack;
  indoor: Pack;
}

let lands: Promise<LandPacks> | null = null;
export function loadLand(): Promise<LandPacks> {
  if (!lands) {
    lands = Promise.all([loadPack('nature'), loadPack('town'), loadPack('indoor'), loadPack('hero')]).then(([nature, town, indoor, hero]) => ({ nature, town, indoor, hero }));
    lands.catch(() => (lands = null));
  }
  return lands;
}

/** What stands somewhere: a kind other code can ask about. */
export interface LandObject {
  x: number;
  y: number;
  kind: string;
  /** Its name in the data, when it has one (a prop). */
  name?: string;
  /** Its height in world pixels. */
  dy: number;
}

interface Placed {
  m: string;
  x: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  g: number;
  b: number;
  sway: number;
  shadow: number;
  /** How deep the shadow is, next to how wide (a long table's isn't round). */
  shadowD?: number;
  y: number;
  /** Tipped over (radians, forward and sideways). */
  tipX?: number;
  tipZ?: number;
}

/** A great thing's piece, big enough that its middle going out of view doesn't mean it has. */
interface Giant extends Placed {
  reach: number;
}

/* ------------------------------------------------------------------ what grows where */

const TREES: Record<TreeKind, { m: string[]; h: number }> = {
  oak: { m: ['Tree_1_A', 'Tree_1_B', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C'], h: 3.5 },
  // (all of a kind from the one art set as the heroes and the rest of the wood: the plainer low-poly pines and dead
  // trees of another set stood out among them)
  pine: { m: ['Tree_4_A', 'Tree_4_B'], h: 4 },
  snowpine: { m: ['Tree_4_A', 'Tree_4_B'], h: 4 },
  palm: { m: ['tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmDetailedShort'], h: 3.6 },
  dead: { m: ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_2_A', 'Tree_Bare_2_B'], h: 3.2 },
  cactus: { m: ['cactus_tall', 'cactus_short'], h: 1.5 },
  mushroom: { m: ['mushroom_redTall', 'mushroom_tanTall', 'mushroom_red'], h: 1.9 },
  crystal: { m: ['stone_tallA', 'stone_tallE'], h: 2 },
  willow: { m: ['Tree_5_A', 'Tree_5_B', 'Tree_5_D'], h: 3.5 },
  jungle: { m: ['Tree_6_A', 'Tree_7_A', 'Tree_7_B', 'Tree_3_A'], h: 4 },
} as Record<TreeKind, { m: string[]; h: number }>;

/** A pine in a snowy land: frosted pale. */
const FROST = [0.86, 0.97, 1.08] as const;

/** A wood's floor: how high it stands, and its moss (a little darker than the land's grass, so a wood reads as one). */
const WOOD_FLOOR = 0.03;
const mossOf = (look: ThemeLook, k = 0.9): [number, number, number] => {
  const [r, g, b] = hexRgb(look.ground.grass[0]);
  return [r * k, g * k, b * k];
};

const TREE_MODELS = new Set(Object.values(TREES).flatMap((t) => t.m));

const BUSHES = ['Bush_1_A', 'Bush_1_B', 'Bush_1_D', 'Bush_2_A', 'Bush_2_C', 'Bush_3_A', 'Bush_4_A', 'Bush_4_C'];
const ROCKS = ['Rock_1_A', 'Rock_1_D', 'Rock_2_C', 'Rock_3_A', 'Rock_4_C', 'Rock_5_C', 'Rock_6_C'];
const TUFTS = ['Grass_1_A', 'Grass_2_A', 'Grass_1_B', 'Grass_2_B'];
/** What grows under a wood's trees (cleared off a road out with the trees). */
const WOOD_SMALL = new Set([...BUSHES, ...ROCKS, ...TUFTS]);
const FLOWERS = ['flower_redA', 'flower_yellowA', 'flower_purpleA'];


/** A dungeon's way in that's a model of its own; the ones no model would do (a stair, a hole in a hill) are in doorways.ts. */
const ENTRANCES: Record<string, { m: string; w: number; tint?: string }> = {
  'barrow-of-kings': { m: 'crypt-large-door', w: 3 },
  'gallows-keep': { m: 'gate', w: 3, tint: '#a09a90' },
  'siege-of-highwall': { m: 'gate', w: 3.2 },
  duskspire: { m: 'gate', w: 3.2, tint: '#7a7488' },
  'tomb-of-the-sun-king': { m: 'arch_gate', w: 3, tint: '#f0d8a0' },
  'spire-of-the-rift': { m: 'arch', w: 3, tint: '#c0a0f0' },
  'vaelmoor-remembered': { m: 'arch', w: 3, tint: '#d8d8f0' },
};

/** The size a model takes to keep within a prop's limits. */
function sizeWithin(m: MeshData, def: PropDef): { sx: number; sy: number; sz: number; rot: number } {
  let xw = Math.max(0.01, m.max[0] - m.min[0]);
  let zw = Math.max(0.01, m.max[2] - m.min[2]);
  const tall = Math.max(0.01, m.max[1] - m.min[1]);
  const rot = def.across && zw > xw ? Math.PI / 2 : 0;
  if (rot) [xw, zw] = [zw, xw];
  const w = (def.w ?? TILE) / TILE;
  const d = (def.d ?? TILE) / TILE;
  if (def.box) return { sx: w / xw, sy: (def.h ?? TILE) / TILE / tall, sz: d / zw, rot };
  if (def.flat) {
    const fx = w / xw;
    const fz = d / zw;
    return rot ? { sx: fz, sy: 1, sz: fx, rot } : { sx: fx, sy: 1, sz: fz, rot };
  }
  const k = Math.min(w / xw, d / zw, (def.h ?? 9999) / TILE / tall);
  return { sx: k, sy: k, sz: k, rot };
}

/* ------------------------------------------------------------------ what a fire burns on */

export interface RoofSpot {
  x: number;
  y: number;
  z: number;
}

const NO_ROOF: readonly RoofSpot[] = [];
const roofsOfModels = new WeakMap<MeshData, RoofSpot[]>();

/**
 * Points scattered over a model's roof, in its own units: the faces high on it that look up and toward the camera,
 * each getting points by its area (a chimney's little cap hardly any, and what stands over the ridge none).
 */
function roofOfModel(m: MeshData): RoofSpot[] {
  const had = roofsOfModels.get(m);
  if (had) return had;
  const p = m.pos;
  const low = m.min[1] + (m.max[1] - m.min[1]) * 0.42;
  const found: { a: number; b: number; c: number; size: number }[] = [];
  for (let i = 0; i + 2 < m.i; i += 3) {
    const a = m.idx[i]! * 3;
    const b = m.idx[i + 1]! * 3;
    const c = m.idx[i + 2]! * 3;
    const ux = p[b]! - p[a]!;
    const uy = p[b + 1]! - p[a + 1]!;
    const uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!;
    const vy = p[c + 1]! - p[a + 1]!;
    const vz = p[c + 2]! - p[a + 2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const size = Math.hypot(nx, ny, nz);
    if (size < 1e-7) continue;
    // (up, and toward the camera: the camera is south of everything and looks down at 50 degrees)
    if (ny / size < 0.3 || (ny / size) * Math.sin(PITCH) + (nz / size) * Math.cos(PITCH) < 0.25) continue;
    if ((p[a + 1]! + p[b + 1]! + p[c + 1]!) / 3 < low) continue;
    found.push({ a, b, c, size });
  }
  // (a roof is its big faces; a chimney's cap and a ridge's trim are small ones)
  const biggest = found.reduce((b, f) => Math.max(b, f.size), 0);
  const big = found.filter((f) => f.size > biggest * 0.06);
  const faces: { a: number; b: number; c: number; upTo: number }[] = [];
  let total = 0;
  for (const f of big.length >= 2 ? big : found) {
    total += f.size;
    faces.push({ a: f.a, b: f.b, c: f.c, upTo: total });
  }
  const out: RoofSpot[] = [];
  for (let i = 0; i < 60 && faces.length; i++) {
    const at = hash2(i, 91) * total;
    const f = faces.find((x) => x.upTo >= at) ?? faces[faces.length - 1]!;
    let r = hash2(i, 92);
    let q = hash2(i, 93);
    if (r + q > 1) {
      r = 1 - r;
      q = 1 - q;
    }
    const w = 1 - r - q;
    out.push({ x: p[f.a]! * w + p[f.b]! * r + p[f.c]! * q, y: p[f.a + 1]! * w + p[f.b + 1]! * r + p[f.c + 1]! * q, z: p[f.a + 2]! * w + p[f.b + 2]! * r + p[f.c + 2]! * q });
  }
  // (nothing over the ridge, which is the height most of the upper points reach)
  const heights = out.map((q) => q.y).sort((a, b) => a - b);
  const ridge = heights[Math.floor(heights.length * 0.9)] ?? 0;
  const roof = out.filter((q) => q.y <= ridge);
  roofsOfModels.set(m, roof);
  return roof;
}

/* ------------------------------------------------------------------ recoloring for a land */

function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function rgbOf(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/**
 * One world's materials, whichever pack a model came from: all timber is the same weathered oak, nothing is
 * candy-bright, so a crate from one pack and a house from another look made by the same hands.
 */
function harmonize(col: Uint8Array, n: number): void {
  for (let v = 0; v < n; v++) {
    const i = v * 3;
    const [h, s, l] = hsl(col[i]! / 255, col[i + 1]! / 255, col[i + 2]! / 255);
    let to: [number, number, number] | null = null;
    // timber and thatch, from orange to tan
    if (h >= 12 && h <= 46 && s > 0.2 && l < 0.88) to = rgbOf(26 + (h - 28) * 0.35, Math.min(0.48, s * 0.7), Math.max(0.09, l > 0.5 ? l * 0.6 : l * 0.8));
    // anything else that shouts
    else if (s > 0.62 && l > 0.3) to = rgbOf(h, s * 0.8, l * 0.92);
    if (!to) continue;
    col[i] = to[0] * 255;
    col[i + 1] = to[1] * 255;
    col[i + 2] = to[2] * 255;
  }
}

/** Green leaves take the land's own leaf colors, dark to light; bark and rock take its bark and stone. */
function colorsFor(m: MeshData, look: ThemeLook, id: string): Uint8Array {
  const out = new Uint8Array(m.col);
  if (id.startsWith('built_')) return out;
  // (bone is bone, not timber, and hay, a pumpkin and a flower aren't timber either)
  if (!/ribcage|skull|bone_|pumpkin|haybale|flower_|crops_/.test(id)) harmonize(out, m.n);
  const roof = id.split('#')[1];
  if (roof) {
    const [rr, rg, rb] = hexRgb(`#${roof}`);
    for (let v = 0; v < m.n; v++) {
      const i = v * 3;
      const [h, s, l] = hsl(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255);
      if (h < 190 || h > 265 || s < 0.18) continue;
      const f = 0.45 + l * 1.15;
      out[i] = Math.min(255, rr * 255 * f);
      out[i + 1] = Math.min(255, rg * 255 * f);
      out[i + 2] = Math.min(255, rb * 255 * f);
    }
    return out;
  }
  const leaves = look.leaves.map((c): [number, number, number] => {
    const [r, g, b] = hexRgb(c);
    const lum = r * 0.3 + g * 0.59 + b * 0.11;
    const k = 0.8;
    return [(lum + (r - lum) * k) * 0.93, (lum + (g - lum) * k) * 0.93, (lum + (b - lum) * k) * 0.88];
  });
  const bark = hexRgb(look.bark);
  const leafy = /^(Tree|Bush|Grass|tree_|plant|hanging)/.test(id);
  // (a flower's stem and a crop's leaves are the land's green; its bloom is its own)
  const sprout = /^(flower_|crops_)/.test(id);
  const rocky = /^(Rock|rock_|stone_)/.test(id);
  const rock = look.cliffs ? hexRgb(look.ground.leaf[3]) : null;
  for (let v = 0; v < m.n; v++) {
    const i = v * 3;
    const [h, s, l] = hsl(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255);
    if (sprout) {
      if (h >= 62 && h <= 205 && s > 0.1) {
        const c = leaves[Math.max(0, Math.min(leaves.length - 1, Math.round(l * 1.35 * (leaves.length - 1))))]!;
        out[i] = c[0] * 255;
        out[i + 1] = c[1] * 255;
        out[i + 2] = c[2] * 255;
      }
    } else if (leafy && h >= 52 && h <= 280 && s > 0.1) {
      // a crown's leaves shade by how high they are and how much they face the sky, the same for every face that meets
      // at a corner: one soft gradient over the crown, rather than every flat facet in its own green
      const up = (m.pos[i + 1]! - m.min[1]) / Math.max(1e-4, m.max[1] - m.min[1]);
      const sky = m.sn[i + 1]! / 127;
      const t = Math.max(0, Math.min(1, 0.2 + up * 0.45 + sky * 0.3 + (l - 0.4) * 0.15));
      const f = t * (leaves.length - 1);
      const lo = leaves[Math.floor(f)]!;
      const hi = leaves[Math.min(leaves.length - 1, Math.floor(f) + 1)]!;
      const u = f - Math.floor(f);
      out[i] = (lo[0] + (hi[0] - lo[0]) * u) * 255;
      out[i + 1] = (lo[1] + (hi[1] - lo[1]) * u) * 255;
      out[i + 2] = (lo[2] + (hi[2] - lo[2]) * u) * 255;
    } else if (leafy && h > 8 && h < 50) {
      const f = 0.65 + l * 0.7;
      out[i] = Math.min(255, bark[0] * 255 * f);
      out[i + 1] = Math.min(255, bark[1] * 255 * f);
      out[i + 2] = Math.min(255, bark[2] * 255 * f);
    } else if (rocky && rock) {
      const f = 0.55 + l * 0.9;
      out[i] = Math.min(255, rock[0] * 255 * f);
      out[i + 1] = Math.min(255, rock[1] * 255 * f);
      out[i + 2] = Math.min(255, rock[2] * 255 * f);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ the ground */

const groundVert = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const groundFrag = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec2 uSize;
  uniform vec3 uA; uniform vec3 uB;
  uniform vec3 uPathA; uniform vec3 uPathB;
  uniform vec3 uSandA; uniform vec3 uSandB;
  uniform vec3 uCobA; uniform vec3 uCobB;
  uniform vec3 uDeep; uniform vec3 uMidW; uniform vec3 uLightW; uniform vec3 uFoam;
  uniform vec3 uEdge;
  uniform float uIndoor;
  uniform float uLava;
  uniform float uSnow;
  uniform sampler2D uRoomA;
  uniform sampler2D uRoomB;
  uniform float uTime;
  uniform vec4 uGrade;
  uniform vec4 uDark;
  uniform vec4 uSee;
  uniform vec3 uFlames[8];
  uniform vec4 uNight;
  uniform vec4 uAmb;
  uniform vec3 uFlameCol;
  uniform sampler2D uAo;
  uniform float uTrim;
  varying vec3 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 p = vW.xz;
    vec2 uv = p / uSize;
    vec4 m = texture2D(uMask, uv);
    vec4 far = texture2D(uMask, uv + vec2(0.0, 0.35) / uSize);
    float n = noise(p * 0.55);
    float n2 = noise(p * 2.3);
    float wob = (n - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
    vec3 c;
    float ck = mod(floor(p.x) + floor(p.y), 2.0);
    vec2 rt = (floor(p) + 0.5) / uSize;
    vec4 ra = texture2D(uRoomA, rt);
    vec4 rb = texture2D(uRoomB, rt);
    if (uIndoor > 0.5 && ra.a > 0.05) {
      // a boss's chamber, floored in its own stone (data/dungeongen.ts ARENAS)
      vec3 A = ra.rgb;
      vec3 B = rb.rgb;
      if (ra.a < 0.35) {
        // flagstones in courses
        vec2 s = p * vec2(1.6, 2.2);
        s.x += mod(floor(s.y), 2.0) * 0.5;
        vec2 id = floor(s);
        vec2 f = fract(s) - 0.5;
        float line = smoothstep(0.43, 0.5, max(abs(f.x), abs(f.y)));
        c = mix(A, B, hash(id));
        c *= 0.92 + n * 0.16;
        c = mix(c, c * 0.62, line * 0.7);
      } else if (ra.a < 0.6) {
        // great polished squares of marble in two stones, veined, a sheen drifting over them
        vec2 s = p * 0.5;
        vec2 id = floor(s);
        vec2 f = fract(s) - 0.5;
        c = mix(A, B, mod(id.x + id.y, 2.0));
        // (no veins drawn as lines: at this size they read as scribbles; the stone clouds from square to square instead)
        c *= 0.9 + noise(p * 0.45 + id * 3.1) * 0.2;
        c += vec3(0.04) * smoothstep(0.35, 0.95, noise(p * 0.22 + 5.0));
        // a band inlaid a little inside each square's edge, and the joint between squares
        float e = max(abs(f.x), abs(f.y));
        // (both wide and soft-edged: a line a pixel wide crawls as the view moves)
        float inlay = smoothstep(0.375, 0.405, e) - smoothstep(0.43, 0.46, e);
        c = mix(c, c * 1.22 + 0.02, inlay * 0.45);
        float line = smoothstep(0.465, 0.5, e);
        c = mix(c, c * 0.5, line);
      } else if (ra.a < 0.8) {
        // rough ground: earth, rock or ice, mottled, a crack wandering through it
        c = mix(A, B, smoothstep(0.25, 0.75, noise(p * 0.7)));
        c *= 0.9 + noise(p * 1.9 + 4.0) * 0.14;
        // (a crack here and there, faint, only where the ground is at its darkest: not an outline round every patch)
        float crack = smoothstep(0.03, 0.0, abs(noise(p * 0.85 + 11.0) - 0.5)) * smoothstep(0.55, 0.3, noise(p * 0.3 + 2.0));
        c = mix(c, c * 0.7, crack * 0.4);
        c *= 0.94 + noise(p * 4.5) * 0.1;
      } else if (ra.a < 0.95) {
        // boards, their seams staggered, the grain running along them
        vec2 s = vec2(p.x * 0.8, p.y * 2.6);
        float row = floor(s.y);
        s.x += hash(vec2(row, 3.0)) * 4.0;
        vec2 id = vec2(floor(s.x), row);
        vec2 f = fract(s);
        c = mix(A, B, hash(id));
        c *= 0.93 + noise(vec2(p.x * 5.0, row * 3.0)) * 0.1;
        float seam = max(smoothstep(0.07, 0.0, f.y), smoothstep(0.975, 1.0, f.x));
        c = mix(c, c * 0.55, seam);
      } else {
        // a mosaic: small tiles laid in diamonds of two colors (a pattern, not a scatter: a scatter reads as noise)
        vec2 s = p * 2.0;
        vec2 id = floor(s);
        vec2 f = fract(s) - 0.5;
        float diamond = mod(floor((id.x + id.y) / 3.0) + floor((id.x - id.y) / 3.0), 2.0);
        c = mix(A, B, diamond);
        c *= 0.96 + hash(id + 3.0) * 0.07;
        float line = smoothstep(0.42, 0.5, max(abs(f.x), abs(f.y)));
        c = mix(c, c * 0.66, line * 0.6);
      }
    } else if (uIndoor > 0.5) {
      // fitted flagstones, worn unevenly (no grid: the stones lie in courses, each its own shade)
      vec2 s = p * vec2(1.6, 2.2);
      s.x += mod(floor(s.y), 2.0) * 0.5;
      vec2 id = floor(s);
      vec2 f = fract(s) - 0.5;
      float line = smoothstep(0.43, 0.5, max(abs(f.x), abs(f.y)));
      c = mix(uA, uB, hash(id));
      c *= 0.9 + n * 0.2;
      // each stone stands a little proud of its joint: light along its upper left edge, shade along its lower right
      float proud = smoothstep(0.3, 0.43, max(-f.x, -f.y)) - smoothstep(0.3, 0.43, max(f.x, f.y));
      c *= 1.0 + proud * 0.09 * (1.0 - line);
      c *= 0.95 + hash(id + 9.0) * 0.1;
      c = mix(c, uEdge * 0.8, line * 0.62);
    } else if (uSnow > 0.5) {
      // snow (no grain: grain on white reads as pixels): soft drifts, the hollows between them holding a cool blue
      // shade, ripples the wind has carved bending round the drifts, and a few crystals catching the light
      float drift = noise(p * 0.21 + 3.0) * 0.65 + noise(p * 0.55 + 1.7) * 0.35;
      c = mix(uA, uB, smoothstep(0.25, 0.8, drift));
      float hollow = smoothstep(0.46, 0.14, drift);
      c = mix(c, c * vec3(0.82, 0.89, 1.05), hollow * 0.6);
      c *= 0.95 + noise(p * 0.17 + 7.0) * 0.1;
      vec2 q = p + vec2(noise(p * 0.3) * 2.4, noise(p * 0.3 + 9.0) * 2.4);
      float rip = sin(q.x * 2.6 + q.y * 1.1);
      float crest = smoothstep(0.55, 1.0, rip) * (0.55 + 0.45 * noise(p * 0.8 + 4.0));
      float lee = smoothstep(-0.25, -0.95, rip) * (0.55 + 0.45 * noise(p * 0.8 + 4.0));
      c *= 1.0 + crest * 0.055 - lee * 0.045;
      c = mix(c, c * vec3(0.9, 0.95, 1.06), lee * 0.5);
      vec2 gl = p * 9.0;
      vec2 gi = floor(gl);
      float h = hash(gi);
      float glint = step(0.982, h) * smoothstep(0.34, 0.0, length(fract(gl) - 0.5));
      glint *= 0.45 + 0.55 * sin(uTime * 2.3 + h * 60.0);
      c += vec3(0.85, 0.92, 1.0) * max(glint, 0.0) * 0.7;
    } else {
      // grass in big soft blotches over a checker a player's eye can measure distance by
      c = mix(uA, uB, smoothstep(0.3, 0.7, n));
      // the land's light and shade in long drifts, and the fine grain of what grows on it
      c *= 0.86 + noise(p * 0.17 + 7.0) * 0.26;
      c *= 0.95 + noise(p * 6.0) * 0.1;
      c *= 1.0 + (ck - 0.5) * 0.01;
    }
    float sand = smoothstep(0.46, 0.54, m.b + wob);
    c = mix(c, mix(uSandA, uSandB, n), sand);
    float path = smoothstep(0.46, 0.54, m.r + wob);
    vec3 pc = mix(uPathA, uPathB, n * 0.7 + n2 * 0.3);
    float pathShade = smoothstep(0.54, 0.46, m.r + wob + 0.1);
    c = mix(c, pc * (1.0 - pathShade * 0.14), path);
    // paving: toward its edge it frays stone by stone into the ground around it (a few gone, earth between), with a
    // wide slow wander, so a square never ends on a ruled line
    float edgeV = m.a + wob * 1.1 + (noise(p * 0.32 + 3.0) - 0.5) * 0.34;
    if (edgeV > 0.18) {
      vec2 s = p * vec2(2.7, 3.6);
      s.x += mod(floor(s.y), 2.0) * 0.5;
      vec2 id = floor(s);
      vec2 f = fract(s) - 0.5;
      float line = smoothstep(0.36, 0.5, max(abs(f.x), abs(f.y)));
      float stone = step(0.3 + hash(id + 7.0) * 0.32, edgeV);
      float earth = smoothstep(0.18, 0.36, edgeV) * (1.0 - stone);
      c = mix(c, mix(uPathA, uPathB, n) * 0.92, earth * 0.75);
      vec3 st = mix(uCobA, uCobB, hash(id) * 0.8);
      st *= 0.9 + n * 0.2;
      // (an edge stone sits a little sunk and dark, worn into the ground)
      st *= mix(0.86, 1.0, smoothstep(0.3, 0.62, edgeV));
      c = mix(c, mix(st, uCobA * 0.72, line * 0.8), stone);
    }
    // water: dark in the middle, lighter at the bank, with foam where it meets the land
    float w = smoothstep(0.47, 0.53, m.g + wob * 0.55);
    if (w > 0.0) {
      float deep = smoothstep(0.55, 0.98, m.g);
      vec3 wc = mix(uMidW, uDeep, deep);
      float t = uTime;
      float r1 = sin(p.x * 2.2 + t * 1.1 + sin(p.y * 1.7 + t * 0.6) * 1.4);
      float r2 = sin(p.y * 3.1 - t * 0.9 + sin(p.x * 2.4 - t * 0.5) * 1.1);
      float glint = smoothstep(0.82, 0.98, r1 * 0.55 + r2 * 0.55);
      wc = mix(wc, uLightW, glint * (uLava > 0.5 ? 0.85 : 0.55));
      if (uLava > 0.5) wc += vec3(0.25, 0.08, 0.0) * (0.5 + 0.5 * sin(t * 1.5 + n * 9.0));
      float foamLine = smoothstep(0.03, 0.0, abs(m.g + wob * 0.55 - 0.56 - sin(t * 1.3 + n * 7.0) * 0.012));
      wc = mix(wc, uFoam, foamLine * 0.9);
      c = mix(c, wc, w);
    }
    // what stands on a solid tile shades its foot
    float foot = smoothstep(0.0, 0.9, far.g) * 0.0;
    c *= 1.0 - foot;
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix(vec3(lum), c, 0.84) * vec3(0.99, 0.97, 0.91);
    // the ground is darker along the foot of what's built on it: a wall, a cliff, a column (the light doesn't get in there)
    float ao = texture2D(uAo, uv).r;
    // a built place's floor is finished where it meets its walls: a course of stone set along them and round each
    // column's foot, a lighter line inside it (not on a boss's rough ground, nor in a cave)
    if (uTrim > 0.5 && !(ra.a >= 0.6 && ra.a < 0.8) && m.g < 0.3) {
      float line = smoothstep(0.17, 0.22, ao) - smoothstep(0.26, 0.31, ao);
      c = mix(c, c * 0.8, smoothstep(0.26, 0.32, ao) * 0.6);
      c = mix(c, c * 1.26 + 0.02, line * 0.5);
    }
    c *= 1.0 - smoothstep(0.02, 0.75, ao) * (uIndoor > 0.5 ? 0.5 : 0.2);
    c = mix(c, uGrade.rgb, uGrade.a);
    if (uAmb.a > 0.0) {
      // a room under a roof: its own dimness, each fire's pool in the fire's color, and the light the hero carries
      float lit = 0.0;
      for (int i = 0; i < 8; i++) {
        if (uFlames[i].z > 0.0) {
          float t = 1.0 - clamp(length(vW.xz - uFlames[i].xy) / (uFlames[i].z * 1.3), 0.0, 1.0);
          lit += t * t;
        }
      }
      float hero = 1.0 - smoothstep(1.5, 9.5, length(vW.xz - uSee.xz));
      float f = 1.0 - exp(-lit * 1.5);
      vec3 l = mix(uAmb.rgb, uFlameCol * 1.12, f * 0.78);
      l += (vec3(1.0) - l) * hero * 0.5;
      c *= mix(vec3(1.0), l, uAmb.a);
    }
    if (uNight.a > 0.0) {
      float fire = 0.0;
      for (int i = 0; i < 8; i++) {
        if (uFlames[i].z > 0.0) {
          float t = 1.0 - clamp(length(vW.xz - uFlames[i].xy) / uFlames[i].z, 0.0, 1.0);
          fire += t * t * (3.0 - 2.0 * t);
        }
      }
      fire = min(fire, 1.0);
      float g = dot(c, vec3(0.3, 0.59, 0.11));
      vec3 moon = mix(vec3(g), c, 0.68) * uNight.rgb;
      vec3 warm = c * vec3(1.06, 0.9, 0.68);
      c = mix(c, mix(moon, warm, fire), uNight.a);
    }
    if (uDark.x > 0.0) {
      float d = length(vW.xz - uSee.xz);
      float k = smoothstep(uDark.y * 0.45, uDark.y, d);
      for (int i = 0; i < 8; i++) {
        if (uFlames[i].z > 0.0) k = min(k, smoothstep(uFlames[i].z * 0.3, uFlames[i].z, length(vW.xz - uFlames[i].xy)));
      }
      c *= mix(1.0, 1.0 - uDark.x, k);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

const col3 = (hex: string): THREE.Vector3 => {
  const [r, g, b] = hexRgb(hex);
  return new THREE.Vector3(r, g, b);
};

/** Tiles something stands on: what is under it is whatever most of the ground round it is. */
const THINGS = new Set<number>([K.Prop, K.Fence, K.Tree, K.Bush, K.Bramble, K.Rock, K.Pillar, K.Brazier]);
const PAVED = [K.Path, K.Cobble, K.Sand] as const;

/**
 * The ground as it is painted: a bench on a square stands on the square's stones, a palm in the desert on sand (a
 * tile with something on it has no ground of its own, and showed the land's grass in a square patch). A thing at
 * the edge of a road, with most of its tile's neighbors off the road, keeps its grass, so roads keep their line.
 */
function groundUnderThings(map: TileMap): Uint8Array {
  const W = map.w;
  const H = map.h;
  const out = Uint8Array.from(map.kind);
  // (three times, so the middle of something three tiles wide gets it too)
  for (let pass = 0; pass < 3; pass++) {
    const was = Uint8Array.from(out);
    for (let i = 0; i < W * H; i++) {
      if (!THINGS.has(was[i]!)) continue;
      const tx = i % W;
      const ty = Math.floor(i / W);
      for (const ground of PAVED) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = tx + dx;
            const y = ty + dy;
            if ((dx || dy) && x >= 0 && y >= 0 && x < W && y < H && was[y * W + x] === ground) n++;
          }
        }
        if (n >= 4) {
          out[i] = ground;
          break;
        }
      }
    }
  }
  return out;
}

const FLOOR_KIND: Record<Floor['kind'], number> = { flag: 51, marble: 128, rough: 179, plank: 230, mosaic: 255 };

/**
 * The ground. `floors`, by room (a dungeon's encounters, in order): a room that has its own floor (a boss's chamber,
 * data/dungeongen.ts ARENAS) is drawn in it.
 */
/**
 * How near each spot of ground is to the foot of something built or of rock (a wall, a rampart, a column): 1 under it,
 * falling away over a tile or so. The ground is drawn darker by it.
 */
function footShade(map: TileMap): THREE.DataTexture {
  const W = map.w;
  const H = map.h;
  let a = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const k = map.kind[i]!;
    a[i] = k === K.Wall || k === K.Illusion || k === K.Rampart || k === K.Cracked ? 1 : k === K.Pillar ? 0.7 : 0;
  }
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            // (past the map's edge it's all wall)
            sum += xx < 0 || yy < 0 || xx >= W || yy >= H ? 1 : a[yy * W + xx]!;
            n++;
          }
        }
        b[y * W + x] = sum / n;
      }
    }
    a = b;
  }
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) data[i * 4] = Math.round(a[i]! * 255);
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function buildGround(map: TileMap, look: ThemeLook, floors: readonly (Floor | null | undefined)[] = [], trim = false): THREE.Mesh {
  const W = map.w;
  const H = map.h;
  const roomA = new Uint8Array(W * H * 4);
  const roomB = new Uint8Array(W * H * 4);
  if (look.indoor && floors.some(Boolean)) {
    for (let i = 0; i < W * H; i++) {
      const f = map.room[i] ? floors[map.room[i]! - 1] : null;
      if (!f) continue;
      const a = hexRgb(f.a);
      const b = hexRgb(f.b);
      for (let k = 0; k < 3; k++) {
        roomA[i * 4 + k] = Math.round(a[k]! * 255);
        roomB[i * 4 + k] = Math.round(b[k]! * 255);
      }
      roomA[i * 4 + 3] = FLOOR_KIND[f.kind];
      roomB[i * 4 + 3] = 255;
    }
  }
  const roomTex = (data: Uint8Array): THREE.DataTexture => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  };
  const mask = new Uint8Array(W * H * 4);
  const kinds = groundUnderThings(map);
  for (let i = 0; i < W * H; i++) {
    const k = kinds[i]!;
    const at = i * 4;
    if (k === K.Path) mask[at] = 255;
    if (k === K.Water || (k === K.Bridge && !look.indoor)) mask[at + 1] = 255;
    if (k === K.Sand) mask[at + 2] = 255;
    if (k === K.Cobble) mask[at + 3] = 255;
  }
  // (softened a little, tile into tile: a square of paving, a road's turn, a shore's corner come out rounded, the way
  // ground wears, not ruled to the grid)
  if (!look.indoor) softenMask(mask, W, H, 2);
  const tex = new THREE.DataTexture(mask, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const g = look.ground;
  const stone = look.stone;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: LIGHT.uTime,
      uGrade: LIGHT.uGrade,
      uDark: LIGHT.uDark,
      uSee: LIGHT.uSee,
      uFlames: LIGHT.uFlames,
      uNight: LIGHT.uNight,
      uAmb: LIGHT.uAmb,
      uFlameCol: LIGHT.uFlameCol,
      uAo: { value: footShade(map) },
      uTrim: { value: trim ? 1 : 0 },
      uMask: { value: tex },
      uSize: { value: new THREE.Vector2(W, H) },
      uA: { value: col3(stone ? stone.slab[1] : g.grass[2]) },
      uB: { value: col3(stone ? stone.slab[2] : g.grass[3]) },
      uEdge: { value: col3(stone ? stone.mortar : g.grass[0]) },
      uPathA: { value: col3(g.path[1]) },
      uPathB: { value: col3(g.path[2]) },
      uSandA: { value: col3(g.sand[2]) },
      uSandB: { value: col3(g.sand[3]) },
      uCobA: { value: col3(stone ? stone.slab[0] : g.path[0]) },
      uCobB: { value: col3(stone ? stone.slab[3] : g.path[1]) },
      uDeep: { value: col3(g.water.deep) },
      uMidW: { value: col3(g.water.mid) },
      uLightW: { value: col3(g.water.light) },
      uFoam: { value: col3(g.water.foam) },
      uIndoor: { value: look.indoor ? 1 : 0 },
      uLava: { value: look.lava ? 1 : 0 },
      uSnow: { value: look.snowy ? 1 : 0 },
      uRoomA: { value: roomTex(roomA) },
      uRoomB: { value: roomTex(roomB) },
    },
    vertexShader: groundVert,
    fragmentShader: groundFrag,
  });
  const geo = new THREE.PlaneGeometry(W + 80, H + 80);
  geo.rotateX(-Math.PI / 2);
  geo.translate(W / 2, 0, H / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ blocks */

interface BlockStyle {
  h: number;
  top: [number, number, number];
  top2: [number, number, number];
  side: [number, number, number];
  side2: [number, number, number];
}

/** How tall the walls of a place under a roof stand, in tiles: halls, not cellars. */
const DUNGEON_WALL = 2.7;

function blockStyles(look: ThemeLook, woody: boolean): { wall: BlockStyle; rampart: BlockStyle } {
  const st = look.stone;
  const wall: BlockStyle = st
    ? { h: DUNGEON_WALL, top: hexRgb(st.top), top2: hexRgb(st.topHi), side: hexRgb(st.brick[1]), side2: hexRgb(st.brick[0]) }
    : woody
      ? // a wood is a low mossy floor its trees stand on, as in the art set's own scenes, not a block with crowns poking out
        { h: WOOD_FLOOR, top: mossOf(look), top2: mossOf(look), side: mossOf(look, 0.6), side2: mossOf(look, 0.5) }
      : { h: 1.7, top: hexRgb(look.ground.leaf[3]), top2: hexRgb(look.ground.leaf[4]), side: hexRgb(look.ground.leaf[1]), side2: hexRgb(look.ground.leaf[0]) };
  const rampart: BlockStyle = { h: 2.5, top: [0.46, 0.44, 0.46], top2: [0.68, 0.65, 0.62], side: [0.62, 0.59, 0.56], side2: [0.42, 0.4, 0.42] };
  return { wall, rampart };
}

export class Mesher {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], ca: readonly number[], cb: readonly number[] = ca): void {
    const v = this.pos.length / 3;
    this.pos.push(...a, ...b, ...c, ...d);
    this.nor.push(...n, ...n, ...n, ...n);
    this.col.push(...ca, ...ca, ...cb, ...cb);
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  /** As a model a Stand can place (bytes for colors, like the rest). */
  data(): MeshData {
    const n = this.pos.length / 3;
    const pos = Float32Array.from(this.pos);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n * 3; i++) {
      const c = i % 3;
      min[c] = Math.min(min[c]!, pos[i]!);
      max[c] = Math.max(max[c]!, pos[i]!);
    }
    const nor = Int8Array.from(this.nor, (x) => x * 127);
    return { n, i: this.idx.length, min, max, pos, nor, sn: nor, col: Uint8Array.from(this.col, (x) => Math.min(255, x * 255)), idx: Uint16Array.from(this.idx) };
  }
  build(): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    const tint = new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1, 0]), 4);
    g.setAttribute('iTint', tint);
    const mesh = new THREE.InstancedMesh(g, staticMaterial, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.frustumCulled = false;
    return mesh;
  }
}

function shade(c: readonly number[], k: number): number[] {
  return [Math.min(1, c[0]! * k), Math.min(1, c[1]! * k), Math.min(1, c[2]! * k)];
}

/** How a built place's walls are faced with the dungeon pack's pieces (Land3D.cladWalls). */
interface Cladding {
  /** Multiplied into the pack's grey stone: the place's own. */
  tint: readonly [number, number, number];
  /** The share of plain pieces that are cracked. */
  cracked: number;
  /** The share of a long run's inner pieces that are something else, and what. */
  odd: number;
  pieces: readonly string[];
}
/** How deep a facing piece is, in tiles, and how far it stands out of the wall it faces. */
const CLAD_DEEP = 0.3;
const CLAD_OUT = 0.07;
const CLADDING: Partial<Record<string, Cladding>> = {
  // the old dead's crypts: cold blue-violet stone, niches for the dead, bars
  crypt: { tint: [0.84, 0.82, 1.06], cracked: 0.22, odd: 0.5, pieces: ['wall_arched', 'wall_pillar', 'wall_archedwindow_gated', 'wall_arched', 'wall_gated'] },
  // a keep men still hold: warm grey stone, shelves and shuttered windows
  keep: { tint: [0.98, 0.94, 0.9], cracked: 0.12, odd: 0.45, pieces: ['wall_pillar', 'wall_shelves', 'wall_window_closed', 'wall_pillar', 'wall_archedwindow_gated'] },
  // the frozen citadel: pale ice-blue stone, tall niches and buttresses, much of it split by three hundred winters
  citadel: { tint: [0.62, 0.72, 0.98], cracked: 0.3, odd: 0.5, pieces: ['wall_pillar', 'wall_arched', 'wall_pillar', 'wall_archedwindow_gated'] },
  // the sun king's tomb: sandstone, niches and pilasters
  temple: { tint: [1.16, 1.0, 0.76], cracked: 0.16, odd: 0.5, pieces: ['wall_arched', 'wall_pillar', 'wall_arched'] },
  // the cistern under the city: wet green-grey stone, drains behind bars
  cistern: { tint: [0.8, 0.98, 0.88], cracked: 0.26, odd: 0.5, pieces: ['wall_gated', 'wall_archedwindow_gated', 'wall_pillar', 'wall_arched'] },
  // the spire in the rift: violet stone, coming apart
  riftspire: { tint: [0.96, 0.8, 1.12], cracked: 0.34, odd: 0.4, pieces: ['wall_pillar', 'wall_arched', 'wall_broken'] },
};

const NO_LIGHTS: readonly { x: number; z: number; reach: number }[] = [];

/** How high a wall stands where it's been cut away so the floor behind it shows. */
const CUT_WALL = 0.3;

/** How long a way down takes to open, in seconds. */
const OPEN_TIME = 1.6;

/**
 * Under a roof the camera looks from the south, so the wall along a room's south side would stand between it and the
 * room: two tiles of floor gone, and anyone on them. Those walls are cut down to a kerb (everything should be visible),
 * as in any game seen from above, and so is all the solid rock nobody sees. What stays tall is what a room shows us: the
 * wall at its far side with its torches on it, and the walls down its flanks.
 */
function cutAway(map: TileMap): Uint8Array {
  const W = map.w;
  const H = map.h;
  const out = new Uint8Array(W * H);
  const walled = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    const k = map.kind[y * W + x];
    return k === K.Wall || k === K.Illusion;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!walled(x, y) || !walled(x, y + 1)) continue;
      const floorBehind = !walled(x, y - 1) || !walled(x, y - 2) || !walled(x, y - 3);
      const flank = !walled(x - 1, y) || !walled(x + 1, y);
      if (floorBehind || !flank) out[y * W + x] = 1;
    }
  }
  return out;
}

/** Blurs a ground mask (four channels, a byte each) over its neighbours, `passes` times: rounded corners, soft edges. */
function softenMask(mask: Uint8Array, W: number, H: number, passes: number): void {
  const tmp = new Uint8Array(mask.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= W) continue;
              // (the middle counts double: a lane a tile wide keeps its line)
              const k = dx === 0 && dy === 0 ? 2 : 1;
              sum += mask[(yy * W + xx) * 4 + c]! * k;
              n += k;
            }
          }
          tmp[(y * W + x) * 4 + c] = Math.round(sum / n);
        }
      }
    }
    mask.set(tmp);
  }
}

function buildBlocks(map: TileMap, look: ThemeLook, woody: boolean, cut: Uint8Array | null): THREE.Mesh {
  const { wall, rampart } = blockStyles(look, woody);
  const m = new Mesher();
  const W = map.w;
  const H = map.h;
  const styleAt = (x: number, y: number): BlockStyle | null => {
    if (x < 0 || y < 0 || x >= W || y >= H) return woody && !look.stone ? null : wall;
    const k = map.kind[y * W + x]!;
    // (a wood has no block at all: its trees stand on the land's own grass, which runs on under them)
    if (k === K.Wall || k === K.Illusion) return woody && !look.stone ? null : wall;
    if (k === K.Rampart) return rampart;
    return null;
  };
  // (a bare land's cliffs go on past the edge of the map, as a wood's trees do: no black void beyond a way out)
  const past = !woody && !look.indoor && !look.stone ? 6 : 0;
  for (let y = -past; y < H + past; y++) {
    for (let x = -past; x < W + past; x++) {
      const s = styleAt(x, y);
      if (!s) continue;
      const hs = hash2(x, y, 5);
      // (one height: blocks of differing heights leave bright seams, and the trees on them give the skyline)
      const lowered = !!cut?.[y * W + x];
      const h = lowered ? CUT_WALL : s.h;
      const top = shade(s.top, 0.97 + hash2(x, y, 9) * 0.05 + (hs > 0.5 ? 0.02 : 0));
      m.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], [0, 1, 0], top);
      // a kerb's cut edge, along the floor it was cut away from
      if (lowered && look.stone && !styleAt(x, y - 1)) m.quad([x, h + 0.004, y + 0.2], [x + 1, h + 0.004, y + 0.2], [x + 1, h + 0.004, y], [x, h + 0.004, y], [0, 1, 0], hexRgb(look.stone.lip));
      /** How high the block next door stands (a wall only shows above what's beside it). */
      const beside = (bx: number, by: number): number => {
        const b = styleAt(bx, by);
        if (!b) return 0;
        if (bx < 0 || by < 0 || bx >= W || by >= H) return cut ? CUT_WALL : b.h;
        return cut?.[by * W + bx] ? CUT_WALL : b.h;
      };
      const side = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
        const f = 0.92 + hash2(x, y, 13) * 0.14;
        // built walls are laid in courses of stone, each its own shade; a cliff or a wood is one face
        if (s === wall && !look.indoor) {
          m.quad(a, b, c, d, n, shade(s.side2, f), shade(s.side, f));
          return;
        }
        const rows = 4;
        const lerp = (p: number[], q: number[], t: number): number[] => [p[0]! + (q[0]! - p[0]!) * t, p[1]! + (q[1]! - p[1]!) * t, p[2]! + (q[2]! - p[2]!) * t];
        for (let r = 0; r < rows; r++) {
          const t0 = r / rows;
          const t1 = (r + 1) / rows;
          const lift = shade(s.side2, 0.02 + 1);
          const up = shade(s.side, 1);
          const course = f * (0.9 + hash2(x + r * 3, y + r, 17) * 0.2);
          const c0 = shade([lift[0]! + (up[0]! - lift[0]!) * t0, lift[1]! + (up[1]! - lift[1]!) * t0, lift[2]! + (up[2]! - lift[2]!) * t0], course);
          // (the bottom of a course in shadow, like the mortar under it)
          m.quad(lerp(a, d, t0), lerp(b, c, t0), lerp(b, c, t1), lerp(a, d, t1), n, shade(c0, 0.84), c0);
        }
      };
      const b0 = beside(x, y + 1);
      const b1 = beside(x + 1, y);
      const b2 = beside(x - 1, y);
      const b3 = beside(x, y - 1);
      // (a wall's back, seen from out in the solid rock, is the same dark as the rock)
      const face = (b: number, a0: number[], a1: number[], a2: number[], a3: number[], n: number[]): void => {
        if (b >= h) return;
        if (b > 0) m.quad(a0, a1, a2, a3, n, top);
        else side(a0, a1, a2, a3, n);
      };
      face(b0, [x, b0, y + 1], [x + 1, b0, y + 1], [x + 1, h, y + 1], [x, h, y + 1], [0, 0, 1]);
      face(b1, [x + 1, b1, y + 1], [x + 1, b1, y], [x + 1, h, y], [x + 1, h, y + 1], [1, 0, 0]);
      face(b2, [x, b2, y], [x, b2, y + 1], [x, h, y + 1], [x, h, y], [-1, 0, 0]);
      face(b3, [x + 1, b3, y], [x, b3, y], [x, h, y], [x + 1, h, y], [0, 0, -1]);
      // crenels along a city wall
      if (s === rampart) {
        // the parapet: two small merlons a tile, on the wall's outer edges, a walkway between
        const ch = h + 0.3;
        const c = shade(s.top2, 1.02);
        const south = !styleAt(x, y + 1);
        const north = !styleAt(x, y - 1);
        const east = !styleAt(x + 1, y);
        const west = !styleAt(x - 1, y);
        const merlon = (x0: number, z0: number, x1: number, z1: number): void => {
          m.quad([x0, ch, z1], [x1, ch, z1], [x1, ch, z0], [x0, ch, z0], [0, 1, 0], c);
          m.quad([x0, h, z1], [x1, h, z1], [x1, ch, z1], [x0, ch, z1], [0, 0, 1], s.side, c);
          m.quad([x1, h, z1], [x1, h, z0], [x1, ch, z0], [x1, ch, z1], [1, 0, 0], s.side, c);
          m.quad([x0, h, z0], [x0, h, z1], [x0, ch, z1], [x0, ch, z0], [-1, 0, 0], s.side, c);
        };
        const t = 0.2;
        if (south || north) for (const u of [0.06, 0.56]) merlon(x + u, south ? y + 1 - t : y, x + u + 0.36, south ? y + 1 : y + t);
        if (east || west) for (const u of [0.06, 0.56]) merlon(east ? x + 1 - t : x, y + u, east ? x + 1 : x + t, y + u + 0.36);
      }
      if (map.kind[y * W + x] === K.Bridge) continue;
    }
  }
  // the world past the map's edge: more of the same
  const far = 40;
  // (under a roof it's low too: there's nothing there, and it mustn't stand over the way out)
  const h = cut ? CUT_WALL : wall.h;
  const t = wall.top;
  m.quad([-far, h, H + far], [0, h, H + far], [0, h, -far], [-far, h, -far], [0, 1, 0], t);
  m.quad([W, h, H + far], [W + far, h, H + far], [W + far, h, -far], [W, h, -far], [0, 1, 0], t);
  m.quad([0, h, 0], [W, h, 0], [W, h, -far], [0, h, -far], [0, 1, 0], t);
  m.quad([0, h, H + far], [W, h, H + far], [W, h, H], [0, h, H], [0, 1, 0], t);
  return m.build();
}

/**
 * The carpets laid down the middle of a great room: a border, the field, a lighter panel down its length and a lozenge
 * at each pace, so a long run of it reads as something woven and not as a stripe of paint.
 */
function buildCarpets(list: readonly { tx: number; ty: number; c: readonly number[] }[], rugs: readonly { tx: number; ty: number; c: readonly number[] }[]): THREE.Mesh {
  const m = new Mesher();
  const has = new Set(list.map((p) => `${p.tx},${p.ty}`));
  const lay = (x0: number, z0: number, x1: number, z1: number, y: number, c: readonly number[]): void => {
    m.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], c);
  };
  for (const { tx, ty, c } of list) {
    const field = shade(c, 0.95);
    const panel = shade(c, 1.22);
    const trim: readonly number[] = [0.5 + c[0]! * 0.28, 0.37 + c[1]! * 0.24, 0.17 + c[2]! * 0.2];
    const down = has.has(`${tx},${ty - 1}`) || has.has(`${tx},${ty + 1}`);
    if (down) {
      // a tile's length of a carpet going north and south, three tiles across
      const x0 = tx - 1;
      const x1 = tx + 2;
      lay(x0 - 0.12, ty - 0.12, x1 + 0.12, ty + 1.12, 0.02, trim);
      lay(x0, ty, x1, ty + 1, 0.032, field);
      lay(x0 + 0.3, ty, x0 + 0.38, ty + 1, 0.044, trim);
      lay(x1 - 0.38, ty, x1 - 0.3, ty + 1, 0.044, trim);
      lay(x0 + 0.62, ty + 0.1, x1 - 0.62, ty + 0.9, 0.044, panel);
      const cx = tx + 0.5;
      const cz = ty + 0.5;
      m.quad([cx, 0.056, cz + 0.32], [cx + 0.42, 0.056, cz], [cx, 0.056, cz - 0.32], [cx - 0.42, 0.056, cz], [0, 1, 0], trim);
    } else {
      // and one going east and west, a tile deep (its pieces overlap: each lays down its own tile's worth)
      lay(tx - 0.12, ty - 0.12, tx + 1.12, ty + 1.12, 0.02, trim);
      lay(tx - 0.02, ty, tx + 1.02, ty + 1, 0.032, field);
      lay(tx + 0.08, ty + 0.2, tx + 0.92, ty + 0.8, 0.044, panel);
    }
  }
  // a rug laid on its own: the same weave, with its border all the way round
  for (const { tx, ty, c } of rugs) {
    const field = shade(c, 1.05);
    const panel = shade(c, 1.35);
    const trim: readonly number[] = [0.5 + c[0]! * 0.28, 0.37 + c[1]! * 0.24, 0.17 + c[2]! * 0.2];
    const cx = tx + 0.5;
    const cz = ty + 0.5;
    const hw = 1.3;
    const hd = 0.8;
    lay(cx - hw, cz - hd, cx + hw, cz + hd, 0.02, trim);
    lay(cx - hw + 0.08, cz - hd + 0.08, cx + hw - 0.08, cz + hd - 0.08, 0.032, field);
    lay(cx - hw + 0.3, cz - hd + 0.28, cx + hw - 0.3, cz + hd - 0.28, 0.044, trim);
    lay(cx - hw + 0.36, cz - hd + 0.34, cx + hw - 0.36, cz + hd - 0.34, 0.056, panel);
    m.quad([cx, 0.068, cz + 0.3], [cx + 0.46, 0.068, cz], [cx, 0.068, cz - 0.3], [cx - 0.46, 0.068, cz], [0, 1, 0], trim);
  }
  return m.build();
}

/** Planks over the water; indoors, a wooden floor. */
function buildPlanks(map: TileMap, look: ThemeLook): THREE.Mesh {
  const m = new Mesher();
  const W = map.w;
  const H = map.h;
  // planks over the water; indoors, a wooden floor (what stands on it stands on planks too)
  const wood = hexRgb(look.indoor ? '#7f5c3c' : '#7a5a3a');
  const wood2 = hexRgb(look.indoor ? '#6c4e33' : '#644a30');
  const planked = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && map.kind[y * W + x] === K.Bridge;
  const y0 = 0.02;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = map.kind[y * W + x]!;
      const under = look.indoor && (k === K.Prop || k === K.Door || k === K.Deco) && (planked(x - 1, y) || planked(x + 1, y) || planked(x, y - 1) || planked(x, y + 1));
      if (k !== K.Bridge && !under) continue;
      const across = !look.indoor && (planked(x - 1, y) || planked(x + 1, y));
      const n = 4;
      const gap = look.indoor ? 0.97 : 0.9;
      for (let i = 0; i < n; i++) {
        const c = shade(i % 2 ? wood : wood2, 0.94 + hash2(x + i, y, 3) * 0.14);
        const a = i / n;
        const b = (i + gap) / n;
        if (across) m.quad([x + a, y0, y + 1], [x + b, y0, y + 1], [x + b, y0, y], [x + a, y0, y], [0, 1, 0], c);
        else m.quad([x, y0, y + b], [x + 1, y0, y + b], [x + 1, y0, y + a], [x, y0, y + a], [0, 1, 0], c);
      }
    }
  }
  return m.build();
}

/* ------------------------------------------------------------------ the land */

const CELL = 8;
/** A cell's key, for cells a little past the map's edge too. */
const cellKey = (r: number, c: number): number => ((r + 64) << 12) | (c + 64);
/** The hues of a land's roofs (the models are painted blue). */
const ROOFS: Record<string, string[]> = {
  default: ['#3f6fb0', '#b04a3f', '#c08a3a'],
  village: ['#3f6fb0', '#b04a3f', '#5f8f4f'],
  farm: ['#b04a3f', '#c08a3a', '#7a5a3a'],
  coast: ['#3f7fa0', '#d0d0c8', '#b04a3f'],
  desert: ['#c8a060', '#b0683f', '#d8c090'],
  snow: ['#5a7a9a', '#8a9ab0', '#a05a4a'],
  plague: ['#5a5a48', '#4a4a5a', '#6a5040'],
  moor: ['#4a4a5a', '#5a5048'],
  barrow: ['#4a4a5a', '#5a5048'],
  haunted: ['#4a4a5a', '#3f3f4a'],
  deadlake: ['#3f4a5a', '#3f3f4a'],
  sunken: ['#3f6a70', '#4a5a5a'],
  storm: ['#4a5a70', '#5a6a7a'],
  mountain: ['#6a6a78', '#7a5a4a'],
  volcanic: ['#4a3a3a', '#6a3a2f'],
  rift: ['#5a4a7a', '#4a4a6a'],
  warfront: ['#5a4a3f', '#6a5a4a'],
  fey: ['#9a5ab0', '#5a9a8a', '#c08ac0'],
  jungle: ['#5a7a3f', '#8a6a3f'],
  pale: ['#7a7a8a', '#5a5a6a'],
};
/** A waystone's stone and the color of its rune, by land. */
const WAYSTONES: Record<string, [string, string]> = {
  default: ['#808798', '#7fd4ff'],
  autumn: ['#8a7a68', '#ffd27a'],
  coast: ['#a8a490', '#8ae8e0'],
  marsh: ['#6a7468', '#b0ff9a'],
  plague: ['#5c6650', '#baff5a'],
  mountain: ['#6c6a70', '#ffb060'],
  barrow: ['#5e5c66', '#c8b8ff'],
  storm: ['#5c6878', '#9ad8ff'],
  moor: ['#5c5660', '#d0a0ff'],
  desert: ['#c0996a', '#ffe08a'],
  fey: ['#a890c8', '#ff9aea'],
  snow: ['#8aa8c4', '#c8f0ff'],
  rift: ['#54407a', '#d090ff'],
  jungle: ['#6a7a50', '#a8ff70'],
  warfront: ['#6a625a', '#ff9a6a'],
  gloam: ['#44504a', '#7affb0'],
  bonefield: ['#a89c84', '#ffd0a0'],
  haunted: ['#5c6670', '#ffe0a0'],
  sunken: ['#4e6a68', '#7affe0'],
  blight: ['#5a4e5e', '#c8ff6a'],
  volcanic: ['#3e3634', '#ff7a2a'],
  deadlake: ['#4a4c54', '#a8c0ff'],
  pale: ['#8a8e9e', '#d8e4ff'],
};

/** Nothing flowers here. */
const BARE_LANDS = new Set<string>(['volcanic', 'snow', 'desert', 'peaks', 'bonefield', 'blight', 'deadlake', 'haunted', 'rift', 'pale', 'barrow', 'plague', 'warfront', 'gloam', 'storm', 'mountain']);

export class Land3D {
  /** What stands. */
  readonly group = new THREE.Group();
  /** What lies on the ground: the floor, planks and shadows. */
  readonly under = new THREE.Group();
  readonly objects: LandObject[] = [];
  /** The fires burning here: their foot, and how tall the thing holding them is (tiles). */
  readonly flames: { x: number; z: number; y: number; size: number }[] = [];
  /** What lights the dark without burning (a lantern), and how far. */
  readonly lamps: { x: number; z: number; reach: number }[] = [];
  /** Each building's model, as it was placed: what a fire on it burns on. */
  private readonly standing: { x0: number; x1: number; z0: number; z1: number; mesh: MeshData; x: number; z: number; sx: number; sy: number; sz: number; roof?: RoofSpot[] }[] = [];
  /** The stone heroes on their plinths (the cast draws them, in a pose). */
  readonly statues: { x: number; y: number; h: number; lift: number; tint: readonly [number, number, number] }[] = [];
  /** Great figures frozen in a pose (the cast draws them). */
  readonly colossi: Colossus[] = [];
  /** The pieces of great works, which the view keeps as long as any of them could show. */
  private readonly giants: Giant[] = [];
  /** Soft lights that aren't fire: the rune on a waymarker. */
  readonly glows: { x: number; z: number; y: number; color: string; size: number }[] = [];
  private readonly look: ThemeLook;
  private readonly ground: THREE.Mesh;
  private readonly blocks: THREE.Mesh;
  private readonly planks: THREE.Mesh;
  private readonly cells = new Map<number, Placed[]>();
  private readonly stands = new Map<string, Stand>();
  private readonly shadows: THREE.InstancedMesh;
  private wallH = 1.45;
  private cx = NaN;
  private cz = NaN;
  private readonly doors: { i: number; x: number; y: number; k: number; h: number }[] = [];
  /**
   * A hall's columns (the map's pillars and a nave's tall columns), in tiles, each with how much of its height stands
   * now (1 whole, less while cut away).
   */
  private readonly columns: { m: string; x: number; z: number; rot: number; sx: number; sy: number; sz: number; r: number; g: number; b: number; cut: number }[] = [];
  private readonly columnStands = new Map<string, Stand>();
  private readonly doorStand: Stand;
  /** What's built rather than placed: the ways into dungeons (doorways.ts), and the carpets down a hall. */
  private readonly built: THREE.Mesh[] = [];
  /** The ways into dungeons that stand here, by where they go. */
  readonly ways = new Map<string, { mesh: THREE.Mesh; x: number; z: number; flames: Land3D['flames']; glows: Land3D['glows'] }>();
  private readonly opening: { way: NonNullable<ReturnType<Land3D['ways']['get']>>; t: number; fade: THREE.ShaderMaterial }[] = [];
  private readonly carpets: { tx: number; ty: number; c: readonly number[] }[] = [];
  private readonly rugs: { tx: number; ty: number; c: readonly number[] }[] = [];
  /** The walls cut down to a kerb, so what's behind them shows (under a roof). */
  private readonly cut: Uint8Array | null;
  /** How a built place's walls are faced (null: bare rock, or not a dungeon). */
  private clad: Cladding | null = null;

  constructor(
    private readonly map: TileMap,
    readonly region: RegionDef,
    private readonly packs: LandPacks,
    private readonly shown: (pm: PlacedMarker) => boolean,
    readonly keep: ((o: LandObject) => boolean) | null = null,
  ) {
    const theme = region.theme;
    const look = THEMES[theme];
    this.look = look;
    const woody = !look.indoor && !look.cliffs && look.trees.filter((t) => t !== 'cactus' && t !== 'crystal').length * 2 > look.trees.length;
    this.ground = buildGround(map, look, region.kind === 'dungeon' ? region.encounters.map((e) => (e.boss ? ARENAS[e.boss]?.floor : null)) : [], look.indoor && region.kind === 'dungeon' && !!CLADDING[theme]);
    this.cut = look.indoor ? cutAway(map) : null;
    this.blocks = buildBlocks(map, look, woody, this.cut);
    this.planks = buildPlanks(map, look);
    this.under.add(this.ground, this.planks);
    this.group.add(this.blocks);
    this.wallH = look.indoor ? DUNGEON_WALL : woody ? 1 : 1.6;
    this.clad = look.indoor && region.kind === 'dungeon' ? (CLADDING[theme] ?? null) : null;
    this.placeAll(woody);
    this.cladWalls();
    this.clearWays();
    this.passages(woody);
    this.placeSlabs();
    if (this.carpets.length || this.rugs.length) {
      const c = buildCarpets(this.carpets, this.rugs);
      this.under.add(c);
      this.built.push(c);
    }
    // the shadow of what stands, one soft disc each
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(quad, shadowMaterial, 1500);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.shadows.position.y = 0.04;
    this.under.add(this.shadows);
    // a door or a cracked wall is a block of its own: it can go away
    const box = boxMesh(look.indoor ? hexRgb(look.stone!.brick[2]) : [0.47, 0.34, 0.2]);
    let doors = 0;
    for (let i = 0; i < map.w * map.h; i++) {
      const k = map.kind[i]!;
      if (k === K.Door || k === K.Cracked) {
        doors++;
        this.doors.push({ i, x: i % map.w, y: Math.floor(i / map.w), k, h: map.solid[i] ? 1 : 0 });
      }
    }
    this.doorStand = new Stand(box, this.group, Math.max(1, doors));
    this.updateDoors(0);
    // (materials may need to compile on first draw; nothing else is set up lazily)
  }

  private pack(id: string): MeshData | null {
    const base = id.replace('~', '').split('#')[0]!;
    if (base.startsWith('built_')) return builtProp(base);
    return this.packs.nature.meshes[base] ?? this.packs.town.meshes[base] ?? this.packs.indoor.meshes[base] ?? this.packs.hero.meshes[base] ?? null;
  }

  /** A roof color for this land: a village has two or three, a desert's are clay and a dead land's are slate. */
  private roofOf(tx: number, ty: number): string {
    const list = ROOFS[this.region.theme] ?? ROOFS.default!;
    return list[Math.floor(hash2(tx, ty, 23) * list.length)]!.slice(1);
  }

  /**
   * Keeps the roads out of a land open: no tree stands on or beside a way out, and where it is at the map's
   * edge the wood beyond the edge opens onto it too, so the road is seen running on.
   */
  private clearWays(): void {
    const { w: W, h: H } = this.map;
    for (const pm of this.map.markers) {
      if (pm.marker.kind !== 'exit' || pm.marker.door) continue;
      let x0 = pm.tx - 2;
      let x1 = pm.tx + 3;
      let z0 = pm.ty - 2;
      let z1 = pm.ty + 3;
      if (pm.tx < 4) x0 = -8;
      if (pm.tx > W - 5) x1 = W + 8;
      if (pm.ty < 4) z0 = -8;
      if (pm.ty > H - 5) z1 = H + 8;
      this.clearTrees(x0, x1, z0, z1, true);
    }
  }

  /**
   * Every road out of a land goes through something of the land itself, so the way on is part of the place and not a
   * gap at its edge: in a land of rock, a cave mouth in the land's own stone, its throat dark and its light inside; in a
   * wood, a tunnel of tall trees closing over the road; in the farms, the towns and the open country, an old stone arch
   * over the road. Each faces into the land from the edge it stands at.
   */
  private passages(woody: boolean): void {
    const { map, look, region } = this;
    if (look.indoor || region.kind === 'dungeon') return;
    const W = map.w;
    const H = map.h;
    const done: { to: string; x: number; z: number }[] = [];
    for (const pm of map.markers) {
      const mk = pm.marker;
      if (mk.kind !== 'exit' || mk.door || REGIONS[mk.to]?.kind === 'dungeon') continue;
      if (done.some((d) => d.to === mk.to && Math.abs(d.x - pm.tx) < 4 && Math.abs(d.z - pm.ty) < 4)) continue;
      // the way out's tiles together: its middle and its width
      const group = map.markers.filter((o) => o.marker.kind === 'exit' && o.marker.to === mk.to && Math.abs(o.tx - pm.tx) < 4 && Math.abs(o.ty - pm.ty) < 4);
      const xs = group.map((o) => o.tx);
      const zs = group.map((o) => o.ty);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2 + 0.5;
      done.push({ to: mk.to, x: pm.tx, z: pm.ty });
      // which edge it's at: the way runs out through it (its facing: the way back into the land)
      const dTop = cz;
      const dBottom = H - cz;
      const dLeft = cx;
      const dRight = W - cx;
      const least = Math.min(dTop, dBottom, dLeft, dRight);
      const edge = least === dTop ? 'n' : least === dBottom ? 's' : least === dLeft ? 'w' : 'e';
      const across = edge === 'n' || edge === 's';
      const span = across ? Math.max(...xs) - Math.min(...xs) + 1 : Math.max(...zs) - Math.min(...zs) + 1;
      // (out: the way it leaves; side: along the edge)
      const out: [number, number] = edge === 'n' ? [0, -1] : edge === 's' ? [0, 1] : edge === 'w' ? [-1, 0] : [1, 0];
      const side: [number, number] = [-out[1], out[0]];
      // (it stands on the road's last tiles, inside the land: the view stops at the map's edge, and what's past it isn't seen)
      const mx = cx - out[0] * 1.1;
      const mz = cz - out[1] * 1.1;
      // (a cave's mouth is on its south side: turned so it opens into the land)
      const rot = edge === 'n' ? 0 : edge === 's' ? Math.PI : edge === 'w' ? Math.PI / 2 : -Math.PI / 2;
      // (a town, a farm or open country has its road arched; a wood its trees)
      const arched = region.kind === 'town' || ['village', 'farm', 'plains', 'coast', 'warfront'].includes(region.theme);
      if (look.cliffs || arched || !woody) {
        if (look.cliffs) {
          // a cave mouth in the land's own rock
          const L = look.ground.leaf;
          const b = caveMouth({ top: L[4], face: L[2], foot: L[1], lip: L[5], throat: '#0c0a0a', teeth: L[2], wide: span + 1.4, high: 2.2, seed: pm.tx * 7 + pm.ty }).m.build();
          b.position.set(mx + out[0] * 0.5, 0, mz + out[1] * 0.5);
          b.rotation.y = rot;
          this.group.add(b);
          this.built.push(b);
          continue;
        }
        // an old stone arch over the road
        const mesh = this.pack('arch');
        if (!mesh) continue;
        const xw = mesh.max[0] - mesh.min[0];
        const k = Math.min((span + 1.8) / Math.max(0.01, xw), 4 / Math.max(0.01, mesh.max[1] - mesh.min[1]));
        const tint = look.stone ? hexRgb(look.stone.top) : ([0.92, 0.9, 0.86] as const);
        this.add({ m: 'arch', x: mx, z: mz, rot: across ? 0 : Math.PI / 2, sx: k, r: tint[0], g: tint[1], b: tint[2], shadow: 1.2, shadowD: 0.4 });
        continue;
      }
      // a tunnel of trees: tall ones either side of the road, taller ones behind them leaning over it, bushes at their feet
      const half = span / 2;
      for (const sd of [-1, 1]) {
        for (const [off, back, k] of [
          [half + 0.75, -1.2, 1.1],
          [half + 1.9, -0.1, 1.28],
          [half + 0.9, 1.0, 1.2],
        ] as const) {
          const kind = look.trees[Math.floor(hash2(pm.tx + sd, pm.ty + back, 91) * look.trees.length)] ?? 'oak';
          const def = TREES[kind] ?? TREES.oak;
          const m = def.m[Math.floor(hash2(pm.tx + sd * 3, pm.ty, 77) * def.m.length) % def.m.length]!;
          const x = mx + side[0] * sd * off + out[0] * back;
          const z = mz + side[1] * sd * off + out[1] * back;
          this.add({ m, x, z, rot: hash2(pm.tx, sd + back, 71) * 6.28, sx: this.fitted(m, def.h * k, 2.6), sway: kind === 'dead' ? 0 : 0.7, shadow: 1.2 });
          const bush = BUSHES[Math.floor(hash2(pm.tx + sd, pm.ty + back, 79) * BUSHES.length)]!;
          this.add({ m: bush, x: x - side[0] * sd * 0.5, z: z - side[1] * sd * 0.5, rot: hash2(sd, back, 81) * 6.28, sx: this.fitted(bush, 0.55, 0.9) });
        }
      }
    }
  }

  /** Takes away the trees standing inside an area (tiles). */
  private clearTrees(x0: number, x1: number, z0: number, z1: number, all = false): void {
    for (const list of this.cells.values()) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && (TREE_MODELS.has(p.m) || (all && WOOD_SMALL.has(p.m)))) list.splice(i, 1);
      }
    }
  }

  private add(p: Omit<Placed, 'r' | 'g' | 'b' | 'sway' | 'shadow' | 'y' | 'sz' | 'sy'> & Partial<Placed>): void {
    if (!this.pack(p.m)) return;
    const key = cellKey(Math.floor(p.z / CELL), Math.floor(p.x / CELL));
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    const placedNow: Placed = { r: 1, g: 1, b: 1, sway: 0, shadow: 0, y: 0, sy: p.sx, sz: p.sx, ...p };
    // everything that stands on the ground throws a shadow sized to it, unless it was given its own: a crate, a cart, a
    // bush, a rock, a lamp post (not what lies flat: a rug, a tuft, a flower)
    if (p.shadow === undefined && placedNow.y < 0.35) {
      const m = this.pack(p.m)!;
      const wide = Math.max(m.max[0] - m.min[0], m.max[2] - m.min[2]) * p.sx;
      const tall = (m.max[1] - m.min[1]) * placedNow.sy;
      if (tall > 0.28 && wide > 0.15) placedNow.shadow = Math.min(2.4, Math.max(0.32, wide * 0.5 + tall * 0.08));
    }
    if (this.region.kind === 'dungeon') {
      placedNow.r *= 0.86;
      placedNow.g *= 0.84;
      placedNow.b *= 0.86;
    }
    list.push(placedNow);
  }

  /** Sized to `h` tiles tall, but no wider or deeper than `wide` tiles. */
  private fitted(id: string, h: number, wide: number): number {
    const m = this.pack(id);
    if (!m) return 1;
    const across = Math.max(0.01, m.max[0] - m.min[0], m.max[2] - m.min[2]);
    return Math.min(h / Math.max(0.01, m.max[1] - m.min[1]), wide / across);
  }

  /** Sized to `h` tiles tall. */
  private sized(id: string, h: number): number {
    const m = this.pack(id);
    if (!m) return 1;
    return h / Math.max(0.01, m.max[1] - m.min[1]);
  }

  private keepIt(o: LandObject): boolean {
    this.objects.push(o);
    return !this.keep || this.keep(o);
  }

  /**
   * One tile of a wood, as the art set lays its own: a tree here and there at its full height, turned and sized each
   * its own way, with bushes, a rock and tufts of grass between, and the floor showing through; a wood's edge a little
   * thicker, so it reads as a wood. `y`: the floor it stands on.
   */
  private woodland(tx: number, ty: number, edge: boolean, y: number): void {
    const { look } = this;
    const r = hash2(tx, ty, 61);
    const jx = (hash2(tx, ty, 63) - 0.5) * 0.6;
    const jz = (hash2(tx, ty, 67) - 0.5) * 0.6;
    const x = tx + 0.5 + jx;
    const z = ty + 0.5 + jz;
    const treeAt = edge ? 0.5 : 0.32;
    if (r < treeAt) {
      const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
      const def = TREES[kind] ?? TREES.oak;
      const m = def.m[Math.floor(hash2(tx, ty, 77) * def.m.length) % def.m.length]!;
      const size = def.h * (0.72 + hash2(tx, ty, 21) * 0.34);
      const frost = kind === 'snowpine' ? FROST : null;
      this.add({ m, x, z, y, rot: hash2(tx, ty, 71) * 6.28, sx: this.fitted(m, size, 2.1), sway: kind === 'dead' || kind === 'crystal' || kind === 'cactus' ? 0 : 0.8, shadow: 1.1, ...(frost ? { r: frost[0], g: frost[1], b: frost[2] } : {}) });
      // (a bush at the foot of some trees)
      if (hash2(tx, ty, 73) < 0.45) {
        const b = BUSHES[Math.floor(hash2(tx, ty, 79) * BUSHES.length)]!;
        this.add({ m: b, x: x + 0.45, z: z + 0.3, y, rot: hash2(tx, ty, 81) * 6.28, sx: this.fitted(b, 0.45 + hash2(tx, ty, 83) * 0.2, 0.85) });
      }
    } else if (r < treeAt + 0.25) {
      const b = BUSHES[Math.floor(hash2(tx, ty, 79) * BUSHES.length)]!;
      this.add({ m: b, x, z, y, rot: hash2(tx, ty, 81) * 6.28, sx: this.fitted(b, 0.5 + hash2(tx, ty, 83) * 0.25, 1) });
    } else if (r < treeAt + 0.28) {
      const rock = ROCKS[Math.floor(hash2(tx, ty, 87) * ROCKS.length)]!;
      this.add({ m: rock, x, z, y, rot: hash2(tx, ty, 89) * 6.28, sx: this.fitted(rock, 0.25 + hash2(tx, ty, 85) * 0.25, 0.8) });
    } else if (r < treeAt + 0.45) {
      const t = TUFTS[Math.floor(hash2(tx, ty, 97) * TUFTS.length)]!;
      this.add({ m: t, x, z, y, rot: hash2(tx, ty, 99) * 6.28, sx: this.fitted(t, 0.3 + hash2(tx, ty, 95) * 0.15, 0.8), sway: 1 });
    }
  }

  /**
   * A built place's walls, faced in the dungeon pack's own masonry: every wall a room shows (its far side, and down its
   * flanks) gets the pack's wall pieces laid along it, fitted to the run (never stretched more than a quarter), in the
   * place's own stone. Most are plain courses; here and there a cracked one, a pilaster, an arched niche, a barred
   * window, each place by its own list. A cave's walls are rock and stay rock.
   */
  private cladWalls(): void {
    const clad = this.clad;
    const cut = this.cut;
    if (!clad || !this.pack('wall')) return;
    const { map } = this;
    const W = map.w;
    const H = map.h;
    const wall = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= W || y >= H) return true;
      const k = map.kind[y * W + x]!;
      return k === K.Wall || k === K.Illusion;
    };
    /** A wall standing its full height with open floor on this side of it. */
    const faces = (x: number, y: number, dx: number, dy: number): boolean => {
      if (x < 0 || y < 0 || x >= W || y >= H || !wall(x, y) || cut?.[y * W + x]) return false;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
      const k = map.kind[ny * W + nx]!;
      return k !== K.Wall && k !== K.Illusion && k !== K.Cracked && k !== K.Door;
    };
    const tint = clad.tint;
    // (a hair taller than the wall it faces: its cap lies over the wall's top, not in the same plane, where the two
    // would flicker through each other)
    const syFar = (DUNGEON_WALL + 0.035) / 4;
    const pick = (a: number, b: number, long: boolean): string => {
      // (the odd piece only on a long run, and never two alike side by side: a wall is mostly wall)
      const h = hash2(a, b, 131);
      if (!long || h > clad.odd) return hash2(a, b, 133) < clad.cracked ? 'wall_cracked' : 'wall';
      return clad.pieces[Math.floor(hash2(a, b, 137) * clad.pieces.length) % clad.pieces.length]!;
    };
    const lay = (len: number, at: (u: number) => { x: number; z: number }, rot: number, seedA: number, seedB: number, sy = syFar): void => {
      if (len === 1) {
        const p = at(0);
        // (the half piece runs from its own corner, not its middle)
        const q = at(-0.5);
        void p;
        this.add({ m: 'wall_half', x: q.x, z: q.z, rot, sx: 0.5, sy, sz: CLAD_DEEP, r: tint[0], g: tint[1], b: tint[2], shadow: 0 });
        return;
      }
      const n = Math.max(1, Math.round(len / 2.6));
      const wide = len / n;
      for (let i = 0; i < n; i++) {
        const p = at((i + 0.5) * wide - len / 2);
        // (a run's ends stay plain, where it meets its corners)
        const m = pick(seedA + i * 7, seedB, n >= 3 && i > 0 && i < n - 1 && i % 2 === 1);
        this.add({ m, x: p.x, z: p.z, rot, sx: wide / 4, sy, sz: CLAD_DEEP, r: tint[0], g: tint[1], b: tint[2], shadow: 0 });
      }
    };
    // the far walls: runs along a row, facing south
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!faces(x, y, 0, 1) || faces(x - 1, y, 0, 1)) continue;
        let x1 = x;
        while (faces(x1 + 1, y, 0, 1)) x1++;
        const len = x1 - x + 1;
        const mid = x + len / 2;
        lay(len, (u) => ({ x: mid + u, z: y + 1 - CLAD_DEEP / 2 + CLAD_OUT }), 0, x, y);
      }
    }
    // the flanks: runs down a column, facing east or west
    for (const dx of [1, -1]) {
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          if (!faces(x, y, dx, 0) || faces(x, y - 1, dx, 0)) continue;
          let y1 = y;
          while (faces(x, y1 + 1, dx, 0)) y1++;
          const len = y1 - y + 1;
          const mid = y + len / 2;
          const fx = dx > 0 ? x + 1 - CLAD_DEEP / 2 + CLAD_OUT : x + CLAD_DEEP / 2 - CLAD_OUT;
          // (turned a quarter: the piece's length runs down the wall, and its face is to the room)
          // (and a flank's cap a hair over the far wall's, where the two meet in a corner)
          lay(len, (u) => ({ x: fx, z: mid - u * dx }), (dx * Math.PI) / 2, x + 500, y, syFar + 0.004);
        }
      }
    }
  }

  private placeAll(woody: boolean): void {
    const { map, look, region } = this;
    const W = map.w;
    const H = map.h;
    const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? K.Wall : map.kind[y * W + x]!);
    const fences = (x: number, y: number): boolean => kindAt(x, y) === K.Fence;
    for (let i = 0; i < W * H; i++) {
      const tx = i % W;
      const ty = Math.floor(i / W);
      const k = map.kind[i]!;
      const x = tx + 0.5;
      const z = ty + 0.5;
      const h = hash2(tx, ty, 77);
      const wx = x * TILE;
      const wy = (ty + 1) * TILE - 3;
      switch (k) {
        case K.Tree: {
          // (a thicket of tree tiles is thinned to the eye: some of its trees are drawn as a bush or a rock, which stand as
          // solid, so a wood breathes as the art set's own woods do)
          const near = [kindAt(tx - 1, ty), kindAt(tx + 1, ty), kindAt(tx, ty - 1), kindAt(tx, ty + 1)].filter((n) => n === K.Tree || n === K.Wall).length;
          if (near >= 3 && hash2(tx, ty, 57) < 0.42) {
            const under = hash2(tx, ty, 59) < 0.93;
            const m = under ? BUSHES[Math.floor(hash2(tx, ty, 79) * BUSHES.length)]! : ROCKS[Math.floor(hash2(tx, ty, 87) * ROCKS.length)]!;
            this.add({ m, x: x + (h - 0.5) * 0.3, z: z + (hash2(tx, ty, 31) - 0.5) * 0.3, rot: h * 6.28, sx: this.fitted(m, under ? 0.62 + hash2(tx, ty, 83) * 0.2 : 0.5 + hash2(tx, ty, 85) * 0.3, 1.05) });
            break;
          }
          const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
          const def = TREES[kind] ?? TREES.oak;
          const m = def.m[Math.floor(h * def.m.length) % def.m.length]!;
          const s = this.fitted(m, def.h * (0.74 + hash2(tx, ty, 21) * 0.26), 1.9);
          // (a crystal takes the land's own light: the model itself is plain white)
          const shard = kind === 'crystal' ? hexRgb(look.leaves[hash2(tx, ty, 93) < 0.3 ? 5 : 4]) : kind === 'snowpine' ? FROST : null;
          if (this.keepIt({ x: wx, y: wy, kind: 'tree', dy: -def.h * TILE })) this.add({ m, x: x + (h - 0.5) * 0.12, z: z + (hash2(tx, ty, 31) - 0.5) * 0.12, rot: h * 6.28, sx: s, sway: kind === 'dead' || kind === 'crystal' || kind === 'cactus' ? 0 : 1, shadow: 1.25, ...(shard ? { r: shard[0], g: shard[1], b: shard[2] } : {}) });
          break;
        }
        case K.Bush:
        case K.Bramble: {
          const m = BUSHES[Math.floor(h * BUSHES.length)]!;
          const s = this.fitted(m, 0.72 + hash2(tx, ty, 21) * 0.26, 1.05);
          const thorn = k === K.Bramble;
          if (this.keepIt({ x: wx, y: wy, kind: 'bush', dy: -12 })) this.add({ m, x, z, rot: h * 6.28, sx: s, sway: 0.6, shadow: 0.7, r: thorn ? 0.72 : 1, g: thorn ? 0.5 : 1, b: thorn ? 0.72 : 1 });
          break;
        }
        case K.Rock: {
          const m = ROCKS[Math.floor(h * ROCKS.length)]!;
          const s = this.fitted(m, 0.75 + hash2(tx, ty, 21) * 0.45, 1);
          if (this.keepIt({ x: wx, y: wy, kind: 'rock', dy: -10 })) this.add({ m, x, z, rot: h * 6.28, sx: s, shadow: 0.7 });
          break;
        }
        case K.Fence: {
          const across = fences(tx - 1, ty) || fences(tx + 1, ty);
          const m = 'fence_simple';
          const size = this.pack(m);
          const sx = size ? 1.02 / Math.max(0.01, size.max[0] - size.min[0]) : 1;
          if (this.keepIt({ x: wx, y: wy, kind: 'fence', dy: -10 })) this.add({ m, x, z, rot: across ? 0 : Math.PI / 2, sx, sy: size ? 15 / TILE / Math.max(0.01, size.max[1] - size.min[1]) : sx, sz: sx });
          break;
        }
        case K.Pillar: {
          const m = look.indoor ? 'pillar' : 'statue_column';
          // (indoors a column goes up into the dark, far over anyone's head)
          const pw = this.spanOf(m, 0);
          const ph = this.spanOf(m, 1);
          if (look.indoor) {
            // (drawn each frame, so one between the camera and the hero can sink out of the way: updateColumns)
            if (this.keepIt({ x: wx, y: wy, kind: 'pillar', dy: -96 }) && this.pack(m)) this.columns.push({ m, x, z, rot: 0, sx: 1.1 / pw, sy: 3.2 / ph, sz: 1.1 / pw, r: 0.86, g: 0.84, b: 0.86, cut: 1 });
          } else if (this.keepIt({ x: wx, y: wy, kind: 'pillar', dy: -40 })) this.add({ m, x, z, rot: 0, sx: this.fitted(m, 2.6, 1), shadow: 0.8, r: 0.68, g: 0.68, b: 0.72 });
          break;
        }
        case K.Brazier: {
          const m = 'bucket';
          if (this.keepIt({ x: wx, y: wy, kind: 'brazier', dy: -24 })) this.add({ m, x, z, rot: 0, sx: this.fitted(m, 0.95, 0.9), shadow: 0.55, r: 0.5, g: 0.48, b: 0.55 });
          this.flames.push({ x, z, y: 0.95, size: 1 });
          break;
        }
        case K.Deco:
        case K.Floor: {
          if (look.indoor) break;
          const d = hash2(tx, ty, 41);
          // (under snow only the odd tuft shows through)
          if (d < (k === K.Deco ? 0.8 : look.snowy ? 0.05 : 0.26)) {
            const flower = hash2(tx, ty, 43) < 0.18 && !BARE_LANDS.has(region.theme);
            const m = flower ? FLOWERS[Math.floor(hash2(tx, ty, 47) * FLOWERS.length)]! : TUFTS[Math.floor(hash2(tx, ty, 47) * TUFTS.length)]!;
            this.add({ m, x: x + (hash2(tx, ty, 51) - 0.5) * 0.8, z: z + (hash2(tx, ty, 53) - 0.5) * 0.8, rot: d * 40, sx: this.sized(m, flower ? 0.42 : 0.34 + d * 0.2), sway: flower ? 0 : 1.2 });
          }
          break;
        }
        case K.Water: {
          if (look.lava || look.indoor) break;
          if (hash2(tx, ty, 61) < 0.05) {
            const m = hash2(tx, ty, 63) < 0.5 ? 'lily_large' : 'lily_small';
            this.add({ m, x, z, rot: h * 6.28, sx: this.sized(m, 0.12) * 0.7, y: 0.02 });
          }
          break;
        }
        case K.Wall: {
          if (look.indoor) {
            const below = kindAt(tx, ty + 1);
            if (below !== K.Wall && below !== K.Cracked && below !== K.Door) {
              // a hall's wall has a rhythm: a buttress, then a torch, then a buttress
              if (tx % 6 === 0) {
                const out = this.clad ? CLAD_OUT : 0;
                this.add({ m: 'torch_mounted', x, z: ty + 1.02 + out, rot: 0, sx: this.sized('torch_mounted', 0.7), y: 0.9 });
                this.flames.push({ x, z: ty + 1.06 + out, y: 1.4, size: 0.72 });
              } else if (tx % 6 === 3 && look.stone && !this.clad) {
                this.add({ m: 'pillar', x, z: ty + 1, rot: 0, sx: this.fitted('pillar', 3.1, 0.78), shadow: 0 });
              }
            }
            break;
          }
          if (!woody) {
            // bare land: broken rock along the top of the cliff, not a flat table
            if (hash2(tx, ty, 71) < 0.62) {
              const rock = ROCKS[Math.floor(hash2(tx, ty, 73) * ROCKS.length)]!;
              this.add({ m: rock, x: x + (h - 0.5) * 0.5, z: z + (hash2(tx, ty, 31) - 0.5) * 0.5, rot: h * 6.28, sx: this.fitted(rock, 0.7 + hash2(tx, ty, 21) * 0.8, 1.5), y: 1.5 });
            }
            break;
          }
          // the wood: its edge and its depths
          const open = kindAt(tx, ty + 1) !== K.Wall || kindAt(tx - 1, ty) !== K.Wall || kindAt(tx + 1, ty) !== K.Wall || kindAt(tx, ty - 1) !== K.Wall;
          this.woodland(tx, ty, open, 0);
          break;
        }
        default:
          break;
      }
    }
    // a bare land's cliff tops past the edge carry their broken rock, as inside
    if (!woody && !look.indoor && !look.stone) {
      for (let ty = -6; ty < H + 6; ty++) {
        for (let tx = -6; tx < W + 6; tx++) {
          if (tx >= 0 && ty >= 0 && tx < W && ty < H) continue;
          const h = hash2(tx + 40, ty + 40, 71);
          if (h > 0.5) continue;
          const rock = ROCKS[Math.floor(hash2(tx + 40, ty + 40, 73) * ROCKS.length)]!;
          this.add({ m: rock, x: tx + 0.5 + (h - 0.25) * 0.8, z: ty + 0.5 + (hash2(tx, ty, 31) - 0.5) * 0.5, rot: h * 12.5, sx: this.fitted(rock, 0.7 + hash2(tx, ty, 21) * 0.8, 1.5), y: 1.7 });
        }
      }
    }
    // the wood goes on past the edge of the map: a land doesn't stop at its border
    if (woody) {
      for (let ty = -6; ty < H + 6; ty++) {
        for (let tx = -6; tx < W + 6; tx++) {
          if (tx >= 0 && ty >= 0 && tx < W && ty < H) continue;
          this.woodland(tx, ty, false, 0);
        }
      }
    }
    // houses and halls, on the tiles the rules make solid (the rest of a lot is its yard)
    for (const b of map.buildings) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let y = b.lot.ty; y < b.lot.ty + b.lot.h; y++) {
        for (let x = b.lot.tx; x < b.lot.tx + b.lot.w; x++) {
          if (kindAt(x, y) !== K.House) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x + 1);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y + 1);
        }
      }
      if (x1 < x0) {
        x0 = b.lot.tx;
        x1 = b.lot.tx + b.lot.w;
        y0 = b.lot.ty;
        y1 = b.lot.ty + b.lot.h;
      }
      const stands = modelOnLot(b.style, b.lot, b.pics[0]?.grim === true, x0, x1, y0, y1, b.door?.[0] ?? null);
      const mesh = stands ? this.pack(stands.m) : null;
      if (!stands || !mesh) continue;
      const { m, sx, sy, sz, seat } = stands;
      const cx = stands.x;
      const cz = stands.z;
      const roof = this.roofOf(b.lot.tx, b.lot.ty);
      if (this.keepIt({ x: ((x0 + x1) / 2) * TILE, y: y1 * TILE - 2, kind: 'building', dy: -(mesh.max[1] * sy) * TILE })) {
        this.add({ m: `${m}#${roof}`, x: cx, z: cz, rot: 0, sx, sy, sz, shadow: 0 });
        // (nothing grows up through a building that's bigger than its lot)
        if (seat) this.clearTrees(cx + mesh.min[0] * sx, cx + mesh.max[0] * sx, cz + mesh.min[2] * sz, cz + mesh.max[2] * sz);
        this.standing.push({ x0: cx + mesh.min[0] * sx, x1: cx + mesh.max[0] * sx, z0: cz + mesh.min[2] * sz, z1: cz + mesh.max[2] * sz, mesh, x: cx, z: cz, sx, sy, sz });
      }
      for (const y of b.yard) this.placeProp(y.prop, y.tx, y.ty);
      // its towers, where its plan has them
      if (seat) {
        for (const p of b.pics.slice(1)) {
          const [bx0, , bx1, by1] = picBody(p);
          const round = p.id.startsWith('tower_round');
          this.placePart({ m: round ? 'b_tower_B' : 'b_tower_A', h: round ? 19 : 14, x: (bx0 + bx1) / 2 / ART_TILE, z: by1 / ART_TILE - 0.6, shadow: 2.2 }, 0, 0);
        }
      }
    }
    for (const pm of map.markers) {
      if (!this.shown(pm)) continue;
      const m = pm.marker;
      const x = pm.tx + 0.5;
      const z = pm.ty + 0.5;
      const wx = x * TILE;
      const wy = (pm.ty + 1) * TILE - 3;
      if (m.kind === 'prop') this.placeProp(m.prop, pm.tx, pm.ty);
      else if (m.kind === 'waystone') {
        if (this.keepIt({ x: wx, y: wy, kind: 'waystone', dy: -30 })) {
          // (of the land's own stone, its rune in the land's own light)
          const ws = WAYSTONES[region.theme] ?? WAYSTONES.default!;
          const wc = hexRgb(ws[0]);
          this.add({ m: 'statue_obelisk', x, z, rot: 0, sx: this.sized('statue_obelisk', 2.5), shadow: 0.7, r: wc[0], g: wc[1], b: wc[2] });
          this.glows.push({ x, z, y: 1.5, color: ws[1], size: 16 });
        }
      } else if (m.kind === 'shrine') {
        if (this.keepIt({ x: wx, y: wy, kind: 'shrine', dy: -24 })) this.add({ m: 'shrine_candles', x, z, rot: 0, sx: this.sized('shrine_candles', 1.9), shadow: 0.8 });
      } else if (m.kind === 'exit' && !look.indoor && !m.door) {
        const dungeon = REGIONS[m.to]?.kind === 'dungeon';
        const near = this.objects.some((o) => o.kind === (dungeon ? 'gate' : 'sign') && Math.abs(o.x - wx) < 3 * TILE && Math.abs(o.y - wy) < 3 * TILE);
        if (near || !this.keepIt({ x: wx, y: wy, kind: dungeon ? 'gate' : 'sign', dy: -24 })) continue;
        if (!dungeon) {
          // a signpost beside the road out
          this.add({ m: 'sign_both', x: x - 1.1, z: z + 0.2, rot: 0, sx: this.fitted('sign_both', 1.35, 0.9), shadow: 0.5 });
          continue;
        }
        const built = DOORWAYS[m.to];
        if (built) {
          const b = built.build().m.build();
          b.position.set(x, 0, z);
          this.group.add(b);
          this.built.push(b);
          const flames = (built.flames ?? []).map(([fx, fy, fz, size]) => ({ x: x + fx, z: z + fz, y: fy, size }));
          this.flames.push(...flames);
          const glows = built.glow ? [{ x: x + built.glow.x, z: z + built.glow.z, y: built.glow.y, color: built.glow.color, size: built.glow.size }] : [];
          this.glows.push(...glows);
          this.ways.set(m.to, { mesh: b, x, z, flames, glows });
        }
        const door = ENTRANCES[m.to];
        const mesh = door ? this.pack(door.m) : null;
        if (door && mesh) {
          // (some gates lie along the model's other axis: turned to face the road, and sized by their real width)
          const xw = mesh.max[0] - mesh.min[0];
          const zw = mesh.max[2] - mesh.min[2];
          const turned = zw > xw;
          const k = Math.min(door.w / Math.max(0.01, turned ? zw : xw), 4.2 / Math.max(0.01, mesh.max[1] - mesh.min[1]));
          const mx = ((mesh.min[0] + mesh.max[0]) / 2) * k;
          const mz = ((mesh.min[2] + mesh.max[2]) / 2) * k;
          const c = door.tint ? hexRgb(door.tint) : ([1, 1, 1] as const);
          this.add({ m: door.m, x: x - (turned ? mz : mx), z: z - (turned ? -mx : mz) - 0.35, rot: turned ? Math.PI / 2 : 0, sx: k, r: c[0], g: c[1], b: c[2] });
        }
      }
    }
  }

  /** A way down that has just opened: it fades up out of the ground, and its fires catch once it's there. */
  openWay(to: string): void {
    const way = this.ways.get(to);
    if (!way || this.opening.some((o) => o.way === way)) return;
    const fade = fadingMaterial();
    way.mesh.material = fade;
    way.mesh.scale.y = 0.04;
    const lit = new Set<object>([...way.flames, ...way.glows]);
    for (const list of [this.flames, this.glows] as object[][]) {
      for (let i = list.length - 1; i >= 0; i--) if (lit.has(list[i]!)) list.splice(i, 1);
    }
    this.opening.push({ way, t: 0, fade });
  }

  /** How far along the ways that are opening are. */
  tickOpening(dt: number): void {
    for (let i = this.opening.length - 1; i >= 0; i--) {
      const o = this.opening[i]!;
      o.t = Math.min(1, o.t + dt / OPEN_TIME);
      const k = o.t * o.t * (3 - 2 * o.t);
      o.fade.uniforms.uFade!.value = k;
      o.way.mesh.scale.y = 0.04 + 0.96 * k;
      if (o.t >= 1) {
        o.way.mesh.material = staticMaterial;
        o.fade.dispose();
        this.flames.push(...o.way.flames);
        this.glows.push(...o.way.glows);
        this.opening.splice(i, 1);
      }
    }
  }

  /** A dais is a low step of stone under what stands on it. */
  private placeSlabs(): void {
    for (const pm of this.map.markers) {
      if (pm.marker.kind !== 'prop' || pm.marker.prop.split(':')[0] !== 'dais' || !this.shown(pm)) continue;
      const stone = hexRgb(this.look.stone?.brick[0] ?? '#8a8698');
      this.add({ m: 'statue_block', x: pm.tx + 0.5, z: pm.ty + 0.5, rot: 0, sx: 11 / Math.max(0.01, this.spanOf('statue_block', 0)), sy: 0.14 / Math.max(0.01, this.spanOf('statue_block', 1)), sz: 4 / Math.max(0.01, this.spanOf('statue_block', 2)), r: stone[0], g: stone[1], b: stone[2] });
    }
  }

  private spanOf(id: string, axis: 0 | 1 | 2): number {
    const m = this.pack(id);
    return m ? m.max[axis] - m.min[axis] : 1;
  }

  /** One piece of a great work, its foot at (cx + part.x, cz + part.z) in tiles. */
  placePart(p: GreatPart, cx: number, cz: number): void {
    const tipX = ((p.tipX ?? 0) * Math.PI) / 180;
    const tipZ = ((p.tipZ ?? 0) * Math.PI) / 180;
    const rot = ((p.rot ?? 0) * Math.PI) / 180;
    const c = p.tint ? hexRgb(p.tint) : ([1, 1, 1] as const);
    const dim = this.region.kind === 'dungeon' ? 0.86 : 1;
    if (p.kit) {
      this.colossi.push({ kit: p.kit, x: cx + p.x, z: cz + p.z, lift: p.y ?? 0, rot, h: p.h ?? 8, clip: p.clip ?? 'idle', t: p.t ?? 0, tint: [c[0] * dim, c[1] * dim, c[2] * dim], tipX, tipZ, stone: p.stone ?? 1 });
      return;
    }
    const mesh = this.pack(p.m!);
    if (!mesh) return;
    const w = Math.max(0.01, mesh.max[0] - mesh.min[0]);
    const t = Math.max(0.01, mesh.max[1] - mesh.min[1]);
    const d = Math.max(0.01, mesh.max[2] - mesh.min[2]);
    const k = (p.h ?? 1) / t;
    const sx = p.box ? p.box[0] / w : k;
    const sy = p.box ? p.box[1] / t : k;
    const sz = p.box ? p.box[2] / d : k;
    // its foot's middle goes on the spot, however it's turned or tipped
    const foot = new THREE.Vector3(((mesh.min[0] + mesh.max[0]) / 2) * sx, mesh.min[1] * sy, ((mesh.min[2] + mesh.max[2]) / 2) * sz).applyEuler(new THREE.Euler(tipX, rot, tipZ, 'YXZ'));
    const y = p.y ?? 0;
    const sunk = y < 0 || tipX !== 0 || tipZ !== 0;
    const roofed = p.m!.startsWith('b_') && !p.tint && !p.m!.includes('#') ? `${p.m}#${this.roofOf(Math.floor(cx), Math.floor(cz))}` : p.m!;
    const piece: Giant = { m: `${sunk ? '~' : ''}${roofed}`, x: cx + p.x - foot.x, z: cz + p.z - foot.z, y: y - foot.y, rot, sx, sy, sz, r: c[0] * dim, g: c[1] * dim, b: c[2] * dim, sway: p.sway ?? 0, shadow: p.shadow ?? 0, shadowD: p.shadowD ?? 1, tipX, tipZ, reach: Math.max(w * sx, t * sy, d * sz) + 2 };
    this.giants.push(piece);
    if (p.flame) this.flames.push({ x: cx + p.x, z: cz + p.z, y: y + (p.flameY ?? 1), size: p.flame });
    if (p.glow) this.glows.push({ x: cx + p.x, z: cz + p.z, y: y + (p.glowY ?? t * sy), color: p.glow, size: p.glowSize ?? 16 });
  }

  /** A great work, by its name in the table. */
  private placeGreat(id: string, tx: number, ty: number): void {
    const work = GREAT[id];
    if (!work) return;
    this.objects.push({ x: (tx + 0.5) * TILE, y: (ty + 1) * TILE, kind: 'great', name: id, dy: -200 });
    for (const p of work.parts) this.placePart(p, tx + 0.5, ty + 0.5);
  }

  private placeProp(prop: string, tx: number, ty: number): void {
    const [name, param] = prop.split(':') as [string, string | undefined];
    if (name === 'great') {
      this.placeGreat(param!, tx, ty);
      return;
    }
    const def = PROPS[name];
    const x = tx + 0.5;
    const z = ty + 0.5;
    const wx = x * TILE;
    const wy = (ty + 1) * TILE - 3;
    const o: LandObject = { x: wx, y: wy, kind: 'prop', name, dy: -(def?.h ?? TILE) };
    if (!this.keepIt(o) || !def || !def.m) return;
    if (name === 'runner') {
      this.carpets.push({ tx, ty, c: hexRgb(param?.startsWith('#') ? param : (def.tint ?? '#7a1a1a')) });
      return;
    }
    if (name === 'rug') {
      this.rugs.push({ tx, ty, c: hexRgb(param?.startsWith('#') ? param : (def.tint ?? '#6e2a2c')) });
      return;
    }
    const mesh = this.pack(def.m);
    if (!mesh) return;
    const size = sizeWithin(mesh, def);
    let tint = def.tint;
    if (param?.startsWith('#')) tint = param;
    const c = tint ? hexRgb(tint) : ([1, 1, 1] as const);
    // (a little turn of its own for loose things; furniture stands square)
    const loose = !def.across && !def.flat && (def.w ?? TILE) < 30;
    const rot = size.rot + (loose ? (hash2(tx, ty, 3) - 0.5) * 0.5 : 0);
    // (a building-pack model carries the land's own roof color)
    const model = def.m.startsWith('b_') && !tint ? `${def.m}#${this.roofOf(tx, ty)}` : def.m;
    // (its middle on the tile, whatever the model's own origin and however it's turned)
    const lx = ((mesh.min[0] + mesh.max[0]) / 2) * size.sx;
    const lz = ((mesh.min[2] + mesh.max[2]) / 2) * size.sz;
    const ox = -(lx * Math.cos(rot) + lz * Math.sin(rot));
    const oz = -(-lx * Math.sin(rot) + lz * Math.cos(rot));
    const sw = def.w ?? TILE;
    // a nave's tall column: drawn each frame, to sink out of the way in front of the hero (updateColumns)
    if (this.look.indoor && name.endsWith('column') && (def.h ?? 0) >= 60) {
      this.columns.push({ m: model, x: x + ox, z: z + oz, rot, sx: size.sx, sy: size.sy, sz: size.sz, r: c[0] * 0.86, g: c[1] * 0.84, b: c[2] * 0.86, cut: 1 });
      return;
    }
    this.add({ m: model, x: x + ox, z: z + oz, rot, sx: size.sx, sy: size.sy, sz: size.sz, shadow: def.flat || (def.h ?? 0) < 12 ? 0 : Math.min(2.4, (sw / TILE) * 0.65), shadowD: Math.min(1, (def.d ?? sw) / sw + 0.1), y: def.flat ? 0.02 : 0, r: c[0], g: c[1], b: c[2] });
    // (at the top of the model as it was sized, which may be under the height its table allows)
    if (def.flame) this.flames.push({ x, z, y: size.sy * (mesh.max[1] - mesh.min[1]) * ((def.flameAt ?? 10) / (def.h ?? 10)), size: def.flame });
    if (def.glow) this.glows.push({ x, z, y: Math.max(0.3, ((def.h ?? 10) - 8) / TILE), color: def.glow, size: 9 });
    if (def.light) this.lamps.push({ x, z, reach: def.light });
    if (def.hero) this.statues.push({ x: x * TILE, y: z * TILE, h: def.hero, lift: (def.h ?? 0) / TILE, tint: c });
  }

  private standOf(id: string, want: number): Stand | null {
    let s = this.stands.get(id);
    if (!s) {
      const m = this.pack(id);
      if (!m) return null;
      const plain = id.replace('~', '');
      // (a person's parts and weapons keep their own colors: bone is bone, gold is gold)
      // (a tree's crown and a bush are lit by their smooth normals: soft rounded leaves in the heroes' own toon light,
      // not every flat facet of the model showing hard from above)
      const soft = /^(Tree_|Bush_)/.test(plain) ? { ...m, nor: m.sn } : m;
      s = new Stand(soft, this.group, Math.max(16, want), this.packs.hero.meshes[plain] === m ? m.col : colorsFor(m, this.look, plain), id.startsWith('~'));
      this.stands.set(id, s);
    }
    return s;
  }

  /**
   * Points on the roof of the building that stands at a spot (or nearest it, within a tile and a half), in tiles: the
   * real surface of its model, the part the camera can see. Empty where no building stands.
   */
  roofAt(x: number, z: number): readonly RoofSpot[] {
    let best: Land3D['standing'][number] | null = null;
    let bd = 1.5;
    for (const r of this.standing) {
      const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
      if (d < bd) {
        best = r;
        bd = d;
      }
    }
    if (!best) return NO_ROOF;
    const r = best;
    r.roof ??= roofOfModel(r.mesh).map((p) => ({ x: r.x + p.x * r.sx, y: p.y * r.sy, z: r.z + p.z * r.sz }));
    return r.roof;
  }

  /**
   * Is a spot hidden behind something solid from where the camera is? Spells and numbers go on a layer of their own
   * over the land, so they ask this first rather than shine through a wall.
   */
  hidden(x: number, y: number, h: number): boolean {
    const m = this.map;
    const tx = Math.floor(x / TILE);
    if (tx < 0 || tx >= m.w) return false;
    const rise = Math.tan(PITCH);
    const y0 = y / TILE;
    for (let d = 0; d < 5; d++) {
      const ty = Math.floor(y0) + d + 1;
      if (ty >= m.h) return false;
      // the height of the line of sight as it comes over this row's near edge
      const sight = h / TILE + (ty + 1 - y0) * rise;
      if (sight > 3.4) return false;
      const k = m.kind[ty * m.w + tx];
      const tall = k === K.Wall || k === K.Illusion ? (this.cut?.[ty * m.w + tx] ? CUT_WALL : this.wallH) : k === K.Rampart ? 2.4 : k === K.House ? 3.2 : 0;
      if (tall > sight) return true;
    }
    return false;
  }

  /**
   * The fires and lamps nearest the view light the dark round them; `others` are what the story has burning (tiles).
   * (A fire's light moves a little, as a fire's does. A lantern's doesn't.)
   */
  lightFlames(camX: number, camZ: number, time = 0, others: readonly { x: number; z: number; reach: number }[] = NO_LIGHTS): void {
    const list = LIGHT.uFlames.value;
    const all: { x: number; z: number; reach: number; d: number }[] = [];
    const put = (x: number, z: number, reach: number): void => {
      all.push({ x, z, reach, d: Math.hypot(x - camX, z - camZ) - reach * 0.5 });
    };
    for (const f of this.flames) put(f.x, f.z, (4.4 * f.size + 1) * (1 + Math.sin(time * 7.1 + f.x * 3.1) * 0.022 + Math.sin(time * 11.3 + f.z * 2.3) * 0.016));
    for (const l of this.lamps) put(l.x, l.z, l.reach);
    for (const o of others) put(o.x, o.z, o.reach * (1 + Math.sin(time * 6.3 + o.x) * 0.03));
    all.sort((a, b) => a.d - b.d);
    // (only so many fit: one about to lose its place to one nearer the view fades out, and doesn't blink)
    const next = all[list.length]?.d ?? Infinity;
    for (let i = 0; i < list.length; i++) {
      const n = all[i];
      if (n) list[i]!.set(n.x, n.z, n.reach * Math.min(1, (next - n.d) / 2));
      else list[i]!.set(0, 0, 0);
    }
  }

  /** Fills the instances from the cells round the camera (only when the camera has moved a cell's worth). */
  update(camX: number, camZ: number, spanX: number, spanZ: number): void {
    const cx = Math.floor(camX / 2);
    const cz = Math.floor(camZ / 2);
    if (cx === this.cx && cz === this.cz) return;
    this.cx = cx;
    this.cz = cz;
    const R = 3;
    const x0 = camX - spanX - R;
    const x1 = camX + spanX + R;
    const z0 = camZ - spanZ - R - 5;
    const z1 = camZ + spanZ + R + 2;
    const want = new Map<string, Placed[]>();
    const c0 = Math.floor(x0 / CELL);
    const c1 = Math.floor(x1 / CELL);
    const r0 = Math.floor(z0 / CELL);
    const r1 = Math.floor(z1 / CELL);
    let shadow = 0;
    const m4 = new THREE.Matrix4();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = this.cells.get(cellKey(r, c));
        if (!list) continue;
        for (const p of list) {
          if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
          let w = want.get(p.m);
          if (!w) {
            w = [];
            want.set(p.m, w);
          }
          w.push(p);
          if (p.shadow > 0 && shadow < 1500) {
            const size = p.shadow * 1.6;
            m4.makeScale(size, 1, size * (p.shadowD ?? 1));
            m4.setPosition(p.x, 0, p.z);
            this.shadows.setMatrixAt(shadow++, m4);
          }
        }
      }
    }
    for (const p of this.giants) {
      if (p.x + p.reach < x0 || p.x - p.reach > x1 || p.z + p.reach < z0 || p.z - p.reach > z1) continue;
      let w = want.get(p.m);
      if (!w) {
        w = [];
        want.set(p.m, w);
      }
      w.push(p);
      if (p.shadow > 0 && shadow < 1500) {
        const size = p.shadow * 1.6;
        m4.makeScale(size, 1, size * (p.shadowD ?? 1));
        m4.setPosition(p.x, 0, p.z);
        this.shadows.setMatrixAt(shadow++, m4);
      }
    }
    for (const c of this.columns) {
      if (c.x < x0 || c.x > x1 || c.z < z0 || c.z > z1 || shadow >= 1500) continue;
      m4.makeScale(0.9 * 1.6, 1, 0.9 * 1.6);
      m4.setPosition(c.x, 0, c.z);
      this.shadows.setMatrixAt(shadow++, m4);
    }
    this.shadows.count = shadow;
    this.shadows.instanceMatrix.needsUpdate = true;
    for (const [id, s] of this.stands) {
      if (want.has(id)) continue;
      s.begin();
      s.end();
    }
    for (const [id, list] of want) {
      let s = this.standOf(id, list.length + 40);
      if (!s) continue;
      if (list.length > (s as unknown as { cap: number }).cap) {
        s.dispose();
        this.stands.delete(id);
        s = this.standOf(id, list.length * 2)!;
      }
      s.begin();
      for (const p of list) s.put(p.x, p.y, p.z, p.rot, p.sx, p.sy, p.sz, p.r, p.g, p.b, p.sway, p.tipX ?? 0, p.tipZ ?? 0);
      s.end();
    }
  }

  /**
   * A hall's columns go up into the dark, far over anyone's head: one that stands between the camera and the hero
   * (just below the hero on the screen, where its height would hide them and the fight) sinks to a stump while it
   * does, and rises again once the hero has gone by. `hx`, `hz`: the hero, in tiles.
   */
  updateColumns(dt: number, hx: number, hz: number): void {
    if (!this.columns.length) return;
    const k = Math.min(1, dt * 7);
    for (const s of this.columnStands.values()) s.begin();
    for (const c of this.columns) {
      let s = this.columnStands.get(c.m);
      if (!s) {
        const m = this.pack(c.m)!;
        s = new Stand(m, this.group, this.columns.filter((o) => o.m === c.m).length, colorsFor(m, this.look, c.m.split('#')[0]!), false);
        s.begin();
        this.columnStands.set(c.m, s);
      }
      // (it no longer sinks out of the way in front of the hero: it thins to a dither there, as every wall does: toon.ts
      // seeThrough; what was sunk when that came in rises back)
      c.cut += (1 - c.cut) * k;
      void hx;
      void hz;
      s.put(c.x, 0, c.z, c.rot, c.sx, c.sy * c.cut, c.sz, c.r, c.g, c.b, 0);
    }
    for (const s of this.columnStands.values()) s.end();
  }

  /** Doors rise and sink as the rules open and shut them; a cracked wall is there until it is broken. */
  updateDoors(dt: number): void {
    const look = this.look;
    const tall = look.indoor ? 1.45 : 1.3;
    this.doorStand.begin();
    for (const d of this.doors) {
      const solid = this.map.solid[d.i] ? 1 : 0;
      const kind = this.map.kind[d.i];
      const target = kind === d.k ? solid : 0;
      d.h += (target - d.h) * Math.min(1, dt * 6);
      if (d.h < 0.02) continue;
      this.doorStand.put(d.x + 0.5, 0, d.y + 0.5, 0, 1, d.h * tall, 1, 1, 1, 1, 0);
    }
    this.doorStand.end();
  }

  dispose(): void {
    for (const s of this.stands.values()) s.dispose();
    this.stands.clear();
    this.doorStand.dispose();
    for (const s of this.columnStands.values()) s.dispose();
    this.ground.geometry.dispose();
    const mat = this.ground.material as THREE.ShaderMaterial;
    (mat.uniforms.uMask!.value as THREE.Texture).dispose();
    mat.dispose();
    this.blocks.geometry.dispose();
    (this.blocks as THREE.InstancedMesh).dispose();
    this.planks.geometry.dispose();
    (this.planks as THREE.InstancedMesh).dispose();
    for (const b of this.built) {
      b.geometry.dispose();
      (b as THREE.InstancedMesh).dispose();
    }
    this.shadows.geometry.dispose();
    this.shadows.dispose();
    this.group.clear();
    this.under.clear();
  }
}

/** A unit block standing on the ground. */
function boxMesh(c: readonly number[]): MeshData {
  const b = new THREE.BoxGeometry(1, 1, 1);
  b.translate(0, 0.5, 0);
  const pos = b.getAttribute('position');
  const nor = b.getAttribute('normal');
  const n = pos.count;
  const out: MeshData = {
    n,
    i: b.index!.count,
    min: [-0.5, 0, -0.5],
    max: [0.5, 1, 0.5],
    pos: Float32Array.from(pos.array as Float32Array),
    nor: Int8Array.from(nor.array as Float32Array, (x) => x * 127),
    sn: Int8Array.from(nor.array as Float32Array, (x) => x * 127),
    col: new Uint8Array(n * 3),
    idx: Uint16Array.from(b.index!.array as Uint16Array),
  };
  for (let i = 0; i < n; i++) {
    const t = pos.getY(i) > 0.5 ? 1.1 : 0.82;
    out.col[i * 3] = Math.min(255, c[0]! * 255 * t);
    out.col[i * 3 + 1] = Math.min(255, c[1]! * 255 * t);
    out.col[i * 3 + 2] = Math.min(255, c[2]! * 255 * t);
  }
  return out;
}
