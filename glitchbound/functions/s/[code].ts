import type { Ctx } from '../../server/http';
import { previewPage, readShare } from '../../server/shares';

/** GET /s/<code>: a shared result. Chat apps get a preview with the result; people land on the game. */
export async function onRequestGet({ request, env, params }: Ctx): Promise<Response> {
  const code = typeof params?.code === 'string' ? params.code : '';
  const share = await readShare(env, code).catch(() => null);
  if (!share) return Response.redirect(new URL('/', request.url).toString(), 302);
  return previewPage(env, request, share.path, { title: share.title, description: share.description, image: share.image || undefined, replaceUrl: share.path });
}
