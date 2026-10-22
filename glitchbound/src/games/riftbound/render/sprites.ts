import { CLASSES } from '../data/classes';
import type { ClassId, Item, ItemIcon } from '../data/types';
import { itemIcon, itemTint } from '../progress/items';
import { CREATURE_ART, HERO_ART, ITEM_ICON_PAL, ITEM_ICONS, SKILL_ICON_PAL, SKILL_ICONS, type Pal } from './artdata';
import { canvas, ctx2d, makeSprite, paint, scaled, shade, type Cnv, type Sprite } from './pixel';

/** Every sprite the game draws, built once on first use. */

const cache = new Map<string, Sprite>();
const iconCache = new Map<string, string>();

function memo(key: string, make: () => Cnv): Sprite {
  let s = cache.get(key);
  if (!s) {
    s = makeSprite(make());
    cache.set(key, s);
  }
  return s;
}

export type HeroDir = 'down' | 'up' | 'side';

/** A hero frame: 0 idle, 1 and 2 walking. Side frames face right. */
export function heroSprite(cls: ClassId, dir: HeroDir, frame: number): Sprite {
  return memo(`hero:${cls}:${dir}:${frame}`, () => {
    const a = HERO_ART[cls]!;
    const legs = a.legs[dir][frame % a.legs[dir].length]!;
    return paint([...a.body[dir], ...legs], a.pal);
  });
}

/** A creature frame (enemies, bosses, NPCs). Art faces right. */
export function creatureSprite(id: string, frame: number): Sprite {
  const art = CREATURE_ART[id] ?? CREATURE_ART.slime!;
  const f = frame % art.frames.length;
  return memo(`cr:${id}:${f}`, () => paint(art.frames[f]!, art.pal));
}

/** Grimtusk and friends tinted for elites and bosses are drawn from the same art with a palette swap. */
export function recolored(id: string, frame: number, pal: Pal, key: string): Sprite {
  const art = CREATURE_ART[id] ?? CREATURE_ART.slime!;
  const f = frame % art.frames.length;
  return memo(`rc:${key}:${f}`, () => paint(art.frames[f]!, { ...art.pal, ...pal }));
}

/* --------------------------------------------------------------- weapons */

const WEAPONS: Record<string, { rows: string[]; pal: Pal }> = {
  staff: { rows: ['.oo.', 'oOOo', 'oOOo', '.oo.', '.w..', '.w..', '.W..', '.w..', '.w..', '.W..', '.w..', '.w..', '.W..'], pal: { o: '#ffcf5a', O: '#fff2b0', w: '#a0703f', W: '#6a4424' } },
  sword: { rows: ['.l.', '.m.', '.m.', '.m.', '.m.', '.m.', '.m.', 'ggg', '.k.', '.k.'], pal: { l: '#ffffff', m: '#d8dce6', g: '#ffcf5a', k: '#6a4424' } },
  axe: { rows: ['tttt.', 'tTTtw', 'tTTtw', '.ttww', '...w.', '...w.', '...w.', '...W.', '...w.', '...W.'], pal: { t: '#d8dce6', T: '#8a90a6', w: '#a0703f', W: '#6a4424' } },
  hammer: { rows: ['mmmmm', 'mMMMm', 'mmmmm', '..w..', '..w..', '..W..', '..w..', '..w..', '..W..', '..w..'], pal: { m: '#d8dce6', M: '#8a90a6', w: '#a0703f', W: '#6a4424' } },
  bow: { rows: ['ww..', '.w.s', '..ws', '..ws', '..ws', '..ws', '..ws', '..ws', '.w.s', 'ww..'], pal: { w: '#a0703f', s: '#ece6d4' } },
  shield: { rows: ['mmmmmm', 'mttytm', 'mtyyym', 'mttytm', 'mttytm', '.mttm.', '..mm..'], pal: { m: '#d8dce6', t: '#c9473b', y: '#ffcf5a' } },
};

/** The weapon a hero holds, colored by the equipped weapon (so a new staff shows in the hand). */
export function weaponSprite(kind: string, tint?: string): Sprite {
  return memo(`wp:${kind}:${tint ?? ''}`, () => {
    const w = WEAPONS[kind] ?? WEAPONS.sword!;
    const pal = { ...w.pal };
    if (tint) {
      if (kind === 'staff') {
        pal.o = tint;
        pal.O = shade(tint, 0.55);
      } else if (kind === 'sword' || kind === 'axe' || kind === 'hammer') {
        pal.g = tint;
        if (kind !== 'sword') {
          pal.t = shade(tint, 0.3);
          pal.m = shade(tint, 0.35);
        }
      } else if (kind === 'bow') pal.w = tint;
      else if (kind === 'shield') pal.t = tint;
    }
    return paint(w.rows, pal);
  });
}

/** Which weapon art a hero shows. */
export function heldWeapon(cls: ClassId, weapon: Item | undefined): { kind: string; tint?: string } {
  const icon = weapon ? itemIcon(weapon) : undefined;
  const tint = weapon ? itemTint(weapon) : undefined;
  if (cls === 'mage') return { kind: 'staff', tint: tint ?? CLASSES.mage.colors.accent };
  if (cls === 'ranger') return { kind: 'bow', tint };
  return { kind: icon === 'axe' ? 'axe' : icon === 'hammer' ? 'hammer' : 'sword', tint };
}

/* ----------------------------------------------------------------- icons */

/** An item's icon tinted in its color, as a data URL for the UI (cached). */
export function itemIconUrl(item: Item | { icon: ItemIcon; tint: string }, scale = 4): string {
  const icon = 'uid' in item ? itemIcon(item) : item.icon;
  const tint = 'uid' in item ? itemTint(item) : item.tint;
  const key = `${icon}:${tint}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const pal = { ...ITEM_ICON_PAL, t: tint, T: shade(tint, -0.4), l: shade(tint, 0.6) };
  const url = scaled(paint(ITEM_ICONS[icon] ?? ITEM_ICONS.relic!, pal), scale).toDataURL();
  iconCache.set(key, url);
  return url;
}

export function skillIconUrl(id: string, scale = 4): string {
  const key = `skill:${id}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const rows = SKILL_ICONS[id] ?? SKILL_ICONS['arcane-bolt']!;
  const url = scaled(paint(rows, SKILL_ICON_PAL), scale).toDataURL();
  iconCache.set(key, url);
  return url;
}

/** A hero or creature portrait for the UI. */
export function portraitUrl(kind: 'hero' | 'creature', id: string, scale = 4): string {
  const key = `portrait:${kind}:${id}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const s = kind === 'hero' ? heroSprite(id as ClassId, 'down', 0) : creatureSprite(id, 0);
  const url = scaled(s.c, scale).toDataURL();
  iconCache.set(key, url);
  return url;
}

/** A rendered glow disc (lights, loot beams). */
export function glowDisc(color: string, r: number): Cnv {
  const key = `glow:${color}:${r}`;
  const hit = cache.get(key);
  if (hit) return hit.c;
  const c = canvas(r * 2, r * 2);
  const g = ctx2d(c);
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, r * 2, r * 2);
  cache.set(key, { c, f: c, w: c, wf: c, width: c.width, height: c.height });
  return c;
}
