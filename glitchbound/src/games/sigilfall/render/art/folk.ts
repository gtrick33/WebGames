import { hash2 } from '../../core/math';
import type { NpcDef } from '../../data/types';
import { canvas, ctx2d, makeSprite, type Sprite } from '../pixel';
import { folkArt } from './atlas';

/**
 * The Royal Keep townsfolk for the people of the world and the humanoid foes it has a match for:
 * idle, walk and attack in four directions. Who wears which figure is picked from their role (the
 * title under their name), with a few people named outright, so a smith looks like a smith and two
 * innkeepers in two towns look alike. Recurring companions and story figures get their own figure
 * (see STORY_FOLK) and are never a recolored villager.
 */

export type FolkDir = 'down' | 'up' | 'right' | 'left';
export type FolkAnim = 'idle' | 'walk' | 'attack';

/** People named outright (story figures and companions first). */
const STORY_FOLK: Record<string, string> = {
  'elder-maren': 'elder',
  'mara-venn': 'guard',
  elyra: 'mage',
  'cael-varrow': 'knight',
  nyx: 'bandit',
  'brother-orren': 'monk',
  'regent-aldric': 'king',
};

/** Title words to a figure, first match wins. */
const ROLES: [RegExp, string][] = [
  [/regent|king|jarl|thane/i, 'king'],
  [/lady|queen/i, 'queen'],
  [/lord|noble|magister/i, 'noble'],
  [/captain|commander|marshal|sergeant/i, 'captain'],
  [/guard|watch|gate|warden|soldier|sigil-warden|quartermaster/i, 'guard'],
  [/knight/i, 'knight'],
  [/smith|armorer|forge|tinker|gemcutter|glasswright|shipwright|runecarver/i, 'blacksmith'],
  [/innkeeper|keeper of the|brewer|ferryman/i, 'innkeeper'],
  [/merchant|trader|peddler|dealer|curio|carter|harbormaster/i, 'merchant'],
  [/elder|reeve/i, 'elder'],
  [/priest|chaplain|healer|sister|brother|monk|sick|gravedigger/i, 'monk'],
  [/mystic|mage|wizard|scholar|shaman|herbwife/i, 'wizard'],
  [/hunt|ranger|scout|fletcher|huntress/i, 'ranger'],
  [/farmer|tanner|fisher|scavenger|foreman/i, 'farmer'],
  [/bard|lamplighter|sailor/i, 'bard'],
];
const COMMONERS = ['peasant_m', 'peasant_f', 'farmer', 'merchant', 'bard'];

export function folkFor(npc: NpcDef | undefined, id: string): string {
  if (STORY_FOLK[id]) return STORY_FOLK[id];
  if (npc) for (const [re, who] of ROLES) if (re.test(npc.title)) return who;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COMMONERS[Math.floor(hash2(h, 3, 7) * COMMONERS.length)]!;
}

/** Foes drawn as townsfolk figures: only where the pack has a true match. */
export const FOE_FOLK: Record<string, string> = {
  cutthroat: 'bandit',
  smuggler: 'bandit',
  enforcer: 'bandit',
  'dune-raider': 'bandit',
  hangman: 'bandit',
  skeleton: 'skeleton',
  'barrow-skeleton': 'skeleton',
  goblin: 'goblin',
  'death-knight-initiate': 'dark_knight',
  'death-knight-squire': 'dark_knight',
  'wight-knight': 'dark_knight',
  'hollow-guard': 'dark_knight',
  'hollow-guardsman': 'dark_knight',
  'oathsworn-guard': 'dark_knight',
};

/** The direction a figure faces for an angle (radians, 0 = east, y down). */
export function dirOf(a: number): FolkDir {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (Math.abs(c) >= Math.abs(s) * 0.9) return c >= 0 ? 'right' : 'left';
  return s > 0 ? 'down' : 'up';
}

const sprites = new Map<string, Sprite>();

/**
 * One frame of a figure as a sprite (with its hit-flash silhouette), cut from the folk sheet at art
 * resolution; null until the sheet has loaded. `t` is seconds (the animation runs at the pack's speed);
 * `once` holds the last frame instead of looping.
 */
export function folkSprite(who: string, anim: FolkAnim, dir: FolkDir, t: number, once = false): Sprite | null {
  const art = folkArt();
  if (!art) return null;
  const row = art.rows.indexOf(who);
  const a = art.anims[`${anim}_${dir}`];
  if (row < 0 || !a) return null;
  const frame = once ? Math.min(a.n - 1, Math.floor((t * 1000) / a.ms)) : Math.floor((t * 1000) / a.ms) % a.n;
  const key = `${who}:${anim}:${dir}:${frame}`;
  let s = sprites.get(key);
  if (!s) {
    const [cw, ch] = art.cell;
    const c = canvas(cw, ch);
    ctx2d(c).drawImage(art.img, (a.col + frame) * cw, row * ch, cw, ch, 0, 0, cw, ch);
    s = makeSprite(c, 2);
    sprites.set(key, s);
  }
  return s;
}

/** Where a figure's feet are in its cell (art pixels). */
export const FOLK_FEET: [number, number] = [24, 60];
