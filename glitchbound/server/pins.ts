import { earnedPins, type GameFacts, type PinFacts } from '../src/catalog/pins';
import { levelForXp } from '../src/platform/progression';
import type { Env } from './http';
import { longestStreak, parseStats } from './members';
import { listed } from './staff';

/** Enough of a player's recent rounds to read their highest stats, without reading a whole history each time. */
const ROUNDS_READ = 2000;

/** What the server has recorded for a player: only its own records count, never what a client claims. */
async function factsFor(env: Env, user: { id: string; xp: number }): Promise<PinFacts> {
  const [rounds, bests, days, friends, ranks] = await Promise.all([
    env.DB.prepare(`SELECT game, score, stats FROM runs WHERE user_id = ? AND status = 'ok' ORDER BY ended_at DESC LIMIT ${ROUNDS_READ}`).bind(user.id).all<{ game: string; score: number | null; stats: string | null }>(),
    env.DB.prepare('SELECT game, score, stats FROM bests WHERE user_id = ?').bind(user.id).all<{ game: string; score: number; stats: string }>(),
    env.DB.prepare('SELECT day FROM dailies WHERE user_id = ? AND done = 1 ORDER BY day DESC LIMIT 800').bind(user.id).all<{ day: string }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM friends WHERE user_id = ?').bind(user.id).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT MIN((SELECT COUNT(*) FROM bests o JOIN users u ON u.id = o.user_id WHERE o.game = b.game AND o.score > b.score AND ${listed(env)})) AS ahead
       FROM bests b WHERE b.user_id = ? AND b.score > 0`,
    )
      .bind(user.id)
      .first<{ ahead: number | null }>(),
  ]);
  const games: Record<string, GameFacts> = {};
  const facts = (game: string): GameFacts => (games[game] ??= { rounds: 0, score: 0, stats: {} });
  const keep = (g: GameFacts, score: number, stats: Record<string, number>): void => {
    g.score = Math.max(g.score, score);
    for (const [k, v] of Object.entries(stats)) g.stats[k] = Math.max(g.stats[k] ?? 0, v);
  };
  for (const r of rounds.results) {
    const g = facts(r.game);
    g.rounds++;
    keep(g, r.score ?? 0, parseStats(r.stats));
  }
  // A best stays when its round is past the rounds read.
  for (const b of bests.results) keep(facts(b.game), b.score, parseStats(b.stats));
  const ahead = ranks?.ahead;
  return {
    games,
    totalRounds: rounds.results.length,
    gamesPlayed: Object.values(games).filter((g) => g.rounds > 0).length,
    streak: longestStreak(days.results.map((d) => d.day)),
    level: levelForXp(user.xp),
    friends: friends?.n ?? 0,
    podium: ahead !== null && ahead !== undefined && ahead < 3,
    crown: ahead === 0,
  };
}

export async function heldPins(env: Env, userId: string): Promise<{ id: string; at: number }[]> {
  const res = await env.DB.prepare('SELECT pin, at FROM pins WHERE user_id = ?').bind(userId).all<{ pin: string; at: number }>();
  return res.results.map((r) => ({ id: r.pin, at: r.at }));
}

/** Awards whatever the player's record now earns; a pin once earned stays. Returns the new ones. */
export async function syncPins(env: Env, user: { id: string; xp: number }): Promise<string[]> {
  const [facts, held] = await Promise.all([factsFor(env, user), heldPins(env, user.id)]);
  const have = new Set(held.map((h) => h.id));
  const fresh = earnedPins(facts).map((p) => p.id).filter((id) => !have.has(id));
  if (fresh.length) {
    const now = Date.now();
    await env.DB.batch(fresh.map((id) => env.DB.prepare('INSERT OR IGNORE INTO pins (user_id, pin, at) VALUES (?, ?, ?)').bind(user.id, id, now)));
  }
  return fresh;
}

/** How many listed players hold each pin, and how many collect at all. */
export async function pinRarity(env: Env): Promise<{ players: number; held: Record<string, number> }> {
  const [players, rows] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(DISTINCT p.user_id) AS n FROM pins p JOIN users u ON u.id = p.user_id WHERE ${listed(env)}`).first<{ n: number }>(),
    env.DB.prepare(`SELECT p.pin, COUNT(*) AS n FROM pins p JOIN users u ON u.id = p.user_id WHERE ${listed(env)} GROUP BY p.pin`).all<{ pin: string; n: number }>(),
  ]);
  return { players: players?.n ?? 0, held: Object.fromEntries(rows.results.map((r) => [r.pin, r.n])) };
}
