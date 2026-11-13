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
 * ever goes up. Banned players and staff are left off, as on the arcade's boards.
 */

/** Each family of boards and the most a score on it can be. `family:part` is a board of its own (a calling, a land). */
const FAMILIES: Record<string, number> = {
  // the Rift Trials' highest stone (overall, and `trial:<calling>`)
  trial: 999,
  // a story hero's own highest Riftstone
  stone: 999,
  // the Vigil's longest night in seconds (overall, and `vigil:<land>`)
  vigil: 86_400,
  // the Ring's best rating
  ring: 9999,
  // the highest hero: level × 10000 + Paragon level
  level: 60 * 10_000 + 9999,
};
const BOARD = /^([a-z]{3,8})(?::([a-z][a-z-]{1,31}))?$/;

/** A board's name if there is such a board, else null; and the most its score can be. */
export function boardOf(name: unknown): { board: string; max: number } | null {
  if (typeof name !== 'string') return null;
  const m = BOARD.exec(name);
  const max = m ? FAMILIES[m[1]!] : undefined;
  if (!m || max === undefined) return null;
  // (only the Trials and the Vigil have boards within them)
  if (m[2] && m[1] !== 'trial' && m[1] !== 'vigil') return null;
  return { board: name, max };
}

export interface RankRow {
  rank: number;
  nickname: string;
  score: number;
  at: number;
  you: boolean;
}

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const b = boardOf(new URL(request.url).searchParams.get('board'));
  if (!b) return bad('unknown_board', 404);
  const me = await currentUser(env, request);
  const res = await env.DB.prepare(`SELECT r.user_id, r.score, r.at, u.nickname FROM sigilfall_ranks r JOIN users u ON u.id = r.user_id WHERE r.board = ? AND r.score > 0 AND ${listed(env)} ORDER BY r.score DESC, r.at ASC LIMIT 50`)
    .bind(b.board)
    .all<{ user_id: string; score: number; at: number; nickname: string }>();
  // equal scores share a rank (1, 2, 2, 4), as on the arcade's boards
  const rows: RankRow[] = [];
  res.results.forEach((r, i) => {
    const prev = rows[i - 1];
    rows.push({ rank: prev?.score === r.score ? prev.rank : i + 1, nickname: r.nickname, score: r.score, at: r.at, you: r.user_id === me?.id });
  });
  let mine: RankRow | null = null;
  if (me && !rows.some((r) => r.you)) {
    const own = await env.DB.prepare('SELECT score, at FROM sigilfall_ranks WHERE user_id = ? AND board = ? AND score > 0').bind(me.id, b.board).first<{ score: number; at: number }>();
    if (own) {
      const ahead = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sigilfall_ranks r JOIN users u ON u.id = r.user_id WHERE r.board = ? AND r.score > ? AND ${listed(env)}`).bind(b.board, own.score).first<{ n: number }>();
      mine = { rank: (ahead?.n ?? 0) + 1, nickname: me.nickname, score: own.score, at: own.at, you: true };
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
  const writes = [];
  for (const e of list) {
    const o = e && typeof e === 'object' ? (e as { board?: unknown; score?: unknown }) : {};
    const b = boardOf(o.board);
    if (!b || typeof o.score !== 'number' || !Number.isFinite(o.score)) continue;
    const score = Math.floor(o.score);
    if (score <= 0 || score > b.max) continue;
    writes.push(
      env.DB.prepare('INSERT INTO sigilfall_ranks (user_id, board, score, at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, board) DO UPDATE SET score = excluded.score, at = excluded.at WHERE excluded.score > sigilfall_ranks.score').bind(user.id, b.board, score, now),
    );
  }
  if (writes.length) await env.DB.batch(writes);
  return json({ ok: true, kept: writes.length });
}
