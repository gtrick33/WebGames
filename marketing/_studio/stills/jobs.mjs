// Every still the studio renders: logos, avatars, banners, post templates and thumbnails.
// Paths are relative to marketing/. Game data comes from .cache/content (content/extract.mjs).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STUDIO } from '../lib/site.mjs';
import { GAMES } from '../video/copy.mjs';
import * as M from '../video/marks.mjs';

const read = (f) => JSON.parse(readFileSync(join(STUDIO, '.cache/content', f), 'utf8'));

export async function jobs() {
  const catalog = read('catalog.json');
  const games = catalog.games.filter((g) => !g.partyOnly);
  const J = [];

  // ---- Logos ------------------------------------------------------------------------------------
  for (const s of [1024, 512, 256, 128]) J.push({ tpl: 'logo', out: `logos/mark/glitchbound-mark-${s}.png`, w: s, h: s, transparent: true, data: { kind: 'mark', pad: 0.02 } });
  J.push({ tpl: 'logo', out: 'logos/mark/glitchbound-g-only-1024.png', w: 1024, h: 1024, transparent: true, data: { kind: 'mark', square: false, pad: 0.04 } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-lockup-light.png', w: 2400, h: 600, transparent: true, data: { kind: 'lockup', pad: 0.12 } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-lockup-dark.png', w: 2400, h: 600, transparent: true, data: { kind: 'lockup', dark: true, pad: 0.12 } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-lockup-on-paper.png', w: 2400, h: 600, data: { kind: 'lockup', bg: '#fff6ea', pad: 0.18 } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-lockup-on-ink.png', w: 2400, h: 600, data: { kind: 'lockup', dark: true, bg: '#1d1238', pad: 0.18 } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-stacked-light.png', w: 1600, h: 1600, transparent: true, data: { kind: 'stacked' } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-stacked-dark.png', w: 1600, h: 1600, transparent: true, data: { kind: 'stacked', dark: true } });
  J.push({ tpl: 'logo', out: 'logos/lockup/glitchbound-stacked-on-paper.png', w: 1600, h: 1600, data: { kind: 'stacked', bg: '#fff6ea' } });
  J.push({ tpl: 'logo', out: 'logos/wordmark/glitchbound-wordmark-light.png', w: 2000, h: 400, transparent: true, data: { kind: 'wordmark' } });
  J.push({ tpl: 'logo', out: 'logos/wordmark/glitchbound-wordmark-dark.png', w: 2000, h: 400, transparent: true, data: { kind: 'wordmark', dark: true } });
  J.push({ tpl: 'logo', out: 'logos/watermark/glitchbound-watermark-light.png', w: 900, h: 200, transparent: true, data: { kind: 'lockup', dark: true, pad: 0.1 } });
  for (const v of ['blue', 'paper', 'sunset', 'ink']) J.push({ tpl: 'avatar', out: `logos/profile-pictures/avatar-${v}.png`, w: 1080, h: 1080, data: { variant: v } });

  // ---- Banners ----------------------------------------------------------------------------------
  const B = (out, w, h, safe, extra = {}) => J.push({ tpl: 'banner', out: `banners/${out}`, w, h, data: { safe, games, ...extra } });
  B('youtube-channel-art-2560x1440.png', 2560, 1440, [507, 508, 1546, 423], { tileSize: 300 });
  B('youtube-channel-art-dark-2560x1440.png', 2560, 1440, [507, 508, 1546, 423], { tileSize: 300, dark: true, seed: 4 });
  B('x-twitter-header-1500x500.png', 1500, 500, [430, 40, 1030, 330], { tileSize: 170, align: 'right', seed: 2 });
  B('facebook-cover-1640x624.png', 1640, 624, [260, 90, 1120, 330], { tileSize: 190, seed: 3 });
  B('discord-server-banner-960x540.png', 960, 540, [60, 140, 840, 250], { tileSize: 150, seed: 5 });
  B('linkedin-cover-1128x191.png', 1128, 191, [300, 18, 800, 155], { tileSize: 90, seed: 6, clear: 0.02 });
  B('reddit-banner-1920x384.png', 1920, 384, [380, 50, 1160, 290], { tileSize: 150, seed: 7 });
  B('twitch-banner-1200x480.png', 1200, 480, [150, 90, 900, 290], { tileSize: 150, seed: 8 });
  B('email-signature-1200x300.png', 1200, 300, [30, 20, 1140, 260], { tileSize: 0, seed: 9 });
  B('link-preview-og-1200x630.png', 1200, 630, [110, 150, 980, 320], { tileSize: 170, seed: 10 });
  B('desktop-wallpaper-3840x2160.png', 3840, 2160, [1100, 860, 1640, 440], { tileSize: 420, seed: 11 });
  B('phone-wallpaper-1290x2796.png', 1290, 2796, [80, 1180, 1130, 330], { tileSize: 330, seed: 12 });

  posts(J, catalog, games);
  return J;
}

/** A frame of real gameplay for thumbnails (.cache/content/shots/<slug>.jpg). */
function shot(slug, at) {
  const dir = join(STUDIO, '.cache/content/shots');
  mkdirSync(dir, { recursive: true });
  const t = M.time(slug, 'a', at);
  const f = join(dir, `${slug}-${t.toFixed(2)}.jpg`);
  if (!existsSync(f) || statSync(f).mtimeMs < statSync(join(STUDIO, '.cache/footage', slug, 'a.mp4')).mtimeMs) execFileSync('/opt/homebrew/bin/ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', join(STUDIO, '.cache/footage', slug, 'a.mp4'), '-frames:v', '1', '-q:v', '3', f]);
  return `/_studio/.cache/content/shots/${slug}-${t.toFixed(2)}.jpg`;
}

const ICON = {
  games: `<svg viewBox="0 0 64 64" width="360" height="360"><rect x="6" y="18" width="52" height="30" rx="15" fill="#2ad1f0" stroke="#1d1238" stroke-width="4"/><path d="M20 27v12M14 33h12" stroke="#1d1238" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="29" r="3.5" fill="#ff4fc8" stroke="#1d1238" stroke-width="2.5"/><circle cx="48" cy="36" r="3.5" fill="#ffc928" stroke="#1d1238" stroke-width="2.5"/></svg>`,
  daily: `<svg viewBox="0 0 64 64" width="340" height="340"><rect x="8" y="12" width="48" height="44" rx="10" fill="#fff" stroke="#1d1238" stroke-width="4"/><path d="M8 26h48" stroke="#1d1238" stroke-width="4"/><rect x="8" y="12" width="48" height="14" rx="8" fill="#ff6a1a" stroke="#1d1238" stroke-width="4"/><path d="M20 6v12M44 6v12" stroke="#1d1238" stroke-width="4" stroke-linecap="round"/><path d="M22 40l7 7 13-14" fill="none" stroke="#12c6b3" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  party: `<svg viewBox="0 0 64 64" width="340" height="340"><path d="M10 56l12-34 20 20z" fill="#ffc928" stroke="#1d1238" stroke-width="4" stroke-linejoin="round"/><path d="M16 40l10 10M19 31l14 14" stroke="#ff4fc8" stroke-width="4"/><circle cx="44" cy="12" r="4" fill="#2ad1f0" stroke="#1d1238" stroke-width="3"/><circle cx="54" cy="26" r="4" fill="#b6e62c" stroke="#1d1238" stroke-width="3"/><path d="M34 16q4-8 10-6M46 30q8-2 10 4" fill="none" stroke="#7b4dff" stroke-width="4" stroke-linecap="round"/></svg>`,
  new: `<svg viewBox="0 0 64 64" width="360" height="360"><path d="M32 5l7.5 16.5L57 24l-13 12.5L47 55 32 46l-15 9 3-18.5L7 24l17.5-2.5z" fill="#b6e62c" stroke="#1d1238" stroke-width="4" stroke-linejoin="round"/></svg>`,
  tips: `<svg viewBox="0 0 64 64" width="340" height="340"><path d="M32 6c-11 0-19 8-19 18 0 7 4 11 7 14 2 2 3 4 3 7h18c0-3 1-5 3-7 3-3 7-7 7-14 0-10-8-18-19-18z" fill="#ffc928" stroke="#1d1238" stroke-width="4" stroke-linejoin="round"/><rect x="23" y="45" width="18" height="11" rx="4" fill="#fff" stroke="#1d1238" stroke-width="4"/><path d="M28 30l4 4 4-4" fill="none" stroke="#1d1238" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  wins: `<svg viewBox="0 0 64 64" width="340" height="340"><path d="M18 8h28v14c0 9-6 15-14 15s-14-6-14-15z" fill="#ffc928" stroke="#1d1238" stroke-width="4" stroke-linejoin="round"/><path d="M18 14H8c0 9 5 13 11 13M46 14h10c0 9-5 13-11 13" fill="none" stroke="#1d1238" stroke-width="4"/><path d="M32 37v9" stroke="#1d1238" stroke-width="4"/><rect x="20" y="46" width="24" height="10" rx="3" fill="#ff4fc8" stroke="#1d1238" stroke-width="4"/></svg>`,
  halloween: `<svg viewBox="0 0 64 64" width="360" height="360"><path d="M32 14c-3-6 1-9 5-8" fill="none" stroke="#3f6f00" stroke-width="4" stroke-linecap="round"/><ellipse cx="32" cy="38" rx="25" ry="20" fill="#ff7a1a" stroke="#1d1238" stroke-width="4"/><path d="M24 20q-6 18 0 36M40 20q6 18 0 36" fill="none" stroke="#1d1238" stroke-width="3" opacity=".5"/><path d="M19 33l6-5 5 5zM34 33l6-5 5 5z" fill="#1d1238"/><path d="M20 44q12 9 24 0l-3 4-3-3-3 4-3-4-3 4-3-4-3 3z" fill="#1d1238" stroke="#1d1238" stroke-width="2" stroke-linejoin="round"/></svg>`,
  winter: `<svg viewBox="0 0 64 64" width="360" height="360"><g stroke="#1d1238" stroke-width="5" stroke-linecap="round"><path d="M32 6v52M9.5 19l45 26M9.5 45l45-26"/></g><g stroke="#2ad1f0" stroke-width="3" stroke-linecap="round"><path d="M32 6v52M9.5 19l45 26M9.5 45l45-26"/><path d="M26 10l6 6 6-6M26 54l6-6 6 6M10 27l8-2-2-8M54 37l-8 2 2 8M10 37l8 2-2 8M54 27l-8-2 2-8" fill="none"/></g></svg>`,
};

function posts(J, catalog, games) {
  const P = (out, data, w = 1080, h = 1350) => J.push({ tpl: 'post', out, w, h, data });
  const ST = (out, data) => J.push({ tpl: 'story', out, w: 1080, h: 1920, data });
  const color = (slug) => GAMES[slug]?.color ?? '#2ad1f0';
  const order = Object.keys(GAMES);
  const G = Object.fromEntries(games.map((g) => [g.slug, g]));

  // Game cards (single posts) and the "19 free games" carousel.
  for (const slug of order) {
    const g = G[slug];
    P(`posts/01-game-cards/${slug}.png`, { kind: 'game', title: g.title, line: g.tagline, art: g.art.tile, chips: g.categories, accent: color(slug), eyebrow: g.daily ? 'Free game · new daily' : 'Free browser game' });
  }
  // "19 free games" as three carousels of up to 10 slides (Instagram's limit): cover, games, CTA.
  const parts = [order.slice(0, 7), order.slice(7, 13), order.slice(13)];
  parts.forEach((list, pi) => {
    const dir = `posts/02-carousel-19-free-games/part-${pi + 1}`;
    P(`${dir}/00-cover.png`, { kind: 'cover', eyebrow: `Part ${pi + 1} of 3`, title: pi === 0 ? '19 free games|you can play *right now*' : pi === 1 ? '19 free games,|*part 2*' : '19 free games,|*the finale*', line: 'In your browser. No download, no sign-up.', arts: list.map((s) => G[s].art.tile), swipe: true });
    list.forEach((slug) => {
      const i = order.indexOf(slug);
      const g = G[slug];
      P(`${dir}/${String(i + 1).padStart(2, '0')}-${slug}.png`, { kind: 'game', title: g.title, line: g.tagline, art: g.art.tile, accent: color(slug), number: `${String(i + 1).padStart(2, '0')} / 19`, eyebrow: g.categories.join(' · ') });
    });
    P(`${dir}/99-cta.png`, { kind: 'cta', title: pi < 2 ? 'More in *part ${pi + 2}*' : 'Which one is|*your* obsession?', line: pi < 2 ? 'Play these free now: link in bio.' : 'Tell us in the comments, then go play it: link in bio.' });
  });

  // Party Mode carousel, in two parts (adult games left out).
  const party = catalog.party.filter((p) => !p.adult && p.art);
  const halves = [party.slice(0, Math.ceil(party.length / 2)), party.slice(Math.ceil(party.length / 2))];
  halves.forEach((list, pi) => {
    const dir = `posts/03-carousel-party-mode/part-${pi + 1}`;
    P(`${dir}/00-cover.png`, { kind: 'cover', title: pi === 0 ? 'Game night?|*One phone* is enough' : 'More party games,|*still one phone*', line: `${party.length} party games. No sign-up.`, arts: list.map((p) => p.art.tile), eyebrow: `Party Mode · part ${pi + 1} of 2`, accent: '#ff4fc8', swipe: true });
    list.forEach((p) => {
      const i = party.indexOf(p);
      P(`${dir}/${String(i + 1).padStart(2, '0')}-${p.id}.png`, { kind: 'party', title: p.title, line: p.blurb, art: p.art.tile, accent: p.color, number: `${p.players} players`, chips: [p.time] });
    });
    P(`${dir}/99-cta.png`, { kind: 'cta', title: 'Tag your *game night* crew', line: 'Party Mode: pass one phone, or everyone plays on their own.', cta: 'glitchboundstudio.com/party' });
  });

  // Trivia carousels (question, then answer).
  const trivia = JSON.parse(readFileSync(join(STUDIO, '.cache/content/trivia.json'), 'utf8')).filter((q) => q.answers.length === 4 && q.text.length <= 96 && q.fact.length <= 150 && !q.bulgaria);
  for (let n = 0; n < 12; n++) {
    const q = trivia[(n * 37 + 11) % trivia.length];
    const id = String(n + 1).padStart(2, '0');
    P(`posts/04-trivia-carousels/trivia-${id}-1-question.png`, { kind: 'trivia-q', q });
    P(`posts/04-trivia-carousels/trivia-${id}-2-answer.png`, { kind: 'trivia-a', q });
  }

  // Spot the Glitch and Where's the Ball puzzle posts.
  const spots = JSON.parse(readFileSync(join(STUDIO, '.cache/content/spot.json'), 'utf8'));
  [1, 3, 5, 7, 9, 11, 14, 16].forEach((i, n) => {
    const id = String(n + 1).padStart(2, '0');
    P(`posts/05-spot-the-glitch-puzzles/spot-${id}-1-question.png`, { kind: 'spot-q', puzzle: spots[i] });
    P(`posts/05-spot-the-glitch-puzzles/spot-${id}-2-answer.png`, { kind: 'spot-a', puzzle: spots[i] });
  });
  const balls = JSON.parse(readFileSync(join(STUDIO, '.cache/content/ball.json'), 'utf8')).filter((b) => !b.error);
  [0, 3, 6, 9, 12, 15, 18, 21].forEach((i, n) => {
    const id = String(n + 1).padStart(2, '0');
    P(`posts/06-wheres-the-ball-puzzles/ball-${id}-1-question.png`, { kind: 'ball-q', level: balls[i] });
    P(`posts/06-wheres-the-ball-puzzles/ball-${id}-2-answer.png`, { kind: 'ball-a', level: balls[i] });
  });

  // Manifesto / quote posts.
  const quotes = [
    ['Small games.|*Big obsessions.*', null, '#2ad1f0'],
    ['No download.|No sign-up.|*Just play.*', null, '#b6e62c'],
    ['"One more round"|is a *lifestyle*.', null, '#ff4fc8'],
    ['Five minutes.|*Endless* replays.', 'Every game starts in a second.', '#ffc928'],
    ['New dailies|*every midnight.*', 'Same puzzles for everyone. Compare your score.', '#12c6b3'],
    ['Your coffee break|just got *competitive*.', null, '#ff6a1a'],
    ['Brain warm-up:|*3 dailies* before work.', 'Letter Pinch. Crosswire. Color Recall.', '#7b4dff'],
    ['Made by one tiny studio.|Played *everywhere*.', 'GlitchBound is independent. Thanks for playing.', '#3d5bff'],
  ];
  quotes.forEach(([title, line, accent], i) => P(`posts/07-quotes/quote-${String(i + 1).padStart(2, '0')}.png`, { kind: 'quote', title, line, accent, size: title.length > 40 ? 112 : 132 }));

  // New-game announcements (the newest releases).
  for (const slug of ['fussbox', 'whatsit', 'star-grid', 'gut-check', 'gloop', 'outta-here']) {
    const g = G[slug];
    P(`posts/08-new-game-drops/${slug}.png`, { kind: 'new', title: g.title, line: g.tagline, art: g.art.tile, accent: color(slug), eyebrow: 'New game · out now' });
  }

  // Holidays and moments.
  const H = [
    ['halloween', 'Halloween mode|*is on*', 'Cobwebs everywhere. Spooky tunes in Quizbelief', '#ff7a1a', true],
    ['diwali', 'Happy *Diwali*', 'May your days be bright and your streaks long.', '#ffb703', false],
    ['thanksgiving', 'Thankful for|*small games*', 'And for everyone who plays them. Thank you.', '#ff6a1a', false],
    ['black-friday', 'Black Friday deal:|*everything is free*', 'Like every other day. 19 games, no paywall.', '#1d1238', true],
    ['winter', 'Cozy up with|*a puzzle or three*', 'The winter look is live on GlitchBound.', '#7fd7ff', false],
    ['christmas', 'Merry *Christmas*', 'Family game night? Party Mode needs just one phone.', '#ff4d5e', false],
    ['new-year', 'New year.|*New streak.*', 'Start 2027 with today\u2019s dailies.', '#b6e62c', true],
  ];
  for (const [id, title, line, accent, dark] of H) P(`posts/09-holidays/${id}.png`, { kind: 'quote', title, line, accent, dark, eyebrow: id === 'black-friday' ? 'Black Friday' : null, size: 124 });

  // Stories.
  for (const slug of order.filter((s) => G[s].daily)) ST(`stories/daily-reminders/${slug}.png`, { kind: 'daily', title: G[slug].title, art: G[slug].art.tile, accent: color(slug) });
  const polls = [['wing-it', 'gloop'], ['letter-pinch', 'crosswire'], ['neon-rush', 'mini-racer'], ['color-lab', 'square-deal'], ['spot-the-glitch', 'wheres-the-ball'], ['fussbox', 'whatsit']];
  polls.forEach(([a, b], i) => ST(`stories/polls/poll-${String(i + 1).padStart(2, '0')}-${a}-vs-${b}.png`, { kind: 'poll', title: i % 2 ? 'Which one *tonight*?' : 'Team *which*?', games: [a, b].map((s) => ({ title: G[s].title, art: G[s].art.tile })) }));
  // Score brags: the numbers are from the recorded runs (their marks), so they're real.
  const mk = (slug, take, name, n = 0) => { try { return M.mark(slug, take, name, n)?.data ?? {}; } catch { return {}; } };
  const brags = [
    ['wing-it', `${mk('wing-it', 'a', 'crash').score ?? ''}`, 'Wing It gaps'],
    ['gloop', `${mk('gloop', 'a', 'drop', -1).score ?? ''}`, 'Gloop'],
    ['gut-check', `${mk('gut-check', 'a', 'miss').streak ?? ''}`, 'Gut Check streak'],
    ['letter-pinch', `${mk('letter-pinch', 'a', 'solved').rows ?? ''}/6`, 'Letter Pinch'],
    ['memory-grid', `${mk('memory-grid', 'a', 'miss').round ?? ''}`, 'Memory Grid round'],
    ['color-recall', `${mk('color-recall', 'a', 'done').accuracy ?? ''}%`, 'Color Recall'],
  ];
  for (const [slug, score, title] of brags) ST(`stories/beat-my-score/${slug}.png`, { kind: 'beat', title, score, art: G[slug].art.tile });
  ST('stories/announcements/new-dailies.png', { kind: 'announce', eyebrow: 'Every midnight', title: '18 new|*dailies*', line: 'Same puzzles for everyone. Keep your streak alive.' });
  ST('stories/announcements/party-mode.png', { kind: 'announce', eyebrow: 'Party Mode', title: 'Game night,|*one phone*', line: '11 party games. No sign-up.', art: '/party/impostor/tile.webp', accent: '#ff4fc8', cta: 'glitchboundstudio.com/party' });
  ST('stories/announcements/halloween.png', { kind: 'announce', eyebrow: 'Halloween', title: 'Spooky mode|*is on*', line: 'Cobwebs on every card. Spooky tunes in Quizbelief', dark: true, accent: '#ff7a1a' });
  ST('stories/announcements/winter.png', { kind: 'announce', eyebrow: 'Winter look', title: 'It\u2019s *snowing*|on GlitchBound', line: 'Cozy up with a puzzle or three.', accent: '#7fd7ff' });
  ST('stories/announcements/new-game.png', { kind: 'announce', eyebrow: 'New game', title: 'Whatsit', line: 'A secret thing in a box. Ask yes/no questions, then pick it from the line-up.', art: G.whatsit.art.tile, accent: '#ff8a1f' });
  const hl = [['games', '#2ad1f0'], ['daily', '#ff6a1a'], ['party', '#ff4fc8'], ['new', '#b6e62c'], ['tips', '#ffc928'], ['wins', '#7b4dff'], ['halloween', '#1d1238'], ['winter', '#7fd7ff']];
  for (const [id, bg] of hl) J.push({ tpl: 'story', out: `stories/highlight-covers/${id}.png`, w: 1080, h: 1920, data: { kind: 'highlight', bg, icon: ICON[id] } });

  // Blank templates for quick edits in Canva / CapCut.
  P('post-templates/blank/post-4x5-blank.png', { kind: 'blank' });
  P('post-templates/blank/post-4x5-blank-dark.png', { kind: 'blank', dark: true });
  P('post-templates/blank/post-square-blank.png', { kind: 'blank' }, 1080, 1080);
  ST('post-templates/blank/story-blank.png', { kind: 'blank' });
  ST('post-templates/blank/story-blank-dark.png', { kind: 'blank', dark: true });

  // YouTube thumbnails.
  const TH = (out, data) => J.push({ tpl: 'thumb', out: `thumbnails/youtube/${out}`, w: 1280, h: 720, data });
  TH('01-official-trailer.png', { title: '19 FREE|games.|*Zero* downloads.', bg: C_BG(0), size: 104 });
  TH('02-all-19-games-tour.png', { title: 'ALL 19|games in|*one tour*', bg: C_BG(1), art: G.gloop.art.tile, shot: shot('wing-it', 50), size: 110 });
  TH('03-party-impostor.png', { title: 'Who\u2019s the|*IMPOSTOR?*', bg: '#ff4fc8', art: '/party/impostor/tile.webp', size: 120, tag: 'One phone' });
  TH('04-arcade-tour.png', { title: 'Hover = *it plays*', bg: C_BG(3), art: G['neon-rush'].art.tile, size: 120 });
  const shotAt = { 'wing-it': ['biome', 2, 1.5], gloop: ['end', 0, -4], 'neon-rush': ['crash', 0, -6], 'color-lab': ['won', 0, 0.3], 'mini-racer': ['finish', 0, -12], 'square-deal': ['clear', -1, 0.2], 'spot-the-glitch': ['found', 4, 0.6], 'outta-here': ['cleared', 2, -4], 'letter-pinch': ['solved', 0, 0.6], 'wheres-the-ball': ['found', 0, 0.5], 'memory-grid': ['miss', 0, -3], crosswire: ['mystery', 0, 0.6], 'gut-check': ['miss', 0, -2], 'star-grid': ['solved', 0, 0.6], 'color-recall': ['reveal', 0, 0.8], 'to-scale': ['lock', 0, 1.0], 'wait-what': ['answer', 0, 1.0], fussbox: ['handin', 0, 1.6], whatsit: ['pick', 0, 1.0] };
  const words = { 'wing-it': 'Made it to|*SPACE*', gloop: 'So *satisfying*', 'neon-rush': '*Endless* neon racer', 'color-lab': 'Sort the *colors*', 'mini-racer': 'Tiny car.|*Big drifts.*', 'square-deal': 'Chain the *clears*', 'spot-the-glitch': 'Find *5* glitches', 'outta-here': 'Arrows *OUT*', 'letter-pinch': 'Not *that* word game', 'wheres-the-ball': 'Where\u2019s the *ball?*', 'memory-grid': 'How long is *your* memory?', crosswire: 'Crack the *mystery* word', 'gut-check': '*Higher* or lower?', 'star-grid': 'One star per *row*', 'color-recall': 'Color *memory* test', 'to-scale': 'How *big* is it?', 'wait-what': 'Sounds *fake*. Isn\u2019t.', fussbox: 'Read a robot\u2019s *mind*', whatsit: 'What\u2019s in the *box?*' };
  order.forEach((slug, i) => TH(`gameplay/${slug}.png`, { title: words[slug], bg: C_BG(i), art: G[slug].art.tile, shot: shot(slug, shotAt[slug]), size: 100, tag: G[slug].title }));
}

function C_BG(i) {
  return ['#2ad1f0', '#ffc928', '#b6e62c', '#ff4fc8', '#ff6a1a', '#12c6b3', '#7fd7ff'][i % 7];
}
