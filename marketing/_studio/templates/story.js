// Stories (9:16, 1080x1920): daily reminders, polls, score brags and Instagram highlight covers.
// Leave the marked areas clear: Instagram puts link / poll stickers there.
import { C, HANDLE, SITE, esc, markSVG, wordmark } from '../kit/kit.js';

const mk = (s, hi = C.yellow) => esc(String(s ?? '').replace(/\p{Extended_Pictographic}️?/gu, '')).replace(/\|/g, '<br>').replace(/\*([^*]+)\*/g, `<span style="color:#1d1238;background:${hi};padding:0 .12em;border-radius:.16em;box-decoration-break:clone;-webkit-box-decoration-break:clone">$1</span>`);
const chip = (text, bg = '#fff') => `<span class="chip" style="background:${bg};font-size:32px;border-width:5px;box-shadow:6px 6px 0 ${C.ink}">${mk(text)}</span>`;

/** "Play free: glitchboundstudio.com · link in bio", for stories posted without a link sticker. */
const linkLine = (top) => `<div style="position:absolute;left:0;right:0;top:${top}px;display:flex;flex-direction:column;align-items:center;gap:22px">
  <span class="btn" style="font-size:50px">${esc(SITE)}</span>
  <span class="mono" style="font-size:30px;font-weight:700;color:#4a3d6b">Play free · link in bio</span></div>`;

function base(stage, d, inner) {
  stage.style.background = d.dark ? `radial-gradient(circle at 50% 30%, #2a1a52, ${C.night} 80%)` : C.paper;
  stage.innerHTML = `<div class="abs ${d.dark ? '' : 'dots'}" style="inset:0"></div>
    <div class="abs" style="inset:0;background:radial-gradient(circle at 15% 12%, ${(d.accent ?? C.cyan)}55, transparent 34%),radial-gradient(circle at 90% 40%, rgba(255,201,40,.32), transparent 30%),radial-gradient(circle at 85% 90%, rgba(255,79,200,.26), transparent 36%),radial-gradient(circle at 10% 80%, rgba(182,230,44,.28), transparent 32%)"></div>
    <div class="abs" style="inset:0">${inner}</div>
    ${d.logo === false ? '' : `<div class="abs ${d.dark ? 'on-dark' : ''}" style="left:0;right:0;top:150px;display:flex;justify-content:center;align-items:center;gap:18px">${markSVG({ size: 80 })}${wordmark(56)}</div>`}`;
}

export default async function (stage, d) {
  const k = d.kind;
  if (k === 'daily') {
    base(stage, d, `
      <div style="position:absolute;left:0;right:0;top:300px;text-align:center">${chip("Today's daily is live", d.accent ?? C.cyan)}</div>
      <div class="tile-art" style="position:absolute;left:190px;top:410px;width:700px;height:700px;border-radius:84px;border-width:9px;box-shadow:22px 22px 0 ${C.ink};transform:rotate(-3deg)"><img src="${d.art}"></div>
      <div style="position:absolute;left:70px;right:70px;top:1170px;text-align:center">
        <div class="display" style="font-size:112px">${mk(d.title)}</div>
        <div style="font-size:42px;font-weight:600;color:#4a3d6b;margin-top:18px;line-height:1.25">${mk(d.line ?? 'Same puzzle for everyone. Resets at midnight.')}</div>
      </div>
      ${linkLine(1470)}`);
    return;
  }
  if (k === 'poll') {
    const [a, b] = d.games;
    const card = (g, rot, x) => `<div style="position:absolute;left:${x}px;top:470px;width:440px;text-align:center;transform:rotate(${rot}deg)">
      <div class="tile-art" style="width:440px;height:440px;border-radius:60px"><img src="${g.art}"></div>
      <div class="display" style="font-size:64px;margin-top:26px">${mk(g.title)}</div></div>`;
    base(stage, d, `
      <div style="position:absolute;left:70px;right:70px;top:290px;text-align:center" class="display"><span style="font-size:${d.size ?? 92}px">${mk(d.title)}</span></div>
      ${card(a, -4, 70)}${card(b, 4, 570)}
      <div class="abs center display" style="left:470px;top:620px;width:140px;height:140px;border-radius:50%;background:#fff;border:7px solid ${C.ink};font-size:58px;box-shadow:8px 8px 0 ${C.ink};z-index:3">or</div>
      <div style="position:absolute;left:170px;right:170px;top:1180px;height:300px;border:5px dashed ${C.ink}55;border-radius:36px;display:flex;align-items:center;justify-content:center" class="mono"><span style="font-size:26px;font-weight:700;color:${C.ink}77">poll sticker here</span></div>`);
    return;
  }
  if (k === 'beat') {
    base(stage, d, `
      <div style="position:absolute;left:0;right:0;top:320px;text-align:center">${chip('Beat my score', C.yellow)}</div>
      <div class="tile-art" style="position:absolute;left:340px;top:430px;width:400px;height:400px;border-radius:60px;transform:rotate(4deg)"><img src="${d.art}"></div>
      <div style="position:absolute;left:60px;right:60px;top:900px;text-align:center">
        <div class="display" style="font-size:96px">${mk(d.title)}</div>
        <div class="display" style="font-size:300px;line-height:1;margin-top:10px;color:${C.magenta};-webkit-text-stroke:10px ${C.ink};paint-order:stroke fill">${esc(d.score ?? '000')}</div>
        <div style="font-size:44px;font-weight:600;color:#4a3d6b">${mk(d.line ?? 'Your turn.')}</div>
      </div>
      ${linkLine(1530)}`);
    return;
  }
  if (k === 'announce') {
    base(stage, d, `
      <div style="position:absolute;left:70px;right:70px;top:330px;bottom:300px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:40px">
        ${d.eyebrow ? chip(d.eyebrow, d.accent ?? C.cyan) : ''}
        ${d.art ? `<div class="tile-art" style="width:620px;height:620px;border-radius:80px;transform:rotate(-3deg)"><img src="${d.art}"></div>` : ''}
        <div class="display" style="font-size:${d.size ?? 120}px;color:${d.dark ? '#fff' : C.ink}">${mk(d.title)}</div>
        ${d.line ? `<div style="font-size:46px;font-weight:600;color:${d.dark ? '#d8d0f0' : '#4a3d6b'};line-height:1.25">${mk(d.line)}</div>` : ''}
        <span class="btn" style="font-size:52px">${esc(d.cta ?? SITE)}</span>
      </div>`);
    return;
  }
  if (k === 'highlight') {
    // Instagram highlight cover: the icon sits in the middle circle (cropped to ~ 600px).
    stage.style.background = d.bg;
    stage.innerHTML = `<div class="abs center" style="inset:0;flex-direction:column;gap:40px">
      <div class="center" style="width:640px;height:640px;border-radius:50%;background:#fff;border:12px solid ${C.ink};box-shadow:20px 20px 0 ${C.ink}">${d.icon}</div></div>`;
    return;
  }
  if (k === 'blank') base(stage, d, '');
}
