import { giftsTo, loadItems, ownedBy } from './shop';
import { wornFrom, type Worn } from '../src/catalog/looks';
import { liveRules } from './catalogSettings';
import type { AdminMember, Badge, BestView, Me, QuestView } from '../src/platform/apiTypes';
import { currentStreak, longestStreak } from '../src/platform/daily';
import { levelForXp, questsForDay, xpForLevel, type QuestDef } from '../src/platform/progression';
import { likeOf, type Env } from './http';
import { liveTitles } from './sigilfallTitles';
import { isAdmin, roleOf, type UserRow } from './session';
import { listed } from './staff';

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
  const live = await liveRules(env, day);
  const defs = questsForDay(user.id, day, live.games, hasFavorite && !claimed.has('favorite'), live.rules);
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

/** The looks this member wears and still owns. */
export async function buildLooks(env: Env, user: UserRow): Promise<Worn> {
  const [owned, items] = await Promise.all([ownedBy(env, user.id), loadItems(env)]);
  return wornFrom({ border: user.look_border, banner: user.look_banner, icon: user.look_icon }, owned, items);
}

export async function buildMe(env: Env, user: UserRow, day: string): Promise<Me> {
  // (what was given rather than bought: a card for a new one thanks the member differently, src/platform/arrivals.ts)
  const gifting = giftsTo(env, user.id);
  const [owned, items] = await Promise.all([ownedBy(env, user.id), loadItems(env)]);
  const [favs, bests, roundCount, dailyDone, claimsCount, crown, quests, saves, sigilTitles] = await Promise.all([
    env.DB.prepare('SELECT game FROM favorites WHERE user_id = ? ORDER BY created_at').bind(user.id).all<{ game: string }>(),
    env.DB.prepare(
      `SELECT b.game, b.score, b.stats, b.at,
         (SELECT COUNT(*) FROM bests o JOIN users u ON u.id = o.user_id WHERE o.game = b.game AND o.score > b.score AND ${listed(env)}) + 1 AS rank,
         (SELECT COUNT(*) FROM bests o JOIN users u ON u.id = o.user_id WHERE o.game = b.game AND o.score > 0 AND ${listed(env)}) AS players
       FROM bests b WHERE b.user_id = ? AND b.score > 0`,
    )
      .bind(user.id)
      .all<{ game: string; score: number; stats: string; at: number; rank: number; players: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM runs WHERE user_id = ? AND status = 'ok'`).bind(user.id).first<{ n: number }>(),
    env.DB.prepare('SELECT day FROM dailies WHERE user_id = ? AND done = 1 ORDER BY day DESC LIMIT 400').bind(user.id).all<{ day: string }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM quest_claims WHERE user_id = ?').bind(user.id).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM bests b WHERE b.user_id = ? AND b.score > 0 AND NOT EXISTS (SELECT 1 FROM bests o JOIN users u ON u.id = o.user_id WHERE o.game = b.game AND o.score > b.score AND ${listed(env)})`,
    )
      .bind(user.id)
      .first<{ n: number }>(),
    questViews(env, user, day),
    env.DB.prepare('SELECT MAX(updated_at) AS at FROM game_saves WHERE user_id = ?').bind(user.id).first<{ at: number | null }>(),
    liveTitles(env, user.id),
  ]);
  const bestMap: Record<string, BestView> = {};
  for (const b of bests.results) bestMap[b.game] = { score: b.score, stats: parseStats(b.stats), at: b.at, rank: b.rank, players: b.players };
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
    owned,
    gifts: await gifting,
    looks: wornFrom({ border: user.look_border, banner: user.look_banner, icon: user.look_icon }, owned, items),
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    avatar: user.avatar,
    isAdmin: isAdmin(env, user),
    role: roleOf(env, user),
    xp: user.xp,
    level,
    levelFloor: xpForLevel(level),
    levelNext: xpForLevel(level + 1),
    notify: !!user.notify,
    favorites: favs.results.map((f) => f.game),
    bests: bestMap,
    rounds,
    streak,
    dailyDays: dailyDone.results.map((d) => d.day),
    badges,
    quests,
    questDay: day,
    joinedAt: user.created_at,
    savesAt: saves?.at ?? 0,
    sigilTitles,
  };
}

/** The most members the admin's player picker shows at once. */
export const MEMBERS_MAX = 20;

/**
 * Members for the admin's player picker (src/pages/admin/PlayerPicker.tsx): those whose nickname or email has the
 * words in it, or whose id they are, an exact match first, then names that start with them; with nothing typed, the
 * members seen last.
 */
export async function findMembers(env: Env, raw: string, limit = MEMBERS_MAX): Promise<AdminMember[]> {
  const q = raw.trim().slice(0, 80);
  const n = Math.min(MEMBERS_MAX, Math.max(1, Math.floor(limit) || MEMBERS_MAX));
  type Row = { id: string; nickname: string; email: string; last_seen: number };
  let rows: { results: Row[] };
  if (q) {
    const like = likeOf(q);
    // (the same pattern without its leading %: a name that starts with the words)
    const starts = like.slice(1);
    rows = await env.DB.prepare(
      `SELECT id, nickname, email, last_seen FROM users
       WHERE id = ? OR nickname LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
       ORDER BY (id = ? OR nickname = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) DESC, (nickname LIKE ? ESCAPE '\\') DESC, last_seen DESC LIMIT ?`,
    )
      .bind(q, like, like, q, q, q, starts, n)
      .all<Row>();
  } else {
    rows = await env.DB.prepare('SELECT id, nickname, email, last_seen FROM users ORDER BY last_seen DESC LIMIT ?').bind(n).all<Row>();
  }
  return rows.results.map((r) => ({ id: r.id, nickname: r.nickname, email: r.email, lastSeen: r.last_seen }));
}

export { longestStreak };
