// Shared pieces of the Sigilfall trailer studio: the browser, the game page at 1920 x 1080 with the
// stepped clock, and a recorder that writes one screenshot per 1/60 s of game time.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FFMPEG = '/opt/homebrew/bin/ffmpeg';
export const FFPROBE = '/opt/homebrew/bin/ffprobe';
export const SITE = process.env.SIGIL_SITE ?? 'http://localhost:7820';
export const CACHE = join(HERE, '.cache');
export const FOOTAGE = join(CACHE, 'footage');
export const FPS = 60;
export const W = 1920;
export const H = 1080;

const DSF = new WeakMap();
export async function launch() {
  return chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
      `--window-size=${W},${H + 120}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
}

/**
 * The game filling a 1920 x 1080 page, as it does in full screen. `storage` seeds localStorage (a save, for one).
 * `quiet` hides the arcade's own menu button, which belongs to the site and not to the game.
 */
export async function openGame(browser, { storage = {}, quiet = true, width = W, height = H, dsf = 1, path = '/sigilfall' } = {}) {
  DSF.set(browser, dsf);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, reducedMotion: 'no-preference', colorScheme: 'dark', locale: 'en-US' });
  await ctx.addInitScript({ path: join(HERE, 'inpage/clock.js') });
  await ctx.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    } catch { /* no storage */ }
  }, storage);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('[page error]', e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' && /pilot/.test(m.text())) console.warn(m.text().slice(0, 300)); });
  // (a headless window keeps 87 px for a title bar nobody sees: without them the picture's last rows come out black)
  const cdp = await ctx.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width, height: height + 87 } });
  await page.goto(SITE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__rb, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await page.waitForFunction(([w, h]) => {
    const el = document.querySelector('.rb');
    return !!el && el.clientWidth === w && el.clientHeight === h;
  }, [width, height], { timeout: 15_000 });
  if (quiet) await page.addStyleTag({ content: '.stage-menu, .stage-menu-btn, .rb-game-menu { display: none !important; }' });
  await page.addScriptTag({ path: join(HERE, 'inpage/pilot.js') });
  return { ctx, page };
}

/**
 * Sets a stage and holds the clock on its first moment: a hero made by the pilot (`hero`, see inpage/pilot.js),
 * the land's art loaded, nothing yet played. From here every step of game time is the recorder's.
 */
export async function stage(page, hero) {
  await page.evaluate(() => window.__pilot.ready());
  const st = await page.evaluate((h) => { const r = h ? window.__pilot.hero(h) : null; window.__clock.hold(); return r; }, hero ?? null);
  await settle(page);
  return st;
}

/** With the clock held: steps a frame at a time until the land has loaded (loading takes real time, not game time). */
export async function settle(page) {
  let calm = 0;
  for (let i = 0; i < 400 && calm < 6; i++) {
    const waiting = await page.evaluate(() => { window.__clock.tick(1000 / 60); return !!window.__rb.renderer.waiting; });
    calm = waiting ? 0 : calm + 1;
    await sleep(waiting ? 60 : 25);
  }
  await page.evaluate(() => window.__pilot.clearToasts());
}

/** Real seconds, whatever the page's clock is doing. */
export const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Records the page to `<name>.mp4` (and `<name>.json`: marks and the game's sound calls, timed in frames).
 * `frame(fn)` runs one 1/60 s step: the pilot's move, the clock, a screenshot.
 */
export async function record(page, name, { fps = FPS } = {}) {
  const file = join(FOOTAGE, `${name}.mp4`);
  mkdirSync(dirname(file), { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize();
  const scale = DSF.get(page.context().browser()) ?? 1;
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-g', '30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const marks = [];
  let frames = 0;
  await page.evaluate(() => { window.__clock.hold(); window.__pilot.soundLog = []; window.__pilot.frameNo = 0; });
  const t0 = Date.now();
  const rec = {
    file,
    get frames() { return frames; },
    get seconds() { return frames / fps; },
    mark(label, data) { marks.push({ f: frames, t: +(frames / fps).toFixed(3), label, ...(data ? { data } : {}) }); },
    /** One frame. Returns what the pilot reports (see inpage/pilot.js `status`). */
    async frame() {
      const st = await page.evaluate((ms) => window.__pilot.frame(ms), 1000 / fps);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true, clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale } });
      const jpg = Buffer.from(shot.data, 'base64');
      if (!frames) {
        // the first frame must be the whole picture at the size asked for (a short window once filmed black rows)
        const size = jpegSize(jpg);
        const want = [Math.round(vp.width * scale), Math.round(vp.height * scale)];
        if (size[0] !== want[0] || size[1] !== want[1]) throw new Error(`frame is ${size.join('x')}, not ${want.join('x')}`);
        const inner = await page.evaluate(() => [innerWidth, innerHeight]);
        if (inner[0] !== vp.width || inner[1] !== vp.height) throw new Error(`page is ${inner.join('x')}`);
      }
      if (!ff.stdin.write(jpg)) await new Promise((ok) => ff.stdin.once('drain', ok));
      frames++;
      return st;
    },
    /** Frames until `until(status)` is true or `max` seconds of game time have gone. */
    async run(max, until) {
      const end = frames + Math.round(max * fps);
      let st = null;
      while (frames < end) {
        st = await rec.frame();
        if (until && until(st, rec)) break;
      }
      return st;
    },
    async stop() {
      if (rec.done) return rec.done;
      ff.stdin.end();
      await new Promise((ok) => ff.on('close', ok));
      const sounds = await page.evaluate(() => { const s = window.__pilot.soundLog; window.__pilot.soundLog = null; window.__clock.release(); return s; });
      const meta = { name, fps, frames, seconds: +(frames / fps).toFixed(3), wall: +((Date.now() - t0) / 1000).toFixed(1), marks, sounds };
      writeFileSync(join(FOOTAGE, `${name}.json`), JSON.stringify(meta));
      console.log(`${name}: ${meta.seconds}s in ${meta.wall}s (${(frames / meta.wall).toFixed(1)} frames/s), ${sounds.length} sounds`);
      rec.done = meta;
      return meta;
    },
  };
  return rec;
}

/** A still of the page as it is (for looking, never for a trailer). Works with the clock held. */
const sessions = new WeakMap();
export async function still(page, file, quality = 80) {
  mkdirSync(dirname(file), { recursive: true });
  if (!sessions.has(page)) sessions.set(page, await page.context().newCDPSession(page));
  const shot = await sessions.get(page).send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: 0, y: 0, ...page.viewportSize(), scale: 1 } });
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
}

function jpegSize(buf) {
  for (let i = 2; i < buf.length;) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return [0, 0];
}

export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
