// Pulls real game content out of the site's own modules (through the dev server) for the quiz and
// challenge formats: the arcade catalogue, Wait, What? questions, Gut Check pairs data, Spot the
// Glitch puzzles drawn by the game's renderer, and Where's the Ball? photo levels with the ball
// painted in by the game. Writes .cache/content/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV, STUDIO, startSite } from '../lib/site.mjs';
import { launch, newPage } from '../capture/record.mjs';

const OUT = join(STUDIO, '.cache/content');
for (const d of ['spot', 'ball']) mkdirSync(join(OUT, d), { recursive: true });
const stop = await startSite();
const browser = await launch();
const { page } = await newPage(browser);
await page.goto(`${DEV}/about`);
await page.waitForTimeout(800);

// ---- Catalogue (titles, taglines, art, categories) ----------------------------------------------
const catalog = await page.evaluate(async () => {
  const { GAMES } = await import('/src/catalog/games.ts');
  const { PARTY_GAMES } = await import('/src/party/catalog.ts').catch(() => ({}));
  const party = PARTY_GAMES ?? Object.values(await import('/src/party/catalog.ts')).find((v) => Array.isArray(v) && v[0]?.blurb);
  return {
    games: GAMES.map((g) => ({ slug: g.slug, title: g.title, tagline: g.tagline, description: g.description, categories: g.categories, released: g.released, art: g.art, partyOnly: !!g.partyOnly, daily: !!(g.daily?.length || g.ownDaily) })),
    party: (party ?? []).map((p) => ({ id: p.id, title: p.title, blurb: p.blurb, time: p.time, players: p.players, color: p.color, art: p.art ?? null, adult: !!p.adult })),
  };
});
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));
console.log('catalog', catalog.games.length, 'games', catalog.party.length, 'party');

// ---- Wait, What? ------------------------------------------------------------------------------
const trivia = await page.evaluate(async () => {
  const deck = await import('/src/games/wait-what/deck.ts');
  const pack = await import('/src/games/wait-what/pack.ts');
  const out = [];
  let n = 0;
  for (const batch of pack.EN.batches) {
    for (const [cat, list] of Object.entries(batch.items)) {
      list.forEach((raw, i) => {
        const q = deck.fromRaw(`${cat}-${i}`, cat, raw, deck.rng(1000 + n++), pack.EN);
        const meta = deck.CATS[cat];
        out.push({ ...q, catLabel: meta?.label ?? cat, catColor: meta?.color ?? '#7b4dff', bulgaria: cat === 'bulgaria' });
      });
    }
  }
  return out;
});
const good = trivia.filter((q) => q.answers.length >= 2 && q.answers.length <= 4 && q.text.length <= 120 && q.answers.every((a) => a.length <= 34) && !/\p{Extended_Pictographic}/u.test(q.text + q.answers.join('') + q.fact) && q.fact.length <= 190);
writeFileSync(join(OUT, 'trivia.json'), JSON.stringify(good, null, 2));
console.log('trivia', trivia.length, '->', good.length, 'usable');

// ---- Gut Check ----------------------------------------------------------------------------------
const gut = await page.evaluate(async () => {
  const { CATEGORIES } = await import('/src/games/gut-check/bank.ts');
  return CATEGORIES.map((c) => ({ id: c.id, question: c.question, more: c.more, less: c.less, years: !!c.years, items: c.items.map(([name, , v]) => ({ name, value: v, shown: c.format(v) })) }));
});
writeFileSync(join(OUT, 'gut-check.json'), JSON.stringify(gut, null, 2));
console.log('gut-check', gut.length, 'categories');

// ---- Spot the Glitch: puzzles drawn by the game -------------------------------------------------
const spots = await page.evaluate(async () => {
  const { makePuzzle } = await import('/src/games/spot-the-glitch/diffs.ts');
  const { drawScene } = await import('/src/games/spot-the-glitch/draw.ts');
  const { THEME_IDS, THEME_NAMES, W, H } = await import('/src/games/spot-the-glitch/scene.ts');
  const out = [];
  for (let k = 0; k < 26; k++) {
    const theme = THEME_IDS[k % THEME_IDS.length];
    const p = makePuzzle(7001 + k * 37, k < 13 ? 0 : 1, theme);
    const shot = (scene) => {
      const c = document.createElement('canvas');
      document.body.appendChild(c);
      drawScene(c, scene, W);
      const url = c.toDataURL('image/png');
      c.remove();
      return url;
    };
    out.push({ id: `spot-${k + 1}`, theme, themeName: THEME_NAMES[theme], difficulty: k < 13 ? 0 : 1, W, H, diffs: p.diffs, left: shot(p.left), right: shot(p.right) });
  }
  return out;
});
for (const s of spots) {
  writeFileSync(join(OUT, 'spot', `${s.id}-a.png`), Buffer.from(s.left.split(',')[1], 'base64'));
  writeFileSync(join(OUT, 'spot', `${s.id}-b.png`), Buffer.from(s.right.split(',')[1], 'base64'));
  delete s.left;
  delete s.right;
}
writeFileSync(join(OUT, 'spot.json'), JSON.stringify(spots, null, 2));
console.log('spot', spots.length, 'puzzles');

// ---- Where's the Ball?: photo levels with the ball painted in -----------------------------------
const balls = await page.evaluate(async () => {
  const P = await import('/src/games/wheres-the-ball/photo.ts');
  const { PHOTOS } = await import('/src/games/wheres-the-ball/photos.ts');
  const { loadPhoto, buildComposite } = await import('/src/games/wheres-the-ball/photoPaint.ts');
  const { W, H } = await import('/src/games/wheres-the-ball/scene.ts');
  const out = [];
  const picks = PHOTOS.filter((_, i) => i % Math.max(1, Math.floor(PHOTOS.length / 24)) === 0).slice(0, 24);
  for (const [k, photo] of picks.entries()) {
    try {
      // Mid-size balls: findable in a few seconds on a phone, but not instantly.
      const scene = P.makePhotoScene(4242 + k * 101, 1 + (k % 3), photo, 1);
      const img = await loadPhoto(photo.id);
      const comp = buildComposite(img, scene);
      out.push({ id: `ball-${k + 1}`, photo: photo.id, title: photo.title, creator: photo.creator, license: photo.license, source: photo.source, W, H, cw: comp.width, ch: comp.height, ball: { x: scene.ball.x, y: scene.ball.y, r: scene.ball.r }, png: comp.toDataURL('image/jpeg', 0.92) });
    } catch (e) {
      out.push({ id: `ball-${k + 1}`, error: String(e) });
    }
  }
  return out;
});
for (const b of balls) {
  if (b.png) writeFileSync(join(OUT, 'ball', `${b.id}.jpg`), Buffer.from(b.png.split(',')[1], 'base64'));
  delete b.png;
}
writeFileSync(join(OUT, 'ball.json'), JSON.stringify(balls, null, 2));
console.log('ball', balls.filter((b) => !b.error).length, 'levels', balls.filter((b) => b.error).map((b) => b.error).slice(0, 2));

await browser.close();
stop();
process.exit(0);
