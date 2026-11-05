import { isLook, type LookKind } from '../src/catalog/looks';
import type { Env } from './http';
import { ownedBy } from './shop';

/**
 * The border and banner a member wears (src/catalog/looks.ts). What they chose is kept on their row, and it shows only
 * while they still own it: a refund takes it off everywhere at once, with nothing to clean up.
 */

/** SQL for the look of `kind` that the member in `u` wears and still owns, or ''. For a board's SELECT. */
export const wornSql = (kind: LookKind, u = 'u'): string =>
  `CASE WHEN ${u}.look_${kind} != '' AND EXISTS (SELECT 1 FROM purchases p WHERE p.user_id = ${u}.id AND p.product = ${u}.look_${kind} AND p.status = 'paid') THEN ${u}.look_${kind} ELSE '' END`;

/** The looks a board row carries: only the ones set, and only looks this build can draw. */
export function rowLooks(r: { border?: string | null; banner?: string | null }): { border?: string; banner?: string } {
  return { ...(isLook(r.border, 'border') ? { border: r.border } : {}), ...(isLook(r.banner, 'banner') ? { banner: r.banner } : {}) };
}

/** Puts on a look the member owns, or takes it off with ''. False when it isn't theirs or isn't a look of that kind. */
export async function wearLook(env: Env, userId: string, kind: LookKind, id: string): Promise<boolean> {
  if (id && (!isLook(id, kind) || !(await ownedBy(env, userId)).includes(id))) return false;
  await env.DB.prepare(`UPDATE users SET look_${kind} = ? WHERE id = ?`).bind(id, userId).run();
  return true;
}
