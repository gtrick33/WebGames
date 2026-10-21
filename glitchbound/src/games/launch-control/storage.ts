import { CARS, DEFAULT_CAR } from './cars';
import { COSMETICS, DEFAULTS, getCosmetic, type CosmeticKind } from './cosmetics';
import { emptyMats, LADDER_SIZE } from './economy';
import { freshCondition, MATERIALS, MAX_LEVEL, PARTS, stockLevels, wears, type Condition, type Levels, type Material } from './parts';
import { clamp } from './util';

/** The local save: synced to the cloud for members (its key matches platform/syncKeys.ts). Every field is validated on load. */
export const KEY = 'glitchbound.launch-control';
/** Today's showdown is three runs a day; the best counts. */
export const DAILY_TRIES = 3;

export interface OwnedCar {
  levels: Levels;
  cond: Condition;
  paint: string;
  livery: string;
  wheels: string;
}

export interface DailyRecord {
  best: number;
  tries: number;
  /** Best run's ET in ms (0 = none finished). */
  et: number;
  /** A run is under way (settled as 0 if the page is left). */
  open?: boolean;
  left?: boolean;
}

export interface Save {
  cash: number;
  earned: number;
  mats: Record<Material, number>;
  cars: Record<string, OwnedCar>;
  car: string;
  /** Rivals beaten on the ladder (the next one is LADDER[rank]). */
  rank: number;
  helmet: string;
  suit: string;
  env: string;
  owned: string[];
  /** When the sponsor last paid, ms. */
  paidAt: number;
  /** The day the free crate was last opened. */
  crateDay: string;
  /** The day the free test drive was last used. */
  testDay: string;
  daily: Record<string, DailyRecord>;
  runs: number;
  wins: number;
  bestScore: number;
  /** Best ET in ms (0 = none). */
  bestEt: number;
  /** Longest King's Gauntlet streak (wins in a row). */
  gauntletBest: number;
  /** Sound effects and the engine off. */
  muted: boolean;
  /** Music off (sound effects can stay on). */
  musicOff: boolean;
  seenHelp: boolean;
}

export const newCar = (): OwnedCar => ({ levels: stockLevels(), cond: freshCondition(), paint: DEFAULTS.paint, livery: DEFAULTS.livery, wheels: DEFAULTS.wheels });

/** A new player can afford a couple of level-one parts before the first race. */
export const emptySave = (): Save => ({
  cash: 800,
  earned: 0,
  mats: { ...emptyMats(), parts: 6, rubber: 2 },
  cars: { [DEFAULT_CAR]: newCar() },
  car: DEFAULT_CAR,
  rank: 0,
  helmet: DEFAULTS.helmet,
  suit: DEFAULTS.suit,
  env: DEFAULTS.env,
  owned: [],
  paidAt: 0,
  crateDay: '',
  testDay: '',
  daily: {},
  runs: 0,
  wins: 0,
  bestScore: 0,
  bestEt: 0,
  gauntletBest: 0,
  muted: false,
  musicOff: false,
  seenHelp: false,
});

/**
 * Cars the roster dropped (it went from 50 cars to 28, each on its own body): an owned one becomes the
 * car that took its place, upgrades and paint kept, or comes back as its price in cash when that car
 * is owned already.
 */
const RETIRED: Record<string, [string, number]> = {
  'pico-dot': ['pico-pop', 2400],
  lazzaro: ['kestrel', 11000],
  'kurogane-gt': ['vossberg-gti', 16000],
  kaiser: ['astro', 12000],
  'rotary-rebel': ['tsubasa', 26000],
  brickhouse: ['bayou-boss', 30000],
  'comet-ss': ['stallion', 38000],
  gullwing: ['sakura', 42000],
  panther: ['night-patrol', 36000],
  marlin: ['tsubasa', 28000],
  sterling: ['redline', 130000],
  widowmaker: ['ironhide', 110000],
  ragazzo: ['vortex', 140000],
  longbow: ['falkon', 115000],
  'blue-thunder': ['falkon', 125000],
  wraith: ['hellion', 230000],
  valkyr: ['stallone-812', 900000],
  'royal-flush': ['peregrine', 1500000],
  goldrush: ['toro', 1800000],
  nova: ['toro', 2100000],
  zephyr: ['peregrine', 2300000],
  veyr: ['toro', 2500000],
  'nitro-funny': ['toro', 2700000],
};

const num = (v: unknown, max = 1e12): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
const KNOWN_CARS = new Set(CARS.map((c) => c.id));
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function cleanCar(v: unknown): OwnedCar {
  const c = newCar();
  if (!v || typeof v !== 'object') return c;
  const o = v as Partial<OwnedCar>;
  if (o.levels && typeof o.levels === 'object') for (const p of PARTS) c.levels[p] = clamp(num((o.levels as Levels)[p]), 0, MAX_LEVEL);
  // only tyres wear now: any other part an older save had worn comes back like new
  if (o.cond && typeof o.cond === 'object')
    for (const p of PARTS) {
      const x = (o.cond as Condition)[p];
      c.cond[p] = wears(p) && typeof x === 'number' && Number.isFinite(x) ? clamp(x, 0, 100) : 100;
    }
  const pick = (kind: CosmeticKind, id: unknown): string => (typeof id === 'string' && getCosmetic(id)?.kind === kind ? id : DEFAULTS[kind]);
  c.paint = pick('paint', o.paint);
  c.livery = pick('livery', o.livery);
  c.wheels = pick('wheels', o.wheels);
  return c;
}

export function sanitize(raw: unknown): Save {
  const s = emptySave();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  s.cash = num(o.cash);
  s.earned = num(o.earned);
  if (o.mats && typeof o.mats === 'object') {
    const m = o.mats as Record<string, unknown>;
    for (const k of MATERIALS) s.mats[k] = num(m[k], 1e6);
    // saves from before the merge: scrap, alloy, carbon and chips become parts, worth what they cost
    s.mats.parts = Math.min(1e6, s.mats.parts + num(m.scrap, 1e6) + 2 * num(m.alloy, 1e6) + 3 * num(m.carbon, 1e6) + 4 * num(m.chips, 1e6));
  }
  const moved: Record<string, string> = {};
  if (o.cars && typeof o.cars === 'object') {
    const cars = Object.entries(o.cars);
    for (const [id, v] of cars) if (KNOWN_CARS.has(id)) s.cars[id] = cleanCar(v);
    for (const [id, v] of cars) {
      const r = RETIRED[id];
      if (!r) continue;
      if (s.cars[r[0]]) s.cash = Math.min(1e12, s.cash + r[1]);
      else s.cars[r[0]] = cleanCar(v);
      moved[id] = r[0];
    }
  }
  if (!s.cars[DEFAULT_CAR]) s.cars[DEFAULT_CAR] = newCar();
  const sel = typeof o.car === 'string' ? (moved[o.car] ?? o.car) : '';
  s.car = s.cars[sel] ? sel : DEFAULT_CAR;
  s.rank = clamp(num(o.rank), 0, LADDER_SIZE);
  const pick = (kind: CosmeticKind, id: unknown): string => (typeof id === 'string' && getCosmetic(id)?.kind === kind ? id : DEFAULTS[kind]);
  s.helmet = pick('helmet', o.helmet);
  s.suit = pick('suit', o.suit);
  s.env = pick('env', o.env);
  if (Array.isArray(o.owned)) s.owned = [...new Set(o.owned.filter((x): x is string => typeof x === 'string' && !!getCosmetic(x)))];
  s.paidAt = num(o.paidAt, 1e14);
  s.crateDay = typeof o.crateDay === 'string' && DAY.test(o.crateDay) ? o.crateDay : '';
  s.testDay = typeof o.testDay === 'string' && DAY.test(o.testDay) ? o.testDay : '';
  if (o.daily && typeof o.daily === 'object')
    for (const [d, v] of Object.entries(o.daily).slice(-60)) {
      if (!DAY.test(d) || !v || typeof v !== 'object') continue;
      const e = v as Partial<DailyRecord>;
      s.daily[d] = { best: num(e.best), tries: num(e.tries), et: num(e.et), ...(e.open === true ? { open: true } : {}), ...(e.left === true ? { left: true } : {}) };
    }
  s.runs = num(o.runs);
  s.wins = num(o.wins);
  s.bestScore = num(o.bestScore);
  s.bestEt = num(o.bestEt);
  s.gauntletBest = num(o.gauntletBest);
  s.muted = o.muted === true;
  s.musicOff = o.musicOff === true;
  s.seenHelp = o.seenHelp === true;
  return s;
}

export function loadSave(): Save {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return emptySave();
  }
}

export function writeSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked or full storage: the game still plays */
  }
}

/** Whether a cosmetic is the player's (free defaults always are). */
export const owns = (s: Save, id: string): boolean => s.owned.includes(id) || getCosmetic(id)?.price === 0;

/** Everything for sale of one kind, in order. */
export const shelf = (kind: CosmeticKind) => COSMETICS[kind];
