// YouTube thumbnails (1280x720): huge words, the game's art tilted, the logo, a frame from real
// gameplay (passed as an image path) and high-contrast colors that survive being tiny.
import { C, esc, markSVG } from '../kit/kit.js';

const mk = (s, hi = C.yellow) => esc(String(s ?? '').replace(/\p{Extended_Pictographic}️?/gu, '')).replace(/\|/g, '<br>').replace(/\*([^*]+)\*/g, `<span style="color:#1d1238;background:${hi};padding:0 .1em;border-radius:.14em;box-decoration-break:clone;-webkit-box-decoration-break:clone">$1</span>`);

export default async function (stage, d) {
  const bg = d.bg ?? C.cyan;
  stage.style.background = bg;
  stage.innerHTML = `
    <div class="abs" style="inset:0;background:radial-gradient(circle at 75% 40%, rgba(255,255,255,.45), transparent 45%)"></div>
    <div class="abs dots" style="inset:0;opacity:.6"></div>
    ${d.shot ? `<div class="abs" style="right:70px;top:40px;width:360px;height:640px;border:8px solid ${C.ink};border-radius:40px;overflow:hidden;box-shadow:16px 16px 0 ${C.ink};transform:rotate(4deg);background:#000"><img src="${d.shot}" style="width:100%;height:100%;object-fit:cover"></div>` : ''}
    ${d.art ? `<div class="tile-art abs" style="left:${d.shot ? 560 : 820}px;top:${d.shot ? 360 : 140}px;width:${d.shot ? 280 : 400}px;height:${d.shot ? 280 : 400}px;border-radius:50px;transform:rotate(-8deg);border-width:8px;box-shadow:14px 14px 0 ${C.ink}"><img src="${d.art}"></div>` : ''}
    <div class="abs" style="left:56px;top:56px;width:${d.shot || d.art ? 620 : 1160}px">
      <div class="display" style="font-size:${d.size ?? 118}px;line-height:.95;color:${C.ink};text-shadow:6px 6px 0 #fff">${mk(d.title, d.hi ?? C.yellow)}</div>
    </div>
    <div class="abs" style="left:56px;bottom:46px;display:flex;align-items:center;gap:16px">${markSVG({ size: 92 })}
      ${d.tag ? `<span class="sticker" style="font-size:40px;background:#fff">${mk(d.tag)}</span>` : ''}</div>`;
}
