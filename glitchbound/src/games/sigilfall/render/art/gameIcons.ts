import { CLASSES } from '../../data/classes';
import { TALENTS } from '../../data/talents';
import type { ClassId, TalentNode } from '../../data/types';
import { canvas, ctx2d, type Cnv } from '../pixel';
import { SKILL_ICON, TALENT_ICONS } from './iconPicks';
import { ICON_VERSION } from './iconVersion';
import { hex, mixRGB, OUTLINE_RGB, ramp } from './kit';

/**
 * The skill and talent icons: the pack Nasha's Lumenfall (ICON_CREDITS.md), from the atlas
 * scripts/sigilfall-icons.mjs builds, each in a thin rim of its skill's color (a talent's: its tree's). Until the
 * atlas is in, or if it never comes, the UI keeps the painted glyphs (art/icons.ts).
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
 * A named icon in a tile, as a canvas (null while the atlas isn't in): a rounded square for the bar and the talent
 * trees, a disc for the round touch buttons. The pack's pixel art is scaled by whole steps so it stays crisp, inside
 * a thin rim of the skill's color.
 */
export function iconTile(name: string, color: string, round = false): Cnv | null {
  const at = atlas;
  const i = at?.at.get(name);
  if (!at || i === undefined) return null;
  const S = TILE_PX;
  const c = canvas(S, S);
  const g = ctx2d(c);
  const shape = (inset: number): void => {
    if (round) {
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - inset, 0, Math.PI * 2);
    } else roundRect(g, inset, inset, S - inset * 2, S - inset * 2, S * 0.1 - inset * 0.6);
  };
  shape(0);
  g.fillStyle = hex(OUTLINE_RGB);
  g.fill();
  shape(2);
  g.fillStyle = hex(mixRGB(ramp(color)[1], [255, 240, 200], 0.2));
  g.fill();
  g.save();
  shape(6);
  g.clip();
  g.imageSmoothingEnabled = false;
  g.drawImage(at.img, (i % at.cols) * at.cell, Math.floor(i / at.cols) * at.cell, at.cell, at.cell, 0, 0, S, S);
  g.restore();
  // a touch of light across the top, as if under glass
  g.save();
  shape(6);
  g.clip();
  const sheen = g.createLinearGradient(0, 0, 0, S * 0.5);
  sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, S, S * 0.5);
  g.restore();
  return c;
}

const plain = new Map<string, string>();

/** A named icon on its own, as a data URL: for what isn't a skill (The Vigil's cards). Empty until the atlas is in. */
export function iconPicture(name: string): string {
  const hit = plain.get(name);
  if (hit) return hit;
  const at = atlas;
  const i = at?.at.get(name);
  if (!at || i === undefined) return '';
  const S = at.cell * 2;
  const c = canvas(S, S);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = false;
  g.drawImage(at.img, (i % at.cols) * at.cell, Math.floor(i / at.cols) * at.cell, at.cell, at.cell, 0, 0, S, S);
  const url = c.toDataURL();
  plain.set(name, url);
  return url;
}
