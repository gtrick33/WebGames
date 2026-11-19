import { CLASSES } from '../data/classes';
import { CAMP_ACTIONS, RESERVED_CODES, type CampAction } from '../input/binds';
import { HAIRS, SKINS, type Face } from './character';
import { CLASS_IDS, MAX_LEVEL, xpToNext } from '../data/classes';
import { BASE_DEFS, ITEM_DEFS, MINOR_MODS } from '../data/items';
import { QUEST_DEFS } from '../data/quests';
import { REGIONS } from '../data/regions';
import { SKILLS } from '../data/skills';
import { ROW_COST, SPEC_FOCUS, SPEC_LEVEL, TALENTS } from '../data/talents';
import type { ClassId, Item, PerkId, RegionId, SlotId, StatKey } from '../data/types';
import { RARITIES, SLOTS } from '../data/types';
import { STAT_ROLL } from '../data/items';
import { autoSlotSkills, OLD_SLOT_LEVELS, SLOT_LEVELS, BAG_OVERFLOW, bagSize, learnedSkills, seatSpecSkill, PERKS, pointsInTree, POTION_CAP, potionCap, START_POTIONS, startQuests, talentPoints, type Character, HOME, allItems, HELD_MAX } from './character';
import { itemClass, itemSlot, newUid } from './items';
import { grantMounts, grantWarden, syncRift, learnLooks, LOOK_SLOTS, tidyWardrobe } from './wardrobe';
import { MOUNT_DEFS } from '../data/mounts';
import { KEY_MIN, MAX_IL } from '../data/keystones';
import { QM_PRICE } from '../data/vendors';
import { validateParagon } from './paragon';
import { OPENED_TABLE, QUEST_TABLE } from './saveTables';

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
export const SAVE_VERSION = 15;
/**
 * Hero places a save keeps. Every account plays three; the Gloamknight Pack opens two more (progress/paidClasses.ts
 * `heroSlots`), and a hero in one of those is kept, out of sight, if the pack is refunded.
 */
export const HERO_SLOTS = 5;
export const BASE_HERO_SLOTS = 3;
/** A shop item's id (src/catalog/shop.ts sanitizeProducts). */
const SHOP_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** The nearest and the furthest the camera can be set (Settings: Camera distance), against the game's own view. */
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.3;

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
  /** Tapping a skill or the ultimate aims it at the nearest enemy (a drag still aims by hand). */
  autoAimSkills: boolean;
  /** The Ring, with a mouse: a placed ability's key drops it at the pointer at once (off: its circle comes up, and a click drops it). */
  quickCast: boolean;
  shake: boolean;
  /** Voices: the hero's efforts and cries, and the companions' shouts in a fight (audio/voice.ts). */
  voice: boolean;
  /** How far back the camera stands: 1 is the game's own view, more is further out (ZOOM_MIN to ZOOM_MAX). */
  zoom: number;
  numbers: boolean;
  /** Plates over heads: the hero's health and resource, and every foe's health, struck or not. */
  plates: boolean;
  /** Calmer screen: no shake, lighter weather (a new save starts from the device's own setting). */
  reducedMotion: boolean;
  /** How the picture is drawn: as many pixels as the machine keeps up with (auto), always full, or always light. */
  graphics: 'auto' | 'high' | 'low';
  /**
   * Battery saver: thirty frames a second in place of sixty. Half the pictures drawn is close to half the work, on
   * the game's side and the graphics card's: a phone runs cooler and its battery lasts longer. Off unless chosen.
   */
  saver: boolean;
  /** The color of a blow about to land: red, or magenta (told apart from grass with red-green color blindness). */
  dangerTone: 'red' | 'magenta';
  ultKey: 'f' | 't' | 'shift' | 'rmb';
  /** The fourth skill's key (the slot added in blueprint V2.9). */
  skill4Key: 'c' | 'v' | 'z' | 'x';
  /** Keys the player gave actions of their own (input/binds.ts), by the key's place on the keyboard. */
  keys: Partial<Record<CampAction, string>>;
  /** Mirror the touch controls (skills on the left). */
  lefty: boolean;
  /** The rotate-your-phone hint was dismissed. */
  rotateSeen: boolean;
  /** The first-timer's hints (progress/tips.ts) are on. */
  tutorial: boolean;
  /** The Ring shows each fighter's nameplate along the top of the screen during a match. */
  ringPlates: boolean;
  /** The Ring: an ability pressed out of reach (or out of sight) of its target walks the hero there, then goes off. */
  ringCloseIn: boolean;
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
  autoAimSkills: true,
  quickCast: true,
  shake: true,
  voice: true,
  zoom: 1,
  numbers: true,
  plates: true,
  reducedMotion: false,
  graphics: 'auto',
  saver: false,
  dangerTone: 'red',
  ultKey: 'f',
  skill4Key: 'c',
  keys: {},
  lefty: false,
  rotateSeen: false,
  tutorial: true,
  ringPlates: true,
  ringCloseIn: true,
};

export interface SaveFile {
  v: number;
  heroes: (Character | null)[];
  /** The hero played last. */
  last: number;
  settings: Settings;
  saved: number;
  /** The Rift Trials: how high each calling's stone has been taken on this account (progress/trial.ts). */
  rift: Record<string, number>;
}

export type LoadStatus = 'new' | 'ok' | 'recovered' | 'reset' | 'newer' | 'blocked';

/** A hero's chosen looks, field by field; anything else is no choice at all. */
function parseFace(raw: unknown): Face | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  if (typeof f.skin !== 'number' || typeof f.hair !== 'number' || !SKINS[f.skin] || !HAIRS[f.hair]) return undefined;
  const style = f.style === 'pony' || f.style === 'long' ? f.style : 'short';
  return { skin: f.skin, hair: f.hair, style, beard: f.beard === true };
}

export const emptySave = (): SaveFile => ({ v: SAVE_VERSION, heroes: Array(HERO_SLOTS).fill(null), last: 0, settings: { ...DEFAULT_SETTINGS }, saved: 0, rift: {} });

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
    autoAimSkills: bool(o.autoAimSkills, d.autoAimSkills),
    quickCast: bool(o.quickCast, d.quickCast),
    shake: bool(o.shake, d.shake),
    voice: bool(o.voice, d.voice),
    zoom: num(o.zoom, ZOOM_MIN, ZOOM_MAX, d.zoom),
    numbers: bool(o.numbers, d.numbers),
    plates: bool(o.plates, d.plates),
    reducedMotion: bool(o.reducedMotion, d.reducedMotion),
    graphics: o.graphics === 'high' || o.graphics === 'low' ? o.graphics : 'auto',
    saver: bool(o.saver, d.saver),
    dangerTone: o.dangerTone === 'magenta' ? 'magenta' : 'red',
    ultKey: o.ultKey === 't' || o.ultKey === 'shift' || o.ultKey === 'rmb' ? o.ultKey : 'f',
    skill4Key: o.skill4Key === 'v' || o.skill4Key === 'z' || o.skill4Key === 'x' ? o.skill4Key : 'c',
    keys: cleanKeys(o.keys),
    lefty: bool(o.lefty, d.lefty),
    tutorial: bool(o.tutorial, d.tutorial),
    ringPlates: bool(o.ringPlates, d.ringPlates),
    ringCloseIn: bool(o.ringCloseIn, d.ringCloseIn),
    rotateSeen: bool(o.rotateSeen, d.rotateSeen),
  };
}

/** Keys from a save: known actions, each with one plausible key code that isn't kept for walking or the menu. */
function cleanKeys(v: unknown): Partial<Record<CampAction, string>> {
  const o = obj(v);
  const out: Partial<Record<CampAction, string>> = {};
  if (!o) return out;
  const known = new Set<string>(CAMP_ACTIONS.map((a) => a.id));
  for (const [a, code] of Object.entries(o)) if (known.has(a) && typeof code === 'string' && /^[A-Za-z0-9]{1,24}$/.test(code) && !RESERVED_CODES.has(code)) out[a as CampAction] = code;
  return out;
}

/** An item from a save, or null when it can't be trusted. Values are clamped to what the item level allows. */
export function validateItem(v: unknown): Item | null {
  const o = obj(v);
  if (!o || typeof o.base !== 'string' || typeof o.uid !== 'string') return null;
  const authored = ITEM_DEFS[o.base];
  const base = BASE_DEFS[o.base];
  if (!authored && !base) return null;
  const il = int(o.il, 1, MAX_IL, 1);
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
  if (typeof o.paid === 'number') item.paid = int(o.paid, 0, 1e7, 0);
  // a quartermaster piece bought before prices were kept on items (vendor stock ids start with v: progress/shop.ts)
  else if (authored && item.uid.startsWith('v') && (r === 'epic' || r === 'legendary')) item.paid = QM_PRICE[r].gold;
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
    skills: [null, null, null, null],
    equip: {},
    bag: [],
    potions: int(o.potions, 0, POTION_CAP + 1, START_POTIONS),
    quests: {},
    unlocked: [HOME],
    tier: int(o.tier, 0, 2, 0),
    bosses: {},
    clears: {},
    keystone: int(o.keystone, 0, 999, 0),
    bestKeys: {},
    para: validateParagon(o.para),
    opened: [],
    perks: Array.isArray(o.perks) ? [...new Set(o.perks.filter((x): x is PerkId => typeof x === 'string' && x in PERKS))] : [],
    looks: Array.isArray(o.looks) ? o.looks.filter((x): x is string => typeof x === 'string' && x.length <= 64).slice(0, 4000) : [],
    worn: {},
    body: o.body === 'f' ? 'f' : 'm',
    ...(parseFace(o.face) ? { face: parseFace(o.face) } : {}),
    seen: Object.fromEntries(Object.entries(obj(o.seen) ?? {}).filter(([k, v]) => k in REGIONS && typeof v === 'string' && v.length <= 4000 && /^([A-Za-z0-9+/]*={0,2}|\*)$/.test(v))),
    mounts: Array.isArray(o.mounts) ? [...new Set(o.mounts.filter((x): x is string => typeof x === 'string' && !!MOUNT_DEFS[x]))] : [],
    mount: typeof o.mount === 'string' && MOUNT_DEFS[o.mount] ? o.mount : null,
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
  if (o.freeRespec === true) c.freeRespec = true;
  if (o.review === true) c.review = true;
  if (Array.isArray(o.gm)) {
    const gm = o.gm.filter((x): x is string => typeof x === 'string' && x.length <= 64).slice(-40);
    if (gm.length) c.gm = gm;
  }
  c.potions = Math.min(c.potions, potionCap(c));
  // skills: only learned skills of this class
  const learned = learnedSkills(c);
  if (Array.isArray(o.skills)) {
    // three slots before blueprint V2.9: the fourth comes in empty (and fills with the next skill learned)
    o.skills.slice(0, 4).forEach((id, i) => {
      if (typeof id === 'string' && learned.includes(id) && SKILLS[id] && !c.skills.includes(id)) c.skills[i] = id;
    });
    // a three-slot save: the new slot takes a learned skill that wasn't on the bar, if there is one
    if (o.skills.length < 4) autoSlotSkills(c);
    // slots that have opened sooner since it was saved (OLD_SLOT_LEVELS) come in empty: they take a skill too
    else if (OLD_SLOT_LEVELS.some((old, i) => c.level < old && c.level >= SLOT_LEVELS[i]! && c.skills[i] === null)) autoSlotSkills(c);
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
  // quest rewards waiting for room in the bag (progress/character.ts giveReward)
  if (Array.isArray(o.held)) {
    const held = o.held.slice(0, HELD_MAX).flatMap((raw) => {
      const item = validateItem(raw);
      return item ? [unique(item)] : [];
    });
    if (held.length) c.held = held;
  }
  // quests
  const q: Raw = { ...obj(o.quests) };
  // version 12: done quests listed in QUEST_TABLE come as one bitset (saveText)
  for (const id of unpackBits(o.qd, QUEST_TABLE)) if (!(id in q)) q[id] = 'd';
  for (const [id, entry] of Object.entries(q)) {
    const e = typeof entry === 'string' ? unpackQuest(entry) : obj(entry);
    if (!QUEST_DEFS[id] || !e) continue;
    // a path not taken is kept as done with n −1 (progress/character.ts, declined)
    const notTaken = e.state === 'done' && e.n === -1;
    const state = e.state === 'done' ? 'done' : e.state === 'offered' ? 'offered' : e.state === 'ready' ? 'ready' : 'active';
    const steps = 1 + (QUEST_DEFS[id]!.then?.length ?? 0);
    const step = int(e.step, 0, steps - 1, 0);
    c.quests[id] = { state, n: notTaken ? -1 : int(e.n, 0, 1e6, 0), ...(step ? { step } : {}) };
  }
  // the north road is open after the Prologue's dawn; a hero of the old opening went up it first, after the
  // yard (the three training quests became one), so whoever started the wood has it
  if ((c.quests['the-empty-tomb']?.state === 'done' || c.quests['into-the-wood']) && !c.unlocked.includes('whisperwood')) c.unlocked.push('whisperwood');
  // the Prologue opens on the raid now: the courier walks in during it (briar-the-rider), where he once met a
  // hero of the old opening in daylight. Whoever has met him has seen him come
  if (c.quests['briar-the-seal'] && !c.quests['briar-the-rider']) c.quests['briar-the-rider'] = { state: 'done', n: 1 };
  if (typeof o.tracked === 'string' && (c.quests[o.tracked]?.state === 'active' || c.quests[o.tracked]?.state === 'ready')) c.tracked = o.tracked;
  if (Array.isArray(o.unlocked)) for (const r of o.unlocked) if (typeof r === 'string' && r in REGIONS && !c.unlocked.includes(r as RegionId)) c.unlocked.push(r as RegionId);
  // where they last stood: a land they know the way to (anything else, and they wake in Briarhollow as before)
  const at = obj(o.at);
  if (at && typeof at.region === 'string' && at.region in REGIONS && c.unlocked.includes(at.region as RegionId)) {
    const tier = int(at.tier, 0, 2, 0);
    const from = typeof at.from === 'string' && at.from in REGIONS ? (at.from as RegionId) : undefined;
    c.at = { region: at.region as RegionId, ...(tier ? { tier } : {}), ...(from ? { from } : {}) };
  }
  // quests of the zones the hero has been to start once those are known
  startQuests(c);
  for (const key of ['bosses', 'clears', 'bestKeys'] as const) {
    const m = obj(o[key]) ?? {};
    for (const [k, n] of Object.entries(m).slice(0, 200)) if (/^[a-z0-9:-]{1,32}$/.test(k)) c[key][k] = int(n, 0, 1e6, 0);
  }
  // Riftstone: whoever has cleared Duskspire on Mythic holds a Riftstone
  if (c.quests['postgame-crownfall-mythic']?.state === 'done') c.keystone = Math.max(KEY_MIN, c.keystone);
  // version 12: the keys listed in OPENED_TABLE come as one bitset, the others by name
  const opened = [...unpackBits(o.ok, OPENED_TABLE), ...(Array.isArray(o.opened) ? o.opened : [])];
  c.opened = [...new Set(opened.filter((x): x is string => typeof x === 'string' && /^[a-z0-9:-]{1,48}$/.test(x)))].slice(0, 1200);
  // the Wardrobe: looks of everything worn or carried are owned (the only ownership that can be proven);
  // worn looks stay only where they are owned and fit the class (the item under them is never touched)
  const worn = obj(o.worn) ?? {};
  for (const slot of LOOK_SLOTS) if (typeof worn[slot] === 'string') c.worn[slot] = worn[slot] as string;
  learnLooks(c, [...allItems(c), ...(c.held ?? [])]);
  tidyWardrobe(c);
  // the shop's mount and looks chosen over these: only the choice, by a shop item's id. Whether the account owns them
  // is asked each time (progress/shopGoods.ts), so a save can choose one but never shows one that isn't owned
  const shopId = (v: unknown): v is string => typeof v === 'string' && SHOP_ID.test(v);
  if (shopId(o.shopMount)) c.shopMount = o.shopMount;
  // (the title worn: only the choice; whether it is earned is asked of the record each time)
  // (up to 64: a title the team gave is `given-` and the grant's 36-letter id, and was dropped at every load when this
  // allowed 24, so it had to be put on again each time the game opened)
  if (typeof o.title === 'string' && /^[a-z0-9-]{0,64}$/.test(o.title)) c.title = o.title;
  const shopWorn = obj(o.shopWorn) ?? {};
  for (const slot of ['head', 'chest'] as const) if (shopId(shopWorn[slot])) c.shopWorn = { ...c.shopWorn, [slot]: shopWorn[slot] };
  // mounts: earned ones are owned (the Millbrook Cob for anyone who has the old riding perk); the chosen one must be owned.
  // A mount held from before Dunmore's riders came (older rules gave some early) stays in the save: the hero
  // just can't ride it until the riders come (wardrobe.ts ridingOpen, world.ts mountRefusal).
  grantMounts(c);
  grantWarden(c);
  syncRift(c);
  // (a hero who chose a specialization before its fourth slot opened: its ability comes onto the bar they have)
  seatSpecSkill(c);
  if (c.mount && !c.mounts.includes(c.mount)) c.mount = c.mounts[0] ?? null;
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
      // one of a choice's three (TalentNode.pick), never two
      if (n.pick && nodes.some((m) => m !== n && m.pick === n.pick)) return false;
    }
  }
  return true;
}

/** Quests added in front of ones that already existed (save version 4). */
const ACT_ONE_BEATS = ['mill-the-bridge', 'reed-bring-them-home', 'camp-grain', 'camp-healers', 'gull-the-slip', 'hearth-the-riders-come', 'hearth-hold-the-wall', 'hearth-the-ram', 'hearth-the-shrine'];
/** Quests added in front of ones that already existed (save version 5). */
const ACT_TWO_BEATS = ['nyx-joins', 'nyx-the-back-door', 'orren-the-last-chapel', 'the-last-lamp', 'cael-the-hostel', 'city-the-treasury', 'city-the-roads-office', 'city-the-cellar', 'festival-the-lanterns', 'festival-the-knives', 'festival-the-catacombs', 'festival-the-champion'];

/**
 * New quests put in front of old ones: each counts as done for a hero who has started anything that
 * comes after it (along the chain, so a hero past the end of a run of new beats has played them all).
 */
function playedBefore(quests: Record<string, unknown>, ids: string[]): void {
  const started = (id: string): boolean => !!obj(quests[id])?.state;
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of ids) {
      if (started(id)) continue;
      if (!Object.values(QUEST_DEFS).some((q) => q.after?.includes(id) && started(q.id))) continue;
      quests[id] = { state: 'done', n: 1 };
      changed = true;
    }
  }
}

/**
 * Version 13: the story in fifteen lands (STORY_BIBLE.md v3). Twelve lands left the story, beats were put in front
 * of old quests and the main story runs in one line. A hero keeps their place in it: every main quest before the
 * furthest one they have started counts as played, with what it gives that stays with a hero (its perk, a sigil,
 * and the land it opens). Their quests of the lands that left the story are dropped as they load.
 */
function keepPlace(hero: Raw): void {
  const quests: Raw = { ...obj(hero.quests) };
  for (const id of unpackBits(hero.qd, QUEST_TABLE)) if (!(id in quests)) quests[id] = 'd';
  for (const [id, e] of Object.entries(quests)) if (typeof e === 'string') quests[id] = unpackQuest(e);
  const started = (id: string): boolean => !!obj(quests[id])?.state;
  // the main story: what the last bell can't ring without
  const main = new Set<string>();
  const walk = (id: string): void => {
    if (main.has(id)) return;
    main.add(id);
    for (const a of QUEST_DEFS[id]?.after ?? []) walk(a);
  };
  walk('epilogue-the-bell');
  const played: string[] = [];
  const stack = [...main].filter(started);
  while (stack.length) {
    const id = stack.pop()!;
    for (const a of QUEST_DEFS[id]?.after ?? []) {
      if (started(a) || !main.has(a)) continue;
      quests[a] = { state: 'done', n: 1 };
      played.push(a);
      stack.push(a);
    }
  }
  const perks = Array.isArray(hero.perks) ? (hero.perks as unknown[]) : [];
  const unlocked = Array.isArray(hero.unlocked) ? (hero.unlocked as unknown[]) : [];
  // the Gloam's story is played in the Riftscar Wastes now: whoever knew the fen knows the way there
  if (unlocked.includes('gloamhollow') && !unlocked.includes('riftscar')) unlocked.push('riftscar');
  for (const id of played) {
    const r = QUEST_DEFS[id]!.reward;
    if (r.perk && !perks.includes(r.perk)) perks.push(r.perk);
    if (r.unlock && !unlocked.includes(r.unlock)) unlocked.push(r.unlock);
  }
  hero.perks = perks;
  hero.unlocked = unlocked;
  hero.quests = quests;
  delete hero.qd;
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
  // version 3: the Crown of Ash and Starlight. Heroes start in Briarhollow; a hero who had begun the old
  // opening keeps their place in it: the Prologue's new beats before where they are count as done
  if (o.v === 2) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      const quests = hero ? obj(hero.quests) : null;
      if (!hero || !quests) continue;
      const state = (id: string): string | undefined => obj(quests[id])?.state as string | undefined;
      const done = (id: string): void => {
        if (!quests[id]) quests[id] = { state: 'done', n: 1 };
      };
      if (state('first-steps')) done('briar-dusk');
      if (state('first-dodge') === 'done' || state('briar-the-seal')) done('briar-the-seal');
      if (state('the-warden') || state('close-the-rift')) for (const id of ['briar-nightfall', 'briar-the-inn', 'briar-hold-the-door', 'briar-below']) done(id);
    }
    o.v = 3;
  }
  // version 4: Act I in the new story. Beats were put into the villages' chains (the mill road, the
  // abducted brought home, the Defense of Hearthstead, the camp's arrivals); a hero already past one
  // has played it
  if (o.v === 3) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const quests = obj(obj(h)?.quests);
      if (quests) playedBefore(quests, ACT_ONE_BEATS);
    }
    o.v = 4;
  }
  // version 5: Act II in the new story (Nyx joins, Lantern Hill's vigil and Cael, the Crown City's
  // traitor and the Starfall Festival): the same rule
  if (o.v === 4) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const quests = obj(obj(h)?.quests);
      if (quests) playedBefore(quests, ACT_TWO_BEATS);
    }
    o.v = 5;
  }
  // version 6: Act III's choices and its low point. A hero who already ended Thistlemourn took that answer
  // (Silvaine's song is the path not taken); a hero past the Tear met the Pale Herald there
  if (o.v === 5) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const quests = obj(obj(h)?.quests);
      if (!quests) continue;
      playedBefore(quests, ['the-heralds-ambush', 'mara-commands', 'cael-the-sortie']);
      const thorn = obj(quests['the-thorn-court'])?.state;
      if ((thorn === 'active' || thorn === 'done') && !quests['silvaines-song']) quests['silvaines-song'] = { state: 'done', n: -1 };
    }
    o.v = 6;
  }
  // version 7: the progression rebalance (PROGRESSION_BALANCE.md Part 2). Levels and talents load as they
  // are (nobody loses a level); every hero who had spent points gets one free respec to re-choose them
  if (o.v === 6) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      const talents = hero ? obj(hero.talents) : null;
      if (hero && talents && Object.keys(talents).length) hero.freeRespec = true;
    }
    o.v = 7;
  }
  // version 8: the Wardrobe and mounts (blueprint §6). Nothing to change in the file: on load every hero owns
  // the looks of what they wear and carry, and the mounts they have earned (validateCharacter)
  if (o.v === 7) o.v = 8;
  // version 9: fog of war on the maps (progress/fog.ts). The lands a hero already knew are seen whole: only
  // what they find from now on starts dark
  if (o.v === 8) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      if (hero && Array.isArray(hero.unlocked)) hero.seen = Object.fromEntries(hero.unlocked.filter((r): r is string => typeof r === 'string').map((r) => [r, '*']));
    }
    o.v = 9;
  }
  // version 10: quests stored packed (packQuest); both forms are read
  if (o.v === 9) o.v = 10;
  // version 11: Riftstone (the Riftstone, the best stones) and Paragon levels; older heroes start with none
  // (validateCharacter gives a stone to whoever cleared Duskspire on Mythic)
  if (o.v === 10) o.v = 11;
  // version 12: done quests and opened keys stored as bitsets over progress/saveTables.ts, lands seen almost
  // whole stored whole (saveText); both forms are read
  if (o.v === 11) o.v = 12;
  // version 13: the story in fifteen lands; every hero keeps their place in it (keepPlace)
  if (o.v === 12) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      if (hero) keepPlace(hero);
    }
    o.v = 13;
  }
  // version 14: the combat rebalance (skills hit harder on longer cooldowns, a slower ultimate) and talents reworked
  // into procs: every hero who had spent points gets one free respec to choose again (talents no longer there are
  // dropped on load, their points back to spend)
  if (o.v === 13) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      const talents = hero ? obj(hero.talents) : null;
      if (hero && talents && Object.keys(talents).length) hero.freeRespec = true;
    }
    o.v = 14;
  }
  // version 15: the campaign's combat made like the Ring's (combos, a specialization's own ultimate, casting on the move)
  // and every talent tree made again, fifty-one points deep with choices in it: every hero's points come back to spend
  if (o.v === 14) {
    for (const h of Array.isArray(o.heroes) ? o.heroes : []) {
      const hero = obj(h);
      if (!hero) continue;
      const talents = obj(hero.talents);
      if (talents && Object.keys(talents).length) hero.freeRespec = true;
      hero.talents = {};
    }
    o.v = 15;
  }
  if (o.v !== SAVE_VERSION) return null;
  const heroes: (Character | null)[] = [];
  const list = Array.isArray(o.heroes) ? o.heroes : [];
  for (let i = 0; i < HERO_SLOTS; i++) heroes.push(validateCharacter(list[i], i));
  // (a save from before the Trials had their own heroes has none: every calling starts at its first stone)
  const rift: Record<string, number> = {};
  if (o.rift && typeof o.rift === 'object') for (const [cls, n] of Object.entries(o.rift as Record<string, unknown>)) if (cls in CLASSES && typeof n === 'number' && Number.isFinite(n)) rift[cls] = Math.max(1, Math.min(999, Math.floor(n)));
  return { v: SAVE_VERSION, heroes, last: int(o.last, 0, HERO_SLOTS - 1, 0), settings: validateSettings(o.settings), saved: int(o.saved, 0, 4e12, 0), rift };
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
/**
 * A quest's state in a few letters (version 10): d done, x a path not taken, o offered, a<n>[.<step>]
 * under way, r[.<step>] waiting to be handed in. Five hundred of them as objects made a save too big to
 * follow the player between devices (platform/syncKeys.ts).
 */
export function packQuest(e: Character['quests'][string]): string {
  const step = e.step ? `.${e.step}` : '';
  if (e.state === 'done') return e.n < 0 ? 'x' : 'd';
  if (e.state === 'offered') return 'o';
  if (e.state === 'ready') return `r${step}`;
  return `a${Math.max(0, Math.round(e.n))}${step}`;
}

export function unpackQuest(s: string): Record<string, unknown> | null {
  const m = /^([dxora])(\d{0,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const step = m[3] ? Number(m[3]) : 0;
  if (m[1] === 'd') return { state: 'done', n: 1 };
  if (m[1] === 'x') return { state: 'done', n: -1 };
  if (m[1] === 'o') return { state: 'offered', n: 0 };
  if (m[1] === 'r') return { state: 'ready', n: 1e6, step };
  return { state: 'active', n: Number(m[2] || 0), step };
}

/** Ids of a table as a base64 bitset: bit i stands for table[i] (progress/saveTables.ts). */
export function packBits(ids: Iterable<string>, table: readonly string[], index: ReadonlyMap<string, number>): string {
  const bytes = new Uint8Array(Math.ceil(table.length / 8));
  let top = 0;
  for (const id of ids) {
    const i = index.get(id);
    if (i === undefined) continue;
    bytes[i >> 3]! |= 1 << (i & 7);
    top = Math.max(top, (i >> 3) + 1);
  }
  let s = '';
  for (const b of bytes.subarray(0, top)) s += String.fromCharCode(b);
  return btoa(s);
}

/** The ids a packBits bitset holds (none for anything that isn't one). */
export function unpackBits(v: unknown, table: readonly string[]): string[] {
  if (typeof v !== 'string' || v.length > 4000) return [];
  let bytes: string;
  try {
    bytes = atob(v);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (let i = 0; i < Math.min(table.length, bytes.length * 8); i++) if ((bytes.charCodeAt(i >> 3) >> (i & 7)) & 1) out.push(table[i]!);
  return out;
}

const QUEST_INDEX = new Map(QUEST_TABLE.map((id, i) => [id, i]));
const OPENED_INDEX = new Map(OPENED_TABLE.map((id, i) => [id, i]));
/** A land's fog with this share of it explored is stored as seen whole: the last corners are mostly walls and water. */
const FOG_WHOLE = 0.95;

/** A land's stored fog, '*' once it is explored almost whole (progress/fog.ts). */
function compactFog(v: string): string {
  if (v === '*') return v;
  try {
    const bytes = atob(v);
    let set = 0;
    for (let i = 0; i < bytes.length; i++) for (let b = bytes.charCodeAt(i); b; b &= b - 1) set++;
    return bytes.length && set >= bytes.length * 8 * FOG_WHOLE ? '*' : v;
  } catch {
    return v;
  }
}

/**
 * A hero as stored (version 12): quests packed (packQuest) with the done ones of QUEST_TABLE in one bitset
 * (`qd`), opened keys of OPENED_TABLE in one bitset (`ok`) and the rest by name, fog only for lands not
 * explored almost whole, and the bag no longer than a load keeps. Three completionist heroes stay well
 * under the arcade's cloud limit (tests/sigilfall-save-size.test.ts).
 */
export function storedHero(c: Character): Raw {
  const quests: Record<string, string> = {};
  const done: string[] = [];
  for (const [id, e] of Object.entries(c.quests)) {
    const packed = packQuest(e);
    if (packed === 'd' && QUEST_INDEX.has(id)) done.push(id);
    else quests[id] = packed;
  }
  return {
    ...c,
    quests,
    qd: packBits(done, QUEST_TABLE, QUEST_INDEX),
    opened: c.opened.filter((k) => !OPENED_INDEX.has(k)),
    ok: packBits(c.opened, OPENED_TABLE, OPENED_INDEX),
    seen: Object.fromEntries(Object.entries(c.seen).map(([k, v]) => [k, compactFog(v)])),
    bag: c.bag.slice(0, bagSize(c) + BAG_OVERFLOW),
  };
}

/** The save as stored: each hero as storedHero. */
export function saveText(save: SaveFile): string {
  return JSON.stringify({ ...save, heroes: save.heroes.map((h) => (h ? storedHero(h) : null)) });
}

export function writeSave(save: SaveFile): boolean {
  try {
    save.saved = Date.now();
    const text = saveText(save);
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
