// Bot-writing aid: opens a game, presses buttons by visible text, then prints the visible buttons,
// a summary of the game's live React state (object keys) and saves a screenshot.
//   node capture/probe.mjs <slug> ["Play X" "Fly endless" ...] [--shot file.png] [--wait ms]
import { DEV, startSite } from '../lib/site.mjs';
import { launch, newPage, parseArgs } from './record.mjs';

const args = parseArgs(process.argv.slice(2));
const [slug, ...steps] = args._;
const stop = await startSite();
const browser = await launch();
try {
  const { page } = await newPage(browser);
  await page.goto(`${DEV}${slug.startsWith('/') ? slug : `/games/${slug}`}`);
  await page.waitForTimeout(1200);
  for (const s of steps) {
    if (/^\d+$/.test(s)) {
      await page.waitForTimeout(Number(s));
      continue;
    }
    if (s.startsWith('eval:')) {
      console.log('eval ->', await page.evaluate(s.slice(5)));
      continue;
    }
    const re = new RegExp(s, 'i');
    const btn = page.getByRole('button', { name: re }).first();
    if (await btn.count()) await btn.click({ timeout: 3000 }).catch((e) => console.log('click failed', s, e.message.split('\n')[0]));
    else await page.getByText(re).first().click({ timeout: 3000 }).catch((e) => console.log('no', s, e.message.split('\n')[0]));
    await page.waitForTimeout(Number(args.wait ?? 700));
  }
  const info = await page.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    const buttons = [...document.querySelectorAll('button, a.btn, [role=button], input, select')]
      .filter(vis)
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className && typeof e.className === 'string' ? e.className : '').split(' ').join('.')} "${(e.textContent || e.getAttribute('aria-label') || e.value || '').trim().slice(0, 40)}"`);
    const seen = new Set();
    const states = [];
    for (const v of window.__gb.findAll(() => true)) {
      if (!v || typeof v !== 'object' || seen.has(v) || v instanceof Node || v.$$typeof) continue;
      seen.add(v);
      const keys = Array.isArray(v) ? `[array ${v.length}]${v[0] && typeof v[0] === 'object' ? ` of {${Object.keys(v[0]).slice(0, 12).join(',')}}` : ''}` : `{${Object.keys(v).slice(0, 18).join(',')}}`;
      if (keys.length > 4 && !/^\{(children|className|style|onClick|ref)/.test(keys)) states.push(keys);
    }
    return { buttons, states: [...new Set(states)].slice(0, 60) };
  });
  console.log('BUTTONS\n ' + info.buttons.join('\n '));
  console.log('STATE\n ' + info.states.join('\n '));
  await page.screenshot({ path: args.shot ?? '/private/tmp/claude-501/-Users-savahristov-Desktop-WebGames-1/ddb73eb8-ef0d-4002-a111-b3a2c66554bd/scratchpad/probe.png' });
} finally {
  await browser.close();
  stop();
}
process.exit(0);
