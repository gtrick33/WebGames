// Records real gameplay: opens a game on the frozen site in a phone-shaped (or desktop) viewport, lets
// that game's bot (capture/bots/<slug>.mjs) play it, and turns the page's screencast into a constant
// frame rate MP4 under .cache/footage/<slug>/<take>.mp4, with <take>.json holding timed marks
// (e.g. "clear", "win") that the editor uses to pick highlights.
//
//   node capture/record.mjs <slug> [--take a] [--fps 30] [--max 60] [--desktop]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEV, NEON, STATIC, STUDIO, startSite } from '../lib/site.mjs';
import { emojiCSS, emojiInit, installEmojiFonts } from '../lib/emoji.mjs';

const FFMPEG = '/opt/homebrew/bin/ffmpeg';

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

export const PHONE = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 };

/**
 * Launches Chromium with the in-page toolkit. Headless screencasts ignore the emulated device scale
 * factor, so the window itself is sized in device pixels with the same scale forced.
 */
export async function launch({ desktop = false } = {}) {
  const prof = desktop ? DESKTOP : PHONE;
  const w = Math.round(prof.viewport.width * prof.deviceScaleFactor);
  const h = Math.round(prof.viewport.height * prof.deviceScaleFactor);
  return chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--force-color-profile=srgb', '--hide-scrollbars', `--window-size=${w},${h}`, `--force-device-scale-factor=${prof.deviceScaleFactor}`],
  });
}

/**
 * A page with the in-page toolkit. `season` picks the site's holiday look ('off' by default so footage
 * stays evergreen; 'halloween' / 'winter' for seasonal posts): it seeds the cached catalog settings,
 * and the studio's /api stub never overwrites them.
 */
export async function newPage(browser, { desktop = false, season = 'off', storage = {} } = {}) {
  const ctx = await browser.newContext({ ...(desktop ? DESKTOP : PHONE), reducedMotion: 'no-preference', colorScheme: 'light', locale: 'en-US' });
  await ctx.addInitScript({ path: join(STUDIO, 'lib/inpage.js') });
  if (process.env.GB_SYSTEM_EMOJI !== '1') await ctx.addInitScript(emojiInit, emojiCSS());
  await ctx.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch { /* no storage */ }
  }, storage);
  await ctx.addInitScript((season) => {
    try {
      localStorage.setItem('glitchbound.catalog', JSON.stringify({ settings: {}, picks: {}, notice: null, layout: null, season }));
      // First-visit tutorials would cover the game in every take: mark them seen.
      for (const slug of ['memory-grid', 'color-recall', 'letter-pinch', 'mini-racer', 'color-lab', 'spot-the-glitch', 'wheres-the-ball', 'wing-it', 'crosswire',
        'wait-what', 'to-scale', 'square-deal', 'outta-here', 'gloop', 'gut-check', 'star-grid', 'fussbox', 'whatsit', 'neon-rush']) localStorage.setItem(`glitchbound.coach.${slug}`, '1');
    } catch { /* no storage */ }
  }, season);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('[page error]', e.message.slice(0, 300)));
  return { ctx, page };
}

/**
 * Screencast -> constant-fps MP4. Frames arrive whenever the page repaints (up to 60/s); each output
 * slot gets the newest frame painted at or before it.
 */
export async function startRecording(page, file, { fps = 30, width, height } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize();
  const dpr = await page.evaluate(() => devicePixelRatio);
  const W = width ?? Math.round(vp.width * dpr);
  const H = height ?? Math.round(vp.height * dpr);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  let prev = null;
  let t0 = null;
  let next = 0;
  let written = 0;
  const marks = [];
  const write = (buf) => {
    ff.stdin.write(buf);
    written++;
  };
  const onFrame = async (f) => {
    const ts = f.metadata.timestamp;
    const buf = Buffer.from(f.data, 'base64');
    if (t0 === null) t0 = ts;
    const t = ts - t0;
    while (prev && next <= t) {
      write(prev);
      next += 1 / fps;
    }
    prev = buf;
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const wall0 = Date.now();
  await page.exposeFunction('__gbMarkNode', (name, data) => {
    marks.push({ t: +((Date.now() - wall0) / 1000).toFixed(3), name, ...(data ? { data } : {}) });
  }).catch(() => {});
  await page.evaluate(() => { window.__gb.mark = (n, d) => window.__gbMarkNode?.(n, d); });
  return {
    marks,
    mark: (name, data) => marks.push({ t: +((Date.now() - wall0) / 1000).toFixed(3), name, ...(data ? { data } : {}) }),
    elapsed: () => (Date.now() - wall0) / 1000,
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      cdp.off('Page.screencastFrame', onFrame);
      const end = (Date.now() - wall0) / 1000;
      while (prev && next <= end) {
        write(prev);
        next += 1 / fps;
      }
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      return { frames: written, seconds: written / fps, marks };
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args._[0];
  if (!slug) throw new Error('usage: record.mjs <slug> [--take a] [--fps 30] [--max 60] [--desktop]');
  const bot = (await import(pathToFileURL(join(STUDIO, 'capture/bots', `${slug}.mjs`)).href)).default;
  const take = String(args.take ?? 'a');
  const fps = Number(args.fps ?? bot.fps ?? 30);
  const max = Number(args.max ?? bot.max ?? 60);
  const desktop = Boolean(args.desktop ?? bot.desktop);
  const stop = await startSite({ dev: bot.server !== 'static', neon: bot.server === 'neon' });
  installEmojiFonts();
  const browser = await launch({ desktop });
  const outDir = join(STUDIO, '.cache/footage', slug);
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${take}.mp4`);
  try {
    const { page } = await newPage(browser, { desktop, season: String(args.season ?? bot.season ?? 'off'), storage: bot.storage ?? {} });
    const base = bot.server === 'static' ? STATIC : bot.server === 'neon' ? NEON : DEV;
    await page.goto(base + (bot.url ?? `/games/${slug}`), { waitUntil: 'load' });
    await page.evaluate(() => window.__gbEmojiReady).catch(() => {});
    await page.evaluate(() => window.__gb.clean());
    const ctx = { args, take, seed: Number(args.seed ?? 0) || undefined, log: (...m) => console.log(`[${slug}]`, ...m) };
    if (bot.prepare) await bot.prepare(page, ctx);
    const rec = await startRecording(page, file, { fps });
    const timer = new Promise((r) => setTimeout(r, max * 1000));
    await Promise.race([bot.play(page, rec, ctx), timer]);
    if (bot.tail) await page.waitForTimeout(bot.tail * 1000);
    const res = await rec.stop();
    writeFileSync(join(outDir, `${take}.json`), JSON.stringify({ slug, take, fps, seconds: res.seconds, marks: res.marks }, null, 2));
    console.log(`[${slug}] ${take}: ${res.seconds.toFixed(1)}s, ${res.marks.length} marks -> ${file}`);
  } finally {
    await browser.close();
    stop();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(() => process.exit(0), (e) => {
    console.error(e);
    process.exit(1);
  });
}

export function readMarks(slug, take = 'a') {
  return JSON.parse(readFileSync(join(STUDIO, '.cache/footage', slug, `${take}.json`), 'utf8'));
}
