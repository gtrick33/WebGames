/**
 * The Ring's ranked ladder, from the game's side (the server keeps it: server/ring.ts; the rules: arena/ranked.ts).
 * A signed-in player's standing is the server's: the game asks for it, shows it, and keeps a copy on this device so
 * the screen has it at once next time (only ever a copy: what it says is never sent back). A match is reported once
 * it is over; a match against people is settled when everyone in it has reported, so the answer can take a moment.
 */
import { api } from '../../../platform/account';
import { forgetBest, NEW_STANDING, RANKED_KEY, type Format, type Standing } from '../arena/ranks';
import type { MatchStats, Note, Report } from '../arena/ranked';
import { clearLive, LEAVER_K, type LiveMatch } from '../arena/live';

export type ShownStanding = Standing & { season: number };

/** What a match did to the player, once settled. */
export interface Settled {
  settled: true;
  change: number;
  note?: Note;
  rankUp?: string | null;
  standing: ShownStanding;
}
export type Settling = Settled | { pending: true };

export interface Ticket {
  match: string;
  rival: number;
  stakes: { win: number; lose: number };
  standing: ShownStanding;
  note?: Note;
}

export interface PeopleStakes {
  match: string;
  stakes: { win: number; lose: number };
  rival: number;
  ours: number;
  note?: Note;
}

interface Me {
  signedIn: boolean;
  season?: number;
  standings?: Record<string, ShownStanding>;
  match?: Settling;
}

const PATH = '/api/sigilfall/ring';

export const rankedApi = {
  me: (match?: string): Promise<Me> => api<Me>(`${PATH}${match ? `?match=${encodeURIComponent(match)}` : ''}`),
  bots: (format: Format): Promise<Ticket> => api<Ticket>(PATH, { body: { action: 'bots', format } }),
  people: (code: string, run: number): Promise<PeopleStakes> => api<PeopleStakes>(PATH, { body: { action: 'people', code, run } }),
  report: (match: string, report: Report, keepalive = false, stats?: MatchStats): Promise<Settling> => api<Settling>(PATH, { body: { action: 'report', match, report, ...(stats ? { stats } : {}) }, ...(keepalive ? { keepalive } : {}) }),
};

/** How long the game waits for a match against people to be settled before it says it will be. */
const WAIT_MS = 24_000;
const ASK_EVERY_MS = 2_500;

/**
 * A report, sent again a couple of times if it doesn't get through (a ticket the server never hears about is lost as
 * a leaver's, so a bad connection at the wrong moment mustn't cost a win).
 */
export async function sendReport(match: string, report: Report, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)), stats?: MatchStats): Promise<Settling> {
  for (let i = 0; ; i++) {
    try {
      return await rankedApi.report(match, report, false, stats);
    } catch (e) {
      // (a refusal is an answer: only a report that didn't arrive is sent again)
      const status = (e as { status?: number } | null)?.status ?? 0;
      if (i >= 2 || (status >= 400 && status < 500)) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

/** A report (with the player's numbers in it, for the admin), and then the settling: asked again every little while until it comes, or the wait is up. */
export async function reportAndSettle(match: string, report: Report, wait = WAIT_MS, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)), stats?: MatchStats): Promise<Settling> {
  let got: Settling = await sendReport(match, report, sleep, stats);
  const until = Date.now() + wait;
  while (!('settled' in got) && Date.now() < until) {
    await sleep(ASK_EVERY_MS);
    got = (await rankedApi.me(match).catch(() => null))?.match ?? got;
  }
  return got;
}

/* ------------------------------------------------------------------ this device's copy */

const KEY = RANKED_KEY;

/** The server's standings as this device last heard them, for one account. */
export interface RankedCopy {
  user: string;
  at: number;
  season: number;
  standings: Partial<Record<string, ShownStanding>>;
}

export function readRanked(user: string | null | undefined): RankedCopy | null {
  if (!user) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RankedCopy | null;
    return raw && raw.user === user && raw.standings && typeof raw.standings === 'object' ? raw : null;
  } catch {
    return null;
  }
}

export function writeRanked(c: RankedCopy): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* nothing kept: the screen asks the server again next time */
  }
  // (what the rating has earned is asked afresh)
  forgetBest();
}

/** A standing from a copy, or where everyone starts. */
export const rankedStanding = (c: RankedCopy | null, f: Format): Standing => {
  const s = c?.standings[f];
  return s && typeof s.rating === 'number' ? s : NEW_STANDING;
};

/**
 * A ranked match left and not gone back to (the title screen asks): a leaver's loss, taken by the server (nothing
 * before its gates lifted). Returns the rating it cost, as the server said, or as it would be when it can't be asked.
 */
export async function forfeitRanked(l: LiveMatch): Promise<number> {
  clearLive();
  const gates = !l.snap || l.snap.p === 'gates';
  const got = l.ticket ? await sendReport(l.ticket, gates ? 'void' : 'left').catch(() => null) : null;
  if (got && 'settled' in got) return got.change;
  return gates ? 0 : -Math.round(l.stakes.lose * LEAVER_K);
}
