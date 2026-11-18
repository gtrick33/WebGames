/**
 * The Ring's rating rules: how a match moves a rating, worked out the same way by the game and by the server that keeps
 * the ranked ladder (server/ring.ts). Pure, and free of the game's data (only ranks.ts), so the server stays small.
 */
import { mmrOf, rankOf, type Standing } from './ranks';

/** How far a match moves a rating at most (K). */
export const K_BASE = 32;
/** ...in a player's first PLACEMENT matches of a format, while the ladder is still finding where they belong. */
export const K_NEW = 48;
export const PLACEMENT = 10;
export const kFor = (s: Standing): number => (s.wins + s.losses < PLACEMENT ? K_NEW : K_BASE);
/**
 * The matchmaking rating moves further still in those first matches (and by K_BASE after): it finds where a newcomer
 * belongs within a few matches, and the rating shown follows it there (catchUp).
 */
export const K_MMR_NEW = 64;
export const kMmrFor = (s: Standing): number => (s.wins + s.losses < PLACEMENT ? K_MMR_NEW : K_BASE);

/** The elo rule before rounding: what a match moves a rating worked from `mine`, at `kf`. */
const eloOf = (mine: number, theirs: number, won: boolean, kf: number): number => kf * ((won ? 1 : 0) - 1 / (1 + 10 ** ((theirs - mine) / 400)));

/**
 * The elo rule, as rated arenas use it: what you stood to win against what you were expected to. Against a side rated
 * below yours a win is expected, so it pays little and a loss costs a lot; against an even side both are about half
 * of K; against a side above yours a win pays a lot and a loss costs little (the owner: "queuing vs lower players
 * should give less rate on win and take more on loss ... vs higher players should let u lose less and win more").
 */
export function ratingChange(mine: number, theirs: number, won: boolean, kf = K_BASE): number {
  return Math.round(eloOf(mine, theirs, won, kf));
}

/** The rating shown never falls below this: a bad night doesn't dig a hole that takes a week to climb out of. */
export const RATING_FLOOR = 800;
/**
 * The matchmaking rating can fall further: a player who keeps losing is drawn against easier sides still (and the
 * computer plays them more gently: skillAt), while the rating they show stays where it is.
 */
export const MMR_FLOOR = 600;
/** How far the rating shown has to trail the matchmaking rating for a win to pay double and a loss to cost half. */
export const CATCH_UP = 400;

/**
 * As rated arenas do it: while the rating shown is below the matchmaking rating, wins pay more and losses cost less,
 * so that it climbs to where the player is matched (twice as much, and half, CATCH_UP below it); above it, the other
 * way round (half as much at most, and half again). Equal, a match moves both alike.
 */
export function catchUp(rating: number, mmr: number, won: boolean): number {
  const gap = (mmr - rating) / CATCH_UP;
  return won ? 1 + Math.max(-0.5, Math.min(1, gap)) : 1 - Math.max(-0.5, Math.min(0.5, gap));
}

/** What a match moves the rating shown, before the floor. `k` and `ours`: as afterMatch. */
function shownChange(s: Standing, theirs: number, won: boolean, k: number, ours: number): number {
  return Math.round(Math.round(eloOf(ours, theirs, won, kFor(s)) * catchUp(s.rating, mmrOf(s), won)) * (won ? 1 : k));
}

/**
 * What a match stands to win and lose, before it begins. `ours`: the rating the expectation is worked from: the
 * player's matchmaking rating, or in 2v2 and 3v3 against people, the mean of their own side's (their team's
 * matchmaking rating), as against the other side's.
 */
export function stakesOf(s: Standing, theirs: number, ours = mmrOf(s)): { win: number; lose: number } {
  return { win: shownChange(s, theirs, true, 1, ours), lose: -shownChange(s, theirs, false, 1, ours) };
}

/**
 * A match settled. `k`: a loss counts this many times over (a leaver's: LEAVER_K). `ours`: as stakesOf. The
 * matchmaking rating moves by the plain elo rule (kMmrFor); the rating shown by the same at kFor, scaled toward the
 * matchmaking rating (catchUp).
 */
export function afterMatch(s: Standing, theirs: number, won: boolean, k = 1, ours = mmrOf(s)): { next: Standing; change: number; rankUp: string | null } {
  const rating = Math.max(RATING_FLOOR, s.rating + shownChange(s, theirs, won, k, ours));
  const mmr = Math.max(MMR_FLOOR, mmrOf(s) + Math.round(Math.round(eloOf(ours, theirs, won, kMmrFor(s))) * (won ? 1 : k)));
  const before = rankOf(s.best);
  const best = Math.max(s.best, rating);
  const after = rankOf(best);
  return {
    next: { rating, best, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1), streak: won ? Math.max(1, s.streak + 1) : Math.min(-1, s.streak - 1), mmr },
    change: rating - s.rating,
    rankUp: after.at > before.at ? after.name : null,
  };
}
