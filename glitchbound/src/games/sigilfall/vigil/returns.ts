import { SPELLS } from './kit';
import { BOON_COST, BOON_IDS, BOON_MAX, motesFor, WEEKLY_BOUNTY, WEEKLY_HOLD, WILD_COST, WILD_SPELLS, type BoonId, type Feats, type HeroKit } from './night';

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
}

const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** What was kept, made whole: every field has a value whatever was (or wasn't) there. */
export function cleanReturns(raw: unknown): Returns {
  const out: Returns = { motes: 0, earned: 0, nights: 0, boons: {}, wilds: [], wild: null, weekly: {} };
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
  return out;
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
}

/** A night is over: its motes are banked, and the week's watch keeps its best. */
export function bankNight(seconds: number, feats: Feats, cls: string, week?: number): Banked {
  const r = readReturns();
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
  }
  r.motes += motes + bounty;
  r.earned += motes + bounty;
  r.nights++;
  writeReturns(r);
  return { motes, bounty, weekBest, newWeekBest };
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
