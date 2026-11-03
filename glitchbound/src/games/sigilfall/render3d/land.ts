import * as THREE from 'three';
import { hash2 } from '../core/math';
import { REGIONS } from '../data/regions';
import { THEMES, type ThemeLook, type TreeKind } from '../data/themes';
import type { RegionDef } from '../data/types';
import { K, TILE, type PlacedMarker, type TileMap } from '../sim/map';
import { hexRgb } from './kits';
import { loadPack, type MeshData, type Pack } from './pack';
import { LIGHT, shadowMaterial, staticMaterial } from './toon';
import { Stand } from './crowd';

/**
 * A land in 3D, from the same tile map the game's rules walk on: a painted ground (one draw call), solid blocks
 * for walls and cliffs, and trees, houses and furniture placed tile by tile. Only what is near the camera is
 * drawn, however big the land is.
 */

/** Tiles per world pixel. */
export const UNIT = 1 / TILE;

export interface LandPacks {
  nature: Pack;
  town: Pack;
  indoor: Pack;
}

let lands: Promise<LandPacks> | null = null;
export function loadLand(): Promise<LandPacks> {
  if (!lands) {
    lands = Promise.all([loadPack('nature'), loadPack('town'), loadPack('indoor')]).then(([nature, town, indoor]) => ({ nature, town, indoor }));
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
  y: number;
}

/* ------------------------------------------------------------------ what grows where */

const TREES: Record<TreeKind, { m: string[]; h: number }> = {
  oak: { m: ['Tree_1_A', 'Tree_1_B', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C'], h: 3.5 },
  pine: { m: ['Tree_4_A', 'Tree_4_B', 'tree_pineDefaultA', 'tree_pineRoundA'], h: 3.9 },
  snowpine: { m: ['tree_pineDefaultA', 'tree_pineTallA', 'tree_pineRoundA'], h: 3.9 },
  palm: { m: ['tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmDetailedShort'], h: 3.6 },
  dead: { m: ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'tree_dead_large', 'tree_dead_medium'], h: 3.1 },
  cactus: { m: ['cactus_tall', 'cactus_short'], h: 1.9 },
  mushroom: { m: ['mushroom_redTall', 'mushroom_tanTall', 'mushroom_red'], h: 2.8 },
  crystal: { m: ['stone_tallA', 'stone_tallE', 'rock_tallA'], h: 2.6 },
  willow: { m: ['Tree_5_A', 'Tree_5_B', 'Tree_5_D'], h: 3.5 },
  jungle: { m: ['Tree_6_A', 'Tree_7_A', 'Tree_7_B', 'Tree_3_A'], h: 3.8 },
} as Record<TreeKind, { m: string[]; h: number }>;

const BUSHES = ['Bush_1_A', 'Bush_1_B', 'Bush_1_D', 'Bush_2_A', 'Bush_2_C', 'Bush_3_A', 'Bush_4_A', 'Bush_4_C'];
const ROCKS = ['Rock_1_A', 'Rock_1_D', 'Rock_2_C', 'Rock_3_A', 'Rock_4_C', 'Rock_5_C', 'Rock_6_C'];
const TUFTS = ['Grass_1_A', 'Grass_2_A', 'Grass_1_B', 'Grass_2_B'];
const FLOWERS = ['flower_redA', 'flower_yellowA', 'flower_purpleA'];

/** Each prop in the data: its model and its height in tiles (0: its own size, scaled by `s`). */
const PROPS: Record<string, { m: string; h?: number; s?: number; pack?: 'town' | 'indoor' | 'nature' }> = {
  'blue-banner': { m: 'p_flag_blue', h: 2.4 },
  'red-banner': { m: 'p_flag_red', h: 2.4 },
  'skull-banner': { m: 'post_skull', h: 2.2 },
  flag: { m: 'p_flag_red', h: 2.4 },
  lantern: { m: 'lantern_standing', h: 1.7 },
  lamp: { m: 'post_lantern', h: 2 },
  tent: { m: 'b_tent', h: 1.9 },
  crate: { m: 'p_crate_A_big', h: 0.85 },
  'iron-torch': { m: 'torch_lit', h: 1.6 },
  bones: { m: 'ribcage', h: 0.5 },
  'bone-heap': { m: 'ribcage', h: 0.7 },
  skulls: { m: 'skull', h: 0.45 },
  campfire: { m: 'campfire_stones', h: 0.55 },
  debris: { m: 'debris-wood', h: 0.5 },
  rubble: { m: 'debris', h: 0.6 },
  barrel: { m: 'p_barrel', h: 0.95 },
  well: { m: 'b_well', h: 1.6 },
  'standing-stone': { m: 'statue_obelisk', h: 2.2 },
  hay: { m: 'p_haybale', h: 0.9 },
  cart: { m: 'wagon', h: 1.3 },
  'market-cart': { m: 'wagon_hay', h: 1.5 },
  'danger-sign': { m: 'sign_both', h: 1.3 },
  eggs: { m: 'p_sack', h: 0.5 },
  cage: { m: 'iron-fence', h: 1.5 },
  bench: { m: 'bench', h: 0.7 },
  anvil: { m: 'anvil', h: 0.7 },
  watchtower: { m: 'b_watchtower', h: 4 },
  flowers: { m: 'flower_redA', h: 0.55 },
  wreck: { m: 'p_boat', h: 1.2 },
  windmill: { m: 'b_windmill', h: 5 },
  scarecrow: { m: 'scarecrow', h: 1.9 },
  coffin: { m: 'coffin', h: 0.6 },
  boat: { m: 'p_boat', h: 1.2 },
  altar: { m: 'altar-stone', h: 1 },
  // furniture
  'armor-stand': { m: 'sword_shield', h: 1.3 },
  banner: { m: 'banner_red', h: 2.2 },
  'great-banner': { m: 'banner_triple_red', h: 2.5 },
  bed: { m: 'bed_decorated', h: 0.8 },
  cot: { m: 'bed_floor', h: 0.4 },
  bookshelf: { m: 'bookcase_double_decoratedA', h: 2 },
  candles: { m: 'candle_triple', h: 0.45 },
  casks: { m: 'keg', h: 1 },
  chair: { m: 'chair', h: 1 },
  stool: { m: 'stool', h: 0.55 },
  column: { m: 'pillar', h: 2.8 },
  counter: { m: 'table_long', h: 0.9 },
  cupboard: { m: 'cabinet_medium_decorated', h: 1.6 },
  dais: { m: 'stairs', h: 0.5 },
  forge: { m: 'bucket', h: 1 },
  grindstone: { m: 'grindstone', h: 1 },
  hearth: { m: 'campfire_stones', h: 0.6 },
  'high-throne': { m: 'armchair', h: 2 },
  throne: { m: 'armchair', h: 1.7 },
  longtable: { m: 'table_long_tablecloth_decorated_A', h: 0.95 },
  pew: { m: 'bench', h: 0.8 },
  rug: { m: 'rug_rectangle_A', s: 0.72 },
  shelf: { m: 'shelves_decorated', h: 1.8 },
  stair: { m: 'stairs', h: 1 },
  statue: { m: 'statue_head', h: 2.2 },
  table: { m: 'table_medium', h: 0.9 },
  trough: { m: 'p_trough', h: 0.6 },
  'war-table': { m: 'table_round_medium', h: 0.95 },
  'weapon-rack': { m: 'p_weaponrack', h: 1.3 },
  window: { m: 'p_ladder', s: 0 },
};

const BUILDINGS: Record<string, string[]> = {
  house: ['b_home_A', 'b_home_B', 'b_tavern', 'b_workshop', 'b_market', 'b_stables'],
  tower: ['b_tower_A', 'b_tower_B', 'b_watchtower'],
  temple: ['b_church', 'b_shrine'],
  keep: ['b_castle'],
  hall: ['b_townhall', 'b_barracks'],
  lighthouse: ['b_tower_B'],
  smithy: ['b_blacksmith'],
};

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

/** Green leaves take the land's own leaf colors, dark to light; bark and rock take its bark and stone. */
function colorsFor(m: MeshData, look: ThemeLook, id: string): Uint8Array {
  const out = new Uint8Array(m.col);
  const leaves = look.leaves.map(hexRgb);
  const bark = hexRgb(look.bark);
  const leafy = /^(Tree|Bush|Grass|tree_|plant|hanging)/.test(id);
  const rocky = /^(Rock|rock_|stone_)/.test(id);
  const rock = look.cliffs ? hexRgb(look.ground.leaf[3]) : null;
  for (let v = 0; v < m.n; v++) {
    const i = v * 3;
    const [h, s, l] = hsl(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255);
    if (leafy && h >= 52 && h <= 280 && s > 0.1) {
      const k = Math.max(0, Math.min(leaves.length - 1, Math.round(l * 1.35 * (leaves.length - 1))));
      const c = leaves[k]!;
      out[i] = c[0] * 255;
      out[i + 1] = c[1] * 255;
      out[i + 2] = c[2] * 255;
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
  uniform float uTime;
  uniform vec4 uGrade;
  uniform vec4 uDark;
  uniform vec4 uSee;
  uniform vec3 uFlames[6];
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
    if (uIndoor > 0.5) {
      // worn stone slabs
      vec2 s = p * 1.0;
      vec2 id = floor(s);
      vec2 f = fract(s) - 0.5;
      float line = smoothstep(0.47, 0.5, max(abs(f.x), abs(f.y)));
      c = mix(uA, uB, hash(id) * 0.7 + ck * 0.3);
      c = mix(c, uEdge, line * 0.7);
    } else {
      // grass in big soft blotches over a checker a player's eye can measure distance by
      c = mix(uA, uB, smoothstep(0.32, 0.68, n));
      c *= 1.0 + (ck - 0.5) * 0.045;
      c *= 0.97 + n2 * 0.06;
    }
    float sand = smoothstep(0.46, 0.54, m.b + wob);
    c = mix(c, mix(uSandA, uSandB, n), sand);
    float path = smoothstep(0.46, 0.54, m.r + wob);
    vec3 pc = mix(uPathA, uPathB, n * 0.7 + n2 * 0.3);
    float pathShade = smoothstep(0.54, 0.46, m.r + wob + 0.1);
    c = mix(c, pc * (1.0 - pathShade * 0.14), path);
    float cob = smoothstep(0.46, 0.54, m.a + wob * 0.4);
    if (cob > 0.0) {
      vec2 s = p * 2.0;
      s.x += mod(floor(s.y), 2.0) * 0.5;
      vec2 id = floor(s);
      vec2 f = fract(s) - 0.5;
      float line = smoothstep(0.38, 0.5, max(abs(f.x), abs(f.y)));
      vec3 st = mix(uCobA, uCobB, hash(id));
      c = mix(c, mix(st, uCobA * 0.62, line), cob);
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
    c = mix(c, uGrade.rgb, uGrade.a);
    if (uDark.x > 0.0) {
      float d = length(vW.xz - uSee.xz);
      float k = smoothstep(uDark.y * 0.45, uDark.y, d);
      for (int i = 0; i < 6; i++) {
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

export function buildGround(map: TileMap, look: ThemeLook): THREE.Mesh {
  const W = map.w;
  const H = map.h;
  const mask = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const k = map.kind[i]!;
    const at = i * 4;
    if (k === K.Path) mask[at] = 255;
    if (k === K.Water || (k === K.Bridge && !look.indoor)) mask[at + 1] = 255;
    if (k === K.Sand) mask[at + 2] = 255;
    if (k === K.Cobble) mask[at + 3] = 255;
  }
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

function blockStyles(look: ThemeLook, woody: boolean): { wall: BlockStyle; rampart: BlockStyle } {
  const st = look.stone;
  const wall: BlockStyle = st
    ? { h: 1.45, top: hexRgb(st.top), top2: hexRgb(st.topHi), side: hexRgb(st.brick[1]), side2: hexRgb(st.brick[0]) }
    : woody
      ? { h: 1.0, top: hexRgb(look.ground.leaf[1]), top2: hexRgb(look.ground.leaf[2]), side: hexRgb(look.ground.leaf[0]), side2: hexRgb(look.ground.leaf[0]) }
      : { h: 1.7, top: hexRgb(look.ground.leaf[3]), top2: hexRgb(look.ground.leaf[4]), side: hexRgb(look.ground.leaf[1]), side2: hexRgb(look.ground.leaf[0]) };
  const rampart: BlockStyle = { h: 2.4, top: [0.67, 0.65, 0.66], top2: [0.74, 0.72, 0.72], side: [0.52, 0.5, 0.54], side2: [0.44, 0.42, 0.47] };
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

function buildBlocks(map: TileMap, look: ThemeLook, woody: boolean): THREE.Mesh {
  const { wall, rampart } = blockStyles(look, woody);
  const m = new Mesher();
  const W = map.w;
  const H = map.h;
  const styleAt = (x: number, y: number): BlockStyle | null => {
    if (x < 0 || y < 0 || x >= W || y >= H) return wall;
    const k = map.kind[y * W + x]!;
    if (k === K.Wall || k === K.Illusion) return wall;
    if (k === K.Rampart) return rampart;
    return null;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = styleAt(x, y);
      if (!s) continue;
      const hs = hash2(x, y, 5);
      const h = s.h + (woody && s === wall ? (hs - 0.5) * 0.25 : 0);
      const top = shade(hs > 0.5 ? s.top : s.top2, 0.96 + hash2(x, y, 9) * 0.08);
      m.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], [0, 1, 0], top);
      const side = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
        const f = 0.92 + hash2(x, y, 13) * 0.14;
        m.quad(a, b, c, d, n, shade(s.side2, f), shade(s.side, f));
      };
      if (!styleAt(x, y + 1)) side([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, h, y + 1], [x, h, y + 1], [0, 0, 1]);
      if (!styleAt(x + 1, y)) side([x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, h, y], [x + 1, h, y + 1], [1, 0, 0]);
      if (!styleAt(x - 1, y)) side([x, 0, y], [x, 0, y + 1], [x, h, y + 1], [x, h, y], [-1, 0, 0]);
      if (!styleAt(x, y - 1)) side([x + 1, 0, y], [x, 0, y], [x, h, y], [x + 1, h, y], [0, 0, -1]);
      // crenels along a city wall
      if (s === rampart && (x + y) % 2 === 0) {
        const ch = h + 0.35;
        const b = 0.2;
        const c = shade(s.top2, 1.05);
        m.quad([x + b, ch, y + 1 - b], [x + 1 - b, ch, y + 1 - b], [x + 1 - b, ch, y + b], [x + b, ch, y + b], [0, 1, 0], c);
        m.quad([x + b, h, y + 1 - b], [x + 1 - b, h, y + 1 - b], [x + 1 - b, ch, y + 1 - b], [x + b, ch, y + 1 - b], [0, 0, 1], s.side, c);
        m.quad([x + 1 - b, h, y + 1 - b], [x + 1 - b, h, y + b], [x + 1 - b, ch, y + b], [x + 1 - b, ch, y + 1 - b], [1, 0, 0], s.side, c);
        m.quad([x + b, h, y + b], [x + b, h, y + 1 - b], [x + b, ch, y + 1 - b], [x + b, ch, y + b], [-1, 0, 0], s.side, c);
      }
      if (map.kind[y * W + x] === K.Bridge) continue;
    }
  }
  // the world past the map's edge: more of the same
  const far = 40;
  const h = wall.h;
  const t = wall.top;
  m.quad([-far, h, H + far], [0, h, H + far], [0, h, -far], [-far, h, -far], [0, 1, 0], t);
  m.quad([W, h, H + far], [W + far, h, H + far], [W + far, h, -far], [W, h, -far], [0, 1, 0], t);
  m.quad([0, h, 0], [W, h, 0], [W, h, -far], [0, h, -far], [0, 1, 0], t);
  m.quad([0, h, H + far], [W, h, H + far], [W, h, H], [0, h, H], [0, 1, 0], t);
  // planks over the water; indoors, a wooden floor (what stands on it stands on planks too)
  const wood = hexRgb(look.indoor ? '#a2703f' : '#8a6038');
  const wood2 = hexRgb(look.indoor ? '#8c5f35' : '#6f4b2c');
  const planked = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && map.kind[y * W + x] === K.Bridge;
  const y0 = look.indoor ? 0.015 : 0.1;
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
/** Nothing flowers here. */
const BARE_LANDS = new Set<string>(['volcanic', 'snow', 'desert', 'peaks', 'bonefield', 'blight', 'deadlake', 'haunted', 'rift', 'pale', 'barrow', 'plague', 'warfront', 'gloam', 'storm', 'mountain']);

export class Land3D {
  readonly group = new THREE.Group();
  readonly objects: LandObject[] = [];
  /** The fires burning here: their foot, and how tall the thing holding them is (tiles). */
  readonly flames: { x: number; z: number; y: number; size: number }[] = [];
  private readonly look: ThemeLook;
  private readonly ground: THREE.Mesh;
  private readonly blocks: THREE.Mesh;
  private readonly cells = new Map<number, Placed[]>();
  private readonly stands = new Map<string, Stand>();
  private readonly shadows: THREE.InstancedMesh;
  private cx = NaN;
  private cz = NaN;
  private readonly doors: { i: number; x: number; y: number; k: number; h: number }[] = [];
  private readonly doorStand: Stand;

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
    this.ground = buildGround(map, look);
    this.blocks = buildBlocks(map, look, woody);
    this.group.add(this.ground, this.blocks);
    this.placeAll(woody);
    // the shadow of what stands, one soft disc each
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(quad, shadowMaterial, 600);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.shadows.position.y = 0.015;
    this.group.add(this.shadows);
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
    return this.packs.nature.meshes[id] ?? this.packs.town.meshes[id] ?? this.packs.indoor.meshes[id] ?? null;
  }

  private add(p: Omit<Placed, 'r' | 'g' | 'b' | 'sway' | 'shadow' | 'y' | 'sz' | 'sy'> & Partial<Placed>): void {
    if (!this.pack(p.m)) return;
    const key = (Math.floor(p.z / CELL) << 12) | Math.floor(p.x / CELL);
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    list.push({ r: 1, g: 1, b: 1, sway: 0, shadow: 0, y: 0, sy: p.sx, sz: p.sx, ...p });
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
          const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
          const def = TREES[kind] ?? TREES.oak;
          const m = def.m[Math.floor(h * def.m.length) % def.m.length]!;
          const s = this.sized(m, def.h * (0.85 + hash2(tx, ty, 21) * 0.3));
          if (this.keepIt({ x: wx, y: wy, kind: 'tree', dy: -def.h * TILE })) this.add({ m, x: x + (h - 0.5) * 0.25, z: z + (hash2(tx, ty, 31) - 0.5) * 0.25, rot: h * 6.28, sx: s, sway: kind === 'dead' || kind === 'crystal' || kind === 'cactus' ? 0 : 1, shadow: 1.25 });
          break;
        }
        case K.Bush:
        case K.Bramble: {
          const m = BUSHES[Math.floor(h * BUSHES.length)]!;
          const s = this.sized(m, 0.95 + hash2(tx, ty, 21) * 0.3);
          const thorn = k === K.Bramble;
          if (this.keepIt({ x: wx, y: wy, kind: 'bush', dy: -12 })) this.add({ m, x, z, rot: h * 6.28, sx: s, sway: 0.6, shadow: 0.7, r: thorn ? 0.72 : 1, g: thorn ? 0.5 : 1, b: thorn ? 0.72 : 1 });
          break;
        }
        case K.Rock: {
          const m = ROCKS[Math.floor(h * ROCKS.length)]!;
          const s = this.sized(m, 0.65 + hash2(tx, ty, 21) * 0.45);
          if (this.keepIt({ x: wx, y: wy, kind: 'rock', dy: -10 })) this.add({ m, x, z, rot: h * 6.28, sx: s, shadow: 0.7 });
          break;
        }
        case K.Fence: {
          const across = fences(tx - 1, ty) || fences(tx + 1, ty);
          const m = 'fence_simple';
          const size = this.pack(m);
          const sx = size ? 1.02 / Math.max(0.01, size.max[0] - size.min[0]) : 1;
          if (this.keepIt({ x: wx, y: wy, kind: 'fence', dy: -10 })) this.add({ m, x, z, rot: across ? 0 : Math.PI / 2, sx, sy: sx * 0.9, sz: sx });
          break;
        }
        case K.Pillar: {
          const m = look.indoor ? 'pillar' : 'statue_column';
          if (this.keepIt({ x: wx, y: wy, kind: 'pillar', dy: -40 })) this.add({ m, x, z, rot: 0, sx: this.sized(m, 2.5), shadow: 0.8 });
          break;
        }
        case K.Brazier: {
          const m = 'bucket';
          if (this.keepIt({ x: wx, y: wy, kind: 'brazier', dy: -24 })) this.add({ m, x, z, rot: 0, sx: this.sized(m, 0.95), shadow: 0.55, r: 0.5, g: 0.48, b: 0.55 });
          this.flames.push({ x, z, y: 0.95, size: 1 });
          break;
        }
        case K.Deco:
        case K.Floor: {
          if (look.indoor) break;
          const d = hash2(tx, ty, 41);
          if (d < (k === K.Deco ? 0.75 : 0.12)) {
            const flower = hash2(tx, ty, 43) < 0.28 && !BARE_LANDS.has(region.theme);
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
            if (below !== K.Wall && below !== K.Cracked && h < 0.34 && tx % 3 === 0) {
              this.add({ m: 'torch_mounted', x, z: ty + 1.02, rot: 0, sx: this.sized('torch_mounted', 0.7), y: 0.72 });
              this.flames.push({ x, z: ty + 1.06, y: 1.42, size: 0.72 });
            }
            break;
          }
          if (!woody) break;
          // the forest wall: its edge is trees, and its depths a bumpy roof of crowns
          const open = kindAt(tx, ty + 1) !== K.Wall || kindAt(tx - 1, ty) !== K.Wall || kindAt(tx + 1, ty) !== K.Wall || kindAt(tx, ty - 1) !== K.Wall;
          if (open || (tx + ty) % 2 === 0) {
            const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
            const def = TREES[kind] ?? TREES.oak;
            const m = def.m[Math.floor(h * def.m.length) % def.m.length]!;
            const s = this.sized(m, def.h * (0.9 + hash2(tx, ty, 21) * 0.35));
            this.add({ m, x: x + (h - 0.5) * 0.4, z: z + (hash2(tx, ty, 31) - 0.5) * 0.4, rot: h * 6.28, sx: s, sway: 0.7 });
          }
          break;
        }
        default:
          break;
      }
    }
    // houses and halls, filling the lot the plan gave them
    for (const b of map.buildings) {
      const list = BUILDINGS[b.style] ?? BUILDINGS.house!;
      const m = list[Math.floor(hash2(b.lot.tx, b.lot.ty, 7) * list.length)]!;
      const mesh = this.pack(m);
      if (!mesh) continue;
      const wide = Math.max(mesh.max[0] - mesh.min[0], mesh.max[2] - mesh.min[2]);
      const s = Math.max(b.lot.w, b.lot.h) / Math.max(0.01, wide) * 1.04;
      const cx = b.lot.tx + b.lot.w / 2;
      const cz = b.lot.ty + b.lot.h / 2;
      if (this.keepIt({ x: cx * TILE, y: (b.lot.ty + b.lot.h) * TILE - 2, kind: 'building', dy: -(mesh.max[1] * s) * TILE })) this.add({ m, x: cx, z: cz, rot: 0, sx: s, shadow: 0 });
      for (const y of b.yard) this.placeProp(y.prop, y.tx, y.ty);
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
        if (this.keepIt({ x: wx, y: wy, kind: 'waystone', dy: -30 })) this.add({ m: 'statue_obelisk', x, z, rot: 0, sx: this.sized('statue_obelisk', 2.3), shadow: 0.7, r: 0.82, g: 0.93, b: 1.15 });
      } else if (m.kind === 'shrine') {
        if (this.keepIt({ x: wx, y: wy, kind: 'shrine', dy: -24 })) this.add({ m: 'shrine_candles', x, z, rot: 0, sx: this.sized('shrine_candles', 1.9), shadow: 0.8 });
      } else if (m.kind === 'exit' && !look.indoor && !m.door) {
        const dungeon = REGIONS[m.to]?.kind === 'dungeon';
        const id = dungeon ? 'crypt' : 'sign_both';
        const near = this.objects.some((o) => o.kind === (dungeon ? 'gate' : 'sign') && Math.abs(o.x - wx) < 3 * TILE && Math.abs(o.y - wy) < 3 * TILE);
        if (!near && this.keepIt({ x: wx, y: wy, kind: dungeon ? 'gate' : 'sign', dy: -24 })) this.add({ m: id, x, z: dungeon ? z - 1 : z, rot: 0, sx: this.sized(id, dungeon ? 3 : 1.35), shadow: dungeon ? 0 : 0.5 });
      }
    }
  }

  private placeProp(prop: string, tx: number, ty: number): void {
    const name = prop.split(':')[0]!;
    const def = PROPS[name];
    const x = tx + 0.5;
    const z = ty + 0.5;
    const wx = x * TILE;
    const wy = (ty + 1) * TILE - 3;
    const o: LandObject = { x: wx, y: wy, kind: 'prop', name, dy: -((def?.h ?? 1) * TILE) };
    if (!this.keepIt(o) || !def || !def.m || def.s === 0) return;
    const s = def.h ? this.sized(def.m, def.h) : (def.s ?? 1);
    this.add({ m: def.m, x, z, rot: (hash2(tx, ty, 3) - 0.5) * 0.5, sx: s, shadow: (def.h ?? 0) > 0.5 ? 0.6 : 0, y: 0 });
    if (name === 'campfire' || name === 'hearth' || name === 'iron-torch' || name === 'forge') this.flames.push({ x, z, y: name === 'iron-torch' ? 1.6 : name === 'forge' ? 1 : 0.35, size: name === 'campfire' || name === 'hearth' ? 1.2 : 0.9 });
  }

  private standOf(id: string, want: number): Stand | null {
    let s = this.stands.get(id);
    if (!s) {
      const m = this.pack(id);
      if (!m) return null;
      s = new Stand(m, this.group, Math.max(16, want), colorsFor(m, this.look, id));
      this.stands.set(id, s);
    }
    return s;
  }

  /** The fires nearest the view light the dark round them. */
  lightFlames(camX: number, camZ: number): void {
    const list = LIGHT.uFlames.value;
    const near = this.flames
      .map((f) => ({ f, d: Math.hypot(f.x - camX, f.z - camZ) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, list.length);
    for (let i = 0; i < list.length; i++) {
      const n = near[i];
      if (n) list[i]!.set(n.f.x, n.f.z, 4.4 * n.f.size + 1);
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
        const list = this.cells.get((r << 12) | c);
        if (!list) continue;
        for (const p of list) {
          if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
          let w = want.get(p.m);
          if (!w) {
            w = [];
            want.set(p.m, w);
          }
          w.push(p);
          if (p.shadow > 0 && shadow < 600) {
            const size = p.shadow * 1.6;
            m4.makeScale(size, 1, size);
            m4.setPosition(p.x, 0, p.z);
            this.shadows.setMatrixAt(shadow++, m4);
          }
        }
      }
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
      for (const p of list) s.put(p.x, p.y, p.z, p.rot, p.sx, p.sy, p.sz, p.r, p.g, p.b, p.sway);
      s.end();
    }
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
    this.ground.geometry.dispose();
    const mat = this.ground.material as THREE.ShaderMaterial;
    (mat.uniforms.uMask!.value as THREE.Texture).dispose();
    mat.dispose();
    this.blocks.geometry.dispose();
    (this.blocks as THREE.InstancedMesh).dispose();
    this.shadows.geometry.dispose();
    this.shadows.dispose();
    this.group.clear();
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
