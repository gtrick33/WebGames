/**
 * House rivals: a field of computer players on every game's leaderboard, so a board is a ladder to climb
 * from the first visit rather than an empty page. They are labeled as rivals wherever they show (a small
 * tag on the row, a line under the board) and never reach the Hall of Fame, which stays members only.
 *
 * Everything is worked out from the game and the date (no server, no storage): the same rivals for every
 * player, a field that grows a little each day, and a fresh 24-hour board every day. Their scores follow
 * each game's own scoring (the bands below were read off the games' score formulas): a few strong ones at
 * the top, most of the field in the middle, a long tail of first tries.
 */
import type { LeaderRow } from './apiTypes';
import { daysBetween, hashString } from './dates';

/** A rival row: a leaderboard row with the flag the table shows. */
export type BoardRow = LeaderRow & { rival?: boolean };

/**
 * Per game: the score the best rival holds (good, beatable by a strong player) and a typical first try.
 * Games not listed get a field scaled from `fallback`.
 */
const BANDS: Record<string, { top: number; low: number }> = {
  'neon-rush': { top: 19_400, low: 600 },
  'memory-grid': { top: 2_160, low: 140 },
  'color-recall': { top: 4_480, low: 1_300 },
  'letter-pinch': { top: 640, low: 230 },
  'mini-racer': { top: 3_420, low: 1_400 },
  'launch-control': { top: 11_900, low: 4_800 },
  'color-lab': { top: 50, low: 16 },
  'spot-the-glitch': { top: 2_910, low: 800 },
  'wheres-the-ball': { top: 4_700, low: 1_500 },
  'wing-it': { top: 152, low: 3 },
  crosswire: { top: 1_232, low: 420 },
  'wait-what': { top: 1_412, low: 380 },
  'to-scale': { top: 4_540, low: 1_400 },
  'square-deal': { top: 6_100, low: 260 },
  'outta-here': { top: 2_230, low: 560 },
  gloop: { top: 4_250, low: 420 },
  'gut-check': { top: 33, low: 2 },
  'star-grid': { top: 2_140, low: 650 },
  fussbox: { top: 984, low: 300 },
  whatsit: { top: 1_000, low: 200 },
  belot: { top: 166, low: 20 },
  backgammon: { top: 326, low: 36 },
  sigilfall: { top: 56_000, low: 800 },
};
const FALLBACK = { top: 5_000, low: 300 };

/** The day the boards opened: the field grows from here. */
const OPENED = '2026-10-17';

/** A seeded generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Handles in the shapes members pick: a word or two, a name with digits, a lowercase tag.
const FIRST = ['Mira', 'Niko', 'Tess', 'Bobi', 'Juno', 'Kai', 'Lena', 'Rafa', 'Ivo', 'Zoe', 'Teo', 'Ana', 'Milo', 'Sana', 'Dani', 'Vera', 'Luka', 'Nia', 'Emil', 'Rosa', 'Yuki', 'Sam', 'Ines', 'Petar', 'Elif', 'Oskar', 'Maja', 'Remi', 'Lia', 'Ari'];
const WORD = ['pixel', 'turbo', 'moss', 'nova', 'ember', 'pebble', 'comet', 'fox', 'velvet', 'quill', 'sprout', 'drift', 'zephyr', 'mango', 'cobalt', 'pickle', 'rocket', 'maple', 'gizmo', 'lark', 'echo', 'biscuit', 'tidal', 'saffron', 'bolt', 'nimbus', 'clover', 'wren', 'jolt', 'opal'];
const TAIL = ['cat', 'run', 'byte', 'wave', 'kid', 'star', 'fern', 'paws', 'beam', 'loop', 'jam', 'owl', 'zap', 'dash', 'moon', 'gale'];

function handle(r: () => number): string {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
  const n = (max: number): number => Math.floor(r() * max);
  const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);
  switch (n(6)) {
    case 0:
      return `${pick(FIRST)}${n(10) < 6 ? n(100) : ''}`;
    case 1:
      return `${pick(WORD)}${pick(TAIL)}`;
    case 2:
      return `${cap(pick(WORD))}${cap(pick(TAIL))}${n(10) < 5 ? n(1000) : ''}`;
    case 3:
      return `${pick(FIRST).toLowerCase()}_${pick(WORD)}`;
    case 4:
      return `${pick(FIRST)}${pick(['K', 'V', 'D', 'M', 'P', 'R', 'S', 'T'])}`;
    default:
      return `${pick(WORD)}${n(90) + 10}`;
  }
}

/** How many rivals a game's all-time board holds on a day: a few hundred, growing a little every day. */
export function rivalCount(game: string, day: string): number {
  const base = 160 + (hashString(`${game}:size`) % 240);
  return base + Math.max(0, daysBetween(OPENED, day)) * (4 + (hashString(`${game}:grow`) % 5));
}

/**
 * The rivals on a game's board, best first (ranks not set: the board ranks them together with the
 * members). Each rival has a seed of its own, so the all-time field keeps its people and their scores as
 * it grows; `24h` is a smaller, weaker field that changes every day.
 */
export function rivals(game: string, period: 'all' | '24h', day: string): BoardRow[] {
  const band = BANDS[game] ?? FALLBACK;
  const all = period === 'all';
  const count = all ? rivalCount(game, day) : 12 + (hashString(`${game}:${day}:24h`) % 34);
  // Today's field is a weaker one: its best is a good round, not a record.
  const top = all ? band.top : band.low + (band.top - band.low) * (0.62 + (hashString(`${game}:${day}:top`) % 12) / 100);
  const whole = band.top >= 10;
  const opened = Date.parse(`${OPENED}T12:00:00Z`);
  const dayStart = Date.parse(`${day}T00:00:00Z`);
  const rows: BoardRow[] = [];
  for (let i = 0; i < count; i++) {
    const r = seeded(hashString(all ? `${game}:${i}` : `${game}:${day}:${i}`));
    // Few near the top, most in the middle, a long tail of first tries (and a little noise).
    const p = r();
    const raw = band.low + (top - band.low) * (1 - p) ** 1.9 * (0.94 + r() * 0.06);
    const score = whole ? Math.max(1, Math.round(raw)) : Math.max(1, Math.round(raw * 10) / 10);
    const level = Math.max(1, Math.min(48, Math.round((1 - p) * 34 + r() * 9 - 2)));
    const at = all ? opened + r() * 30 * 86_400_000 : dayStart + r() * 86_400_000;
    rows.push({ rank: 0, nickname: handle(r), level, score, at, you: false, rival: true });
  }
  return rows.sort((a, b) => b.score - a.score || a.at - b.at);
}

/**
 * Members' rows and the rivals as one board: sorted by score (a member first on a tie), ranked, cut to
 * `limit`. `mine` (your best, sent when it is below the members' top rows) is ranked among everyone too.
 */
export function withRivals(game: string, period: 'all' | '24h', day: string, members: LeaderRow[], mine: LeaderRow | null, limit = 50): { rows: BoardRow[]; mine: BoardRow | null } {
  const field = rivals(game, period, day);
  const merged = ([...members, ...field] as BoardRow[]).sort((a, b) => b.score - a.score || (a.rival ? 1 : 0) - (b.rival ? 1 : 0) || a.at - b.at);
  const ranked = merged.map((row, i) => ({ ...row, rank: i + 1 }));
  const rows = ranked.slice(0, limit);
  if (rows.some((x) => x.you)) return { rows, mine: null };
  const you = ranked.find((x) => x.you) ?? (mine ? { ...mine, rank: rankAmong(field, mine.score, mine.rank - 1) } : null);
  return { rows, mine: you };
}

/** Where a score lands with `membersAbove` members and the rivals ahead of it: its rank on the board. */
function rankAmong(field: BoardRow[], score: number, membersAbove: number): number {
  return 1 + membersAbove + field.filter((r) => r.score > score).length;
}

/** The rank a score has on a game's all-time board today: the member rank plus the rivals ahead ("Rank #n"). */
export function boardRank(game: string, day: string, score: number, memberRank: number): number {
  return rankAmong(rivals(game, 'all', day), score, memberRank - 1);
}

/** The rank a guest's best would take on the all-time board (members' scores not counted: a hint, not a place). */
export function wouldRank(game: string, day: string, score: number): number {
  return rankAmong(rivals(game, 'all', day), score, 0);
}
