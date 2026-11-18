/**
 * The Ring's ranked ladder, as the server keeps it (server/ring.ts, functions/api/sigilfall/ring.ts). The owner,
 * 2026-11-18: "i want to do appropriate matchmaking, ranking system so that players can enjoy a competitive
 * environment, add every step necessary for that, make sure wintrading and exploiting is prohibited".
 *
 * A signed-in player's rating lives on the server, and only the server moves it. A player's own device can no longer
 * say what their rating is, and the rankings take it from the server alone. What the server can't see is the fight
 * itself (the host's game runs it), so it takes nothing on one game's word where it can help it:
 *
 * - A match against people is settled from every player's own report of it. When they all agree, it stands; when
 *   they disagree, nothing changes for anyone. Whoever walks out takes a leaver's loss; whoever never reports takes
 *   their side's result, or, when the match ended because someone left, a leaver's loss.
 * - A match against the computer is a ticket the server writes before the gates open, with the computer's rating
 *   drawn by the server. A win reported sooner than a fight can be won isn't believed, giving a match up counts as a
 *   loss once the gates have lifted, a ticket never reported is a leaver's loss, and from BOT_CEILING only matches
 *   against people move a rating at all.
 * - Win trading: rating from the same opponent counts less the more often you meet them in a day, and then not at
 *   all; nothing at all is won or lost against a friend, against someone on the same network, against your own
 *   account, or a party is matched at its median rating, and each player wins and loses by their own.
 *
 * Pure: these rules decide, the server reads and writes. The game shows the same words.
 */
import { afterMatch, RATING_FLOOR, MMR_FLOOR, stakesOf } from './rating';
import { NEW_STANDING, rankOf, seasonReset, type Format, type Standing } from './ranks';
import { LEAVER_K } from './live';

/** A match against people has its gates up this long (sim.ts GATES): whoever leaves before they lift leaves for free. */
export const PEOPLE_GATES_MS = 30_000;
/** A player who drops out this close before the match's end isn't taken for a leaver (their game may only be closing). */
export const LEFT_SLACK_MS = 2_000;

/** What a player's game says of a match once it is over for them. */
export type Report = 'won' | 'lost' | 'draw' | 'left' | 'void';
export const REPORTS: readonly Report[] = ['won', 'lost', 'draw', 'left', 'void'];
export const isReport = (v: unknown): v is Report => typeof v === 'string' && (REPORTS as readonly string[]).includes(v);

/** A win against the computer reported sooner than this after its ticket isn't believed (its gates alone take 15 s). */
export const MIN_BOT_WIN_MS = 25_000;
/** ...and against people, whose gates take 30 s. */
export const MIN_PEOPLE_MS = 40_000;
/** A match against the computer given up this soon after its ticket was given up before its gates lifted: free. */
export const VOID_MS = 20_000;
/** A ticket for a match against the computer that is never reported is lost as a leaver after this. */
export const TICKET_MS = 30 * 60_000;
/** A match against people is settled once everyone in it has reported, or this long after the first report... */
export const SETTLE_MS = 2 * 60_000;
/** ...or this long after it began, whoever has reported. */
export const MATCH_MAX_MS = 45 * 60_000;
/** From this rating, matches against the computer move a rating no more: only people do (Warden of the Ring). */
export const BOT_CEILING = 1900;
/** Meetings with the same opponent are counted over this long. */
export const REPEAT_MS = 20 * 3_600_000;
/** How much a match counts after `n` earlier meetings with the same opponent in REPEAT_MS: two in full, two at half. */
export const repeatFactor = (n: number): number => (n < 2 ? 1 : n < 4 ? 0.5 : 0);
/**
 * The most one match can raise a rating (or a matchmaking rating) on the ladder, however lopsided it was and however
 * new the player: a low-rated player carried by a strong friend gains a lot, never a fortune.
 */
export const WIN_CAP = 40;

/** Why a match counted less than in full, or not at all. */
export type Note = 'repeat' | 'friends' | 'network' | 'dupe' | 'ceiling' | 'disputed' | 'short' | 'guest' | 'offline';

/** What each note tells the player, on the result screen and before the match. */
export const NOTE_WORDS: Record<Note, string> = {
  repeat: 'You’ve met the same opponent several times today. Rating from them counts for half after two matches, and for nothing after four.',
  friends: 'You were matched against a friend. Matches between friends don’t count for rating.',
  network: 'Players on the same network were on opposite sides. That match doesn’t count for rating.',
  dupe: 'The same account was on both sides. That match doesn’t count.',
  ceiling: `From ${BOT_CEILING}, only matches against people move your rating.`,
  disputed: 'The players’ games disagreed on who won, so nothing changed for anyone.',
  short: 'That match ended too quickly to count.',
  guest: 'Sign in to play ranked. Until then your rating is a practice rating, kept on this device.',
  offline: 'Ranked couldn’t be reached, so this match doesn’t count for rating.',
};

/** A standing as the server keeps it: in a season, with its matchmaking rating always written down. */
export interface RankedStanding extends Standing {
  mmr: number;
  season: number;
}

/** A player's standing in this season: a new one at 1000, or last season's brought halfway back toward 1000. */
export function seasonal(s: RankedStanding | null | undefined, season: number): RankedStanding {
  if (!s) return { ...NEW_STANDING, mmr: NEW_STANDING.rating, season };
  if (s.season >= season) return s;
  return { ...s, rating: Math.max(RATING_FLOOR, seasonReset(s.rating)), mmr: Math.max(MMR_FLOOR, seasonReset(s.mmr)), streak: 0, season };
}

/** A side's matchmaking rating: the mean of its rated players'. */
export const teamRating = (list: readonly number[]): number => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : NEW_STANDING.rating);

/**
 * What a party searches at, however far apart its players are: its median (the owner, 2026-11-18: "if the rating gap
 * is huge a median mmr match should be found"). Each player's own rating then decides what the match is worth to
 * them (moveStanding: `ours` is the player's own), so the stronger one stands to win little and lose a lot, and the
 * weaker one the other way round; WIN_CAP holds the most anyone can win.
 */
export function partyRating(list: readonly number[]): number {
  if (!list.length) return NEW_STANDING.rating;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** The computer's side's rating for a ticket: either way of the player's matchmaking rating, up to 150. `r` in [0, 1). */
export const botRival = (mmr: number, r: number): number => Math.max(MMR_FLOOR, Math.round(mmr) + Math.floor(r * 301) - 150);

/** A match against people, by the room it was found in and which of its runs it was. */
export const peopleMatchId = (code: string, run: number, seed: number): string => `r-${code}-${run}-${seed >>> 0}`;
export const MATCH_ID = /^(r-[A-Z]{4,8}-\d{1,6}-\d{1,10}|b-[a-z0-9]{12,32})$/;

/* ------------------------------------------------------------------ settling a match against people */

/** One player in a match against people, as settled. */
export interface Seat {
  user: string;
  team: 0 | 1;
  report: Report | null;
  /** When they reported (ms). */
  at: number | null;
}

/** How a match came out by its players' reports: a side won, a draw, or nothing that can be counted. */
export interface Verdict {
  result: 0 | 1 | 'draw' | 'void';
  /** Why nothing counts, when that is a finding rather than a match nobody finished. */
  note?: 'disputed' | 'short';
  /** Someone's game said the match ended because a player left it. */
  someoneLeft: boolean;
  /** The room's own record said who left: nobody else is taken for a leaver for saying nothing. */
  leaversKnown?: boolean;
}

/**
 * The players' reports, taken together. A player who left says nothing of who won; a 'void' (the match ended for me
 * because someone left) says nothing either, when anyone else saw it through to the end. Every other report says
 * which side won, or that it was a draw: they all have to agree. A win sooner than MIN_PEOPLE_MS after the match
 * began isn't believed.
 */
export function verdictOf(seats: readonly Seat[], startedAt: number): Verdict {
  const someoneLeft = seats.some((s) => s.report === 'void');
  const claims = new Set<0 | 1 | 'draw'>();
  let first = Infinity;
  for (const s of seats) {
    if (s.report === 'won' || s.report === 'lost') claims.add(s.report === 'won' ? s.team : ((1 - s.team) as 0 | 1));
    else if (s.report === 'draw') claims.add('draw');
    else continue;
    if (s.at !== null) first = Math.min(first, s.at);
  }
  if (claims.size === 0) return { result: 'void', someoneLeft };
  if (claims.size > 1) return { result: 'void', note: 'disputed', someoneLeft };
  const result = [...claims][0]!;
  if (result !== 'draw' && first - startedAt < MIN_PEOPLE_MS) return { result: 'void', note: 'short', someoneLeft };
  return { result, someoneLeft };
}

/** What a match is for one player: a win, a loss (`k` times over for a leaver), or nothing to count. */
export interface Outcome {
  kind: 'win' | 'loss' | 'none';
  k: number;
  /** A leaver's loss: it is taken whatever else is true of the match. */
  leaver?: boolean;
}

/**
 * Who left a match against people, by the room's own record of when each player dropped out of it (rooms/worker.ts),
 * not by anyone's word: whoever dropped out before the match ended (the first report of how it came out), or, when
 * it never ended because someone left, whoever dropped out first. Nobody who left while the gates were still up.
 * `left`: when each player was last seen dropping out (players who came back aren't in it).
 */
export function leaversOf(left: Readonly<Record<string, number>>, seats: readonly Seat[], startedAt: number): Set<string> {
  const ends = seats.filter((s) => (s.report === 'won' || s.report === 'lost' || s.report === 'draw') && s.at !== null).map((s) => s.at!);
  const end = ends.length ? Math.min(...ends) : null;
  const out = Object.entries(left).filter(([, at]) => at - startedAt >= PEOPLE_GATES_MS);
  if (end !== null) return new Set(out.filter(([, at]) => at < end - LEFT_SLACK_MS).map(([u]) => u));
  if (!out.length) return new Set();
  const first = Math.min(...out.map(([, at]) => at));
  return new Set(out.filter(([, at]) => at - first < 1_000).map(([u]) => u));
}

/**
 * One player's outcome. A leaver loses, always (`left`: the room's record says they left, whatever they said).
 * Otherwise their side's result; and when nothing could be counted because someone left, the one who said nothing at
 * all is taken for the one who left.
 */
export function outcomeOf(seat: Seat, v: Verdict, left = false): Outcome {
  if (seat.report === 'left' || left) return { kind: 'loss', k: LEAVER_K, leaver: true };
  if (v.result === 0 || v.result === 1) return { kind: v.result === seat.team ? 'win' : 'loss', k: 1 };
  if (v.result === 'void' && !v.note && v.someoneLeft && seat.report === null && !v.leaversKnown) return { kind: 'loss', k: LEAVER_K, leaver: true };
  return { kind: 'none', k: 1 };
}

/** What the server found out about who a player was matched against. */
export interface Fairness {
  /** The same account sat on both sides. */
  dupe?: boolean;
  /** One of the other side is their friend. */
  friends?: boolean;
  /** One of the other side played from the same network. */
  network?: boolean;
  /** The most times they had met any one of the other side in REPEAT_MS before this match. */
  repeats?: number;
}

/** How much of a match counts for a player (0 to 1), and why, when it isn't all of it. */
export function factorOf(f: Fairness): { factor: number; note?: Note } {
  if (f.dupe) return { factor: 0, note: 'dupe' };
  if (f.friends) return { factor: 0, note: 'friends' };
  if (f.network) return { factor: 0, note: 'network' };
  const factor = repeatFactor(f.repeats ?? 0);
  return factor < 1 ? { factor, note: 'repeat' } : { factor };
}

/** A standing moved by a match. */
export interface Moved {
  next: RankedStanding;
  change: number;
  rankUp: string | null;
  note?: Note;
}

/**
 * A standing moved by one player's outcome: the elo rule (rating.ts afterMatch) against `theirs`, worked from `ours`
 * (the player's own matchmaking rating: in a team, each player's expectation is their own), never more than WIN_CAP up,
 * scaled by `factor` (a leaver's loss is never scaled down). `bots`: against the computer, where from BOT_CEILING
 * nothing moves and below it a win can't carry the rating past it.
 */
export function moveStanding(s: RankedStanding, o: Outcome, theirs: number, ours: number, factor = 1, bots = false): Moved {
  const same: Moved = { next: s, change: 0, rankUp: null };
  if (o.kind === 'none') return same;
  const f = o.leaver ? 1 : factor;
  if (f <= 0) return same;
  if (bots && s.rating >= BOT_CEILING) return { ...same, note: 'ceiling' };
  const won = o.kind === 'win';
  const out = afterMatch(s, theirs, won, o.k, ours);
  let rating = Math.max(RATING_FLOOR, s.rating + Math.min(WIN_CAP, Math.round((out.next.rating - s.rating) * f)));
  let note: Note | undefined;
  if (bots && won && rating > BOT_CEILING) {
    rating = BOT_CEILING;
    note = 'ceiling';
  }
  const mmr = Math.max(MMR_FLOOR, s.mmr + Math.min(WIN_CAP, Math.round(((out.next.mmr ?? s.mmr) - s.mmr) * f)));
  const best = Math.max(s.best, rating);
  const before = rankOf(s.best);
  const after = rankOf(best);
  return {
    next: { ...out.next, rating, mmr, best, season: s.season },
    change: rating - s.rating,
    rankUp: after.at > before.at ? after.name : null,
    ...(note ? { note } : {}),
  };
}

/** What a match stands to win and lose before it begins, counting what counts of it. */
export function stakesFor(s: RankedStanding, theirs: number, ours: number, factor = 1, bots = false): { win: number; lose: number } {
  if (bots && s.rating >= BOT_CEILING) return { win: 0, lose: 0 };
  const st = stakesOf(s, theirs, ours);
  const win = Math.min(WIN_CAP, Math.round(st.win * factor));
  return { win: bots ? Math.min(win, Math.max(0, BOT_CEILING - s.rating)) : win, lose: Math.round(st.lose * factor) };
}

/** A standing as it is sent to the game: what the game's own standing holds, and its season. */
export const shownStanding = (s: RankedStanding): Standing & { season: number } => ({ rating: s.rating, best: s.best, wins: s.wins, losses: s.losses, streak: s.streak, mmr: s.mmr, season: s.season });

/** The formats as the server writes them. */
export const isFormat = (v: unknown): v is Format => v === 1 || v === 2 || v === 3;
