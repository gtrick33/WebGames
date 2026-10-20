// Renders still images (logos, banners, post templates, thumbnails) from templates/*.js.
//   node stills/render.mjs [jobs-file-substring ...]
// Jobs come from stills/jobs.mjs: { tpl, out (path under marketing/), w, h, data, transparent }.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MARKETING, STATIC, startSite } from '../lib/site.mjs';
import { jobs } from './jobs.mjs';

const filters = process.argv.slice(2);
const stop = await startSite({ dev: false });
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('page error', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text().slice(0, 200)));
await page.goto(`${STATIC}/_studio/kit/stage.html`);
await page.waitForFunction(() => window.ready);
const list = (await jobs()).filter((j) => !filters.length || filters.some((f) => j.out.includes(f) || j.tpl.includes(f)));
let n = 0;
for (const j of list) {
  await page.setViewportSize({ width: j.w, height: j.h });
  await page.evaluate(({ tpl, data }) => window.mount(tpl, data), { tpl: j.tpl, data: { ...j.data, w: j.w, h: j.h } });
  const file = join(MARKETING, j.out);
  mkdirSync(dirname(file), { recursive: true });
  await page.locator('#stage').screenshot({ path: file, omitBackground: !!j.transparent, type: file.endsWith('.jpg') ? 'jpeg' : 'png', ...(file.endsWith('.jpg') ? { quality: 92 } : {}) });
  n++;
  if (n % 10 === 0 || n === list.length) console.log(`${n}/${list.length} ${j.out}`);
}
await browser.close();
stop();
process.exit(0);
