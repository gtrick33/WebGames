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
