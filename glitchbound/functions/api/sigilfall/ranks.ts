import { bad, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { currentUser, requireUser } from '../../../server/session';
import { listed } from '../../../server/staff';

/**
 * Sigilfall's rankings (migrations/0024): every player's best on each of the game's boards.
 *
 * GET  /api/sigilfall/ranks?board=trial            the top 50 of a board, and your own row if you are lower.
 * POST /api/sigilfall/ranks { entries: [{ board, score }] }   a signed-in player's bests, as their game has them.
 *
 * The bests are the game's own and are sent as it has them (a save lives on the player's device), so they are
 * held to what the game can give: a board that exists, a whole number inside that board's range, a row that only
 * ever goes up. Banned players are left off; studio and QA accounts are listed, marked as such.
 *
 * The Ring's boards are the exception: they come from the ranked ladder the server keeps (server/ring.ts), and a
 * device can't write them here.
 */

/** Each family of boards and the most a score on it can be. `family:part` is a board of its own (a calling, a land). */
const FAMILIES: Record<string, number> = {
  // the Rift Trials' highest stone (overall, and `trial:<calling>`)
  trial: 999,
  // a story hero's own highest Riftstone
  stone: 999,
  // the Vigil's longest night in seconds (overall, and `vigil:<land>`)
  vigil: 86_400,
  // the Ring's best rating (overall, and `ring:solo`, `ring:duo`, `ring:trio`: 1v1, 2v2 and 3v3)
  ring: 9999,
  // the highest hero: level × 10000 + Paragon level
  level: 60 * 10_000 + 9999,
  // a Rift season's best stone in time (data/seasons.ts): `season:s<n>` the highest, `season:s<n>-<calling>` each calling's
  season: 999,
};
const BOARD = /^([a-z]{3,8})(?::([a-z][a-z0-9-]{1,31}))?$/;
/** A Rift season's boards: its number, and a calling's. */
const SEASON_PART = /^s[1-9][0-9]{0,3}(-[a-z]{3,16})?$/;
/** The Ring's formats, each a board of its own: 1v1, 2v2 and 3v3. */
const RING_FORMATS: ReadonlySet<string> = new Set(['solo', 'duo', 'trio']);

/** A board's name if there is such a board, else null; and the most its score can be. */
export function boardOf(name: unknown): { board: string; max: number } | null {
  if (typeof name !== 'string') return null;
  const m = BOARD.exec(name);
  const max = m ? FAMILIES[m[1]!] : undefined;
  if (!m || max === undefined) return null;
  // (only the Trials, the Vigil, the Ring and the seasons have boards within them: the Ring's, one for each format, and no
  // other; a season's, its own and each calling's; and a season is nothing but its boards)
  if (m[2] && m[1] !== 'trial' && m[1] !== 'vigil' && m[1] !== 'ring' && m[1] !== 'season') return null;
  if (m[2] && m[1] === 'ring' && !RING_FORMATS.has(m[2])) return null;
  if (m[1] === 'season' && (!m[2] || !SEASON_PART.test(m[2]))) return null;
  // (the other families' parts are lands and callings: words, no numbers)
  if (m[2] && m[1] !== 'season' && /[0-9]/.test(m[2])) return null;
  return { board: name, max };
}

export interface RankRow {
  rank: number;
  nickname: string;
  score: number;
  at: number;
  you: boolean;
  /** A studio or QA account: listed like anyone, marked so (the owner: "show them but add an eye with a cross"). */
  staff?: boolean;
}

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const b = boardOf(new URL(request.url).searchParams.get('board'));
  if (!b) return bad('unknown_board', 404);
  const me = await currentUser(env, request);
  // (every player but a banned one; a studio or QA account is listed too, and marked: server/staff.ts `listed` says which)
  const res = await env.DB.prepare(`SELECT r.user_id, r.score, r.at, u.nickname, CASE WHEN ${listed(env)} THEN 0 ELSE 1 END AS staff FROM sigilfall_ranks r JOIN users u ON u.id = r.user_id WHERE r.board = ? AND r.score > 0 AND u.banned_at IS NULL ORDER BY r.score DESC, r.at ASC LIMIT 50`)
    .bind(b.board)
    .all<{ user_id: string; score: number; at: number; nickname: string; staff: number }>();
  // equal scores share a rank (1, 2, 2, 4), as on the arcade's boards
  const rows: RankRow[] = [];
  res.results.forEach((r, i) => {
    const prev = rows[i - 1];
    rows.push({ rank: prev?.score === r.score ? prev.rank : i + 1, nickname: r.nickname, score: r.score, at: r.at, you: r.user_id === me?.id, ...(r.staff ? { staff: true } : {}) });
  });
  let mine: RankRow | null = null;
  if (me && !rows.some((r) => r.you)) {
    const own = await env.DB.prepare('SELECT score, at FROM sigilfall_ranks WHERE user_id = ? AND board = ? AND score > 0').bind(me.id, b.board).first<{ score: number; at: number }>();
    if (own) {
      const ahead = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sigilfall_ranks r JOIN users u ON u.id = r.user_id WHERE r.board = ? AND r.score > ? AND u.banned_at IS NULL`).bind(b.board, own.score).first<{ n: number }>();
      const staff = await env.DB.prepare(`SELECT 1 AS n FROM users u WHERE u.id = ? AND NOT (${listed(env)})`).bind(me.id).first<{ n: number }>();
      mine = { rank: (ahead?.n ?? 0) + 1, nickname: me.nickname, score: own.score, at: own.at, you: true, ...(staff ? { staff: true } : {}) };
    }
  }
  return json({ board: b.board, rows, mine, signedIn: !!me }, 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const list = Array.isArray(body?.entries) ? (body.entries as unknown[]).slice(0, 40) : [];
  const now = Date.now();
  // (a board an admin keeps this player off: what their device sends for it is left out, Admin › Sigilfall)
  const held = list.length ? new Set((await env.DB.prepare('SELECT board FROM sigilfall_rank_holds WHERE user_id = ?').bind(user.id).all<{ board: string }>()).results.map((r) => r.board)) : new Set<string>();
  const writes = [];
  for (const e of list) {
    const o = e && typeof e === 'object' ? (e as { board?: unknown; score?: unknown }) : {};
    const b = boardOf(o.board);
    if (!b || typeof o.score !== 'number' || !Number.isFinite(o.score)) continue;
    // (the Ring's boards are the server's ladder's own: server/ring.ts writes them as matches are settled)
    if (b.board === 'ring' || b.board.startsWith('ring:') || held.has(b.board)) continue;
    const score = Math.floor(o.score);
    if (score <= 0 || score > b.max) continue;
    writes.push(
      env.DB.prepare('INSERT INTO sigilfall_ranks (user_id, board, score, at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, board) DO UPDATE SET score = excluded.score, at = excluded.at WHERE excluded.score > sigilfall_ranks.score').bind(user.id, b.board, score, now),
    );
  }
  if (writes.length) await env.DB.batch(writes);
  return json({ ok: true, kept: writes.length });
}
