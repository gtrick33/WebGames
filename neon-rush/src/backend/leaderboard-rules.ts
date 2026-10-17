/**
 * Leaderboard validation shared by the browser and the server (Cloudflare Pages Functions).
 * Pure functions only: no DOM, no Node APIs.
 */

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

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ScoreClaim {
  score: number;
  meters: number;
  coins: number;
  nearMisses: number;
  /** In-game (simulation) time of the run, excluding pauses. */
  durationMs: number;
}

/** Physical limits of the game (see game/config.ts difficultyAt): 28-58 m/s. */
const MIN_SPEED = 26;
const MAX_SPEED = 58.5;

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
  const secs = c.durationMs / 1000;
  if (c.meters > MAX_SPEED * secs + 30) return 'distance_high';
  if (c.meters < MIN_SPEED * secs * 0.9 - 30) return 'distance_low';
  // Measured worst case (magnet + 2x coins held all run) is about 0.23 coins/m; allow headroom.
  if (c.coins > c.meters * 0.35 + 40) return 'coins';
  // At most one near miss per hazard; rows (~17 m apart) hold up to 3 hazards.
  if (c.nearMisses > c.meters / 5 + 10) return 'near_misses';
  // Score = metres + 10 per coin + near-miss bonus (25 x combo, combo <= 8).
  const min = c.meters + c.coins * 10;
  const max = min + c.nearMisses * 25 * 8;
  if (c.score < min - 2 || c.score > max + 2) return 'score';
  return null;
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
