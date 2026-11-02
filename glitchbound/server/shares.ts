import { getGame } from '../src/catalog/catalog';
import { slugOfUrl } from '../src/catalog/urls';
import type { Env } from './http';

/**
 * Short share links (/s/<code>, /c/<code> for challenges): the page a link leads to, with the
 * link-preview tags (title, description, image) rewritten so chats show the result or challenge.
 * What each link says is in server/invites.ts.
 */

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

/*
 * Shared results are typed by the sharer's game, but anyone can call the API: what a card may say is
 * kept to what a result says. Letters, numbers, result emoji and plain punctuation stay (other marks
 * are dropped); a text with a link, an amount of money or prize talk is refused, so no card can
 * pass for an offer from the arcade.
 */
const KEEP = /[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\p{Emoji_Component}\u2190-\u21ff\u2500-\u27bf .,:;!?#%/×+\-–—·•'’"“”„«»()[\]&*|]/u;
const UNTRUSTED = [
  // Links, domains, e-mail and handles.
  /https?:|www\.|@|\b[\p{L}\d-]{2,}\.(?:[a-z]{2,}|рф|бг)\b/iu,
  // Money.
  /[$€£¥₽₹₩¢₿]|\b(?:usd|eur|gbp|bgn|btc|dollars?|euros?|bucks|cash|money)\b|(?<!\p{L})(?:лв\.?|лева|евро)(?!\p{L})|(?<!\p{L})долар/iu,
  // Prizes and official-sounding offers.
  /\b(?:official|prize|gift ?cards?|claims?|claimed|voucher|coupon|rewards?|giveaway|jackpot|lottery|redeem|promo|offer|winner of|you(?:'|’)?ve won|you have won)\b|(?<!\p{L})(?:официал|наград|ваучер|подарък|спечелихте|томбол)/iu,
  // Long numbers (phone numbers, codes): scores have at most nine digits.
  /\d(?:[ ,.]?\d){9,}/u,
];
export const untrusted = (s: string): boolean => UNTRUSTED.some((re) => re.test(s));

const clean = (v: unknown, max: number): string =>
  typeof v === 'string'
    ? [...v]
        .map((ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch))
        .filter((ch) => KEEP.test(ch))
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
  const ok = path === '/' || /^\/(daily|party|leaderboards)$/.test(path) || (/^\/games\/([a-z0-9-]+)$/.test(path) && !!getGame(slugOfUrl(path.slice(7))));
  return ok ? `${path}${url.search}` : null;
}

/** The game a share path is about (by slug: /games/quizbelief is `wait-what`). */
export const shareGame = (path: string): string | undefined => {
  const name = /^\/games\/([a-z0-9-]+)/.exec(path)?.[1];
  return name && getGame(slugOfUrl(name)) ? slugOfUrl(name) : undefined;
};

/** A result's words, cleaned and kept short; null when empty or when it reads like a link, money or a prize. */
export function shareText(title: unknown, description: unknown): { title: string; description: string } | null {
  // Checked as sent (before the marks a card can't show are dropped) and as kept.
  if ([title, description].some((v) => typeof v === 'string' && untrusted(v.replace(/\s+/g, ' ')))) return null;
  const t = clean(title, 80);
  const d = clean(description, 220)
    .split(' · ')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
  return t && !untrusted(t) && !untrusted(d) ? { title: t, description: d } : null;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The static page for `path` with the link-preview tags replaced. */
export async function previewPage(env: Env, request: Request, path: string, meta: { title: string; description: string; image?: string; imageAlt?: string; replaceUrl: string }): Promise<Response> {
  const origin = new URL(request.url).origin;
  const pagePath = path.split('?')[0]!;
  const asset = pagePath === '/' ? '/' : pagePath;
  const res = env.ASSETS ? await env.ASSETS.fetch(new URL(asset, origin)) : null;
  if (!res || !res.ok) return Response.redirect(new URL(path, origin).toString(), 302);
  let html = await res.text();
  const set = (prop: string, value: string, attr = 'property'): void => {
    const re = new RegExp(`<meta ${attr}="${prop}" content="[^"]*"\\s*/?>`);
    const tag = `<meta ${attr}="${prop}" content="${esc(value)}" />`;
    // Replacer functions: in a replacement string, $' $` $& in a player's name would insert parts of the page.
    html = re.test(html) ? html.replace(re, () => tag) : html.replace('</head>', () => `    ${tag}\n  </head>`);
  };
  set('og:title', meta.title);
  set('og:description', meta.description || 'Small games, big obsessions. Free in your browser.');
  set('og:url', `${origin}${meta.replaceUrl}`);
  if (meta.image) set('og:image', meta.image.startsWith('http') ? meta.image : `${origin}${meta.image}`);
  if (meta.imageAlt) set('og:image:alt', meta.imageAlt);
  set('twitter:card', 'summary_large_image', 'name');
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(meta.title)}</title>`);
  // The app should see the real address (its router does not know /s/ and /c/).
  const script = `<head>\n    <script>history.replaceState(null, '', ${JSON.stringify(meta.replaceUrl).replace(/</g, '\\u003c')});</script>`;
  html = html.replace('<head>', () => script);
  // Not cached: the page names this deploy's script files, which the next deploy replaces.
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function readShare(env: Env, code: string): Promise<{ path: string; title: string; description: string; image: string } | null> {
  if (!/^[A-Za-z0-9]{5,12}$/.test(code)) return null;
  return env.DB.prepare('SELECT path, title, description, image FROM shares WHERE code = ?').bind(code).first<{ path: string; title: string; description: string; image: string }>();
}
