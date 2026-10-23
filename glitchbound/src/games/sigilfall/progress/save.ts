import { CLASS_IDS, MAX_LEVEL, xpToNext } from '../data/classes';
import { BASE_DEFS, ITEM_DEFS, MINOR_MODS } from '../data/items';
import { QUEST_DEFS } from '../data/quests';
import { REGIONS } from '../data/regions';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENTS } from '../data/talents';
import type { ClassId, Item, PerkId, RegionId, SlotId, StatKey } from '../data/types';
import { RARITIES, SLOTS } from '../data/types';
import { STAT_ROLL } from '../data/items';
import { BAG_OVERFLOW, bagSize, learnedSkills, PERKS, pointsInTree, POTION_CAP, potionCap, START_POTIONS, startQuests, talentPoints, type Character } from './character';
import { itemClass, itemSlot, newUid } from './items';

/**
 * The save: up to three heroes and the settings, versioned and validated field by field on load.
 *
 * - `glitchbound.sigilfall` is the save itself. For signed-in players the arcade copies it to their
 *   account and back (platform/cloudSave.ts), so it follows them between devices.
 * - `glitchbound.sigilfall.bak` is the last good copy on this device only. A save that fails to parse
 *   or validate is never written over: it is kept in `.corrupt` and the backup is used instead.
 * - A save from a newer version of the game (another device already updated) is left alone: the game
 *   runs without saving and asks for a reload, rather than overwrite progress it can't read.
 * - The game was called Riftbound on its first day: a save under the old keys is picked up when there is
 *   none under the new ones, and the old keys go once the save is written under the new name.
 */

export const SAVE_KEY = 'glitchbound.sigilfall';
const BACKUP_KEY = 'glitchbound.sigilfall.bak';
const CORRUPT_KEY = 'glitchbound.sigilfall.corrupt';
const OLD_SAVE_KEY = 'glitchbound.riftbound';
const OLD_BACKUP_KEY = 'glitchbound.riftbound.bak';
export const SAVE_VERSION = 2;
export const HERO_SLOTS = 3;

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  /** Joystick radius in CSS px. */
  joystick: number;
  joyMode: 'float' | 'fixed';
  /** Share of the joystick radius ignored around its center. */
  deadzone: number;
  /** Movement response: 1 = linear. Higher reaches full speed with a shorter push. */
  sensitivity: number;
  /** 0 off, 1 light, 2 strong: nudges aimed shots toward a nearby enemy. */
  aimAssist: number;
  /** Tapping attack (or a skill) aims at the nearest enemy. */
  autoTarget: boolean;
  shake: boolean;
  numbers: boolean;
  ultKey: 'f' | 't' | 'shift' | 'rmb';
  /** Mirror the touch controls (skills on the left). */
  lefty: boolean;
  /** The rotate-your-phone hint was dismissed. */
  rotateSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.55,
  sfx: 0.8,
  muted: false,
  joystick: 58,
  joyMode: 'float',
  deadzone: 0.14,
  sensitivity: 1.15,
  aimAssist: 1,
  autoTarget: true,
  shake: true,
  numbers: true,
  ultKey: 'f',
  lefty: false,
  rotateSeen: false,
};

export interface SaveFile {
  v: number;
  heroes: (Character | null)[];
  /** The hero played last. */
  last: number;
  settings: Settings;
  saved: number;
}

export type LoadStatus = 'new' | 'ok' | 'recovered' | 'reset' | 'newer' | 'blocked';

export const emptySave = (): SaveFile => ({ v: SAVE_VERSION, heroes: Array(HERO_SLOTS).fill(null), last: 0, settings: { ...DEFAULT_SETTINGS }, saved: 0 });

/* ------------------------------------------------------------ validation */

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null);
const num = (v: unknown, lo: number, hi: number, dflt: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
const int = (v: unknown, lo: number, hi: number, dflt: number): number => Math.round(num(v, lo, hi, dflt));
const str = (v: unknown, max: number, dflt: string): string => (typeof v === 'string' ? v.slice(0, max) : dflt);
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);

export function validateSettings(v: unknown): Settings {
  const o = obj(v) ?? {};
  const d = DEFAULT_SETTINGS;
  return {
    master: num(o.master, 0, 1, d.master),
    music: num(o.music, 0, 1, d.music),
    sfx: num(o.sfx, 0, 1, d.sfx),
    muted: bool(o.muted, d.muted),
    joystick: int(o.joystick, 40, 84, d.joystick),
    joyMode: o.joyMode === 'fixed' ? 'fixed' : 'float',
    deadzone: num(o.deadzone, 0.04, 0.4, d.deadzone),
    sensitivity: num(o.sensitivity, 0.6, 1.8, d.sensitivity),
    aimAssist: int(o.aimAssist, 0, 2, d.aimAssist),
    autoTarget: bool(o.autoTarget, d.autoTarget),
    shake: bool(o.shake, d.shake),
    numbers: bool(o.numbers, d.numbers),
    ultKey: o.ultKey === 't' || o.ultKey === 'shift' || o.ultKey === 'rmb' ? o.ultKey : 'f',
    lefty: bool(o.lefty, d.lefty),
    rotateSeen: bool(o.rotateSeen, d.rotateSeen),
  };
}

/** An item from a save, or null when it can't be trusted. Values are clamped to what the item level allows. */
export function validateItem(v: unknown): Item | null {
  const o = obj(v);
  if (!o || typeof o.base !== 'string' || typeof o.uid !== 'string') return null;
  const authored = ITEM_DEFS[o.base];
  const base = BASE_DEFS[o.base];
  if (!authored && !base) return null;
  const il = int(o.il, 1, 70, 1);
  const r = authored ? authored.rarity : RARITIES.includes(o.r as never) ? (o.r as Item['r']) : 'common';
  if (!authored && (r === 'epic' || r === 'legendary')) return null;
  const item: Item = { uid: o.uid.slice(0, 24), base: o.base, r, il, st: [] };
  if (!authored && Array.isArray(o.st)) {
    for (const pair of o.st.slice(0, 4)) {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string' || !(pair[0] in STAT_ROLL)) continue;
      const k = pair[0] as StatKey;
      const roll = STAT_ROLL[k];
      const ceiling = (roll.base + roll.per * il) * 1.45 * 1.25 + 1;
      item.st.push([k, num(pair[1], 0, roll.max ?? ceiling, 0)]);
    }
  }
  if (!authored && typeof o.sm === 'number' && Number.isInteger(o.sm) && MINOR_MODS[o.sm] && r === 'rare') item.sm = o.sm;
  if (!authored && typeof o.n === 'string') item.n = o.n.slice(0, 48);
  if (o.fresh === true) item.fresh = true;
  return item;
}

export function validateCharacter(v: unknown, slot: number): Character | null {
  const o = obj(v);
  if (!o || !CLASS_IDS.includes(o.cls as ClassId)) return null;
  const cls = o.cls as ClassId;
  const level = int(o.level, 1, MAX_LEVEL, 1);
  const c: Character = {
    id: `hero${slot}`,
    name: str(o.name, 16, 'Hero').trim() || 'Hero',
    cls,
    level,
    xp: level >= MAX_LEVEL ? 0 : int(o.xp, 0, xpToNext(level) - 1, 0),
    gold: int(o.gold, 0, 1e9, 0),
    shards: int(o.shards, 0, 99, 0),
    marks: int(o.marks, 0, 1e6, 0),
    restock: int(o.restock, 0, 1e6, 0),
    sold: Array.isArray(o.sold) ? o.sold.filter((x): x is string => typeof x === 'string' && x.length <= 24).slice(0, 80) : [],
    talents: {},
    spec: level >= SPEC_LEVEL && (o.spec === 0 || o.spec === 1 || o.spec === 2) ? o.spec : null,
    skills: [null, null, null],
    equip: {},
    bag: [],
    potions: int(o.potions, 0, POTION_CAP + 1, START_POTIONS),
    quests: {},
    unlocked: ['emberwick'],
    tier: int(o.tier, 0, 2, 0),
    bosses: {},
    clears: {},
    keystone: int(o.keystone, 0, 999, 0),
    bestKeys: {},
    opened: [],
    perks: Array.isArray(o.perks) ? [...new Set(o.perks.filter((x): x is PerkId => typeof x === 'string' && x in PERKS))] : [],
    stats: { kills: 0, deaths: 0, time: 0, runs: 0, bestRun: 0 },
    created: int(o.created, 0, 4e12, Date.now()),
    updated: int(o.updated, 0, 4e12, Date.now()),
  };
  // talents: known nodes, ranks within limits, and a spend the rules allow (more points than the level
  // gives, or points where the specialization doesn't open them yet, resets them all)
  const t = obj(o.talents) ?? {};
  let spent = 0;
  for (const node of TALENTS[cls]) {
    const r = int(t[node.id], 0, node.ranks, 0);
    if (r > 0) {
      c.talents[node.id] = r;
      spent += r;
    }
  }
  if (spent > talentPoints(c) || !talentsLegal(c)) c.talents = {};
  c.potions = Math.min(c.potions, potionCap(c));
  // skills: only learned skills of this class
  const learned = learnedSkills(c);
  if (Array.isArray(o.skills)) {
    o.skills.slice(0, 3).forEach((id, i) => {
      if (typeof id === 'string' && learned.includes(id) && SKILLS[id] && !c.skills.includes(id)) c.skills[i] = id;
    });
  }
  // items: unique ids, worn ones in the right slot and wearable
  const seen = new Set<string>();
  const unique = (item: Item): Item => {
    if (seen.has(item.uid)) item.uid = newUid();
    seen.add(item.uid);
    return item;
  };
  const eq = obj(o.equip) ?? {};
  for (const slot of SLOTS) {
    const item = validateItem(eq[slot]);
    if (!item) continue;
    const cls2 = itemClass(item);
    if (itemSlot(item) === slot && (!cls2 || cls2 === cls)) c.equip[slot as SlotId] = unique(item);
    else c.bag.push(unique(item));
  }
  if (Array.isArray(o.bag)) {
    for (const raw of o.bag.slice(0, bagSize(c) + BAG_OVERFLOW)) {
      const item = validateItem(raw);
      if (item) c.bag.push(unique(item));
    }
  }
  // quests
  const q = obj(o.quests) ?? {};
  for (const [id, entry] of Object.entries(q)) {
    const e = obj(entry);
    if (!QUEST_DEFS[id] || !e) continue;
    c.quests[id] = { state: e.state === 'done' ? 'done' : 'active', n: int(e.n, 0, 1e6, 0) };
  }
  if (Array.isArray(o.unlocked)) for (const r of o.unlocked) if (typeof r === 'string' && r in REGIONS && !c.unlocked.includes(r as RegionId)) c.unlocked.push(r as RegionId);
  // quests of the zones the hero has been to start once those are known
  startQuests(c);
  for (const key of ['bosses', 'clears', 'bestKeys'] as const) {
    const m = obj(o[key]) ?? {};
    for (const [k, n] of Object.entries(m).slice(0, 200)) if (/^[a-z0-9:-]{1,32}$/.test(k)) c[key][k] = int(n, 0, 1e6, 0);
  }
  if (Array.isArray(o.opened)) c.opened = [...new Set(o.opened.filter((x): x is string => typeof x === 'string' && /^[a-z0-9:-]{1,48}$/.test(x)))].slice(0, 600);
  const s = obj(o.stats) ?? {};
  c.stats = { kills: int(s.kills, 0, 1e9, 0), deaths: int(s.deaths, 0, 1e9, 0), time: int(s.time, 0, 1e10, 0), runs: int(s.runs, 0, 1e9, 0), bestRun: int(s.bestRun, 0, 1e9, 0) };
  return c;
}

/** Whether a hero's talents could have been learned in some order under the rules (spec first, rows). */
function talentsLegal(c: Character): boolean {
  const spent = Object.values(c.talents).reduce((a, b) => a + b, 0);
  if (!spent) return true;
  if (c.spec === null) return false;
  for (const tree of [0, 1, 2] as const) {
    const nodes = TALENTS[c.cls].filter((n) => n.tree === tree && (c.talents[n.id] ?? 0) > 0);
    if (nodes.length && tree !== c.spec && pointsInTree(c, c.spec) < SPEC_FOCUS) return false;
    // each taken row needs the points below it in the same tree
    for (const n of nodes) {
      const below = TALENTS[c.cls].filter((m) => m.tree === tree && m.row < n.row).reduce((a, m) => a + (c.talents[m.id] ?? 0), 0);
      if (below < n.row * ROW_COST) return false;
      if (n.requires && !(c.talents[n.requires] ?? 0)) return false;
    }
  }
  return true;
}

/** Brings an older save up to date. Returns null for something that is not a Sigilfall save. */
export function migrate(raw: unknown): SaveFile | null {
  const o = obj(raw);
  if (!o || typeof o.v !== 'number') return null;
  // version 2: three talent trees and specializations replaced the two old trees; every hero gets
  // their points back (talents open at level 10 now, with the specialization)
  if (o.v === 1) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      if (hero) {
        hero.talents = {};
        hero.spec = null;
      }
    }
    o.v = 2;
  }
  if (o.v !== SAVE_VERSION) return null;
  const heroes: (Character | null)[] = [];
  const list = Array.isArray(o.heroes) ? o.heroes : [];
  for (let i = 0; i < HERO_SLOTS; i++) heroes.push(validateCharacter(list[i], i));
  return { v: SAVE_VERSION, heroes, last: int(o.last, 0, HERO_SLOTS - 1, 0), settings: validateSettings(o.settings), saved: int(o.saved, 0, 4e12, 0) };
}

/* --------------------------------------------------------------- storage */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageWorks(): boolean {
  try {
    const k = 'glitchbound.sigilfall.probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function parse(text: string | null): SaveFile | null | 'newer' {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as unknown;
    const v = obj(raw)?.v;
    if (typeof v === 'number' && v > SAVE_VERSION) return 'newer';
    return migrate(raw);
  } catch {
    return null;
  }
}

export function loadSave(): { save: SaveFile; status: LoadStatus } {
  if (!storageWorks()) return { save: emptySave(), status: 'blocked' };
  const main = read(SAVE_KEY) ?? read(OLD_SAVE_KEY);
  const parsed = parse(main);
  if (parsed === 'newer') return { save: emptySave(), status: 'newer' };
  if (parsed) return { save: parsed, status: 'ok' };
  const backup = parse(read(BACKUP_KEY) ?? read(OLD_BACKUP_KEY));
  if (main) {
    try {
      localStorage.setItem(CORRUPT_KEY, main);
    } catch {
      /* best effort */
    }
  }
  if (backup && backup !== 'newer') return { save: backup, status: 'recovered' };
  return { save: emptySave(), status: main ? 'reset' : 'new' };
}

/** Writes the save (and the device-only backup). False when storage refused it. */
export function writeSave(save: SaveFile): boolean {
  try {
    save.saved = Date.now();
    const text = JSON.stringify(save);
    // never store something we could not read back
    if (!migrate(JSON.parse(text))) return false;
    localStorage.setItem(SAVE_KEY, text);
    localStorage.setItem(BACKUP_KEY, text);
    // saved under the new name: the old one's keys are no longer needed
    localStorage.removeItem(OLD_SAVE_KEY);
    localStorage.removeItem(OLD_BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Removes a hero for good. */
export function deleteHero(save: SaveFile, slot: number): void {
  save.heroes[slot] = null;
}
