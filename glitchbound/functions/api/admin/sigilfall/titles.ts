import { logAdmin } from '../../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { requireAdmin } from '../../../../server/session';
import { grantTitle, revokeTitle, titlesFor, titleSummary } from '../../../../server/sigilfallTitles';

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const playerOf = (ctx: Ctx, id: string) => (id ? ctx.env.DB.prepare('SELECT id, nickname FROM users WHERE id = ?').bind(id).first<{ id: string; nickname: string }>() : Promise.resolve(null));

/**
 * GET /api/admin/sigilfall/titles?user=<id>: every Sigilfall title that member was given, newest first, taken-back ones
 * too. Admins only.
 *   → { titles: [{ id, name, fx, before, at, by, revokedAt }] }
 */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const admin = await requireAdmin(ctx.env, ctx.request);
  if (admin instanceof Response) return admin;
  const id = text(new URL(ctx.request.url).searchParams.get('user'), 64);
  if (!(await playerOf(ctx, id))) return bad('not_found', 404, { message: 'No player with that id.' });
  return json({ titles: await titlesFor(ctx.env, id) });
}

/**
 * POST /api/admin/sigilfall/titles: Sigilfall titles an admin gives, admins only, each written to the change log.
 *   { action: 'grant', userId, name, fx, before }  gives a member a title, in a light (src/catalog/titleFx.ts), before or after the name
 *     → { ok: true, title: { id, name, fx, before, at } }
 *   { action: 'revoke', id }                       takes one back
 */
export async function onRequestPost(ctx: Ctx): Promise<Response> {
  const { request, env } = ctx;
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const by = admin.email || admin.nickname;
  switch (body?.action) {
    case 'grant': {
      const player = await playerOf(ctx, text(body.userId, 64));
      if (!player) return bad('not_found', 404, { message: 'No player with that id.' });
      const title = await grantTitle(env, player.id, { name: body.name, fx: body.fx, before: body.before }, by);
      if (typeof title === 'string') return bad('bad_title', 400, { message: title });
      await logAdmin(env, by, 'sigilfall', `Sigilfall, ${player.nickname}: gave the title ${titleSummary(title)}`);
      return json({ ok: true, title });
    }
    case 'revoke': {
      const gone = await revokeTitle(env, text(body.id, 64));
      if (!gone) return bad('not_found', 404, { message: 'That title has already been taken back.' });
      const player = await playerOf(ctx, gone.userId);
      await logAdmin(env, by, 'sigilfall', `Sigilfall, ${player?.nickname ?? 'a deleted account'}: took back the title “${gone.title.name}”`);
      return json({ ok: true });
    }
    default:
      return bad('unknown_action');
  }
}
