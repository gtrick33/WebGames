import { FOE_LOOKS } from './art/foeLooks';
import { bustPicture, creaturePicture, dollPicture, mountPicture, type DollView } from '../render3d/portrait';
import { mountKey } from '../render3d/mountKit';
import { HAIRS, SKINS, type Face } from '../progress/character';
import { CLASSES } from '../data/classes';
import type { Body } from '../progress/character';
import type { ClassId, Item, ItemIcon, Material, Rarity, SlotId, TalentNode } from '../data/types';
import { itemIcon, itemMat, itemTint } from '../progress/items';
import type { MountDef } from '../data/mounts';
import { MOUNT_FRAMES, paintMount, paintRiderLegs, RIDER_HIP } from './art/mount';
import { HERO_H, HERO_W, paintHero, type ChestStyle, type FeetStyle, type HandStyle, type HeadStyle, type HeroLook, type LegStyle, type Piece } from './art/hero';
import { NPCS } from '../data/quests';
import { CREATURE_ART, ITEM_ICON_PAL, ITEM_ICONS, type Art, type Pal } from './artdata';
import { COMPANION_ART } from './art/companions';
import { FOE_ART } from './art/foes';
import { TOWNSFOLK_LOOKS } from './art/townsfolk';
import { ZONE_ART } from './art/zones';
import { hasIcon, iconTile, skillIcon, talentIcon } from './art/gameIcons';
import { glyphIcon } from './art/icons';
import { DMG_COLOR, SKILL_GLYPH } from './art/skillGlyphs';
import { SKILLS } from '../data/skills';
import { canvas, ctx2d, DETAIL, makeSprite, outlined, paint, scale2x, scaled, shade, smooth2x, type Cnv, type Sprite } from './pixel';

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
    // a wanderer's storm-grey and slate, not a costume-shop purple (VISUAL_BIBLE.md §1)
    head: { style: 'wizard', mat: 'cloth', tint: '#4a5472', r: 'common' },
    chest: { style: 'robe', mat: 'cloth', tint: '#3a4564', r: 'common' },
    legs: { style: 'trousers', mat: 'cloth', tint: '#272d42', r: 'common' },
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
  // smoke-dark plate over a dusk-violet gambeson: no shield, both hands on the greatsword
  gloamknight: {
    skin: '#e8c4a8',
    hair: '#3a3440',
    hairStyle: 'short',
    head: null,
    chest: { style: 'plate', mat: 'plate', tint: '#4a4458', r: 'rare' },
    legs: { style: 'greaves', mat: 'plate', tint: '#3a3646', r: 'common' },
    hands: { style: 'gauntlets', mat: 'plate', tint: '#4a4458', r: 'common' },
    feet: { style: 'sabatons', mat: 'plate', tint: '#3a3646', r: 'common' },
    quiver: null,
    cape: null,
  },
};

/** What shows of a piece: its icon, material, color and rarity (an item's, or a Wardrobe look's). */
interface Shown {
  icon: ItemIcon;
  mat: Material;
  tint: string;
  r: Rarity;
  set?: string;
  colors?: string[];
}

const shownOf = (it: Item): Shown => ({ icon: itemIcon(it), mat: itemMat(it), tint: itemTint(it), r: it.r });

function piece<S extends string>(it: Shown, style: S): Piece<S> {
  if (!it.set) return { style, mat: it.mat, tint: it.tint, r: it.r };
  return it.colors ? { style, mat: it.mat, tint: it.tint, r: it.r, set: it.set, colors: it.colors } : { style, mat: it.mat, tint: it.tint, r: it.r, set: it.set };
}

/** Wardrobe looks worn over the gear (progress/wardrobe.ts wornLooks): a look, or the class's bare look. */
export type WornLooks = Partial<Record<'head' | 'chest' | 'weapon', Shown | 'bare'>>;

/**
 * What a hero looks like in the gear they wear: every armor piece shows. A Wardrobe look worn over the
 * head, chest or weapon is drawn instead of the equipped piece there (stats never see it).
 */
export function heroLook(cls: ClassId, equip: Partial<Record<SlotId, Item>> = {}, worn: WornLooks = {}, body: Body = 'm', face?: Face): HeroLook {
  const base = BARE[cls];
  // a woman wears her hair long (a class that ties it back keeps the ponytail)
  const shaped: HeroLook = body === 'f' ? { ...base, female: true, hairStyle: base.hairStyle === 'short' ? 'long' : base.hairStyle } : base;
  // what the player chose at the start (a hero made before the choice keeps their class's look)
  const bare: HeroLook = face
    ? { ...shaped, skin: SKINS[face.skin] ?? shaped.skin, hair: HAIRS[face.hair] ?? shaped.hair, hairStyle: face.style, beard: face.beard && body !== 'f' ? (HAIRS[face.hair] ?? shaped.hair) : shaped.beard ?? null }
    : shaped;
  const { legs, hands, feet, offhand } = equip;
  const pick = (slot: 'head' | 'chest'): Shown | null | 'bare' => {
    const w = worn[slot];
    if (w) return w;
    const it = equip[slot];
    return it ? shownOf(it) : null;
  };
  const head = pick('head');
  const chest = pick('chest');
  const metal = (it: Shown): boolean => it.mat === 'plate' || it.mat === 'mail';
  const headStyle = (it: Shown): HeadStyle => (it.icon === 'hood' || it.icon === 'helm' || it.icon === 'crown' ? it.icon : 'cap');
  const chestStyle = (it: Shown): ChestStyle => (it.icon === 'robe' ? 'robe' : it.icon === 'plate' ? 'plate' : 'tunic');
  const legStyle = (it: Shown): LegStyle => (metal(it) ? 'greaves' : 'trousers');
  const handStyle = (it: Shown): HandStyle => (metal(it) ? 'gauntlets' : 'gloves');
  const feetStyle = (it: Shown): FeetStyle => (metal(it) ? 'sabatons' : it.mat === 'cloth' ? 'shoes' : 'boots');
  // (what a class starts out in is the plainest there is)
  const plain = <S extends string>(p: Piece<S>): Piece<S> => ({ ...p, r: 'common' });
  const chestPiece = chest && chest !== 'bare' ? piece(chest, chestStyle(chest)) : plain(bare.chest);
  const caped = chest && chest !== 'bare' && !chest.set && (chest.r === 'epic' || chest.r === 'legendary');
  return {
    ...bare,
    ladder: true,
    head: head && head !== 'bare' ? piece(head, headStyle(head)) : bare.head && plain(bare.head),
    chest: chestPiece,
    legs: legs ? piece(shownOf(legs), legStyle(shownOf(legs))) : plain(bare.legs),
    hands: hands ? piece(shownOf(hands), handStyle(shownOf(hands))) : bare.hands && plain(bare.hands),
    feet: feet ? piece(shownOf(feet), feetStyle(shownOf(feet))) : plain(bare.feet),
    quiver: offhand && itemIcon(offhand) === 'quiver' ? itemTint(offhand) : bare.quiver,
    // epic and legendary armor comes with a cape
    cape: caped ? (chest.r === 'legendary' ? '#a8262e' : '#5a2a8a') : null,
  };
}

const lookKey = (l: HeroLook): string => JSON.stringify(l);

/**
 * A hero frame at art resolution (DETAIL × world size): 0 standing, 1 and 2 walking. Side frames
 * face right.
 */
export function heroSprite(look: HeroLook, dir: HeroDir, frame: number): Sprite {
  // painted at twice the world's size, then smoothed to the world's own four (CHARACTER_ART_BIBLE.md): curves
  // and diagonals come out clean, and the outline is one fine pixel at that size, like the scenery's
  return memo(`hero:${lookKey(look)}:${dir}:${frame}`, () => outlined(smooth2x(paintHero(look, dir, frame, false).toCanvas())), HERO_K);
}

/** Art pixels per world pixel of a hero (and every paper-doll person) picture. */
export const HERO_K = 4;

/** The top of a hero (head and shoulders) for portraits. */
function heroBust(look: HeroLook): Cnv {
  // head and shoulders of the smoothed figure the world shows (not the raw paint): portraits match the hero
  const full = heroSprite(look, 'down', 0).c;
  const f = full.width / HERO_W;
  const top = look.head?.style === 'wizard' ? 0 : look.head?.style === 'helm' && look.head.r !== 'common' && look.head.r !== 'uncommon' ? 6 : 9;
  const c = canvas(full.width, Math.round((44 - top) * f));
  ctx2d(c).drawImage(full, 0, -Math.round(top * f));
  return c;
}

/** A hero's portrait in their gear, as a data URL (cached). */
export function heroPortraitUrl(look: HeroLook, scale = 3): string {
  const key = `portrait:hero:${lookKey(look)}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const shot = bustPicture(look, Math.max(96, Math.round(scale * 48)));
  if (shot) {
    iconCache.set(key, shot);
    return shot;
  }
  const url = scaled(heroBust(look), Math.max(1, Math.round(scale / HERO_K))).toDataURL();
  iconCache.set(key, url);
  return url;
}

/** A whole hero standing, for the character screen (cached). */
export function heroDollUrl(look: HeroLook, view: HeroDir, scale = 4, held: { kind: string; tint?: string } | null = null, shield = false): string {
  const key = `doll:${lookKey(look)}:${view}:${scale}:${held?.kind ?? ''}:${held?.tint ?? ''}:${shield ? 1 : 0}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const shot = dollPicture(look, view as DollView, Math.max(240, Math.round(scale * 96)), held, shield);
  if (shot) {
    iconCache.set(key, shot);
    return shot;
  }
  const url = scaled(heroSprite(look, view, 0).c, Math.max(1, Math.round((scale * DETAIL) / HERO_K))).toDataURL();
  iconCache.set(key, url);
  return url;
}

export { HERO_H, HERO_W };

/** A mount's back and front layers for a view and frame (render/art/mount.ts), at art resolution. */
export function mountSprites(m: MountDef, view: HeroDir, frame: number): { back: Sprite; front: Sprite } {
  const key = `mount:${mountKey(m)}:${view}:${frame}`;
  // smoothed to the hero's own scale like the paper doll, so rider and mount share one line
  const make = (): { back: Cnv; front: Cnv } => {
    const l = paintMount(m, view, frame, false);
    return { back: outlined(smooth2x(l.back.toCanvas())), front: outlined(smooth2x(l.front.toCanvas())) };
  };
  let made: { back: Cnv; front: Cnv } | null = null;
  const once = (): { back: Cnv; front: Cnv } => (made ??= make());
  return { back: memo(`${key}:b`, () => once().back, HERO_K), front: memo(`${key}:f`, () => once().front, HERO_K) };
}

/** The mount pictures still to be drawn: one at a time, so that opening the page doesn't stop the game to draw twenty. */
const toDraw = new Map<string, { draw: () => string | null; tries: number }>();
const pictureWatchers = new Set<() => void>();
let drawing = false;

function drawNextPicture(): void {
  let drew = false;
  for (const [key, job] of toDraw) {
    const shot = job.draw();
    if (shot) {
      iconCache.set(key, shot);
      toDraw.delete(key);
      drew = true;
      for (const w of pictureWatchers) w();
      break;
    }
    // (its model is still on its way; if it never comes, the stand-in stays)
    if (++job.tries > 60) toDraw.delete(key);
  }
  if (toDraw.size) setTimeout(drawNextPicture, drew ? 16 : 200);
  else drawing = false;
}

/** Says whenever a mount's picture has come in. Returns how to stop being told. */
export function watchMountPictures(fn: () => void): () => void {
  pictureWatchers.add(fn);
  return () => pictureWatchers.delete(fn);
}

/**
 * A mount standing for the collection page, with the hero in the saddle when a look is given, as a data URL. The real
 * model's picture is drawn soon after it's first asked for (watchMountPictures says when); a painted one stands in.
 */
export function mountPictureUrl(m: MountDef, look: HeroLook | null, scale = 3): string {
  const key = `mountpic:${mountKey(m)}:${look ? lookKey(look) : '-'}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  if (!toDraw.has(key)) {
    toDraw.set(key, { draw: () => mountPicture(m, Math.max(220, scale * 70), look ? { look, held: null, shield: false } : null), tries: 0 });
    if (!drawing) {
      drawing = true;
      setTimeout(drawNextPicture, 0);
    }
  }
  const standIn = `${key}:painted`;
  const painted = iconCache.get(standIn);
  if (painted) return painted;
  // composed at the hero's scale (twice the layout's art pixels)
  const f = HERO_K / DETAIL;
  const F = MOUNT_FRAMES.side;
  const top = (look ? Math.max(0, RIDER_HIP - F.seat[m.body][1]) : 0) * f;
  const c = canvas(F.w * f + 2, F.h * f + top + 2);
  const g = ctx2d(c);
  const { back, front } = mountSprites(m, 'side', 0);
  g.drawImage(back.c, 0, top);
  if (look) {
    const hero = heroSprite(look, 'side', 0);
    const [sx, sy] = F.seat[m.body];
    const rows = (RIDER_HIP + 1) * f + 1;
    g.drawImage(hero.c, 0, 0, hero.width, rows, sx * f - hero.width / 2 + 1, top + (sy - RIDER_HIP) * f, hero.width, rows);
  }
  g.drawImage(front.c, 0, top);
  if (look) g.drawImage(riderLegsSprite('side', m.body, look).c, 0, top);
  const url = scaled(c, Math.max(1, Math.round(scale / f))).toDataURL();
  iconCache.set(standIn, url);
  return url;
}

/** The rider's legs over the saddle, in the colors of what they wear (cached by those colors). */
export function riderLegsSprite(view: HeroDir, body: MountDef['body'], look: HeroLook): Sprite {
  return memo(`riderlegs:${view}:${body}:${look.legs.tint}:${look.feet.tint}`, () => outlined(smooth2x(paintRiderLegs(view, body, look.legs, look.feet, false).toCanvas())), HERO_K);
}

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

/** Which weapon art a hero shows: the equipped weapon's, or a Wardrobe look worn over it. */
export function heldWeapon(cls: ClassId, weapon: Item | undefined, look?: Shown | 'bare'): { kind: string; tint?: string } {
  const shown = look && look !== 'bare' ? look : weapon ? shownOf(weapon) : undefined;
  const icon = shown?.icon;
  const tint = shown?.tint;
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
    case 'gloamknight':
      return { kind: 'greatsword', tint: tint ?? '#5a4a80' };
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
/** An item's icon as a picture at its own pixel size (a dropped item shows what it is). */
export function itemIconCanvas(item: Item): Cnv {
  const icon = itemIcon(item);
  const tint = itemTint(item);
  return memo(`itemicon:${icon}:${tint}`, () => paint(ITEM_ICONS[icon] ?? ITEM_ICONS.relic!, { ...ITEM_ICON_PAL, t: tint, T: shade(tint, -0.4), l: shade(tint, 0.6) }), 1).c;
}

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

/**
 * A skill's icon on a tile of its color, as a data URL for the UI (cached): its own picture (art/gameIcons.ts)
 * once the icon atlas is in, its painted glyph until then. `round`: on a disc, for the round touch buttons.
 */
export function skillIconUrl(id: string, scale = 4, round = false): string {
  const [glyph, color] = SKILL_GLYPH[id] ?? ['star'];
  const c = color ?? DMG_COLOR[SKILLS[id]?.base.dmgType ?? 'arcane'];
  const name = skillIcon(id);
  return hasIcon(name) ? tileIconUrl(name, c, round) : glyphIconUrl(glyph, c, scale);
}

/** Does a skill show its own picture yet (the atlas is in), rather than its painted glyph? */
export const skillHasPicture = (id: string): boolean => hasIcon(skillIcon(id));

/** A talent's icon on a tile of its tree's color (its painted glyph until the icon atlas is in). */
export function talentIconUrl(cls: ClassId, node: TalentNode, color: string, scale = 4): string {
  const name = talentIcon(cls, node);
  return hasIcon(name) ? tileIconUrl(name, color) : glyphIconUrl(node.icon, color, scale);
}

function tileIconUrl(name: string, color: string, round = false): string {
  const key = `tile:${name}:${color}:${round ? 'o' : 's'}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const url = iconTile(name, color, round)?.toDataURL() ?? '';
  iconCache.set(key, url);
  return url;
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
  ...FOE_LOOKS,
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
/** Whether a townsperson is drawn as a paper-doll person (else a pixel sprite). */
export const hasPersonLook = (id: string): boolean => !!NPC_LOOKS[id];
/** A townsperson's look, for those drawn as a person. */
export const npcLookOf = (id: string): HeroLook | null => NPC_LOOKS[id] ?? null;

export function portraitUrl(kind: 'hero' | 'creature' | 'npc', id: string, scale = 4): string {
  if (kind === 'hero') return heroPortraitUrl(heroLook(id as ClassId), Math.max(1, Math.round(scale * 0.75)));
  if (kind === 'npc' && NPC_LOOKS[id]) return heroPortraitUrl(NPC_LOOKS[id], Math.max(1, Math.round(scale * 0.75)));
  const key = `portrait:${kind}:${id}:${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const shot = creaturePicture(kind === 'npc' ? (NPCS[id]?.sprite ?? 'villager') : id, Math.max(96, scale * 32));
  if (shot) {
    iconCache.set(key, shot);
    return shot;
  }
  // (the stand-in isn't kept: the 3D picture takes over once its model is in)
  const s = kind === 'npc' ? npcSprite(id) : creatureSprite(id, 0);
  return scaled(s.c, Math.max(1, Math.round(scale / s.k))).toDataURL();
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
