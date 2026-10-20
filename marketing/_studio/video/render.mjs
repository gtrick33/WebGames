// Renders the videos in video/specs.mjs: extracts the footage each one needs to JPEG frames, steps
// the format's page frame by frame (seek + screenshot), encodes H.264, then mixes the music and SFX
// (loudness-normalized for social) and muxes the final MP4 into marketing/videos/.
//   node video/render.mjs [id-substring ...] [--force] [--workers 2] [--preview 0.5]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MARKETING, STATIC, STUDIO, startSite } from '../lib/site.mjs';
import { specs } from './specs.mjs';

const FF = '/opt/homebrew/bin/ffmpeg';
const args = process.argv.slice(2);
const force = args.includes('--force');
const wi = args.indexOf('--workers');
const WORKERS = wi >= 0 ? Number(args[wi + 1]) : 2;
const pi = args.indexOf('--preview');
const PREVIEW = pi >= 0 ? Number(args[pi + 1]) : 0;
const filters = args.filter((a, i) => !a.startsWith('--') && !['--workers', '--preview'].includes(args[i - 1]));
const FRAMES = join(STUDIO, '.cache/frames');
const TMP = join(STUDIO, '.cache/render');
mkdirSync(FRAMES, { recursive: true });
mkdirSync(TMP, { recursive: true });

export const clipKey = (c) => `${c.slug}-${c.take}-${(+c.from).toFixed(2)}-${(+c.to).toFixed(2)}-${c.speed ?? 1}${c.w ? `-w${c.w}` : ''}`;

function extract(c) {
  const key = clipKey(c);
  const dir = join(FRAMES, key);
  if (existsSync(join(dir, '.done'))) return { key, frames: readdirSync(dir).filter((f) => f.endsWith('.jpg')).length };
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const src = join(STUDIO, '.cache/footage', c.slug, `${c.take}.mp4`);
  const speed = c.speed ?? 1;
  const vf = [`setpts=PTS/${speed}`, 'fps=30', ...(c.w ? [`scale=${c.w}:-2:flags=lanczos`] : [])].join(',');
  execFileSync(FF, ['-loglevel', 'error', '-ss', String(c.from), '-t', String(c.to - c.from), '-i', src, '-vf', vf, '-q:v', '3', join(dir, '%05d.jpg')]);
  execFileSync('touch', [join(dir, '.done')]);
  return { key, frames: readdirSync(dir).filter((f) => f.endsWith('.jpg')).length };
}

function mixAudio(spec, plan, out) {
  const dur = plan.duration;
  const inputs = [];
  const chains = [];
  const labels = [];
  const music = spec.music ?? plan.music;
  if (music) {
    inputs.push('-i', join(MARKETING, 'music', `${music.track}.wav`));
    const fo = music.fadeOut ?? 1.2;
    const g = music.gain ?? 0.9;
    chains.push(`[0]atrim=start=${music.start ?? 0}:duration=${dur},asetpts=PTS-STARTPTS,afade=t=in:d=${music.fadeIn ?? 0.04},afade=t=out:st=${Math.max(0, dur - fo)}:d=${fo},volume=${g}[m0]`);
    labels.push('[m0]');
  }
  for (const [i, s] of (plan.sfx ?? []).entries()) {
    if (s.t >= dur) continue;
    const n = inputs.length / 2;
    inputs.push('-i', join(MARKETING, 'music', 'sfx', `${s.id}.wav`));
    const ms = Math.max(0, Math.round(s.t * 1000));
    chains.push(`[${n}]adelay=${ms}|${ms},volume=${s.gain ?? 0.8}[s${i}]`);
    labels.push(`[s${i}]`);
  }
  if (!labels.length) {
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(dur), '-c:a', 'aac', out]);
    return;
  }
  const mix = `${chains.join(';')};${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,atrim=duration=${dur},alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  execFileSync(FF, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', mix, '-map', '[a]', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', out]);
}

async function renderOne(browser, spec) {
  const out = join(MARKETING, spec.out);
  if (!force && existsSync(out) && !PREVIEW) return 'skip';
  const fmt = await import(pathToFileURL(join(STUDIO, 'formats', `${spec.format}.js`)).href);
  const plan = fmt.plan(spec);
  // Footage.
  const clips = {};
  for (const [k, c] of Object.entries(plan.clips ?? {})) clips[k] = extract(c);
  plan.clips = clips;
  const fps = spec.fps ?? 30;
  const W = spec.w, H = spec.h;
  const scale = PREVIEW || 1;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error(`[${spec.id}] page error`, e.message));
  await page.goto(`${STATIC}/_studio/kit/stage.html`);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async ({ spec, plan }) => {
    window.size(spec.w, spec.h);
    const stage = document.getElementById('stage');
    stage.innerHTML = '';
    const mod = await import(`../formats/${spec.format}.js?v=${Date.now()}`);
    const { settle } = await import('./kit.js');
    window.__seek = await mod.mount(stage, spec, plan);
    await settle(stage);
    await document.fonts.ready;
  }, { spec, plan });
  const cdp = await page.context().newCDPSession(page);
  const videoTmp = join(TMP, `${spec.id}.video.mp4`);
  const total = Math.round(plan.duration * fps);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', PREVIEW ? 'veryfast' : 'medium', '-crf', PREVIEW ? '26' : '18', '-profile:v', 'high', '-movflags', '+faststart', videoTmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await cdp.send('Runtime.evaluate', { expression: `window.__seek(${i / fps})`, awaitPromise: true });
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, captureBeyondViewport: false });
    if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
  const audioTmp = join(TMP, `${spec.id}.audio.m4a`);
  mixAudio(spec, plan, audioTmp);
  const final = PREVIEW ? join(TMP, `${spec.id}.preview.mp4`) : out;
  mkdirSync(dirname(final), { recursive: true });
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', videoTmp, '-i', audioTmp, '-c', 'copy', '-shortest', '-movflags', '+faststart', final]);
  rmSync(videoTmp, { force: true });
  rmSync(audioTmp, { force: true });
  // Frames are cheap to re-extract and big to keep.
  if (!PREVIEW) for (const c of Object.values(clips)) rmSync(join(FRAMES, c.key), { recursive: true, force: true });
  const secs = (Date.now() - t0) / 1000;
  return `${(statSync(final).size / 1e6).toFixed(1)} MB, ${plan.duration.toFixed(1)}s video in ${secs.toFixed(0)}s`;
}

const stop = await startSite({ dev: false });
const all = (await specs()).filter((s) => !filters.length || filters.some((f) => s.id.includes(f)));
console.log(`${all.length} videos`);
const queue = [...all];
const browsers = [];
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-background-timer-throttling'] });
  browsers.push(browser);
  while (queue.length) {
    const spec = queue.shift();
    try {
      const r = await renderOne(browser, spec);
      console.log(`${spec.id}: ${r}`);
    } catch (e) {
      console.error(`${spec.id}: FAILED`, e.stack ?? e);
    }
  }
}));
for (const b of browsers) await b.close();
stop();
process.exit(0);
