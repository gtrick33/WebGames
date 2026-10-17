import type { Ctx } from '../../../server/http';

/** GET /api/subscribe/confirm?token=…: confirms a newsletter signup, then shows the site. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  let ok = false;
  if (/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    const row = await env.DB.prepare('SELECT email FROM subscribers WHERE token = ?').bind(token).first<{ email: string }>();
    if (row) {
      await env.DB.prepare(`UPDATE subscribers SET status = 'confirmed', confirmed_at = ? WHERE token = ?`).bind(Date.now(), token).run();
      ok = true;
    }
  }
  return Response.redirect(new URL(ok ? '/?notify=confirmed' : '/?notify=invalid', request.url).toString(), 303);
}
