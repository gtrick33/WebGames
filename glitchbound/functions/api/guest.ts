import { clearGuestCookie, guestCookie, guestCookieKey, validGuestKey } from '../../server/guest';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../server/http';

const randomKey = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 24);

/**
 * POST /api/guest { key?, hint? } -> { key }: this browser's guest key, kept as the gb_guest cookie. The
 * cookie's key wins once set; the first time, the key the browser already keeps is adopted (so no guest's
 * identity changes), else `hint` (the key this visit already uses), else a new one.
 */
export async function onRequestPost({ request }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const body = await readJson(request);
  const key = [guestCookieKey(request), body?.key, body?.hint].find(validGuestKey) ?? randomKey();
  return json({ key }, 200, { 'set-cookie': guestCookie(key, request), 'cache-control': 'no-store' });
}

/** DELETE /api/guest: forgets this browser's guest key (with the browser's own data). */
export function onRequestDelete({ request }: Ctx): Response {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  return json({ ok: true }, 200, { 'set-cookie': clearGuestCookie(request) });
}
