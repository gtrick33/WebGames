import { CLASSES, MAX_LEVEL, xpToNext } from '../data/classes';
import { QUESTS, QUEST_DEFS } from '../data/quests';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENTS, talentNode } from '../data/talents';
import type { ClassId, Item, Objective, PerkId, QuestDef, RegionId, SigilId, SkillIndex, SlotId, TalentNode } from '../data/types';
import { itemClass, itemSlot, salvageValue } from './items';
import { learnLooks, type LookSlot } from './wardrobe';
import { isMainQuest, questSteps, turnInNpc } from './handin';
import { newParagon, type Paragon } from './paragon';
import type { RiftSeason } from './season';

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
  mount: { name: 'Millbrook Cob', text: 'a horse to ride outside fights (30% faster)' },
  hearth: { name: 'Homestone', text: 'return to the last waystone from anywhere' },
  'sigil-embers': { name: 'Sigil of Embers', text: '+4% health and power' },
  'sigil-tides': { name: 'Sigil of Tides', text: '+4% health and power' },
  'sigil-stone': { name: 'Sigil of Stone', text: '+4% health and power' },
  'sigil-sun': { name: 'Sigil of the Sun', text: '+4% health and power' },
  'sigil-frost': { name: 'Sigil of Frost', text: '+4% health and power' },
  'sigil-thorns': { name: 'Sigil of Thorns', text: '+4% health and power' },
  'sigil-veil': { name: 'Sigil of the Veil', text: '+4% health and power' },
};

/** The seven sigils, in the order the story wins them. */
export const SIGILS: SigilId[] = ['sigil-embers', 'sigil-tides', 'sigil-stone', 'sigil-sun', 'sigil-frost', 'sigil-thorns', 'sigil-veil'];

/** The sigils won so far (Duskspire's last door opens only for all seven). */
export const sigilCount = (c: Pick<Character, 'perks'>): number => c.perks.filter((p) => p.startsWith('sigil-')).length;
/** Health and power each sigil adds, in percent. */
export const SIGIL_BONUS = 4;

/** ready: the work is done, waiting to be handed in (progress/handin.ts). */
export type QuestState = 'locked' | 'offered' | 'active' | 'ready' | 'done';

/** Where every hero starts and returns: Briarhollow, the village of the Prologue and the resistance camp after it. */
export const HOME = 'briarhollow' as const;

/**
 * How far into a dungeon a hero has come (World.dungeonMark): the rooms they cleared (by their ids), the packs they
 * wiped (by their places on the map), where their last checkpoint stands, and the way home if it is open. Kept with
 * Character.at, so a reload doesn't send them back to the dungeon's door.
 */
export interface DungeonMark {
  rooms?: string[];
  packs?: number[];
  cp?: [number, number];
  portal?: [number, number];
}

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
  /** One free respec owed (the talents were rebalanced after the hero chose them). */
  freeRespec?: boolean;
  /** Skills in slots 1-3 (null = empty). */
  skills: [string | null, string | null, string | null, string | null];
  equip: Partial<Record<SlotId, Item>>;
  bag: Item[];
  /** Quest rewards waiting for room in the bag (one earned with the bag and its overflow full): they come in by themselves. */
  held?: Item[];
  potions: number;
  quests: Record<string, { state: 'offered' | 'active' | 'ready' | 'done'; n: number; step?: number }>;
  /** The quest the hero follows (the arrow and the tracker show it first). */
  tracked?: string;
  unlocked: RegionId[];
  /** Highest difficulty tier open (0 Normal, 1 Heroic, 2 Mythic). */
  tier: number;
  bosses: Record<string, number>;
  /** Region clears by "region:tier". */
  clears: Record<string, number>;
  /** The Riftstone's Riftstone level (0 before the hero earns one; data/keystones.ts). */
  keystone: number;
  /** The highest stone finished in time, by dungeon. */
  bestKeys: Record<string, number>;
  /**
   * The stone open in each dungeon: a run beaten in time opens the levels above it there, and there only (the owner,
   * 2026-11-22: "if i reach rank 9 at the first dungeon, i shouldnt be able to start rank 9 on the second one").
   * `keystone` stays the deepest opened anywhere, for what the stone rewards (titles, mounts, the broker's odds).
   */
  stones: Record<string, number>;
  /** This Rift season's part (progress/season.ts): the Season Heart, the season's best stone, the Journey. */
  rseason?: RiftSeason;
  /** The Rift seasons' titles earned (each season's Journey gives its own), kept for good. */
  rtitles?: string[];
  /** Paragon levels past 60 and their points (progress/paragon.ts). */
  para: Paragon;
  /** One-time things done: once-only chests, discovered spots. */
  opened: string[];
  /** Gifts from the ends of quest chains (a bigger bag, a mount...). */
  perks: PerkId[];
  /** The Wardrobe (blueprint §6.2): looks owned for good (progress/wardrobe.ts), and those worn over gear by slot. */
  looks: string[];
  worn: Partial<Record<LookSlot, string>>;
  /** Has been jumped to a story beat with a review preset (progress/presets.ts): sends no arcade scores. */
  review?: boolean;
  /** Game masters' orders already carried out on this hero (progress/gm.ts), so none happens twice. */
  gm?: string[];
  /** Man or woman, chosen at the start (the hero's face and hair; nothing else changes). */
  body: Body;
  /** Skin, hair and beard, chosen at the start: only how the hero looks. */
  face?: Face;
  /** Fog of war: each land's explored parts (progress/fog.ts). */
  /**
   * Where the hero is: the land, town or dungeon they last walked into (its difficulty, and the land they came from,
   * so they stand at the same gate). Kept each time they travel, so a hero who quits or is cut off comes back there
   * and not at Briarhollow's gate (the owner: "in case we disconnect or quit and have to log in once again, the
   * character should be in the respective zone"). A dungeon is come back to as it was left (POLISH_PLAN.md piece 3):
   * the rooms cleared stay clear, the packs wiped stay gone, and the hero stands at the last checkpoint, with the way
   * home open if its last boss is down (`DungeonMark`). Not kept for a Riftstone run (its clock can't be picked up)
   * nor a party's run (it is the party's, not the hero's).
   */
  at?: { region: RegionId; tier?: number; from?: RegionId } & DungeonMark;
  seen: Partial<Record<RegionId, string>>;
  /** Mounts owned for good, and the one the mount key summons. */
  mounts: string[];
  mount: string | null;
  /**
   * A mount and looks from the site's shop chosen over the hero's own (progress/shopGoods.ts). Only the choice is kept:
   * whether the account owns them is asked each time, so they show only while the purchase stands.
   */
  shopMount?: string;
  shopWorn?: Partial<Record<LookSlot, string>>;
  stats: { kills: number; deaths: number; time: number; runs: number; bestRun: number };
  /** The title worn (a progress/titles.ts id; '' for none on purpose; unset: the warden's, once earned). */
  title?: string;
  created: number;
  updated: number;
}

export type Body = 'm' | 'f';

/** How a hero looks under their gear: indexes into SKINS and HAIRS. */
export interface Face {
  skin: number;
  hair: number;
  style: 'short' | 'pony' | 'long';
  beard: boolean;
}

export const SKINS = ['#ffe0c8', '#f6cfae', '#e8b78e', '#c98f62', '#9a6642', '#6e4530', '#4a2f22', '#b9c8c4'];
export const HAIRS = ['#1c1a20', '#3a2616', '#6a4428', '#a8682c', '#d8b060', '#e8e0d0', '#8a8a94', '#a8262e', '#3a5ad8', '#3a8a5a'];

export function newCharacter(cls: ClassId, name: string, id: string, now = Date.now(), body: Body = 'm'): Character {
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
    skills: [...def.start, null],
    equip: {},
    bag: [],
    potions: START_POTIONS,
    quests: {},
    unlocked: [HOME],
    tier: 0,
    bosses: {},
    clears: {},
    keystone: 0,
    bestKeys: {},
    stones: {},
    para: newParagon(),
    opened: [],
    perks: [],
    looks: [],
    worn: {},
    body,
    seen: {},
    mounts: [],
    mount: null,
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
export function addXp(c: Character, n: number, past?: (rest: number) => void): number[] {
  const reached: number[] = [];
  if (c.level >= MAX_LEVEL) return reached;
  c.xp += Math.max(0, Math.round(n));
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    reached.push(c.level);
    // a skill of the specialization's own just learned (or a slot just open) goes on the bar before anything else
    const fresh = (SLOT_LEVELS as readonly number[]).includes(c.level) ? undefined : CLASSES[c.cls].skills.filter((id) => SKILLS[id]?.unlock === c.level);
    seatSpecBar(c, fresh);
    autoSlotSkills(c);
  }
  if (c.level >= MAX_LEVEL) {
    // what carries past the cap goes on (to Paragon: sim/world.ts giveXp) rather than away
    if (c.xp > 0) past?.(c.xp);
    c.xp = 0;
  }
  return reached;
}

/** Skills the hero has learned by level, and their specialization's (the pool for slots 1-3). */
export function learnedSkills(c: Character): string[] {
  const def = CLASSES[c.cls];
  const pool = def.skills.filter((id) => (SKILLS[id]?.unlock ?? 99) <= c.level);
  // a shape's specialization ability (the druid's Rip, Ironpelt) lives on that shape's bar instead
  if (c.spec !== null && c.level >= SPEC_LEVEL && !def.trees[c.spec].formOnly) pool.push(def.trees[c.spec].skill);
  return pool;
}

export const hasUltimate = (c: Character): boolean => (SKILLS[CLASSES[c.cls].ult]?.unlock ?? 99) <= c.level;

/** New skills go into an empty slot by themselves, so a new player never has to visit a menu to use them. */
/**
 * The level each skill slot opens at (Q, E, R and the fourth): the bar grows with the hero, not all at once. The second
 * opens with the second skill (it was level 5: a new hero fought the night and the crypt with one skill, told at level 2
 * that the new one "waits in your skills"), so the first choice of what to carry comes at level 4, with a third skill and
 * two places for it.
 */
export const SLOT_LEVELS = [1, 2, 6, 12] as const;
/** The levels the slots opened at before (a save from then gets the slots that have opened since filled on load). */
export const OLD_SLOT_LEVELS = [1, 5, 10, 15] as const;
export const slotOpen = (c: Character, slot: SkillIndex): boolean => c.level >= SLOT_LEVELS[slot];
/** The level a bar slot opens at (0 for the ones always there). */
export const slotLevel = (slot: string): number => ({ s1: SLOT_LEVELS[0], s2: SLOT_LEVELS[1], s3: SLOT_LEVELS[2], s4: SLOT_LEVELS[3] })[slot] ?? 0;

export function autoSlotSkills(c: Character): void {
  // a shape that belongs to another specialization (a Balance druid's Lynx Shape) stays learned, off the bar
  const forms = CLASSES[c.cls].forms ?? [];
  const offSpec = (id: string): boolean => c.spec !== null && forms.some((f) => f.skill === id && f.specSwap !== undefined && f.specSwap.tree !== c.spec);
  for (const id of learnedSkills(c)) {
    if (c.skills.includes(id) || offSpec(id)) continue;
    const free = c.skills.findIndex((s, i) => s === null && slotOpen(c, i as SkillIndex));
    if (free >= 0) c.skills[free] = id;
  }
}

/** Puts a skill in a slot; if it was in another slot, the two swap. */
export function setSkill(c: Character, slot: SkillIndex, id: string | null): boolean {
  if (id !== null && !learnedSkills(c).includes(id)) return false;
  if (id !== null && !slotOpen(c, slot)) return false;
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
  const chosen = pickTaken(c, node);
  if (chosen) return `You chose ${chosen.name} here: one of the three. Choose this instead to switch, for free.`;
  if (freePoints(c) <= 0) return 'No talent points left. You get one every level.';
  const need = node.row * ROW_COST;
  if (pointsInTree(c, node.tree) < need) return `Needs ${need} points in ${trees[node.tree].name} first.`;
  if (node.requires && !(c.talents[node.requires] ?? 0)) return `Needs ${talentNode(c.cls, node.requires)?.name ?? 'another talent'} first.`;
  return null;
}

/** The other node of a node's choice (TalentNode.pick) that the hero has taken, if one is. */
export function pickTaken(c: Character, node: TalentNode): TalentNode | undefined {
  if (!node.pick) return undefined;
  return TALENTS[c.cls].find((n) => n !== node && n.tree === node.tree && n.pick === node.pick && (c.talents[n.id] ?? 0) > 0);
}

/** The nodes of one choice in a tree (TalentNode.pick), in column order. */
export const pickOptions = (cls: ClassId, node: TalentNode): TalentNode[] => (node.pick ? TALENTS[cls].filter((n) => n.tree === node.tree && n.pick === node.pick).sort((a, b) => a.col - b.col) : [node]);

/**
 * Takes another of a choice's three in place of the one taken (TalentNode.pick): the point moves, for free, as the
 * Ring's talents change between matches. False when nothing of that choice is taken, or this one is.
 */
export function swapPick(c: Character, id: string): boolean {
  const node = talentNode(c.cls, id);
  if (!node || (c.talents[id] ?? 0) > 0) return false;
  const was = pickTaken(c, node);
  if (!was) return false;
  delete c.talents[was.id];
  c.talents[id] = 1;
  return true;
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
    delete c.freeRespec;
    const old = def.trees[c.spec].skill;
    c.skills = c.skills.map((id) => (id === old ? null : id)) as Character['skills'];
  }
  c.spec = tree;
  // the other specializations' shapes come off the bar (still learned); their slots fill from what's left
  const others = (def.forms ?? []).filter((f) => f.specSwap && f.specSwap.tree !== tree).map((f) => f.skill);
  c.skills = c.skills.map((id) => (id && others.includes(id) ? null : id)) as Character['skills'];
  autoSlotSkills(c);
  seatSpecSkill(c);
  seatSpecBar(c);
  return true;
}

/**
 * Puts the specialization's own skills (SpecDef.bar) that are learned on the bar: each takes an empty slot, or else
 * one holding a skill that isn't one of them (which stays learned, for the Skills screen). `only` limits it to those
 * skills (the ones a level just taught). True when anything moved.
 */
export function seatSpecBar(c: Character, only?: string[]): boolean {
  if (c.spec === null || c.level < SPEC_LEVEL) return false;
  const want = CLASSES[c.cls].trees[c.spec].bar;
  if (!want) return false;
  const learned = learnedSkills(c);
  const slots = [0, 1, 2, 3] as const;
  let moved = false;
  for (const id of want) {
    if ((only && !only.includes(id)) || !learned.includes(id) || c.skills.includes(id)) continue;
    const at = slots.find((i) => slotOpen(c, i) && c.skills[i] === null) ?? slots.find((i) => slotOpen(c, i) && !want.includes(c.skills[i]!));
    if (at === undefined) continue;
    c.skills[at] = id;
    moved = true;
  }
  return moved;
}

/**
 * The specialization's ability goes on the bar even when the bar is full: in the last slot that is open (what was
 * there stays learned and can go back from the Skills screen). It used to go in the fourth slot always, which
 * opens at level 15: a hero who chose at level 10 could not use the one skill the choice was about for five levels.
 * True when it moved anything (a hero saved in that state is put right as they load).
 */
export function seatSpecSkill(c: Character): boolean {
  if (c.spec === null || c.level < SPEC_LEVEL) return false;
  const tree = CLASSES[c.cls].trees[c.spec];
  if (tree.formOnly) return false;
  const last = ([3, 2, 1, 0] as const).find((i) => slotOpen(c, i));
  if (last === undefined) return false;
  const at = c.skills.indexOf(tree.skill);
  if (at >= 0 && slotOpen(c, at as SkillIndex)) return false;
  // (in a slot not open yet: it changes places with what the last open slot holds, which waits there for its level)
  if (at >= 0) c.skills[at] = c.skills[last] ?? null;
  c.skills[last] = tree.skill;
  return true;
}

export function learnTalent(c: Character, id: string): boolean {
  if (cantLearn(c, id)) return false;
  c.talents[id] = (c.talents[id] ?? 0) + 1;
  return true;
}

/**
 * What re-choosing talents costs (PROGRESSION_BALANCE.md Part 2, D): free below level 20, then level × 10
 * gold up to 400; free once when the game owes it (a rebalance changed the talents after they were chosen).
 */
export const respecCost = (c: Character): number => (c.freeRespec || c.level < 20 ? 0 : Math.min(400, c.level * 10));

export function respec(c: Character): boolean {
  const cost = respecCost(c);
  if (c.gold < cost || spentPoints(c) === 0) return false;
  c.gold -= cost;
  c.talents = {};
  delete c.freeRespec;
  return true;
}

/* ------------------------------------------------------------- equipment */

export const bagFull = (c: Character): boolean => c.bag.length >= bagSize(c);

/** Adds an item to the bag; false when the bag is full. */
export function addItem(c: Character, item: Item): boolean {
  if (bagFull(c)) return false;
  if (allItems(c).some((i) => i.uid === item.uid)) return false;
  c.bag.push(item);
  learnLooks(c, [item]);
  return true;
}

export const allItems = (c: Character): Item[] => [...Object.values(c.equip).filter((i): i is Item => !!i), ...c.bag];

/** Rewards that can wait for room in the bag (more are sold for their gold). */
export const HELD_MAX = 10;

/**
 * A quest reward: into the bag, over-full if need be (its overflow, like loot picked up on leaving), else held
 * until there is room (Character.held), never left on the ground. 'held' when it waits; 'sold' (for its salvage
 * gold, added by the caller) only past HELD_MAX waiting.
 */
export function giveReward(c: Character, item: Item): 'bag' | 'held' | 'sold' {
  if (c.bag.length < bagSize(c) + BAG_OVERFLOW) {
    c.bag.push(item);
    learnLooks(c, [item]);
    return 'bag';
  }
  if ((c.held?.length ?? 0) >= HELD_MAX) return 'sold';
  (c.held ??= []).push(item);
  learnLooks(c, [item]);
  return 'held';
}

/** Held rewards that now fit go into the bag; the ones that came in. */
export function deliverHeld(c: Character): Item[] {
  const came: Item[] = [];
  while (c.held?.length && c.bag.length < bagSize(c)) {
    const item = c.held.shift()!;
    c.bag.push(item);
    came.push(item);
  }
  if (c.held && !c.held.length) delete c.held;
  return came;
}

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
  // a look is kept once owned, even when the piece is melted down
  learnLooks(c, [c.bag[i]!]);
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
 * Whether a quest waits for the hero to accept it from its giver (a "!" over their head, the quest's page with
 * its reward, Accept): every quest the giver hands out in person (blueprint §8, "like WoW"). The story's own
 * beats and the tutorials (`auto`) start at once, and so does a next step whose giver is far away when the
 * last one ends (a chain carried on by letter), so nobody has to walk back across the world to say yes.
 */
export function needsAccept(q: QuestDef): boolean {
  // a choice is always the hero's to make
  if (q.choice) return true;
  if (q.auto) return false;
  const before = (q.after ?? []).map((id) => QUEST_DEFS[id]).filter((p): p is QuestDef => !!p && p.giver === q.giver);
  // the first of a giver's chain is offered; the next, if the last one was handed back to them
  return before.length === 0 || before.some((p) => turnInNpc(p) === q.giver);
}

/**
 * Opens every quest whose prerequisites are done, once the hero has been to its zone and is of its
 * level: offered, or started at once (needsAccept). Returns the quests that just started.
 */
export function startQuests(c: Character): QuestDef[] {
  const started: QuestDef[] = [];
  for (const q of QUESTS) {
    if (c.quests[q.id]) continue;
    if (q.zone && !c.unlocked.includes(q.zone)) continue;
    if (q.level && c.level < q.level) continue;
    if ((q.after ?? []).every((id) => questState(c, id) === 'done')) {
      if (needsAccept(q)) c.quests[q.id] = { state: 'offered', n: 0 };
      else {
        c.quests[q.id] = { state: 'active', n: 0 };
        openWay(c, q);
        started.push(q);
      }
    }
  }
  return started;
}

/**
 * Quests that wait only for the hero's level: their land is open and everything before them is done
 * (startQuests starts them at q.level). The log lists them as "Opens at level N"; lowest level first.
 */
export function levelGated(c: Character): QuestDef[] {
  return QUESTS.filter((q) => !c.quests[q.id] && !!q.level && c.level < q.level && (!q.zone || c.unlocked.includes(q.zone)) && (q.after ?? []).every((id) => questState(c, id) === 'done')).sort((a, b) => a.level! - b.level!);
}

/** The quests an NPC is offering. */
export const offeredBy = (c: Character, npc: string): QuestDef[] => QUESTS.filter((q) => q.giver === npc && questState(c, q.id) === 'offered');

/** The hero accepts what an NPC offers; returns the quests that start. */
export function acceptQuests(c: Character, npc: string): QuestDef[] {
  const list = offeredBy(c, npc).filter((q) => questState(c, q.id) === 'offered');
  const taken: QuestDef[] = [];
  for (const q of list) {
    // the other answer to a choice may have been closed by one taken a moment ago
    if (questState(c, q.id) !== 'offered') continue;
    c.quests[q.id] = { state: 'active', n: 0 };
    closeChoice(c, q);
    openWay(c, q);
    taken.push(q);
  }
  return taken;
}

/** A path not taken: a quest closed by the other answer to its choice. */
export const declined = (c: Character, id: string): boolean => c.quests[id]?.state === 'done' && c.quests[id]!.n < 0;

/** Taking one answer to a choice closes the others. */
function closeChoice(c: Character, q: QuestDef): void {
  if (!q.choice) return;
  for (const other of QUESTS) if (other.choice === q.choice && other.id !== q.id && (!c.quests[other.id] || c.quests[other.id]!.state === 'offered')) c.quests[other.id] = { state: 'done', n: -1 };
}

/** Accepts every offered quest (the play-bot, and old saves' quests that were already running); of a choice, the first. */
export function acceptAll(c: Character): void {
  for (const q of QUESTS) {
    const s = c.quests[q.id];
    if (s?.state !== 'offered') continue;
    c.quests[q.id] = { state: 'active', n: s.n };
    closeChoice(c, q);
  }
}

export const activeQuests = (c: Character): QuestDef[] => QUESTS.filter((q) => questState(c, q.id) === 'active');
/** Quests whose work is done, waiting to be handed in. */
export const readyQuests = (c: Character): QuestDef[] => QUESTS.filter((q) => questState(c, q.id) === 'ready');

/** The step a quest is on (its objective, or one of its further steps). */
export function currentObjective(c: Character, q: QuestDef): Objective {
  const steps = questSteps(q);
  return steps[Math.min(steps.length - 1, c.quests[q.id]?.step ?? 0)]!;
}

/** How far along a quest's current step is, and its goal. */
export function questProgress(c: Character, q: QuestDef): { n: number; of: number } {
  const n = c.quests[q.id]?.n ?? 0;
  const o = currentObjective(c, q);
  const of = o.kind === 'kill' || o.kind === 'tutorial' || o.kind === 'collect' || o.kind === 'loot' || o.kind === 'use' || o.kind === 'subdue' ? o.count : o.kind === 'hold' ? o.secs : o.kind === 'trail' ? o.marks : 1;
  return { n: Math.min(n, of), of };
}

export interface QuestNews {
  /** Finished, to be paid now. */
  done: QuestDef[];
  /** Finished, to be handed in. */
  ready: QuestDef[];
  /** On to their next step. */
  stepped: QuestDef[];
}

/**
 * Something happened that quests may count, on their current step. A finished step leads to the next; the
 * last one finishes the quest: ready to hand in (`handIn`: turnInNpc) or done at once. Rewards are the caller's.
 */
export function questEvent(c: Character, match: (o: Objective) => boolean, amount = 1, handIn: (q: QuestDef) => string | null = turnInNpc): QuestNews {
  const news: QuestNews = { done: [], ready: [], stepped: [] };
  for (const q of activeQuests(c)) {
    if (!match(currentObjective(c, q))) continue;
    const entry = c.quests[q.id]!;
    entry.n += amount;
    const { of } = questProgress(c, q);
    if (entry.n < of) continue;
    const step = (entry.step ?? 0) + 1;
    if (step < questSteps(q).length) {
      entry.step = step;
      entry.n = 0;
      news.stepped.push(q);
    } else if (handIn(q)) {
      entry.state = 'ready';
      entry.n = of;
      news.ready.push(q);
    } else {
      entry.state = 'done';
      entry.n = of;
      news.done.push(q);
    }
  }
  return news;
}

/** Hands a finished quest in: it is done (the caller pays the reward). */
export function handInQuest(c: Character, id: string): QuestDef | null {
  const e = c.quests[id];
  if (e?.state !== 'ready') return null;
  e.state = 'done';
  if (c.tracked === id) delete c.tracked;
  return QUEST_DEFS[id] ?? null;
}

/** The quests an NPC takes back (finished, to be handed in to them). */
export const handInsFor = (c: Character, npc: string): QuestDef[] => readyQuests(c).filter((q) => turnInNpc(q) === npc);

/** Accepts one quest an NPC offers; returns it, or null when it is no longer offered. */
export function acceptQuest(c: Character, id: string): QuestDef | null {
  const q = QUEST_DEFS[id];
  if (!q || questState(c, id) !== 'offered') return null;
  c.quests[id] = { state: 'active', n: 0 };
  closeChoice(c, q);
  openWay(c, q);
  return q;
}

/** The land a quest leads to opens when it is taken (QuestDef.opens). */
function openWay(c: Character, q: QuestDef): void {
  if (q.opens && !c.unlocked.includes(q.opens)) c.unlocked.push(q.opens);
}

/**
 * Why a quest can't be abandoned, or null when it can. The hero may give up a side quest they took (the owner:
 * "quests should also be abandonable"): it goes back to its giver, offered again with nothing done. The main story
 * can't be dropped (nothing else would carry the hero on), nor a beat that starts by itself (it would only start
 * again), nor one played through as a story event or a lesson, nor an answer to a choice (taking it closed the
 * others for good).
 */
export function cantAbandon(c: Character, id: string): string | null {
  const q = QUEST_DEFS[id];
  const s = questState(c, id);
  if (!q || (s !== 'active' && s !== 'ready')) return 'Not a quest under way.';
  if (isMainQuest(id)) return 'The main story can’t be abandoned.';
  if (q.auto) return 'This one is part of the story where it happens.';
  if (q.choice) return 'Your answer has been given.';
  if (questSteps(q).some((o) => o.kind === 'event' || o.kind === 'tutorial')) return 'This one is played through where it happens.';
  return null;
}

/** Gives up a quest (cantAbandon): offered by its giver again, with nothing done. */
export function abandonQuest(c: Character, id: string): QuestDef | null {
  if (cantAbandon(c, id)) return null;
  c.quests[id] = { state: 'offered', n: 0 };
  if (c.tracked === id) delete c.tracked;
  return QUEST_DEFS[id]!;
}

export const questDef = (id: string): QuestDef | undefined => QUEST_DEFS[id];

/** Where a quest is done (its objective's region, else its zone). */
export function questRegion(q: QuestDef): RegionId | undefined {
  const o = q.objective;
  if ('region' in o) return o.region;
  return q.zone;
}

/**
 * The quest to point at when the hero hasn't chosen one: the main story's, here and then anywhere, before a side
 * quest. It took the first quest done where the hero stood, and a side quest listed before the story's next beat (a
 * war-chief offered by the same marshal in the same breath) took the tracker from it: the owner saw the main quest
 * "blue for whatever reason".
 */
export function trackedQuest(c: Character, here?: RegionId): QuestDef | undefined {
  // the one the hero chose to follow, while it lasts
  const chosen = c.tracked ? QUEST_DEFS[c.tracked] : undefined;
  if (chosen && (questState(c, chosen.id) === 'active' || questState(c, chosen.id) === 'ready')) return chosen;
  const list = QUESTS.filter((q) => questState(c, q.id) === 'active' || questState(c, q.id) === 'ready');
  const main = list.filter((q) => isMainQuest(q.id));
  // (a dungeon again on a harder tier comes last: it took the tracker while the story waited for a level)
  const plain = list.filter((q) => !isReplay(q));
  const at = (l: QuestDef[]): QuestDef | undefined => (here ? l.find((q) => questRegion(q) === here) : undefined);
  return at(main) ?? main[0] ?? at(plain) ?? plain[0] ?? at(list) ?? list[0];
}

/** A quest that sends the hero through a dungeon they have done again, on a harder tier (Heroic Deeds). */
export const isReplay = (q: QuestDef): boolean => q.objective.kind === 'clear' && q.objective.tier > 0;

/** Follows a quest (null: back to following the story). */
export function trackQuest(c: Character, id: string | null): void {
  if (id && (questState(c, id) === 'active' || questState(c, id) === 'ready')) c.tracked = id;
  else delete c.tracked;
}
