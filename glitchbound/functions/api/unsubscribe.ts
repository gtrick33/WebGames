import type { Ctx } from '../../server/http';

async function unsubscribe({ request, env }: Ctx): Promise<boolean> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  const row = await env.DB.prepare('SELECT email, user_id FROM subscribers WHERE token = ?').bind(token).first<{ email: string; user_id: string | null }>();
  if (!row) return false;
  await env.DB.batch([
    env.DB.prepare(`UPDATE subscribers SET status = 'unsubscribed' WHERE token = ?`).bind(token),
    env.DB.prepare('UPDATE users SET notify = 0 WHERE email = ?').bind(row.email),
  ]);
  return true;
}

/** GET /api/unsubscribe?token=…: the link in every email. */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const ok = await unsubscribe(ctx);
  return Response.redirect(new URL(ok ? '/?notify=unsubscribed' : '/?notify=invalid', ctx.request.url).toString(), 303);
}

/** POST /api/unsubscribe?token=…: one-click unsubscribe from mail apps (RFC 8058). */
export async function onRequestPost(ctx: Ctx): Promise<Response> {
  await unsubscribe(ctx);
  return new Response('Unsubscribed', { status: 200 });
}
