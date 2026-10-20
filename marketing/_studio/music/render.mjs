// Renders the soundtrack and SFX (music/tracks.js) to marketing/music/: loudness-normalized WAV
// masters plus AAC copies, and a tracks.json with titles, moods and tempos for the editor.
//   node music/render.mjs [id ...]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKETING, STATIC, startSite } from '../lib/site.mjs';

const FF = '/opt/homebrew/bin/ffmpeg';
const only = process.argv.slice(2);
const stop = await startSite({ dev: false });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
await page.goto(`${STATIC}/_studio/music/render.html`);
await page.waitForFunction(() => window.ready);
const list = await page.evaluate(() => window.list());
const out = join(MARKETING, 'music');
mkdirSync(join(out, 'sfx'), { recursive: true });
const tmp = join(MARKETING, '_studio/.cache/music');
mkdirSync(tmp, { recursive: true });

async function one(kind, id, dir, lufs) {
  const t0 = Date.now();
  const data = await page.evaluate(([k, i]) => window.renderOne(k, i), [kind, id]);
  const raw = join(tmp, `${id}.raw.wav`);
  writeFileSync(raw, Buffer.from(data, 'base64'));
  const wav = join(dir, `${id}.wav`);
  // Two-pass-ish: loudnorm to streaming loudness with a true-peak ceiling.
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', raw, '-af', `loudnorm=I=${lufs}:TP=-1.2:LRA=11`, '-ar', '48000', '-c:a', 'pcm_s16le', wav]);
  if (kind === 'track') execFileSync(FF, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '256k', join(dir, `${id}.m4a`)]);
  rmSync(raw);
  console.log(`${kind} ${id} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

for (const t of list.tracks) if (!only.length || only.includes(t.id)) await one('track', t.id, out, -14);
for (const id of list.sfx) if (!only.length || only.includes(id)) await one('sfx', id, join(out, 'sfx'), -16);
writeFileSync(join(out, 'tracks.json'), JSON.stringify(list, null, 2));
await browser.close();
stop();
process.exit(0);
