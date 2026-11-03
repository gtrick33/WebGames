import type { DailyRecord, OwnedCar, Save as GarageSave } from '../games/launch-control/storage';
import type { Character } from '../games/sigilfall/progress/character';
import type { SaveFile as SigilfallSave } from '../games/sigilfall/progress/save';

/**
 * Merge rules for games whose save the shared merge (cloudMerge.ts mergeJson) gets wrong, by slug. A rule
 * gets the two copies (`local` this device's, `remote` the account's, both untrusted JSON) and returns the
 * joined save; the game's own loader still validates it. Games without a rule keep the shared merge.
 */

/** Which copy changed last. */
export type Side = 'local' | 'remote';
export interface MergeContext {
  newer: Side;
  /** The shared merge (numbers keep the larger, lists join...), for the fields a rule leaves to it. */
  merge: (local: unknown, remote: unknown, key?: string) => unknown;
}
export type MergeRule = (local: unknown, remote: unknown, ctx: MergeContext) => unknown;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isWords = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
/** The smaller of two that are set (0 = not set). */
const minSet = (a: unknown, b: unknown): number => {
  const x = num(a);
  const y = num(b);
  return x > 0 && y > 0 ? Math.min(x, y) : Math.max(x, y);
};
const laterDay = (a: unknown, b: unknown): string => {
  const x = typeof a === 'string' ? a : '';
  const y = typeof b === 'string' ? b : '';
  return y > x ? y : x;
};

/**
 * Launch Control: what one device spent or won is a balance, not a high score. Cash, parts and each car's
 * wear come from the copy changed last (a max paid back the other device's purchases and undid tyre
 * wear, LC-04); cars join, part levels keep the higher, the best ET the faster, and a day's showdown the
 * most runs used and the best result.
 */
const mergeGarage: MergeRule = (local, remote, ctx) => {
  const out = ctx.merge(local, remote);
  if (!isObj(local) || !isObj(remote) || !isObj(out)) return out;
  const o = out as Partial<Record<keyof GarageSave, unknown>>;
  const l = local as Partial<GarageSave>;
  const r = remote as Partial<GarageSave>;
  const [n, old] = ctx.newer === 'local' ? [l, r] : [r, l];
  for (const k of ['cash', 'mats', 'car', 'muted', 'musicOff'] as const) if (n[k] !== undefined) o[k] = n[k];
  if (isObj(o.cars) && isObj(n.cars) && isObj(old.cars)) {
    const cars = o.cars as Record<string, Partial<OwnedCar>>;
    for (const id of Object.keys(cars)) {
      const a = n.cars[id];
      const b = old.cars[id];
      if (isObj(a) && isObj(b) && isObj(cars[id])) cars[id] = { ...cars[id], cond: a.cond ?? b.cond };
    }
  }
  o.bestEt = minSet(l.bestEt, r.bestEt);
  o.crateDay = laterDay(l.crateDay, r.crateDay);
  o.testDay = laterDay(l.testDay, r.testDay);
  if (isObj(o.daily) && isObj(l.daily) && isObj(r.daily)) {
    const days = o.daily as Record<string, unknown>;
    for (const day of Object.keys(days)) {
      const a = n.daily?.[day];
      const b = old.daily?.[day];
      if (!isObj(a) || !isObj(b)) continue;
      // the run under way (or left) is the one of the copy that used more runs
      const flags = num(b.tries) > num(a.tries) ? b : a;
      const rec: DailyRecord = { best: Math.max(num(a.best), num(b.best)), tries: Math.max(num(a.tries), num(b.tries)), et: minSet(a.et, b.et) };
      if (flags.open === true) rec.open = true;
      if (flags.left === true) rec.left = true;
      days[day] = rec;
    }
  }
  return o;
};

/** How far a hero got: level, then paragon level, then quests done. */
function progress(h: Obj): number[] {
  const para = isObj(h.para) ? num(h.para.l) : 0;
  const quests = isObj(h.quests) ? Object.values(h.quests).filter((q) => q === 'd' || q === 'x' || (isObj(q) && q.state === 'done')).length : 0;
  return [num(h.level), para, quests, num(h.updated)];
}

function pickHero(local: unknown, remote: unknown): unknown {
  if (!isObj(remote)) return local ?? remote ?? null;
  if (!isObj(local)) return remote;
  const l = local as Partial<Character> & Obj;
  const r = remote as Partial<Character> & Obj;
  // another hero in that slot (one was deleted and a new one made): the one played last
  if (l.id !== r.id) return num(r.updated) > num(l.updated) ? remote : local;
  // The same hero on both: the one that got further. `updated` alone isn't enough: just opening a hero
  // stamps it, so an old copy opened on a second device looked newer than the one played on (SFS-01).
  const a = progress(l);
  const b = progress(r);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i]! > a[i]! ? remote : local;
  return local;
}

/**
 * Sigilfall: each hero slot keeps the copy that got further (level, paragon, quests done, then the one
 * played last); the settings come whole from the copy saved last (a max raised a lowered volume, SFS-10).
 */
const mergeSigilfall: MergeRule = (local, remote, ctx) => {
  const out = ctx.merge(local, remote);
  if (!isObj(local) || !isObj(remote) || !isObj(out)) return out;
  const o = out as Partial<Record<keyof SigilfallSave, unknown>>;
  const l = local as Partial<SigilfallSave>;
  const r = remote as Partial<SigilfallSave>;
  if (Array.isArray(l.heroes) && Array.isArray(r.heroes))
    o.heroes = Array.from({ length: Math.max(l.heroes.length, r.heroes.length) }, (_, i) => pickHero(l.heroes![i], r.heroes![i]) ?? null);
  const ls = num(l.saved);
  const rs = num(r.saved);
  const newer = ls !== rs && ls > 0 && rs > 0 ? (ls > rs ? l : r) : ctx.newer === 'local' ? l : r;
  const older = newer === l ? r : l;
  if (isObj(newer.settings)) o.settings = { ...(isObj(older.settings) ? older.settings : {}), ...newer.settings };
  if (newer.last !== undefined) o.last = newer.last;
  return o;
};

/** Joins two lists of ids, the account's first: a capped list then keeps the ones this device just added. */
const joinIds = (local: string[], remote: string[]): string[] => [...remote, ...local.filter((x) => !remote.includes(x))];

/**
 * NEON RUSH (its save is `neonrush.save`): coins, xp and bests keep the larger (the shared merge); owned
 * cars, achievements and the ids that stop a reward being paid twice join; the car driven and the
 * settings follow the copy changed last.
 */
const mergeNeonRush: MergeRule = (local, remote, ctx) => {
  const out = ctx.merge(local, remote);
  if (!isObj(local) || !isObj(remote) || !isObj(out)) return out;
  const n = ctx.newer === 'local' ? local : remote;
  for (const k of ['ownedSkins', 'entitlements', 'processedRunIds', 'grantedRewardIds', 'processedTransactions'])
    if (isWords(local[k]) && isWords(remote[k])) out[k] = joinIds(local[k], remote[k]);
  if (isObj(local.achievements) && isObj(remote.achievements)) {
    // id -> when it was first unlocked
    const a: Record<string, number> = {};
    for (const [id, at] of [...Object.entries(remote.achievements), ...Object.entries(local.achievements)]) a[id] = id in a ? minSet(a[id], at) : num(at);
    out.achievements = a;
  }
  if (typeof n.equippedSkin === 'string') out.equippedSkin = n.equippedSkin;
  // the racer name chosen last (an unnamed copy never clears one)
  const o = n === local ? remote : local;
  if (typeof n.playerName === 'string' && n.playerName) out.playerName = n.playerName;
  else if (typeof o.playerName === 'string' && o.playerName) out.playerName = o.playerName;
  // one leaderboard id per account: the one the account already has
  if (typeof remote.playerId === 'string' && remote.playerId) out.playerId = remote.playerId;
  if (num(local.createdAt) > 0 && num(remote.createdAt) > 0) out.createdAt = Math.min(num(local.createdAt), num(remote.createdAt));
  // the daily reward streak of the copy that claimed last
  if (isObj(local.daily) && isObj(remote.daily)) out.daily = laterDay(local.daily.lastClaimDay, remote.daily.lastClaimDay) === local.daily.lastClaimDay ? local.daily : remote.daily;
  return out;
};

export const MERGE_RULES: Record<string, MergeRule> = {
  'launch-control': mergeGarage,
  sigilfall: mergeSigilfall,
  'neon-rush': mergeNeonRush,
};
