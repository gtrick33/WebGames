/** Gut Check's own save: bests, dailies, today's run in progress and friends' challenge rounds. */
export const KEY = 'glitchbound.gut-check';
/** Cards in one run's chain. */
export const CHAIN = 300;

export interface Save {
  best: number;
  runs: number;
  /** `open` true: started, not finished (it resumes from `progress`); false: left, could not be resumed, settled. */
  daily: Record<string, { best: number; tries: number; open?: boolean }>;
  /** Today's run so far: the card it is on (every call before it was right). */
  progress?: { day: string; i: number };
  /** Friends' challenge rounds by `${id}:${round}`: the card reached and, once it ended, the result. */
  rounds: Record<string, ChallengeRound>;
  muted: boolean;
  /** Numbers in US units (mph, lb, ft…) instead of metric. */
  us: boolean;
}
export interface ChallengeRound {
  i: number;
  done?: number;
  missed?: boolean;
}
/** US units by default for a browser set to US English, until the player picks. */
const usByDefault = (): boolean => {
  try {
    return navigator.language === 'en-US';
  } catch {
    return false;
  }
};
export const emptySave = (): Save => ({ best: 0, runs: 0, daily: {}, rounds: {}, muted: false, us: usByDefault() });

/** Reads a stored save; anything damaged or out of range is dropped or clamped, never thrown. */
export function parseSave(raw: string | null): Save {
  const s = emptySave();
  try {
    const o = JSON.parse(raw ?? '{}') as Partial<Save> | null;
    if (!o || typeof o !== 'object') return s;
    const n = (v: unknown, max = CHAIN): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
    s.best = n(o.best);
    s.runs = n(o.runs, 1e9);
    s.muted = o.muted === true;
    if (typeof o.us === 'boolean') s.us = o.us;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries, 9), ...(typeof v.open === 'boolean' ? { open: v.open } : {}) };
    const p = o.progress;
    if (p && typeof p === 'object' && typeof p.day === 'string' && Number.isInteger(p.i) && p.i >= 0 && p.i < CHAIN) s.progress = { day: p.day, i: p.i };
    if (o.rounds && typeof o.rounds === 'object')
      for (const [k, v] of Object.entries(o.rounds).slice(-30))
        if (/^.{1,80}:\d+$/.test(k) && v && typeof v === 'object')
          s.rounds[k] = { i: n(v.i, CHAIN - 1), ...(typeof v.done === 'number' ? { done: n(v.done) } : {}), ...(typeof v.missed === 'boolean' ? { missed: v.missed } : {}) };
  } catch {
    return emptySave();
  }
  return s;
}

export function readSave(): Save {
  try {
    return parseSave(localStorage.getItem(KEY));
  } catch {
    return emptySave();
  }
}

export function writeSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
}

/** Keeps the last 30 challenge rounds (like dailies, old ones are pruned). */
export const pruneRounds = (r: Save['rounds']): Save['rounds'] => Object.fromEntries(Object.entries(r).slice(-30));
