import { CLASSES } from '../data/classes';
import type { ClassId, Item, ItemIcon, SlotId } from '../data/types';
import { itemIcon, itemMat, itemTint } from '../progress/items';
import { HERO_H, HERO_W, paintHero, type ChestStyle, type FeetStyle, type HandStyle, type HeadStyle, type HeroLook, type LegStyle, type Piece } from './art/hero';
import { NPCS } from '../data/quests';
import { CREATURE_ART, ITEM_ICON_PAL, ITEM_ICONS, type Art, type Pal } from './artdata';
import { COMPANION_ART } from './art/companions';
import { FOE_ART } from './art/foes';
import { TOWNSFOLK_LOOKS } from './art/townsfolk';
import { ZONE_ART } from './art/zones';
import { glyphIcon } from './art/icons';
import { DMG_COLOR, SKILL_GLYPH } from './art/skillGlyphs';
import { SKILLS } from '../data/skills';
import { canvas, ctx2d, makeSprite, paint, scale2x, scaled, shade, type Cnv, type Sprite } from './pixel';

/** Every sprite the game draws, built once on first use. */

const cache = new Map<string, Sprite>();
const iconCache = new Map<string, string>();

/** A sprite built once; `k` is its art pixels per world pixel. */
function memo(key: string, make: () => Cnv, k = 2): Sprite {
  let s = cache.get(key);
  if (!s) {
    s = makeSprite(make(), k);
    cache.set(key, s);
  }
  return s;
}

/** Text art doubled with Scale2x, then painted with a fine outline. */
const paint2x = (rows: string[], pal: Pal): Cnv => paint(scale2x(rows), pal);

export type HeroDir = 'down' | 'up' | 'side';

/** How each class looks in the slots where it wears nothing. */
const BARE: Record<ClassId, HeroLook> = {
  mage: {
    skin: '#f5c9a0',
    hair: '#e8e4f0',
    hairStyle: 'short',
    head: { style: 'wizard', mat: 'cloth', tint: '#7a5ae6', r: 'common' },
    chest: { style: 'robe', mat: 'cloth', tint: '#6a4ad0', r: 'common' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#4a3a7a', r: 'common' },
    hands: null,
    feet: { style: 'shoes', mat: 'leather', tint: '#6a4428', r: 'common' },
    quiver: null,
    cape: null,
  },
  warrior: {
    skin: '#f2bf96',
    hair: '#6a4428',
    hairStyle: 'short',
    head: null,
    chest: { style: 'tunic', mat: 'cloth', tint: '#b8433a', r: 'common' },
    legs: { style: 'trousers', mat: 'leather', tint: '#6a4a34', r: 'common' },
    hands: { style: 'gloves', mat: 'leather', tint: '#8a6a4a', r: 'common' },
    feet: { style: 'boots', mat: 'leather', tint: '#5a3a24', r: 'common' },
    quiver: null,
    cape: null,
  },
  ranger: {
    skin: '#f0c09a',
    hair: '#e8c070',
    hairStyle: 'pony',
    head: null,
    chest: { style: 'tunic', mat: 'leather', tint: '#4f8a4a', r: 'common' },
    legs: { style: 'trousers', mat: 'leather', tint: '#5a4430', r: 'common' },
    hands: { style: 'gloves', mat: 'leather', tint: '#7a5034', r: 'common' },
    feet: { style: 'boots', mat: 'leather', tint: '#6a4428', r: 'common' },
    quiver: '#9a6a3a',
    cape: null,
  },
  warlock: {
    skin: '#e8c8b8',
    hair: '#2a1a2a',
    hairStyle: 'long',
    head: { style: 'hood', mat: 'cloth', tint: '#4a2a6a', r: 'common' },
    chest: { style: 'robe', mat: 'cloth', tint: '#3a1a4a', r: 'common' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#2a1a3a', r: 'common' },
    hands: { style: 'gloves', mat: 'cloth', tint: '#2a1a2a', r: 'common' },
    feet: { style: 'shoes', mat: 'leather', tint: '#2a1a1a', r: 'common' },
    quiver: null,
    cape: null,
  },
  priest: {
    skin: '#f2d0b0',
    hair: '#e8d080',
    hairStyle: 'short',
    head: null,
    chest: { style: 'robe', mat: 'cloth', tint: '#f2ece0', r: 'epic' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#d8d0c0', r: 'common' },
    hands: null,
    feet: { style: 'shoes', mat: 'leather', tint: '#8a6a4a', r: 'common' },
    quiver: null,
    cape: null,
  },
  paladin: {
    skin: '#f0c8a0',
    hair: '#d8b060',
    hairStyle: 'short',
    head: null,
    chest: { style: 'plate', mat: 'mail', tint: '#b8bcc8', r: 'rare' },
    legs: { style: 'greaves', mat: 'mail', tint: '#9aa0b0', r: 'common' },
    hands: { style: 'gauntlets', mat: 'plate', tint: '#c8ccd8', r: 'common' },
    feet: { style: 'boots', mat: 'leather', tint: '#6a4428', r: 'common' },
    quiver: null,
    cape: null,
  },
  druid: {
    skin: '#e0b088',
    hair: '#6a8a3a',
    hairStyle: 'long',
    head: null,
    chest: { style: 'robe', mat: 'cloth', tint: '#7a5a2a', r: 'common' },
    legs: { style: 'trousers', mat: 'leather', tint: '#4a3a2a', r: 'common' },
    hands: null,
    feet: { style: 'shoes', mat: 'leather', tint: '#4a3020', r: 'common' },
    quiver: null,
    cape: null,
  },
};

function piece<S extends string>(it: Item, style: S): Piece<S> {
  return { style, mat: itemMat(it), tint: itemTint(it), r: it.r };
}

/** What a hero looks like in the gear they wear: every armor piece shows. */
export function heroLook(cls: ClassId, equip: Partial<Record<SlotId, Item>> = {}): HeroLook {
  const bare = BARE[cls];
  const { head, chest, legs, hands, feet, offhand } = equip;
  const metal = (it: Item): boolean => itemMat(it) === 'plate' || itemMat(it) === 'mail';
  const headStyle = (it: Item): HeadStyle => {
    const icon = itemIcon(it);
    return icon === 'hood' || icon === 'helm' || icon === 'crown' ? icon : 'cap';
  };
  const chestStyle = (it: Item): ChestStyle => (itemIcon(it) === 'robe' ? 'robe' : itemIcon(it) === 'plate' ? 'plate' : 'tunic');
  const legStyle = (it: Item): LegStyle => (metal(it) ? 'greaves' : 'trousers');
  const handStyle = (it: Item): HandStyle => (metal(it) ? 'gauntlets' : 'gloves');
  const feetStyle = (it: Item): FeetStyle => (metal(it) ? 'sabatons' : itemMat(it) === 'cloth' ? 'shoes' : 'boots');
  const chestPiece = chest ? piece(chest, chestStyle(chest)) : bare.chest;
  return {
    ...bare,
    head: head ? piece(head, headStyle(head)) : bare.head,
    chest: chestPiece,
    legs: legs ? piece(legs, legStyle(legs)) : bare.legs,
    hands: hands ? piece(hands, handStyle(hands)) : bare.hands,
    feet: feet ? piece(feet, feetStyle(feet)) : bare.feet,
    quiver: offhand && itemIcon(offhand) === 'quiver' ? itemTint(offhand) : bare.quiver,
    // epic and legendary armor comes with a cape
    cape: chest && chestPiece.style !== 'robe' && (chest.r === 'epic' || chest.r === 'legendary') ? (chest.r === 'legendary' ? '#a8262e' : '#5a2a8a') : null,
  };
}

const lookKey = (l: HeroLook): string => JSON.stringify(l);

/**
 * A hero frame at art resolution (DETAIL × world size): 0 standing, 1 and 2 walking. Side frames
 * face right.
 */
export function heroSprite(look: HeroLook, dir: HeroDir, frame: number): Sprite {
  return memo(`hero:${lookKey(look)}:${dir}:${frame}`, () => paintHero(look, dir, frame).toCanvas());
}

/** The top of a hero (head and shoulders) for portraits. */
function heroBust(look: HeroLook): Cnv {
  const full = paintHero(look, 'down', 0).toCanvas();
  const top = look.head?.style === 'wizard' ? 0 : look.head?.style === 'helm' && look.head.r !== 'common' && look.head.r !== 'uncommon' ? 6 : 9;
  const c = canvas(HERO_W, 44 - top);
  ctx2d(c).drawImage(full, 0, -top);
  return c;
}

/** A hero's portrait in their gear, as a data URL (cached). */
export function heroPortraitUrl(look: HeroLook, scale = 3): string {
  const key = `portrait:hero:${lookKey(look)}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const url = scaled(heroBust(look), scale).toDataURL();
  iconCache.set(key, url);
  return url;
}

/** A whole hero standing, for the character screen (cached). */
export function heroDollUrl(look: HeroLook, view: HeroDir, scale = 4): string {
  const key = `doll:${lookKey(look)}:${view}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const url = scaled(heroSprite(look, view, 0).c, scale).toDataURL();
  iconCache.set(key, url);
  return url;
}

export { HERO_H, HERO_W };

/** Every creature drawing: the first ones, companions, the new lands' enemies, each zone's own. */
const ALL_ART: Record<string, Art> = Object.assign({}, CREATURE_ART, COMPANION_ART, FOE_ART, ...ZONE_ART.map((z) => z.foes));
const artFor = (id: string): Art => ALL_ART[id] ?? CREATURE_ART.slime!;

/** A creature frame (enemies, bosses, NPCs). Art faces right. */
export function creatureSprite(id: string, frame: number): Sprite {
  const art = artFor(id);
  const f = frame % art.frames.length;
  return memo(`cr:${id}:${f}`, () => paint2x(art.frames[f]!, art.pal));
}

/** Grimtusk and friends tinted for elites and bosses are drawn from the same art with a palette swap. */
export function recolored(id: string, frame: number, pal: Pal, key: string): Sprite {
  const art = artFor(id);
  const f = frame % art.frames.length;
  return memo(`rc:${key}:${f}`, () => paint2x(art.frames[f]!, { ...art.pal, ...pal }));
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
    return paint2x(w.rows, pal);
  });
}

/** Which weapon art a hero shows. */
export function heldWeapon(cls: ClassId, weapon: Item | undefined): { kind: string; tint?: string } {
  const icon = weapon ? itemIcon(weapon) : undefined;
  const tint = weapon ? itemTint(weapon) : undefined;
  switch (cls) {
    case 'mage':
    case 'warlock':
    case 'druid':
      return { kind: 'staff', tint: tint ?? CLASSES[cls].colors.accent };
    case 'priest':
      return icon === 'hammer' ? { kind: 'hammer', tint } : { kind: 'staff', tint: tint ?? '#ffe9a0' };
    case 'ranger':
      return { kind: 'bow', tint };
    case 'paladin':
      return { kind: icon === 'sword' ? 'sword' : 'hammer', tint: tint ?? '#ffd84d' };
    default:
      return { kind: icon === 'axe' ? 'axe' : icon === 'hammer' ? 'hammer' : 'sword', tint };
  }
}

/* -------------------------------------------------------------- vendor signs */

/** What a vendor or a service is, as a little picture over their head (quests use ! and ? instead). */
const SIGNS: Record<string, { rows: string[]; pal: Pal }> = {
  inn: { rows: ['...cc...', '...ww...', '..wwww..', '.wrrrrw.', 'wrrRrrrw', 'wrrrrrrw', 'wrrrrrrw', '.wwwwww.'], pal: { c: '#a0703f', w: '#d8e8f0', r: '#ff4a5a', R: '#ffc0c8' } },
  weapons: { rows: ['......ww', '.....wWw', '....wWw.', '.g.wWw..', '..gWw...', '..bg....', '.b..g...', 'b.......'], pal: { w: '#c8ccd8', W: '#ffffff', g: '#ffcf5a', b: '#8a5a34' } },
  armor: { rows: ['..mmmm..', '.mMMMMm.', 'mMmmmmMm', 'mm.mm.mm', 'mm....mm', 'mmm..mmm', '.m....m.', '........'], pal: { m: '#9aa3b8', M: '#e8ecf4' } },
  curios: { rows: ['...gg...', '..gGGg..', '...gg...', '..y..y..', '.y....y.', '.y....y.', '..y..y..', '...yy...'], pal: { g: '#c58cff', G: '#f4e4ff', y: '#ffcf5a' } },
  quartermaster: { rows: ['...pp...', '...pp...', 'pppPPppp', '.ppPPpp.', '..pPPp..', '.pp..pp.', 'pp....pp', '........'], pal: { p: '#ff6ad5', P: '#ffd0f4' } },
  respec: { rows: ['.bbbbbb.', 'bWWbWWWb', 'bWWbWWWb', 'bWWbWWWb', 'bWWbWWWb', 'bbbbbbbb', '........', '........'], pal: { b: '#6a3ab0', W: '#f2ead8' } },
};

/** A vendor's sign, or null for someone who sells nothing. */
export function vendorSign(kind: string): Sprite | null {
  const sign = SIGNS[kind];
  return sign ? memo(`sign:${kind}`, () => paint2x(sign.rows, sign.pal)) : null;
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

/** A skill's icon (its glyph in its color), as a data URL for the UI (cached). */
export function skillIconUrl(id: string, scale = 4): string {
  const [glyph, color] = SKILL_GLYPH[id] ?? ['star'];
  return glyphIconUrl(glyph, color ?? DMG_COLOR[SKILLS[id]?.base.dmgType ?? 'arcane'], scale);
}

/** A glyph on a tile of a color (talents use their tree's color), as a data URL (cached). */
export function glyphIconUrl(glyph: string, color: string, scale = 4): string {
  const key = `glyph:${glyph}:${color}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const url = scaled(glyphIcon(glyph, color).toCanvas(), Math.max(1, Math.round(scale / 2))).toDataURL();
  iconCache.set(key, url);
  return url;
}

/** How the townsfolk dress (they are drawn like heroes). */
const NPC_LOOKS: Record<string, HeroLook> = {
  maren: {
    skin: '#e8b890',
    hair: '#e8e4f0',
    hairStyle: 'long',
    beard: '#e8e4f0',
    head: null,
    chest: { style: 'robe', mat: 'cloth', tint: '#7a5a3a', r: 'common' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#4a3a2a', r: 'common' },
    hands: null,
    feet: { style: 'shoes', mat: 'leather', tint: '#4a3020', r: 'common' },
    quiver: null,
    cape: null,
  },
  brannoc: {
    skin: '#d8a07a',
    hair: '#3a2a1a',
    hairStyle: 'short',
    beard: '#3a2a1a',
    apron: '#5a3a24',
    head: null,
    chest: { style: 'tunic', mat: 'cloth', tint: '#8a4a2a', r: 'common' },
    legs: { style: 'trousers', mat: 'leather', tint: '#4a3a2a', r: 'common' },
    hands: { style: 'gloves', mat: 'leather', tint: '#3a2a1a', r: 'common' },
    feet: { style: 'boots', mat: 'leather', tint: '#3a2a1a', r: 'common' },
    quiver: null,
    cape: null,
  },
  ysolde: {
    skin: '#f0c8b0',
    hair: '#2a1a3a',
    hairStyle: 'long',
    head: { style: 'hood', mat: 'cloth', tint: '#3a6a9a', r: 'rare' },
    chest: { style: 'robe', mat: 'cloth', tint: '#2a4a7a', r: 'rare' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#2a2a4a', r: 'common' },
    hands: null,
    feet: { style: 'shoes', mat: 'cloth', tint: '#2a2a4a', r: 'common' },
    quiver: null,
    cape: null,
  },
  tamsin: {
    skin: '#f2c4a0',
    hair: '#c9473b',
    hairStyle: 'pony',
    apron: '#f2ece0',
    head: null,
    chest: { style: 'tunic', mat: 'cloth', tint: '#5a7ab0', r: 'common' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#7a3a20', r: 'common' },
    hands: null,
    feet: { style: 'shoes', mat: 'leather', tint: '#5a3a24', r: 'common' },
    quiver: null,
    cape: null,
  },
  odo: {
    skin: '#c88a64',
    hair: '#1a1a22',
    hairStyle: 'short',
    beard: '#1a1a22',
    head: null,
    chest: { style: 'plate', mat: 'mail', tint: '#8a90a6', r: 'common' },
    legs: { style: 'greaves', mat: 'mail', tint: '#7a7e8a', r: 'common' },
    hands: { style: 'gauntlets', mat: 'plate', tint: '#a8aec0', r: 'common' },
    feet: { style: 'sabatons', mat: 'plate', tint: '#9aa0b0', r: 'common' },
    quiver: null,
    cape: null,
  },
  wren: {
    skin: '#f0c09a',
    hair: '#3a8a6a',
    hairStyle: 'long',
    head: { style: 'cap', mat: 'leather', tint: '#c9479b', r: 'epic' },
    chest: { style: 'robe', mat: 'cloth', tint: '#a0407a', r: 'uncommon' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#3a3a5a', r: 'common' },
    hands: { style: 'gloves', mat: 'cloth', tint: '#3a8a6a', r: 'common' },
    feet: { style: 'shoes', mat: 'cloth', tint: '#3a3a5a', r: 'common' },
    quiver: null,
    cape: null,
  },
  hale: {
    skin: '#e0a882',
    hair: '#6a6a7a',
    hairStyle: 'short',
    beard: '#6a6a7a',
    head: { style: 'helm', mat: 'plate', tint: '#8a7ac0', r: 'rare' },
    chest: { style: 'plate', mat: 'plate', tint: '#7a6ab0', r: 'epic' },
    legs: { style: 'greaves', mat: 'plate', tint: '#6a5aa0', r: 'common' },
    hands: { style: 'gauntlets', mat: 'plate', tint: '#7a6ab0', r: 'common' },
    feet: { style: 'sabatons', mat: 'plate', tint: '#6a5aa0', r: 'common' },
    quiver: null,
    cape: '#3b2a8a',
  },
  pell: {
    skin: '#e8b088',
    hair: '#8a5a2a',
    hairStyle: 'short',
    head: { style: 'cap', mat: 'leather', tint: '#c9a35a', r: 'common' },
    chest: { style: 'tunic', mat: 'cloth', tint: '#6a8a3a', r: 'common' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#5a4a3a', r: 'common' },
    hands: null,
    feet: { style: 'boots', mat: 'leather', tint: '#5a3a24', r: 'common' },
    quiver: null,
    cape: null,
  },
  ...TOWNSFOLK_LOOKS,
  ...Object.assign({}, ...ZONE_ART.map((z) => z.looks)),
};

/** An NPC's sprite: drawn like a hero in their own clothes (older art for anyone without a look). */
export function npcSprite(id: string, frame = 0): Sprite {
  const look = NPC_LOOKS[id];
  if (look) return heroSprite(look, 'down', 0);
  const npc = NPCS[id];
  if (!npc) return creatureSprite('villager', frame);
  return npc.pal ? recolored(npc.sprite, frame, npc.pal, `npc:${id}`) : creatureSprite(npc.sprite, frame);
}

/** A hero (in class colors, no gear), creature or NPC portrait for the UI. */
export function portraitUrl(kind: 'hero' | 'creature' | 'npc', id: string, scale = 4): string {
  if (kind === 'hero') return heroPortraitUrl(heroLook(id as ClassId), Math.max(1, Math.round(scale * 0.75)));
  if (kind === 'npc' && NPC_LOOKS[id]) return heroPortraitUrl(NPC_LOOKS[id], Math.max(1, Math.round(scale * 0.75)));
  const key = `portrait:${kind}:${id}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const s = kind === 'npc' ? npcSprite(id) : creatureSprite(id, 0);
  const url = scaled(s.c, Math.max(1, Math.round(scale / s.k))).toDataURL();
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
  cache.set(key, { c, f: c, w: c, wf: c, width: c.width, height: c.height, k: 1 });
  return c;
}
