import { getGame } from '../src/catalog/catalog';
import { MAX_PLAYERS, roundWinners, type ChallengeListItem, type ChallengeView } from '../src/platform/challenge';
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
}

export async function challengeRow(env: Env, id: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9]{5,12}$/.test(id)) return null;
  return env.DB.prepare('SELECT id, game, mode, day, seed, round, host, created_at, updated_at FROM challenges WHERE id = ?').bind(id).first<Row>();
}

export async function viewOf(env: Env, row: Row, player: string | null): Promise<ChallengeView> {
  const [players, scores] = await Promise.all([
    env.DB.prepare('SELECT player, name FROM challenge_players WHERE challenge_id = ? ORDER BY joined_at').bind(row.id).all<{ player: string; name: string }>(),
    env.DB.prepare('SELECT round, player, score, stats, at FROM challenge_scores WHERE challenge_id = ? ORDER BY round, at').bind(row.id).all<{ round: number; player: string; score: number; stats: string; at: number }>(),
  ]);
  const lower = !!getGame(row.game)?.challenge?.lowerIsBetter;
  const nameOf = new Map(players.results.map((p) => [p.player, p.name]));
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
  const joined = !!player && nameOf.has(player);
  const playedNow = scores.results.some((s) => s.round === row.round && s.player === player);
  return {
    id: row.id,
    game: row.game,
    mode: row.mode,
    day: row.day,
    round: row.round,
    seed: row.seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    players: players.results.map((p) => ({ name: p.name, you: p.player === player, wins: wins.get(p.name) ?? 0, total: totals.get(p.name) ?? 0 })),
    rounds: [...rounds.values()].sort((a, b) => b.round - a.round),
    joined,
    yourTurn: joined && !playedNow,
    full: players.results.length >= MAX_PLAYERS,
  };
}

/** Challenges a player is in, most recently active first. */
export async function listFor(env: Env, player: string): Promise<ChallengeListItem[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.game, c.round, c.updated_at FROM challenge_players p JOIN challenges c ON c.id = p.challenge_id
     WHERE p.player = ? ORDER BY c.updated_at DESC LIMIT 30`,
  )
    .bind(player)
    .all<{ id: string; game: string; round: number; updated_at: number }>();
  const out: ChallengeListItem[] = [];
  for (const c of results) {
    const [players, scores] = await Promise.all([
      env.DB.prepare('SELECT player, name FROM challenge_players WHERE challenge_id = ?').bind(c.id).all<{ player: string; name: string }>(),
      env.DB.prepare('SELECT player, score FROM challenge_scores WHERE challenge_id = ? AND round = ?').bind(c.id, c.round).all<{ player: string; score: number }>(),
    ]);
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
    });
  }
  return out;
}
