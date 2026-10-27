import { paint, scaled, type Cnv } from '../render/pixel';

/**
 * Pixel icons for the maps (the corner minimap, a land's map, the world map): what a mark is, at a glance,
 * instead of a colored square. Each keeps the color its square had, so the old legend still reads true.
 */
const PAL = {
  k: '#1b1428',
  w: '#ffffff',
  y: '#ffcf5a',
  Y: '#b08a2a',
  b: '#a8784a',
  B: '#6a4424',
  r: '#ff4a4a',
  c: '#22e4ff',
  C: '#1a8aa8',
  m: '#ff3fd2',
  M: '#a8248a',
  n: '#f0c8a0',
  o: '#8a8498',
  O: '#5a5468',
  h: '#e0604a',
  H: '#9a3a2a',
  s: '#ece6d4',
  t: '#6ad06a',
  T: '#3a8a3a',
  v: '#c58cff',
  V: '#6a4a9a',
};

const ART = {
  waystone: ['...c...', '..ccC..', '..cwC..', '..ccC..', '..cCC..', '...C...', '.ooooo.', 'oOOOOOo'],
  chest: ['.BBBBBBB.', 'BbbbbbbbB', 'BbbbbbbbB', 'BBBByBBBB', 'BbbbYbbbB', 'BbbbbbbbB', 'BBBBBBBBB'],
  person: ['..nnn..', '..nnn..', '...n...', '.wwwww.', 'w.www.w', '..www..', '..w.w..', '..w.w..'],
  merchant: ['..nnn..', '..nnn..', '...n...', '.yyyyy.', 'y.yYy.y', '..yyy..', '..Y.Y..', '..Y.Y..'],
  road: ['.mmmmmm..', '.mwwwwwm.', '.mmmmmm..', '...BB....', '...BB....', '...BB....', '..BBBB...'],
  door: ['..mmm..', '.mMMMm.', 'mMbbbMm', 'mMbbbMm', 'mMbbyMm', 'mMbbbMm', 'mmmmmmm'],
  quest: ['.yyy.', '.yyy.', '.yyy.', '.yyy.', '..y..', '.....', '.yyy.', '.yyy.'],
  you: ['..www..', '.wrrrw.', 'wrrrrrw', 'wrrwrrw', '.wrrrw.', '..wrw..', '...w...'],
  boss: ['.wwwww.', 'wwwwwww', 'wkwwwkw', 'wwwkwww', '.wwwww.', '.w.w.w.'],
  town: ['....h....', '...hhh...', '..hhhhh..', '.hhhhhhh.', 'HHHHHHHHH', '.sssssss.', '.ssBssys.', '.ssBssss.'],
  wild: ['..ttt..', '.ttttt.', 'tttTttt', 'ttTtTtt', '.ttTtt.', '...B...', '...B...'],
  dungeon: ['.v.v.v.v.', '.vvvvvvv.', '.vVvvvVv.', '.vvvvvvv.', '.vvVVVvv.', '.vVkkkVv.', '.vVkkkVv.', '.vVkkkVv.'],
  unknown: ['..ooo..', '.oOOOo.', '.O..Oo.', '....Oo.', '...Oo..', '...o...', '.......', '...o...'],
} satisfies Record<string, string[]>;

export type MapIcon = keyof typeof ART;

const cache = new Map<string, Cnv>();
const urls = new Map<string, string>();

/** An icon, outlined, at a whole-number scale. */
export function mapIcon(name: MapIcon, k = 1): Cnv {
  const key = `${name}:${k}`;
  let c = cache.get(key);
  if (!c) {
    c = scaled(paint(ART[name], PAL), k);
    cache.set(key, c);
  }
  return c;
}

/** The same icon as an image URL (the world map, the legend); empty where there is no canvas to draw on. */
export function mapIconUrl(name: MapIcon, k = 3): string {
  const key = `${name}:${k}`;
  let u = urls.get(key);
  if (u === undefined) {
    try {
      u = mapIcon(name, k).toDataURL();
    } catch {
      u = '';
    }
    urls.set(key, u);
  }
  return u;
}

/** Draws an icon centered on a point of a canvas. */
export function drawMapIcon(g: CanvasRenderingContext2D, name: MapIcon, x: number, y: number, k = 1): void {
  const c = mapIcon(name, k);
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
}
