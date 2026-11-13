// Renders a trailer's graphics as a film of its own with a transparent ground (QuickTime Animation, lossless),
// one frame per 1/60 s, to lay over the footage. A frame that is the same as the one before is not drawn twice.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FFMPEG, HERE } from '../lib.mjs';

const LOGO = readFileSync(join(HERE, '../../../glitchbound/public/games/sigilfall/logo.svg'), 'utf8').replace(/ width="\d+" height="\d+"/, '');

export async function renderGfx(items, file, { seconds, fps = 60, w = 1920, h = 1080, upright = false, stillAt = null } = {}) {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, 'gfx/stage.html')).href);
  // (each trailer's own ids for the logo's gradients are fine: one logo per item, same defs)
  await page.evaluate((spec) => window.setup(spec), { items, logo: LOGO, w, h, upright });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const shot = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })).data, 'base64');
  if (stillAt !== null) {
    await page.evaluate((t) => window.draw(t), stillAt);
    const png = await shot();
    await browser.close();
    return png;
  }
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-', '-c:v', 'qtrle', '-pix_fmt', 'argb', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(seconds * fps);
  let prevSig = null;
  let prev = null;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    const sig = await page.evaluate((t) => window.draw(t), i / fps + 0.5 / fps);
    if (sig !== prevSig) {
      prev = await shot();
      prevSig = sig;
      drawn++;
    }
    if (!ff.stdin.write(prev)) await new Promise((ok) => ff.stdin.once('drain', ok));
  }
  ff.stdin.end();
  await new Promise((ok) => ff.on('close', ok));
  await browser.close();
  return { frames: n, drawn };
}
