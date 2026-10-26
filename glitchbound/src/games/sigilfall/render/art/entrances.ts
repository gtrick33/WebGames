import type { Theme } from '../../data/types';
import { canvas, ctx2d, type Cnv } from '../pixel';

/**
 * The way into each dungeon, drawn in the style of what lies inside (blueprint Prompt 13: every dungeon has its
 * own identity, starting at its door): a burial mound for the barrows, a gatehouse for a fortress, a sandstone
 * pylon for a tomb, an ice arch, a sewer culvert, a root arch, a lava cave, a grieflight portal, Duskspire's
 * gate of seven locks; a cave mouth for the rest. Drawn in world pixels like the other procedural scenery
 * (the scenery builder smooths and outlines them). Every picture is 44 × 36 and stands on its bottom edge.
 */

type G = CanvasRenderingContext2D;
const W = 44;
const H = 36;

function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/** A rounded mound across the picture, light on the top left. */
function mound(g: G, top: number, lit: string, mid: string, dark: string): void {
  for (let y = top; y < H; y++) {
    const half = Math.round(21 * Math.sqrt(Math.max(0, 1 - ((y - H) / (H - top)) ** 2)));
    rect(g, 22 - half, y, half * 2, 1, y < top + 5 ? lit : mid);
    rect(g, 22 + half - Math.max(2, Math.round(half * 0.3)), y, Math.max(2, Math.round(half * 0.3)), 1, dark);
  }
}

/** A dark doorway: an arch `w` wide whose spring line is at `spring`. */
function doorway(g: G, cx: number, w: number, top: number, spring: number, color = '#0e0a18'): void {
  const half = Math.floor(w / 2);
  for (let y = top; y < H; y++) {
    const h = y < spring ? Math.round(half * Math.sqrt(Math.max(0, 1 - ((y - spring) / (spring - top)) ** 2))) : half;
    rect(g, cx - h, y, h * 2, 1, color);
  }
}

function torch(g: G, x: number, y: number): void {
  rect(g, x, y + 4, 2, 7, '#4a2e18');
  rect(g, x - 1, y, 4, 4, '#ff7a3d');
  rect(g, x, y + 1, 2, 2, '#ffd86b');
}

function blocks(g: G, x: number, y: number, w: number, h: number, base: string, lit: string, line: string, brick = 6): void {
  rect(g, x, y, w, h, base);
  for (let yy = y; yy < y + h; yy += 4) {
    rect(g, x, yy, w, 1, line);
    // every other course shifted half a block
    const off = ((yy - y) / 4) % 2 ? brick / 2 : 0;
    for (let xx = x + off; xx < x + w; xx += brick) rect(g, xx, yy, 1, 4, line);
  }
  rect(g, x, y, Math.max(2, Math.round(w * 0.25)), 1, lit);
}

const PAINT: Partial<Record<Theme, (g: G, id: string) => void>> = {
  // a barrow: a grassy mound, a trilithon door of old stone, standing stones beside it (the Chapel Crypt
  // under Briarhollow's chapel: a stone stair going down instead)
  crypt: (g, id) => {
    if (id === 'crypt') {
      blocks(g, 8, 14, 28, 22, '#8a8698', '#b8b4c4', '#5a5668', 7);
      for (let i = 0; i < 5; i++) {
        rect(g, 12 + i, 18 + i * 3, 20 - i * 2, 3, i % 2 ? '#3a3648' : '#4a4658');
        rect(g, 12 + i, 18 + i * 3, 20 - i * 2, 1, '#6e6a80');
      }
      rect(g, 16, 33, 12, 3, '#0e0a18');
      return;
    }
    mound(g, 6, '#6a9a4a', '#4e7e3a', '#3a5e2a');
    rect(g, 13, 13, 18, 3, '#8a8698');
    rect(g, 13, 13, 18, 1, '#b8b4c4');
    rect(g, 14, 16, 3, 20, '#7a7688');
    rect(g, 27, 16, 3, 20, '#6a6678');
    doorway(g, 22, 10, 16, 16);
    for (const [x, h] of [
      [3, 12],
      [38, 10],
    ] as const) {
      rect(g, x, H - h, 4, h, '#7a7688');
      rect(g, x, H - h, 2, h, '#9a96a8');
    }
  },
  // a fortress gatehouse: two towers, the arch and its portcullis, banners (the Deepforge's: a dwarven door)
  keep: (g, id) => {
    const forge = id === 'deepforge-halls';
    const stone = forge ? '#4e4a56' : '#8a8a96';
    const lit = forge ? '#6e6a78' : '#b2b2bc';
    const line = forge ? '#2e2a36' : '#6a6a78';
    blocks(g, 2, 6, 12, 30, stone, lit, line);
    blocks(g, 30, 6, 12, 30, stone, lit, line);
    blocks(g, 12, 12, 20, 24, stone, lit, line);
    for (const x of [2, 6, 10, 30, 34, 38]) rect(g, x, 3, 3, 3, stone);
    doorway(g, 22, 12, 16, 22);
    if (forge) {
      // a rune-cut stone door, half open, and the hammer sigil over it
      rect(g, 17, 22, 5, 14, '#3a3644');
      for (const y of [25, 29, 33]) rect(g, 18, y, 3, 1, '#ffcf5a');
      rect(g, 20, 13, 4, 3, '#ffcf5a');
      rect(g, 21, 16, 2, 2, '#ffcf5a');
    } else {
      for (let x = 17; x < 28; x += 3) rect(g, x, 18, 1, 14, '#3a3a48');
      for (let y = 20; y < 32; y += 4) rect(g, 16, y, 13, 1, '#3a3a48');
      for (const x of [5, 33]) {
        rect(g, x, 12, 6, 12, '#8a1a2a');
        rect(g, x + 2, 15, 2, 3, '#ffcf5a');
      }
    }
  },
  // a tomb: a sandstone pylon with columns and the sun disc
  temple: (g) => {
    for (let y = 4; y < H; y++) {
      const half = Math.round(14 + (y - 4) * 0.25);
      rect(g, 22 - half, y, half * 2, 1, y < 8 ? '#e8cc8a' : '#d4b070');
      rect(g, 22 + half - 4, y, 4, 1, '#b08a4a');
    }
    rect(g, 18, 6, 8, 5, '#ffd84d');
    rect(g, 16, 8, 12, 1, '#ffd84d');
    for (const x of [11, 31]) {
      rect(g, x, 14, 3, 22, '#e8d4a0');
      rect(g, x + 2, 14, 1, 22, '#b08a4a');
    }
    doorway(g, 22, 10, 15, 15);
  },
  // the Rimeheld vault: an arch of blue ice, icicles hanging off it
  icecave: (g) => {
    mound(g, 4, '#e8f4ff', '#b8d8f0', '#8ab0d0');
    doorway(g, 22, 16, 12, 20, '#0e1a2e');
    for (let x = 14; x < 31; x += 3) rect(g, x, 12 + (x % 2), 1, 3 + (x % 3), '#e8f4ff');
    rect(g, 8, 8, 4, 2, '#ffffff');
    rect(g, 30, 6, 5, 2, '#ffffff');
  },
  // the cistern: a round culvert in a brick bank, green water spilling out
  cistern: (g) => {
    blocks(g, 0, 10, W, 26, '#6a6458', '#8a8474', '#4a4438', 8);
    doorway(g, 22, 18, 13, 22, '#0a1410');
    for (let x = 14; x < 31; x += 4) rect(g, x, 16, 1, 18, '#3a3a40');
    rect(g, 13, 32, 18, 4, '#5a8a3a');
    rect(g, 15, 33, 6, 1, '#9ad05a');
  },
  // Blightheart: an arch of thorned roots, sick green light in it
  roots: (g) => {
    doorway(g, 22, 18, 8, 18, '#0e1a0a');
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      for (let y = 6; y < H; y++) {
        const x = 22 + s * Math.round(10 + Math.sin(y * 0.4) * 2 - (y < 16 ? (16 - y) * 0.6 : 0));
        rect(g, x - 2, y, 5, 1, y % 5 ? '#5a3a22' : '#7a5a34');
      }
    }
    rect(g, 12, 4, 20, 4, '#5a3a22');
    for (const [x, y] of [
      [10, 12],
      [33, 18],
      [12, 26],
      [31, 9],
    ] as const)
      rect(g, x, y, 2, 1, '#d0c49a');
    rect(g, 19, 22, 6, 6, '#6ad05a');
    rect(g, 20, 23, 4, 4, '#b8ff9a');
  },
  // the Molten Throne: black basalt, lava light in the mouth, embers
  lavacave: (g) => {
    mound(g, 5, '#4a3a3a', '#2e2428', '#1e1618');
    doorway(g, 22, 16, 13, 21, '#3a0e08');
    rect(g, 16, 28, 12, 8, '#ff7a3d');
    rect(g, 18, 30, 8, 6, '#ffd86b');
    for (const [x, y] of [
      [10, 10],
      [30, 7],
      [24, 4],
      [36, 16],
    ] as const)
      rect(g, x, y, 1, 1, '#ff9a4a');
  },
  // the Spire of the Tear: a portal ring of grieflight crystal
  riftspire: (g) => {
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const x = 22 + Math.cos(a) * 14;
      const y = 20 + Math.sin(a) * 15;
      rect(g, Math.round(x) - 1, Math.round(y) - 1, 3, 3, '#7a4ad8');
    }
    for (let a = 0; a < Math.PI * 2; a += 0.12) rect(g, Math.round(22 + Math.cos(a) * 10), Math.round(20 + Math.sin(a) * 11), 2, 2, '#c58cff');
    rect(g, 16, 14, 12, 14, '#2a0e4a');
    rect(g, 19, 16, 6, 10, '#e8c8ff');
    for (const [x, h] of [
      [4, 12],
      [37, 14],
    ] as const) {
      rect(g, x, H - h, 3, h, '#a87ae8');
      rect(g, x, H - h, 1, h, '#e8d8ff');
    }
  },
  // Duskspire: a black gate with seven locks, one for each sigil
  citadel: (g) => {
    blocks(g, 2, 2, 40, 34, '#2a2630', '#4a4458', '#16121c', 7);
    doorway(g, 22, 16, 10, 18, '#05030a');
    const colors = ['#ff7a3d', '#4ab8ff', '#c8b898', '#ffd84d', '#bfe8ff', '#6ad05a', '#c58cff'];
    colors.forEach((c, i) => {
      const a = Math.PI + (i / 6) * Math.PI;
      rect(g, Math.round(22 + Math.cos(a) * 12) - 1, Math.round(18 + Math.sin(a) * 11) - 1, 3, 3, c);
    });
  },
};

/** The way into a dungeon of this theme (`id`: the dungeon, for the ones that differ within a theme). */
export function dungeonEntrance(theme: Theme, id: string): Cnv | null {
  const paint = PAINT[theme];
  if (!paint) return null;
  const c = canvas(W, H);
  const g = ctx2d(c);
  paint(g, id);
  // torches either side of the ones that are lived in or guarded
  if (theme === 'keep' || theme === 'temple' || (theme === 'crypt' && id !== 'crypt')) {
    torch(g, theme === 'keep' ? 15 : 9, 20);
    torch(g, theme === 'keep' ? 28 : 34, 20);
  }
  return c;
}
