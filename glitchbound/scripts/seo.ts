/**
 * Build-time SEO: one real HTML file per indexable route (with its own title, description,
 * canonical, Open Graph tags, JSON-LD and readable fallback content), plus sitemap.xml,
 * robots.txt and 404.html. Pages are generated from the game registry, so a new game gets its
 * page automatically.
 */
import { GAMES } from '../src/catalog/games.ts';
import { validateCatalog } from '../src/catalog/catalog.ts';
import { CATEGORIES, type CategoryId, type GameEntry } from '../src/catalog/types.ts';
import { ABOUT_DESCRIPTION, CONTACT_DESCRIPTION, CONTACT_PATH } from '../src/pages/infoText.ts';

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
  /** Adults-only page: `<meta name="rating" content="adult">` keeps it out of SafeSearch, not the rest of the site. */
  adult?: boolean;
  jsonLd?: object;
  body: string;
}

const SITE = 'GlitchBound';
const TAGLINE = 'Small Games. Big Obsessions.';
const HOME_DESC =
  'GlitchBound is an independent browser arcade: small, sharp games that start in a second. No installs, no account needed. Just press play.';

/** How adults-only games are marked in the readable HTML (the app shows the same as its 18+ label). */
const ADULT = 'Adults only (18+)';

/**
 * Site links under every page's readable fallback, so crawlers and visitors without JavaScript can
 * reach the info pages too (the app replaces all of it with its own footer).
 */
const SSR_FOOTER = `<footer class="ssr ssr-foot"><nav aria-label="Site"><a href="/">Arcade</a> · <a href="/party">Party Mode</a> · <a href="/daily">Daily Challenge</a> · <a href="/leaderboards">Leaderboards</a> · <a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></nav><p>© ${new Date().getFullYear()} ${SITE} · All games are original works.</p></footer>`;

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A game's one-liner without the trailing "18+." that the adults-only label already says. */
const taglineOf = (g: GameEntry): string => (g.adult ? g.tagline.replace(/\s*18\+\.?$/, '') : g.tagline);

function gameItem(g: GameEntry): string {
  return `<li><a href="/games/${g.slug}">${esc(g.title)}</a>${g.adult ? ` <strong>${ADULT}</strong>` : ''}: ${esc(taglineOf(g))}</li>`;
}

/** The home page's games, grouped by their main category; Party Mode games (Crass Act) get their own group. */
function homeGames(): string {
  const arcade = GAMES.filter((g) => !g.partyOnly);
  const dailies = arcade.filter((g) => g.ownDaily).length;
  const groups = (Object.keys(CATEGORIES) as CategoryId[])
    .map((c) => ({ c, games: arcade.filter((g) => g.categories[0] === c) }))
    .filter((x) => x.games.length > 0)
    .map(({ c, games }) => `<h3>${esc(CATEGORIES[c].label)} games</h3><ul>${games.map(gameItem).join('')}</ul>`);
  const party = GAMES.filter((g) => g.partyOnly);
  return [
    `<h2>Games</h2>`,
    `<p>${dailies} of the ${arcade.length} arcade games have their own daily puzzle, the same for everyone. Start with <a href="/daily">today's Daily Challenge</a>.</p>`,
    ...groups,
    `<h3>Party Mode</h3><p>Games for groups, on one phone or everyone's own: Impostor, charades, Never Have I Ever and more. <a href="/party">Open Party Mode</a>.</p>`,
    party.length ? `<ul>${party.map(gameItem).join('')}</ul>` : '',
  ].join('');
}

function gameBody(g: GameEntry): string {
  const cats = g.categories.map((c) => CATEGORIES[c].label).join(', ');
  const list = (items: string[] = []): string => items.map((i) => `<li>${esc(i)}</li>`).join('');
  return `<article class="ssr">
<p><a href="/">GlitchBound</a> / ${g.partyOnly ? '<a href="/party">Party Mode</a>' : '<a href="/#arcade">Arcade</a>'}</p>
<h1>${esc(g.title)}</h1>
${g.adult ? `<p><strong>${ADULT}.</strong> Everyone playing must be 18 or over, and confirms it before the game starts.</p>` : ''}
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
  return [
    {
      path: '/',
      file: 'index.html',
      title: `${SITE} · ${TAGLINE}`,
      description: HOME_DESC,
      image: '/og.png',
      imageAlt: 'GlitchBound: Small Games. Big Obsessions.',
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: `${siteUrl}/`, description: HOME_DESC },
      body: `<section class="ssr"><h1>${SITE}: ${TAGLINE}</h1><p>${esc(HOME_DESC)}</p>${homeGames()}</section>`,
    },
    ...GAMES.map(
      (g): PageSpec => ({
        path: `/games/${g.slug}`,
        file: `games/${g.slug}.html`,
        title: `Play ${g.title} · ${SITE}`,
        description: `${taglineOf(g)}${g.adult ? ` ${ADULT}.` : ''} Free to play in your browser on ${SITE}.`,
        image: `/games/${g.slug}/og.jpg`,
        imageAlt: g.art.alt,
        adult: g.adult,
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
          ...(g.adult ? { contentRating: 'Adults only (18+)', audience: { '@type': 'PeopleAudience', suggestedMinAge: 18 } } : {}),
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
      description: 'What GlitchBound stores, for how long, who helps us run it, and how to see or delete your data.',
      image: '/og.png',
      imageAlt: SITE,
      body: `<section class="ssr"><h1>Privacy &amp; your data</h1><p>You can play every ${SITE} game without an account. As a guest, your bests and daily challenge history are kept in your browser's local storage and never uploaded. If you sign in, your profile, bests and scores are stored with your account, and you can delete it at any time.</p></section>`,
    },
    {
      path: '/terms',
      file: 'terms.html',
      title: `Terms of use · ${SITE}`,
      description: 'The rules for playing on GlitchBound: free games, fair play, accounts, Party Mode and coins.',
      image: '/og.png',
      imageAlt: SITE,
      body: `<section class="ssr"><h1>Terms of use</h1><p>Every ${SITE} game is free and runs in your browser, with or without an account. Play fair: no bots, scripts or made-up scores, and nicknames and room messages must not be hateful or harassing. Coins, XP and rewards have no money value. Adult party games are for players 18 and over.</p><p><a href="/privacy">Privacy &amp; your data</a></p></section>`,
    },
    {
      path: '/about',
      file: 'about.html',
      title: `About · ${SITE}`,
      description: ABOUT_DESCRIPTION,
      image: '/og.png',
      imageAlt: SITE,
      jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: SITE, url: `${siteUrl}/` },
      body: `<section class="ssr"><h1>About ${SITE}</h1><p>${SITE} is an independent browser arcade: original games that start in a second, plus Party Mode for groups. No installs, nothing to buy and no account needed.</p><h2>Who makes it</h2><p>${SITE} is an independent studio. Every game is designed and built here.</p><h2>Something new every day</h2><p>Most games have a daily round: the same puzzle for everyone, new at midnight your time.</p><h2>For all ages, with one exception</h2><p>The arcade is made for everyone. Crass Act and the After Dark party cards are for adults only: they carry an 18+ label and ask players to confirm their age before they start.</p><p><a href="/contact">Contact us</a> · <a href="/privacy">Privacy &amp; your data</a></p></section>`,
    },
    {
      path: '/contact',
      file: 'contact.html',
      title: `Contact · ${SITE}`,
      description: CONTACT_DESCRIPTION,
      image: '/og.png',
      imageAlt: SITE,
      body: `<section class="ssr"><h1>Get in touch</h1><p>Questions, requests, problems or press: <a href="${CONTACT_PATH.replace('&', '&amp;')}">open a ticket</a>, no account needed. You can follow its status on your profile.</p><p>Something broken? <a href="/me/bugs">Report a bug</a>. To see, export, correct or delete your data, open a ticket and choose “Question or request”.</p><p>See also the <a href="/terms">terms of use</a>.</p></section>`,
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
      description: 'Free party games for one phone or everyone’s own: Impostor, charades, Never Have I Ever, truth or dare, word and color guessing games and more. No app, no sign-up.',
      image: '/og.png',
      imageAlt: 'GlitchBound Party Mode',
      body: `<section class="ssr"><h1>Party Mode</h1><p>Party games for groups, on one phone passed around or on everyone’s own phone in a live room: Impostor, Party Prompts (truth, dare, most likely to), Never Have I Ever, Charades, Dial It In, One of a Kind, Hue Knew?, Dice Adventure and Name Your Price. No app, no account.</p><p><a href="/">Back to the arcade</a></p></section>`,
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
      // The Discord Activity's start page (docs/discord-activity.md).
      path: '/discord',
      file: 'discord.html',
      title: `GlitchBound on Discord · ${SITE}`,
      description: 'Play Wait, What? and Crass Act together in a Discord call: open the Activities menu in a voice channel and pick GlitchBound.',
      image: '/og.png',
      imageAlt: SITE,
      noindex: true,
      body: `<section class="ssr"><h1>GlitchBound on Discord</h1><p>Join a voice channel, open the Activities menu and pick GlitchBound.</p><p><a href="/">Back to the arcade</a></p></section>`,
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
    p.adult ? `<meta name="rating" content="adult" />` : '',
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
    .replace(/<div id="root">[\s\S]*?<\/div><!--\/root-->/, `<div id="root">${p.body}${SSR_FOOTER}</div><!--/root-->`);
  if (!out.includes(p.body)) throw new Error(`SEO: could not inject content for ${p.path}`);
  return out;
}

export function sitemap(siteUrl: string): string {
  const latest = GAMES.map((g) => g.released).sort().at(-1) ?? '';
  const urls = [
    { loc: '/', lastmod: latest, priority: '1.0' },
    ...GAMES.map((g) => ({ loc: `/games/${g.slug}`, lastmod: g.released, priority: '0.9' })),
    { loc: '/party', lastmod: '', priority: '0.8' },
    { loc: '/daily', lastmod: '', priority: '0.6' },
    { loc: '/leaderboards', lastmod: '', priority: '0.5' },
    { loc: '/about', lastmod: '', priority: '0.3' },
    { loc: '/contact', lastmod: '', priority: '0.3' },
    { loc: '/privacy', lastmod: '', priority: '0.2' },
    { loc: '/terms', lastmod: '', priority: '0.2' },
  ];
  const body = urls
    .map((u) => `  <url><loc>${siteUrl}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
