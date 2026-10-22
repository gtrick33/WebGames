import { hash2 } from '../core/math';
import { REGIONS } from '../data/regions';
import { THEMES, type TreeKind } from '../data/themes';
import type { RegionDef, Theme } from '../data/types';
import { K, TILE, type TileMap } from '../sim/map';
import { Ground } from './ground';
import { building } from './art/buildings';
import { bushArt, cactus, crystalSpire, deadTree, edgeTrunk, jungleTree, mushroomTree, oakTree, palmTree, pineTree, rockArt, willowTree } from './art/flora';
import type { Painter } from './art/kit';
import { canvas, ctx2d, DETAIL, OUTLINE, type Cnv } from './pixel';

/** Art pixels per world pixel: every object picture is at art resolution. */
const D = DETAIL;

/**
 * The look of a region: the ground (see ground.ts), and the standing things (trees, houses, pillars, props) as separate pictures the
 * renderer sorts with the characters, so you can walk behind a tree.
 */

export interface StaticObject {
  /** Sort position (the object's base). */
  x: number;
  y: number;
  c: Cnv;
  /** Where the picture's top-left goes relative to (x, y), in world pixels (the picture is at art resolution). */
  dx: number;
  dy: number;
  /** Fades when the hero walks behind it. */
  fade: boolean;
  kind: string;
}

export interface Scenery {
  ground: Ground;
  objects: StaticObject[];
  torches: { x: number; y: number }[];
  braziers: { x: number; y: number }[];
  water: number[];
  illusions: number[];
  theme: Theme;
}

export function buildScenery(map: TileMap, region: RegionDef): Scenery {
  const water: number[] = [];
  const illusions: number[] = [];
  for (let i = 0; i < map.w * map.h; i++) {
    if (map.kind[i] === K.Water) water.push(i);
    if (map.kind[i] === K.Illusion) illusions.push(i);
  }
  const sc: Scenery = { ground: new Ground(map, region), objects: [], torches: [], braziers: [], water, illusions, theme: region.theme };
  buildObjects(sc, map, region);
  sc.objects.sort((a, b) => a.y - b.y);
  return sc;
}

/* -------------------------------------------------------------- objects */

/*
 * A big zone stands thousands of trees, bushes and rocks: each kind is painted in a few dozen
 * variants per theme and shared, rather than once per tile.
 */
const VARIANTS = 24;
const shared = new Map<string, Cnv>();
function variant(key: string, seed: number, paint: (seed: number) => Painter): Cnv {
  const v = seed % VARIANTS;
  const k = `${key}:${v}`;
  let c = shared.get(k);
  if (!c) {
    c = paint(v * 41 + 7).toCanvas();
    shared.set(k, c);
  }
  return c;
}

function treeArt(kind: TreeKind, theme: Theme, seed: number): Cnv {
  return variant(`${kind}:${theme}`, seed, (s) => {
    switch (kind) {
      case 'pine':
        return pineTree(s);
      case 'snowpine':
        return pineTree(s, true);
      case 'palm':
        return palmTree(s);
      case 'dead':
        return deadTree(theme, s);
      case 'cactus':
        return cactus(s);
      case 'mushroom':
        return mushroomTree(theme, s);
      case 'crystal':
        return crystalSpire(s);
      case 'willow':
        return willowTree(theme, s);
      case 'jungle':
        return jungleTree(theme, s);
      default:
        return oakTree(theme, s);
    }
  });
}

function buildObjects(sc: Scenery, map: TileMap, region: RegionDef): void {
  const theme = region.theme;
  const look = THEMES[theme];
  // woods have trunks where the canopy meets a clearing; bare lands (desert, crystal wastes) have cliffs
  const woody = !look.cliffs && look.trees.filter((t) => t !== 'cactus' && t !== 'crystal').length * 2 > look.trees.length;
  for (let i = 0; i < map.w * map.h; i++) {
    const tx = i % map.w;
    const ty = Math.floor(i / map.w);
    const k = map.kind[i]!;
    const x = (tx + 0.5) * TILE;
    const bottom = (ty + 1) * TILE;
    const h = hash2(tx, ty, 77);
    switch (k) {
      case K.Tree: {
        const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
        const c = treeArt(kind, theme, Math.floor(h * 1000));
        sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 3, fade: true, kind: 'tree' });
        break;
      }
      case K.Bush: {
        const c = variant(`bush:${theme}`, Math.floor(h * 1000), (s) => bushArt(theme, s));
        sc.objects.push({ x, y: bottom - 2, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'bush' });
        break;
      }
      case K.Rock: {
        const c = variant(`rock:${theme}`, Math.floor(h * 1000), (s) => rockArt(theme, s));
        sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'rock' });
        break;
      }
      case K.Fence: {
        const c = fence(map, tx, ty);
        sc.objects.push({ x, y: bottom - 4, c, dx: -8, dy: -(c.height / D) + 4 + (TILE - (c.height / D) < 0 ? 0 : 0), fade: false, kind: 'fence' });
        break;
      }
      case K.HouseAnchor: {
        const c = building('house', 4, 3, Math.floor(h * 1000)).toCanvas();
        // the anchor is the footprint's bottom-left: 4 tiles wide, 3 tall
        sc.objects.push({ x: tx * TILE + 32, y: bottom - 2, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: true, kind: 'house' });
        break;
      }
      case K.Pillar: {
        const c = pillar();
        sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: true, kind: 'pillar' });
        break;
      }
      case K.Brazier: {
        const c = brazierBase();
        sc.objects.push({ x, y: bottom - 4, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'brazier' });
        sc.braziers.push({ x, y: bottom - 4 - (c.height / D) + 3 });
        break;
      }
      case K.Wall: {
        if (!look.indoor) {
          if (!woody) break;
          // the forest's edge hangs over the ground a little: trunks where foliage meets a clearing
          const below = ty + 1 < map.h ? map.kind[i + map.w] : K.Wall;
          if (below !== K.Wall && below !== K.Illusion && below !== undefined && h < 0.45) {
            const c = edgeTrunk(theme, Math.floor(h * 1000)).toCanvas();
            sc.objects.push({ x: x + (h - 0.2) * 6, y: bottom + 2, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'edge' });
          }
        } else {
          const below = ty + 1 < map.h ? map.kind[i + map.w] : K.Wall;
          if (below !== K.Wall && below !== K.Cracked && below !== undefined && h < 0.16 && tx % 3 === 0) sc.torches.push({ x, y: ty * TILE + 9 });
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
      if (c) sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: m.prop === 'well', kind: m.prop });
    }
    if (m.kind === 'waystone') {
      const c = waystone();
      sc.objects.push({ x, y: bottom - 5, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'waystone' });
    }
    if (m.kind === 'building') {
      const c = building(m.style, m.w, m.h, pm.tx * 31 + pm.ty).toCanvas();
      // the marker is the footprint's bottom-left tile; the picture's bottom edge is the footprint's
      sc.objects.push({ x: (pm.tx + m.w / 2) * TILE, y: bottom - 2, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 3, fade: true, kind: 'building' });
    }
    if (m.kind === 'exit' && !look.indoor) {
      if (REGIONS[m.to]?.kind === 'dungeon') {
        if (region.id === 'whisperwood') {
          // the Hollow Crypt's gate, drawn once for the pair of gate tiles
          const c = cryptGate();
          if (!sc.objects.some((o) => o.kind === 'gate')) sc.objects.push({ x: x + 8, y: bottom + 1, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 4, fade: false, kind: 'gate' });
        } else {
          const c = caveMouth();
          sc.objects.push({ x, y: bottom + 1, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 4, fade: false, kind: 'gate' });
        }
      } else if (!sc.objects.some((o) => o.kind === 'sign' && Math.abs(o.x - (x - 10)) < 3 * TILE && Math.abs(o.y - (bottom - 14)) < 3 * TILE)) {
        // a signpost by the road out (one for a wide gateway)
        const c = signpost();
        sc.objects.push({ x: x - 10, y: bottom - 14, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'sign' });
      }
    }
    if (m.kind === 'shrine') {
      const c = shrine();
      sc.objects.push({ x, y: bottom - 4, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'shrine' });
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

/**
 * Finishes a picture drawn at world size: doubled to art resolution with Scale2x (so its curves and
 * diagonals come out smooth), then outlined with one fine art pixel.
 */
function outline(c: Cnv): Cnv {
  return outlined(smooth2x(c));
}

/** Scale2x (EPX) on a canvas: each pixel becomes four, corners take the color of matching neighbours. */
function smooth2x(c: Cnv): Cnv {
  const w = c.width;
  const h = c.height;
  const src = new Uint32Array(ctx2d(c).getImageData(0, 0, w, h).data.buffer);
  const o = canvas(w * 2, h * 2);
  const g = ctx2d(o);
  const img = g.createImageData(w * 2, h * 2);
  const dst = new Uint32Array(img.data.buffer);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]!);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const E = at(x, y);
      const B = at(x, y - 1);
      const D = at(x - 1, y);
      const F = at(x + 1, y);
      const H = at(x, y + 1);
      let e0 = E;
      let e1 = E;
      let e2 = E;
      let e3 = E;
      if (B !== H && D !== F) {
        if (D === B) e0 = D;
        if (B === F) e1 = F;
        if (D === H) e2 = D;
        if (H === F) e3 = F;
      }
      const i = y * 2 * w * 2 + x * 2;
      dst[i] = e0;
      dst[i + 1] = e1;
      dst[i + w * 2] = e2;
      dst[i + w * 2 + 1] = e3;
    }
  }
  g.putImageData(img, 0, 0);
  return o;
}

/** A one-pixel outline around everything drawn (the canvas grows a pixel on every side). */
function outlined(c: Cnv): Cnv {
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
  return smooth2x(c);
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

/** A dungeon's way in out in the wilds: a mouth in a mound of rock, with a torch either side. */
function caveMouth(): Cnv {
  const c = canvas(44, 34);
  const g = ctx2d(c);
  // the mound
  for (let y = 0; y < 34; y++) {
    const half = Math.round(21 * Math.sqrt(Math.max(0, 1 - ((y - 34) / 32) ** 2)));
    g.fillStyle = y < 6 ? '#8a8494' : '#6e6878';
    g.fillRect(22 - half, y, half * 2, 1);
  }
  g.fillStyle = '#5a5464';
  for (const [x, y, w] of [[6, 20, 6], [30, 16, 7], [12, 9, 5], [27, 7, 4], [36, 26, 4]] as const) g.fillRect(x, y, w, 2);
  g.fillStyle = '#a8a2b0';
  for (const [x, y, w] of [[14, 3, 6], [24, 2, 5], [8, 13, 3], [33, 11, 3]] as const) g.fillRect(x, y, w, 1);
  // the dark way in, framed by timbers
  g.fillStyle = '#0e0a18';
  for (let y = 12; y < 34; y++) {
    const half = y < 20 ? Math.round(9 * Math.sqrt(Math.max(0, 1 - ((y - 20) / 8) ** 2))) : 9;
    g.fillRect(22 - half, y, half * 2, 1);
  }
  g.fillStyle = '#6a4424';
  g.fillRect(11, 16, 3, 18);
  g.fillRect(30, 16, 3, 18);
  g.fillRect(10, 14, 24, 3);
  g.fillStyle = '#8a5a34';
  g.fillRect(11, 14, 22, 1);
  // torches
  for (const x of [5, 37]) {
    g.fillStyle = '#4a2e18';
    g.fillRect(x, 22, 2, 8);
    g.fillStyle = '#ff7a3d';
    g.fillRect(x - 1, 18, 4, 4);
    g.fillStyle = '#ffd86b';
    g.fillRect(x, 19, 2, 2);
  }
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

/** Small props: the village's, and the camps, nests and wrecks out in the wilds. */
function prop(kind: string): Cnv | null {
  const c = kind === 'wreck' ? canvas(48, 30) : canvas(24, 26);
  const g = ctx2d(c);
  switch (kind) {
    case 'tent':
      // canvas over a ridge pole, the flap open on the dark inside
      for (let y = 5; y < 26; y++) {
        const half = Math.round(((y - 5) / 20) * 11);
        g.fillStyle = '#d8c8a0';
        g.fillRect(12 - half, y, half * 2, 1);
        g.fillStyle = '#b8a880';
        g.fillRect(12 - half, y, Math.max(1, Math.round(half * 0.7)), 1);
      }
      g.fillStyle = '#3a2a20';
      for (let y = 13; y < 26; y++) {
        const half = Math.round(((y - 13) / 12) * 4);
        g.fillRect(13 - half, y, half * 2 + 1, 1);
      }
      g.fillStyle = '#efe0c0';
      for (let y = 13; y < 26; y++) g.fillRect(14 + Math.round(((y - 13) / 12) * 4), y, 1, 1);
      g.fillStyle = '#6a4424';
      g.fillRect(11, 2, 2, 4);
      g.fillStyle = '#c9473b';
      g.fillRect(13, 2, 4, 2);
      break;
    case 'campfire':
      g.fillStyle = '#7a7a8a';
      for (const [x, y] of [[4, 21], [7, 24], [12, 25], [17, 24], [20, 21], [17, 18], [7, 18]] as const) g.fillRect(x - 1, y - 1, 3, 2);
      g.fillStyle = '#9a9aaa';
      for (const [x, y] of [[4, 21], [12, 25], [20, 21]] as const) g.fillRect(x - 1, y - 1, 2, 1);
      g.fillStyle = '#5a3a20';
      g.fillRect(6, 21, 12, 2);
      g.fillStyle = '#7a4a28';
      g.fillRect(9, 19, 6, 2);
      g.fillStyle = '#ff7a3d';
      for (let y = 8; y < 21; y++) {
        const half = Math.round(((y - 8) / 12) * 4) + (y % 3 === 0 ? 1 : 0);
        g.fillRect(12 - half, y, half * 2, 1);
      }
      g.fillStyle = '#ffd86b';
      for (let y = 13; y < 21; y++) {
        const half = Math.round(((y - 13) / 7) * 2);
        g.fillRect(12 - half, y, half * 2, 1);
      }
      g.fillStyle = '#ff3f2a';
      g.fillRect(8, 15, 1, 3);
      g.fillRect(15, 14, 1, 4);
      break;
    case 'bones':
      // a skull and a few long bones, lying low
      g.fillStyle = '#e8e0d0';
      g.fillRect(4, 18, 6, 5);
      g.fillRect(5, 23, 4, 1);
      g.fillStyle = '#2a2230';
      g.fillRect(5, 20, 2, 1);
      g.fillRect(8, 20, 1, 1);
      g.fillStyle = '#c8c0b0';
      g.fillRect(4, 22, 6, 1);
      g.fillStyle = '#e8e0d0';
      g.fillRect(12, 22, 8, 1);
      g.fillRect(11, 21, 2, 3);
      g.fillRect(19, 21, 2, 3);
      g.fillRect(14, 17, 1, 4);
      g.fillRect(13, 16, 3, 1);
      g.fillRect(13, 21, 3, 1);
      g.fillStyle = '#c8c0b0';
      for (const x of [16, 18, 20]) g.fillRect(x, 17, 1, 3);
      g.fillRect(16, 17, 5, 1);
      break;
    case 'eggs':
      // a nest of twigs with three speckled eggs
      g.fillStyle = '#6a4a28';
      g.fillRect(3, 20, 18, 4);
      g.fillRect(5, 24, 14, 1);
      g.fillStyle = '#8a6a3a';
      for (let x = 3; x < 21; x += 3) g.fillRect(x, 19 + (x % 2), 3, 1);
      g.fillStyle = '#a8844a';
      for (let x = 4; x < 20; x += 4) g.fillRect(x, 22, 2, 1);
      for (const [x, y] of [[7, 15], [12, 14], [16, 16]] as const) {
        g.fillStyle = '#e8e4d8';
        g.fillRect(x - 2, y, 4, 5);
        g.fillRect(x - 1, y - 1, 2, 1);
        g.fillStyle = '#c8c0b0';
        g.fillRect(x + 1, y + 1, 1, 4);
        g.fillStyle = '#8a7a6a';
        g.fillRect(x - 1, y + 1, 1, 1);
        g.fillRect(x, y + 3, 1, 1);
      }
      break;
    case 'wreck': {
      // a boat on its side in the sand: planked hull, ribs where the planks are gone, the broken mast
      for (let y = 12; y < 28; y++) {
        const t = (y - 12) / 15;
        const x0 = Math.round(4 + t * 6);
        const x1 = Math.round(46 - t * 3);
        g.fillStyle = (y - 12) % 3 === 2 ? '#5a3a20' : y < 16 ? '#9a6a3a' : '#7a4a28';
        g.fillRect(x0, y, x1 - x0, 1);
      }
      g.fillStyle = '#2a1a14';
      g.fillRect(24, 14, 12, 10);
      g.fillStyle = '#9a6a3a';
      for (const x of [26, 30, 34]) g.fillRect(x, 13, 2, 12);
      g.fillStyle = '#b8844a';
      g.fillRect(4, 12, 42, 1);
      g.fillStyle = '#6a4424';
      g.fillRect(16, 1, 3, 12);
      g.fillRect(18, 4, 8, 2);
      g.fillStyle = '#d8c8a0';
      g.fillRect(19, 6, 6, 5);
      g.fillStyle = '#b8a880';
      g.fillRect(19, 9, 6, 2);
      g.fillStyle = '#3a8a6a';
      g.fillRect(8, 26, 4, 2);
      g.fillRect(38, 25, 5, 2);
      break;
    }
    case 'chickens':
      // two hens pecking
      for (const [x, y, f] of [[6, 18, 1], [16, 21, -1]] as const) {
        g.fillStyle = '#efe8dc';
        g.fillRect(x - 3, y, 7, 4);
        g.fillRect(x + f * 3 - 1, y - 2, 3, 3);
        g.fillStyle = '#c8c0b0';
        g.fillRect(x - f * 3 - (f > 0 ? 1 : -1), y - 1, 2, 2);
        g.fillStyle = '#c9473b';
        g.fillRect(x + f * 3, y - 3, 1, 1);
        g.fillStyle = '#ffcf5a';
        g.fillRect(x + f * 5 - (f < 0 ? 1 : 0), y - 1, 1, 1);
        g.fillRect(x - 1, y + 4, 1, 2);
        g.fillRect(x + 1, y + 4, 1, 2);
      }
      break;
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
