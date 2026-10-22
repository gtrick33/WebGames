import { KITS } from './classes';
import type { ClassId, TalentNode } from './types';

/**
 * Talent trees: three per class, one per specialization, written with their class in data/kits/.
 * Rows open as points go into that tree (row r needs 5·r points in it). Numbers in mods are per rank.
 * A hero earns one point per level from level 10 (51 at 60); the specialization's tree takes the
 * first 31, then the other two open, so a capstone elsewhere is out of reach: the choice matters.
 */

/** Points in a tree that open each next row. */
export const ROW_COST = 5;
export const TALENT_ROWS = 7;
/** The level a specialization is chosen (and talent points start). */
export const SPEC_LEVEL = 10;
/** Points in the specialization's tree before the other two trees open. */
export const SPEC_FOCUS = 31;

export const TALENTS: Record<ClassId, TalentNode[]> = Object.fromEntries(Object.entries(KITS).map(([id, k]) => [id, k.talents])) as Record<ClassId, TalentNode[]>;

export const talentNode = (cls: ClassId, id: string): TalentNode | undefined => TALENTS[cls].find((n) => n.id === id);
