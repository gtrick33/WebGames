import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';
import { requireUser } from '../../server/session';
import { isSyncedKey, MAX_SYNCED_SAVE } from '../../src/platform/syncKeys';

/**
 * Cloud saves for signed-in players (the client is src/platform/cloudSave.ts). Each save is a device's
 * localStorage value for one game (or the arcade), so today's dailies, a half-played daily and bests
 * follow the account and survive a browser clearing its storage. Cheap by design: one row per player
 * and save, replaced in place; a device only sends saves that changed, a few seconds after the change.
 */

type SaveRow = { key: string; data: string; at: number };

/** Saves per request (there are about 20 kinds of save in all). */
const MAX_ITEMS = 24;
/** Saves nobody changed for this long are deleted; a device that still has one writes it back on its next change. */
const KEEP_MS = 180 * 86_400_000;

/** GET /api/saves?since=<ms>: the player's saves changed after `since` (every save for 0). */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const since = Math.max(0, Number(new URL(request.url).searchParams.get('since')) || 0);
  const rows = await env.DB.prepare('SELECT key, data, updated_at AS at FROM game_saves WHERE user_id = ? AND updated_at > ?').bind(user.id, since).all<SaveRow>();
  return json({ saves: rows.results });
}

/** Number of rows a statement changed (D1 reports it in `meta`, SQLite directly). */
const changesOf = (r: unknown): number => {
  const x = r as { meta?: { changes?: number }; changes?: number } | null;
  return Number(x?.meta?.changes ?? x?.changes ?? 0);
};

/**
 * POST /api/saves { items: [{ key, data, base }] }: stores changed saves (`data` null deletes one).
 * `base` is the version (updated_at) the device's copy grew from. If the server has a newer one (another
 * device synced since), nothing is written and that version comes back in `conflicts`: the device merges
 * the two and sends the result. So a device that was offline can never overwrite newer progress.
 */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const user = await requireUser(env, request);
  if (user instanceof Response) return user;
  const body = await readJson(request, 1_000_000);
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return bad('bad_request');
  const items: { key: string; data: string | null; base: number }[] = [];
  for (const it of raw as Record<string, unknown>[]) {
    const key = it?.key;
    const data = it?.data;
    const base = it?.base;
    if (typeof key !== 'string' || !isSyncedKey(key) || items.some((x) => x.key === key)) return bad('bad_key');
    if (typeof base !== 'number' || !Number.isSafeInteger(base) || base < 0) return bad('bad_request');
    if (data !== null) {
      if (typeof data !== 'string' || data.length > MAX_SYNCED_SAVE) return bad('save_too_big', 413);
      try {
        JSON.parse(data);
      } catch {
        return bad('bad_save');
      }
    }
    items.push({ key, data: data as string | null, base });
  }

  const now = Date.now();
  const db = env.DB;
  const versions = items.map((it) => Math.max(now, it.base + 1));
  const statements = items.map((it, i) =>
    it.data === null
      ? db.prepare('DELETE FROM game_saves WHERE user_id = ? AND key = ? AND updated_at <= ?').bind(user.id, it.key, it.base)
      : db
          .prepare(
            `INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE game_saves.updated_at <= ?`,
          )
          .bind(user.id, it.key, it.data, versions[i], it.base),
  );
  // Now and then, clear out saves nobody has changed for half a year (the index keeps this cheap).
  if (Math.random() < 0.02) statements.push(db.prepare('DELETE FROM game_saves WHERE updated_at < ?').bind(now - KEEP_MS));
  const results = await db.batch(statements);

  const saved: { key: string; at: number }[] = [];
  const unsure: string[] = [];
  items.forEach((it, i) => (changesOf(results[i]) > 0 ? saved.push({ key: it.key, at: versions[i]! }) : unsure.push(it.key)));
  const conflicts: SaveRow[] = [];
  if (unsure.length) {
    // Nothing written: either a newer version is there (a conflict) or the save was already gone (a delete).
    const rows = await db
      .prepare(`SELECT key, data, updated_at AS at FROM game_saves WHERE user_id = ? AND key IN (${unsure.map(() => '?').join(', ')})`)
      .bind(user.id, ...unsure)
      .all<SaveRow>();
    for (const key of unsure) {
      const row = rows.results.find((r) => r.key === key);
      if (row) conflicts.push(row);
      else saved.push({ key, at: 0 });
    }
  }
  return json({ saved, conflicts });
}
