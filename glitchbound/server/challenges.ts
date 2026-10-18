import { getGame } from '../src/catalog/catalog';
import { MAX_PLAYERS, roundWinners, type ChallengeListItem, type ChallengeView } from '../src/platform/challenge';
import type { Env } from './http';
import { currentUser } from './session';

/** The requesting player: a member's account, else the device key the browser sends. */
export async function playerOf(env: Env, request: Request, body: Record<string, unknown> | null): Promise<string | null> {
  const user = await currentUser(env, request);
  if (user) return `u:${user.id}`;
  const key = typeof body?.key === 'string' ? body.key : new URL(request.url).searchParams.get('key');
  return key && /^[A-Za-z0-9_-]{16,64}$/.test(key) ? `g:${key}` : null;
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
    host: row.host,
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
