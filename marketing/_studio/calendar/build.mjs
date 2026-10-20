// Builds the posting calendar (Oct 21 - Dec 31, 2026) from the rendered slate: one short a day for
// TikTok / Reels / Shorts, three feed posts a week, a story every day and two YouTube uploads a week,
// with seasonal pieces pinned to their dates. Writes calendar/CONTENT_CALENDAR.md, calendar.csv and
// captions for every asset (calendar/captions.md).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKETING, STUDIO } from '../lib/site.mjs';
import { allSpecs } from '../video/plan.mjs';
import { GAMES } from '../video/copy.mjs';

const OUT = join(MARKETING, 'calendar');
mkdirSync(OUT, { recursive: true });
const catalog = JSON.parse(readFileSync(join(STUDIO, '.cache/content/catalog.json'), 'utf8'));
const G = Object.fromEntries(catalog.games.map((g) => [g.slug, g]));
const specs = allSpecs();
const byId = Object.fromEntries(specs.map((s) => [s.id, s]));
const SITE = 'glitchboundstudio.com';

// ---- Captions ---------------------------------------------------------------------------------------
const tag = (s) => `#${s.replace(/[^a-z0-9]/gi, '')}`;
const BASE = ['#browsergames', '#freegames', '#indiegame'];
const catTags = { puzzle: '#puzzlegame', word: '#wordgame', racing: '#racinggame', arcade: '#arcadegame', trivia: '#trivia', strategy: '#logicpuzzle', party: '#partygames' };
const plain = (s) => String(s).replace(/\*/g, '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

function shortCaption(s) {
  const g = s.game ? G[s.game] : null;
  const c = s.game ? GAMES[s.game] : null;
  const gameTags = g ? [tag(g.title.toLowerCase().replace(/[^a-z]/g, '')), ...g.categories.map((x) => catTags[x]).filter(Boolean)] : [];
  switch (s.kind) {
    case 'spotlight':
      return { title: `${g.title}: ${plain(c.hooks[0])}`, text: `${plain(c.hooks[0])} 👀\n\n${g.tagline}\n\nFree in your browser. No download, no sign-up. Play it: link in bio 🎮`, tags: [...gameTags, ...BASE, '#gaming'] };
    case 'challenge':
      return { title: `Beat my ${g.title} score`, text: `${plain(c.challenge.score)}. Your turn 😤\n\nPost your best in the comments. ${g.title} is free at ${SITE} (link in bio).`, tags: [...gameTags, '#challenge', ...BASE] };
    case 'spot':
      return { title: 'Spot the Glitch: can you find all 5?', text: 'Two pictures, five differences, ten seconds ⏱️\n\nHow many did you get? Comment your number 👇\n\nNew pictures every day in Spot the Glitch (free, link in bio).', tags: ['#spotthedifference', '#puzzle', '#brainteaser', '#spottheglitch', ...BASE] };
    case 'ball':
      return { title: "Where's the ball? 5 seconds", text: 'There’s a tennis ball hiding in this photo 🎾\n\nDid you find it before the timer? Be honest 👇\n\nA new one hides every day: Where’s the Ball? (free, link in bio).', tags: ['#findit', '#eyetest', '#puzzle', '#wherestheball', ...BASE] };
    case 'trivia':
      return { title: 'Trivia that sounds made up (but isn’t)', text: `${s.data.questions.length} weird questions, 5 seconds each 🧠\n\nComment your score: ${s.data.questions.length}/${s.data.questions.length} = genius.\n\n10 new questions every day in Quizbelief (free, link in bio).`, tags: ['#trivia', '#quiz', '#funfacts', '#quizbelief', ...BASE] };
    case 'gut':
      return { title: `Higher or lower? ${s.data.question}`, text: `${s.data.question} Trust your gut 👇\n\nHow many did you get in a row? Comment your streak.\n\nPlay Gut Check free: link in bio.`, tags: ['#higherorlower', '#quiz', '#guesswho', '#gutcheck', ...BASE] };
    case 'trailer':
      return { title: '19 free games. Zero downloads.', text: '19 games. Zero downloads. Zero sign-ups. Just play 🎮\n\nPuzzles, racers, word games, party games, new dailies every midnight.\n\nglitchboundstudio.com (link in bio)', tags: ['#browsergames', '#freegames', '#indiegame', '#gaming', '#newgame'] };
    case 'pov':
      return { title: plain(s.data.meme), text: `${plain(s.data.meme)} 😭\n\n${g.title} is free in your browser: link in bio.`, tags: ['#relatable', '#gamingmemes', ...gameTags, ...BASE] };
    case 'party':
      return { title: 'Impostor: game night with one phone', text: 'Everyone gets the secret word. Except one 🕵️\n\nSay one word each, then vote out the faker. Pass one phone, no sign-up.\n\nTag your game night crew 👇 Party Mode: link in bio.', tags: ['#partygames', '#gamenight', '#impostor', '#friends', ...BASE] };
    case 'compilation':
    case 'tour':
      return { title: plain(s.data.hook?.text ?? 'GlitchBound'), text: `${plain(s.data.hook?.text ?? '')} ✨\n\nAll free in your browser at ${SITE} (link in bio).`, tags: ['#oddlysatisfying', ...BASE, '#gaming'] };
    case 'seasonal':
    {
      const h = plain(typeof s.data.hook === 'string' ? s.data.hook : s.data.hook?.text ?? 'Seasonal special');
      const t = /halloween|spooky|witch/i.test(s.id + h) ? ['#halloween', '#spooky'] : /winter|snow/i.test(s.id) ? ['#winter', '#cozygames'] : /diwali/i.test(s.id) ? ['#diwali', '#happydiwali'] : ['#seasonal'];
      return { title: h, text: `${h} 🎉\n\nFree at ${SITE} (link in bio).`, tags: [...t, ...BASE, '#gaming'] };
    }
    default:
      return { title: s.id, text: `Free at ${SITE}`, tags: BASE };
  }
}

function ytMeta(s) {
  const g = s.game ? G[s.game] : null;
  if (s.id === 'yt-trailer') return { title: 'GlitchBound: Official Trailer | 19 Free Browser Games, No Download', desc: 'Small games. Big obsessions.\n\n19 free games you can play in your browser right now: puzzles, racers, word games, trivia and a party mode for game night. No download, no sign-up, new daily puzzles every midnight.\n\nPlay: https://glitchboundstudio.com\n\nMusic: original GlitchBound soundtrack.', tags: 'browser games, free games, no download games, puzzle games, indie games, daily puzzle, party games' };
  if (s.id === 'yt-all-games') return { title: 'All 19 GlitchBound Games: Gameplay Tour (Free, In Your Browser)', desc: `A tour of every game in the GlitchBound arcade, real gameplay recorded in the browser.\n\n${specs.find((x) => x.id === 'yt-all-games').data.segments.map((seg, i) => `${seg.title}: ${seg.tagline}`).join('\n')}\n\nPlay free: https://glitchboundstudio.com`, tags: 'browser games, free online games, puzzle games, word games, racing games, trivia, gameplay' };
  if (s.id === 'yt-party-impostor') return { title: 'Impostor: How to Play on One Phone (Free Party Game)', desc: 'Everyone gets the secret word, except the impostor. Say one word each, then vote out the faker.\n\nPlay on one phone or everyone on their own: https://glitchboundstudio.com/party\n\n11 free party games, no sign-up.', tags: 'party games, impostor game, game night, one phone games, free party games' };
  if (s.id === 'yt-desktop-tour') return { title: 'Hover a Tile, Watch the Game Play: GlitchBound Arcade Tour', desc: 'Every tile in the GlitchBound arcade plays a live preview of its game. A quick tour of the lobby.\n\nhttps://glitchboundstudio.com', tags: 'browser arcade, free games, web games' };
  return { title: `${g.title} Gameplay: ${plain(GAMES[s.game].hooks[0])} | Free Browser Game`, desc: `${g.tagline}\n\n${g.description ?? ''}\n\nPlay ${g.title} free, no download: https://glitchboundstudio.com/games/${s.game}\n\nReal gameplay, recorded in the browser. More games: https://glitchboundstudio.com`, tags: `${g.title}, browser game, free game, ${g.categories.join(' game, ')} game, no download` };
}

// ---- Assets for the auto-poster ---------------------------------------------------------------------
// Instagram's API takes JPEG only: every PNG post / story gets a .jpg twin (sRGB, quality ~90).
const jpg = (png) => {
  if (!png.endsWith('.png')) return png;
  const src = join(MARKETING, png);
  const out = src.replace(/\.png$/, '.jpg');
  if (existsSync(src) && (!existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs)) {
    execFileSync('/opt/homebrew/bin/ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-pix_fmt', 'yuvj444p', '-q:v', '2', out]);
  }
  return png.replace(/\.png$/, '.jpg');
};
/** The exact files of a feed item (a folder or a name-* pattern), in posting order, as .jpg. */
function feedFiles(f) {
  if (f.endsWith('/')) return readdirSync(join(MARKETING, f)).filter((x) => x.endsWith('.png')).sort().map((x) => jpg(f + x));
  if (f.endsWith('*')) {
    const dir = f.slice(0, f.lastIndexOf('/') + 1);
    const pre = f.slice(dir.length, -1);
    return readdirSync(join(MARKETING, dir)).filter((x) => x.startsWith(pre) && x.endsWith('.png')).sort().map((x) => jpg(dir + x));
  }
  return [jpg(f)];
}
const POLL = { 'wing-it-vs-gloop': ['Team which?', 'Wing It', 'Gloop'], 'letter-pinch-vs-crosswire': ['Which one tonight?', 'Letter Pinch', 'Crosswire'], 'neon-rush-vs-mini-racer': ['Team which?', 'NEON RUSH', 'Mini Racer'], 'color-lab-vs-square-deal': ['Which one tonight?', 'Color Lab', 'Square Deal'], 'spot-the-glitch-vs-wheres-the-ball': ['Team which?', 'Spot the Glitch', 'Where’s the Ball?'], 'fussbox-vs-whatsit': ['Which one tonight?', 'Fussbox', 'Whatsit'] };
function pollText(path) {
  const key = Object.keys(POLL).find((k) => path.includes(k));
  const [q, a, b] = POLL[key];
  return `Poll sticker. Question: ${q} | Option 1: ${a} | Option 2: ${b}`;
}
const ytThumb = (s) => {
  const base = s.id === 'yt-trailer' ? '01-official-trailer' : s.id === 'yt-all-games' ? '02-all-19-games-tour' : s.id === 'yt-party-impostor' ? '03-party-impostor' : s.id === 'yt-desktop-tour' ? '04-arcade-tour' : `gameplay/${s.game}`;
  return jpg(`thumbnails/youtube/${base}.png`);
};

// ---- The schedule -----------------------------------------------------------------------------------
const start = new Date('2026-10-21T12:00:00Z');
const end = new Date('2026-12-31T12:00:00Z');
const days = [];
for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
const dow = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 Sun

// Pinned shorts.
const pinned = {
  '2026-10-21': 'trailer-vertical',
  '2026-10-23': 'halloween-lobby',
  '2026-10-28': 'halloween-witch',
  '2026-10-31': 'halloween-trivia',
  '2026-11-08': 'diwali-lobby',
  '2026-12-01': 'winter-lobby',
  '2026-12-25': 'party-impostor-3',
  '2026-12-31': 'trailer-teaser',
};
const pool = (kind) => specs.filter((s) => s.kind === kind && !Object.values(pinned).includes(s.id) && !s.id.startsWith('yt-'));
const queues = {
  spotlight: pool('spotlight'), challenge: pool('challenge'), spot: pool('spot'), ball: pool('ball'), trivia: pool('trivia'), gut: pool('gut'),
  pov: pool('pov'), party: pool('party'), extra: [...pool('trailer'), ...pool('compilation'), ...pool('tour')],
};
// Weekly rhythm (by weekday): Sun extra/pov, Mon spotlight, Tue trivia, Wed spotlight, Thu spot, Fri challenge, Sat ball/gut/party.
const rhythm = { 0: ['pov', 'extra', 'party'], 1: ['spotlight'], 2: ['trivia', 'gut'], 3: ['spotlight', 'pov'], 4: ['spot'], 5: ['challenge', 'spotlight'], 6: ['ball', 'party', 'gut'] };
const take = (kinds) => {
  for (const k of kinds) if (queues[k].length) return queues[k].shift();
  for (const k of Object.keys(queues)) if (queues[k].length) return queues[k].shift();
  return null;
};

// Feed posts (Mon/Wed/Fri) and pinned holiday posts.
const feedPinned = { '2026-10-30': 'posts/09-holidays/halloween.png', '2026-11-08': 'posts/09-holidays/diwali.png', '2026-11-26': 'posts/09-holidays/thanksgiving.png', '2026-11-27': 'posts/09-holidays/black-friday.png', '2026-12-02': 'posts/09-holidays/winter.png', '2026-12-24': 'posts/09-holidays/christmas.png', '2026-12-31': 'posts/09-holidays/new-year.png' };
const feedQueue = [
  ...[1, 2, 3].map((n) => ({ file: `posts/02-carousel-19-free-games/part-${n}/`, label: `Carousel: 19 free games, part ${n} of 3`, caption: `${n === 1 ? '19 free games you can play in your browser right now 🎮' : n === 2 ? '19 free games, part 2 🎮' : '19 free games: the finale 🎮'} Swipe through, then tell us which one is your obsession 👇\n\nNo download. No sign-up. Link in bio.` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({ file: `posts/04-trivia-carousels/trivia-${String(n).padStart(2, '0')}-*`, label: `Trivia carousel #${n} (question + answer)`, caption: 'Wait, what? 🤯 Guess before you swipe. Answer on the next slide.\n\n10 new weird questions every day in Quizbelief (link in bio).' })),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ file: `posts/05-spot-the-glitch-puzzles/spot-${String(n).padStart(2, '0')}-*`, label: `Spot the Glitch carousel #${n}`, caption: 'Find all 5 differences 🔍 Answers on the next slide. How many did you get?\n\nNew pictures every day: Spot the Glitch, link in bio.' })),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ file: `posts/06-wheres-the-ball-puzzles/ball-${String(n).padStart(2, '0')}-*`, label: `Where's the Ball? carousel #${n}`, caption: 'There’s a tennis ball in this photo 🎾 Find it, then swipe.\n\nA new one hides every day: Where’s the Ball? (link in bio).' })),
  ...Object.keys(GAMES).map((slug) => ({ file: `posts/01-game-cards/${slug}.png`, label: `Game card: ${G[slug].title}`, caption: `${G[slug].title}: ${G[slug].tagline}\n\nFree in your browser, no download. Link in bio 🎮` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ file: `posts/07-quotes/quote-${String(n).padStart(2, '0')}.png`, label: `Quote post #${n}`, caption: 'Small games. Big obsessions. 💛 glitchboundstudio.com' })),
  ...[1, 2].map((n) => ({ file: `posts/03-carousel-party-mode/part-${n}/`, label: `Carousel: Party Mode, part ${n} of 2`, caption: `${n === 1 ? 'Game night? One phone is enough 📱' : 'More party games, still one phone 📱'} Swipe through, then tag your crew 👇\n\nParty Mode: glitchboundstudio.com/party` })),
  ...['fussbox', 'whatsit', 'star-grid', 'gut-check', 'gloop', 'outta-here'].map((slug) => ({ file: `posts/08-new-game-drops/${slug}.png`, label: `Game drop: ${G[slug].title}`, caption: `Have you tried ${G[slug].title} yet? ${G[slug].tagline}\n\nFree, link in bio ✨` })),
];
// Interleave feed kinds so the grid alternates: carousel, game card, trivia, quote...
const fq = (() => {
  const groups = { carousel: feedQueue.filter((f) => f.file.endsWith('/')), card: feedQueue.filter((f) => f.file.includes('01-game-cards')), trivia: feedQueue.filter((f) => f.file.includes('04-trivia')), spot: feedQueue.filter((f) => f.file.includes('05-spot')), ball: feedQueue.filter((f) => f.file.includes('06-wheres')), quote: feedQueue.filter((f) => f.file.includes('07-quotes')), drop: feedQueue.filter((f) => f.file.includes('08-new')) };
  const order = ['carousel', 'card', 'trivia', 'quote', 'spot', 'card', 'ball', 'drop', 'trivia', 'card'];
  const out = [];
  for (let i = 0; out.length < feedQueue.length && i < 400; i++) {
    const g = groups[order[i % order.length]];
    if (g.length) out.push(g.shift());
  }
  return out;
})();

// Stories: rotate daily reminders, polls on weekends, score brags on Fridays.
const dailyStories = Object.keys(GAMES).filter((s) => G[s].daily).map((s) => `stories/daily-reminders/${s}.png`);
const polls = ['wing-it-vs-gloop', 'letter-pinch-vs-crosswire', 'neon-rush-vs-mini-racer', 'color-lab-vs-square-deal', 'spot-the-glitch-vs-wheres-the-ball', 'fussbox-vs-whatsit'].map((p, i) => `stories/polls/poll-${String(i + 1).padStart(2, '0')}-${p}.png`);
const brags = ['wing-it', 'gloop', 'gut-check', 'letter-pinch', 'memory-grid', 'color-recall'].map((s) => `stories/beat-my-score/${s}.png`);
const storyPinned = { '2026-10-21': 'stories/announcements/new-dailies.png', '2026-10-24': 'stories/announcements/halloween.png', '2026-10-31': 'stories/announcements/halloween.png', '2026-11-14': 'stories/announcements/party-mode.png', '2026-12-01': 'stories/announcements/winter.png', '2026-12-19': 'stories/announcements/party-mode.png', '2026-10-27': 'stories/announcements/new-game.png' };

// YouTube long-form: Tue + Sat.
const ytQueue = ['yt-trailer', 'yt-all-games', 'yt-game-wing-it', 'yt-game-gloop', 'yt-party-impostor', 'yt-game-neon-rush', 'yt-game-color-lab', 'yt-game-mini-racer', 'yt-desktop-tour', 'yt-game-spot-the-glitch', 'yt-game-letter-pinch', 'yt-game-square-deal', 'yt-game-crosswire', 'yt-game-outta-here', 'yt-game-wheres-the-ball', 'yt-game-memory-grid', 'yt-game-gut-check', 'yt-game-star-grid', 'yt-game-color-recall', 'yt-game-to-scale', 'yt-game-wait-what', 'yt-game-fussbox', 'yt-game-whatsit'];

const rows = [];
const md = [];
let si = 0, pi = 0, bi = 0;
let week = -1;
for (const day of days) {
  const w = dow(day);
  const d = new Date(`${day}T12:00:00Z`);
  const wk = Math.floor((d - start) / (7 * 86400000));
  if (wk !== week) {
    week = wk;
    md.push(`\n## Week ${wk + 1} (from ${day})\n\n| Date | Short (TikTok + Reels + Shorts) | Instagram feed | Story | YouTube |\n|---|---|---|---|---|`);
  }
  const shortId = pinned[day] ?? take(rhythm[w])?.id;
  const s = byId[shortId];
  const cap = s ? shortCaption(s) : null;
  // Weekends get a second short from what is left.
  const extra = (w === 0 || w === 6) && !pinned[day] ? take(w === 0 ? ['gut', 'pov', 'extra'] : ['party', 'spotlight', 'ball']) : null;
  const feed = feedPinned[day] ? { file: feedPinned[day], label: 'Holiday post', caption: 'From all of us at GlitchBound 💛 glitchboundstudio.com' } : [1, 3, 5].includes(w) ? fq.shift() : null;
  let story = storyPinned[day];
  if (!story) story = w === 6 ? polls[pi++ % polls.length] : w === 5 ? brags[bi++ % brags.length] : dailyStories[si++ % dailyStories.length];
  const yt = [2, 6].includes(w) ? ytQueue.shift() : null;
  const ys = yt ? byId[yt] : null;
  const ym = ys ? ytMeta(ys) : null;
  const when = (t) => `${day} ${t}`;
  if (s) rows.push({ date: day, time: '18:00', platform: 'TikTok + Instagram Reels + YouTube Shorts', type: s.kind, asset: s.out, title: cap.title, caption: `${cap.text}\n\n${cap.tags.join(' ')}`, tags: cap.tags.map((t) => t.slice(1)).join(',') });
  if (extra) {
    const c2 = shortCaption(extra);
    rows.push({ date: day, time: '12:00', platform: 'TikTok + Instagram Reels + YouTube Shorts', type: extra.kind, asset: extra.out, title: c2.title, caption: `${c2.text}\n\n${c2.tags.join(' ')}`, tags: c2.tags.map((t) => t.slice(1)).join(',') });
  }
  if (feed) rows.push({ date: day, time: '12:30', platform: 'Instagram feed + Facebook', type: feedFiles(feed.file).length > 1 ? 'carousel' : 'post', asset: feedFiles(feed.file).join('|'), title: feed.label, caption: `${feed.caption}\n\n#browsergames #freegames #indiegame`, tags: 'browsergames,freegames,indiegame' });
  const poll = story.includes('/polls/') ? pollText(story) : null;
  rows.push({ date: day, time: '09:00', platform: 'Instagram + Facebook Story', type: 'story', asset: jpg(story), title: poll ? 'Story poll' : 'Story', caption: poll ?? 'No sticker needed: the image shows glitchboundstudio.com. Optional: add a link sticker to https://glitchboundstudio.com', needs_touch: poll ? 'yes' : 'no' });
  if (ys) rows.push({ date: day, time: '16:00', platform: 'YouTube', type: 'youtube', asset: ys.out, title: ym.title, caption: ym.desc, tags: ym.tags, thumbnail: ytThumb(ys) });
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const cell = (x) => (x ? `\`${x.replace(/^videos\/|^posts\/|^stories\//, '')}\`` : '');
  const esc = (x) => String(x).replace(/\|/g, '\\|');
  md.push(`| ${dayName} | ${s ? `${cell(s.out)}<br>${esc(cap.title)}` : ''}${extra ? `<br>+ ${cell(extra.out)}` : ''} | ${feed ? `${esc(feed.label)}` : ''} | ${cell(story)} | ${ys ? `${cell(ys.out)}<br>${esc(ym.title)}` : ''} |`);
}

// ---- Write -------------------------------------------------------------------------------------------
const TZ = 'America/New_York';
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
writeFileSync(join(OUT, 'calendar.csv'), ['date,time,platform,type,asset,title,caption,tags,thumbnail,needs_touch,timezone', ...rows.map((r) => [r.date, r.time, r.platform, r.type, r.asset, r.title, r.caption, r.tags ?? '', r.thumbnail ?? '', r.needs_touch ?? 'no', TZ].map(csvCell).join(','))].join('\n'));
const missing = rows.flatMap((r) => [...r.asset.split('|'), r.thumbnail].filter(Boolean)).filter((f) => !existsSync(join(MARKETING, f)));
if (missing.length) console.warn(`${missing.length} calendar assets don't exist yet, e.g.`, missing.slice(0, 5));
const left = Object.values(queues).flat();
writeFileSync(join(OUT, 'CONTENT_CALENDAR.md'), `# GlitchBound content calendar: Oct 21 - Dec 31, 2026

Ten weeks of posts built from the files in this folder. Every short is 1080x1920 and goes to **TikTok, Instagram Reels and YouTube Shorts** (same file, same day).

**Time zone: US Eastern (America/New_York).** All times below and in \`calendar.csv\` are Eastern; change \`TZ\` in \`_studio/calendar/build.mjs\` and rebuild if you pick another. Adjust once you have a few weeks of analytics.

**Rhythm**
- **Shorts:** one a day at 18:00, a second one at 12:00 on weekends. Mon spotlight · Tue trivia · Wed spotlight or meme · Thu Spot the Glitch · Fri beat-my-score · Sat Where's the Ball / party · Sun meme or compilation.
- **Instagram / Facebook feed:** Mon, Wed, Fri at 12:30 (carousels, game cards, puzzles, quotes), plus holiday posts on the day.
- **Stories:** every morning at 09:00: a daily-puzzle reminder with a link sticker, a poll on Saturdays, a score brag on Fridays.
- **YouTube long-form:** Tue and Sat at 16:00.
- **Pinned moments:** launch trailer (Oct 21), Halloween (Oct 23, 28, 30, 31), Diwali (Nov 8), Thanksgiving (Nov 26), Black Friday (Nov 27), winter look (Dec 1-2), Christmas (Dec 24-25), New Year's Eve (Dec 31).

Captions and hashtags for every slot are in \`calendar.csv\` (imports into Buffer, Later, Metricool or a spreadsheet) and in \`captions.md\`.
${md.join('\n')}

## Spare content (not scheduled)

${left.length ? left.map((s) => `- \`${s.out}\``).join('\n') : '- none'}
- Unused feed posts: ${fq.length}
- YouTube videos still in the queue: ${ytQueue.map((id) => `\`${byId[id].out}\``).join(', ') || 'none'}
`);
const capMd = ['# Captions for every short and YouTube video', '', 'Copy-paste ready. Emoji are fine in captions (the platform draws them); the videos themselves have none baked in.', ''];
for (const s of specs) {
  if (s.id.startsWith('yt-')) {
    const m = ytMeta(s);
    capMd.push(`## ${s.out}`, '', `**Title:** ${m.title}`, '', '**Description:**', '', '```', m.desc, '```', '', `**Tags:** ${m.tags}`, '');
  } else {
    const c = shortCaption(s);
    capMd.push(`## ${s.out}`, '', `**Title / first line:** ${c.title}`, '', '```', `${c.text}\n\n${c.tags.join(' ')}`, '```', '');
  }
}
writeFileSync(join(OUT, 'captions.md'), capMd.join('\n'));
console.log(`${days.length} days, ${rows.length} scheduled items, ${left.length} spare shorts, ${fq.length} spare feed posts, ${ytQueue.length} YouTube left`);
