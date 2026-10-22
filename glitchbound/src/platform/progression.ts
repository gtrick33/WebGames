/**
 * Member progression shared by the browser and the server: levels, daily quests and nicknames.
 * Pure functions only (no DOM, no D1), so both sides compute exactly the same thing.
 */
import type { GameEntry } from '../catalog/types';
import type { QuestIcon } from './apiTypes';
import type { DailyRules } from '../catalog/settings';
import { challengeForDay, fmt, templateText } from './daily';
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
export function questsForDay(userId: string, day: string, games: GameEntry[], hasFavorite: boolean, rules: DailyRules | null = null): QuestDef[] {
  const h = hashString(`quests:${userId}:${day}`);
  const pool: QuestDef[] = [];
  const rounds = [2, 3, 5][h % 3]!;
  pool.push({ id: `rounds-${rounds}`, kind: 'rounds', label: `Play ${rounds} rounds`, icon: 'play', xp: 30 + rounds * 12, target: rounds });
  pool.push({ id: 'best', kind: 'best', label: 'Beat one of your personal bests', icon: 'trophy', xp: 120, target: 1 });
  const daily = challengeForDay(day, games, rules);
  if (daily) pool.push({ id: 'daily', kind: 'daily', label: 'Clear today’s Daily Challenge', icon: 'calendar', xp: 150, target: 1 });
  const metricGames = games.filter((g) => g.released <= day && (g.daily?.length ?? 0) > 0);
  if (metricGames.length) {
    const g = metricGames[(h >>> 4) % metricGames.length]!;
    const tpl = g.daily![(h >>> 8) % g.daily!.length]!;
    // Member quests use the two easiest targets, so they are reachable in a few rounds.
    const target = tpl.targets[(h >>> 12) % Math.min(2, tpl.targets.length)]!;
    // Name the game once: many templates already do ("... in one Wing It flight").
    const base = templateText(tpl, target).replace('{n}', fmt(target));
    const label = base.includes(g.title) ? base : `${base} in ${g.title}`;
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
  if (name.length < 3 || name.length > 14) return 'Use 3 to 14 characters.';
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return 'Letters, numbers, spaces, dot, dash and underscore only.';
  const low = name.toLowerCase().replace(/[^a-z]/g, '');
  if (BLOCKED.some((b) => low.includes(b))) return 'Please pick a different nickname.';
  return null;
}

const ADJ = ['Brave', 'Swift', 'Neon', 'Lucky', 'Pixel', 'Cosmic', 'Turbo', 'Silent', 'Fuzzy', 'Mighty', 'Sly', 'Jolly', 'Rapid', 'Quiet', 'Witty', 'Bold', 'Zesty', 'Hyper', 'Mellow', 'Sunny'];
const NOUN = ['Fox', 'Otter', 'Comet', 'Panda', 'Falcon', 'Badger', 'Koala', 'Raven', 'Lynx', 'Gecko', 'Moose', 'Orca', 'Wolf', 'Tiger', 'Owl', 'Yak', 'Crab', 'Bison', 'Squid', 'Robin'];

/** Reddit-style random name, e.g. "BraveFox527" (always valid, at most 14 characters). */
export function randomName(rand: () => number = Math.random): string {
  const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)]!;
  for (let i = 0; i < 10; i++) {
    const name = `${pick(ADJ)}${pick(NOUN)}${Math.floor(rand() * 900) + 100}`;
    if (name.length <= 14) return name;
  }
  return `Player${Math.floor(rand() * 9000) + 1000}`;
}

/**
 * Starting nickname candidates for a new member, best first: their Google name when it fits
 * (e.g. "Ada Lovelace"), their first name, first name + digits, then a random name.
 */
export function nicknameCandidates(fullName: string, givenName: string, seed: string): string[] {
  const clean = (s: string): string => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').trim();
  const n = (hashString(seed) % 900) + 100;
  const first = clean(givenName) || clean(fullName).split(' ')[0] || '';
  let x = hashString(`${seed}:r`);
  const rand = (): number => ((x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0) % 10000) / 10000;
  const list = [clean(fullName), first, first ? `${first.replace(/ /g, '').slice(0, 11)}${n}` : '', randomName(rand), randomName(rand), `Player${n}`];
  return [...new Set(list.filter((c) => c && !validateNickname(c)))];
}
