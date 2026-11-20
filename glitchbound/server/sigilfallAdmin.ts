/**
 * Admin › Sigilfall: the Campaign, the Ring and the Vigil, looked after from the admin. What the server knows of each
 * mode across every player, and what an admin can change: a Ring rating, a match taken back, a row on one of the
 * game's boards (and keeping a player off it). Every change is written to the change log by its endpoint
 * (functions/api/admin/sigilfall/ring.ts and boards.ts). The game masters' orders to heroes are server/sigilfallGm.ts.
 */
import type {
  BoardAdminRow,
  CampaignAdminOverview,
  RingAdminMatch,
  RingAdminOverview,
  RingAdminPlayer,
  RingAdminStanding,
  VigilAdminOverview,
} from '../src/platform/apiTypes';
import { isFormat, seasonal, statsOf, type MatchStats } from '../src/games/sigilfall/arena/ranked';
import { FORMATS, seasonEnds, seasonOf, type Format } from '../src/games/sigilfall/arena/ranks';
import { boardOf } from '../functions/api/sigilfall/ranks';
import { likeOf, type D1PreparedStatement, type Env } from './http';
import { fromRow, PART, type StandingRow } from './ring';
import { SAVE_KEY } from './sigilfallGm';

const VIGIL_KEY = 'sigilfall.vigil.bests';
const DAY = 86_400_000;
const LADDER_PAGE = 50;
const MATCH_PAGE = 30;
const BOARD_PAGE = 100;

type Row = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const maybe = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));
const round1 = (n: number): number => Math.round(n * 10) / 10;
const changes = (r: unknown): number => Number((r as { meta?: { changes?: number }; changes?: number })?.meta?.changes ?? (r as { changes?: number })?.changes ?? 0);
const parseStats = (s: unknown): MatchStats | null => {
  if (typeof s !== 'string' || !s) return null;
  try {
    return statsOf(JSON.parse(s));
  } catch {
    return null;
  }
};

/** A player's id from their id, nickname or email (exactly, any case), or null. */
export async function findUser(env: Env, who: string): Promise<{ id: string; nickname: string } | null> {
  const w = who.trim().slice(0, 120);
  if (!w) return null;
  return env.DB.prepare('SELECT id, nickname FROM users WHERE id = ? OR nickname = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1').bind(w, w, w).first<{ id: string; nickname: string }>();
}

/* ------------------------------------------------------------------ the Ring */

/** A rating as the season shows it, for ordering in SQL (seasonal(): last season's halfway back toward 1000). */
const SHOWN_RATING = 'CASE WHEN s.season < ? THEN ROUND(1000 + (s.rating - 1000) / 2.0) ELSE s.rating END';

/** The Ring at a glance: who plays which format, how many matches and how they end, and how each class does. */
export async function ringOverview(env: Env, now = Date.now()): Promise<RingAdminOverview> {
  const season = seasonOf(now);
  const [players, matches, stats, classes, open] = await Promise.all([
    env.DB.prepare(`SELECT s.format, COUNT(*) AS n, AVG(${SHOWN_RATING}) AS avg, MAX(${SHOWN_RATING}) AS top, SUM(s.updated_at > ?) AS week FROM ring_standings s GROUP BY s.format`)
      .bind(season, season, now - 7 * DAY)
      .all<{ format: number; n: number; avg: number | null; top: number | null; week: number | null }>(),
    env.DB.prepare('SELECT format, kind, COALESCE(result, \'open\') AS result, COALESCE(note, \'\') AS note, COUNT(*) AS n, SUM(created_at > ?) AS d1, SUM(created_at > ?) AS d7 FROM ring_matches GROUP BY format, kind, result, note')
      .bind(now - DAY, now - 7 * DAY)
      .all<{ format: number; kind: string; result: string; note: string; n: number; d1: number | null; d7: number | null }>(),
    env.DB.prepare(
      `SELECT m.format, COUNT(*) AS n, AVG(json_extract(p.stats, '$.secs')) AS secs, AVG(json_extract(p.stats, '$.dmg')) AS dmg, AVG(json_extract(p.stats, '$.heal')) AS heal
       FROM ring_match_players p JOIN ring_matches m ON m.id = p.match_id WHERE p.stats IS NOT NULL AND m.created_at > ? GROUP BY m.format`,
    )
      .bind(now - 30 * DAY)
      .all<{ format: number; n: number; secs: number | null; dmg: number | null; heal: number | null }>(),
    env.DB.prepare(
      `SELECT m.format, json_extract(p.stats, '$.cls') AS cls, COUNT(*) AS played,
         SUM(CASE WHEN (m.result = 't0' AND p.team = 0) OR (m.result = 't1' AND p.team = 1) THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN m.result IN ('t0', 't1') THEN 1 ELSE 0 END) AS decided,
         AVG(json_extract(p.stats, '$.dmg')) AS dmg, AVG(json_extract(p.stats, '$.heal')) AS heal, AVG(json_extract(p.stats, '$.secs')) AS secs
       FROM ring_match_players p JOIN ring_matches m ON m.id = p.match_id WHERE p.stats IS NOT NULL AND m.created_at > ? GROUP BY m.format, cls ORDER BY played DESC`,
    )
      .bind(now - 30 * DAY)
      .all<{ format: number; cls: string; played: number; wins: number; decided: number; dmg: number | null; heal: number | null; secs: number | null }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM ring_matches WHERE settled_at IS NULL').first<{ n: number }>(),
  ]);
  const formats = FORMATS.map((f) => {
    const p = players.results.find((r) => r.format === f);
    const st = stats.results.find((r) => r.format === f);
    const ms = matches.results.filter((r) => r.format === f);
    const sum = (pick: (r: (typeof ms)[number]) => number): number => ms.reduce((a, r) => a + pick(r), 0);
    return {
      format: f,
      players: p?.n ?? 0,
      active7d: p?.week ?? 0,
      avgRating: Math.round(p?.avg ?? 0),
      topRating: Math.round(p?.top ?? 0),
      matches: sum((r) => r.n),
      matches24h: sum((r) => r.d1 ?? 0),
      matches7d: sum((r) => r.d7 ?? 0),
      vsPeople: sum((r) => (r.kind === 'people' ? r.n : 0)),
      withStats: st?.n ?? 0,
      avgSecs: Math.round(st?.secs ?? 0),
      avgDmg: Math.round(st?.dmg ?? 0),
      avgHeal: Math.round(st?.heal ?? 0),
    };
  });
  const results: Record<string, number> = {};
  const notes: Record<string, number> = {};
  for (const r of matches.results) {
    results[r.result] = (results[r.result] ?? 0) + r.n;
    if (r.note) notes[r.note] = (notes[r.note] ?? 0) + r.n;
  }
  return {
    season,
    seasonEnds: seasonEnds(season),
    open: open?.n ?? 0,
    formats,
    results,
    notes,
    classes: classes.results
      .filter((c) => typeof c.cls === 'string')
      .map((c) => ({ format: c.format, cls: c.cls, played: c.played, wins: c.wins, decided: c.decided, avgDmg: Math.round(c.dmg ?? 0), avgHeal: Math.round(c.heal ?? 0), avgSecs: Math.round(c.secs ?? 0) })),
  };
}

const standingView = (r: StandingRow & Row, season: number): RingAdminStanding => {
  const s = seasonal(fromRow(r), season);
  return {
    userId: String(r.user_id),
    nickname: String(r.nickname ?? ''),
    email: String(r.email ?? ''),
    banned: !!r.banned_at,
    format: r.format,
    rating: s.rating,
    mmr: s.mmr,
    best: s.best,
    wins: s.wins,
    losses: s.losses,
    streak: s.streak,
    season: s.season,
    stored: { rating: r.rating, season: r.season },
    updatedAt: num(r.updated_at),
  };
};

/** One page of a format's ladder, highest rating first, found by nickname, email or player id. */
export async function ringLadder(env: Env, format: Format, q: string, offset: number, now = Date.now()): Promise<{ rows: RingAdminStanding[]; total: number; page: number }> {
  const season = seasonOf(now);
  const term = q.trim().slice(0, 80);
  const like = likeOf(term);
  const where = `s.format = ? AND (? = '' OR u.id = ? OR u.nickname LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`;
  const args = [format, term, term, like, like];
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT s.*, u.nickname, u.email, u.banned_at FROM ring_standings s JOIN users u ON u.id = s.user_id WHERE ${where} ORDER BY ${SHOWN_RATING} DESC, s.updated_at ASC LIMIT ? OFFSET ?`)
      .bind(...args, season, LADDER_PAGE, Math.max(0, Math.floor(offset)))
      .all<StandingRow & Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM ring_standings s JOIN users u ON u.id = s.user_id WHERE ${where}`)
      .bind(...args)
      .first<{ n: number }>(),
  ]);
  return { rows: rows.results.map((r) => standingView(r, season)), total: count?.n ?? 0, page: LADDER_PAGE };
}

export interface MatchFilter {
  format?: number;
  kind?: string;
  /** 't0', 't1', 'draw', 'void' or 'open'. */
  result?: string;
  note?: string;
  user?: string;
}

/** How long a match ran: its players' own clocks, else from its start to the first report. */
function lengthOf(m: Row, players: { stats: MatchStats | null; reportedAt: number | null }[]): { secs: number | null; measured: boolean } {
  const clocks = players.map((p) => p.stats?.secs ?? 0).filter((s) => s > 0);
  if (clocks.length) return { secs: Math.max(...clocks), measured: true };
  const reports = players.map((p) => p.reportedAt).filter((t): t is number => t !== null);
  if (!reports.length) return { secs: null, measured: false };
  return { secs: Math.max(0, Math.round((Math.min(...reports) - num(m.created_at)) / 1000)), measured: false };
}

async function matchViews(env: Env, matches: Row[]): Promise<RingAdminMatch[]> {
  if (!matches.length) return [];
  const ids = matches.map((m) => String(m.id));
  const players = await env.DB.prepare(
    `SELECT p.*, u.nickname FROM ring_match_players p LEFT JOIN users u ON u.id = p.user_id WHERE p.match_id IN (${ids.map(() => '?').join(', ')}) ORDER BY p.team, p.rating DESC`,
  )
    .bind(...ids)
    .all<Row>();
  return matches.map((m) => {
    const list = players.results
      .filter((p) => p.match_id === m.id)
      .map((p) => ({
        userId: String(p.user_id),
        nickname: String(p.nickname ?? '(gone)'),
        team: (num(p.team) === 1 ? 1 : 0) as 0 | 1,
        party: !!num(p.party),
        rating: num(p.rating),
        mmr: num(p.mmr),
        report: typeof p.report === 'string' ? p.report : null,
        reportedAt: maybe(p.reported_at),
        change: maybe(p.change),
        note: typeof p.note === 'string' ? p.note : null,
        stats: parseStats(p.stats),
      }));
    const len = lengthOf(m, list);
    return {
      id: String(m.id),
      format: num(m.format),
      kind: m.kind === 'people' ? 'people' : 'bots',
      createdAt: num(m.created_at),
      settledAt: maybe(m.settled_at),
      result: typeof m.result === 'string' ? m.result : null,
      note: typeof m.note === 'string' ? m.note : null,
      rival: num(m.rival),
      secs: len.secs,
      measured: len.measured,
      players: list,
    };
  });
}

/** One page of rated matches, newest first, by format, kind, result, note and player. */
export async function ringMatches(env: Env, f: MatchFilter, offset: number): Promise<{ rows: RingAdminMatch[]; total: number; page: number }> {
  const conds: string[] = [];
  const args: unknown[] = [];
  if (f.format && isFormat(f.format)) {
    conds.push('m.format = ?');
    args.push(f.format);
  }
  if (f.kind === 'bots' || f.kind === 'people') {
    conds.push('m.kind = ?');
    args.push(f.kind);
  }
  if (f.result === 'open') conds.push('m.settled_at IS NULL');
  else if (f.result && ['t0', 't1', 'draw', 'void'].includes(f.result)) {
    conds.push('m.result = ?');
    args.push(f.result);
  }
  if (f.note && /^[a-z]{2,12}$/.test(f.note)) {
    conds.push('(m.note = ? OR EXISTS (SELECT 1 FROM ring_match_players n WHERE n.match_id = m.id AND n.note = ?))');
    args.push(f.note, f.note);
  }
  if (f.user) {
    conds.push('EXISTS (SELECT 1 FROM ring_match_players q WHERE q.match_id = m.id AND q.user_id = ?)');
    args.push(f.user);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT m.* FROM ring_matches m ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...args, MATCH_PAGE, Math.max(0, Math.floor(offset)))
      .all<Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM ring_matches m ${where}`)
      .bind(...args)
      .first<{ n: number }>(),
  ]);
  return { rows: await matchViews(env, rows.results), total: count?.n ?? 0, page: MATCH_PAGE };
}

export async function ringMatch(env: Env, id: string): Promise<RingAdminMatch | null> {
  const m = await env.DB.prepare('SELECT * FROM ring_matches WHERE id = ?').bind(id).first<Row>();
  return m ? ((await matchViews(env, [m]))[0] ?? null) : null;
}

/** One player's Ring: their standing in each format, their last matches, and their rows on the Ring's boards. */
export async function ringPlayer(env: Env, userId: string, now = Date.now()): Promise<RingAdminPlayer | null> {
  const u = await env.DB.prepare('SELECT id, nickname, email, banned_at FROM users WHERE id = ?').bind(userId).first<Row>();
  if (!u) return null;
  const season = seasonOf(now);
  const [rows, matches] = await Promise.all([
    env.DB.prepare('SELECT s.*, u.nickname, u.email, u.banned_at FROM ring_standings s JOIN users u ON u.id = s.user_id WHERE s.user_id = ?').bind(userId).all<StandingRow & Row>(),
    ringMatches(env, { user: userId }, 0),
  ]);
  const standings = FORMATS.map((f) => {
    const r = rows.results.find((x) => x.format === f);
    if (r) return standingView(r, season);
    const s = seasonal(null, season);
    return { userId, nickname: String(u.nickname), email: String(u.email), banned: !!u.banned_at, format: f, rating: s.rating, mmr: s.mmr, best: s.best, wins: 0, losses: 0, streak: 0, season, stored: null, updatedAt: 0 };
  });
  return { userId, nickname: String(u.nickname), standings, matches: matches.rows, total: matches.total };
}

const clamp = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);

/** The Ring's boards for one player, from their standings as they now are: each format's best, and the best of all. */
function boardWrites(env: Env, userId: string, bests: Partial<Record<Format, number>>, now: number): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  const put = (board: string, best: number): void => {
    out.push(
      best > 0
        ? env.DB.prepare('INSERT INTO sigilfall_ranks (user_id, board, score, at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, board) DO UPDATE SET score = excluded.score, at = excluded.at').bind(userId, board, best, now)
        : env.DB.prepare('DELETE FROM sigilfall_ranks WHERE user_id = ? AND board = ?').bind(userId, board),
    );
  };
  for (const f of FORMATS) put(`ring:${PART[f]}`, bests[f] ?? 0);
  put('ring', Math.max(0, ...Object.values(bests).map((n) => n ?? 0)));
  return out;
}

async function bestsOf(env: Env, userId: string): Promise<Partial<Record<Format, number>>> {
  const rows = await env.DB.prepare('SELECT format, best FROM ring_standings WHERE user_id = ?').bind(userId).all<{ format: number; best: number }>();
  const out: Partial<Record<Format, number>> = {};
  for (const r of rows.results) if (isFormat(r.format)) out[r.format] = r.best;
  return out;
}

export interface StandingPatch {
  rating?: unknown;
  mmr?: unknown;
  best?: unknown;
  wins?: unknown;
  losses?: unknown;
  streak?: unknown;
}

/**
 * Sets a player's standing in a format, field by field (what isn't given stays as it is), and their rows on the Ring's
 * boards to match. Returns what it was and what it is now, for the log.
 */
export async function setStanding(env: Env, userId: string, format: Format, patch: StandingPatch, now = Date.now()): Promise<{ before: RingAdminStanding; after: RingAdminStanding } | string> {
  const season = seasonOf(now);
  const row = await env.DB.prepare('SELECT * FROM ring_standings WHERE user_id = ? AND format = ?').bind(userId, format).first<StandingRow & Row>();
  const was = seasonal(row ? fromRow(row) : null, season);
  const rating = patch.rating === undefined ? was.rating : clamp(patch.rating, 0, 4000);
  const mmr = patch.mmr === undefined ? was.mmr : clamp(patch.mmr, 0, 4000);
  const wins = patch.wins === undefined ? was.wins : clamp(patch.wins, 0, 1_000_000);
  const losses = patch.losses === undefined ? was.losses : clamp(patch.losses, 0, 1_000_000);
  const streak = patch.streak === undefined ? was.streak : clamp(patch.streak, -1000, 1000);
  if (rating === null || mmr === null || wins === null || losses === null || streak === null) return 'Each number has to be a whole number.';
  // (the best reached never sits below the rating: set lower, it comes down to it)
  const askedBest = patch.best === undefined ? was.best : clamp(patch.best, 0, 4000);
  if (askedBest === null) return 'Each number has to be a whole number.';
  const best = Math.max(askedBest, rating);
  const bests = { ...(await bestsOf(env, userId)), [format]: best };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO ring_standings (user_id, format, season, rating, mmr, best, wins, losses, streak, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, format) DO UPDATE SET season = excluded.season, rating = excluded.rating, mmr = excluded.mmr, best = excluded.best,
         wins = excluded.wins, losses = excluded.losses, streak = excluded.streak, updated_at = excluded.updated_at`,
    ).bind(userId, format, season, rating, mmr, best, wins, losses, streak, now),
    ...boardWrites(env, userId, bests, now),
  ]);
  const p = await ringPlayer(env, userId, now);
  const before: RingAdminStanding = { userId, nickname: p?.nickname ?? '', email: '', banned: false, format, ...was, stored: row ? { rating: row.rating, season: row.season } : null, updatedAt: num(row?.updated_at) };
  return { before, after: p!.standings.find((s) => s.format === format)! };
}

/** Starts a player's standing in a format over (1000, no matches), and takes its best off the boards. */
export async function resetStanding(env: Env, userId: string, format: Format, now = Date.now()): Promise<boolean> {
  const r = await env.DB.prepare('DELETE FROM ring_standings WHERE user_id = ? AND format = ?').bind(userId, format).run();
  const bests = await bestsOf(env, userId);
  await env.DB.batch(boardWrites(env, userId, bests, now));
  return changes(r) > 0;
}

/**
 * Takes a match back: one still open is closed as void (nothing moves); a settled one gives each player back the
 * rating it moved (and as much matchmaking rating), and the win or loss it counted, and is kept as void with the note
 * 'admin'. The best each player reached is left as it is (set it by hand if it should come down).
 */
export async function voidMatch(env: Env, id: string, now = Date.now()): Promise<{ undone: { userId: string; change: number }[] } | string> {
  const m = await env.DB.prepare('SELECT * FROM ring_matches WHERE id = ?').bind(id).first<Row>();
  if (!m) return 'No match with that id.';
  if (m.note === 'admin') return 'That match has already been taken back.';
  const players = await env.DB.prepare('SELECT user_id, change FROM ring_match_players WHERE match_id = ?').bind(id).all<{ user_id: string; change: number | null }>();
  const format = isFormat(num(m.format)) ? (num(m.format) as Format) : 1;
  const season = seasonOf(now);
  const writes: D1PreparedStatement[] = [env.DB.prepare("UPDATE ring_matches SET settled_at = COALESCE(settled_at, ?), settle_key = COALESCE(settle_key, 'admin'), result = 'void', note = 'admin' WHERE id = ?").bind(now, id)];
  const undone: { userId: string; change: number }[] = [];
  for (const p of players.results) {
    writes.push(env.DB.prepare("UPDATE ring_match_players SET change = 0, note = 'admin' WHERE match_id = ? AND user_id = ?").bind(id, p.user_id));
    const change = m.settled_at === null ? 0 : (p.change ?? 0);
    if (!change) continue;
    const row = await env.DB.prepare('SELECT * FROM ring_standings WHERE user_id = ? AND format = ?').bind(p.user_id, format).first<StandingRow>();
    if (!row) continue;
    const s = seasonal(fromRow(row), season);
    writes.push(
      env.DB.prepare('UPDATE ring_standings SET season = ?, rating = ?, mmr = ?, wins = ?, losses = ?, streak = 0, updated_at = ? WHERE user_id = ? AND format = ?').bind(
        season,
        Math.max(0, s.rating - change),
        Math.max(0, s.mmr - change),
        Math.max(0, s.wins - (change > 0 ? 1 : 0)),
        Math.max(0, s.losses - (change < 0 ? 1 : 0)),
        now,
        p.user_id,
        format,
      ),
    );
    undone.push({ userId: p.user_id, change });
  }
  await env.DB.batch(writes);
  return { undone };
}

/* ------------------------------------------------------------------ the boards */

/** One page of a board as the admin sees it: every row (banned players too), with who is kept off it. */
export async function boardRows(env: Env, board: string, q: string, offset: number): Promise<{ rows: BoardAdminRow[]; total: number; page: number; held: BoardAdminRow[] }> {
  const term = q.trim().slice(0, 80);
  const like = likeOf(term);
  const where = `r.board = ? AND (? = '' OR u.id = ? OR u.nickname LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`;
  const args = [board, term, term, like, like];
  const [rows, count, holds] = await Promise.all([
    env.DB.prepare(
      `SELECT r.user_id, r.score, r.at, u.nickname, u.email, u.banned_at, h.reason AS hold_reason,
         (SELECT COUNT(*) FROM sigilfall_ranks x WHERE x.board = r.board AND x.score > r.score) + 1 AS rank
       FROM sigilfall_ranks r JOIN users u ON u.id = r.user_id LEFT JOIN sigilfall_rank_holds h ON h.user_id = r.user_id AND h.board = r.board
       WHERE ${where} ORDER BY r.score DESC, r.at ASC LIMIT ? OFFSET ?`,
    )
      .bind(...args, BOARD_PAGE, Math.max(0, Math.floor(offset)))
      .all<Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM sigilfall_ranks r JOIN users u ON u.id = r.user_id WHERE ${where}`)
      .bind(...args)
      .first<{ n: number }>(),
    env.DB.prepare('SELECT h.user_id, h.reason, h.created_by, h.created_at, u.nickname, u.email, u.banned_at FROM sigilfall_rank_holds h LEFT JOIN users u ON u.id = h.user_id WHERE h.board = ? ORDER BY h.created_at DESC LIMIT 100')
      .bind(board)
      .all<Row>(),
  ]);
  return {
    total: count?.n ?? 0,
    page: BOARD_PAGE,
    rows: rows.results.map((r) => ({
      userId: String(r.user_id),
      nickname: String(r.nickname),
      email: String(r.email),
      banned: !!r.banned_at,
      rank: num(r.rank),
      score: num(r.score),
      at: num(r.at),
      held: typeof r.hold_reason === 'string',
    })),
    held: holds.results.map((h) => ({
      userId: String(h.user_id),
      nickname: String(h.nickname ?? '(gone)'),
      email: String(h.email ?? ''),
      banned: !!h.banned_at,
      rank: 0,
      score: 0,
      at: num(h.created_at),
      held: true,
      reason: String(h.reason ?? ''),
      by: String(h.created_by ?? ''),
    })),
  };
}

/** Every board a player is on, and the ones they are kept off. */
export async function playerBoards(env: Env, userId: string): Promise<{ board: string; score: number; at: number; rank: number; held: boolean }[]> {
  const [rows, holds] = await Promise.all([
    env.DB.prepare('SELECT r.board, r.score, r.at, (SELECT COUNT(*) FROM sigilfall_ranks x WHERE x.board = r.board AND x.score > r.score) + 1 AS rank FROM sigilfall_ranks r WHERE r.user_id = ? ORDER BY r.board')
      .bind(userId)
      .all<{ board: string; score: number; at: number; rank: number }>(),
    env.DB.prepare('SELECT board FROM sigilfall_rank_holds WHERE user_id = ?').bind(userId).all<{ board: string }>(),
  ]);
  const held = new Set(holds.results.map((h) => h.board));
  const out = rows.results.map((r) => ({ ...r, held: held.has(r.board) }));
  for (const b of held) if (!out.some((r) => r.board === b)) out.push({ board: b, score: 0, at: 0, rank: 0, held: true });
  return out.sort((a, b) => a.board.localeCompare(b.board));
}

/** Takes a player's row off a board; `hold`: and keeps their device from putting it back. */
export async function removeRank(env: Env, userId: string, board: string, hold: boolean, reason: string, by: string, now = Date.now()): Promise<boolean> {
  const writes = [env.DB.prepare('DELETE FROM sigilfall_ranks WHERE user_id = ? AND board = ?').bind(userId, board)];
  if (hold)
    writes.push(
      env.DB.prepare('INSERT INTO sigilfall_rank_holds (user_id, board, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, board) DO UPDATE SET reason = excluded.reason, created_by = excluded.created_by, created_at = excluded.created_at').bind(
        userId,
        board,
        reason.trim().slice(0, 200),
        by,
        now,
      ),
    );
  const [del] = await env.DB.batch(writes);
  return changes(del) > 0 || hold;
}

export async function unholdRank(env: Env, userId: string, board: string): Promise<boolean> {
  return changes(await env.DB.prepare('DELETE FROM sigilfall_rank_holds WHERE user_id = ? AND board = ?').bind(userId, board).run()) > 0;
}

/** Sets a player's row on a board to a score (up or down), as long as the board can hold it. */
export async function setRank(env: Env, userId: string, board: string, score: number, now = Date.now()): Promise<string | null> {
  const b = boardOf(board);
  if (!b) return 'There is no such board.';
  if (!Number.isInteger(score) || score <= 0 || score > b.max) return `A score on this board is a whole number from 1 to ${b.max.toLocaleString('en-US')}.`;
  await env.DB.prepare('INSERT INTO sigilfall_ranks (user_id, board, score, at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, board) DO UPDATE SET score = excluded.score, at = excluded.at').bind(userId, board, score, now).run();
  return null;
}

/** How many players are on each board of a family ('trial', 'vigil', ...), and its best and middle scores. */
async function familyBoards(env: Env, family: string): Promise<{ board: string; players: number; top: number; avg: number }[]> {
  const rows = await env.DB.prepare("SELECT board, COUNT(*) AS n, MAX(score) AS top, AVG(score) AS avg FROM sigilfall_ranks WHERE board = ? OR board LIKE ? GROUP BY board ORDER BY board")
    .bind(family, `${family}:%`)
    .all<{ board: string; n: number; top: number; avg: number }>();
  return rows.results.map((r) => ({ board: r.board, players: r.n, top: r.top, avg: Math.round(r.avg) }));
}

/* ------------------------------------------------------------------ the Campaign */

/** The story across every signed-in player's heroes: levels, difficulty, where heroes stand, quests, bosses, time. */
export async function campaignOverview(env: Env, now = Date.now()): Promise<CampaignAdminOverview> {
  const heroes = `FROM game_saves s, json_each(s.data, '$.heroes') h WHERE s.key = ? AND h.type = 'object'`;
  const [totals, levels, tiers, lands, quests, bosses, trials, boards, recent] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS heroes, COUNT(DISTINCT s.user_id) AS players, SUM(json_extract(h.value, '$.stats.time')) AS time, AVG(json_extract(h.value, '$.stats.time')) AS avg_time,
         SUM(json_extract(h.value, '$.stats.kills')) AS kills, SUM(json_extract(h.value, '$.stats.deaths')) AS deaths, AVG(json_extract(h.value, '$.level')) AS avg_level,
         SUM(json_extract(h.value, '$.level') >= 60) AS maxed, MAX(COALESCE(json_extract(h.value, '$.para.l'), 0)) AS top_paragon,
         SUM(COALESCE(json_extract(h.value, '$.keystone'), 0) > 0) AS stones, MAX(COALESCE(json_extract(h.value, '$.keystone'), 0)) AS top_stone,
         AVG(NULLIF(COALESCE(json_extract(h.value, '$.keystone'), 0), 0)) AS avg_stone, SUM(COALESCE(json_extract(h.value, '$.review'), 0) = 1) AS review
       ${heroes}`,
    )
      .bind(SAVE_KEY)
      .first<Row>(),
    env.DB.prepare(`SELECT MIN(CAST(json_extract(h.value, '$.level') AS INTEGER) / 10, 6) AS b, COUNT(*) AS n ${heroes} GROUP BY b ORDER BY b`)
      .bind(SAVE_KEY)
      .all<{ b: number; n: number }>(),
    env.DB.prepare(`SELECT COALESCE(json_extract(h.value, '$.tier'), 0) AS tier, COUNT(*) AS n ${heroes} GROUP BY tier ORDER BY tier`)
      .bind(SAVE_KEY)
      .all<{ tier: number; n: number }>(),
    env.DB.prepare(`SELECT COALESCE(json_extract(h.value, '$.at.region'), '') AS land, COUNT(*) AS n, AVG(json_extract(h.value, '$.level')) AS lvl ${heroes} GROUP BY land ORDER BY n DESC`)
      .bind(SAVE_KEY)
      .all<{ land: string; n: number; lvl: number }>(),
    env.DB.prepare(
      `SELECT q.key AS id, SUM(json_extract(q.value, '$.state') = 'done') AS done, SUM(json_extract(q.value, '$.state') IN ('active', 'ready')) AS active
       FROM game_saves s, json_each(s.data, '$.heroes') h, json_each(h.value, '$.quests') q WHERE s.key = ? AND h.type = 'object' GROUP BY q.key`,
    )
      .bind(SAVE_KEY)
      .all<{ id: string; done: number; active: number }>(),
    env.DB.prepare(`SELECT b.key AS id, SUM(b.value) AS kills, COUNT(*) AS heroes FROM game_saves s, json_each(s.data, '$.heroes') h, json_each(h.value, '$.bosses') b WHERE s.key = ? AND h.type = 'object' GROUP BY b.key ORDER BY kills DESC`)
      .bind(SAVE_KEY)
      .all<{ id: string; kills: number; heroes: number }>(),
    env.DB.prepare(`SELECT r.key AS cls, COUNT(*) AS players, MAX(r.value) AS top, AVG(r.value) AS avg FROM game_saves s, json_each(s.data, '$.rift') r WHERE s.key = ? GROUP BY r.key ORDER BY players DESC`)
      .bind(SAVE_KEY)
      .all<{ cls: string; players: number; top: number; avg: number }>(),
    Promise.all(['trial', 'stone', 'level'].map((f) => familyBoards(env, f))),
    env.DB.prepare(`SELECT COUNT(DISTINCT user_id) AS d1 FROM game_saves WHERE key = ? AND updated_at > ?`).bind(SAVE_KEY, now - DAY).first<{ d1: number }>(),
  ]);
  return {
    players: num(totals?.players),
    playedToday: recent?.d1 ?? 0,
    heroes: num(totals?.heroes),
    reviewHeroes: num(totals?.review),
    hoursPlayed: Math.round(num(totals?.time) / 3600),
    avgMinutes: Math.round(num(totals?.avg_time) / 60),
    avgLevel: round1(num(totals?.avg_level)),
    maxed: num(totals?.maxed),
    topParagon: num(totals?.top_paragon),
    kills: num(totals?.kills),
    deaths: num(totals?.deaths),
    stoneHeroes: num(totals?.stones),
    topStone: num(totals?.top_stone),
    avgStone: round1(num(totals?.avg_stone)),
    levels: levels.results.map((l) => ({ from: l.b * 10 || 1, to: l.b >= 6 ? 60 : l.b * 10 + 9, heroes: l.n })),
    tiers: tiers.results.map((t) => ({ tier: num(t.tier), heroes: t.n })),
    lands: lands.results.map((l) => ({ land: l.land, heroes: l.n, avgLevel: round1(l.lvl) })),
    quests: quests.results.map((q) => ({ id: q.id, done: num(q.done), active: num(q.active) })),
    bosses: bosses.results.map((b) => ({ id: b.id, kills: num(b.kills), heroes: b.heroes })),
    trials: trials.results.map((t) => ({ cls: t.cls, players: t.players, top: num(t.top), avg: round1(num(t.avg)) })),
    boards: boards.flat(),
  };
}

/* ------------------------------------------------------------------ the Vigil */

/** The Vigil's nights across every signed-in player: who has held one in each land, the longest and the usual. */
export async function vigilOverview(env: Env, now = Date.now()): Promise<VigilAdminOverview> {
  const [lands, players, boards] = await Promise.all([
    env.DB.prepare(
      `SELECT b.key AS land, COUNT(*) AS players, MAX(b.value) AS top, AVG(b.value) AS avg, SUM(b.value >= 600) AS ten, SUM(s.updated_at > ?) AS week
       FROM game_saves s, json_each(s.data) b WHERE s.key = ? AND b.type IN ('integer', 'real') GROUP BY b.key ORDER BY players DESC`,
    )
      .bind(now - 7 * DAY, VIGIL_KEY)
      .all<{ land: string; players: number; top: number; avg: number; ten: number; week: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(updated_at > ?) AS week FROM game_saves WHERE key = ?').bind(now - 7 * DAY, VIGIL_KEY).first<{ n: number; week: number | null }>(),
    familyBoards(env, 'vigil'),
  ]);
  return {
    players: players?.n ?? 0,
    active7d: players?.week ?? 0,
    lands: lands.results.map((l) => ({ land: l.land, players: l.players, top: Math.round(num(l.top)), avg: Math.round(num(l.avg)), tenMinutes: num(l.ten), active7d: num(l.week) })),
    boards,
  };
}
