import { hash2, noise2 } from '../core/math';
import type { RegionDef, Theme } from '../data/types';
import { K, TILE, type TileMap } from '../sim/map';
import { canvas, ctx2d, hexRgb, OUTLINE, shade, type Cnv } from './pixel';

/**
 * The look of a region, drawn once when it loads: the ground (grass, paths, water, stone, walls) into
 * one big canvas, and the standing things (trees, houses, pillars, props) as separate pictures the
 * renderer sorts with the characters, so you can walk behind a tree.
 */

export interface StaticObject {
  /** Sort position (the object's base). */
  x: number;
  y: number;
  c: Cnv;
  /** Where the picture's top-left goes relative to (x, y). */
  dx: number;
  dy: number;
  /** Fades when the hero walks behind it. */
  fade: boolean;
  kind: string;
}

export interface Scenery {
  ground: Cnv;
  objects: StaticObject[];
  torches: { x: number; y: number }[];
  braziers: { x: number; y: number }[];
  water: number[];
  illusions: number[];
  theme: Theme;
}

type RGB = [number, number, number];
const C = (hex: string): RGB => hexRgb(hex);

const PAL = {
  village: {
    grass: ['#62b250', '#5aaa4a', '#6cbb58', '#56a446'].map(C),
    blade: C('#86d066'),
    flowers: ['#ff5a6c', '#ffd84d', '#ffffff', '#8ab4ff', '#ff9ad8'].map(C),
    path: ['#c99d66', '#bd9058', '#d6ab74'].map(C),
    pebble: C('#9a7a52'),
    leaf: ['#2f7a3a', '#3c8f45', '#24622f', '#57a85a'].map(C),
    water: { deep: C('#2f6cc0'), shallow: C('#4a92e0'), foam: C('#cfeaff') },
  },
  forest: {
    grass: ['#4f9e58', '#489652', '#58a862', '#44904e'].map(C),
    blade: C('#62b86e'),
    flowers: ['#b0e05a', '#ffe07a', '#d8f0ff', '#ff9ad8', '#9ad0ff'].map(C),
    path: ['#a27e52', '#937046', '#b08c5e'].map(C),
    pebble: C('#6e5636'),
    leaf: ['#1a4a2c', '#215a36', '#143d24', '#2f6e44'].map(C),
    water: { deep: C('#245aa0'), shallow: C('#3a80cc'), foam: C('#bfe4ff') },
  },
  crypt: {
    slab: ['#55536a', '#5b5970', '#504e65', '#58566d'].map(C),
    mortar: C('#3a384e'),
    top: C('#17152a'),
    topHi: C('#221f38'),
    brick: ['#6a6488', '#5e587c', '#726c90'].map(C),
    brickMortar: C('#2c2840'),
    moss: C('#4a6a4a'),
    path: ['#5a5468', '#524c60', '#625c70'].map(C),
  },
};

/* --------------------------------------------------------------- ground */

const isGroundKind = (k: number): boolean => k === K.Floor || k === K.Deco || k === K.Path || k === K.Cobble || k === K.Water || k === K.Bramble || k === K.Door;

/** What the ground looks like under a tile (solid things stand on grass/stone). */
function groundOf(k: number): number {
  if (k === K.Path || k === K.Cobble || k === K.Water || k === K.Bramble || k === K.Bridge || k === K.Deco || k === K.Wall || k === K.Illusion || k === K.Cracked) return k;
  if (k === K.Door) return K.Floor;
  return K.Floor;
}

export function buildScenery(map: TileMap, region: RegionDef): Scenery {
  const theme = region.theme;
  const W = map.w * TILE;
  const H = map.h * TILE;
  const ground = canvas(W, H);
  const g = ctx2d(ground);
  const img = g.createImageData(W, H);
  const d = img.data;
  const water: number[] = [];
  const illusions: number[] = [];
  const kindAt = (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? K.Wall : map.kind[ty * map.w + tx]!);
  for (let i = 0; i < map.w * map.h; i++) {
    if (map.kind[i] === K.Water) water.push(i);
    if (map.kind[i] === K.Illusion) illusions.push(i);
  }
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const c = theme === 'crypt' ? cryptPixel(kindAt, px, py) : outdoorPixel(theme, kindAt, px, py);
      const o = (py * W + px) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (theme !== 'crypt') drawCanopy(g, map, theme);
  const sc: Scenery = { ground, objects: [], torches: [], braziers: [], water, illusions, theme };
  decorateGround(sc, map, region, g);
  buildObjects(sc, map, region);
  sc.objects.sort((a, b) => a.y - b.y);
  return sc;
}

/** Village and forest ground, with wobbly natural edges between kinds. */
function outdoorPixel(theme: Theme, kindAt: (tx: number, ty: number) => number, px: number, py: number): RGB {
  const P = theme === 'forest' ? PAL.forest : PAL.village;
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  const own = groundOf(kindAt(tx, ty));
  // sample a nearby tile: edges between grass, path, water and foliage wander naturally
  const ox = (noise2(px / 5, py / 5, 7) - 0.5) * 7;
  const oy = (noise2(px / 5, py / 5, 13) - 0.5) * 7;
  let k = own;
  if (own !== K.Bridge) {
    const sk = groundOf(kindAt(Math.floor((px + ox) / TILE), Math.floor((py + oy) / TILE)));
    if (sk !== K.Bridge && (isGroundKind(sk) || sk === K.Wall || sk === K.Illusion)) k = sk;
  }
  const n = noise2(px / 7, py / 7, 3);
  const h = hash2(px, py, 1);
  switch (k) {
    case K.Wall:
    case K.Illusion: {
      // dense foliage: clumps of leaves with light tops
      const clump = noise2(px / 5, py / 4, 21);
      const top = noise2(px / 5, (py + 2) / 4, 21);
      let col = P.leaf[clump > 0.6 ? 1 : clump > 0.35 ? 0 : 2]!;
      if (top - clump > 0.12) col = P.leaf[3]!;
      if (h < 0.04) col = P.leaf[3]!;
      // foliage meeting the ground: a dark rim
      const below = groundOf(kindAt(tx, Math.floor((py + 3) / TILE)));
      if (below !== K.Wall && below !== K.Illusion && (py % TILE) > 11) col = mix(col, [10, 30, 16], 0.45);
      return col;
    }
    case K.Water: {
      // shallow near the shore, foam right at the edge
      let shore = 0;
      for (const [dx, dy] of [
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
      ] as const) {
        const kk = groundOf(kindAt(Math.floor((px + dx + ox * 0.5) / TILE), Math.floor((py + dy + oy * 0.5) / TILE)));
        if (kk !== K.Water) shore += 1;
      }
      if (shore >= 1 && hash2(px, py, 9) < 0.55) return P.water.foam;
      const deep = noise2(px / 9, py / 9, 5);
      const base = shore ? P.water.shallow : mix(P.water.deep, P.water.shallow, deep * 0.6);
      if (h < 0.015) return mix(base, P.water.foam, 0.5);
      return base;
    }
    case K.Path: {
      let col = P.path[n > 0.62 ? 2 : n < 0.35 ? 1 : 0]!;
      if (h < 0.03) col = P.pebble;
      else if (h < 0.05) col = mix(col, [255, 240, 210], 0.25);
      return col;
    }
    case K.Cobble:
      return cobble(px, py);
    case K.Bridge:
      return bridge(px, py);
    case K.Bramble: {
      const base = grass(P, px, py, n, h, false);
      const vine = Math.abs(Math.sin(px * 0.7 + Math.sin(py * 0.5) * 2)) < 0.25 || Math.abs(Math.sin(py * 0.8 + px * 0.3)) < 0.18;
      if (vine) return hash2(px, py, 4) < 0.12 ? C('#d8364a') : C('#3a4a22');
      return mix(base, [40, 50, 20], 0.35);
    }
    default:
      return grass(P, px, py, n, h, k === K.Deco);
  }
}

function grass(P: typeof PAL.village, px: number, py: number, n: number, h: number, deco: boolean): RGB {
  const n2 = noise2(px / 3, py / 3, 9);
  let col = P.grass[n > 0.68 ? 2 : n < 0.26 ? 3 : n2 > 0.62 ? 1 : 0]!;
  // little blades
  const bx = Math.floor(px / 4);
  const by = Math.floor(py / 5);
  const bh = hash2(bx, by, 2);
  if (bh < 0.35 && px % 4 === Math.floor(bh * 9) % 4 && (py % 5 === 1 || py % 5 === 2)) col = P.blade;
  else if (h < 0.03) col = mix(col, [255, 255, 200], 0.18);
  if (deco) {
    // flowers in little clusters
    const fx = Math.floor(px / 5);
    const fy = Math.floor(py / 5);
    const fh = hash2(fx, fy, 6);
    if (fh < 0.5) {
      const cx = fx * 5 + 2;
      const cy = fy * 5 + 2;
      const dx = px - cx;
      const dy = py - cy;
      const flower = P.flowers[Math.floor(fh * 10) % P.flowers.length]!;
      if (Math.abs(dx) + Math.abs(dy) === 1) return flower;
      if (dx === 0 && dy === 0) return C('#ffe066');
    }
  }
  return col;
}

function cobble(px: number, py: number): RGB {
  // stones: the nearest of a jittered point per 6 px cell; the gaps are where two stones meet
  const cx = Math.floor(px / 6);
  const cy = Math.floor(py / 6);
  let d1 = 99;
  let d2 = 99;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox;
      const gy = cy + oy;
      const sx = gx * 6 + 1 + hash2(gx, gy, 21) * 4;
      const sy = gy * 6 + 1 + hash2(gx, gy, 22) * 4;
      const d = (px - sx) * (px - sx) + (py - sy) * (py - sy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(gx, gy, 23);
      } else if (d < d2) d2 = d;
    }
  }
  const edge = Math.sqrt(d2) - Math.sqrt(d1);
  if (edge < 0.9) return C('#6e6a78');
  let base: RGB = id < 0.33 ? C('#b2aeb8') : id < 0.66 ? C('#a39fab') : C('#bcb6b0');
  if (edge < 1.8) base = mix(base, [70, 64, 84], 0.25);
  else if (Math.sqrt(d1) < 1.3) base = mix(base, [255, 255, 255], 0.22);
  return base;
}

function bridge(px: number, py: number): RGB {
  const ly = py % 4;
  if (ly === 3) return C('#4a3020');
  const v = hash2(Math.floor(px / 12), Math.floor(py / 4), 5);
  let base: RGB = v < 0.5 ? C('#a87848') : C('#9a6c40');
  if (ly === 0) base = mix(base, [255, 230, 190], 0.15);
  if (px % 12 === 2 && ly === 1) base = C('#5a4030');
  return base;
}

/** Crypt ground: stone slabs, brick wall faces, shadows under walls. */
function cryptPixel(kindAt: (tx: number, ty: number) => number, px: number, py: number): RGB {
  const P = PAL.crypt;
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  const k = kindAt(tx, ty);
  const ly = py % TILE;
  if (k === K.Wall || k === K.Cracked) {
    const below = kindAt(tx, ty + 1);
    const faceVisible = below !== K.Wall && below !== K.Cracked;
    if (!faceVisible || ly < 6) {
      const n = noise2(px / 4, py / 4, 31);
      let col = n > 0.55 ? P.topHi : P.top;
      if (faceVisible && ly === 5) col = mix(P.topHi, [255, 255, 255], 0.12);
      return col;
    }
    // the visible face: bricks
    const fy = ly - 6;
    const row = Math.floor(fy / 4);
    const off = row % 2 ? 4 : 0;
    const bx = Math.floor((px + off) / 8);
    if (fy % 4 === 3 || (px + off) % 8 === 0) return P.brickMortar;
    let col = P.brick[Math.floor(hash2(bx, row + ty * 3, 12) * 3)]!;
    if (ly === 15) col = mix(col, [0, 0, 0], 0.35);
    if (k === K.Cracked) {
      const crack = Math.abs((px % TILE) - 8 - Math.sin(py * 0.9) * 2) < 0.8 || Math.abs((px % TILE) - 4 - (py % TILE) * 0.4) < 0.6;
      if (crack) return C('#151222');
    }
    if (hash2(px, py, 14) < 0.03) col = P.moss;
    return col;
  }
  // floor: big worn flagstones
  const row = Math.floor(py / 12);
  const off = row % 2 ? 7 : 0;
  const sx = Math.floor((px + off) / 14);
  const lx = (px + off) % 14;
  const sy = py % 12;
  let col: RGB;
  if (lx === 0 || sy === 0) col = P.mortar;
  else {
    col = P.slab[Math.floor(hash2(sx, row, 11) * 4)]!;
    if (lx === 1 || sy === 1) col = mix(col, [255, 255, 255], 0.05);
    if (lx === 13 || sy === 11) col = mix(col, [0, 0, 0], 0.12);
    const n = noise2(px / 5, py / 5, 41);
    if (n > 0.8) col = mix(col, [20, 18, 32], 0.18);
    // a crack across some stones
    const ch = hash2(sx, row, 19);
    if (ch < 0.18 && Math.abs(lx - 3 - sy * 0.8 - ch * 20) < 0.6) col = mix(col, [0, 0, 0], 0.4);
  }
  // shadow from a wall above
  const above = kindAt(tx, ty - 1);
  if ((above === K.Wall || above === K.Cracked) && ly < 4) col = mix(col, [8, 6, 16], 0.5 - ly * 0.12);
  // moss creeps along walls
  const nearWall = kindAt(tx - 1, ty) === K.Wall || kindAt(tx + 1, ty) === K.Wall;
  if (nearWall && noise2(px / 3, py / 3, 17) > 0.72) col = mix(col, P.moss, 0.6);
  return col;
}

/**
 * Dense forest seen from above: overlapping leaf clumps over every wall tile, outlined where they
 * meet the ground, so the edge of where you can walk is always obvious.
 */
function drawCanopy(g: CanvasRenderingContext2D, map: TileMap, theme: Theme): void {
  const forest = theme === 'forest';
  const shades = forest ? ['#163d25', '#1f5233', '#2b6a42', '#3f8a55'] : ['#22602e', '#2d7a3a', '#3c9447', '#5cb15c'];
  const tiles: { x: number; y: number; h: number }[] = [];
  for (let i = 0; i < map.w * map.h; i++) {
    const k = map.kind[i];
    if (k !== K.Wall && k !== K.Illusion) continue;
    const tx = i % map.w;
    const ty = Math.floor(i / map.w);
    tiles.push({ x: tx * TILE + 8, y: ty * TILE + 8, h: hash2(tx, ty, 61) });
  }
  const blobs = (pass: number): [number, number, number][] =>
    tiles.flatMap((t) => {
      const j = (n: number): number => (hash2(t.x, t.y, 70 + n) - 0.5) * 6;
      return [
        [t.x + j(1), t.y + j(2), 9 + Math.floor(t.h * 3)],
        [t.x + j(3) + 3, t.y + j(4) - 4, 7 + Math.floor(t.h * 2)],
      ].map(([x, y, r]) => [x, y, r! - pass] as [number, number, number]);
    });
  // outline, body, mid tone (up and left: light comes from the top-left), highlights
  for (const [x, y, r] of blobs(-1)) disc(g, x, y, r, OUTLINE);
  for (const [x, y, r] of blobs(0)) disc(g, x, y, r, shades[0]!);
  for (const [x, y, r] of blobs(2)) disc(g, x - 1, y - 2, r, shades[1]!);
  for (const [x, y, r] of blobs(5)) disc(g, x - 2, y - 3, r, shades[2]!);
  for (const t of tiles) if (t.h < 0.55) disc(g, t.x - 3 + t.h * 4, t.y - 5, 1 + Math.floor(t.h * 3), shades[3]!);
  if (forest) {
    // a few berries and blossoms in the canopy
    for (const t of tiles) if (t.h > 0.93) for (const [dx, dy] of [[-2, 1], [3, -2], [0, 4]] as const) disc(g, t.x + dx, t.y + dy, 0.6, t.h > 0.965 ? '#ff8ad8' : '#ffe07a');
  }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/** Things painted flat on the ground after the terrain: rune circles, exits, platforms. */
function decorateGround(sc: Scenery, map: TileMap, region: RegionDef, g: CanvasRenderingContext2D): void {
  for (const pm of map.markers) {
    const x = (pm.tx + 0.5) * TILE;
    const y = (pm.ty + 0.5) * TILE;
    const m = pm.marker;
    if (m.kind === 'boss' && region.theme === 'crypt') runeCircle(g, x, y, m.boss === 'morgrave' ? 70 : 52, m.boss === 'morgrave' ? '#ff3fd2' : '#7af0ff');
    if (m.kind === 'boss' && region.theme === 'forest') {
      // trampled earth and bones in the den
      for (let i = 0; i < 260; i++) {
        const a = hash2(i, 1, 3) * Math.PI * 2;
        const r = Math.sqrt(hash2(i, 2, 3)) * 70;
        g.fillStyle = hash2(i, 3, 3) < 0.15 ? '#e8e0c8' : '#8a7048';
        g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), hash2(i, 4, 3) < 0.5 ? 2 : 1, 1);
      }
    }
    if (m.kind === 'waystone') {
      g.fillStyle = '#7a7890';
      ellipse(g, x, y + 5, 14, 7);
      g.fillStyle = '#9896ac';
      ellipse(g, x, y + 4, 12, 6);
      g.fillStyle = '#6a6880';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y + 4 + Math.sin(a) * 4.5), 2, 1);
      }
    }
    if (m.kind === 'exit' && region.theme === 'crypt') {
      // stairs up to the forest
      g.fillStyle = '#0e0c18';
      g.fillRect(pm.tx * TILE, pm.ty * TILE, TILE, TILE);
      for (let s = 0; s < 4; s++) {
        g.fillStyle = s % 2 ? '#3a3850' : '#4a4864';
        g.fillRect(pm.tx * TILE, pm.ty * TILE + s * 4, TILE, 3);
      }
    }
  }
  // the hidden passage looks like the hedge: only a faint shimmer, drawn live
  void sc;
}

function runeCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.save();
  g.globalAlpha = 0.35;
  g.strokeStyle = color;
  g.lineWidth = 1;
  for (const rr of [r, r - 6]) {
    g.beginPath();
    g.ellipse(Math.round(x) + 0.5, Math.round(y) + 0.5, rr, rr * 0.75, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 0.45;
  g.fillStyle = color;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const gx = Math.round(x + Math.cos(a) * (r - 3));
    const gy = Math.round(y + Math.sin(a) * (r - 3) * 0.75);
    g.fillRect(gx - 1, gy, 3, 1);
    if (i % 2) g.fillRect(gx, gy - 1, 1, 3);
  }
  g.restore();
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  for (let yy = -ry; yy <= ry; yy++) {
    const w = Math.round(rx * Math.sqrt(1 - (yy * yy) / (ry * ry)));
    g.fillRect(Math.round(x - w), Math.round(y + yy), w * 2, 1);
  }
}

/* -------------------------------------------------------------- objects */

function buildObjects(sc: Scenery, map: TileMap, region: RegionDef): void {
  const theme = region.theme;
  for (let i = 0; i < map.w * map.h; i++) {
    const tx = i % map.w;
    const ty = Math.floor(i / map.w);
    const k = map.kind[i]!;
    const x = (tx + 0.5) * TILE;
    const bottom = (ty + 1) * TILE;
    const h = hash2(tx, ty, 77);
    switch (k) {
      case K.Tree: {
        const pine = theme === 'forest' && h < 0.45;
        const c = pine ? pineTree(Math.floor(h * 1000)) : oakTree(theme, Math.floor(h * 1000));
        sc.objects.push({ x, y: bottom - 3, c, dx: -c.width / 2, dy: -c.height + 3, fade: true, kind: 'tree' });
        break;
      }
      case K.Bush: {
        const c = bush(theme, Math.floor(h * 1000));
        sc.objects.push({ x, y: bottom - 2, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'bush' });
        break;
      }
      case K.Rock: {
        const c = rock(theme, Math.floor(h * 1000));
        sc.objects.push({ x, y: bottom - 3, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'rock' });
        break;
      }
      case K.Fence: {
        const c = fence(map, tx, ty);
        sc.objects.push({ x, y: bottom - 4, c, dx: -8, dy: -c.height + 4 + (TILE - c.height < 0 ? 0 : 0), fade: false, kind: 'fence' });
        break;
      }
      case K.HouseAnchor: {
        const c = house(Math.floor(h * 3));
        // the anchor is the footprint's bottom-left: 4 tiles wide, 3 tall
        sc.objects.push({ x: tx * TILE + 32, y: bottom - 2, c, dx: -c.width / 2, dy: -c.height + 2, fade: true, kind: 'house' });
        break;
      }
      case K.Pillar: {
        const c = pillar();
        sc.objects.push({ x, y: bottom - 3, c, dx: -c.width / 2, dy: -c.height + 2, fade: true, kind: 'pillar' });
        break;
      }
      case K.Brazier: {
        const c = brazierBase();
        sc.objects.push({ x, y: bottom - 4, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'brazier' });
        sc.braziers.push({ x, y: bottom - 4 - c.height + 3 });
        break;
      }
      case K.Wall: {
        if (theme !== 'crypt') {
          // the forest's edge hangs over the ground a little: trunks where foliage meets a clearing
          const below = ty + 1 < map.h ? map.kind[i + map.w] : K.Wall;
          if (below !== K.Wall && below !== K.Illusion && below !== undefined && h < 0.45) {
            const c = edgeTrunk(theme, Math.floor(h * 1000));
            sc.objects.push({ x: x + (h - 0.2) * 6, y: bottom + 2, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'edge' });
          }
        } else {
          const below = ty + 1 < map.h ? map.kind[i + map.w] : K.Wall;
          if (below !== K.Wall && below !== K.Cracked && h < 0.16 && tx % 3 === 0) sc.torches.push({ x, y: ty * TILE + 9 });
        }
        break;
      }
      default:
        break;
    }
  }
  for (const pm of map.markers) {
    const m = pm.marker;
    const x = (pm.tx + 0.5) * TILE;
    const bottom = (pm.ty + 1) * TILE;
    if (m.kind === 'prop') {
      const c = prop(m.prop);
      if (c) sc.objects.push({ x, y: bottom - 3, c, dx: -c.width / 2, dy: -c.height + 2, fade: m.prop === 'well', kind: m.prop });
    }
    if (m.kind === 'waystone') {
      const c = waystone();
      sc.objects.push({ x, y: bottom - 5, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'waystone' });
    }
    if (m.kind === 'exit' && theme === 'village') {
      const c = signpost();
      sc.objects.push({ x: x - 10, y: bottom - 14, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'sign' });
    }
    if (m.kind === 'exit' && theme === 'forest') {
      const c = cryptGate();
      // drawn once for the pair of gate tiles
      if (!sc.objects.some((o) => o.kind === 'gate')) sc.objects.push({ x: x + 8, y: bottom + 1, c, dx: -c.width / 2, dy: -c.height + 4, fade: false, kind: 'gate' });
    }
    if (m.kind === 'shrine') {
      const c = shrine();
      sc.objects.push({ x, y: bottom - 4, c, dx: -c.width / 2, dy: -c.height + 2, fade: false, kind: 'shrine' });
    }
  }
}

/* pixel drawing helpers for procedural objects */

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

/** Adds a 1px outline around everything drawn on the canvas. */
function outline(c: Cnv): Cnv {
  const o = canvas(c.width + 2, c.height + 2);
  const g = ctx2d(o);
  const sil = canvas(c.width, c.height);
  const sg = ctx2d(sil);
  sg.drawImage(c, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = OUTLINE;
  sg.fillRect(0, 0, sil.width, sil.height);
  for (const [dx, dy] of [
    [0, 1],
    [2, 1],
    [1, 0],
    [1, 2],
  ] as const)
    g.drawImage(sil, dx, dy);
  g.drawImage(c, 1, 1);
  return o;
}

function oakTree(theme: Theme, seed: number): Cnv {
  const c = canvas(34, 42);
  const g = ctx2d(c);
  const leaf = theme === 'forest' ? ['#1f5e35', '#2c7a44', '#3f9455', '#5fb46a'] : ['#2f7a3a', '#3c9445', '#4fa852', '#7cc865'];
  // trunk
  g.fillStyle = '#6a4424';
  g.fillRect(14, 26, 6, 15);
  g.fillStyle = '#8a5a34';
  g.fillRect(14, 26, 3, 15);
  g.fillStyle = '#4a2e18';
  g.fillRect(19, 26, 1, 15);
  g.fillRect(12, 39, 2, 2);
  g.fillRect(20, 39, 2, 2);
  // canopy
  const r = (n: number): number => hash2(seed, n, 5);
  const blobs: [number, number, number][] = [
    [17, 17, 12],
    [9 + r(1) * 3, 20, 7],
    [25 - r(2) * 3, 20, 7],
    [12, 11, 8],
    [22, 11, 8],
    [17, 7, 7],
  ];
  for (const [x, y, rr] of blobs) disc(g, x, y, rr, leaf[0]!);
  for (const [x, y, rr] of blobs) disc(g, x - 1, y - 1, rr - 2, leaf[1]!);
  for (const [x, y, rr] of blobs.slice(3)) disc(g, x - 2, y - 2, rr - 4, leaf[2]!);
  disc(g, 13, 7, 2, leaf[3]!);
  disc(g, 20, 5, 1, leaf[3]!);
  if (theme === 'village' && r(3) < 0.5) for (const [x, y] of [[10, 18], [22, 15], [16, 22]] as const) disc(g, x, y, 1, '#ff5a5a');
  return outline(c);
}

function pineTree(seed: number): Cnv {
  const c = canvas(26, 44);
  const g = ctx2d(c);
  g.fillStyle = '#5a3a20';
  g.fillRect(11, 34, 4, 9);
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const top = 2 + t * 8;
    const w = 6 + t * 3;
    for (let y = 0; y < 12; y++) {
      const half = Math.round((w * y) / 12);
      g.fillStyle = y > 9 ? '#1a4a2a' : '#245e36';
      g.fillRect(13 - half, top + y, half * 2, 1);
      g.fillStyle = '#3a7e4a';
      g.fillRect(13 - half, top + y, Math.max(1, Math.round(half * 0.6)), 1);
    }
  }
  if (hash2(seed, 2, 9) < 0.4) {
    g.fillStyle = '#e8f0ff';
    g.fillRect(12, 2, 2, 1);
  }
  return outline(c);
}

function edgeTrunk(theme: Theme, seed: number): Cnv {
  const c = canvas(14, 14);
  const g = ctx2d(c);
  const dark = theme === 'forest' ? '#3a2614' : '#4a3018';
  g.fillStyle = dark;
  g.fillRect(5, 0, 4, 14);
  g.fillStyle = theme === 'forest' ? '#5a3a20' : '#6a4424';
  g.fillRect(5, 0, 2, 14);
  g.fillRect(3 + (seed % 2), 12, 2, 2);
  g.fillRect(9, 12, 2, 2);
  return outline(c);
}

function bush(theme: Theme, seed: number): Cnv {
  const c = canvas(20, 15);
  const g = ctx2d(c);
  const col = theme === 'forest' ? ['#1f5e35', '#2f7a44', '#4a9a5a'] : ['#2f7a3a', '#45963f', '#68b85a'];
  for (const [x, y, r] of [
    [6, 9, 5],
    [14, 9, 5],
    [10, 6, 6],
  ] as const)
    disc(g, x, y, r, col[0]!);
  for (const [x, y, r] of [
    [6, 8, 3],
    [13, 8, 3],
    [9, 5, 4],
  ] as const)
    disc(g, x, y, r, col[1]!);
  disc(g, 8, 4, 1, col[2]!);
  if (hash2(seed, 1, 4) < 0.5) for (const [x, y] of [[6, 10], [13, 7], [10, 11]] as const) disc(g, x, y, 0.6, theme === 'forest' ? '#c06aff' : '#ff4a6a');
  return outline(c);
}

function rock(theme: Theme, seed: number): Cnv {
  const c = canvas(16, 12);
  const g = ctx2d(c);
  const base = theme === 'crypt' ? '#5a5870' : '#8a8a9a';
  disc(g, 8, 7, 5, shade(base, -0.25));
  disc(g, 6, 6, 4, base);
  disc(g, 10, 7, 4, base);
  disc(g, 6, 5, 2, shade(base, 0.3));
  if (theme === 'forest' && hash2(seed, 3, 3) < 0.6) {
    g.fillStyle = '#4a8a3a';
    g.fillRect(4, 2, 6, 2);
    g.fillRect(3, 3, 3, 1);
  }
  return outline(c);
}

function fence(map: TileMap, tx: number, ty: number): Cnv {
  const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.w && y < map.h && map.kind[y * map.w + x] === K.Fence;
  const c = canvas(16, 18);
  const g = ctx2d(c);
  const wood = '#8a5a34';
  const dark = '#5a3a20';
  const light = '#b07a48';
  // post
  g.fillStyle = dark;
  g.fillRect(6, 4, 4, 14);
  g.fillStyle = wood;
  g.fillRect(6, 4, 3, 13);
  g.fillStyle = light;
  g.fillRect(6, 4, 3, 1);
  // rails toward neighbours
  const rail = (x0: number, x1: number): void => {
    for (const y of [8, 13]) {
      g.fillStyle = dark;
      g.fillRect(x0, y + 1, x1 - x0, 1);
      g.fillStyle = wood;
      g.fillRect(x0, y, x1 - x0, 1);
    }
  };
  if (at(tx - 1, ty)) rail(0, 7);
  if (at(tx + 1, ty)) rail(8, 16);
  if (at(tx, ty - 1)) {
    g.fillStyle = wood;
    g.fillRect(7, 0, 2, 4);
  }
  return c;
}

function house(variant: number): Cnv {
  const c = canvas(66, 68);
  const g = ctx2d(c);
  const roof = [
    ['#c9473b', '#a8352b', '#e0685a'],
    ['#4a6ac0', '#3a5098', '#6a8ae0'],
    ['#4a9a5a', '#3a7a48', '#6aba7a'],
  ][variant % 3]!;
  // walls
  g.fillStyle = '#efe0c0';
  g.fillRect(5, 34, 56, 32);
  g.fillStyle = '#d8c8a0';
  g.fillRect(5, 60, 56, 6);
  g.fillStyle = '#6a4424';
  for (const x of [5, 21, 44, 59]) g.fillRect(x, 34, 2, 32);
  g.fillRect(5, 34, 56, 2);
  g.fillRect(5, 48, 56, 1);
  // door
  g.fillStyle = '#4a2e18';
  g.fillRect(28, 46, 10, 20);
  g.fillStyle = '#7a4a28';
  g.fillRect(29, 47, 8, 19);
  g.fillStyle = '#5a3a20';
  g.fillRect(33, 47, 1, 19);
  g.fillStyle = '#ffcf5a';
  g.fillRect(35, 56, 1, 2);
  // windows with warm light
  for (const x of [10, 48]) {
    g.fillStyle = '#4a2e18';
    g.fillRect(x - 1, 39, 10, 10);
    g.fillStyle = '#ffd86b';
    g.fillRect(x, 40, 8, 8);
    g.fillStyle = '#ffeaa8';
    g.fillRect(x, 40, 3, 3);
    g.fillStyle = '#4a2e18';
    g.fillRect(x + 3, 40, 2, 8);
    g.fillRect(x, 43, 8, 2);
    g.fillStyle = '#8a5a34';
    g.fillRect(x - 2, 49, 12, 2);
  }
  // roof
  for (let y = 0; y < 32; y++) {
    const inset = Math.round(14 - (y / 31) * 14);
    const x0 = 1 + inset;
    const w = 64 - inset * 2;
    g.fillStyle = y % 4 === 3 ? roof[1]! : roof[0]!;
    g.fillRect(x0, 4 + y, w, 1);
    if (y % 4 !== 3) {
      g.fillStyle = roof[2]!;
      for (let x = x0 + ((y >> 2) % 2) * 3; x < x0 + w; x += 6) g.fillRect(x, 4 + y, 1, 1);
    }
  }
  g.fillStyle = roof[1]!;
  g.fillRect(1, 35, 64, 2);
  // chimney
  g.fillStyle = '#8a7a6a';
  g.fillRect(46, 0, 7, 12);
  g.fillStyle = '#6a5a4a';
  g.fillRect(46, 0, 7, 2);
  return outline(c);
}

function pillar(): Cnv {
  const c = canvas(14, 30);
  const g = ctx2d(c);
  g.fillStyle = '#6a6680';
  g.fillRect(1, 0, 12, 4);
  g.fillRect(0, 26, 14, 4);
  g.fillStyle = '#7a7690';
  g.fillRect(2, 4, 10, 22);
  g.fillStyle = '#9a96b0';
  g.fillRect(3, 4, 3, 22);
  g.fillStyle = '#56526c';
  g.fillRect(10, 4, 2, 22);
  g.fillStyle = '#4a465e';
  g.fillRect(6, 10, 1, 4);
  g.fillRect(7, 14, 1, 3);
  g.fillStyle = '#8a86a0';
  g.fillRect(1, 0, 12, 1);
  return outline(c);
}

function brazierBase(): Cnv {
  const c = canvas(14, 14);
  const g = ctx2d(c);
  g.fillStyle = '#3a3448';
  g.fillRect(2, 2, 10, 4);
  g.fillStyle = '#5a5470';
  g.fillRect(3, 2, 8, 1);
  g.fillStyle = '#2a2436';
  g.fillRect(5, 6, 4, 6);
  g.fillRect(2, 12, 10, 2);
  return outline(c);
}

function waystone(): Cnv {
  const c = canvas(16, 30);
  const g = ctx2d(c);
  g.fillStyle = '#6a7090';
  g.fillRect(3, 3, 10, 26);
  g.fillRect(4, 1, 8, 2);
  g.fillStyle = '#8a90b0';
  g.fillRect(4, 3, 4, 26);
  g.fillStyle = '#4a5070';
  g.fillRect(11, 4, 2, 25);
  // the rune (glows live)
  g.fillStyle = '#22e4ff';
  for (const [x, y] of [
    [7, 9],
    [8, 10],
    [7, 11],
    [8, 12],
    [7, 13],
    [6, 11],
    [9, 11],
    [7, 16],
    [8, 17],
    [7, 18],
  ] as const)
    g.fillRect(x, y, 1, 1);
  return outline(c);
}

function signpost(): Cnv {
  const c = canvas(16, 18);
  const g = ctx2d(c);
  g.fillStyle = '#6a4424';
  g.fillRect(7, 6, 2, 12);
  g.fillStyle = '#a0703f';
  g.fillRect(1, 2, 14, 6);
  g.fillStyle = '#c9905a';
  g.fillRect(1, 2, 14, 1);
  g.fillStyle = '#4a2e18';
  g.fillRect(3, 4, 7, 1);
  g.fillRect(11, 4, 2, 1);
  g.fillRect(12, 3, 1, 3);
  return outline(c);
}

function cryptGate(): Cnv {
  const c = canvas(40, 40);
  const g = ctx2d(c);
  g.fillStyle = '#4a4862';
  g.fillRect(2, 8, 8, 32);
  g.fillRect(30, 8, 8, 32);
  g.fillStyle = '#5e5a78';
  g.fillRect(3, 8, 3, 32);
  g.fillRect(31, 8, 3, 32);
  for (let y = 0; y < 12; y++) {
    const half = Math.round(18 * Math.sqrt(Math.max(0, 1 - ((y - 12) / 12) ** 2)));
    g.fillStyle = '#4a4862';
    g.fillRect(20 - half, y, half * 2, 1);
  }
  g.fillStyle = '#0e0a18';
  for (let y = 10; y < 40; y++) {
    const half = y < 18 ? Math.round(10 * Math.sqrt(Math.max(0, 1 - ((y - 18) / 8) ** 2))) : 10;
    g.fillRect(20 - half, y, half * 2, 1);
  }
  g.fillStyle = '#ff3fd2';
  g.fillRect(19, 3, 2, 3);
  return outline(c);
}

function shrine(): Cnv {
  const c = canvas(18, 24);
  const g = ctx2d(c);
  g.fillStyle = '#7a8a7a';
  g.fillRect(2, 18, 14, 6);
  g.fillStyle = '#9aaa9a';
  g.fillRect(4, 6, 10, 12);
  g.fillStyle = '#b8c8b8';
  g.fillRect(5, 6, 3, 12);
  g.fillStyle = '#4a8a3a';
  g.fillRect(2, 17, 5, 2);
  g.fillRect(12, 4, 4, 3);
  g.fillStyle = '#9cffd0';
  g.fillRect(8, 9, 2, 6);
  g.fillRect(7, 11, 4, 2);
  disc(g, 9, 3, 2, '#9cffd0');
  return outline(c);
}

/** Small village props. */
function prop(kind: string): Cnv | null {
  const c = canvas(24, 26);
  const g = ctx2d(c);
  switch (kind) {
    case 'lamp':
      g.fillStyle = '#3a3448';
      g.fillRect(11, 6, 2, 20);
      g.fillRect(8, 24, 8, 2);
      g.fillStyle = '#ffd86b';
      g.fillRect(9, 1, 6, 6);
      g.fillStyle = '#3a3448';
      g.fillRect(8, 0, 8, 1);
      g.fillRect(8, 7, 8, 1);
      break;
    case 'crate':
      g.fillStyle = '#9a6a3a';
      g.fillRect(5, 12, 14, 13);
      g.fillStyle = '#6a4424';
      g.fillRect(5, 12, 14, 1);
      g.fillRect(5, 18, 14, 1);
      g.fillRect(5, 24, 14, 1);
      g.fillRect(11, 12, 1, 13);
      g.fillStyle = '#b8844a';
      g.fillRect(6, 13, 4, 1);
      break;
    case 'barrel':
      g.fillStyle = '#8a5a34';
      g.fillRect(6, 11, 12, 15);
      g.fillStyle = '#a8703f';
      g.fillRect(7, 11, 4, 15);
      g.fillStyle = '#4a4a5a';
      g.fillRect(6, 14, 12, 1);
      g.fillRect(6, 22, 12, 1);
      g.fillStyle = '#5a3a20';
      g.fillRect(7, 10, 10, 2);
      break;
    case 'anvil':
      g.fillStyle = '#3a3a4a';
      g.fillRect(4, 14, 16, 4);
      g.fillRect(9, 18, 6, 5);
      g.fillRect(6, 23, 12, 3);
      g.fillStyle = '#6a6a7a';
      g.fillRect(4, 14, 16, 1);
      g.fillStyle = '#ff7a3d';
      g.fillRect(16, 12, 3, 2);
      break;
    case 'well':
      g.fillStyle = '#7a7a8a';
      g.fillRect(2, 14, 20, 12);
      g.fillStyle = '#9a9aaa';
      for (let x = 2; x < 22; x += 5) g.fillRect(x, 14, 4, 3);
      g.fillStyle = '#2f6cc0';
      g.fillRect(5, 15, 14, 2);
      g.fillStyle = '#6a4424';
      g.fillRect(3, 4, 2, 11);
      g.fillRect(19, 4, 2, 11);
      g.fillStyle = '#c9473b';
      g.fillRect(1, 0, 22, 5);
      g.fillStyle = '#a8352b';
      g.fillRect(1, 4, 22, 1);
      break;
    default:
      return null;
  }
  return outline(c);
}
