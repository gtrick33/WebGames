import { CLASSES, MAX_LEVEL, xpToNext } from '../data/classes';
import { QUESTS, QUEST_DEFS } from '../data/quests';
import { SKILLS } from '../data/skills';
import { ROW_COST, TALENTS, talentNode } from '../data/talents';
import type { ClassId, Item, Objective, QuestDef, RegionId, SlotId } from '../data/types';
import { itemClass, itemSlot, salvageValue } from './items';

/**
 * A hero and everything that persists about them, plus the rules that change it: experience and
 * levels, talents, skills on the bar, equipment and the bag, quests. The engine owns one Character
 * and calls these; the UI reads it. Every rule lives here, never in a component.
 */

export const BAG_SIZE = 30;
/** Loot collected for you when you leave (or win) may overfill the bag by this much. */
export const BAG_OVERFLOW = 10;
/** Potions carried at most; they are bought at the inn (and a new hero starts with a few). */
export const POTION_CAP = 5;
export const START_POTIONS = 3;

export type QuestState = 'locked' | 'active' | 'done';

export interface Character {
  id: string;
  name: string;
  cls: ClassId;
  level: number;
  xp: number;
  gold: number;
  shards: number;
  /** Sigil Marks: paid by bosses, spent at the quartermaster. */
  marks: number;
  /** How many times the shops have restocked, and what was bought since (by item id). */
  restock: number;
  sold: string[];
  talents: Record<string, number>;
  /** Skills in slots 1-3 (null = empty). */
  skills: [string | null, string | null, string | null];
  equip: Partial<Record<SlotId, Item>>;
  bag: Item[];
  potions: number;
  quests: Record<string, { state: 'active' | 'done'; n: number }>;
  unlocked: RegionId[];
  /** Highest difficulty tier open (0 Normal, 1 Heroic, 2 Mythic). */
  tier: number;
  bosses: Record<string, number>;
  /** Region clears by "region:tier". */
  clears: Record<string, number>;
  /** One-time things done: once-only chests, discovered spots. */
  opened: string[];
  stats: { kills: number; deaths: number; time: number; runs: number; bestRun: number };
  created: number;
  updated: number;
}

export function newCharacter(cls: ClassId, name: string, id: string, now = Date.now()): Character {
  const def = CLASSES[cls];
  const c: Character = {
    id,
    name: cleanName(name) || def.name,
    cls,
    level: 1,
    xp: 0,
    gold: 0,
    shards: 0,
    marks: 0,
    restock: 0,
    sold: [],
    talents: {},
    skills: [...def.start],
    equip: {},
    bag: [],
    potions: START_POTIONS,
    quests: {},
    unlocked: ['emberwick'],
    tier: 0,
    bosses: {},
    clears: {},
    opened: [],
    stats: { kills: 0, deaths: 0, time: 0, runs: 0, bestRun: 0 },
    created: now,
    updated: now,
  };
  startQuests(c);
  return c;
}

export const cleanName = (s: string): string =>
  [...s]
    .filter((ch) => /[\p{L}\p{N} '\-_.]/u.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);

/* ------------------------------------------------------------- experience */

/** Adds experience; returns the levels reached (empty if none). */
export function addXp(c: Character, n: number): number[] {
  const reached: number[] = [];
  if (c.level >= MAX_LEVEL) return reached;
  c.xp += Math.max(0, Math.round(n));
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    reached.push(c.level);
    autoSlotSkills(c);
  }
  if (c.level >= MAX_LEVEL) c.xp = 0;
  return reached;
}

/** Skills the hero has learned by level (the pool for slots 1-3). */
export function learnedSkills(c: Character): string[] {
  return CLASSES[c.cls].skills.filter((id) => (SKILLS[id]?.unlock ?? 99) <= c.level);
}

export const hasUltimate = (c: Character): boolean => (SKILLS[CLASSES[c.cls].ult]?.unlock ?? 99) <= c.level;

/** New skills go into an empty slot by themselves, so a new player never has to visit a menu to use them. */
function autoSlotSkills(c: Character): void {
  for (const id of learnedSkills(c)) {
    if (c.skills.includes(id)) continue;
    const free = c.skills.indexOf(null);
    if (free >= 0) c.skills[free] = id;
  }
}

/** Puts a skill in a slot; if it was in another slot, the two swap. */
export function setSkill(c: Character, slot: 0 | 1 | 2, id: string | null): boolean {
  if (id !== null && !learnedSkills(c).includes(id)) return false;
  const other = id === null ? -1 : c.skills.indexOf(id);
  if (other >= 0) c.skills[other] = c.skills[slot];
  c.skills[slot] = id;
  return true;
}

/* ---------------------------------------------------------------- talents */

export const talentPoints = (c: Character): number => Math.max(0, c.level - 1);
export const spentPoints = (c: Character): number => Object.values(c.talents).reduce((a, b) => a + b, 0);
export const freePoints = (c: Character): number => talentPoints(c) - spentPoints(c);
export const pointsInTree = (c: Character, tree: 0 | 1): number => TALENTS[c.cls].filter((n) => n.tree === tree).reduce((a, n) => a + (c.talents[n.id] ?? 0), 0);

/** Why a talent can't take another point, or null if it can. */
export function cantLearn(c: Character, id: string): string | null {
  const node = talentNode(c.cls, id);
  if (!node) return 'Unknown talent.';
  const rank = c.talents[id] ?? 0;
  if (rank >= node.ranks) return 'Already at full rank.';
  if (freePoints(c) <= 0) return 'No talent points left. You get one every level.';
  const need = node.row * ROW_COST;
  if (pointsInTree(c, node.tree) < need) return `Needs ${need} points in ${CLASSES[c.cls].trees[node.tree].name} first.`;
  if (node.requires && !(c.talents[node.requires] ?? 0)) return `Needs ${talentNode(c.cls, node.requires)?.name ?? 'another talent'} first.`;
  return null;
}

export function learnTalent(c: Character, id: string): boolean {
  if (cantLearn(c, id)) return false;
  c.talents[id] = (c.talents[id] ?? 0) + 1;
  return true;
}

/** Resetting talents is free up to level 5, then costs a little gold per level. */
export const respecCost = (c: Character): number => (c.level < 5 ? 0 : c.level * 25);

export function respec(c: Character): boolean {
  const cost = respecCost(c);
  if (c.gold < cost || spentPoints(c) === 0) return false;
  c.gold -= cost;
  c.talents = {};
  return true;
}

/* ------------------------------------------------------------- equipment */

export const bagFull = (c: Character): boolean => c.bag.length >= BAG_SIZE;

/** Adds an item to the bag; false when the bag is full. */
export function addItem(c: Character, item: Item): boolean {
  if (bagFull(c)) return false;
  if (allItems(c).some((i) => i.uid === item.uid)) return false;
  c.bag.push(item);
  return true;
}

export const allItems = (c: Character): Item[] => [...Object.values(c.equip).filter((i): i is Item => !!i), ...c.bag];

/** Why an item from the bag can't be worn, or null. */
export function cantEquip(c: Character, item: Item): string | null {
  const cls = itemClass(item);
  if (cls && cls !== c.cls) return `Only a ${CLASSES[cls].name} can use this.`;
  return null;
}

/** Wears a bag item; whatever was in that slot goes back into the bag in its place. */
export function equip(c: Character, uid: string): boolean {
  const i = c.bag.findIndex((x) => x.uid === uid);
  if (i < 0) return false;
  const item = c.bag[i]!;
  if (cantEquip(c, item)) return false;
  const slot = itemSlot(item);
  const old = c.equip[slot];
  delete item.fresh;
  c.equip[slot] = item;
  if (old) c.bag[i] = old;
  else c.bag.splice(i, 1);
  return true;
}

export function unequip(c: Character, slot: SlotId): boolean {
  const item = c.equip[slot];
  if (!item || bagFull(c)) return false;
  delete c.equip[slot];
  c.bag.push(item);
  return true;
}

/** Melts a bag item down for gold (worn items can't be salvaged). */
export function salvage(c: Character, uid: string): number {
  const i = c.bag.findIndex((x) => x.uid === uid);
  if (i < 0) return 0;
  const value = salvageValue(c.bag[i]!);
  c.bag.splice(i, 1);
  c.gold += value;
  return value;
}

/* ----------------------------------------------------------------- quests */

export function questState(c: Character, id: string): QuestState {
  const q = c.quests[id];
  return q ? q.state : 'locked';
}

/** Starts every quest whose prerequisites are done. Returns the quests that just started. */
export function startQuests(c: Character): QuestDef[] {
  const started: QuestDef[] = [];
  for (const q of QUESTS) {
    if (c.quests[q.id]) continue;
    if ((q.after ?? []).every((id) => questState(c, id) === 'done')) {
      c.quests[q.id] = { state: 'active', n: 0 };
      started.push(q);
    }
  }
  return started;
}

export const activeQuests = (c: Character): QuestDef[] => QUESTS.filter((q) => questState(c, q.id) === 'active');

/** How far along a quest is, and its goal. */
export function questProgress(c: Character, q: QuestDef): { n: number; of: number } {
  const n = c.quests[q.id]?.n ?? 0;
  const o = q.objective;
  const of = o.kind === 'kill' || o.kind === 'tutorial' || o.kind === 'collect' ? o.count : 1;
  return { n: Math.min(n, of), of };
}

/** Something happened that quests may count. Returns the quests it completed (rewards are the caller's job). */
export function questEvent(c: Character, match: (o: Objective) => boolean, amount = 1): QuestDef[] {
  const done: QuestDef[] = [];
  for (const q of activeQuests(c)) {
    if (!match(q.objective)) continue;
    const entry = c.quests[q.id]!;
    entry.n += amount;
    const { of } = questProgress(c, q);
    if (entry.n >= of) {
      entry.state = 'done';
      entry.n = of;
      done.push(q);
    }
  }
  return done;
}

export const questDef = (id: string): QuestDef | undefined => QUEST_DEFS[id];

/** The objective to point at: the first active quest, story first. */
export const trackedQuest = (c: Character): QuestDef | undefined => activeQuests(c)[0];
