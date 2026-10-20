/**
 * PARTY MODE challenge engine: players, fair targeting, no-repeat decks, filtering and consequences.
 * Pure functions (randomness is passed in), so every rule is unit tested. Content text never drives
 * game logic: prompts only fill slots that these rules choose.
 */
import type { Challenge, Consequence, Intensity, PartySettings, Player, Target } from './types';

export type Rng = () => number;

export const PLAYER_COLORS = ['#ff5a6c', '#ffb020', '#2fd1a0', '#3d7bff', '#a45cff', '#ff7eb6', '#12c6b3', '#ff8a1f', '#8ad13b', '#5b6cff', '#e64c9a', '#00a6d6'];
export const PLAYER_EMOJIS = ['🦊', '🐸', '🐙', '🦄', '🐼', '🐯', '🦖', '🐧', '🦉', '🐝', '🐳', '🦩', '🐨', '🦁', '🐰', '🐢'];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 16;

export function makePlayer(name: string, index: number, id = `p${Date.now().toString(36)}${index}`): Player {
  return { id, name: cleanName(name), color: PLAYER_COLORS[index % PLAYER_COLORS.length]!, emoji: PLAYER_EMOJIS[index % PLAYER_EMOJIS.length]! };
}

/** Trims and limits a name; collapses whitespace. */
export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, 18);

type Say = (text: string, vars?: Record<string, string | number>) => string;
const english: Say = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (hole, k: string) => (k in vars ? String(vars[k]) : hole));

/** Problems with the player list, or null when it is ready to play. Pass `t` to get it in the player's language. */
export function playersProblem(players: readonly Player[], say: Say = english): string | null {
  if (players.length < MIN_PLAYERS) return say('Add at least {n} players.', { n: MIN_PLAYERS });
  if (players.length > MAX_PLAYERS) return say('At most {n} players.', { n: MAX_PLAYERS });
  if (players.some((p) => !p.name)) return say('Every player needs a name.');
  const seen = new Set<string>();
  for (const p of players) {
    const k = p.name.toLowerCase();
    if (seen.has(k)) return say('Two players are called {name}. Add an initial to tell them apart.', { name: p.name });
    seen.add(k);
  }
  return null;
}

export function shuffle<T>(list: readonly T[], r: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Turn order for two teams: the teams alternate, and each team goes round its own players, so both
 * teams get the same number of turns even when one is bigger (3 vs 2: A1 B1 A2 B2 A3 B1).
 * `laps` is how many times the bigger team goes round.
 */
export function teamTurns<T>(teams: readonly [readonly T[], readonly T[]], laps: number): T[] {
  const [a, b] = teams;
  if (!a.length || !b.length) return Array.from({ length: laps }, () => [...a, ...b]).flat();
  const per = Math.max(a.length, b.length) * laps;
  const out: T[] = [];
  for (let i = 0; i < per; i++) out.push(a[i % a.length]!, b[i % b.length]!);
  return out;
}

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A freshly seeded generator (for component state: `useState(freshRng)`). */
export const freshRng = (): Rng => rng((Math.random() * 2 ** 32) >>> 0);

/** A random element (for component state initialisers). */
export const randomOf = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/* ---------------------------------------------------------------- targeting */

/** How often each player was picked (for "players who have not participated recently"). */
export type Participation = Record<string, number>;
export type Scores = Record<string, number>;

/**
 * Picks `n` different players, weighting towards the ones picked least so far so everyone gets turns.
 * `exclude` keeps a player out (e.g. the one who just played).
 */
export function pickPlayers(players: readonly Player[], n: number, part: Participation, r: Rng, exclude: string[] = []): Player[] {
  const pool = players.filter((p) => !exclude.includes(p.id));
  const source = pool.length >= n ? pool : [...players];
  const chosen: Player[] = [];
  const left = [...source];
  while (chosen.length < n && left.length) {
    const min = Math.min(...left.map((p) => part[p.id] ?? 0));
    // Players at the minimum count get most of the weight; others can still be picked now and then.
    const weights = left.map((p) => ((part[p.id] ?? 0) === min ? 4 : 1));
    let x = r() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    for (; i < left.length - 1; i++) {
      x -= weights[i]!;
      if (x < 0) break;
    }
    chosen.push(left[i]!);
    left.splice(i, 1);
  }
  return chosen;
}

export interface Filled {
  text: string;
  /** Players named in the prompt (who it is about). */
  players: Player[];
  teams?: [Player[], Player[]];
}

const byScore = (players: readonly Player[], scores: Scores, dir: 1 | -1): Player =>
  [...players].sort((a, b) => dir * ((scores[b.id] ?? 0) - (scores[a.id] ?? 0)))[0]!;

/** Chooses the players for a challenge and fills its text. */
export function fillChallenge(c: Pick<Challenge, 'text' | 'target'>, players: readonly Player[], ctx: { part: Participation; scores: Scores; r: Rng; avoid?: string }): Filled {
  const { part, scores, r } = ctx;
  const avoid = ctx.avoid ? [ctx.avoid] : [];
  let named: Player[] = [];
  let teams: [Player[], Player[]] | undefined;
  switch (c.target as Target) {
    case 'one':
      named = pickPlayers(players, 1, part, r, avoid);
      break;
    case 'two':
      named = pickPlayers(players, 2, part, r, avoid);
      break;
    case 'leader':
      named = [byScore(players, scores, 1)];
      break;
    case 'trailer':
      named = [byScore(players, scores, -1)];
      break;
    case 'quiet': {
      const min = Math.min(...players.map((p) => part[p.id] ?? 0));
      named = pickPlayers(
        players.filter((p) => (part[p.id] ?? 0) === min),
        1,
        part,
        r,
      );
      break;
    }
    case 'teams': {
      const mixed = shuffle(players, r);
      const half = Math.ceil(mixed.length / 2);
      teams = [mixed.slice(0, half), mixed.slice(half)];
      break;
    }
    default:
      break;
  }
  const names = (list: Player[]): string => list.map((p) => p.name).join(', ');
  const text = c.text
    .replace(/\{A\}/g, named[0]?.name ?? 'Someone')
    .replace(/\{B\}/g, named[1]?.name ?? named[0]?.name ?? 'someone')
    .replace(/\{TEAM1\}/g, teams ? names(teams[0]) : 'Team 1')
    .replace(/\{TEAM2\}/g, teams ? names(teams[1]) : 'Team 2');
  return { text, players: named, teams };
}

/** Adds one participation to each named player. */
export function noteParticipation(part: Participation, players: readonly Player[]): Participation {
  const next = { ...part };
  for (const p of players) next[p.id] = (next[p.id] ?? 0) + 1;
  return next;
}

/* -------------------------------------------------------------------- decks */

/** Intensities this session may draw from (After Dark only with an adult confirmation). */
export function allowedIntensities(s: Pick<PartySettings, 'intensities' | 'adultConfirmed'>): Intensity[] {
  return s.intensities.filter((i) => i !== 'afterdark' || s.adultConfirmed);
}

/** Content that passes the session's filters. */
export function filterContent<T extends { intensity?: Intensity; tags?: string[] }>(items: readonly T[], s: Pick<PartySettings, 'intensities' | 'adultConfirmed' | 'excludedTags'>): T[] {
  const ok = new Set(allowedIntensities(s));
  return items.filter((it) => (!it.intensity || ok.has(it.intensity)) && !(it.tags ?? []).some((t) => s.excludedTags.includes(t)));
}

/**
 * How often each intensity comes up. Choosing a hotter level means the deck is mostly that level:
 * milder cards still appear now and then for pacing, but rarely.
 */
export function intensityWeights(s: Pick<PartySettings, 'intensities' | 'adultConfirmed'>): Record<Intensity, number> {
  const ok = allowedIntensities(s);
  const top = ok.includes('afterdark') ? 'afterdark' : ok.includes('spicy') ? 'spicy' : 'casual';
  if (top === 'afterdark') return { afterdark: 1, spicy: 0.2, casual: 0.04 };
  if (top === 'spicy') return { afterdark: 0, spicy: 1, casual: 0.07 };
  return { afterdark: 0, spicy: 0, casual: 1 };
}

/**
 * Draws the next item that has not been used this session. When everything was used, the deck
 * reshuffles, still avoiding the most recent quarter so repeats are never back to back. An optional
 * weight makes some items come up more often (weights <= 0 count as tiny, never impossible).
 */
export function draw<T extends { id: string }>(items: readonly T[], used: readonly string[], r: Rng, weight?: (it: T) => number): { item: T | null; used: string[] } {
  if (!items.length) return { item: null, used: [...used] };
  const usedSet = new Set(used);
  let pool = items.filter((it) => !usedSet.has(it.id));
  let base = [...used];
  // Weighted decks reshuffle once most of their weight is used up, so a long After Dark session
  // doesn't end up dealing only the milder leftovers.
  const mass = (list: readonly T[]): number => (weight ? list.reduce((a, it) => a + Math.max(1e-4, weight(it)), 0) : list.length);
  if (!pool.length || (weight && mass(pool) < mass(items) * 0.2)) {
    const recent = new Set(used.slice(-Math.max(1, Math.floor(items.length / 4))));
    pool = items.filter((it) => !recent.has(it.id));
    base = used.slice(-Math.max(1, Math.floor(items.length / 4)));
    if (!pool.length) pool = [...items];
  }
  let item = pool[Math.floor(r() * pool.length)]!;
  if (weight) {
    const ws = pool.map((it) => Math.max(1e-4, weight(it)));
    let x = r() * ws.reduce((a, w) => a + w, 0);
    for (let i = 0; i < pool.length; i++) {
      x -= ws[i]!;
      if (x <= 0) {
        item = pool[i]!;
        break;
      }
    }
  }
  return { item, used: [...base, item.id] };
}

/* -------------------------------------------------------------- consequences */

const TASKS = [
  'speak only in questions until your next turn',
  'do your best robot dance for 10 seconds',
  'give the player on your left a dramatic compliment',
  'talk like a sports commentator for your next turn',
  'hold a plank until the next card is read',
  'say the alphabet backwards from M',
  'do an impression of someone in the room (nicely)',
  'sing the next sentence you say',
  'keep a straight face while everyone tries to make you laugh for 15 seconds',
  'balance a spoon (or anything) on your nose for 5 seconds',
  'invent a new handshake with the person on your right',
  'narrate your next move like a nature documentary',
];

/** What "paying up" means in this session, for `n` units. Never forces alcohol. */
export function consequenceText(kind: Consequence, n: number, r: Rng): string {
  const k = Math.max(1, Math.round(n));
  switch (kind) {
    case 'sips':
      return `take ${k === 1 ? 'a sip' : `${k} sips`} of your drink (water counts)`;
    case 'points':
      return `lose ${k} point${k === 1 ? '' : 's'}`;
    case 'tasks':
      return TASKS[Math.floor(r() * TASKS.length)]!;
    default:
      return 'take the group’s best boo';
  }
}

/** A number from a string (FNV-1a), to seed things that must stay the same for one card. */
export function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The consequence shown with one card: the same silly task every time that card is on screen. */
export const cardConsequence = (kind: Consequence, n: number, cardKey: string): string => consequenceText(kind, n, rng(hashSeed(cardKey)));

export const CONSEQUENCE_LABEL: Record<Consequence, string> = {
  points: 'Points',
  tasks: 'Silly tasks',
  sips: 'Sips (optional)',
  none: 'Just for fun',
};

export const SESSION_CARDS: Record<PartySettings['length'], number> = { quick: 15, standard: 30, long: 60 };
