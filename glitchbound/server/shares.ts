import { getGame } from '../src/catalog/catalog';
import type { Env } from './http';

/**
 * Short share links (/s/<code>, /c/<code> for challenges): the page a link leads to, with the
 * link-preview tags (title, description, image) rewritten so chats show the result or challenge.
 */

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string'
    ? [...v]
        .map((ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/** Only pages of this site can be share targets. */
export function sharePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.length > 300) return null;
  const url = new URL(raw, 'https://x.invalid');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const ok = path === '/' || /^\/(daily|party|leaderboards)$/.test(path) || (/^\/games\/([a-z0-9-]+)$/.test(path) && !!getGame(path.slice(7)));
  return ok ? `${path}${url.search}` : null;
}

export function shareText(title: unknown, description: unknown): { title: string; description: string } | null {
  const t = clean(title, 100);
  return t ? { title: t, description: clean(description, 220) } : null;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The static page for `path` with the link-preview tags replaced. */
export async function previewPage(env: Env, request: Request, path: string, meta: { title: string; description: string; image?: string; replaceUrl: string }): Promise<Response> {
  const origin = new URL(request.url).origin;
  const pagePath = path.split('?')[0]!;
  const asset = pagePath === '/' ? '/' : pagePath;
  const res = env.ASSETS ? await env.ASSETS.fetch(new URL(asset, origin)) : null;
  if (!res || !res.ok) return Response.redirect(new URL(path, origin).toString(), 302);
  let html = await res.text();
  const set = (prop: string, value: string, attr = 'property'): void => {
    const re = new RegExp(`<meta ${attr}="${prop}" content="[^"]*"\\s*/?>`);
    const tag = `<meta ${attr}="${prop}" content="${esc(value)}" />`;
    html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
  };
  set('og:title', meta.title);
  set('og:description', meta.description || 'Small games, big obsessions. Free in your browser.');
  set('og:url', `${origin}${meta.replaceUrl}`);
  if (meta.image) set('og:image', meta.image.startsWith('http') ? meta.image : `${origin}${meta.image}`);
  set('twitter:card', 'summary_large_image', 'name');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`);
  // The app should see the real address (its router does not know /s/ and /c/).
  html = html.replace('<head>', `<head>\n    <script>history.replaceState(null, '', ${JSON.stringify(meta.replaceUrl).replace(/</g, '\\u003c')});</script>`);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}

export async function readShare(env: Env, code: string): Promise<{ path: string; title: string; description: string; image: string } | null> {
  if (!/^[A-Za-z0-9]{5,12}$/.test(code)) return null;
  return env.DB.prepare('SELECT path, title, description, image FROM shares WHERE code = ?').bind(code).first<{ path: string; title: string; description: string; image: string }>();
}
