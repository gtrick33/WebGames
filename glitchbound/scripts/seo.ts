/**
 * Build-time SEO: one real HTML file per indexable route (with its own title, description,
 * canonical, Open Graph tags, JSON-LD and readable fallback content), plus sitemap.xml,
 * robots.txt and 404.html. Pages are generated from the game registry, so a new game gets its
 * page automatically.
 */
import { GAMES } from '../src/catalog/games.ts';
import { validateCatalog } from '../src/catalog/catalog.ts';
import { CATEGORIES, type GameEntry } from '../src/catalog/types.ts';

export interface PageSpec {
  /** URL path, e.g. /games/neon-rush */
  path: string;
  /** Output file in dist/, e.g. games/neon-rush.html (Cloudflare Pages serves it at /games/neon-rush). */
  file: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  noindex?: boolean;
  jsonLd?: object;
  body: string;
}

const SITE = 'GlitchBound';
const TAGLINE = 'Small Games. Big Obsessions.';
const HOME_DESC =
  'GlitchBound is an independent browser arcade: small, sharp games that start in a second. No installs, no accounts. Just press play.';

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function gameBody(g: GameEntry): string {
  const cats = g.categories.map((c) => CATEGORIES[c].label).join(', ');
  const list = (items: string[] = []): string => items.map((i) => `<li>${esc(i)}</li>`).join('');
  return `<article class="ssr">
<p><a href="/">GlitchBound</a> / <a href="/#arcade">Arcade</a></p>
<h1>${esc(g.title)}</h1>
<p>${esc(g.description)}</p>
<p>Category: ${esc(cats)}. Free to play in your web browser.</p>
${g.highlights ? `<ul>${list(g.highlights)}</ul>` : ''}
<h2>How to play</h2><ul>${list(g.controls.keyboard)}${list(g.controls.touch)}</ul>
<p>JavaScript is required to play. ${g.homepage ? `You can also play at <a href="${esc(g.homepage)}">${esc(g.homepage)}</a>.` : ''}</p>
</article>`;
}

export function pageSpecs(siteUrl: string): PageSpec[] {
  const errors = validateCatalog(GAMES);
  if (errors.length) throw new Error(`Game registry is invalid:\n- ${errors.join('\n- ')}`);
  const gameLinks = GAMES.map((g) => `<li><a href="/games/${g.slug}">${esc(g.title)}</a>: ${esc(g.tagline)}</li>`).join('');
  return [
    {
      path: '/',
      file: 'index.html',
      title: `${SITE} · ${TAGLINE}`,
      description: HOME_DESC,
      image: '/og.png',
      imageAlt: 'GlitchBound: Small Games. Big Obsessions.',
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: `${siteUrl}/`, description: HOME_DESC },
      body: `<section class="ssr"><h1>${SITE}: ${TAGLINE}</h1><p>${esc(HOME_DESC)}</p><h2>Games</h2><ul>${gameLinks}</ul><p><a href="/daily">Today's Daily Challenge</a></p></section>`,
    },
    ...GAMES.map(
      (g): PageSpec => ({
        path: `/games/${g.slug}`,
        file: `games/${g.slug}.html`,
        title: `Play ${g.title} · ${SITE}`,
        description: `${g.tagline} Free to play in your browser on ${SITE}.`,
        image: `/games/${g.slug}/og.jpg`,
        imageAlt: g.art.alt,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'VideoGame',
          name: g.title,
          description: g.description,
          url: `${siteUrl}/games/${g.slug}`,
          image: `${siteUrl}/games/${g.slug}/og.jpg`,
          genre: g.categories.map((c) => CATEGORIES[c].label),
          gamePlatform: 'Web browser',
          applicationCategory: 'Game',
          operatingSystem: 'Any',
          datePublished: g.released,
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@type': 'Organization', name: SITE, url: `${siteUrl}/` },
        },
        body: gameBody(g),
      }),
    ),
    {
      path: '/daily',
      file: 'daily.html',
      title: `Daily Challenge · ${SITE}`,
      description: 'One new GlitchBound challenge every day, the same for everyone. Clear it, keep your streak alive and share your result.',
      image: '/og.png',
      imageAlt: 'GlitchBound Daily Challenge',
      body: `<section class="ssr"><h1>Daily Challenge</h1><p>A new challenge unlocks every day at local midnight. Clear it in a single round on ${SITE} to build your streak.</p><p><a href="/">Back to the arcade</a></p></section>`,
    },
    {
      path: '/c',
      file: 'c.html',
      title: `Challenge your friends · ${SITE}`,
      description: 'Challenge up to 5 friends on GlitchBound: same game, same round, one try each. Send the link in any chat, no sign-up.',
      image: '/og.png',
      imageAlt: SITE,
      body: `<section class="ssr"><h1>Challenge your friends</h1><p>Pick a game, play your round and send the link. Up to 6 players get the same round, one try each, and the scoreboard keeps count across rematches.</p><p><a href="/">Back to the arcade</a></p></section>`,
    },
    {
      // Template for challenge invites (/c/<id>): the server fills in who challenged you.
      path: '/challenge',
      file: 'challenge.html',
      title: `You've been challenged · ${SITE}`,
      description: 'A friend challenged you on GlitchBound. Same game, same seed: tap to play, free in your browser.',
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>You've been challenged!</h1><p><a href="/">Open GlitchBound</a></p></section>`,
    },
    {
      path: '/privacy',
      file: 'privacy.html',
      title: `Privacy & your data · ${SITE}`,
      description: 'What GlitchBound stores, what it does not, and how to delete your local data.',
      image: '/og.png',
      imageAlt: SITE,
      body: `<section class="ssr"><h1>Privacy &amp; your data</h1><p>${SITE} has no accounts. Personal bests and daily challenge history are kept in your browser's local storage and never uploaded.</p></section>`,
    },
    {
      path: '/leaderboards',
      file: 'leaderboards.html',
      title: `Leaderboards · ${SITE}`,
      description: 'GlitchBound leaderboards: top scores for every game and the Hall of Fame of record holders.',
      image: '/og.png',
      imageAlt: 'GlitchBound leaderboards',
      body: `<section class="ssr"><h1>Leaderboards</h1><p>Top scores for every GlitchBound game, plus the Hall of Fame: members with the most #1 spots, podiums and personal records.</p><p><a href="/">Back to the arcade</a></p></section>`,
    },
    {
      path: '/me',
      file: 'me.html',
      title: `Your profile · ${SITE}`,
      description: HOME_DESC,
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>Your profile</h1><p>Sign in to see your quests, level, badges and bests.</p></section>`,
    },
    {
      path: '/party',
      file: 'party.html',
      title: `Party Mode: party games for one phone · ${SITE}`,
      description: 'Free pass-the-phone party games: truth or dare, Never Have I Ever, charades, a dice board game and a bidding game. Add your friends’ names and play in seconds.',
      image: '/og.png',
      imageAlt: 'GlitchBound Party Mode',
      body: `<section class="ssr"><h1>Party Mode</h1><p>Pass-the-phone party games for groups: Party Prompts (truth, dare, most likely to), Never Have I Ever, Charades, Dice Adventure and Name Your Price. No app, no account.</p><p><a href="/">Back to the arcade</a></p></section>`,
    },
    {
      path: '/me/bugs',
      file: 'me/bugs.html',
      title: `Report a bug · ${SITE}`,
      description: 'Found something broken in a GlitchBound game? Tell us what happened and we will fix it.',
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>Report a bug</h1><p>Tell us what went wrong, in which game, and how to make it happen again.</p></section>`,
    },
    {
      path: '/signin',
      file: 'signin.html',
      title: `Sign in or create an account · ${SITE}`,
      description: 'Join GlitchBound for free with Google or your email: daily quests, levels and leaderboards.',
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>Join the arcade</h1><p>Sign in with Google or with an email code.</p></section>`,
    },
    {
      path: '/admin',
      file: 'admin.html',
      title: `Admin · ${SITE}`,
      description: HOME_DESC,
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>Admin</h1></section>`,
    },
    {
      path: '/404',
      file: '404.html',
      title: `Page not found · ${SITE}`,
      description: HOME_DESC,
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>This level doesn't exist.</h1><p><a href="/">Back to the arcade</a></p></section>`,
    },
  ];
}

export function headTags(p: PageSpec, siteUrl: string): string {
  const url = `${siteUrl}${p.path === '/' ? '/' : p.path}`;
  const img = `${siteUrl}${p.image}`;
  return [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    p.noindex ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(p.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    p.jsonLd ? `<script type="application/ld+json">${JSON.stringify(p.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function renderPage(template: string, p: PageSpec, siteUrl: string): string {
  const out = template
    .replace(/<!--gb:head-->[\s\S]*?<!--\/gb:head-->/, `<!--gb:head-->\n    ${headTags(p, siteUrl)}\n    <!--/gb:head-->`)
    .replace(/<div id="root">[\s\S]*?<\/div><!--\/root-->/, `<div id="root">${p.body}</div><!--/root-->`);
  if (!out.includes(p.body)) throw new Error(`SEO: could not inject content for ${p.path}`);
  return out;
}

export function sitemap(siteUrl: string): string {
  const latest = GAMES.map((g) => g.released).sort().at(-1) ?? '';
  const urls = [
    { loc: '/', lastmod: latest, priority: '1.0' },
    ...GAMES.map((g) => ({ loc: `/games/${g.slug}`, lastmod: g.released, priority: '0.9' })),
    { loc: '/daily', lastmod: '', priority: '0.6' },
    { loc: '/leaderboards', lastmod: '', priority: '0.5' },
    { loc: '/c', lastmod: '', priority: '0.4' },
    { loc: '/privacy', lastmod: '', priority: '0.2' },
  ];
  const body = urls
    .map((u) => `  <url><loc>${siteUrl}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
