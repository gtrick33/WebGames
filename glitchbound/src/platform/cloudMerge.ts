import { GAMES } from '../catalog/games';
import { dayKey } from './dates';
import { KEY_RULES, MERGE_RULES, type Side } from './mergeRules';
import { mergeSaves, sanitizeSave } from './save';
import { ARCADE_SAVE_KEY, slugOfKey } from './syncKeys';

/**
 * Joins two copies of one save, when two devices of a signed-in player both changed it before they
 * synced (platform/cloudSave.ts). `local` is this device's copy, `remote` the server's. The arcade save
 * has a field-by-field merge (save.ts mergeSaves); a game's own save is merged by the shape the games
 * share, so nothing either device finished is lost:
 *
 * - Per-day maps ("2026-10-20": record) keep every day from both. For a day both have, the record that
 *   got further wins whole: cleared/solved over settled over in progress, then more filled in, then this device.
 * - An object with a `day` (a half-played round's snapshot) is never mixed: the later day wins, then the one
 *   played further (more filled in), then this device.
 * - A game in progress (`current`: a board game's match, its dice and whose turn it is) is never mixed either:
 *   this device's copy wins whole (a mix of two boards could leave a game that cannot go on, issue #26).
 * - Numbers keep the larger (counts and bests); names like "fastest" keep the smaller one set.
 * - Lists of words (e.g. questions already seen) are joined; any other value is this device's.
 * - Lists of records stamped `updated` keep, slot by slot, the copy played last.
 * - `settings` (volumes, control sizes) come whole from the copy changed last: they aren't scores.
 *
 * Games whose save needs more (a balance that is spent, a hero's progress) have their own rule
 * (mergeRules.ts).
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LOWER_IS_BETTER = /fastest|fewest|least|lowest|min/i;

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
const isDayMap = (v: Json): v is Record<string, Json> => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => DAY.test(k));
const isWords = (v: Json): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
/** A list of slots, each empty or a record stamped with when it last changed. */
const isStamped = (v: Json): v is (Record<string, Json> | null)[] => Array.isArray(v) && v.some((x) => isObj(x)) && v.every((x) => x === null || (isObj(x) && typeof x.updated === 'number'));
const stamp = (x: Json): number => (isObj(x) && typeof x.updated === 'number' ? x.updated : -1);

/** How much of a record is filled in: its non-zero numbers, true flags and non-empty strings (a fresh round has few). */
function filled(v: Json): number {
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + filled(x), 0);
  if (isObj(v)) return Object.values(v).reduce<number>((n, x) => n + filled(x), 0);
  return v ? 1 : 0;
}

/** How far a day's record got: in progress (open) < settled < cleared or solved; a list counts its results. */
function reach(v: Json): number {
  if (Array.isArray(v)) return v.length;
  if (!isObj(v)) return 0;
  if (v.open === true) return 1;
  if (v.done === true || v.solved === true) return 3;
  return 2;
}

function pickDay(local: Json, remote: Json): Json {
  const a = reach(local);
  const b = reach(remote);
  if (a !== b) return a > b ? local : remote;
  return filled(remote) > filled(local) ? remote : local;
}

/** `newer` is the copy changed last (this device's when unknown). */
export function mergeJson(local: Json, remote: Json, key = '', newer: Side = 'local'): Json {
  if (isDayMap(local) && isDayMap(remote)) {
    const out: Record<string, Json> = { ...remote, ...local };
    for (const day of Object.keys(local)) if (day in remote) out[day] = pickDay(local[day], remote[day]);
    return out;
  }
  if (isObj(local) && isObj(remote)) {
    if (typeof local.day === 'string' || typeof remote.day === 'string') {
      if (typeof local.day !== 'string') return remote;
      if (typeof remote.day !== 'string') return local;
      if (remote.day !== local.day) return remote.day > local.day ? remote : local;
      // The same day's round on both: the one played further (a round just restarted here has little filled in).
      return filled(remote) > filled(local) ? remote : local;
    }
    if (key === 'current') return local;
    if (key === 'settings') return newer === 'local' ? { ...remote, ...local } : { ...local, ...remote };
    const out: Record<string, Json> = { ...remote, ...local };
    for (const k of Object.keys(local)) if (k in remote) out[k] = mergeJson(local[k], remote[k], k, newer);
    return out;
  }
  if (typeof local === 'number' && typeof remote === 'number') {
    if (!LOWER_IS_BETTER.test(key)) return Math.max(local, remote);
    // 0 means "not set yet" for these.
    return local > 0 && remote > 0 ? Math.min(local, remote) : Math.max(local, remote);
  }
  if (isWords(local) && isWords(remote)) return [...local, ...remote.filter((w) => !local.includes(w))];
  if (isStamped(local) && isStamped(remote)) return Array.from({ length: Math.max(local.length, remote.length) }, (_, i) => (stamp(remote[i]) > stamp(local[i]) ? remote[i] : (local[i] ?? remote[i] ?? null)));
  return local === undefined ? remote : local;
}

/** Merges two copies of the save stored under `key` (JSON text in, JSON text out); `newer` is the copy changed last. */
export function mergeSaveText(key: string, local: string, remote: string, today = dayKey(), newer: Side = 'local'): string {
  let a: Json;
  let b: Json;
  try {
    b = JSON.parse(remote);
  } catch {
    return local;
  }
  try {
    a = JSON.parse(local);
  } catch {
    return remote;
  }
  if (key === ARCADE_SAVE_KEY) return JSON.stringify(mergeSaves(sanitizeSave(a), sanitizeSave(b), GAMES, today));
  const rule = KEY_RULES[key] ?? MERGE_RULES[slugOfKey(key) ?? ''];
  if (rule) return JSON.stringify(rule(a, b, { newer, merge: (l, r, k) => mergeJson(l, r, k, newer) }));
  return JSON.stringify(mergeJson(a, b, '', newer));
}
