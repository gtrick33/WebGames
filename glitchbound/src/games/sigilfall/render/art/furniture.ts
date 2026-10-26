import { canvas, ctx2d, type Cnv } from '../pixel';

/**
 * Furniture for interiors (blueprint §3.2: the castle-interior pack is reference only, so its pieces are
 * recreated here in the game's own style): drawn in world pixels like the village props, lit from the
 * top left, then smoothed and outlined by the scenery builder. A banner takes its color from its name
 * (`banner:#3a7a4a`), a bed its blanket's (`bed:#7a2a2a`).
 */

type G = CanvasRenderingContext2D;

const WOOD = { lit: '#b8844a', mid: '#9a6a3a', dark: '#6a4424', deep: '#4a2e18' };
const STONE = { lit: '#b8b4c4', mid: '#9a96a8', dark: '#6e6a80', deep: '#4a4658' };
const IRON = { lit: '#8a8e9e', mid: '#5a5e6e', dark: '#3a3c48' };

function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/** A plank top: boards across, lit on the left, a dark front edge. */
function planks(g: G, x: number, y: number, w: number, h: number, edge = 3): void {
  rect(g, x, y, w, h, WOOD.mid);
  for (let yy = y + 3; yy < y + h - edge; yy += 4) rect(g, x, yy, w, 1, WOOD.dark);
  rect(g, x, y, Math.max(2, Math.round(w * 0.3)), h - edge, WOOD.lit);
  for (let yy = y + 3; yy < y + h - edge; yy += 4) rect(g, x, yy, Math.max(2, Math.round(w * 0.3)), 1, WOOD.mid);
  rect(g, x, y + h - edge, w, edge, WOOD.dark);
  rect(g, x, y + h - 1, w, 1, WOOD.deep);
}

function legs(g: G, xs: number[], y: number, h: number): void {
  for (const x of xs) {
    rect(g, x, y, 2, h, WOOD.dark);
    rect(g, x, y, 1, h, WOOD.mid);
  }
}

function mug(g: G, x: number, y: number): void {
  rect(g, x, y, 3, 3, '#d8d0c0');
  rect(g, x, y, 3, 1, '#ffffff');
  rect(g, x + 3, y + 1, 1, 1, '#d8d0c0');
}

function candle(g: G, x: number, y: number): void {
  rect(g, x, y + 2, 2, 4, '#f2ead8');
  rect(g, x, y, 2, 2, '#ffd86b');
  rect(g, x, y - 1, 1, 1, '#fff2b0');
}

function flame(g: G, x: number, y: number, w: number): void {
  rect(g, x, y + 2, w, 3, '#ff7a3d');
  rect(g, x + 1, y + 1, w - 2, 3, '#ffb84a');
  rect(g, x + Math.floor(w / 2) - 1, y, 2, 3, '#fff2b0');
}

/** Each piece's picture size in world pixels. */
const SIZE: Record<string, [number, number]> = {
  table: [20, 18],
  longtable: [44, 22],
  stool: [10, 10],
  chair: [12, 16],
  bed: [18, 30],
  cot: [14, 26],
  counter: [48, 22],
  shelf: [28, 26],
  bookshelf: [24, 30],
  hearth: [32, 34],
  rug: [44, 26],
  pew: [36, 13],
  bench: [30, 9],
  altar: [30, 22],
  candles: [12, 18],
  'bell-rope': [8, 34],
  casks: [32, 22],
  'weapon-rack': [28, 24],
  'war-table': [44, 28],
  throne: [24, 34],
  banner: [14, 30],
  forge: [32, 28],
  trough: [24, 13],
  grindstone: [16, 17],
  stair: [20, 30],
  cupboard: [20, 28],
};

/** Whether a prop name is a piece of furniture (`banner:#hex` and the like included). */
export const isFurniture = (kind: string): boolean => !!SIZE[kind.split(':')[0]!];

/** The furniture's picture in world pixels, or null for a name that isn't furniture. */
export function furniture(kind: string): Cnv | null {
  const [name, arg] = kind.split(':') as [string, string | undefined];
  const tint = arg && /^#[0-9a-f]{6}$/i.test(arg) ? arg : undefined;
  const sz = SIZE[name];
  if (!sz) return null;
  const c = canvas(sz[0], sz[1]);
  const g = ctx2d(c);
  switch (name) {
    case 'table':
      legs(g, [3, 15], 9, 8);
      planks(g, 1, 2, 18, 10);
      mug(g, 5, 3);
      candle(g, 12, 1);
      break;
    case 'longtable':
      legs(g, [3, 21, 39], 12, 9);
      planks(g, 1, 3, 42, 12);
      for (const x of [6, 18, 30]) mug(g, x, 5);
      rect(g, 24, 5, 6, 3, '#d8d0c0');
      rect(g, 25, 5, 4, 1, '#c86a3a');
      candle(g, 13, 2);
      candle(g, 36, 2);
      break;
    case 'stool':
      legs(g, [2, 7], 5, 5);
      rect(g, 1, 2, 9, 4, WOOD.mid);
      rect(g, 1, 2, 4, 3, WOOD.lit);
      rect(g, 1, 5, 9, 1, WOOD.deep);
      break;
    case 'chair':
      rect(g, 2, 1, 8, 8, WOOD.dark);
      rect(g, 3, 2, 6, 6, WOOD.mid);
      rect(g, 3, 2, 2, 6, WOOD.lit);
      legs(g, [2, 8], 11, 5);
      rect(g, 1, 8, 10, 4, WOOD.mid);
      rect(g, 1, 8, 4, 3, WOOD.lit);
      rect(g, 1, 11, 10, 1, WOOD.deep);
      break;
    case 'bed': {
      const blanket = tint ?? '#7a2a3a';
      rect(g, 1, 0, 16, 30, WOOD.dark);
      rect(g, 1, 0, 16, 5, WOOD.mid);
      rect(g, 2, 1, 14, 2, WOOD.lit);
      rect(g, 2, 5, 14, 6, '#ece6d4');
      rect(g, 3, 6, 6, 4, '#ffffff');
      rect(g, 2, 11, 14, 17, blanket);
      g.globalAlpha = 0.25;
      rect(g, 2, 11, 5, 17, '#ffffff');
      rect(g, 2, 11, 14, 2, '#ffffff');
      g.globalAlpha = 1;
      for (let y = 15; y < 28; y += 4) rect(g, 2, y, 14, 1, '#00000030');
      break;
    }
    case 'cot':
      rect(g, 1, 2, 12, 23, '#8a7a5a');
      rect(g, 1, 2, 4, 23, '#a8987a');
      rect(g, 2, 3, 10, 5, '#d8d0b8');
      rect(g, 1, 13, 12, 12, tint ?? '#5a6a3a');
      rect(g, 1, 13, 4, 12, '#ffffff22');
      rect(g, 1, 24, 12, 1, '#3a3020');
      break;
    case 'counter':
      // the bar: a long top, panelled front, the tap and its mugs
      rect(g, 0, 6, 48, 16, WOOD.dark);
      for (let x = 2; x < 46; x += 9) {
        rect(g, x, 10, 7, 9, WOOD.mid);
        rect(g, x, 10, 2, 9, WOOD.lit);
        rect(g, x, 18, 7, 1, WOOD.deep);
      }
      planks(g, 0, 1, 48, 7, 2);
      for (const x of [5, 13, 30]) mug(g, x, 0);
      rect(g, 39, -1, 3, 5, IRON.mid);
      rect(g, 39, -1, 1, 5, IRON.lit);
      rect(g, 37, 0, 2, 2, IRON.dark);
      break;
    case 'shelf':
      // bottles and jars on two shelves against the wall
      rect(g, 1, 0, 26, 25, WOOD.deep);
      for (const y of [10, 22]) {
        rect(g, 1, y, 26, 3, WOOD.mid);
        rect(g, 1, y, 26, 1, WOOD.lit);
      }
      for (const [x, y, col] of [
        [3, 3, '#3a7a4a'],
        [7, 4, '#8a2a3a'],
        [11, 2, '#2a5a8a'],
        [16, 4, '#d8b04a'],
        [21, 3, '#6a3a8a'],
        [4, 15, '#d8d0c0'],
        [9, 16, '#8a5a34'],
        [14, 15, '#3a7a4a'],
        [19, 16, '#d8d0c0'],
        [23, 15, '#8a2a3a'],
      ] as const) {
        rect(g, x, y, 3, 10 - (y % 4), col);
        rect(g, x, y, 1, 10 - (y % 4), '#ffffff55');
        rect(g, x + 1, y - 2, 1, 2, col);
      }
      break;
    case 'bookshelf':
      rect(g, 1, 0, 22, 30, WOOD.deep);
      rect(g, 1, 0, 22, 2, WOOD.mid);
      for (const y of [2, 11, 20]) {
        rect(g, 1, y + 8, 22, 1, WOOD.mid);
        for (let x = 3; x < 21; x += 3) {
          const col = ['#8a2a3a', '#2a4a7a', '#3a6a3a', '#7a5a2a', '#5a3a6a', '#a87a3a'][(x * 7 + y) % 6]!;
          const h = 6 + ((x + y) % 3);
          rect(g, x, y + 8 - h, 2, h, col);
          rect(g, x, y + 8 - h, 1, h, '#ffffff33');
        }
      }
      rect(g, 1, 29, 22, 1, '#1a1008');
      break;
    case 'hearth':
      // a stone chimney breast and an arched fireplace (the fire itself is a fire marker in front)
      rect(g, 1, 0, 30, 34, STONE.dark);
      for (let y = 0; y < 34; y += 5)
        for (let x = (y / 5) % 2 ? 1 : 4; x < 30; x += 7) {
          rect(g, x, y, 6, 4, STONE.mid);
          rect(g, x, y, 2, 4, STONE.lit);
        }
      rect(g, 7, 14, 18, 20, '#1a120c');
      rect(g, 9, 12, 14, 2, '#1a120c');
      rect(g, 4, 11, 24, 3, WOOD.dark);
      rect(g, 4, 11, 24, 1, WOOD.mid);
      rect(g, 9, 29, 14, 3, '#3a2a20');
      flame(g, 11, 23, 10);
      rect(g, 10, 30, 12, 2, '#ff9a4a');
      break;
    case 'rug': {
      const red = tint ?? '#8a2a2a';
      rect(g, 0, 0, 44, 26, '#d8b060');
      rect(g, 2, 2, 40, 22, red);
      rect(g, 5, 5, 34, 16, '#d8b060');
      rect(g, 6, 6, 32, 14, red);
      for (let x = 10; x < 36; x += 8) {
        rect(g, x, 11, 4, 4, '#d8b060');
        rect(g, x + 1, 12, 2, 2, red);
      }
      g.globalAlpha = 0.18;
      rect(g, 0, 0, 22, 26, '#ffffff');
      g.globalAlpha = 1;
      break;
    }
    case 'bench':
      planks(g, 0, 1, 30, 5, 2);
      legs(g, [2, 26], 6, 3);
      break;
    case 'pew':
      rect(g, 0, 0, 36, 6, WOOD.dark);
      rect(g, 0, 0, 36, 2, WOOD.mid);
      planks(g, 0, 5, 36, 6, 2);
      legs(g, [2, 32], 11, 2);
      break;
    case 'altar':
      rect(g, 2, 6, 26, 16, STONE.dark);
      rect(g, 2, 6, 8, 16, STONE.mid);
      rect(g, 0, 4, 30, 4, STONE.lit);
      rect(g, 10, 7, 10, 15, tint ?? '#e8e0c8');
      rect(g, 10, 7, 10, 2, '#d8b060');
      rect(g, 13, 12, 4, 6, '#d8b060');
      candle(g, 3, -1 + 2);
      candle(g, 25, 1);
      break;
    case 'candles':
      rect(g, 2, 12, 8, 6, IRON.dark);
      rect(g, 5, 4, 2, 9, IRON.mid);
      rect(g, 1, 5, 10, 2, IRON.mid);
      candle(g, 1, 0);
      candle(g, 5, -1 + 1);
      candle(g, 9, 0);
      break;
    case 'bell-rope':
      for (let y = 0; y < 30; y += 2) {
        rect(g, 3, y, 2, 2, y % 4 ? '#c8a878' : '#a8885a');
      }
      rect(g, 2, 28, 4, 6, '#8a2a2a');
      rect(g, 2, 28, 2, 6, '#b84a4a');
      break;
    case 'casks':
      rect(g, 0, 16, 32, 6, WOOD.deep);
      for (const [x, y] of [
        [1, 8],
        [11, 8],
        [21, 8],
        [6, 0],
        [16, 0],
      ] as const) {
        rect(g, x, y, 10, 9, WOOD.mid);
        rect(g, x, y, 3, 9, WOOD.lit);
        rect(g, x + 2, y, 1, 9, IRON.mid);
        rect(g, x + 7, y, 1, 9, IRON.mid);
        rect(g, x + 4, y + 3, 2, 3, WOOD.deep);
      }
      break;
    case 'weapon-rack':
      rect(g, 1, 18, 26, 4, WOOD.dark);
      rect(g, 1, 4, 26, 3, WOOD.mid);
      for (const [x, col] of [
        [4, IRON.lit],
        [10, IRON.lit],
        [16, '#a0703f'],
        [22, IRON.lit],
      ] as const) {
        rect(g, x, 0, 2, 20, col);
        rect(g, x - 1, 13, 4, 1, '#d8b060');
      }
      rect(g, 16, 0, 2, 4, IRON.mid);
      break;
    case 'war-table':
      // a big table under a map of the kingdom, its pins and the companies' stones
      legs(g, [3, 39], 20, 8);
      planks(g, 0, 2, 44, 20, 3);
      rect(g, 4, 4, 36, 14, '#e8d8b0');
      rect(g, 4, 4, 36, 1, '#c8b890');
      g.fillStyle = '#7a9a5a';
      g.fillRect(8, 7, 9, 6);
      g.fillRect(22, 10, 7, 5);
      g.fillStyle = '#6a8ab0';
      g.fillRect(30, 6, 8, 4);
      rect(g, 6, 12, 30, 1, '#a07648');
      for (const [x, y, col] of [
        [10, 9, '#c9473b'],
        [24, 12, '#c9473b'],
        [33, 7, '#2a4a8a'],
        [17, 15, '#d8b060'],
      ] as const)
        rect(g, x, y, 2, 2, col);
      candle(g, 1, 0);
      break;
    case 'throne':
      rect(g, 2, 0, 20, 26, '#5a1a2a');
      rect(g, 4, 2, 16, 20, '#8a2a3a');
      rect(g, 4, 2, 5, 20, '#a83a4a');
      rect(g, 0, 18, 24, 8, '#d8b060');
      rect(g, 0, 18, 24, 2, '#ffe08a');
      rect(g, 3, 26, 18, 8, STONE.dark);
      rect(g, 3, 26, 6, 8, STONE.mid);
      rect(g, 10, -1, 4, 4, '#ffe08a');
      break;
    case 'banner': {
      const col = tint ?? '#8a2a3a';
      rect(g, 0, 0, 14, 2, WOOD.dark);
      rect(g, 2, 2, 10, 24, col);
      rect(g, 2, 2, 3, 24, '#ffffff22');
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(2, 26);
      g.lineTo(7, 30);
      g.lineTo(12, 26);
      g.fill();
      rect(g, 5, 9, 4, 4, '#ffe08a');
      rect(g, 6, 13, 2, 5, '#ffe08a');
      break;
    }
    case 'forge':
      rect(g, 1, 8, 30, 20, STONE.dark);
      rect(g, 1, 8, 9, 20, STONE.mid);
      rect(g, 0, 6, 32, 4, STONE.lit);
      rect(g, 6, 10, 20, 8, '#3a1a10');
      rect(g, 8, 12, 16, 5, '#ff7a3d');
      rect(g, 10, 13, 10, 3, '#ffd86b');
      rect(g, 12, 0, 8, 7, STONE.dark);
      rect(g, 12, 0, 3, 7, STONE.mid);
      rect(g, 26, 2, 5, 6, WOOD.dark);
      break;
    case 'trough':
      rect(g, 0, 2, 24, 10, WOOD.dark);
      rect(g, 0, 2, 7, 10, WOOD.mid);
      rect(g, 2, 3, 20, 5, '#3a6aa0');
      rect(g, 3, 4, 8, 1, '#8ab8e8');
      rect(g, 0, 11, 24, 1, WOOD.deep);
      break;
    case 'grindstone':
      rect(g, 2, 10, 12, 6, WOOD.dark);
      rect(g, 3, 1, 10, 10, STONE.mid);
      rect(g, 3, 1, 4, 10, STONE.lit);
      rect(g, 7, 5, 2, 2, IRON.dark);
      rect(g, 13, 4, 3, 2, WOOD.mid);
      break;
    case 'stair':
      // stairs up to the rooms above, against the wall
      for (let i = 0; i < 6; i++) {
        rect(g, 1, i * 5, 18, 5, i % 2 ? WOOD.mid : WOOD.lit);
        rect(g, 1, i * 5 + 4, 18, 1, WOOD.deep);
      }
      rect(g, 0, 0, 2, 30, WOOD.dark);
      rect(g, 18, 0, 2, 30, WOOD.dark);
      break;
    case 'cupboard':
      rect(g, 1, 0, 18, 28, WOOD.dark);
      rect(g, 2, 2, 7, 24, WOOD.mid);
      rect(g, 11, 2, 7, 24, WOOD.mid);
      rect(g, 2, 2, 2, 24, WOOD.lit);
      rect(g, 8, 13, 1, 3, '#d8b060');
      rect(g, 11, 13, 1, 3, '#d8b060');
      break;
    default:
      return null;
  }
  return c;
}

/** Furniture laid flat on the floor (drawn under the people standing on it). */
export const FLAT_FURNITURE = new Set(['rug']);
