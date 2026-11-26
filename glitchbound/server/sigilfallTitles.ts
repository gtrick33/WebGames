/**
 * Sigilfall titles an admin gives a member (Admin › Sigilfall, and Admin › Ads & shop): their own words, in one of the
 * title lights (src/catalog/titleFx.ts), before or after the name. Account-wide: they come with the member's account
 * (Me.sigilTitles, built in server/members.ts) and any of their heroes can wear one. Taking one back keeps it on record,
 * with when. Endpoint: functions/api/admin/sigilfall/titles.ts.
 */
import { cleanTitle, isTitleFx, titleFx, titleGoesAfter, type TitleFxId } from '../src/catalog/titleFx';
import type { GmTitle, SigilTitleGrant } from '../src/platform/apiTypes';
import type { Env } from './http';

/** The most titles a member holds at once (taken-back ones don't count). */
export const TITLES_MAX = 50;
/** The most the admin's list shows of one member's, taken-back ones included. */
const HISTORY_MAX = 200;

interface Row {
  id: string;
  user_id: string;
  name: string;
  fx: string;
  before_name: number;
  given_by: string;
  created_at: number;
  revoked_at: number | null;
}

const grantOf = (r: Row): SigilTitleGrant => ({ id: r.id, name: r.name, fx: isTitleFx(r.fx) ? r.fx : 'plain', before: !!r.before_name, at: r.created_at });

// Two given in the same millisecond keep the order they were given in: the table's rowid climbs with each one (the id
// is random), so the game shows them, and the account's poll compares them, in the same order every time.
const heldBy = (env: Env, userId: string) =>
  env.DB.prepare('SELECT id, name, fx, before_name, created_at FROM sigilfall_titles WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at, rowid').bind(userId).all<Row>();

/** The titles a member holds now, oldest first: what their account carries. One indexed read. */
export async function liveTitles(env: Env, userId: string): Promise<SigilTitleGrant[]> {
  try {
    return (await heldBy(env, userId)).results.map(grantOf);
  } catch {
    // (before the migration has run: an account still loads)
    return [];
  }
}

/** Every title a member was given, newest first, taken-back ones too: what the admin sees. */
export async function titlesFor(env: Env, userId: string): Promise<GmTitle[]> {
  const rows = await env.DB.prepare('SELECT * FROM sigilfall_titles WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').bind(userId, HISTORY_MAX).all<Row>();
  return rows.results.map((r) => ({ ...grantOf(r), by: r.given_by, revokedAt: r.revoked_at ?? null }));
}

export interface TitleInput {
  name: unknown;
  fx: unknown;
  /** Before the name; left out, the side the words read best on (titleGoesAfter). */
  before?: unknown;
}

/** Checks a title an admin wants to give: their words tidied, a light there is, and which side of the name. */
export function checkTitle(input: TitleInput): { name: string; fx: TitleFxId; before: boolean } | string {
  const name = cleanTitle(input.name);
  if (!name) return 'Type the title.';
  if (!isTitleFx(input.fx)) return 'Pick a light for it.';
  return { name, fx: input.fx, before: typeof input.before === 'boolean' ? input.before : !titleGoesAfter(name) };
}

/** Gives a member a title. Returns it, or why it can't be given (in words for the admin). */
export async function grantTitle(env: Env, userId: string, input: TitleInput, by: string, now = Date.now()): Promise<SigilTitleGrant | string> {
  const t = checkTitle(input);
  if (typeof t === 'string') return t;
  const held = (await heldBy(env, userId)).results;
  if (held.some((h) => h.name.toLowerCase() === t.name.toLowerCase())) return `They already have “${t.name}”. Take it back first to give it in another light.`;
  if (held.length >= TITLES_MAX) return `They hold ${TITLES_MAX} titles already. Take one back first.`;
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO sigilfall_titles (id, user_id, name, fx, before_name, given_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, t.name, t.fx, t.before ? 1 : 0, by.slice(0, 120), now)
    .run();
  return { id, name: t.name, fx: t.fx, before: t.before, at: now };
}

/** Takes a title back. Returns whose it was and what it said (for the change log), or null if it isn't held any more. */
export async function revokeTitle(env: Env, id: string, now = Date.now()): Promise<{ userId: string; title: SigilTitleGrant } | null> {
  const row = await env.DB.prepare('SELECT * FROM sigilfall_titles WHERE id = ? AND revoked_at IS NULL').bind(id).first<Row>();
  if (!row) return null;
  const r = (await env.DB.prepare('UPDATE sigilfall_titles SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now, id).run()) as { meta?: { changes?: number }; changes?: number };
  if (!Number(r?.meta?.changes ?? r?.changes ?? 0)) return null;
  return { userId: row.user_id, title: grantOf(row) };
}

/** A title in a few words for the change log: “the Kingslayer” (Ember, after the name). */
export const titleSummary = (t: { name: string; fx: string; before: boolean }): string => `“${t.name}” (${titleFx(t.fx).name}, ${t.before ? 'before' : 'after'} the name)`;
