import { CLASSES } from '../../data/classes';
import { TALENTS } from '../../data/talents';
import type { ClassId, TalentNode } from '../../data/types';
import { canvas, ctx2d, type Cnv } from '../pixel';
import { SKILL_ICON, TALENT_ICONS } from './iconPicks';
import { ICON_VERSION } from './iconVersion';
import { hex, mixRGB, OUTLINE_RGB, ramp, type RGB } from './kit';

/**
 * The skill and talent icons: game-icons.net silhouettes (CC BY 3.0, ICON_CREDITS.md) from the atlas
 * scripts/sigilfall-icons.mjs builds, each laid on a tile of its skill's color (a talent's: its tree's), lit
 * from the top left like the rest of the art. Until the atlas is in, or if it never comes, the UI keeps the
 * painted glyphs (art/icons.ts).
 */

/** The size the tiles are drawn at: crisp on a 2× screen at the bar's 36–64 css px. */
export const TILE_PX = 128;

interface Atlas {
  img: Cnv;
  cell: number;
  cols: number;
  at: Map<string, number>;
}

let atlas: Atlas | null = null;

const BASE = `${(import.meta.env?.BASE_URL as string | undefined) ?? '/'}games/sigilfall/icons/`;
const url = (f: string): string => `${BASE}${f}?v=${ICON_VERSION}`;
const canLoad = (): boolean => typeof document !== 'undefined' && typeof Image !== 'undefined' && typeof fetch === 'function' && !navigator.userAgent.includes('jsdom');

async function load(): Promise<boolean> {
  try {
    const [index, img] = await Promise.all([
      fetch(url('icons.json')).then((r) => {
        if (!r.ok) throw new Error(`icons.json: ${r.status}`);
        return r.json() as Promise<{ cell: number; cols: number; names: string[] }>;
      }),
      new Promise<Cnv>((resolve, reject) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => {
          const c = canvas(im.naturalWidth, im.naturalHeight);
          ctx2d(c).drawImage(im, 0, 0);
          resolve(c);
        };
        im.onerror = () => reject(new Error('icons.png'));
        im.src = url('icons.png');
      }),
    ]);
    atlas = { img, cell: index.cell, cols: index.cols, at: new Map(index.names.map((n, i) => [n, i])) };
    return true;
  } catch {
    return false;
  }
}

/** Resolves once the atlas is in (true), or has failed to come (false: the painted glyphs stay). */
export const iconsReady: Promise<boolean> = canLoad() ? load() : Promise.resolve(false);

/** Can an icon be laid on its tile yet? */
export const hasIcon = (name: string | undefined): name is string => !!name && !!atlas?.at.has(name);

/** A skill's icon (by skill id). */
export const skillIcon = (id: string): string | undefined => SKILL_ICON[id];

/* --------------------------------------------------------------- talents */

const talentPicks = new Map<ClassId, Map<string, string>>();

/**
 * A talent's icon: the next of its pool's icons not yet used in its tree (in the tree's order, row by row);
 * when a tree has used the pool up, the icon of the skill the talent changes; failing that, the pool's first.
 */
export function talentIcon(cls: ClassId, node: TalentNode): string | undefined {
  let picks = talentPicks.get(cls);
  if (!picks) {
    picks = new Map();
    const c = CLASSES[cls];
    const slot: Record<string, string> = { basic: c.basic, ult: c.ult, dodge: c.dodge };
    for (const tree of [0, 1, 2] as const) {
      const used = new Set<string>();
      const nodes = TALENTS[cls].filter((n) => n.tree === tree).sort((a, b) => a.row - b.row || a.col - b.col);
      for (const n of nodes) {
        const skills = n.mods.flatMap((m) => (m.t === 'skill' && m.skill !== '*' ? [SKILL_ICON[slot[m.skill] ?? m.skill]] : [])).filter((s): s is string => !!s);
        const options = [...(TALENT_ICONS[n.icon] ?? []), ...skills];
        const pick = options.find((o) => !used.has(o)) ?? options[0];
        if (!pick) continue;
        used.add(pick);
        picks.set(n.id, pick);
      }
    }
    talentPicks.set(cls, picks);
  }
  return picks.get(node.id);
}

/* ----------------------------------------------------------------- tiles */

/** The silhouette at `size` px in one flat color (or gradient), as a canvas. */
function silhouette(at: Atlas, i: number, size: number, fill: string | CanvasGradient): Cnv {
  const c = canvas(size, size);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(at.img, (i % at.cols) * at.cell, Math.floor(i / at.cols) * at.cell, at.cell, at.cell, 0, 0, size, size);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = fill;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Only the edge of a silhouette that faces away from (dx, dy): a rim of light or of shade. */
function rim(at: Atlas, i: number, size: number, color: string, dx: number, dy: number): Cnv {
  const c = silhouette(at, i, size, color);
  const g = ctx2d(c);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(silhouette(at, i, size, '#fff'), dx, dy);
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * A named icon on a tile of a color, as a canvas (null while the atlas isn't in): a rounded square for the
 * bar and the talent trees, a disc for the round touch buttons.
 */
export function iconTile(name: string, color: string, round = false): Cnv | null {
  const at = atlas;
  const i = at?.at.get(name);
  if (!at || i === undefined) return null;
  const S = TILE_PX;
  const R = ramp(color);
  const c = canvas(S, S);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = true;
  const shape = (inset: number): void => {
    if (round) {
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - inset, 0, Math.PI * 2);
    } else roundRect(g, inset, inset, S - inset * 2, S - inset * 2, S * 0.1 - inset);
  };
  // the tile: deep at the edges, a soft light in the upper left (as the painted glyphs' tiles)
  const deep: RGB = mixRGB(R[4], [14, 10, 24], 0.55);
  const bg = g.createRadialGradient(S * 0.33, S * 0.29, 0, S * 0.33, S * 0.29, S * 0.95);
  bg.addColorStop(0, hex(mixRGB(deep, R[3], 0.6)));
  bg.addColorStop(1, hex(deep));
  shape(0);
  g.fillStyle = bg;
  g.fill();
  // the figure: a shadow under it, a dark outline, then lit top to bottom with a rim of light and of shade
  // (a disc has less room in its corners: the figure is a little smaller there)
  const G = Math.round(S * (round ? 0.64 : 0.74));
  const o = (S - G) / 2;
  g.globalAlpha = 0.6;
  g.drawImage(silhouette(at, i, G, '#000'), o, o + S * 0.035);
  g.globalAlpha = 1;
  const line = silhouette(at, i, G, hex(OUTLINE_RGB));
  const w = S * 0.022;
  for (let k = 0; k < 12; k++) g.drawImage(line, o + Math.cos((k * Math.PI) / 6) * w, o + Math.sin((k * Math.PI) / 6) * w);
  const fig = silhouette(at, i, G, '#fff');
  const fg = ctx2d(fig);
  fg.globalCompositeOperation = 'source-in';
  const local = fg.createLinearGradient(0, 0, 0, G);
  local.addColorStop(0, hex(R[0]));
  local.addColorStop(0.5, hex(R[1]));
  local.addColorStop(1, hex(R[2]));
  fg.fillStyle = local;
  fg.fillRect(0, 0, G, G);
  fg.globalCompositeOperation = 'source-over';
  const d = Math.max(1, Math.round(S * 0.016));
  fg.drawImage(rim(at, i, G, hex(mixRGB(R[3], [0, 0, 0], 0.2)), -d, -d), 0, 0);
  fg.drawImage(rim(at, i, G, '#fffbe8', d, d), 0, 0);
  g.drawImage(fig, o, o);
  // a thin frame: the color's own light along the top and left, its shade along the bottom and right
  g.lineWidth = Math.max(2, S * 0.025);
  const edge = g.createLinearGradient(0, 0, S, S);
  edge.addColorStop(0, hex(R[1]));
  edge.addColorStop(1, hex(R[4]));
  g.strokeStyle = edge;
  shape(g.lineWidth / 2);
  g.stroke();
  return c;
}
