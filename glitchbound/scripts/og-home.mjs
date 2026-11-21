/**
 * The picture a shared link to the arcade carries (public/og-home.jpg, 1200 by 630): GlitchBound's name and its line
 * on the arcade's blue with its toys, and Sigilfall on a card beside them, the arcade's original, as the home page has
 * it (src/components/SigilfallHero.tsx). Drawn in a browser from the site's own fonts and Sigilfall's key art, so it
 * needs Playwright (preinstalled in the cloud sessions; `npm i --no-save playwright` elsewhere). No server needed:
 *
 *   node scripts/og-home.mjs
 *
 * (It replaced og.png, the arcade's card from before Sigilfall, on 2026-11-21: the owner, "on the link share its the
 * old one". A new name, so the link previews that keep the old picture by its address fetch this one.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => pathToFileURL(join(ROOT, p)).href;
const b64 = (p) => readFileSync(join(ROOT, p)).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Brico; src: url(data:font/woff2;base64,${b64('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; }
@font-face { font-family: Mono; src: url(data:font/woff2;base64,${b64('node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2')}) format('woff2'); font-weight: 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { position: relative; font-family: Brico, sans-serif; color: #fff;
  background: radial-gradient(circle at 74% 50%, #6a4dff 0, #3d4cff 34%, #2a2fc8 78%);
}
/* the arcade's dot grid */
body::before { content: ''; position: absolute; inset: 0; background: radial-gradient(rgb(255 255 255 / 0.14) 1.4px, transparent 1.6px) 0 0 / 26px 26px; }
/* rays from behind the card */
.rays { position: absolute; left: 860px; top: 315px; width: 1500px; height: 1500px; translate: -50% -50%;
  background: repeating-conic-gradient(from 4deg, rgb(255 214 90 / 0.2) 0deg 7deg, transparent 7deg 22deg);
  -webkit-mask-image: radial-gradient(closest-side, #000 14%, transparent 62%); }
.glow { position: absolute; left: 860px; top: 315px; width: 720px; height: 520px; translate: -50% -50%; border-radius: 50%;
  background: radial-gradient(closest-side, rgb(255 201 40 / 0.55), rgb(255 79 200 / 0.2) 58%, transparent 80%); filter: blur(6px); }
.brand { position: absolute; left: 56px; top: 50px; display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 40px; letter-spacing: -0.02em; }
.brand img { width: 54px; height: 54px; }
.head { position: absolute; left: 56px; top: 182px; font-weight: 800; font-size: 60px; line-height: 0.98; letter-spacing: -0.035em; text-shadow: 5px 5px 0 #1d1238; }
.head span { display: block; color: #ffc928; }
.sub { position: absolute; left: 58px; top: 352px; width: 420px; font-size: 24px; line-height: 1.32; font-weight: 600; color: #e6e4ff; }
.foot { position: absolute; left: 58px; bottom: 44px; font: 700 15px Mono, monospace; letter-spacing: 0.08em; color: #cfd2ff; }
/* the card */
.card { position: absolute; left: 566px; top: 140px; width: 590px; height: 342px; rotate: -3deg; border: 4px solid #1d1238; border-radius: 26px; overflow: hidden;
  background: #07040f url(${at('public/games/sigilfall/key-art-1600.webp')}) 72% 60% / cover no-repeat;
  box-shadow: 12px 12px 0 #1d1238, 0 20px 70px rgb(255 170 40 / 0.45); }
.card::before { content: ''; position: absolute; inset: 0; border-radius: 22px; box-shadow: inset 0 0 0 3px #f6c453, inset 0 0 0 5px rgb(7 4 15 / 0.6);
  background: linear-gradient(180deg, transparent 46%, rgb(7 4 15 / 0.92) 92%); }
.card .logo { position: absolute; left: 50%; bottom: 56px; width: 300px; translate: -50% 0; filter: drop-shadow(0 4px 10px #000); }
.card .line { position: absolute; left: 0; right: 0; bottom: 24px; text-align: center; font: italic 700 20px Georgia, 'Liberation Serif', serif; color: #f4ecd8; text-shadow: 0 1px 3px #000; }
.badge { position: absolute; right: 18px; top: 18px; padding: 7px 13px 7px 11px; border: 2.5px solid #1d1238; border-radius: 999px; box-shadow: 3px 3px 0 #1d1238;
  background: linear-gradient(180deg, #ffe7a8, #f6c453 60%, #d9962e); color: #2a1406; font: 700 13px Mono, monospace; letter-spacing: 0.06em; }
/* the arcade's toys */
.toy { position: absolute; }
.ring { width: 58px; height: 58px; border: 15px solid #12c6b3; border-radius: 50%; box-shadow: 0 0 0 3px #1d1238, inset 0 0 0 3px #1d1238, 4px 4px 0 #1d1238; }
.pill { width: 110px; height: 44px; border: 3px solid #1d1238; border-radius: 999px; background: linear-gradient(180deg, #ffdc6b, #ffc928 55%); box-shadow: 5px 5px 0 #1d1238; rotate: -22deg; }
.ball { width: 52px; height: 52px; border: 3px solid #1d1238; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffb3bb 0 14%, #ff5a6c 16%); box-shadow: 4px 4px 0 #1d1238; }
.clip { filter: drop-shadow(5px 5px 0 #1d1238); background: #1d1238; }
.clip i { position: absolute; inset: 4px; clip-path: inherit; }
.tri { width: 74px; height: 70px; clip-path: polygon(50% 4%, 97% 92%, 3% 92%); }
.star { width: 84px; height: 84px; clip-path: polygon(50% 0, 61% 33%, 96% 25%, 70% 52%, 92% 84%, 57% 70%, 44% 100%, 38% 66%, 4% 76%, 28% 48%, 6% 18%, 40% 30%); }
.spark { width: 30px; height: 30px; background: #ffe27a; clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%); }
</style></head><body>
<i class="rays"></i><i class="glow"></i>
<div class="brand"><img src="${at('public/favicon.svg')}">GlitchBound</div>
<h1 class="head">Small games.<span>Big obsessions.</span></h1>
<p class="sub">Quick games that start in a second, and a whole fantasy RPG.</p>
<p class="foot">FREE BROWSER GAMES · NO INSTALLS · NO ACCOUNTS</p>
<i class="toy ring" style="left:1100px;top:40px"></i>
<i class="toy pill" style="left:470px;top:66px"></i>
<i class="toy clip tri" style="left:1106px;top:512px;rotate:16deg"><i style="background:#b6e62c"></i></i>
<i class="toy clip star" style="left:500px;top:470px;rotate:-8deg"><i style="background:#ff6a1a"></i></i>
<i class="toy ball" style="left:1000px;top:540px"></i>
<i class="toy spark" style="left:540px;top:110px"></i>
<i class="toy spark" style="left:1080px;top:480px;width:22px;height:22px"></i>
<div class="card"><img class="logo" src="${at('public/games/sigilfall/logo.svg')}"><p class="line">A free fantasy RPG in your browser</p><span class="badge">★ GLITCHBOUND ORIGINAL</span></div>
</body></html>`;

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const tmp = join(ROOT, '.cache', 'og-home.html');
writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
await page.evaluate('document.fonts.ready');
await page.waitForTimeout(300);
const png = await page.screenshot();
await browser.close();
// (a JPEG: the picture is a render, and a link preview wants it small)
const sharp = (await import('sharp')).default;
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(ROOT, 'public', 'og-home.jpg'));
console.log('written: public/og-home.jpg');
