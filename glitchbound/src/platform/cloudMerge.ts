import { GAMES } from '../catalog/games';
import { dayKey } from './dates';
import { mergeSaves, sanitizeSave } from './save';
import { ARCADE_SAVE_KEY } from './syncKeys';

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
 * - Numbers keep the larger (counts and bests); names like "fastest" keep the smaller one set.
 * - Lists of words (e.g. questions already seen) are joined; any other value is this device's.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LOWER_IS_BETTER = /fastest|fewest|least|lowest|min/i;

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
const isDayMap = (v: Json): v is Record<string, Json> => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => DAY.test(k));
const isWords = (v: Json): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

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

export function mergeJson(local: Json, remote: Json, key = ''): Json {
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
    const out: Record<string, Json> = { ...remote, ...local };
    for (const k of Object.keys(local)) if (k in remote) out[k] = mergeJson(local[k], remote[k], k);
    return out;
  }
  if (typeof local === 'number' && typeof remote === 'number') {
    if (!LOWER_IS_BETTER.test(key)) return Math.max(local, remote);
    // 0 means "not set yet" for these.
    return local > 0 && remote > 0 ? Math.min(local, remote) : Math.max(local, remote);
  }
  if (isWords(local) && isWords(remote)) return [...local, ...remote.filter((w) => !local.includes(w))];
  return local === undefined ? remote : local;
}

/** Merges two copies of the save stored under `key` (JSON text in, JSON text out). */
export function mergeSaveText(key: string, local: string, remote: string, today = dayKey()): string {
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
  return JSON.stringify(mergeJson(a, b));
}
