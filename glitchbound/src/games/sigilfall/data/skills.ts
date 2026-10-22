import { KITS } from './classes';
import type { SkillDef } from './types';

export { spec } from './kits/kit';

/*
 * Skills live with their class in data/kits/. Damage numbers are at character level 1 before gear;
 * they grow 12% per level and with power. Ranges are in pixels (a tile is 16 px), speeds in pixels
 * per second, times in seconds.
 */
export const SKILLS: Record<string, SkillDef> = Object.fromEntries(Object.values(KITS).flatMap((k) => k.skills.map((s) => [s.id, s])));

export const skillDef = (id: string): SkillDef => {
  const s = SKILLS[id];
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
};
