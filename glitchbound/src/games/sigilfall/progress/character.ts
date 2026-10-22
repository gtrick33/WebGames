import { CLASSES, MAX_LEVEL, xpToNext } from '../data/classes';
import { QUESTS, QUEST_DEFS } from '../data/quests';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENTS, talentNode } from '../data/talents';
import type { ClassId, Item, Objective, PerkId, QuestDef, RegionId, SlotId } from '../data/types';
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

/** Bag slots, with the Satchel from Thornvale's story. */
export const bagSize = (c: Pick<Character, 'perks'>): number => BAG_SIZE + (c.perks.includes('satchel') ? 6 : 0);
/** Potions carried at most, with the Flask. */
export const potionCap = (c: Pick<Character, 'perks'>): number => POTION_CAP + (c.perks.includes('flask') ? 1 : 0);

/** The lasting gifts at the ends of quest chains, and what each does. */
export const PERKS: Record<PerkId, { name: string; text: string }> = {
  satchel: { name: 'Millbrook Satchel', text: '6 more bag slots' },
  flask: { name: 'Tobin’s Flask', text: 'carry one more potion' },
  mount: { name: 'Gullport Strider', text: 'move 30% faster outside fights' },
  hearth: { name: 'Hearthstone', text: 'return to the last waystone from anywhere' },
};

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
  /** The chosen specialization (a talent tree, 0-2), from level 10; null before choosing. */
  spec: 0 | 1 | 2 | null;
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
  /** Gifts from the ends of quest chains (a bigger bag, a mount...). */
  perks: PerkId[];
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
    spec: null,
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
    perks: [],
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

/** Skills the hero has learned by level, and their specialization's (the pool for slots 1-3). */
export function learnedSkills(c: Character): string[] {
  const def = CLASSES[c.cls];
  const pool = def.skills.filter((id) => (SKILLS[id]?.unlock ?? 99) <= c.level);
  // a shape's specialization ability (the druid's Rip, Ironfur) lives on that shape's bar instead
  if (c.spec !== null && c.level >= SPEC_LEVEL && !def.trees[c.spec].formOnly) pool.push(def.trees[c.spec].skill);
  return pool;
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

/** One point per level from level 10 (when a specialization is chosen): 51 at level 60. */
export const talentPoints = (c: Character): number => Math.max(0, c.level - SPEC_LEVEL + 1);
export const spentPoints = (c: Character): number => Object.values(c.talents).reduce((a, b) => a + b, 0);
export const freePoints = (c: Character): number => talentPoints(c) - spentPoints(c);
export const pointsInTree = (c: Character, tree: 0 | 1 | 2): number => TALENTS[c.cls].filter((n) => n.tree === tree).reduce((a, n) => a + (c.talents[n.id] ?? 0), 0);

/** Whether a tree takes points yet: the specialization's at once, the other two after 31 points in it. */
export function treeOpen(c: Character, tree: 0 | 1 | 2): boolean {
  if (c.spec === null) return false;
  return tree === c.spec || pointsInTree(c, c.spec) >= SPEC_FOCUS;
}

/** Why a talent can't take another point, or null if it can. */
export function cantLearn(c: Character, id: string): string | null {
  const node = talentNode(c.cls, id);
  if (!node) return 'Unknown talent.';
  const rank = c.talents[id] ?? 0;
  if (rank >= node.ranks) return 'Already at full rank.';
  const trees = CLASSES[c.cls].trees;
  if (c.spec === null) return c.level < SPEC_LEVEL ? `Talents open at level ${SPEC_LEVEL}, with your specialization.` : 'Choose a specialization first.';
  if (!treeOpen(c, node.tree)) return `Spend ${SPEC_FOCUS} points in ${trees[c.spec].name} first.`;
  if (freePoints(c) <= 0) return 'No talent points left. You get one every level.';
  const need = node.row * ROW_COST;
  if (pointsInTree(c, node.tree) < need) return `Needs ${need} points in ${trees[node.tree].name} first.`;
  if (node.requires && !(c.talents[node.requires] ?? 0)) return `Needs ${talentNode(c.cls, node.requires)?.name ?? 'another talent'} first.`;
  return null;
}

/** What choosing a specialization costs now (the first choice is free; changing resets talents). */
export const specCost = (c: Character): number => (c.spec === null ? 0 : respecCost(c));

/** Why the hero can't take this specialization, or null. */
export function cantSpec(c: Character, tree: 0 | 1 | 2): string | null {
  if (c.level < SPEC_LEVEL) return `Specializations open at level ${SPEC_LEVEL}.`;
  if (c.spec === tree) return 'This is your specialization.';
  if (c.gold < specCost(c)) return `Changing costs ${specCost(c)} gold.`;
  return null;
}

/** Takes a specialization and puts its ability on the bar. Changing it resets talents and takes the old one's ability off. */
export function chooseSpec(c: Character, tree: 0 | 1 | 2): boolean {
  if (cantSpec(c, tree)) return false;
  const def = CLASSES[c.cls];
  if (c.spec !== null) {
    c.gold -= specCost(c);
    c.talents = {};
    const old = def.trees[c.spec].skill;
    c.skills = c.skills.map((id) => (id === old ? null : id)) as Character['skills'];
  }
  c.spec = tree;
  autoSlotSkills(c);
  // the specialization's ability goes on the bar even when it is full (in the last slot; what was there
  // stays learned and can go back from the Skills screen)
  const skill = def.trees[tree].skill;
  if (!def.trees[tree].formOnly && !c.skills.includes(skill)) c.skills[2] = skill;
  return true;
}

export function learnTalent(c: Character, id: string): boolean {
  if (cantLearn(c, id)) return false;
  c.talents[id] = (c.talents[id] ?? 0) + 1;
  return true;
}

/** Resetting talents is free up to level 15, then costs a little gold per level. */
export const respecCost = (c: Character): number => (c.level < 15 ? 0 : c.level * 25);

export function respec(c: Character): boolean {
  const cost = respecCost(c);
  if (c.gold < cost || spentPoints(c) === 0) return false;
  c.gold -= cost;
  c.talents = {};
  return true;
}

/* ------------------------------------------------------------- equipment */

export const bagFull = (c: Character): boolean => c.bag.length >= bagSize(c);

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

/**
 * Starts every quest whose prerequisites are done, once the hero has been to its zone and is of its
 * level. Returns the quests that just started.
 */
export function startQuests(c: Character): QuestDef[] {
  const started: QuestDef[] = [];
  for (const q of QUESTS) {
    if (c.quests[q.id]) continue;
    if (q.zone && !c.unlocked.includes(q.zone)) continue;
    if (q.level && c.level < q.level) continue;
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
  const of = o.kind === 'kill' || o.kind === 'tutorial' || o.kind === 'collect' || o.kind === 'loot' ? o.count : 1;
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

/** Where a quest is done (its objective's region, else its zone). */
export function questRegion(q: QuestDef): RegionId | undefined {
  const o = q.objective;
  if (o.kind === 'kill' || o.kind === 'loot' || o.kind === 'clear') return o.region;
  return q.zone;
}

/**
 * The quest to point at: the first active one done where the hero is now, else the first active one
 * (the story comes first in the list).
 */
export function trackedQuest(c: Character, here?: RegionId): QuestDef | undefined {
  const list = activeQuests(c);
  return (here && list.find((q) => questRegion(q) === here)) || list[0];
}
