import { CLASS_IDS, MAX_LEVEL, xpToNext } from '../data/classes';
import { ITEM_DEFS } from '../data/items';
import { KEY_MIN } from '../data/keystones';
import { MOUNT_DEFS } from '../data/mounts';
import { QUEST_DEFS } from '../data/quests';
import { REGIONS } from '../data/regions';
import { SPEC_LEVEL } from '../data/talents';
import { RARITIES, SLOTS, type ClassId, type PerkId, type Rarity, type RegionId, type SlotId } from '../data/types';
import { addXp, autoSlotSkills, cleanName, giveReward, learnedSkills, PERKS, potionCap, spentPoints, talentPoints, type Character } from './character';
import { makeItem, rollGear } from './items';
import { BASE_HERO_SLOTS, validateCharacter, type SaveFile } from './save';
import { lookOf } from './wardrobe';

/**
 * What a Game Master (Admin › Sigilfall) can ask the game to do to a hero. The admin only ever files an order on the
 * server; the player's own game carries it out the next time it looks (engine.ts checkGm), against the save it's
 * actually holding, and reports back. That way an order can't be lost to a device that was playing at the time, the
 * way an edit to the server's copy would be, and the game's own rules apply.
 *
 * Everything here checks its input again: an order is data from a server, and a save must never be broken by one.
 */
export interface GmOrder {
  id: string;
  /** The hero's slot and when it was made (a slot can hold another hero by the time this is carried out). */
  slot: number;
  created: number;
  kind: string;
  payload: Record<string, unknown>;
}

const num = (v: unknown, dflt = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v)));
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** How many order ids a hero remembers, so an order reported badly is never carried out twice. */
const REMEMBER = 40;

/** A level, up or down. Going up pays nothing but the levels; going down gives back talents that no longer fit. */
function setLevel(c: Character, to: number): void {
  const level = clamp(to, 1, MAX_LEVEL);
  if (level > c.level) {
    for (let guard = 0; c.level < level && guard < MAX_LEVEL + 1; guard++) addXp(c, xpToNext(c.level));
    return;
  }
  c.level = level;
  c.xp = 0;
  if (spentPoints(c) > talentPoints(c)) {
    c.talents = {};
    c.freeRespec = true;
  }
  if (level < SPEC_LEVEL) c.spec = null;
  const known = learnedSkills(c);
  c.skills = c.skills.map((s) => (s && known.includes(s) ? s : null)) as Character['skills'];
  autoSlotSkills(c);
}

function setQuest(c: Character, id: string, state: string): string {
  const q = QUEST_DEFS[id];
  if (!q) return 'No such quest.';
  if (state === 'reset') {
    delete c.quests[id];
    return '';
  }
  if (state === 'active') {
    for (const a of q.after ?? []) if (c.quests[a]?.state !== 'done') setQuest(c, a, 'done');
    c.quests[id] = { state: 'active', n: 0 };
    return '';
  }
  if (state !== 'done') return 'Unknown quest state.';
  if (c.quests[id]?.state === 'done') return '';
  for (const a of q.after ?? []) setQuest(c, a, 'done');
  c.quests[id] = { state: 'done', n: 0 };
  // the story's own gifts that hang on this quest, which nothing else would pay now
  if (q.reward?.tier !== undefined) c.tier = Math.max(c.tier, q.reward.tier);
  if (q.reward?.keystone) c.keystone = Math.max(c.keystone, q.reward.keystone);
  return '';
}

/** Carries out one order on one hero: '' when done, or why it couldn't be. */
export function applyToHero(c: Character, kind: string, p: Record<string, unknown>, r: () => number = Math.random): string {
  switch (kind) {
    case 'gold':
      c.gold = clamp(c.gold + num(p.amount), 0, 1e9);
      return '';
    case 'shards':
      c.shards = clamp(c.shards + num(p.amount), 0, 99);
      return '';
    case 'marks':
      c.marks = clamp(c.marks + num(p.amount), 0, 1e6);
      return '';
    case 'potions':
      c.potions = clamp(c.potions + num(p.amount), 0, potionCap(c));
      return '';
    case 'level':
      setLevel(c, num(p.level, c.level));
      return '';
    case 'item': {
      const def = ITEM_DEFS[text(p.id)];
      if (!def) return 'No such item.';
      const item = makeItem(def.id, clamp(num(p.il, def.minLevel), 1, 200), r);
      if (!item) return 'No such item.';
      return giveReward(c, item) === 'sold' ? 'No room in the hero’s bag.' : '';
    }
    case 'gear': {
      const rarity = text(p.rarity) as Rarity;
      const slot = text(p.slot) as SlotId;
      if (!RARITIES.includes(rarity)) return 'Unknown rarity.';
      if (!SLOTS.includes(slot)) return 'Unknown slot.';
      const item = rollGear(c.cls, clamp(num(p.il, c.level), 1, 200), rarity, r, slot);
      return giveReward(c, item) === 'sold' ? 'No room in the hero’s bag.' : '';
    }
    case 'removeItem': {
      const uid = text(p.uid);
      const inBag = c.bag.findIndex((i) => i.uid === uid);
      if (inBag >= 0) {
        c.bag.splice(inBag, 1);
        return '';
      }
      const held = c.held?.findIndex((i) => i.uid === uid) ?? -1;
      if (held >= 0) {
        c.held!.splice(held, 1);
        return '';
      }
      for (const s of SLOTS) {
        if (c.equip[s]?.uid === uid) {
          delete c.equip[s];
          return '';
        }
      }
      return 'The hero no longer has that item.';
    }
    case 'quest':
      return setQuest(c, text(p.id), text(p.state));
    case 'unlock': {
      const id = text(p.id) as RegionId;
      if (!REGIONS[id]) return 'No such land.';
      if (!c.unlocked.includes(id)) c.unlocked.push(id);
      return '';
    }
    case 'tier':
      c.tier = clamp(num(p.tier), 0, 2);
      return '';
    case 'keystone':
      c.keystone = clamp(num(p.level), 0, 999);
      if (c.keystone > 0) c.keystone = Math.max(KEY_MIN, c.keystone);
      return '';
    case 'respec':
      c.freeRespec = true;
      return '';
    case 'mount': {
      const id = text(p.id);
      if (!MOUNT_DEFS[id]) return 'No such mount.';
      if (!c.mounts.includes(id)) c.mounts.push(id);
      return '';
    }
    case 'look': {
      const id = text(p.id);
      if (!lookOf(id)) return 'No such look.';
      if (!c.looks.includes(id)) c.looks.push(id);
      return '';
    }
    case 'perk': {
      const id = text(p.id) as PerkId;
      if (!(id in PERKS)) return 'No such gift.';
      if (!c.perks.includes(id)) c.perks.push(id);
      return '';
    }
    case 'rename': {
      const name = cleanName(text(p.name));
      if (!name) return 'That name isn’t usable.';
      c.name = name;
      return '';
    }
    default:
      return 'This game doesn’t know that order yet.';
  }
}

/** The hero an order is for: in its slot if it's still there, wherever it has moved to otherwise. */
export function heroFor(save: SaveFile, o: Pick<GmOrder, 'slot' | 'created'>): Character | null {
  const at = save.heroes[o.slot];
  if (at && at.created === o.created) return at;
  return save.heroes.find((h) => h && h.created === o.created) ?? null;
}

/**
 * Carries out one order on a save (`live`: the hero being played right now, who is the same hero as their slot's copy
 * once the game next saves, so they're the one changed). '' when done, or why not. A restored hero takes a free slot
 * among the `slots` the player plays (three, or five with the Gloamknight Pack: progress/paidClasses.ts heroSlots).
 */
export function applyOrder(save: SaveFile, o: GmOrder, live?: Character | null, r: () => number = Math.random, slots = BASE_HERO_SLOTS): string {
  if (o.kind === 'restore') {
    const raw = o.payload.hero as { created?: unknown } | undefined;
    if (save.heroes.some((h) => h && raw && h.created === raw.created)) return '';
    // (never into a place the player can't see)
    const slot = save.heroes.slice(0, slots).findIndex((h) => !h);
    if (slot < 0) return 'No free hero slot: the player has to make room first.';
    const hero = validateCharacter(raw, slot);
    if (!hero) return 'That hero’s copy can’t be read.';
    save.heroes[slot] = hero;
    return '';
  }
  const stored = heroFor(save, o);
  const hero = live && live.created === o.created ? live : stored;
  if (!hero) return 'The hero is gone.';
  if (hero.gm?.includes(o.id)) return '';
  const why = applyToHero(hero, o.kind, o.payload, r);
  if (!why) hero.gm = [...(hero.gm ?? []), o.id].slice(-REMEMBER);
  return why;
}

/** What the player is told, in the game, when an order reaches them (nothing for quiet fix-ups). */
export function orderToast(o: GmOrder): string {
  const p = o.payload;
  const amount = (word: string): string => {
    const n = num(p.amount);
    return n >= 0 ? `A Game Master gave you ${n.toLocaleString('en-US')} ${word}.` : `A Game Master took ${(-n).toLocaleString('en-US')} ${word}.`;
  };
  switch (o.kind) {
    case 'gold':
      return amount('gold');
    case 'shards':
      return amount('shards');
    case 'marks':
      return amount('Sigil Marks');
    case 'potions':
      return amount('potions');
    case 'item':
    case 'gear':
      return 'A Game Master left something in your bag.';
    case 'level':
      return `A Game Master set your level to ${clamp(num(p.level), 1, MAX_LEVEL)}.`;
    case 'quest':
      return 'A Game Master fixed one of your quests.';
    case 'unlock':
      return 'A Game Master opened a new land for you.';
    case 'respec':
      return 'A Game Master gave you a free talent reset.';
    case 'mount':
      return 'A Game Master gave you a mount. It’s in your stable.';
    case 'rename':
      return `A Game Master renamed your hero ${cleanName(text(p.name))}.`;
    case 'restore':
      return 'A Game Master brought one of your heroes back.';
    default:
      return '';
  }
}

export const isClass = (v: unknown): v is ClassId => CLASS_IDS.includes(v as ClassId);
