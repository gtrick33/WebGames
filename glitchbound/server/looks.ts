import { lookOf, type LookKind } from '../src/catalog/looks';
import type { Env } from './http';
import { loadItems, ownedBy } from './shop';

/**
 * The border, banner and icon a member wears (src/catalog/looks.ts). What they chose is kept on their row, and it shows
 * only while they still own it: a refund takes it off everywhere at once, with nothing to clean up.
 */

/** SQL for the look of `kind` that the member in `u` wears and still owns, or ''. For a board's SELECT. */
export const wornSql = (kind: LookKind, u = 'u'): string =>
  `CASE WHEN ${u}.look_${kind} != '' AND EXISTS (SELECT 1 FROM purchases p WHERE p.user_id = ${u}.id AND p.product = ${u}.look_${kind} AND p.status = 'paid') THEN ${u}.look_${kind} ELSE '' END`;

/** All three, as `border`, `banner` and `icon` columns. */
export const WORN_SQL = `${wornSql('border')} AS border, ${wornSql('banner')} AS banner, ${wornSql('icon')} AS icon`;

const ITEM_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

/**
 * The looks a board row carries: only the ones set. The page draws them from the shop's list, so a look an admin
 * made works here too, and one that no longer exists is simply not drawn.
 */
export function rowLooks(r: { border?: string | null; banner?: string | null; icon?: string | null }): { border?: string; banner?: string; icon?: string } {
  const out: { border?: string; banner?: string; icon?: string } = {};
  for (const kind of ['border', 'banner', 'icon'] as const) {
    const id = r[kind];
    if (typeof id === 'string' && ITEM_ID.test(id)) out[kind] = id;
  }
  return out;
}

/** Puts on a look the member owns, or takes it off with ''. False when it isn't theirs or isn't a look of that kind. */
export async function wearLook(env: Env, userId: string, kind: LookKind, id: string): Promise<boolean> {
  if (id) {
    const [items, owned] = await Promise.all([loadItems(env), ownedBy(env, userId)]);
    if (lookOf(id, items)?.kind !== kind || !owned.includes(id)) return false;
  }
  await env.DB.prepare(`UPDATE users SET look_${kind} = ? WHERE id = ?`).bind(id, userId).run();
  return true;
}
