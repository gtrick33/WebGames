import { BARROW_OF_KINGS_PATTERNS } from './barrow-of-kings';
import { DEEPFORGE_HALLS_PATTERNS } from './deepforge-halls';
import type { PatternFn } from './kit';
import { ROTMOTHER_CISTERN_PATTERNS } from './rotmother-cistern';
import { TOMB_OF_THE_SUN_KING_PATTERNS } from './tomb-of-the-sun-king';
import { RIMEHELD_VAULT_PATTERNS } from './rimeheld-vault';
import { SIEGE_OF_HIGHWALL_PATTERNS } from './siege-of-highwall';

/** Every boss attack beyond boss.ts's own, by id. */
export const EXTRA_PATTERNS: Record<string, PatternFn> = { ...ROTMOTHER_CISTERN_PATTERNS, ...DEEPFORGE_HALLS_PATTERNS, ...BARROW_OF_KINGS_PATTERNS, ...TOMB_OF_THE_SUN_KING_PATTERNS, ...RIMEHELD_VAULT_PATTERNS, ...SIEGE_OF_HIGHWALL_PATTERNS };
