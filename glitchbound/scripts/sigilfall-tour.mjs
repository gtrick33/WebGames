/**
 * Sigilfall's browser tour (NINE_PLAN.md, the regression bar): every act's beats seen at a phone's, a tablet's and a
 * desktop's size, the three modes off the campaign, and the old saves, with a picture of each stop and whatever the
 * page reported while it was there.
 *
 *   node scripts/sigilfall-tour.mjs --out docs/review/sf9-baseline
 *   node scripts/sigilfall-tour.mjs --out … --size phone --only beats|modes|saves [--preset the-tear] [--no-shots]
 *
 * - beats: a hero jumped to each story beat of the review presets (progress/presets.ts: the story's own, not the later
 *   passes' v3- and v4- ones), a picture after its opening has had a few seconds.
 * - modes: a Riftstone run begun from the Riftward, a night of the Vigil, and a Ring match against the computer.
 * - saves: each save of tests/sigilfall-saves/ put on the device as the game's own save, and its hero played.
 *
 * It starts its own dev server (the presets and the engine's handle are the dev server's) and needs Playwright, as the
 * screen check does. Pictures are JPEGs in <out>/<size>/; the report is <out>/tour.json, and the script fails if the
 * page reported an error anywhere. Calls to the site's API are not counted: the dev server has none.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('This script needs Playwright: npm i --no-save playwright');
  process.exit(1);
}
const OUT = join(ROOT, value('out') ?? '.cache/tour');

const SIZES = [
  { id: 'phone', viewport: { width: 844, height: 390 }, touch: true },
  { id: 'tablet', viewport: { width: 1024, height: 768 }, touch: true },
  { id: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
];

const press = (page, text) =>
  page
    .evaluate((t) => {
      const name = (x) => `${x.getAttribute('aria-label') ?? ''} ${x.textContent ?? ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
      const want = t.replace(/^=/, '').toLowerCase();
      const b = [...globalThis.document.querySelectorAll('button, [role=radio]')].filter((x) => x.offsetParent !== null && !x.disabled).find((x) => (t.startsWith('=') ? name(x) === want : name(x).includes(want)));
      if (!b) return false;
      b.click();
      return true;
    }, text)
    .catch(() => false);

/** What the page says went wrong, apart from the API the dev server doesn't have. */
function listen(page, sink) {
  page.on('pageerror', (e) => sink.push(`error: ${e.message.slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/\/api\/|Failed to load resource|ERR_CONNECTION|502|favicon/.test(text)) return;
    sink.push(`console: ${text.slice(0, 300)}`);
  });
}

async function open(browser, server, size, init) {
  const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 1 });
  if (init) await context.addInitScript(init.fn, init.arg);
  const page = await context.newPage();
  const errors = [];
  listen(page, errors);
  await page.goto(`${server.url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
  // a phone or a tablet plays the game filling the screen
  if (size.touch) {
    const full = page.getByRole('button', { name: 'Fullscreen' });
    if (await full.count()) await full.first().click().catch(() => undefined);
  }
  return { context, page, errors };
}

const inGame = (page) => page.waitForFunction(() => globalThis.__rb.ui.screen === 'game' && !!globalThis.__rb.world && !globalThis.__rb.renderer.waiting, null, { timeout: 180_000 });

async function run() {
  const sizes = SIZES.filter((s) => !value('size') || s.id === value('size'));
  const only = value('only');
  const shots = !flag('no-shots');
  mkdirSync(OUT, { recursive: true });
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5196, strictPort: false } });
  await vite.listen();
  const server = { url: (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5196/').replace(/\/+$/, '') };
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  // (a part of the tour run again, --only or --size, keeps the rest of the report as it was)
  const kinds = { beats: 'beat', modes: 'mode', saves: 'save' };
  const again = (r) => sizes.some((s) => s.id === r.size) && (!only || kinds[only] === r.kind) && (!value('preset') || r.id === value('preset'));
  const report = existsSync(join(OUT, 'tour.json')) ? JSON.parse(readFileSync(join(OUT, 'tour.json'), 'utf8')).filter((r) => !again(r)) : [];
  const stop = async (page, errors, size, kind, id, n) => {
    const file = `${size.id}/${kind}-${String(n).padStart(2, '0')}-${id}.jpg`;
    if (shots) {
      mkdirSync(join(OUT, size.id), { recursive: true });
      await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 62 });
    }
    const said = errors.splice(0);
    report.push({ size: size.id, kind, id, ...(shots ? { file } : {}), errors: [...new Set(said)] });
    writeFileSync(join(OUT, 'tour.json'), `${JSON.stringify(report, null, 1)}\n`);
    console.log(`${size.id.padEnd(8)}${kind.padEnd(6)}${id.padEnd(26)}${said.length ? `${said.length} problem(s): ${said[0]}` : 'clean'}`);
  };
  try {
    for (const size of sizes) {
      if (!only || only === 'beats') {
        const { context, page, errors } = await open(browser, server, size);
        await page.evaluate(() => {
          const e = globalThis.__rb;
          e.setTutorial(false);
          e.createHero(0, 'warrior', 'Tour', 'm', undefined, false);
        });
        await inGame(page);
        const presets = await page.evaluate(async () => (await import('/src/games/sigilfall/progress/presets.ts')).PRESETS.map((p) => ({ id: p.id, region: p.region })));
        const list = presets.filter((p) => (value('preset') ? p.id === value('preset') : !/^v\d-/.test(p.id)));
        let n = 0;
        for (const p of list) {
          await page.evaluate((id) => globalThis.__rb.usePreset(id), p.id);
          await page.waitForFunction((region) => globalThis.__rb.world?.region.id === region && !globalThis.__rb.renderer.waiting, p.region, { timeout: 90_000 }).catch(() => errors.push(`the land ${p.region} never came up`));
          // the beat's opening has its moment; pages that cover the picture (the tale, a first-timer's card) are put away
          for (let t = 0; t < 8; t++) {
            await page.evaluate(() => {
              const e = globalThis.__rb;
              if (e.ui.tip) e.skipTips();
              if (e.ui.story) e.closeStory();
              if (e.ui.travel) e.cancelTravel();
              if (e.ui.death) e.respawn();
              if (e.world) e.world.player.iframe = 99;
            });
            await page.waitForTimeout(500);
          }
          await stop(page, errors, size, 'beat', p.id, ++n);
        }
        await context.close();
      }
      if (!only || only === 'modes') {
        // a Riftstone run: a finished hero in the Riftward takes a stone into the crypt
        {
          const { context, page, errors } = await open(browser, server, size);
          await page.evaluate(() => {
            const e = globalThis.__rb;
            e.setTutorial(false);
            e.createHero(0, 'warrior', 'Tour', 'm', undefined, false);
          });
          await inGame(page);
          await page.evaluate(() => globalThis.__rb.usePreset('mythic-plus'));
          await page.waitForFunction(() => globalThis.__rb.world?.region.id === 'riftward' && !globalThis.__rb.renderer.waiting, null, { timeout: 90_000 }).catch(() => errors.push('the Riftward never came up'));
          await page.waitForTimeout(3000);
          await page.evaluate(() => globalThis.__rb.ui.story && globalThis.__rb.closeStory());
          await stop(page, errors, size, 'mode', 'riftward', 1);
          const began = await page.evaluate(() => globalThis.__rb.travel('crypt', 2, [], undefined, 1));
          if (!began) errors.push('the Riftstone run did not begin');
          await page.waitForFunction(() => !!globalThis.__rb.world?.keyRun && !globalThis.__rb.renderer.waiting, null, { timeout: 90_000 }).catch(() => errors.push('the Riftstone run never came up'));
          for (let t = 0; t < 24; t++) {
            await page.evaluate(() => {
              const e = globalThis.__rb;
              if (e.ui.tip) e.skipTips();
              if (e.ui.story) e.closeStory();
              if (e.world) e.world.player.iframe = 99;
            });
            await page.waitForTimeout(500);
          }
          await stop(page, errors, size, 'mode', 'riftstone-run', 2);
          await context.close();
        }
        // a night of the Vigil
        {
          const { context, page, errors } = await open(browser, server, size);
          await page.waitForTimeout(1500);
          if (!(await press(page, 'The Vigil:'))) errors.push('no Vigil on the title screen');
          await page.waitForTimeout(2500);
          if (!(await press(page, 'Keep the watch in'))) errors.push('the Vigil has no way to begin');
          // (its card of how to play, then the night itself)
          await page.waitForTimeout(3000);
          if (!(await press(page, 'Begin the night'))) errors.push('the Vigil\u2019s night has no way to begin');
          await page.waitForTimeout(25_000);
          await stop(page, errors, size, 'mode', 'vigil-night', 3);
          await context.close();
        }
        // a Ring match against the computer (nobody else is in the queue here)
        {
          const { context, page, errors } = await open(browser, server, size);
          await page.waitForTimeout(1500);
          if (!(await press(page, 'The Ring:'))) errors.push('no Ring on the title screen');
          await page.waitForTimeout(2500);
          await press(page, '=Not now');
          await page.waitForTimeout(800);
          if (!(await press(page, 'Find a 1v1 match'))) errors.push('the Ring has no way to find a match');
          await page.waitForTimeout(60_000);
          await stop(page, errors, size, 'mode', 'ring-match', 4);
          await context.close();
        }
      }
      if (!only || only === 'saves') {
        const dir = join(ROOT, 'tests', 'sigilfall-saves');
        let n = 0;
        for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'about.json').sort()) {
          const text = readFileSync(join(dir, f), 'utf8');
          const { context, page, errors } = await open(browser, server, size, { fn: (t) => globalThis.localStorage.setItem('glitchbound.sigilfall', t), arg: text });
          const there = await page.evaluate(() => globalThis.__rb.heroes().filter(Boolean).length);
          if (there !== 1) errors.push(`the save's hero was not there (${there} heroes)`);
          await page.evaluate(() => {
            globalThis.__rb.setTutorial(false);
            globalThis.__rb.play(0);
          });
          await inGame(page).catch(() => errors.push('the hero never came into the world'));
          for (let t = 0; t < 8; t++) {
            await page.evaluate(() => {
              const e = globalThis.__rb;
              if (e.ui.tip) e.skipTips();
              if (e.ui.story) e.closeStory();
              if (e.world) e.world.player.iframe = 99;
            });
            await page.waitForTimeout(500);
          }
          await stop(page, errors, size, 'save', f.replace('.json', ''), ++n);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await vite.close();
  }
  const bad = report.filter((r) => r.errors.length);
  console.log(bad.length ? `\n${bad.length} stop(s) where the page reported a problem; see ${join(OUT, 'tour.json')}` : `\n${report.length} stops, and the page reported nothing.`);
  process.exit(bad.length ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
