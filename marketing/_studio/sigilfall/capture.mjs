// Films the shots in shots.mjs:  node capture.mjs <shot id> [<shot id> ...]   (--list shows them)
// Each shot becomes .cache/footage/<id>.mp4 (1920 x 1080, 60 frames for each second of game time) and
// <id>.json (marks, the pilot's casts and every sound the game asked for, by frame).
import { launch, openGame, record, stage, settle, sleep, still, CACHE, FOOTAGE, FFMPEG } from './lib.mjs';
import { SHOTS } from './shots.mjs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (process.argv.includes('--list') || !ids.length) {
  for (const [id, s] of Object.entries(SHOTS)) console.log(id.padEnd(22), s.about ?? '');
  process.exit(0);
}
const browser = await launch();
for (const id of ids) {
  const shot = SHOTS[id];
  if (!shot) { console.warn('no shot', id); continue; }
  const { ctx, page } = await openGame(browser, { quiet: true, ...(shot.view ?? {}) });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  let rec = null;
  const g = {
    page, ev, sleep,
    /** A hero on a stage with the clock held (inpage/pilot.js `hero`). */
    hero: (h) => stage(page, h),
    settle: () => settle(page),
    mode: (m) => ev((m) => window.__pilot.set(m), m),
    clean: (on = true) => ev((on) => window.__pilot.clean(on), on),
    settings: (patch) => ev((p) => window.__rb.setSettings(p), patch),
    /** Game time that is not filmed. */
    skip: (sec) => ev((n) => window.__pilot.skip(n), Math.round(sec * 60)),
    skipUntil: async (test, max = 120) => {
      for (let t = 0; t < max; t += 0.25) {
        const st = await ev((n) => window.__pilot.skip(n), 15);
        if (test(st)) return st;
      }
      return null;
    },
    find: (what) => ev((w) => window.__pilot.find(w), what),
    stand: (x, y) => ev(([x, y]) => window.__pilot.stand(x, y), [x, y]),
    nearBoss: (boss, back = 150, side = 0) => ev(([id, back, side]) => { const P = window.__pilot; const b = P.bossSpot(id || undefined); return b ? P.stand(b.x + side, b.y + back) : false; }, [boss, back, side]),
    status: () => ev(() => window.__pilot.status()),
    still: (name) => still(page, join(CACHE, 'look', `${name}.jpg`)),
    /** Starts filming. `rec.run(seconds, until)` films; `rec.mark(label)` leaves a mark for the editor. */
    film: async (name = id) => (rec = await record(page, name)),
    /**
     * The drawn pointer glides to something and clicks it, on film: `frames` of travel, then the click.
     * `what` is a Playwright locator; the first match is used.
     */
    point: async (what, { frames = 34, hold = 14, click = true, dx = 0, dy = 0 } = {}) => {
      const box = await what.first().boundingBox();
      if (!box) throw new Error('nothing to point at');
      const to = { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
      const vp = page.viewportSize();
      const from = g.at ?? { x: vp.width * 0.62, y: vp.height * 0.7 };
      for (let i = 1; i <= frames; i++) {
        const k = 1 - Math.pow(1 - i / frames, 3);
        const x = from.x + (to.x - from.x) * k;
        const y = from.y + (to.y - from.y) * k;
        await page.mouse.move(x, y);
        await ev(([x, y]) => window.__pilot.cursor(x, y), [x, y]);
        if (rec) await rec.frame();
      }
      g.at = to;
      if (click) await page.mouse.click(to.x, to.y);
      if (rec) await rec.run(hold / 60);
    },
    /** A click with the mouse, with the clock held or not (the page's own handlers answer it). */
    click: async (locator) => {
      const box = await locator.first().boundingBox();
      if (!box) throw new Error('nothing to click');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      return box;
    },
  };
  const t0 = Date.now();
  try {
    await shot.run(g);
    if (rec) {
      const notes = await ev(() => { const n = window.__pilot.notes; window.__pilot.notes = []; return n; });
      const meta = await rec.stop();
      // a contact sheet beside the take, for a first look
      const n = Math.max(1, Math.round(meta.frames / 16));
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', rec.file, '-vf', `select='not(mod(n\\,${n}))',scale=480:270,tile=4x4`, '-frames:v', '1', '-update', '1', join(FOOTAGE, `${rec.file.split('/').pop().replace('.mp4', '')}.sheet.jpg`)]);
      void notes;
    }
  } catch (e) {
    console.warn(`[${id}] failed:`, e.message.split('\n')[0]);
    if (rec) await rec.stop().catch(() => {});
  }
  console.log(`[${id}] done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await ctx.close();
}
await browser.close();
