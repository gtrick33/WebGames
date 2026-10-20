// The full video slate: ~80 vertical shorts (TikTok / Reels / YouTube Shorts) and ~23 horizontal
// YouTube videos, built from the copy in copy.mjs, the extracted game content and the recorded takes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STUDIO } from '../lib/site.mjs';
import { GAMES, PARTY } from './copy.mjs';
import * as M from './marks.mjs';

const read = (f) => JSON.parse(readFileSync(join(STUDIO, '.cache/content', f), 'utf8'));
const V = { w: 1080, h: 1920 };
const HZ = { w: 1920, h: 1080 };
const pad = (n) => String(n).padStart(2, '0');
const takeSeconds = (slug, take) => JSON.parse(readFileSync(join(STUDIO, '.cache/footage', slug, `${take}.json`), 'utf8')).seconds;

/** A Quizbelief question by its id in the game's bank (`history:9`). */
let bank;
export function question(id) {
  bank ??= Object.fromEntries(read('trivia.json').map((q) => [q.id, q]));
  const q = bank[id];
  if (!q) throw new Error(`no Quizbelief question ${id} in .cache/content/trivia.json (re-run content/extract.mjs)`);
  return q;
}

/** Higher-or-lower pairs from one Gut Check topic, each pair clearly apart like the game requires. */
export function gutPairs(cat, n, seed) {
  let s = seed;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const items = cat.items;
  const pairs = [];
  let a = items[Math.floor(r() * items.length)];
  const used = new Set([a.name]);
  for (let k = 0; k < n; k++) {
    let b = null;
    for (let tries = 0; tries < 400 && !b; tries++) {
      const c = items[Math.floor(r() * items.length)];
      if (used.has(c.name)) continue;
      const hi = Math.max(a.value, c.value), lo = Math.min(a.value, c.value);
      if (cat.years ? Math.abs(a.value - c.value) >= 10 : lo > 0 && hi / lo >= 1.25) b = c;
    }
    if (!b) break;
    used.add(b.name);
    pairs.push({ a, b, more: b.value > a.value, moreWord: cat.more, lessWord: cat.less });
    a = b;
  }
  return pairs;
}

/**
 * Caption bubbles from [text, at] pairs. `at` is seconds of the finished video or a mark in the
 * source take (resolved through the cut with `src`: { clips, slug, take }); text may hold {mark.field}.
 */
const caps = (list, end, y = 470, src = null, minAt = 0) => {
  const items = list.map(([text, at]) => ({
    text: src ? M.fill(text, src.slug, src.take) : text,
    at: Array.isArray(at) ? M.outputTime(src.clips, src.slug, src.take, at) : at,
  })).filter((c) => c.at !== null && c.at < end - 0.5).map((c) => ({ ...c, at: Math.max(c.at, minAt) })).sort((a, b) => a.at - b.at)
    // Two captions too close together: keep the later (more specific) one.
    .filter((c, i, list) => !list[i + 1] || list[i + 1].at - c.at >= 1.2);
  return items.map((c, i) => ({ text: c.text, at: c.at, dur: Math.max(1.2, Math.min(2.6, (items[i + 1]?.at ?? end) - c.at - 0.15)), y, size: 64, rot: i % 2 ? 1.5 : -1.5, sfx: 'pop' }));
};

export function allSpecs() {
  const cat = read('catalog.json');
  const arcade = cat.games.filter((g) => !g.partyOnly);
  const G = Object.fromEntries(cat.games.map((g) => [g.slug, g]));
  const S = [];

  // ---- 1. Spotlights: one per game ----------------------------------------------------------
  for (const [slug, c] of Object.entries(GAMES)) {
    const clips = M.clips(c.clips.map((x) => ({ slug, take: 'a', ...x })));
    const body = clips.reduce((s, x) => s + (x.to - x.from) / (x.speed ?? 1), 0);
    const src = { clips, slug, take: 'a' };
    S.push({
      id: `spotlight-${slug}`, out: `videos/shorts/01-game-spotlights/${slug}.mp4`, format: 'reel', ...V, kind: 'spotlight', game: slug,
      music: { track: c.music, start: 0 },
      data: {
        layout: c.layout ?? 'full', ...c.frame, clips,
        hook: { text: c.hooks[0], eyebrow: G[slug].title, eyeColor: c.color, dur: 2.5, y: c.hookY },
        captions: caps(c.captions, body - 0.4, c.captionY ?? 470, src, 2.6),
        stickers: (c.stickers ?? []).map(([text, at, bg]) => ({ text: M.fill(text, slug, 'a'), at: Array.isArray(at) ? M.outputTime(clips, slug, 'a', at) : at, dur: 2.6, x: 760, y: 1240, size: 66, bg, rot: 7 })).filter((x) => x.at !== null),
        outro: { title: c.outro, line: `${G[slug].title} is free in your browser. No download, no sign-up.`, art: G[slug].art.tile },
      },
    });
  }

  // ---- 2. Beat my score: the second takes, sped up, with a meme bar --------------------------
  for (const [slug, c] of Object.entries(GAMES)) {
    if (!c.challenge) continue;
    const ch = c.challenge;
    const [cl] = M.clips([{ slug, take: ch.take, from: ch.from, to: ch.to, speed: ch.speed }]);
    // Keep these short: at most ~32 s of gameplay (the end of the run, where the score is).
    if ((cl.to - cl.from) / ch.speed > 32) cl.from = +(cl.to - 32 * ch.speed).toFixed(3);
    S.push({
      id: `challenge-${slug}`, out: `videos/shorts/02-beat-my-score/${slug}-beat-my-score.mp4`, format: 'reel', ...V, kind: 'challenge', game: slug,
      music: { track: c.music, start: 8 },
      data: {
        layout: 'meme', memeH: 520, memeSize: 66, cropY: 0.35,
        meme: `${G[slug].title}. ${M.fill(ch.score, slug, ch.take)}|Your turn: *link in bio*`,
        clips: [cl],
        outro: { title: 'Your turn.', line: `Play ${G[slug].title} free at glitchboundstudio.com`, art: G[slug].art.tile },
      },
    });
  }

  // ---- 3. Spot the Glitch challenges ------------------------------------------------------------
  const spots = read('spot.json');
  const spotHooks = ['Can you find *all 5*?', 'Find the glitches *in 10 seconds*', 'Most people miss *one*', 'Your eyes vs. *this picture*', 'Spot all 5 *before the timer*'];
  const spotPick = [0, 2, 4, 6, 8, 13, 15, 17, 19, 22, 10, 12, 18, 20, 23, 25];
  spotPick.forEach((i, n) => S.push({
    id: `spot-${pad(n + 1)}`, out: `videos/shorts/03-spot-the-glitch/spot-the-glitch-${pad(n + 1)}-${spots[i].theme}.mp4`, format: 'spot', ...V, kind: 'spot', game: 'spot-the-glitch',
    music: { track: 'tick-tock', start: [0, 16, 32][n % 3] },
    data: { puzzle: spots[i], hook: n === 2 ? 'Five changes. *Can you see them all?*' : spotHooks[n % spotHooks.length], seconds: i >= 13 ? 12 : 10, title: i >= 13 ? 'Harder one: find *all 5*' : 'Find all *5* differences' },
  }));

  // ---- 4. Where's the Ball? -----------------------------------------------------------------------
  const balls = read('ball.json').filter((b) => !b.error);
  const ballHooks = ['Find the *tennis ball* in 5 seconds', 'There’s a tennis ball *somewhere*', 'Eagle eyes only: *find the ball*', 'I bet you *can’t* find it in 5'];
  [1, 4, 7, 10, 13, 16, 19, 22, 2, 8, 14, 20].forEach((i, n) => {
    const b = balls[i % balls.length];
    S.push({
      id: `ball-${pad(n + 1)}`, out: `videos/shorts/04-wheres-the-ball/wheres-the-ball-${pad(n + 1)}.mp4`, format: 'ball', ...V, kind: 'ball', game: 'wheres-the-ball',
      music: { track: 'tick-tock', start: [16, 32, 48][n % 3] },
      data: { level: b, title: ballHooks[n % ballHooks.length], seconds: 5 },
    });
  });

  // ---- 5. Quizbelief trivia -------------------------------------------------------------------
  // Hand-picked from the game's bank (ids are its own `cat:index`, see content/extract.mjs): only
  // questions whose answer makes people say "wait, what?", no pub-quiz filler. Each video mixes three
  // categories and saves the strangest for last.
  const triviaPicks = [
    ['animals:4', 'history:9', 'space:47'], ['food:3', 'animals:25', 'history:41'], ['tech:1', 'geo:3', 'history:26'],
    ['animals:43', 'science:74', 'history:24'], ['pop:82', 'geo:6', 'animals:91'], ['food:45', 'space:1', 'sports:31'],
    ['tech:22', 'animals:110', 'history:141'], ['words:70', 'food:16', 'geo:97'], ['sports:17', 'animals:30', 'money:63'],
    ['food:27', 'science:70', 'history:154'], ['pop:79', 'space:2', 'money:59'], ['tech:38', 'geo:88', 'history:145'],
    ['animals:123', 'history:6', 'sports:36'], ['words:100', 'space:93', 'tech:84'],
  ];
  const triviaHooks = ['3 weird questions. *5 seconds* each.', 'These *sound fake*. They’re not.', 'Get *3 out of 3* and you’re a genius', 'Trivia that sounds *made up*'];
  triviaPicks.forEach((ids, n) => S.push({
    id: `trivia-${pad(n + 1)}`, out: `videos/shorts/05-wait-what-trivia/wait-what-trivia-${pad(n + 1)}.mp4`, format: 'trivia', ...V, kind: 'trivia', game: 'wait-what',
    music: { track: 'brain-snack', start: [0, 18.5, 37][n % 3] },
    data: { questions: ids.map(question), hook: triviaHooks[n % triviaHooks.length] },
  }));

  // ---- 6. Gut Check: higher or lower --------------------------------------------------------
  const gut = read('gut-check.json');
  [0, 2, 4, 6, 8, 1, 3].forEach((ci, n) => {
    const c = gut[ci % gut.length];
    S.push({
      id: `gut-${pad(n + 1)}`, out: `videos/shorts/06-higher-or-lower/gut-check-${pad(n + 1)}-${c.id}.mp4`, format: 'higherlower', ...V, kind: 'gut', game: 'gut-check',
      music: { track: 'tick-tock', start: [32, 0, 16][n % 3] },
      data: { question: c.question, pairs: gutPairs(c, 4, 11 + n * 7), hook: n === 0 ? undefined : ['Higher or lower? *Go with your gut.*', 'Bet you can’t get *4 in a row*', 'Your gut vs. *real numbers*', '*More or less?* No calculators.'][n % 4] },
    });
  });

  // ---- 7. Trailers ---------------------------------------------------------------------------------
  const order = ['wing-it', 'gloop', 'neon-rush', 'color-lab', 'mini-racer', 'square-deal', 'spot-the-glitch', 'outta-here', 'letter-pinch', 'wheres-the-ball', 'memory-grid', 'crosswire', 'gut-check', 'star-grid', 'color-recall', 'to-scale', 'wait-what', 'fussbox', 'whatsit'];
  const shotFrom = { 'wing-it': ['biome', 1, -1.0], gloop: ['end', 0, -12], 'neon-rush': ['crash', 0, -14], 'color-lab': ['won', 0, -4], 'mini-racer': 9, 'square-deal': ['clear', 0, -2.5], 'spot-the-glitch': ['found', 1, -1.2], 'outta-here': ['cleared', 0, -3], 'letter-pinch': ['guess', 1, -2], 'wheres-the-ball': ['found', 0, -3.5], 'memory-grid': ['clear', 5, -0.5], crosswire: ['word', 2, 1.5], 'gut-check': ['right', 2, -1.5], 'star-grid': ['solved', 0, -4.5], 'color-recall': ['reveal', 0, -2.5], 'to-scale': ['lock', 0, -1.2], 'wait-what': ['answer', 3, -1.0], fussbox: ['feed', 1, -1.5], whatsit: ['pick', 0, -6] };
  const shots = (list, beats) => list.map((slug, i) => ({ slug, take: 'a', from: M.time(slug, 'a', shotFrom[slug]), title: G[slug].title, line: G[slug].tagline, beats: typeof beats === 'function' ? beats(i) : beats, color: GAMES[slug].color }));
  const wallArt = arcade.map((g) => g.art.tile);
  const trailerOutro = { title: 'Small games.|*Big obsessions.*', line: 'Free in your browser. No download, no sign-up.' };
  S.push({
    id: 'trailer-vertical', out: 'videos/shorts/07-trailers/glitchbound-trailer-vertical.mp4', format: 'montage', ...V, kind: 'trailer',
    music: { track: 'big-obsessions', start: 18.75 },
    data: { bpm: 128, cards: [{ text: '19 games.', logo: true }, { text: 'Zero downloads.' }, { text: 'Zero sign-ups.' }, { text: '*Just play.*', bg: '#b6e62c' }], shots: shots(order, (i) => (i < 8 ? 2 : 3)), wallArt, outro: trailerOutro },
  });
  S.push({
    id: 'trailer-teaser', out: 'videos/shorts/07-trailers/glitchbound-teaser-15s.mp4', format: 'montage', ...V, kind: 'trailer',
    music: { track: 'big-obsessions', start: 22.5 },
    data: { bpm: 128, cards: [{ text: 'Bored?', logo: true, beats: 2 }], shots: shots(['gloop', 'wing-it', 'neon-rush', 'color-lab', 'mini-racer', 'square-deal', 'spot-the-glitch', 'outta-here', 'star-grid', 'whatsit'], 2), wall: false, outroDur: 3.4, outro: { title: '19 free games.|*One tab.*', line: 'glitchboundstudio.com' } },
  });
  S.push({
    id: 'trailer-puzzles', out: 'videos/shorts/07-trailers/glitchbound-puzzle-lovers.mp4', format: 'montage', ...V, kind: 'trailer',
    music: { track: 'brain-snack', start: 0 },
    data: { bpm: 104, cards: [{ text: 'For puzzle people.', logo: true, beats: 4 }], shots: shots(['color-lab', 'star-grid', 'letter-pinch', 'crosswire', 'outta-here', 'square-deal', 'fussbox', 'whatsit', 'spot-the-glitch', 'color-recall'], 4), wall: false, outro: { title: 'New puzzles|*every day*', line: 'Free in your browser at glitchboundstudio.com' } },
  });

  // ---- 8. POV & memes ----------------------------------------------------------------------------
  const pov = [
    ['pov-one-more-round', 'POV: you said *"one more round"* 40 minutes ago', 'gloop', 'b', 2, 30, 1.2, 'brain-snack'],
    ['pov-2am-space', 'Nobody:|Me at 2am: *trying to reach space* in Wing It', 'wing-it', 'b', ['crash', 0, -28], 'end', 1.15, 'pixel-dash'],
    ['pov-streak-at-work', 'Me pretending to work while my *Square Deal streak* keeps going', 'square-deal', 'b', 0.5, 34, 1.25, 'pixel-dash'],
    ['pov-color-lab-click', 'When the Color Lab puzzle *finally clicks*', 'color-lab', 'a', ['won', 0, -22], ['won', 0, 1.5], 1.2, 'lofi-lobby'],
    ['pov-gut-check-confidence', 'My confidence vs. *my actual knowledge*', 'gut-check', 'a', 0.5, 'end', 1.5, 'tick-tock'],
    ['pov-neon-traffic', 'Driving home after *one game* of NEON RUSH', 'neon-rush', 'b', 0.5, 30, 1, 'neon-nights'],
    ['pov-memory-flex', 'Me after remembering a pattern *this long*', 'memory-grid', 'a', ['miss', 0, -9], 'end', 1, 'tick-tock'],
    ['pov-whatsit-detective', 'Guessing the *{pick.name}* after {pick.questions} questions like a detective', 'whatsit', 'a', ['ask', 0, -2], 'end', 1.1, 'brain-snack'],
  ];
  for (const [id, meme, slug, take, from, to, speed, track] of pov) S.push({
    id, out: `videos/shorts/08-pov-and-memes/${id}.mp4`, format: 'reel', ...V, kind: 'pov', game: slug,
    music: { track, start: 4 },
    data: { layout: 'meme', memeH: 560, memeSize: 64, cropY: 0.35, meme: M.fill(meme, slug, take).replace(/the \*([A-Z])/, (_, c) => `the *${c.toLowerCase()}`), clips: M.clips([{ slug, take, from, to, speed }]), outro: { title: 'Small games.|*Big obsessions.*', line: `${G[slug].title} is free at glitchboundstudio.com`, art: G[slug].art.tile } },
  });

  // ---- 9. Satisfying + dailies + tours ----------------------------------------------------------
  S.push({
    id: 'satisfying-compilation', out: 'videos/shorts/11-compilations/oddly-satisfying.mp4', format: 'reel', ...V, kind: 'compilation',
    music: { track: 'lofi-lobby', start: 0 },
    data: {
      layout: 'full', hook: { text: '*Oddly satisfying*, but it’s a game', dur: 2.4 },
      clips: M.clips([{ slug: 'gloop', take: 'a', from: 46, to: 52 }, { slug: 'color-lab', take: 'b', from: 3, to: 11, speed: 1.2 }, { slug: 'square-deal', take: 'a', from: ['clear', 0, -4], to: ['clear', 0, 2] }, { slug: 'outta-here', take: 'b', from: 2, to: 9 }, { slug: 'star-grid', take: 'a', from: ['solved', 0, -5.5], to: ['solved', 0, 1] }]),
      captions: caps([['Gloop', 2.6], ['Color Lab', 6.4], ['Square Deal', 13.1], ['Outta Here', 19.1], ['Star Grid', 26.1]], 32, 1500),
      outro: trailerOutro,
    },
  });
  S.push({
    id: 'dailies-promo', out: 'videos/shorts/11-compilations/todays-dailies.mp4', format: 'reel', ...V, kind: 'compilation',
    music: { track: 'small-games', start: 0 },
    data: {
      layout: 'full', hook: { text: 'Your daily *brain warm-up*', eyebrow: 'Today’s dailies', dur: 2.4 },
      clips: [{ slug: 'letter-pinch', take: 'a', from: 0, to: 9 }, { slug: 'crosswire', take: 'a', from: 2, to: 10 }, { slug: 'color-recall', take: 'a', from: 0.5, to: 7.5 }, { slug: 'spot-the-glitch', take: 'a', from: 1, to: 7 }, { slug: 'tour-home', take: 'off', from: 4.2, to: 10 }],
      captions: caps([['Letter Pinch', 2.6], ['Crosswire', 9], ['Color Recall', 17], ['Spot the Glitch', 24], ['Same puzzles for *everyone*', 30], ['New ones at *midnight*', 33]], 36.4, 1500),
      outro: { title: 'Keep your|*streak* alive', line: '18 dailies, free at glitchboundstudio.com' },
    },
  });
  const tours = [
    ['tour-lobby', 'off', 'small-games', 'POV: you found *19 free games* in one tab', [['No *download*', 4.4], ['No *sign-up*', 8.4], ['New *dailies* every day', 12.6], ['Party games *too*', 19]], 'videos/shorts/11-compilations/lobby-tour.mp4'],
    ['halloween-lobby', 'halloween', 'spooky-glitch', 'GlitchBound went *spooky* for Halloween', [['Cobwebs on *everything*', 4.4], ['Spooky tunes in *Quizbelief*', 9], ['Play free *all October*', 15]], 'videos/shorts/09-seasonal/halloween-lobby.mp4'],
    ['winter-lobby', 'winter', 'snow-day', 'It’s *snowing* on GlitchBound', [['Cozy up with a *puzzle*', 4.4], ['Or three', 8.4], ['Holiday look is *on*', 13]], 'videos/shorts/09-seasonal/winter-lobby.mp4'],
    ['diwali-lobby', 'diwali', 'party-mode', 'Happy *Diwali* from GlitchBound', [['Bright days', 4.4], ['Long *streaks*', 8.4]], 'videos/shorts/09-seasonal/diwali-lobby.mp4'],
  ];
  for (const [id, take, track, hookText, cs, out] of tours) {
    const dur = Math.min(26, takeSeconds('tour-home', take) - 0.5);
    S.push({
      id, out, format: 'reel', ...V, kind: take === 'off' ? 'tour' : 'seasonal',
      music: { track, start: 0 },
      data: { layout: 'full', hook: { text: hookText, dur: 2.8, y: 900 }, clips: [{ slug: 'tour-home', take, from: 0, to: dur }], captions: caps(cs, dur - 0.4, 1350), watermark: false, outro: trailerOutro },
    });
  }
  // Seasonal cuts of game videos.
  {
    const clips = M.clips([{ slug: 'crosswire', take: 'h', from: 0, len: 11 }, { slug: 'crosswire', take: 'h', from: ['grid', 0, -6], to: ['grid', 0, 1.5] }, { slug: 'crosswire', take: 'h', from: ['wrong-mystery', 0, -1.5], to: 'end' }]);
    const body = clips.reduce((a, c) => a + (c.to - c.from), 0);
    const src = { clips, slug: 'crosswire', take: 'h' };
    S.push({
      id: 'halloween-witch', out: 'videos/shorts/09-seasonal/halloween-crosswire-mystery.mp4', format: 'reel', ...V, kind: 'seasonal', game: 'crosswire',
      music: { track: 'spooky-glitch', start: 0 },
      data: { layout: 'full', hook: { text: 'The mystery word was *spooky* today', eyebrow: 'Crosswire', dur: 2.5 }, clips, captions: caps([['Fill the *grid*...', 2.6], ['...circled letters...', ['grid', 0, 0.4]], ['*{mystery.word}*', ['mystery', 0, 0.1]]], body - 0.4, 470, src), outro: { title: 'Happy *Halloween*', line: 'Crosswire is free at glitchboundstudio.com', art: G.crosswire.art.tile } },
    });
  }
  S.push({
    id: 'halloween-trivia', out: 'videos/shorts/09-seasonal/halloween-trivia.mp4', format: 'trivia', ...V, kind: 'seasonal', game: 'wait-what',
    music: { track: 'spooky-glitch', start: 0 },
    data: { questions: ['animals:129', 'history:146', 'history:143'].map(question), hook: 'Spooky trivia. *5 seconds* each.', kicker: 'Halloween|special' },
  });

  // ---- 10. Party Mode --------------------------------------------------------------------------------
  const P = PARTY.impostor;
  const partyClips = M.clips(P.clips.map((c) => ({ take: 'a', ...c })));
  const partyBody = partyClips.reduce((a, c) => a + (c.to - c.from) / (c.speed ?? 1), 0);
  P.hooks.forEach((h, n) => S.push({
    id: `party-impostor-${n + 1}`, out: `videos/shorts/10-party-mode/impostor-${n + 1}.mp4`, format: 'reel', ...V, kind: 'party',
    music: { track: 'party-mode', start: [0, 15.7, 31.5][n] },
    data: {
      layout: 'full', clips: partyClips, hook: { text: h, eyebrow: 'Party Mode', eyeColor: '#ff4fc8', dur: 2.6 },
      captions: caps(P.captions.map(([t, at]) => [t, typeof at === 'number' ? at + 2 : at]), partyBody - 0.4, 1450, { clips: partyClips, slug: 'party-impostor', take: 'a' }),
      outro: { title: '11 party games.|*No sign-up.*', line: 'Party Mode at glitchboundstudio.com/party', art: '/party/impostor/tile.webp' },
    },
  }));

  // ---- 11. YouTube (16:9) ----------------------------------------------------------------------------
  S.push({
    id: 'yt-trailer', out: 'videos/youtube/01-glitchbound-official-trailer.mp4', format: 'montage', ...HZ, kind: 'youtube',
    music: { track: 'big-obsessions', start: 18.75 },
    data: { bpm: 128, cards: [{ text: '19 games.', logo: true }, { text: 'Zero downloads.' }, { text: 'Zero sign-ups.' }, { text: '*Just play.*', bg: '#b6e62c' }], shots: shots(order, (i) => (i < 8 ? 2 : 3)), wallArt, outro: trailerOutro },
  });
  for (const slug of order) {
    const secs = takeSeconds(slug, 'a');
    const g = G[slug];
    S.push({
      id: `yt-game-${slug}`, out: `videos/youtube/gameplay/${slug}-gameplay.mp4`, format: 'yt', ...HZ, kind: 'youtube', game: slug,
      music: { track: GAMES[slug].music, start: 0 },
      data: { title: `${g.title}: real gameplay`, segments: [{ slug, take: 'a', from: 0, to: Math.min(secs, 75), title: g.title, tagline: g.tagline, art: g.art.tile, chips: g.categories, note: 'Recorded in the browser. No download needed.' }], outro: { title: `Play ${g.title} *free*`, line: `glitchboundstudio.com/games/${slug}`, art: g.art.tile } },
    });
  }
  S.push({
    id: 'yt-all-games', out: 'videos/youtube/02-all-19-games-gameplay-tour.mp4', format: 'yt', ...HZ, kind: 'youtube',
    music: { track: 'small-games', start: 0 },
    data: {
      title: 'All 19 GlitchBound games,|*one tour*',
      segments: order.map((slug) => {
        const [c] = M.clips([{ slug, take: 'a', ...GAMES[slug].clips[0], to: undefined, len: 20 }]);
        return { slug, take: 'a', from: c.from, to: c.to, title: G[slug].title, tagline: G[slug].tagline, art: G[slug].art.tile, chips: G[slug].categories };
      }),
      outro: trailerOutro,
    },
  });
  S.push({
    id: 'yt-party-impostor', out: 'videos/youtube/03-party-mode-impostor-how-to-play.mp4', format: 'yt', ...HZ, kind: 'youtube',
    music: { track: 'party-mode', start: 0 },
    data: { title: 'Impostor: a party game|on *one phone*', segments: [{ slug: 'party-impostor', take: 'a', from: 0, to: 43.8, title: 'Impostor', tagline: 'Everyone gets the secret word, except one. Say one word each, then vote out the faker.', art: '/party/impostor/tile.webp', chips: ['Party', '3+ players', 'One phone'] }], outro: { title: '11 party games.|*No sign-up.*', line: 'glitchboundstudio.com/party', art: '/party/impostor/tile.webp' } },
  });
  S.push({
    id: 'yt-desktop-tour', out: 'videos/youtube/04-arcade-tour-desktop.mp4', format: 'reel', ...HZ, kind: 'youtube',
    music: { track: 'small-games', start: 0 },
    data: { layout: 'full', watermark: false, hook: { text: 'Hover a game. *Watch it play.*', dur: 2.8, y: 540, size: 92 }, clips: [{ slug: 'tour-desktop', take: 'a', from: 3, to: 53.6 }], captions: caps([['Live previews on *every tile*', 4.5], ['19 games', 16], ['Puzzles, racers, *word games*', 26], ['All *free*', 38]], 50, 900).map((c) => ({ ...c, x: 960 })), outro: trailerOutro },
  });
  return S;
}
