import type { PatternUse } from '../../data/bosses';
import type { Enemy } from '../types';
import type { World } from '../world';

/**
 * Boss attacks written outside boss.ts (a dungeon's own, in this folder) get this each frame: the
 * pattern's use and knobs, its running state, and the helpers boss.ts's own patterns use. Their ids
 * carry the dungeon's prefix ('rot:bile-wave'), and boss.ts runs them like its own.
 */
export interface PatternKit {
  use: PatternUse;
  /** Running state: seconds since it began, a step counter and free numbers. */
  pt: { t: number; step: number; data: Record<string, number> };
  /** The angle from the boss to the hero. */
  aimAt(): number;
  /** A knob from `use.p`, or the default. */
  num(key: string, dflt: number): number;
  str(key: string, dflt: string): string;
  /** Ends the pattern: the boss rests, then picks the next. */
  end(): void;
}

export type PatternFn = (w: World, e: Enemy, dt: number, k: PatternKit) => void;

/**
 * A boss's health as it was before its fights were made longer (sim/world.ts BOSS_LENGTH). What a boss does at a rate
 * (a ward that grows each second, a drain that heals it while it holds) and a ward to be broken in time were set against
 * its old health and a hero's blows: they are measured against this, so they ask what they always did of a hero's
 * damage. What it gains once, for a mechanic the hero let happen (adds that reach it, shards left standing), stays a
 * share of its whole health: the longer fight makes such a mistake cost more, which is the point.
 */
export const bossBase = (e: Enemy): number => e.maxHp / (e.boss?.long ?? 1);
/** A boss's clock that a hero must beat by damage (a doom): longer by as much as the fight is. */
export const bossClock = (e: Enemy, seconds: number): number => seconds * (e.boss?.long ?? 1);
