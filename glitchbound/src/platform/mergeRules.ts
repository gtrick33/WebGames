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

/**
 * Sigilfall's Ring (its save is `sigilfall.ring.v1`, apart from the game's own): what a player builds and where they
 * stand, which the shared merge got wrong (the owner: "persistent builds, if i edit setup 123, they should remain
 * updated in the database and be saved to my account"). It kept the larger setup number (choosing Setup 1 after
 * Setup 3 went back to 3) and took a class's setups whole from this device even when the account's were newer, so
 * an old copy on one device put back what had been changed on another; and it mixed a format's standing number by
 * number (one copy's rating with the other's losses).
 *
 * - A class's setups (`sets[class]`) come whole from the copy changed last: each is stamped `at` when it changes.
 * - A format's standing (`standings[format]`) comes whole from the copy that fought more matches in it (then the
 *   copy changed last), keeping the best rating either reached: a rank once reached is kept.
 * - The computer teammates chosen and the Ring armor worn follow the copy changed last; what the Ring has taught
 *   (the tutorial offered or finished, the hints shown) is joined.
 */
const mergeRing: MergeRule = (local, remote, ctx) => {
  const out = ctx.merge(local, remote);
  if (!isObj(local) || !isObj(remote) || !isObj(out)) return out;
  const later = <T>(l: T | undefined, r: T | undefined): T | undefined => (ctx.newer === 'local' ? (l ?? r) : (r ?? l));
  // each class's setups: the copy changed last (by its stamp; this device's or the account's by which changed last)
  if (isObj(local.sets) || isObj(remote.sets)) {
    const ls = isObj(local.sets) ? local.sets : {};
    const rs = isObj(remote.sets) ? remote.sets : {};
    const sets: Obj = {};
    for (const cls of new Set([...Object.keys(ls), ...Object.keys(rs)])) {
      const l = ls[cls];
      const r = rs[cls];
      const lt = isObj(l) ? num(l.at) : -1;
      const rt = isObj(r) ? num(r.at) : -1;
      sets[cls] = lt !== rt ? (lt > rt ? l : r) : later(l, r);
    }
    out.sets = sets;
  }
  // each format's standing: whole, from the copy that fought more there; the best either reached is kept
  if (isObj(local.standings) || isObj(remote.standings)) {
    const ls = isObj(local.standings) ? local.standings : {};
    const rs = isObj(remote.standings) ? remote.standings : {};
    const standings: Obj = {};
    const fought = (s: unknown): number => (isObj(s) ? num(s.wins) + num(s.losses) : -1);
    for (const f of new Set([...Object.keys(ls), ...Object.keys(rs)])) {
      const l = ls[f];
      const r = rs[f];
      const pick = fought(l) !== fought(r) ? (fought(l) > fought(r) ? l : r) : later(l, r);
      standings[f] = isObj(pick) ? { ...pick, best: Math.max(isObj(l) ? num(l.best) : 0, isObj(r) ? num(r.best) : 0, num(pick.best)) } : pick;
    }
    out.standings = standings;
  }
  if (isObj(local.mates) || isObj(remote.mates)) {
    const lm = isObj(local.mates) ? local.mates : {};
    const rm = isObj(remote.mates) ? remote.mates : {};
    out.mates = ctx.newer === 'local' ? { ...rm, ...lm } : { ...lm, ...rm };
  }
  if (local.plain !== undefined || remote.plain !== undefined) out.plain = later(local.plain, remote.plain);
  if (local.frame !== undefined || remote.frame !== undefined) out.frame = later(local.frame, remote.frame);
  if (isObj(local.learn) || isObj(remote.learn)) {
    const ll = isObj(local.learn) ? local.learn : {};
    const rl = isObj(remote.learn) ? remote.learn : {};
    const hints = [...(isWords(ll.hints) ? ll.hints : []), ...(isWords(rl.hints) ? rl.hints : [])];
    out.learn = { asked: ll.asked === true || rl.asked === true, done: ll.done === true || rl.done === true, hints: [...new Set(hints)] };
  }
  if (isObj(local.record) || isObj(remote.record)) out.record = mergeRingRecord(isObj(local.record) ? local.record : {}, isObj(remote.record) ? remote.record : {});
  return out;
};

/**
 * The Ring's record (games/sigilfall/arena/record.ts), joined so that neither device's progress is lost: the history
 * is both copies' matches, newest first, the last twenty; a class's mastery the copy with more matches with it; the
 * day's and the week's challenges the later period's, or, the same period on both, the further along of each and every
 * one done on either; the challenges finished, the greater; the season the later, or, the same, each format's best
 * of the two, the greater of the track's points and the seasons gone by from both; what the track gave, on either.
 */
function mergeRingRecord(l: Obj, r: Obj): Obj {
  const out: Obj = { ...r, ...l };
  const lh = Array.isArray(l.history) ? l.history : [];
  const rh = Array.isArray(r.history) ? r.history : [];
  const byAt = new Map<number, unknown>();
  for (const h of [...lh, ...rh]) if (isObj(h)) byAt.set(num(h.at), h);
  out.history = [...byAt.entries()].sort((a, b) => b[0] - a[0]).slice(0, 20).map(([, h]) => h);
  if (isObj(l.mastery) || isObj(r.mastery)) {
    const lm = isObj(l.mastery) ? l.mastery : {};
    const rm = isObj(r.mastery) ? r.mastery : {};
    const mastery: Obj = {};
    for (const cls of new Set([...Object.keys(lm), ...Object.keys(rm)])) {
      const a = lm[cls];
      const b = rm[cls];
      mastery[cls] = (isObj(a) ? num(a.played) : -1) >= (isObj(b) ? num(b.played) : -1) ? a : b;
    }
    out.mastery = mastery;
  }
  for (const k of ['daily', 'weekly'] as const) {
    const a = l[k];
    const b = r[k];
    if (!isObj(a) || !isObj(b)) {
      out[k] = isObj(a) ? a : b;
      continue;
    }
    const ak = typeof a.key === 'string' ? a.key : '';
    const bk = typeof b.key === 'string' ? b.key : '';
    if (ak !== bk) {
      out[k] = ak > bk ? a : b;
      continue;
    }
    const got: Obj = {};
    const ag = isObj(a.got) ? a.got : {};
    const bg = isObj(b.got) ? b.got : {};
    for (const id of new Set([...Object.keys(ag), ...Object.keys(bg)])) got[id] = Math.max(num(ag[id]), num(bg[id]));
    const words = (w: unknown): string[] => (isWords(w) ? w : []);
    out[k] = { key: ak, got, done: [...new Set([...words(a.done), ...words(b.done)])], seen: [...new Set([...words(a.seen), ...words(b.seen)])] };
  }
  out.finished = Math.max(num(l.finished), num(r.finished));
  // (what the season track gave, on either device, is kept)
  const le = isWords(l.earned) ? l.earned : [];
  const re = isWords(r.earned) ? r.earned : [];
  if (le.length || re.length) out.earned = [...new Set([...le, ...re])];
  const ls = l.season;
  const rs = r.season;
  if (isObj(ls) && isObj(rs)) {
    if (num(ls.n) !== num(rs.n)) out.season = num(ls.n) > num(rs.n) ? ls : rs;
    else {
      const lb = isObj(ls.best) ? ls.best : {};
      const rb = isObj(rs.best) ? rs.best : {};
      const best: Obj = {};
      for (const f of new Set([...Object.keys(lb), ...Object.keys(rb)])) best[f] = Math.max(num(lb[f]), num(rb[f]));
      const past = new Map<number, unknown>();
      for (const p of [...(Array.isArray(rs.past) ? rs.past : []), ...(Array.isArray(ls.past) ? ls.past : [])]) if (isObj(p)) past.set(num(p.n), p);
      out.season = { n: num(ls.n), best, points: Math.max(num(ls.points), num(rs.points)), past: [...past.entries()].sort((a, b) => b[0] - a[0]).map(([, p]) => p) };
    }
  } else out.season = isObj(ls) ? ls : rs;
  return out;
}

/** Rules for one save of a game that keeps more than one (by its storage key), ahead of the game's own rule. */
export const KEY_RULES: Record<string, MergeRule> = {
  'sigilfall.ring.v1': mergeRing,
};

export const MERGE_RULES: Record<string, MergeRule> = {
  'launch-control': mergeGarage,
  sigilfall: mergeSigilfall,
  'neon-rush': mergeNeonRush,
};
