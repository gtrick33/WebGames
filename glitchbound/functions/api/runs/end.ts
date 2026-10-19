import { GAMES } from '../../../src/catalog/games';
import { getGame } from '../../../src/catalog/catalog';
import type { RunEndResult } from '../../../src/platform/apiTypes';
import { challengeForDay, metricValue } from '../../../src/platform/daily';
import { liveRules } from '../../../server/catalogSettings';
import { bad, int, json, readJson, sameOrigin, type Ctx } from '../../../server/http';
import { clientDay, questViews } from '../../../server/members';
import { requireUser } from '../../../server/session';
import { LISTED } from '../../../server/staff';

const MAX = 1e9;

/**
 * POST /api/runs/end { runId, score, stats, day }: records a finished round for leaderboards,
 * bests, the daily challenge and quests. The score must be plausible for the real time elapsed
 * since /api/runs/start (registry `limits`). Client games can still be cheated by a determined
 * player; this keeps out casual tampering.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  if (!body || typeof body.runId !== 'string') return bad('bad_request');
  const run = await env.DB.prepare(`SELECT * FROM runs WHERE id = ?`).bind(body.runId).first<{ user_id: string; game: string; started_at: number; status: string }>();
  if (!run || run.user_id !== user.id) return bad('unknown_run', 404);
  if (run.status !== 'open') return bad('already_submitted', 409);
  const game = getGame(run.game)!;
  const now = Date.now();
  const seconds = (now - run.started_at) / 1000;
  const score = int(body.score);

  // Keep only declared stats, as whole non-negative numbers.
  const stats: Record<string, number> = {};
  const rawStats = body.stats && typeof body.stats === 'object' ? (body.stats as Record<string, unknown>) : {};
  for (const s of game.stats) {
    if (s.key === 'score') continue;
    const v = int(rawStats[s.key]);
    if (v >= 0 && v <= MAX) stats[s.key] = v;
  }

  let reason = '';
  if (!(score >= 0 && score <= MAX)) reason = 'bad_score';
  else if (game.limits && seconds < (game.limits.minSeconds ?? 1)) reason = 'too_fast';
  else if (game.limits && score > game.limits.scorePerSecond * seconds + 50) reason = 'implausible_score';
  if (reason) {
    await env.DB.prepare(`UPDATE runs SET status = 'rejected', ended_at = ?, score = ? WHERE id = ?`).bind(now, Number.isFinite(score) ? score : null, body.runId).run();
    const result: RunEndResult = { ok: false, newBest: false, rank: null, dailyCompleted: false, quests: [], error: reason };
    return json(result, 422);
  }

  const day = clientDay(body.day, now);
  const prev = await env.DB.prepare('SELECT score FROM bests WHERE user_id = ? AND game = ?').bind(user.id, game.slug).first<{ score: number }>();
  // A round that scored nothing still counts as played (quests, the daily), but it is no best and gets no rank:
  // on an empty board a 0 would take the crown. (A game's score is always higher-is-better; times are other stats.)
  const ranked = score > 0;
  const newBest = ranked && (!prev || score > prev.score);
  const statements = [
    env.DB.prepare(`UPDATE runs SET status = 'ok', ended_at = ?, score = ?, stats = ?, day = ?, new_best = ? WHERE id = ?`).bind(
      now,
      score,
      JSON.stringify(stats),
      day,
      newBest && prev ? 1 : 0,
      body.runId,
    ),
  ];
  if (newBest) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO bests (user_id, game, score, stats, at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, game) DO UPDATE SET score = excluded.score, stats = excluded.stats, at = excluded.at`,
      ).bind(user.id, game.slug, score, JSON.stringify(stats), now),
    );
  }

  // The Daily Challenge is shared with guests; members get it synced across devices.
  let dailyCompleted = false;
  const { rules } = await liveRules(env, day);
  const challenge = challengeForDay(day, GAMES, rules);
  if (challenge && challenge.game.slug === game.slug) {
    const value = metricValue(challenge.metric, { type: 'end', score, stats });
    const before = await env.DB.prepare('SELECT done FROM dailies WHERE user_id = ? AND day = ?').bind(user.id, day).first<{ done: number }>();
    const done = value >= challenge.target;
    dailyCompleted = done && !before?.done;
    statements.push(
      env.DB.prepare(
        `INSERT INTO dailies (user_id, day, game, best, done) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, day) DO UPDATE SET best = MAX(dailies.best, excluded.best), done = MAX(dailies.done, excluded.done)`,
      ).bind(user.id, day, game.slug, value, done ? 1 : 0),
    );
  }
  await env.DB.batch(statements);

  const rankRow = ranked
    ? await env.DB.prepare(`SELECT COUNT(*) AS n FROM bests b JOIN users u ON u.id = b.user_id WHERE b.game = ? AND ${LISTED} AND b.score > (SELECT score FROM bests WHERE user_id = ? AND game = ?)`)
        .bind(game.slug, user.id, game.slug)
        .first<{ n: number }>()
    : null;
  const result: RunEndResult = {
    ok: true,
    newBest: newBest && !!prev,
    rank: rankRow ? rankRow.n + 1 : null,
    dailyCompleted,
    quests: await questViews(env, user, day),
  };
  return json(result);
}
