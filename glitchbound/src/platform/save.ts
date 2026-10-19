import type { GameEntry } from '../catalog/types';
import type { EndEvent } from './contract';
import { addDays, dayKey } from './dates';
import { challengeForDay, metricValue } from './daily';
import { currentSlug } from '../catalog/catalog';

/**
 * Anonymous, device-local player data. Nothing here leaves the browser.
 * Versioned so future fields can be migrated; anything malformed is repaired or dropped.
 */
export interface GameRecord {
  /** Finished rounds played through GlitchBound. */
  plays: number;
  /** Best value per stat key. */
  best: Record<string, number>;
  /** Epoch ms of the last finished round. */
  last: number;
}

export interface DailyRecord {
  best: number;
  done: boolean;
}

export interface Save {
  v: 1;
  games: Record<string, GameRecord>;
  daily: Record<string, DailyRecord>;
  /** Per day, the games whose own daily puzzle was finished (see GameEntry.ownDaily). */
  gameDailies: Record<string, string[]>;
}

export const SAVE_KEY = 'glitchbound.save';
export const DAILY_HISTORY_DAYS = 60;

export const emptySave = (): Save => ({ v: 1, games: {}, daily: {}, gameDailies: {} });

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Turns any parsed JSON into a valid Save, keeping whatever parts are valid. */
export function sanitizeSave(raw: unknown): Save {
  const save = emptySave();
  if (!isObj(raw) || raw.v !== 1) return save;
  if (isObj(raw.games)) {
    for (const [slug, rec] of Object.entries(raw.games)) {
      if (!isObj(rec) || !/^[a-z0-9-]{1,64}$/.test(slug)) continue;
      const best: Record<string, number> = {};
      if (isObj(rec.best)) for (const [k, v] of Object.entries(rec.best)) if (isNum(v)) best[k] = Math.floor(v);
      save.games[currentSlug(slug)] = { plays: isNum(rec.plays) ? Math.floor(rec.plays) : 0, best, last: isNum(rec.last) ? rec.last : 0 };
    }
  }
  if (isObj(raw.daily)) {
    for (const [day, rec] of Object.entries(raw.daily)) {
      if (!isObj(rec) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      save.daily[day] = { best: isNum(rec.best) ? rec.best : 0, done: rec.done === true };
    }
  }
  if (isObj(raw.gameDailies)) {
    for (const [day, slugs] of Object.entries(raw.gameDailies)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(slugs)) continue;
      const valid = slugs.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,64}$/.test(s));
      if (valid.length) save.gameDailies[day] = [...new Set(valid.map(currentSlug))].slice(0, 64);
    }
  }
  return save;
}

export interface RoundResult {
  /** Stat keys where this round set a new personal best (only when a previous best existed). */
  newBests: string[];
  firstPlay: boolean;
  /** True when this round completed today's daily challenge for the first time. */
  dailyCompleted: boolean;
  /** True when this round finished the game's own daily puzzle for the first time today. */
  gameDailyCompleted: boolean;
}

/** Applies a finished round to the save (mutates it) and reports what changed. */
export function applyRound(save: Save, game: GameEntry, event: EndEvent, games: GameEntry[], now: Date = new Date()): RoundResult {
  const rec = (save.games[game.slug] ??= { plays: 0, best: {}, last: 0 });
  const firstPlay = rec.plays === 0;
  const values: Record<string, number> = { ...event.stats, score: event.score };
  const newBests: string[] = [];
  for (const stat of game.stats) {
    const v = values[stat.key];
    if (v === undefined) continue;
    const prev = rec.best[stat.key];
    const better = prev === undefined || (stat.lowerIsBetter ? v < prev : v > prev);
    if (better) {
      if (prev !== undefined) newBests.push(stat.key);
      rec.best[stat.key] = v;
    }
  }
  rec.plays += 1;
  rec.last = now.getTime();

  let dailyCompleted = false;
  const today = dayKey(now);
  const challenge = challengeForDay(today, games);
  if (challenge && challenge.game.slug === game.slug) {
    const value = metricValue(challenge.metric, event);
    const d = (save.daily[today] ??= { best: 0, done: false });
    d.best = Math.max(d.best, value);
    if (!d.done && value >= challenge.target) {
      d.done = true;
      dailyCompleted = true;
    }
  }
  let gameDailyCompleted = false;
  if (event.daily && game.ownDaily) {
    const list = (save.gameDailies[today] ??= []);
    if (!list.includes(game.slug)) {
      list.push(game.slug);
      gameDailyCompleted = true;
    }
  }
  pruneDaily(save, today);
  return { newBests, firstPlay, dailyCompleted, gameDailyCompleted };
}

export function pruneDaily(save: Save, today: string): void {
  const oldest = addDays(today, -DAILY_HISTORY_DAYS);
  for (const day of Object.keys(save.daily)) if (day < oldest) delete save.daily[day];
  for (const day of Object.keys(save.gameDailies)) if (day < oldest) delete save.gameDailies[day];
}

/** Days that keep the streak alive: the arcade challenge was cleared or any game's own daily was finished. */
export function doneDays(save: Save): Set<string> {
  const days = new Set(Object.entries(save.daily).filter(([, d]) => d.done).map(([day]) => day));
  for (const [day, slugs] of Object.entries(save.gameDailies)) if (slugs.length) days.add(day);
  return days;
}

/** Games played on this device, most recent first. */
export function recentSlugs(save: Save): string[] {
  return Object.entries(save.games)
    .filter(([, r]) => r.plays > 0)
    .sort((a, b) => b[1].last - a[1].last)
    .map(([slug]) => slug);
}

/* ------------------------------------------------------------------ */
/* Persistence. localStorage may be missing, full, blocked or corrupted. */

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

export function browserKV(): { kv: KV; persistent: boolean } {
  try {
    const ls = window.localStorage;
    const probe = '__gb_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { kv: ls, persistent: true };
  } catch {
    return { kv: memoryKV(), persistent: false };
  }
}

export function readSave(kv: KV): Save {
  let text: string | null;
  try {
    text = kv.getItem(SAVE_KEY);
  } catch {
    return emptySave();
  }
  if (!text) return emptySave();
  try {
    return sanitizeSave(JSON.parse(text));
  } catch {
    // Unreadable: keep a copy for debugging and start fresh rather than crashing the site.
    try {
      kv.setItem(`${SAVE_KEY}.corrupt`, text.slice(0, 50_000));
    } catch {
      /* ignore */
    }
    return emptySave();
  }
}

export function writeSave(kv: KV, save: Save): boolean {
  try {
    kv.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
