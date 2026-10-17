import { GAMES } from '../src/catalog/games';
import type { Badge, BestView, Me, QuestView } from '../src/platform/apiTypes';
import { currentStreak } from '../src/platform/daily';
import { levelForXp, questsForDay, xpForLevel, type QuestDef } from '../src/platform/progression';
import type { Env } from './http';
import { isAdmin, type UserRow } from './session';

/** Accepts the player's local calendar day if it is within a day of UTC (time zones), else UTC today. */
export function clientDay(raw: unknown, now = Date.now()): string {
  const utc = new Date(now).toISOString().slice(0, 10);
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return utc;
  const diff = Math.abs(Date.parse(`${raw}T12:00:00Z`) - Date.parse(`${utc}T12:00:00Z`));
  return diff <= 86400_000 ? raw : utc;
}

export function parseStats(raw: string | null | undefined): Record<string, number> {
  try {
    const v = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number') out[k] = n;
    return out;
  } catch {
    return {};
  }
}

interface DayRound {
  game: string;
  score: number;
  stats: string | null;
  new_best: number;
}

/** Progress of today's quests, computed from the rounds the server recorded (not client claims). */
export async function questViews(env: Env, user: UserRow, day: string): Promise<QuestView[]> {
  const [roundsRes, daily, fav, claims] = await Promise.all([
    env.DB.prepare(`SELECT game, score, stats, new_best FROM runs WHERE user_id = ? AND day = ? AND status = 'ok'`).bind(user.id, day).all<DayRound>(),
    env.DB.prepare('SELECT done FROM dailies WHERE user_id = ? AND day = ?').bind(user.id, day).first<{ done: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?').bind(user.id).first<{ n: number }>(),
    env.DB.prepare('SELECT quest_id FROM quest_claims WHERE user_id = ? AND day = ?').bind(user.id, day).all<{ quest_id: string }>(),
  ]);
  const rounds = roundsRes.results;
  const claimed = new Set(claims.results.map((c) => c.quest_id));
  const hasFavorite = (fav?.n ?? 0) > 0;
  // A favorite quest stays on the board once it was picked for today, even after it is done.
  const defs = questsForDay(user.id, day, GAMES, hasFavorite && !claimed.has('favorite'));
  return defs.map((q) => {
    const progress = Math.min(q.target, questProgress(q, rounds, !!daily?.done, hasFavorite));
    return { id: q.id, label: q.label, icon: q.icon, xp: q.xp, target: q.target, progress, done: progress >= q.target, claimed: claimed.has(q.id) };
  });
}

function questProgress(q: QuestDef, rounds: DayRound[], dailyDone: boolean, hasFavorite: boolean): number {
  switch (q.kind) {
    case 'rounds':
      return rounds.length;
    case 'best':
      return rounds.some((r) => r.new_best) ? 1 : 0;
    case 'daily':
      return dailyDone ? 1 : 0;
    case 'favorite':
      return hasFavorite ? 1 : 0;
    case 'metric':
      return Math.max(0, ...rounds.filter((r) => r.game === q.game).map((r) => (q.metric === 'score' ? r.score : (parseStats(r.stats)[q.metric!] ?? 0))));
  }
}

export async function buildMe(env: Env, user: UserRow, day: string): Promise<Me> {
  const [favs, bests, roundCount, dailyDone, claimsCount, crown, quests] = await Promise.all([
    env.DB.prepare('SELECT game FROM favorites WHERE user_id = ? ORDER BY created_at').bind(user.id).all<{ game: string }>(),
    env.DB.prepare('SELECT game, score, stats, at FROM bests WHERE user_id = ?').bind(user.id).all<{ game: string; score: number; stats: string; at: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND status = 'ok'`).bind(user.id).first<{ n: number }>(),
    env.DB.prepare('SELECT day FROM dailies WHERE user_id = ? AND done = 1 ORDER BY day DESC LIMIT 400').bind(user.id).all<{ day: string }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM quest_claims WHERE user_id = ?').bind(user.id).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM bests b WHERE b.user_id = ? AND NOT EXISTS (SELECT 1 FROM bests o WHERE o.game = b.game AND o.score > b.score)`,
    )
      .bind(user.id)
      .first<{ n: number }>(),
    questViews(env, user, day),
  ]);
  const bestMap: Record<string, BestView> = {};
  for (const b of bests.results) bestMap[b.game] = { score: b.score, stats: parseStats(b.stats), at: b.at };
  const rounds = roundCount?.n ?? 0;
  const streak = currentStreak(new Set(dailyDone.results.map((d) => d.day)), day);
  const longest = longestStreak(dailyDone.results.map((d) => d.day));
  const level = levelForXp(user.xp);
  const badges: Badge[] = [
    { id: 'first', label: 'First round', hint: 'Finish a round while signed in', earned: rounds >= 1 },
    { id: 'regular', label: 'Regular', hint: 'Finish 25 rounds', earned: rounds >= 25 },
    { id: 'devoted', label: 'Devoted', hint: 'Finish 200 rounds', earned: rounds >= 200 },
    { id: 'streak3', label: 'On a roll', hint: 'Clear the Daily Challenge 3 days in a row', earned: longest >= 3 },
    { id: 'streak7', label: 'Week warrior', hint: 'Clear the Daily Challenge 7 days in a row', earned: longest >= 7 },
    { id: 'quests10', label: 'Questing', hint: 'Claim 10 daily quests', earned: (claimsCount?.n ?? 0) >= 10 },
    { id: 'crown', label: 'Crowned', hint: 'Hold the #1 score in any game', earned: (crown?.n ?? 0) > 0 },
    { id: 'level5', label: 'Level 5', hint: 'Reach level 5', earned: level >= 5 },
  ];
  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    avatar: user.avatar,
    isAdmin: isAdmin(env, user),
    xp: user.xp,
    level,
    levelFloor: xpForLevel(level),
    levelNext: xpForLevel(level + 1),
    notify: !!user.notify,
    favorites: favs.results.map((f) => f.game),
    bests: bestMap,
    rounds,
    streak,
    badges,
    quests,
    questDay: day,
    joinedAt: user.created_at,
  };
}

export function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const d of sorted) {
    const t = Date.parse(`${d}T12:00:00Z`);
    run = prev && t - prev === 86400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}
