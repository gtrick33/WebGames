import { getGame } from '../src/catalog/catalog';
import { CHALLENGE_IDLE_MS, CHALLENGE_KEEP_MS, CHALLENGE_LOBBY_MS, closesAt, MAX_PLAYERS, roundWinners, type ChallengeListItem, type ChallengeView } from '../src/platform/challenge';
import type { Env } from './http';
import { currentUser } from './session';

/**
 * The requesting player: a member's account, else the device key the browser sends. A member who
 * still sends this device's key first takes over what they did here as a guest (see claimGuest).
 */
export async function playerOf(env: Env, request: Request, body: Record<string, unknown> | null): Promise<string | null> {
  const raw = typeof body?.key === 'string' ? body.key : new URL(request.url).searchParams.get('key');
  const key = raw && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null;
  const user = await currentUser(env, request);
  if (user) {
    if (key) await claimGuest(env, user.id, key);
    return `u:${user.id}`;
  }
  return key ? `g:${key}` : null;
}

/**
 * A guest who signs in keeps their challenges: the device key's seats, scores and hosted challenges
 * move to the member's account. This runs on the first signed-in challenge request from the device,
 * so it covers every way of signing in (the emailed link cannot carry the key). Where the member
 * already has a seat too (they joined again after signing in, or on another device), the two
 * become one: the earlier seat's name and place stay, and in each round the first finished score
 * counts, as it does for everyone.
 */
export async function claimGuest(env: Env, userId: string, key: string): Promise<void> {
  const guest = `g:${key}`;
  const member = `u:${userId}`;
  if (!(await env.DB.prepare('SELECT 1 AS ok FROM challenge_players WHERE player = ? LIMIT 1').bind(guest).first())) return;
  // "The other identity also has a score in this round / a seat in this challenge" (closed by the caller).
  const scoreIn = 'EXISTS (SELECT 1 FROM challenge_scores o WHERE o.challenge_id = challenge_scores.challenge_id AND o.round = challenge_scores.round AND o.player = ?';
  const seatIn = 'EXISTS (SELECT 1 FROM challenge_players o WHERE o.challenge_id = challenge_players.challenge_id AND o.player = ?';
  await env.DB.batch([
    // Scores: in a round both played, keep the earlier one; then the guest's rest become the member's.
    env.DB.prepare(`DELETE FROM challenge_scores WHERE player = ? AND ${scoreIn} AND o.at < challenge_scores.at)`).bind(member, guest),
    env.DB.prepare(`DELETE FROM challenge_scores WHERE player = ? AND ${scoreIn})`).bind(guest, member),
    env.DB.prepare('UPDATE challenge_scores SET player = ? WHERE player = ?').bind(member, guest),
    // Seats: where both sit, the member's seat takes the earlier seat's name and place.
    env.DB.prepare(
      `UPDATE challenge_players SET (name, joined_at) = (SELECT o.name, o.joined_at FROM challenge_players o WHERE o.challenge_id = challenge_players.challenge_id AND o.player = ?)
       WHERE player = ? AND ${seatIn} AND o.joined_at < challenge_players.joined_at)`,
    ).bind(guest, member, guest),
    env.DB.prepare(`DELETE FROM challenge_players WHERE player = ? AND ${seatIn})`).bind(guest, member),
    env.DB.prepare('UPDATE challenge_players SET player = ? WHERE player = ?').bind(member, guest),
    env.DB.prepare('UPDATE challenges SET host = ? WHERE host = ?').bind(member, guest),
  ]);
}

interface Row {
  id: string;
  game: string;
  mode: 'daily' | 'fresh';
  day: string;
  seed: number;
  round: number;
  host: string;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
}

export async function challengeRow(env: Env, id: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9]{5,12}$/.test(id)) return null;
  return env.DB.prepare('SELECT id, game, mode, day, seed, round, host, created_at, updated_at, closed_at FROM challenges WHERE id = ?').bind(id).first<Row>();
}

/** Players still in a challenge (not left), and whether anyone has played yet. */
async function activity(env: Env, id: string): Promise<{ active: number; scored: boolean }> {
  const r = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM challenge_players WHERE challenge_id = ?1 AND left_at IS NULL) AS active, EXISTS (SELECT 1 FROM challenge_scores WHERE challenge_id = ?1) AS scored',
  )
    .bind(id)
    .first<{ active: number; scored: number }>();
  return { active: r?.active ?? 0, scored: !!r?.scored };
}

/** Whether a challenge is over: ended, or quiet past its closing time. */
export async function isClosed(env: Env, row: Row, now = Date.now()): Promise<boolean> {
  if (row.closed_at) return true;
  if (now - row.updated_at < CHALLENGE_LOBBY_MS) return false;
  const a = await activity(env, row.id);
  return now > closesAt(row.updated_at, a.active <= 1 && !a.scored);
}

/**
 * Deletes what is over: lobbies nobody joined within a day, and challenges that ended (or went quiet)
 * a month ago, with their seats and scores. Runs alongside creating and listing challenges.
 */
export async function sweep(env: Env, now = Date.now()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM challenges WHERE closed_at IS NULL AND updated_at < ?
       AND (SELECT COUNT(*) FROM challenge_players p WHERE p.challenge_id = challenges.id AND p.left_at IS NULL) <= 1
       AND NOT EXISTS (SELECT 1 FROM challenge_scores s WHERE s.challenge_id = challenges.id)`,
    ).bind(now - CHALLENGE_LOBBY_MS),
    env.DB.prepare('DELETE FROM challenges WHERE closed_at < ? OR updated_at < ?').bind(now - CHALLENGE_KEEP_MS, now - CHALLENGE_IDLE_MS - CHALLENGE_KEEP_MS),
    env.DB.prepare('DELETE FROM challenge_players WHERE challenge_id NOT IN (SELECT id FROM challenges)'),
    env.DB.prepare('DELETE FROM challenge_scores WHERE challenge_id NOT IN (SELECT id FROM challenges)'),
  ]);
}

/**
 * The host ends a challenge for everyone (one nobody else joined or played is simply deleted);
 * anyone else leaves it (their scores stay on the board). When the last player leaves, it ends.
 * Returns false when the challenge was deleted.
 */
export async function endOrLeave(env: Env, row: Row, player: string): Promise<boolean> {
  const now = Date.now();
  if (row.host === player) {
    const a = await activity(env, row.id);
    if (a.active <= 1 && !a.scored) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM challenge_players WHERE challenge_id = ?').bind(row.id),
        env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(row.id),
      ]);
      return false;
    }
    await env.DB.prepare('UPDATE challenges SET closed_at = COALESCE(closed_at, ?), updated_at = ? WHERE id = ?').bind(now, now, row.id).run();
    return true;
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE challenge_players SET left_at = ? WHERE challenge_id = ? AND player = ? AND left_at IS NULL').bind(now, row.id, player),
    env.DB.prepare(
      'UPDATE challenges SET updated_at = ?1, closed_at = CASE WHEN closed_at IS NULL AND NOT EXISTS (SELECT 1 FROM challenge_players WHERE challenge_id = ?2 AND left_at IS NULL) THEN ?1 ELSE closed_at END WHERE id = ?2',
    ).bind(now, row.id),
  ]);
  return true;
}

export async function viewOf(env: Env, row: Row, player: string | null): Promise<ChallengeView> {
  const [seats, scores] = await Promise.all([
    env.DB.prepare('SELECT player, name, left_at FROM challenge_players WHERE challenge_id = ? ORDER BY joined_at').bind(row.id).all<{ player: string; name: string; left_at: number | null }>(),
    env.DB.prepare('SELECT round, player, score, stats, at FROM challenge_scores WHERE challenge_id = ? ORDER BY round, at').bind(row.id).all<{ round: number; player: string; score: number; stats: string; at: number }>(),
  ]);
  const lower = !!getGame(row.game)?.challenge?.lowerIsBetter;
  // Players who left keep their name on the scores they set, but no longer hold a seat.
  const nameOf = new Map(seats.results.map((p) => [p.player, p.name]));
  const players = seats.results.filter((p) => p.left_at === null);
  const rounds = new Map<number, ChallengeView['rounds'][number]>();
  for (const s of scores.results) {
    const r = rounds.get(s.round) ?? { round: s.round, scores: [] };
    let stats: Record<string, number> = {};
    try {
      stats = JSON.parse(s.stats) as Record<string, number>;
    } catch {
      /* none */
    }
    r.scores.push({ name: nameOf.get(s.player) ?? 'Player', score: s.score, stats, you: s.player === player, at: s.at });
    rounds.set(s.round, r);
  }
  for (const r of rounds.values()) r.scores.sort((a, b) => (lower ? a.score - b.score : b.score - a.score) || a.at - b.at);
  const wins = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const r of rounds.values()) {
    for (const w of roundWinners(r.scores, lower)) wins.set(w, (wins.get(w) ?? 0) + 1);
    for (const s of r.scores) totals.set(s.name, (totals.get(s.name) ?? 0) + s.score);
  }
  const joined = !!player && players.some((p) => p.player === player);
  const playedThisRound = new Set(scores.results.filter((s) => s.round === row.round).map((s) => s.player));
  const lobby = players.length <= 1 && scores.results.length === 0;
  const closed = !!row.closed_at || Date.now() > closesAt(row.updated_at, lobby);
  return {
    id: row.id,
    game: row.game,
    mode: row.mode,
    day: row.day,
    round: row.round,
    seed: row.seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    players: players.map((p) => ({ name: p.name, you: p.player === player, wins: wins.get(p.name) ?? 0, total: totals.get(p.name) ?? 0, played: playedThisRound.has(p.player) })),
    rounds: [...rounds.values()].sort((a, b) => b.round - a.round),
    joined,
    yourTurn: joined && !closed && !playedThisRound.has(player),
    full: players.length >= MAX_PLAYERS,
    host: !!player && row.host === player,
    closed,
    closesAt: closed ? 0 : closesAt(row.updated_at, lobby),
  };
}

/** Challenges a player is in, most recently active first. */
export async function listFor(env: Env, player: string): Promise<ChallengeListItem[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.game, c.round, c.host, c.updated_at FROM challenge_players p JOIN challenges c ON c.id = p.challenge_id
     WHERE p.player = ? AND p.left_at IS NULL AND c.closed_at IS NULL AND c.updated_at > ? ORDER BY c.updated_at DESC LIMIT 30`,
  )
    .bind(player, Date.now() - CHALLENGE_IDLE_MS)
    .all<{ id: string; game: string; round: number; host: string; updated_at: number }>();
  const out: ChallengeListItem[] = [];
  for (const c of results) {
    const [players, scores, any] = await Promise.all([
      env.DB.prepare('SELECT player, name FROM challenge_players WHERE challenge_id = ? AND left_at IS NULL').bind(c.id).all<{ player: string; name: string }>(),
      env.DB.prepare('SELECT player, score FROM challenge_scores WHERE challenge_id = ? AND round = ?').bind(c.id, c.round).all<{ player: string; score: number }>(),
      env.DB.prepare('SELECT 1 AS ok FROM challenge_scores WHERE challenge_id = ? LIMIT 1').bind(c.id).first(),
    ]);
    const lobby = players.results.length <= 1 && !any;
    const ends = closesAt(c.updated_at, lobby);
    if (Date.now() > ends) continue;
    const played = new Set(scores.results.map((s) => s.player));
    const lower = !!getGame(c.game)?.challenge?.lowerIsBetter;
    const best = [...scores.results].sort((a, b) => (lower ? a.score - b.score : b.score - a.score))[0];
    out.push({
      id: c.id,
      game: c.game,
      round: c.round,
      players: players.results.length,
      yourTurn: !played.has(player),
      waitingFor: players.results.filter((p) => !played.has(p.player) && p.player !== player).map((p) => p.name),
      leader: best ? (players.results.find((p) => p.player === best.player)?.name ?? '') : '',
      updatedAt: c.updated_at,
      host: c.host === player,
      lobby,
      closesAt: ends,
    });
  }
  return out;
}
