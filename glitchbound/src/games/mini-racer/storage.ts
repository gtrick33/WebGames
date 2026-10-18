import { decodeGhost, encodeGhost, type Ghost } from './ghost';
import { CARS, DEFAULT_CAR } from './cars';
import { DEFAULT_AI_LEVEL, type RaceMode } from './sim';

/** Local-only saves (bests, ghosts, settings). Every access is guarded: storage can be missing or full. */

const KEY = 'gb.mini-racer.v1';
const GHOST_PREFIX = 'gb.mini-racer.ghost.';

export interface Bests {
  /** Best valid lap, seconds. */
  lap?: number;
  /** Best 3-lap race, seconds. */
  race?: number;
  /** Cumulative sector splits of the best lap with sector data (Time Trial reference). */
  splits?: number[];
  /** Best finishing position against AI. */
  position?: number;
  /** Highest AI level you have won a race against. */
  wonLevel?: number;
}

export interface SaveData {
  bests: Record<string, Bests>;
  coins: number;
  /** Lifetime coins earned (for stats). */
  earned: number;
  cars: string[];
  car: string;
  muted: boolean;
  track: string;
  /** Days whose daily-track coin bonus was already paid. Only the latest few are kept. */
  dailyPaid: string[];
  mode: RaceMode;
  /** AI level 0-100 for races. */
  aiLevel: number;
}

function defaults(): SaveData {
  return { bests: {}, coins: 0, earned: 0, cars: [DEFAULT_CAR], car: DEFAULT_CAR, muted: false, track: 'sunny-bay', dailyPaid: [], mode: 'trial', aiLevel: DEFAULT_AI_LEVEL };
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function loadSave(): SaveData {
  const d = defaults();
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.bests && typeof o.bests === 'object') {
      for (const [k, v] of Object.entries(o.bests as Record<string, unknown>)) {
        if (!v || typeof v !== 'object') continue;
        const b: Bests = {};
        for (const f of ['lap', 'race', 'position', 'wonLevel'] as const) {
          const n = (v as Bests)[f];
          if (typeof n === 'number' && Number.isFinite(n) && n > 0) b[f] = n;
        }
        const sp = (v as Bests).splits;
        if (Array.isArray(sp) && sp.length === 3 && sp.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) b.splits = sp;
        d.bests[k] = b;
      }
    }
    d.coins = num(o.coins);
    d.earned = num(o.earned);
    const known = new Set(CARS.map((c) => c.id));
    if (Array.isArray(o.cars)) d.cars = [...new Set([DEFAULT_CAR, ...o.cars.filter((c): c is string => typeof c === 'string' && known.has(c))])];
    d.car = typeof o.car === 'string' && d.cars.includes(o.car) ? o.car : DEFAULT_CAR;
    d.muted = o.muted === true;
    if (typeof o.track === 'string') d.track = o.track;
    if (o.mode === 'race') d.mode = 'race';
    if (typeof o.aiLevel === 'number' && Number.isFinite(o.aiLevel)) d.aiLevel = Math.max(0, Math.min(100, Math.round(o.aiLevel)));
    // Older saves stored a named difficulty.
    else if (o.difficulty === 'easy' || o.difficulty === 'medium' || o.difficulty === 'hard') d.aiLevel = { easy: 25, medium: 50, hard: 75 }[o.difficulty];
    if (Array.isArray(o.dailyPaid)) d.dailyPaid = o.dailyPaid.filter((x): x is string => typeof x === 'string').slice(-7);
    return d;
  } catch {
    return d;
  }
}

export function writeSave(s: SaveData): void {
  try {
    store()?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* full or blocked */
  }
}

export function loadGhost(trackId: string): Ghost | null {
  try {
    return decodeGhost(store()?.getItem(GHOST_PREFIX + trackId) ?? null);
  } catch {
    return null;
  }
}

export function saveGhost(trackId: string, g: Ghost): void {
  const s = store();
  if (!s) return;
  try {
    // Daily ghosts expire with their day: drop the old ones first.
    if (trackId.startsWith('daily-')) {
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && k.startsWith(GHOST_PREFIX + 'daily-') && k !== GHOST_PREFIX + trackId) s.removeItem(k);
      }
    }
    s.setItem(GHOST_PREFIX + trackId, encodeGhost(g));
  } catch {
    /* full or blocked */
  }
}
