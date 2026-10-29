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
  // the Great Hall of the Ember Keep
  runner: [48, 16],
  dais: [176, 64],
  'high-throne': [36, 54],
  column: [18, 62],
  window: [24, 28],
  sunbeam: [36, 88],
  'great-banner': [24, 28],
  statue: [20, 42],
  'armor-stand': [18, 32],
};

const GOLD = { lit: '#ffe08a', mid: '#d8b060', dark: '#a87a30' };

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
    case 'runner': {
      // a length of the crimson runner, one tile long: laid end to end it runs unbroken (no outline round it)
      const red = tint ?? '#8a1a2a';
      rect(g, 0, 0, 48, 16, GOLD.mid);
      rect(g, 3, 0, 42, 16, red);
      rect(g, 5, 0, 1, 16, GOLD.lit);
      rect(g, 42, 0, 1, 16, GOLD.lit);
      rect(g, 22, 4, 4, 8, GOLD.mid);
      rect(g, 20, 6, 8, 4, GOLD.mid);
      rect(g, 23, 7, 2, 2, red);
      g.globalAlpha = 0.14;
      rect(g, 0, 0, 20, 16, '#ffffff');
      g.globalAlpha = 1;
      break;
    }
    case 'dais': {
      // the raised floor of the throne: polished flags edged in gold, its front face, three steps up the middle
      // with the runner climbing them
      const red = tint ?? '#8a1a2a';
      rect(g, 0, 0, 176, 48, '#a8a2b4');
      for (let x = 16; x < 176; x += 16) rect(g, x, 0, 1, 46, '#8e889c');
      for (let y = 15; y < 46; y += 16) rect(g, 0, y, 176, 1, '#8e889c');
      g.globalAlpha = 0.16;
      rect(g, 0, 0, 70, 46, '#ffffff');
      g.globalAlpha = 1;
      rect(g, 0, 44, 176, 3, GOLD.mid);
      rect(g, 0, 44, 176, 1, GOLD.lit);
      rect(g, 0, 47, 176, 17, STONE.dark);
      for (let x = 12; x < 176; x += 22) rect(g, x, 47, 1, 17, STONE.deep);
      rect(g, 0, 62, 176, 2, STONE.deep);
      for (const [y, h] of [
        [47, 5],
        [52, 5],
        [57, 7],
      ] as const) {
        rect(g, 58 - (y - 47), y, 60 + (y - 47) * 2, h, STONE.mid);
        rect(g, 58 - (y - 47), y, 60 + (y - 47) * 2, 1, STONE.lit);
      }
      rect(g, 64, 12, 48, 52, GOLD.mid);
      rect(g, 67, 12, 42, 52, red);
      rect(g, 69, 12, 1, 52, GOLD.lit);
      rect(g, 106, 12, 1, 52, GOLD.lit);
      for (const y of [48, 53, 58]) rect(g, 67, y, 42, 1, '#5a1020');
      break;
    }
    case 'high-throne':
      // gilt and crimson, taller than a man, the crown over its back
      rect(g, 4, 4, 4, 4, GOLD.mid);
      rect(g, 28, 4, 4, 4, GOLD.mid);
      rect(g, 4, 6, 28, 30, GOLD.mid);
      rect(g, 4, 6, 28, 1, GOLD.lit);
      rect(g, 7, 9, 22, 26, '#8a1a2a');
      rect(g, 7, 9, 7, 26, '#a83a4a');
      for (const x of [12, 17, 22]) rect(g, x, 0, 2, 4, GOLD.lit);
      rect(g, 12, 3, 12, 4, GOLD.lit);
      rect(g, 17, 4, 2, 2, '#c9473b');
      rect(g, 16, 16, 4, 10, GOLD.mid);
      rect(g, 14, 18, 8, 3, GOLD.mid);
      rect(g, 0, 28, 6, 14, GOLD.dark);
      rect(g, 30, 28, 6, 14, GOLD.dark);
      rect(g, 0, 28, 6, 2, GOLD.lit);
      rect(g, 30, 28, 6, 2, GOLD.lit);
      rect(g, 2, 34, 32, 8, GOLD.mid);
      rect(g, 5, 33, 26, 6, '#a83a4a');
      rect(g, 5, 33, 26, 1, '#c85a6a');
      rect(g, 3, 42, 30, 12, STONE.dark);
      rect(g, 3, 42, 10, 12, STONE.mid);
      rect(g, 3, 42, 30, 2, GOLD.mid);
      break;
    case 'column': {
      // a pillar of pale stone, gilt at its head, the crown's banner hung on it
      rect(g, 0, 0, 18, 6, GOLD.mid);
      rect(g, 0, 0, 18, 2, GOLD.lit);
      rect(g, 2, 6, 14, 3, STONE.lit);
      rect(g, 3, 9, 12, 45, STONE.mid);
      rect(g, 4, 9, 3, 45, STONE.lit);
      rect(g, 8, 9, 1, 45, STONE.dark);
      rect(g, 11, 9, 1, 45, STONE.dark);
      rect(g, 13, 9, 2, 45, STONE.dark);
      if (tint) {
        rect(g, 4, 13, 10, 2, GOLD.mid);
        rect(g, 5, 15, 8, 18, tint);
        rect(g, 5, 15, 2, 18, '#ffffff22');
        rect(g, 7, 20, 4, 4, GOLD.lit);
        g.fillStyle = tint;
        g.beginPath();
        g.moveTo(5, 33);
        g.lineTo(9, 36);
        g.lineTo(13, 33);
        g.fill();
      }
      rect(g, 1, 54, 16, 4, STONE.lit);
      rect(g, 0, 58, 18, 3, STONE.mid);
      rect(g, 0, 61, 18, 1, STONE.deep);
      break;
    }
    case 'window':
      // a tall window of colored glass, set in the north wall
      rect(g, 4, 0, 16, 2, STONE.dark);
      rect(g, 2, 2, 20, 2, STONE.dark);
      rect(g, 0, 4, 24, 24, STONE.dark);
      rect(g, 5, 2, 14, 3, '#2a3a6a');
      rect(g, 3, 5, 18, 21, '#2a3a6a');
      for (const [x, y, col] of [
        [4, 6, '#c9473b'],
        [13, 6, GOLD.mid],
        [4, 13, GOLD.mid],
        [13, 13, '#3a6ab0'],
        [4, 20, '#3a6ab0'],
        [13, 20, '#c9473b'],
      ] as const)
        rect(g, x, y, 7, 6, col);
      rect(g, 11, 3, 2, 23, '#1a1a2a');
      rect(g, 3, 12, 18, 1, '#1a1a2a');
      rect(g, 3, 19, 18, 1, '#1a1a2a');
      g.globalAlpha = 0.3;
      rect(g, 4, 3, 7, 23, '#ffffff');
      g.globalAlpha = 1;
      rect(g, 0, 26, 24, 2, STONE.lit);
      break;
    case 'sunbeam':
      // the light of a window lying across the floor below it (no outline: it is only light)
      g.fillStyle = '#fff2c0';
      for (const inset of [0, 5]) {
        g.globalAlpha = 0.11;
        g.beginPath();
        g.moveTo(8 + inset, 0);
        g.lineTo(28 - inset, 0);
        g.lineTo(36 - inset, 88);
        g.lineTo(inset, 88);
        g.fill();
      }
      g.globalAlpha = 1;
      break;
    case 'great-banner': {
      // the crown's banner over the throne: crimson, gilt edged, the crown and the sword
      const col = tint ?? '#8a1a2a';
      rect(g, 0, 0, 24, 2, GOLD.mid);
      rect(g, 0, 0, 2, 3, GOLD.lit);
      rect(g, 22, 0, 2, 3, GOLD.lit);
      rect(g, 2, 2, 20, 22, col);
      rect(g, 2, 2, 1, 22, GOLD.mid);
      rect(g, 21, 2, 1, 22, GOLD.mid);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(2, 24);
      g.lineTo(7, 28);
      g.lineTo(12, 25);
      g.lineTo(17, 28);
      g.lineTo(22, 24);
      g.fill();
      for (const x of [8, 11, 14]) rect(g, x, 6, 2, 2, GOLD.lit);
      rect(g, 8, 8, 8, 4, GOLD.lit);
      rect(g, 11, 13, 2, 8, '#e8e0c8');
      rect(g, 9, 14, 6, 1, GOLD.mid);
      break;
    }
    case 'statue': {
      // a king of old in pale stone on his plinth, crowned, his sword held point down before him
      const M = { lit: '#e4e0ec', mid: '#c4c0d0', dark: '#9894ac' };
      rect(g, 1, 34, 18, 8, STONE.mid);
      rect(g, 1, 34, 18, 2, STONE.lit);
      rect(g, 1, 40, 18, 2, STONE.deep);
      rect(g, 6, 14, 8, 20, M.mid);
      rect(g, 5, 20, 10, 14, M.mid);
      rect(g, 4, 26, 12, 8, M.mid);
      rect(g, 4, 26, 4, 8, M.lit);
      rect(g, 5, 20, 3, 6, M.lit);
      rect(g, 6, 14, 3, 6, M.lit);
      rect(g, 13, 20, 2, 14, M.dark);
      rect(g, 4, 14, 12, 4, M.mid);
      rect(g, 4, 14, 3, 4, M.lit);
      rect(g, 14, 14, 2, 4, M.dark);
      rect(g, 7, 7, 6, 7, M.mid);
      rect(g, 7, 7, 2, 7, M.lit);
      rect(g, 7, 4, 6, 3, M.lit);
      for (const x of [7, 9, 12]) rect(g, x, 2, 1, 2, M.lit);
      rect(g, 9, 16, 2, 16, '#f4f2f8');
      rect(g, 7, 18, 6, 1, M.dark);
      break;
    }
    case 'armor-stand':
      // a knight's harness on its stand, the crown's colors on its tabard
      rect(g, 3, 29, 12, 3, WOOD.dark);
      rect(g, 3, 29, 12, 1, WOOD.mid);
      rect(g, 6, 20, 2, 9, IRON.mid);
      rect(g, 10, 20, 2, 9, IRON.mid);
      rect(g, 6, 20, 1, 9, IRON.lit);
      rect(g, 5, 12, 8, 10, tint ?? '#8a1a2a');
      rect(g, 8, 14, 2, 4, GOLD.mid);
      rect(g, 3, 9, 12, 4, IRON.mid);
      rect(g, 3, 9, 4, 4, IRON.lit);
      rect(g, 2, 10, 2, 7, IRON.dark);
      rect(g, 14, 10, 2, 7, IRON.dark);
      rect(g, 6, 2, 6, 7, IRON.mid);
      rect(g, 6, 2, 2, 7, IRON.lit);
      rect(g, 7, 5, 4, 1, IRON.dark);
      rect(g, 8, 0, 2, 2, '#c9473b');
      break;
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
export const FLAT_FURNITURE = new Set(['rug', 'runner', 'dais', 'sunbeam']);

/** Furniture drawn without an outline: a runner laid end to end, a window's light on the floor. */
export const BARE_FURNITURE = new Set(['runner', 'sunbeam']);
