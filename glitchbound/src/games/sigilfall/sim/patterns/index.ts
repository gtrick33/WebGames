import { BARROW_OF_KINGS_PATTERNS } from './barrow-of-kings';
import { DEEPFORGE_HALLS_PATTERNS } from './deepforge-halls';
import type { PatternFn } from './kit';
import { ROTMOTHER_CISTERN_PATTERNS } from './rotmother-cistern';

/** Every boss attack beyond boss.ts's own, by id. */
export const EXTRA_PATTERNS: Record<string, PatternFn> = { ...ROTMOTHER_CISTERN_PATTERNS, ...DEEPFORGE_HALLS_PATTERNS, ...BARROW_OF_KINGS_PATTERNS };
