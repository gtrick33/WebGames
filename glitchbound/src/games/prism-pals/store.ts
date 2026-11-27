/** The local save (`glitchbound.prism-pals`), validated on load, and the day's and the challenge's level. */
import { daysBetween, hashString } from '../../platform/dates';
import { isColorId, type ColorId } from './critters';
import { critters, LEVEL_COUNT, packLevels, PACKS, type Pack } from './rules';

export const KEY = 'glitchbound.prism-pals';
export const EPOCH = '2026-11-27';
export const SLUG = 'prism-pals';
export type Mode = 'daily' | 'solo' | 'challenge';

interface LevelBest {
  best: number;
  gems: number;
  secs: number;
}
interface Done {
  score: number;
  line: string;
  gems: number;
}
export interface Save {
  best: number;
  runs: number;
  levels: Record<number, LevelBest>;
  daily: Record<string, { best: number; tries: number; line: string }>;
  /** Friends' challenge rounds played, by `${id}:${round}` (one attempt each), the newest last. */
  ch: Record<string, Done>;
  muted: boolean;
  name: string;
  color: ColorId;
  pack: Pack;
}
export const MAX_ROUNDS = 20;

export const emptySave = (): Save => ({ best: 0, runs: 0, levels: {}, daily: {}, ch: {}, muted: false, name: '', color: 0, pack: 2 });

/** Saves are untrusted input: every field is checked. */
export function loadSave(raw: string | null): Save {
  const s = emptySave();
  try {
    const o = JSON.parse(raw ?? '{}') as Partial<Save>;
    const n = (v: unknown, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
    s.best = n(o.best, 10_000);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    s.name = typeof o.name === 'string' ? o.name.slice(0, 20) : '';
    s.color = isColorId(o.color) ? o.color : 0;
    s.pack = (PACKS as readonly unknown[]).includes(o.pack) ? (o.pack as Pack) : 2;
    if (o.levels && typeof o.levels === 'object')
      for (const [k, v] of Object.entries(o.levels)) {
        const i = Number(k);
        if (Number.isInteger(i) && i >= 0 && i < LEVEL_COUNT && v && typeof v === 'object') s.levels[i] = { best: n(v.best, 10_000), gems: n(v.gems, 99), secs: n(v.secs, 1e6) };
      }
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best, 10_000), tries: n(v.tries), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '' };
    if (o.ch && typeof o.ch === 'object')
      for (const [k, v] of Object.entries(o.ch).slice(-MAX_ROUNDS))
        if (k.length <= 120 && v && typeof v === 'object') s.ch[k] = { score: n(v.score, 10_000), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '', gems: n(v.gems, 99) };
  } catch {
    /* a broken save starts afresh */
  }
  return s;
}
export function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : loadSave(raw);
  } catch {
    return null;
  }
}
export const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};

export const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
/** Today's level: a seeded pick, the same for everyone. */
export const dailyLevel = (day: string): number => hashString(`${SLUG}:${day}`) % LEVEL_COUNT;
export const challengeLevel = (seed: number): number => (seed >>> 0) % LEVEL_COUNT;
/** Level i is open once the one before it in its set is cleared (each set's first is always open). */
export const unlocked = (save: Save, i: number): boolean => {
  const set = packLevels(critters(i));
  const at = set.indexOf(i);
  return at <= 0 || save.levels[set[at - 1]!] !== undefined;
};
/** A level's number within its set (1 to 8). */
export const levelLabel = (i: number): string => `${packLevels(critters(i)).indexOf(i) + 1}`;

