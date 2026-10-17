/**
 * Member progression shared by the browser and the server: levels, daily quests and nicknames.
 * Pure functions only (no DOM, no D1), so both sides compute exactly the same thing.
 */
import type { GameEntry } from '../catalog/types';
import type { QuestIcon } from './apiTypes';
import { challengeForDay, fmt } from './daily';
import { hashString } from './dates';

/** XP needed for level n is 100 * n(n-1)/2: L2 = 100, L3 = 300, L4 = 600, L5 = 1000 ... */
export function xpForLevel(level: number): number {
  return (100 * level * (level - 1)) / 2;
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2));
}

export type QuestKind = 'rounds' | 'best' | 'daily' | 'metric' | 'favorite';

export interface QuestDef {
  id: string;
  kind: QuestKind;
  label: string;
  icon: QuestIcon;
  xp: number;
  target: number;
  game?: string;
  metric?: string;
}

/**
 * Three quests per member per day, deterministic from the member id and the date, so they don't
 * change on refresh and differ between players.
 */
export function questsForDay(userId: string, day: string, games: GameEntry[], hasFavorite: boolean): QuestDef[] {
  const h = hashString(`quests:${userId}:${day}`);
  const pool: QuestDef[] = [];
  const rounds = [2, 3, 5][h % 3]!;
  pool.push({ id: `rounds-${rounds}`, kind: 'rounds', label: `Play ${rounds} rounds`, icon: 'play', xp: 30 + rounds * 12, target: rounds });
  pool.push({ id: 'best', kind: 'best', label: 'Beat one of your personal bests', icon: 'trophy', xp: 120, target: 1 });
  const daily = challengeForDay(day, games);
  if (daily) pool.push({ id: 'daily', kind: 'daily', label: 'Clear today’s Daily Challenge', icon: 'calendar', xp: 150, target: 1 });
  const metricGames = games.filter((g) => g.released <= day && (g.daily?.length ?? 0) > 0);
  if (metricGames.length) {
    const g = metricGames[(h >>> 4) % metricGames.length]!;
    const tpl = g.daily![(h >>> 8) % g.daily!.length]!;
    // Member quests use the two easiest targets, so they are reachable in a few rounds.
    const target = tpl.targets[(h >>> 12) % Math.min(2, tpl.targets.length)]!;
    const label = `${tpl.label.replace('{n}', fmt(target))} in ${g.title}`;
    pool.push({ id: `metric-${g.slug}-${tpl.metric}-${target}`, kind: 'metric', label, icon: 'bolt', xp: 90, target, game: g.slug, metric: tpl.metric });
  }
  if (!hasFavorite) pool.push({ id: 'favorite', kind: 'favorite', label: 'Add a game to your favorites', icon: 'heart', xp: 30, target: 1 });

  // Always keep "rounds"; pick two more deterministically.
  const rest = pool.slice(1);
  const picked: QuestDef[] = [pool[0]!];
  let k = h >>> 16;
  while (picked.length < 3 && rest.length) {
    picked.push(rest.splice(k % rest.length, 1)[0]!);
    k = Math.floor(k / 7) + 3;
  }
  return picked;
}

const BLOCKED = ['admin', 'moderator', 'glitchbound', 'fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler'];

/** Returns an error message, or null when the nickname is acceptable. */
export function validateNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Pick a nickname.';
  const name = raw.trim();
  if (name.length < 3 || name.length > 16) return 'Use 3 to 16 characters.';
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return 'Letters, numbers, spaces, dot, dash and underscore only.';
  const low = name.toLowerCase().replace(/[^a-z]/g, '');
  if (BLOCKED.some((b) => low.includes(b))) return 'Please pick a different nickname.';
  return null;
}

export function defaultNickname(givenName: string, seed: string): string {
  const base = (givenName || 'Player').replace(/[^A-Za-z0-9]/g, '').slice(0, 11) || 'Player';
  const n = (hashString(seed) % 900) + 100;
  const nick = `${base}${n}`;
  return validateNickname(nick) ? `Player${n}` : nick;
}
