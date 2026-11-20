import type { D1PreparedStatement, Env } from './http';
import { roomStub, validCode } from './rooms';
import { botRival, factorOf, isFormat, leaversOf, MATCH_MAX_MS, MIN_BOT_WIN_MS, moveStanding, outcomeOf, peopleMatchId, REPEAT_MS, seasonal, SETTLE_MS, shownStanding, stakesFor, teamRating, TICKET_MS, verdictOf, VOID_MS, type Fairness, type MatchStats, type Note, type Outcome, type RankedStanding, type Report, type Seat } from '../src/games/sigilfall/arena/ranked';
import { FORMATS, seasonOf, type Format, type Standing } from '../src/games/sigilfall/arena/ranks';
import { LEAVER_K } from '../src/games/sigilfall/arena/live';

/**
 * The Ring's ranked ladder on the server (migrations/0026): every signed-in player's standing in each format, the
 * rated matches, and settling them. The rules are the game's own (src/games/sigilfall/arena/ranked.ts); this reads
 * and writes them. functions/api/sigilfall/ring.ts is the way in.
 */

/** A standing as it is sent: the game's own fields and the season. */
export type ShownStanding = Standing & { season: number };

/** What a match did to one player, once settled. */
export interface Settled {
  settled: true;
  change: number;
  note?: Note;
  rankUp?: string | null;
  standing: ShownStanding;
}

/** The roster a match against people began with, as its room kept it (rooms/worker.ts `/ring-run`). */
export interface RingRoster {
  run: number;
  seed: number;
  format: number;
  at: number;
  /** Found by a ranked search (quick match, or a party in the queue): a room of friends is never ranked. */
  ranked: boolean;
  seats: { n: number; team: 0 | 1; uid: string; net: string; party: boolean }[];
  /** When each seat dropped out of the run while it went (by seat number), as the room saw it; back again: not here. */
  left?: Record<string, number>;
}

export type RosterOf = (code: string) => Promise<RingRoster | null>;

/** The roster of a room's last run, asked of the room itself. */
export const roomRoster =
  (env: Env): RosterOf =>
  async (code) => {
    const stub = validCode(code) ? roomStub(env, code) : null;
    const res = await stub?.fetch('https://room/ring-run').catch(() => null);
    return res?.ok ? ((await res.json()) as RingRoster) : null;
  };

export const PART: Record<Format, string> = { 1: 'solo', 2: 'duo', 3: 'trio' };

export interface StandingRow {
  format: number;
  season: number;
  rating: number;
  mmr: number;
  best: number;
  wins: number;
  losses: number;
  streak: number;
}

export const fromRow = (r: StandingRow): RankedStanding => ({ rating: r.rating, mmr: r.mmr, best: r.best, wins: r.wins, losses: r.losses, streak: r.streak, season: r.season });

/** A player's standing in each format, in this season. */
export async function readStandings(env: Env, user: string, now: number): Promise<Record<Format, RankedStanding>> {
  const rows = await env.DB.prepare('SELECT format, season, rating, mmr, best, wins, losses, streak FROM ring_standings WHERE user_id = ?').bind(user).all<StandingRow>();
  const season = seasonOf(now);
  const out = {} as Record<Format, RankedStanding>;
  for (const f of FORMATS) {
    const row = rows.results.find((r) => r.format === f);
    out[f] = seasonal(row ? fromRow(row) : null, season);
  }
  return out;
}

async function standingIn(env: Env, user: string, format: Format, now: number): Promise<RankedStanding> {
  const row = await env.DB.prepare('SELECT format, season, rating, mmr, best, wins, losses, streak FROM ring_standings WHERE user_id = ? AND format = ?').bind(user, format).first<StandingRow>();
  return seasonal(row ? fromRow(row) : null, seasonOf(now));
}

/** Writes a standing, only if the match being settled is still this settling's own (`guard`). */
function writeStanding(env: Env, user: string, format: Format, s: RankedStanding, now: number, guard: Guard): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO ring_standings (user_id, format, season, rating, mmr, best, wins, losses, streak, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${GUARD_SQL}
     ON CONFLICT(user_id, format) DO UPDATE SET season = excluded.season, rating = excluded.rating, mmr = excluded.mmr, best = excluded.best,
       wins = excluded.wins, losses = excluded.losses, streak = excluded.streak, updated_at = excluded.updated_at`,
  ).bind(user, format, s.season, s.rating, s.mmr, s.best, s.wins, s.losses, s.streak, now, guard.id, guard.key);
}

/** The rankings: the best reached on the ladder, on the format's board and the Ring's own (only ever raised). */
function writeBoards(env: Env, user: string, format: Format, best: number, now: number, guard: Guard): D1PreparedStatement[] {
  return [`ring:${PART[format]}`, 'ring'].map((board) =>
    env.DB.prepare(
      `INSERT INTO sigilfall_ranks (user_id, board, score, at) SELECT ?, ?, ?, ? WHERE ${GUARD_SQL}
       ON CONFLICT(user_id, board) DO UPDATE SET score = excluded.score, at = excluded.at WHERE excluded.score > sigilfall_ranks.score`,
    ).bind(user, board, best, now, guard.id, guard.key),
  );
}

/**
 * A settling's claim on its match: the first statement of its batch marks the match settled with its own key, and
 * every write after it only happens while the key is still its own. Two players reporting at the same moment start
 * two settlings; only one of them changes anything.
 */
interface Guard {
  id: string;
  key: string;
}
const GUARD_SQL = '(SELECT settle_key FROM ring_matches WHERE id = ?) = ?';
const newKey = (): string => [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(36).padStart(2, '0')).join('');

function claim(env: Env, guard: Guard, now: number, result: string, note: string | null): D1PreparedStatement {
  return env.DB.prepare('UPDATE ring_matches SET settled_at = ?, settle_key = ?, result = ?, note = ? WHERE id = ? AND settled_at IS NULL').bind(now, guard.key, result, note, guard.id);
}

function writePlayer(env: Env, id: string, user: string, change: number, note: Note | undefined, guard: Guard, report?: Report): D1PreparedStatement {
  return env.DB.prepare(`UPDATE ring_match_players SET change = ?, note = ?${report ? ', report = COALESCE(report, ?)' : ''} WHERE match_id = ? AND user_id = ? AND ${GUARD_SQL}`).bind(...[change, note ?? null, ...(report ? [report] : []), id, user, guard.id, guard.key]);
}

/* ------------------------------------------------------------------ matches against the computer */

interface MatchRow {
  id: string;
  format: number;
  kind: string;
  created_at: number;
  rival: number;
  settled_at: number | null;
  result: string | null;
  note: string | null;
}
interface PlayerRow {
  user_id: string;
  team: number;
  net: string;
  party: number;
  rating: number;
  mmr: number;
  created_at: number;
  report: string | null;
  reported_at: number | null;
  change: number | null;
  note: string | null;
}

const ticketId = (): string => `b-${[...crypto.getRandomValues(new Uint8Array(16))].map((b) => (b % 36).toString(36)).join('')}`;

/**
 * A ticket for a match against the computer: the computer's rating drawn here, and what the match stands to win and
 * lose. A ticket of theirs still open is settled first (they started another match without finishing it).
 */
export async function openBotMatch(env: Env, user: string, format: Format, now: number, rand: () => number = Math.random): Promise<{ match: string; rival: number; stakes: { win: number; lose: number }; standing: ShownStanding; note?: Note }> {
  await settleTickets(env, user, now, true);
  const st = await standingIn(env, user, format, now);
  const rival = botRival(st.mmr, rand());
  const id = ticketId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ring_matches (id, format, kind, created_at, rival) VALUES (?, ?, 'bots', ?, ?)").bind(id, format, now, rival),
    env.DB.prepare('INSERT INTO ring_match_players (match_id, user_id, team, rating, mmr, created_at) VALUES (?, ?, 0, ?, ?, ?)').bind(id, user, st.rating, st.mmr, now),
  ]);
  const stakes = stakesFor(st, rival, st.mmr, 1, true);
  return { match: id, rival, stakes, standing: shownStanding(st), ...(stakes.win === 0 && stakes.lose === 0 ? { note: 'ceiling' as const } : {}) };
}

/** What a ticket's report comes to: a void too late is a leaver's loss, a win too soon is nothing. */
function ticketOutcome(report: Report, age: number): { o: Outcome; note?: Note } {
  if (report === 'void') return age <= VOID_MS ? { o: { kind: 'none', k: 1 } } : { o: { kind: 'loss', k: LEAVER_K, leaver: true } };
  if (report === 'left') return { o: { kind: 'loss', k: LEAVER_K, leaver: true } };
  if (report === 'won') return age < MIN_BOT_WIN_MS ? { o: { kind: 'none', k: 1 }, note: 'short' } : { o: { kind: 'win', k: 1 } };
  if (report === 'lost') return { o: { kind: 'loss', k: 1 } };
  return { o: { kind: 'none', k: 1 } };
}

async function settleTicket(env: Env, m: MatchRow, p: PlayerRow, report: Report, now: number): Promise<Settled | null> {
  const format = isFormat(m.format) ? m.format : 1;
  const st = await standingIn(env, p.user_id, format, now);
  const { o, note } = ticketOutcome(report, now - m.created_at);
  const moved = moveStanding(st, o, m.rival, st.mmr, 1, true);
  const guard = { id: m.id, key: newKey() };
  const shownNote = note ?? moved.note;
  const writes = [claim(env, guard, now, o.kind === 'win' ? 't0' : o.kind === 'loss' ? 't1' : 'void', note ?? null), writePlayer(env, m.id, p.user_id, moved.change, shownNote, guard, report)];
  if (moved.next !== st) writes.push(writeStanding(env, p.user_id, format, moved.next, now, guard), ...writeBoards(env, p.user_id, format, moved.next.best, now, guard));
  await env.DB.prepare('UPDATE ring_match_players SET reported_at = COALESCE(reported_at, ?) WHERE match_id = ? AND user_id = ?').bind(now, m.id, p.user_id).run();
  await env.DB.batch(writes);
  const done = await env.DB.prepare('SELECT settle_key FROM ring_matches WHERE id = ?').bind(m.id).first<{ settle_key: string }>();
  if (done?.settle_key !== guard.key) return null;
  return { settled: true, change: moved.change, ...(shownNote ? { note: shownNote } : {}), rankUp: moved.rankUp, standing: shownStanding(moved.next) };
}

/**
 * A player's tickets still open: one never reported in TICKET_MS is a leaver's loss. `all`: every one of them, as a new
 * one is written (a ticket started this soon before is given up for free, as before its gates).
 */
async function settleTickets(env: Env, user: string, now: number, all = false): Promise<void> {
  const open = await env.DB.prepare(
    `SELECT m.id, m.format, m.kind, m.created_at, m.rival, m.settled_at, m.result, m.note, p.user_id, p.team, p.net, p.party, p.rating, p.mmr, p.created_at AS pc, p.report, p.reported_at, p.change
     FROM ring_matches m JOIN ring_match_players p ON p.match_id = m.id WHERE p.user_id = ? AND m.kind = 'bots' AND m.settled_at IS NULL AND m.created_at < ? LIMIT 5`,
  )
    .bind(user, all ? now + 1 : now - TICKET_MS)
    .all<MatchRow & PlayerRow>();
  for (const r of open.results) await settleTicket(env, r, r, now - r.created_at <= VOID_MS ? 'void' : 'left', now);
}

/* ------------------------------------------------------------------ matches against people */

/** The match a room's run is, made from the roster the room kept as it began (once: everyone else finds it made). */
async function peopleMatch(env: Env, code: string, run: number, roster: RosterOf, now: number): Promise<{ id: string; created: boolean } | { error: string }> {
  const r = await roster(code);
  if (!r || r.run !== run) return { error: 'no_match' };
  const id = peopleMatchId(code, run, r.seed);
  const had = await env.DB.prepare('SELECT 1 AS n FROM ring_matches WHERE id = ?').bind(id).first();
  if (had) return { id, created: false };
  if (!r.ranked) return { error: 'unranked' };
  const format = isFormat(r.format) ? r.format : 2;
  const rated = r.seats.filter((s) => s.uid);
  // the same account on both sides (two of its devices): nobody's rating moves
  const sides = new Map<string, Set<number>>();
  for (const s of rated) sides.set(s.uid, (sides.get(s.uid) ?? new Set()).add(s.team));
  const dupe = [...sides.values()].some((t) => t.size > 1);
  const once = rated.filter((s, i) => rated.findIndex((x) => x.uid === s.uid) === i);
  const standings = await Promise.all(once.map((s) => standingIn(env, s.uid, format, now)));
  // (a side with nobody rated on it, only the computer's places or players who aren't signed in, is fought as the
  // computer is: at a rating drawn from the other side's)
  const rival = botRival(teamRating(standings.map((s) => s.mmr)), Math.random());
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO ring_matches (id, format, kind, created_at, rival, note) VALUES (?, ?, 'people', ?, ?, ?)").bind(id, format, Math.min(now, r.at || now), rival, dupe ? 'dupe' : null),
    ...once.map((s, i) => env.DB.prepare('INSERT OR IGNORE INTO ring_match_players (match_id, user_id, team, net, party, rating, mmr, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, s.uid, s.team, s.net, s.party ? 1 : 0, standings[i]!.rating, standings[i]!.mmr, now)),
  ]);
  return { id, created: true };
}

async function matchRows(env: Env, id: string): Promise<{ m: MatchRow; players: PlayerRow[] } | null> {
  const m = await env.DB.prepare('SELECT id, format, kind, created_at, rival, settled_at, result, note FROM ring_matches WHERE id = ?').bind(id).first<MatchRow>();
  if (!m) return null;
  const players = await env.DB.prepare('SELECT user_id, team, net, party, rating, mmr, created_at, report, reported_at, change, note FROM ring_match_players WHERE match_id = ?').bind(id).all<PlayerRow>();
  return { m, players: players.results };
}

/** What the server finds about who one player was matched against (arena/ranked.ts Fairness). */
async function fairnessOf(env: Env, m: MatchRow, me: PlayerRow, players: PlayerRow[]): Promise<Fairness> {
  const them = players.filter((p) => p.team !== me.team);
  const out: Fairness = {
    dupe: m.note === 'dupe',
    network: !!me.net && them.some((p) => p.net === me.net),
  };
  if (!them.length) return out;
  const marks = them.map(() => '?').join(', ');
  const ids = them.map((p) => p.user_id);
  const [friend, met] = await Promise.all([
    env.DB.prepare(`SELECT 1 AS n FROM friends WHERE user_id = ? AND friend_id IN (${marks}) LIMIT 1`).bind(me.user_id, ...ids).first(),
    env.DB.prepare(
      `SELECT b.user_id AS who, COUNT(*) AS n FROM ring_match_players a
       JOIN ring_match_players b ON b.match_id = a.match_id AND b.team != a.team
       JOIN ring_matches x ON x.id = a.match_id
       WHERE a.user_id = ? AND a.match_id != ? AND a.created_at > ? AND x.result IN ('t0', 't1') AND b.user_id IN (${marks})
       GROUP BY b.user_id`,
    )
      .bind(me.user_id, m.id, m.created_at - REPEAT_MS, ...ids)
      .all<{ who: string; n: number }>(),
  ]);
  out.friends = !!friend;
  out.repeats = Math.max(0, ...met.results.map((r) => r.n));
  return out;
}

/** Whether a match against people can be settled now: everyone has reported, or it has waited long enough. */
const due = (m: MatchRow, players: PlayerRow[], now: number): boolean => {
  const times = players.map((p) => p.reported_at).filter((t): t is number => t !== null);
  if (times.length === players.length) return true;
  if (times.length && now - Math.min(...times) >= SETTLE_MS) return true;
  return now - m.created_at >= MATCH_MAX_MS;
};

/**
 * Who left the match, by its room's own record of who dropped out and when (arena/ranked.ts leaversOf), by account.
 * Null when the room can't say (it has closed, or this run is no longer its last).
 */
async function leftOf(m: MatchRow, seats: Seat[], roster: RosterOf): Promise<Set<string> | null> {
  const [, code, run, seed] = m.id.split('-');
  const r = code ? await roster(code).catch(() => null) : null;
  if (!r || String(r.run) !== run || String(r.seed >>> 0) !== seed || !r.left) return null;
  const by: Record<string, number> = {};
  for (const [n, at] of Object.entries(r.left)) {
    const uid = r.seats.find((x) => String(x.n) === n)?.uid;
    if (uid) by[uid] = Math.min(by[uid] ?? Infinity, at);
  }
  return leaversOf(by, seats, m.created_at);
}

/** Settles a match against people once it is due. Returns what it did to `who`, if it did it now or had before. */
async function settlePeople(env: Env, id: string, now: number, roster: RosterOf, who?: string): Promise<Settled | null> {
  const rows = await matchRows(env, id);
  if (!rows) return null;
  const { m, players } = rows;
  if (m.settled_at !== null || !due(m, players, now)) return null;
  const seats: Seat[] = players.map((p) => ({ user: p.user_id, team: p.team === 1 ? 1 : 0, report: (p.report as Report | null) ?? null, at: p.reported_at }));
  const gone = await leftOf(m, seats, roster);
  const v = { ...verdictOf(seats, m.created_at), ...(gone ? { leaversKnown: true } : {}) };
  const format = isFormat(m.format) ? m.format : 2;
  const guard = { id: m.id, key: newKey() };
  const result = v.result === 0 ? 't0' : v.result === 1 ? 't1' : v.result;
  const writes: D1PreparedStatement[] = [claim(env, guard, now, result, v.note ?? (m.note === 'dupe' ? 'dupe' : null))];
  const mine = new Map<string, Settled>();
  for (const p of players) {
    const seat = seats.find((s) => s.user === p.user_id)!;
    const o = m.note === 'dupe' ? { kind: 'none' as const, k: 1 } : outcomeOf(seat, v, !!gone?.has(p.user_id));
    const fair = await fairnessOf(env, m, p, players);
    const { factor, note: fairNote } = factorOf(fair);
    const them = players.filter((x) => x.team !== p.team);
    const bots = them.length === 0;
    const st = await standingIn(env, p.user_id, format, now);
    // (each player by their own matchmaking rating against the other side's: in a team far apart, the stronger one
    // wins little and loses a lot, the weaker one the other way round; WIN_CAP holds the most anyone wins)
    const moved = moveStanding(st, o, bots ? m.rival : teamRating(them.map((x) => x.mmr)), p.mmr, factor, bots);
    const note = v.note ?? (o.kind === 'none' ? undefined : (fairNote ?? moved.note)) ?? (m.note === 'dupe' ? 'dupe' : undefined);
    writes.push(writePlayer(env, m.id, p.user_id, moved.change, note, guard));
    if (moved.next !== st) writes.push(writeStanding(env, p.user_id, format, moved.next, now, guard), ...writeBoards(env, p.user_id, format, moved.next.best, now, guard));
    mine.set(p.user_id, { settled: true, change: moved.change, ...(note ? { note } : {}), rankUp: moved.rankUp, standing: shownStanding(moved.next) });
  }
  await env.DB.batch(writes);
  const done = await env.DB.prepare('SELECT settle_key FROM ring_matches WHERE id = ?').bind(m.id).first<{ settle_key: string }>();
  if (done?.settle_key !== guard.key) return who ? settledFor(env, id, who, now) : null;
  return who ? (mine.get(who) ?? null) : null;
}

/** What a settled match did to one player, as it was kept. */
async function settledFor(env: Env, id: string, user: string, now: number): Promise<Settled | null> {
  const row = await env.DB.prepare('SELECT m.format, m.settled_at, p.change, p.note FROM ring_matches m JOIN ring_match_players p ON p.match_id = m.id WHERE m.id = ? AND p.user_id = ?').bind(id, user).first<{ format: number; settled_at: number | null; change: number | null; note: string | null }>();
  if (!row || row.settled_at === null) return null;
  const st = await standingIn(env, user, isFormat(row.format) ? row.format : 1, now);
  return { settled: true, change: row.change ?? 0, ...(row.note ? { note: row.note as Note } : {}), standing: shownStanding(st) };
}

/**
 * A player in a match against people asks what it stands for them: the match is made from its room's roster, if it
 * isn't yet. Returns what it stands to win and lose, and why it counts less or not at all, when it does.
 */
export async function openPeopleMatch(env: Env, user: string, code: string, run: number, roster: RosterOf, now: number): Promise<{ match: string; stakes: { win: number; lose: number }; rival: number; ours: number; note?: Note } | { error: string }> {
  const made = await peopleMatch(env, code, run, roster, now);
  if ('error' in made) return made;
  const rows = await matchRows(env, made.id);
  const me = rows?.players.find((p) => p.user_id === user);
  if (!rows || !me) return { error: 'not_in_match' };
  const format = isFormat(rows.m.format) ? rows.m.format : 2;
  const fair = await fairnessOf(env, rows.m, me, rows.players);
  const { factor, note } = factorOf(fair);
  const them = rows.players.filter((p) => p.team !== me.team);
  const ours = me.mmr;
  const rival = them.length ? teamRating(them.map((p) => p.mmr)) : rows.m.rival;
  const st = await standingIn(env, user, format, now);
  const stakes = stakesFor(st, rival, ours, factor, !them.length);
  const shown = note ?? (!them.length && stakes.win === 0 && stakes.lose === 0 ? 'ceiling' : undefined);
  return { match: made.id, stakes, rival, ours, ...(shown ? { note: shown } : {}) };
}

/**
 * A player's report of a match (theirs alone: it is kept once, and can't be changed). A ticket is settled at once;
 * a match against people once everyone has reported, or it has waited long enough (then `pending`, and the game asks
 * again in a moment).
 */
export async function reportMatch(env: Env, user: string, id: string, report: Report, now: number, roster: RosterOf, stats: MatchStats | null = null): Promise<Settled | { pending: true } | { error: string }> {
  let rows = await matchRows(env, id);
  if (!rows && id.startsWith('r-')) {
    // (a player whose game never asked what the match stood for: it is made now, from the room's roster)
    const [, code, run] = id.split('-');
    const made = await peopleMatch(env, code ?? '', Number(run), roster, now);
    if (!('error' in made) && made.id === id) rows = await matchRows(env, id);
  }
  const me = rows?.players.find((p) => p.user_id === user);
  if (!rows || !me) return { error: 'not_in_match' };
  // (their numbers, for the admin alone: kept once, whether or not the match is still open)
  if (stats) await env.DB.prepare('UPDATE ring_match_players SET stats = ? WHERE match_id = ? AND user_id = ? AND stats IS NULL').bind(JSON.stringify(stats), id, user).run();
  if (rows.m.settled_at !== null) return (await settledFor(env, id, user, now)) ?? { error: 'not_in_match' };
  if (rows.m.kind === 'bots') return (await settleTicket(env, rows.m, me, report, now)) ?? (await settledFor(env, id, user, now)) ?? { pending: true };
  if (me.report === null) await env.DB.prepare('UPDATE ring_match_players SET report = ?, reported_at = ? WHERE match_id = ? AND user_id = ? AND report IS NULL').bind(report, now, id, user).run();
  return (await settlePeople(env, id, now, roster, user)) ?? (await settledFor(env, id, user, now)) ?? { pending: true };
}

/** Everything of a player's that is due: tickets never reported, and matches against people waiting to be settled. */
export async function settleDue(env: Env, user: string, now: number, roster: RosterOf): Promise<void> {
  await settleTickets(env, user, now);
  const open = await env.DB.prepare(
    "SELECT m.id FROM ring_matches m JOIN ring_match_players p ON p.match_id = m.id WHERE p.user_id = ? AND m.kind = 'people' AND m.settled_at IS NULL AND m.created_at > ? LIMIT 10",
  )
    .bind(user, now - 7 * 86_400_000)
    .all<{ id: string }>();
  for (const r of open.results) await settlePeople(env, r.id, now, roster);
}

/** A match of a player's as it stands: settled (what it did), or still waiting. */
export async function matchFor(env: Env, user: string, id: string, now: number, roster: RosterOf): Promise<Settled | { pending: true } | null> {
  const rows = await matchRows(env, id);
  if (!rows?.players.some((p) => p.user_id === user)) return null;
  if (rows.m.settled_at === null && rows.m.kind === 'people') await settlePeople(env, id, now, roster);
  return (await settledFor(env, id, user, now)) ?? { pending: true };
}
