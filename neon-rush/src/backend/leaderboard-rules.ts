/**
 * Leaderboard validation shared by the browser and the server (Cloudflare Pages Functions).
 * Pure functions only: no DOM, no Node APIs.
 */
import { APPROACH_FACTOR, LOOKAHEAD, PLAYER, SCORE, SPAWN_ABOVE_HORIZON, UNITS_PER_METER, difficultyAt } from '../game/config';

export const NAME_MIN = 3;
export const NAME_MAX = 14;

// A short blocklist; extend as needed. Matching ignores case, digits-as-letters and separators.
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'bitch', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'admin', 'moderator'];

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Returns an error message, or null if the name is acceptable. */
export function validateName(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Enter a name.';
  const name = normalizeName(raw);
  if (name.length < NAME_MIN || name.length > NAME_MAX) return `Use ${NAME_MIN}-${NAME_MAX} characters.`;
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return 'Use letters, numbers, spaces, - _ or . only.';
  const squashed = name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
  if (BLOCKED.some((w) => squashed.includes(w))) return 'Please choose a different name.';
  return null;
}

/**
 * A leaderboard name made from another name (the arcade's): accents dropped (Zoë -> Zoe), other
 * characters removed, cut to NAME_MAX and padded to NAME_MIN with "_" (Jo -> Jo_). Null when
 * nothing usable is left (e.g. a name in another alphabet) or the result isn't allowed.
 */
export function racerNameFrom(raw: string): string | null {
  const ascii = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 _.-]/g, '');
  let name = normalizeName(ascii).slice(0, NAME_MAX).trim();
  if (!/[A-Za-z0-9]/.test(name)) return null;
  name = name.padEnd(NAME_MIN, '_');
  return validateName(name) ? null : name;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ScoreClaim {
  score: number;
  meters: number;
  coins: number;
  nearMisses: number;
  /** In-game (simulation) time of the run, excluding pauses. */
  durationMs: number;
}

/**
 * The most meters a run can cover in `secs` of play. Speed is a function of distance only
 * (game/config.ts difficultyAt: 28 m/s rising to 58 m/s), so dm/dt = 58 - 30 e^(-m/2600), which
 * integrates to m(t) = 2600 ln((28 e^(58t/2600) + 30) / 58). Written with x = 58t/2600 factored
 * out so a four-hour run doesn't overflow.
 */
export function metersAt(secs: number): number {
  const x = (58 * Math.max(0, secs)) / 2600;
  return 2600 * (x + Math.log(28 + 30 * Math.exp(-x)) - Math.log(58));
}

/** Traffic-frame units the traffic moves per meter driven (traffic approaches at 62% of the car's speed). */
const FRAME_PER_METER = APPROACH_FACTOR * UNITS_PER_METER;
/** Before the first row: the grace gap at the starting speed (World's constructor). */
const FIRST_ROW = difficultyAt(0).speed * APPROACH_FACTOR * 1.2;
/** From the spawn line to the player's front bumper, the same on every screen (World.spawnLine). */
const SPAWN_TO_PLAYER = SPAWN_ABOVE_HORIZON + LOOKAHEAD - PLAYER.hitH / 2;

/**
 * How many traffic rows can have reached the player after `meters`. Rows are spaced by the
 * difficulty at the moment they spawn (World.spawnRow), which depends only on the distance, so
 * this replays the spawner without its random lane choices.
 */
export function rowsBy(meters: number): number {
  const reach = meters * FRAME_PER_METER - SPAWN_TO_PLAYER;
  let rows = 0;
  for (let at = FIRST_ROW; at <= reach; rows++) {
    const d = difficultyAt(at / FRAME_PER_METER);
    const approach = d.speed * APPROACH_FACTOR;
    at += Math.max(approach * d.rowGapTime, 300);
  }
  return rows;
}

/** The biggest near-miss bonus `n` near misses can earn: 25 x combo, the combo climbing to 8. */
export function maxNearMissBonus(n: number): number {
  const top = SCORE.maxCombo;
  const climb = Math.min(n, top);
  return SCORE.nearMissBase * ((climb * (climb + 1)) / 2 + top * Math.max(0, n - top));
}

/**
 * Plausibility check for a submitted run. `elapsedMs` is the wall-clock time the server measured
 * between issuing the run token and receiving the score. Returns a reason string if rejected.
 */
export function checkClaim(c: ScoreClaim, elapsedMs: number): string | null {
  const ints = [c.score, c.meters, c.coins, c.nearMisses, c.durationMs];
  if (!ints.every((n) => Number.isFinite(n) && n >= 0 && Math.floor(n) === n)) return 'malformed';
  if (c.durationMs < 1000 || c.durationMs > 4 * 3600_000) return 'duration';
  // The run cannot have lasted longer than real time allows (small allowance for latency).
  if (c.durationMs > elapsedMs + 3000) return 'too_fast';
  // The distance follows from the play time alone; allow for rounding and the fixed time step.
  const expected = metersAt(c.durationMs / 1000);
  if (c.meters > expected * 1.02 + 20) return 'distance_high';
  if (c.meters < expected * 0.98 - 20) return 'distance_low';
  // Measured worst case (magnet + 2x coins held all run) is about 0.23 coins/m; allow headroom.
  if (c.coins > c.meters * 0.35 + 40) return 'coins';
  // A near miss is a car dodged at the last moment: about one per traffic row that reached the car.
  if (c.nearMisses > rowsBy(c.meters + 20) + 3) return 'near_misses';
  // Score = metres + 10 per coin + 25 x combo per near miss.
  const base = c.meters + c.coins * SCORE.perCoin;
  const min = base + c.nearMisses * SCORE.nearMissBase;
  const max = base + maxNearMissBonus(c.nearMisses);
  if (c.score < min - 2 || c.score > max + 2) return 'score';
  return null;
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
