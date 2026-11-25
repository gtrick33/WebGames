import { readBests, readClassBests, readCodex } from './bests';
import { deedsDue, type Deed, type DeedState } from './deeds';
import { SPELLS } from './kit';
import { BOON_COST, BOON_IDS, BOON_MAX, EVENT_KINDS, motesFor, WEEKLY_BOUNTY, WEEKLY_HOLD, WILD_COST, WILD_SPELLS, type BoonId, type EventKind, type Feats, type HeroKit } from './night';

/**
 * The Vigil's return: what a keeper has earned across all their nights, on this device, beside the longest nights
 * (vigil/bests.ts). Motes come from every night and are spent on boons and wild spells; the week's watch keeps its
 * best. Anything missing or broken in what was kept reads as nothing earned yet, so a device from before this was
 * made simply starts at zero.
 */

const KEY = 'sigilfall.vigil.return';
/** How many weeks of the week's watch are remembered. */
const WEEKS_KEPT = 8;

export interface WeekBest {
  best: number;
  cls: string;
  /** Whether the week's bounty has been earned. */
  paid: boolean;
}

export interface Returns {
  /** Motes in hand, and every mote ever earned. */
  motes: number;
  earned: number;
  nights: number;
  boons: Partial<Record<BoonId, number>>;
  /** The wild spells learned, and the one carried. */
  wilds: string[];
  wild: string | null;
  weekly: Record<string, WeekBest>;
  /** How many times each kind of event has been won, every champion ever felled (by name), and the deeds paid. */
  won: Partial<Record<EventKind, number>>;
  felled: string[];
  deeds: string[];
  /** The longest night with each class in the week's watch, which the lands' records don't hold. */
  weekClass: Record<string, number>;
}

const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** What was kept, made whole: every field has a value whatever was (or wasn't) there. */
export function cleanReturns(raw: unknown): Returns {
  const out: Returns = { motes: 0, earned: 0, nights: 0, boons: {}, wilds: [], wild: null, weekly: {}, won: {}, felled: [], deeds: [], weekClass: {} };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  out.motes = count(r.motes);
  out.earned = Math.max(out.motes, count(r.earned));
  out.nights = count(r.nights);
  if (r.boons && typeof r.boons === 'object') {
    for (const id of BOON_IDS) {
      const n = count((r.boons as Record<string, unknown>)[id]);
      if (n) out.boons[id] = Math.min(BOON_MAX, n);
    }
  }
  if (Array.isArray(r.wilds)) out.wilds = WILD_SPELLS.filter((id) => (r.wilds as unknown[]).includes(id));
  if (typeof r.wild === 'string' && out.wilds.includes(r.wild)) out.wild = r.wild;
  if (r.weekly && typeof r.weekly === 'object') {
    for (const [week, w] of Object.entries(r.weekly as Record<string, unknown>)) {
      if (!/^\d{1,6}$/.test(week) || !w || typeof w !== 'object') continue;
      const b = w as Record<string, unknown>;
      out.weekly[week] = { best: count(b.best), cls: typeof b.cls === 'string' ? b.cls.slice(0, 24) : '', paid: !!b.paid };
    }
  }
  if (r.won && typeof r.won === 'object') {
    for (const k of EVENT_KINDS) {
      const n = count((r.won as Record<string, unknown>)[k]);
      if (n) out.won[k] = n;
    }
  }
  const words = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length < 60))].slice(0, 200) : []);
  out.felled = words(r.felled);
  out.deeds = words(r.deeds);
  if (r.weekClass && typeof r.weekClass === 'object') for (const [cls, n] of Object.entries(r.weekClass as Record<string, unknown>)) if (/^[a-z]{1,24}$/.test(cls) && count(n)) out.weekClass[cls] = count(n);
  return out;
}

/** What the deeds are judged from: this device's records, all of them. */
export function deedState(r: Returns = readReturns()): DeedState {
  const classBest: Record<string, number> = { ...r.weekClass };
  for (const per of Object.values(readClassBests())) for (const [cls, n] of Object.entries(per)) classBest[cls] = Math.max(classBest[cls] ?? 0, n);
  return { classBest, landBest: readBests(), won: r.won, felled: r.felled, codex: readCodex() };
}

export function readReturns(): Returns {
  try {
    return cleanReturns(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return cleanReturns(null);
  }
}

function writeReturns(r: Returns): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* a browser that keeps nothing: the night still counted */
  }
}

/** What a keeper of this class carries into a night (a wild spell of their own class is left at home). */
export function kitOf(r: Returns, cls: string): HeroKit {
  const wild = r.wild && SPELLS[r.wild] && SPELLS[r.wild]!.cls !== cls ? r.wild : null;
  return { boons: { ...r.boons }, wild };
}

export interface Banked {
  /** Motes for the night itself, and the week's bounty if this night earned it. */
  motes: number;
  bounty: number;
  /** The best this week, after this night, and whether this night set it. */
  weekBest: number;
  newWeekBest: boolean;
  /** The deeds this night finished, already paid. */
  deeds: Deed[];
}

/** What a night did that the deeds count: the events it won and the champions it felled. */
export interface NightLog {
  won: readonly EventKind[];
  felled: readonly string[];
}

/**
 * A night is over: its motes are banked, the week's watch keeps its best, and any deed it finished is paid. Call it
 * after the night's longest-night records have been kept (vigil/bests.ts): the deeds read them.
 */
export function bankNight(seconds: number, feats: Feats, cls: string, week?: number, log: NightLog = { won: [], felled: [] }): Banked {
  const r = readReturns();
  for (const k of log.won) if (EVENT_KINDS.includes(k)) r.won[k] = (r.won[k] ?? 0) + 1;
  for (const name of log.felled) if (!r.felled.includes(name)) r.felled.push(name);
  const motes = motesFor(seconds, feats);
  let bounty = 0;
  let weekBest = 0;
  let newWeekBest = false;
  if (week !== undefined) {
    const was = r.weekly[week] ?? { best: 0, cls: '', paid: false };
    const held = Math.floor(seconds);
    newWeekBest = held > was.best;
    if (seconds >= WEEKLY_HOLD && !was.paid) bounty = WEEKLY_BOUNTY;
    r.weekly[week] = { best: Math.max(was.best, held), cls: newWeekBest ? cls : was.cls, paid: was.paid || bounty > 0 };
    weekBest = r.weekly[week]!.best;
    for (const k of Object.keys(r.weekly)) if (Number(k) <= week - WEEKS_KEPT) delete r.weekly[k];
    r.weekClass[cls] = Math.max(r.weekClass[cls] ?? 0, Math.floor(seconds));
  }
  const deeds = deedsDue(deedState(r), r.deeds);
  let paid = 0;
  for (const d of deeds) {
    r.deeds.push(d.id);
    paid += d.motes;
  }
  r.motes += motes + bounty + paid;
  r.earned += motes + bounty + paid;
  r.nights++;
  writeReturns(r);
  return { motes, bounty, weekBest, newWeekBest, deeds };
}

/** What the next rank of a boon costs, or nothing once it is at its top. */
export const boonCost = (r: Returns, id: BoonId): number | null => BOON_COST[r.boons[id] ?? 0] ?? null;

export function buyBoon(id: BoonId): Returns {
  const r = readReturns();
  const cost = boonCost(r, id);
  if (cost === null || r.motes < cost) return r;
  r.motes -= cost;
  r.boons[id] = (r.boons[id] ?? 0) + 1;
  writeReturns(r);
  return r;
}

/** Learns a wild spell, and carries it if none is carried yet. */
export function buyWild(id: string): Returns {
  const r = readReturns();
  if (!WILD_SPELLS.includes(id) || r.wilds.includes(id) || r.motes < WILD_COST) return r;
  r.motes -= WILD_COST;
  r.wilds.push(id);
  r.wild ??= id;
  writeReturns(r);
  return r;
}

/** Carries a learned wild spell, or none. */
export function carryWild(id: string | null): Returns {
  const r = readReturns();
  if (id !== null && !r.wilds.includes(id)) return r;
  r.wild = id;
  writeReturns(r);
  return r;
}
