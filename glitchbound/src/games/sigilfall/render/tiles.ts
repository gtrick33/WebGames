import { hash2 } from '../core/math';
import type { RegionDef, Theme } from '../data/types';
import { K, TILE, type TileMap } from '../sim/map';
import { Ground } from './ground';
import { bushArt, edgeTrunk, oakTree, pineTree, rockArt } from './art/flora';
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
        const c = (pine ? pineTree(Math.floor(h * 1000)) : oakTree(theme, Math.floor(h * 1000))).toCanvas();
        sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 3, fade: true, kind: 'tree' });
        break;
      }
      case K.Bush: {
        const c = bushArt(theme, Math.floor(h * 1000)).toCanvas();
        sc.objects.push({ x, y: bottom - 2, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'bush' });
        break;
      }
      case K.Rock: {
        const c = rockArt(theme, Math.floor(h * 1000)).toCanvas();
        sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'rock' });
        break;
      }
      case K.Fence: {
        const c = fence(map, tx, ty);
        sc.objects.push({ x, y: bottom - 4, c, dx: -8, dy: -(c.height / D) + 4 + (TILE - (c.height / D) < 0 ? 0 : 0), fade: false, kind: 'fence' });
        break;
      }
      case K.HouseAnchor: {
        const c = house(Math.floor(h * 3));
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
        if (theme !== 'crypt') {
          // the forest's edge hangs over the ground a little: trunks where foliage meets a clearing
          const below = ty + 1 < map.h ? map.kind[i + map.w] : K.Wall;
          if (below !== K.Wall && below !== K.Illusion && below !== undefined && h < 0.45) {
            const c = edgeTrunk(theme, Math.floor(h * 1000)).toCanvas();
            sc.objects.push({ x: x + (h - 0.2) * 6, y: bottom + 2, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'edge' });
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
      if (c) sc.objects.push({ x, y: bottom - 3, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: m.prop === 'well', kind: m.prop });
    }
    if (m.kind === 'waystone') {
      const c = waystone();
      sc.objects.push({ x, y: bottom - 5, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'waystone' });
    }
    if (m.kind === 'exit' && theme === 'village') {
      const c = signpost();
      sc.objects.push({ x: x - 10, y: bottom - 14, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 2, fade: false, kind: 'sign' });
    }
    if (m.kind === 'exit' && theme === 'forest') {
      const c = cryptGate();
      // drawn once for the pair of gate tiles
      if (!sc.objects.some((o) => o.kind === 'gate')) sc.objects.push({ x: x + 8, y: bottom + 1, c, dx: -(c.width / D) / 2, dy: -(c.height / D) + 4, fade: false, kind: 'gate' });
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
