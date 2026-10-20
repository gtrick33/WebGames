// Feed posts (4:5, 1080x1350) and carousel slides. One template, many kinds, all sharing the same
// paper background, footer and type scale so the grid reads as one brand.
import { C, HANDLE, SITE, esc, markSVG, wordmark } from '../kit/kit.js';

const mk = (s, hi = C.yellow) => esc(String(s ?? '').replace(/\p{Extended_Pictographic}️?/gu, '')).replace(/\|/g, '<br>').replace(/\*([^*]+)\*/g, `<span style="color:#1d1238;background:${hi};padding:0 .12em;border-radius:.16em;box-decoration-break:clone;-webkit-box-decoration-break:clone">$1</span>`);

function frame(stage, d, inner) {
  const bg = d.dark ? `radial-gradient(circle at 50% 30%, #2a1a52, ${C.night} 80%)` : C.paper;
  stage.style.background = bg;
  stage.innerHTML = `
    <div class="abs ${d.dark ? '' : 'dots'}" style="inset:0;opacity:.9"></div>
    <div class="abs" style="inset:0;background:${d.wash ?? `radial-gradient(circle at 12% 10%, ${d.accent ?? C.cyan}55, transparent 36%),radial-gradient(circle at 92% 22%, rgba(255,201,40,.35), transparent 32%),radial-gradient(circle at 88% 92%, rgba(255,79,200,.28), transparent 36%),radial-gradient(circle at 8% 88%, rgba(182,230,44,.3), transparent 32%)`}"></div>
    <div class="abs" style="inset:0">${inner}</div>
    ${d.footer === false ? '' : `<div class="abs ${d.dark ? 'on-dark' : ''}" style="left:60px;right:60px;bottom:44px;height:84px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:16px">${markSVG({ size: 70 })}${wordmark(48)}</div>
      <div class="mono" style="font-size:24px;font-weight:700;color:${d.dark ? '#d8d0f0' : '#4a3d6b'}">${d.page ? esc(d.page) : esc(SITE)}</div>
    </div>`}`;
}

const chip = (text, bg = '#fff', extra = '') => `<span class="chip" style="background:${bg};font-size:28px;border-width:5px;box-shadow:6px 6px 0 ${C.ink};${extra}">${mk(text)}</span>`;

export default async function (stage, d) {
  const k = d.kind;
  const accent = d.accent ?? C.cyan;

  if (k === 'game' || k === 'new' || k === 'party') {
    const art = d.art;
    frame(stage, d, `
      <div style="position:absolute;left:60px;right:60px;top:56px;display:flex;justify-content:space-between;align-items:center">
        ${chip(d.eyebrow ?? (k === 'party' ? 'Party Mode' : 'Free browser game'), accent)}
        ${d.number ? `<span class="mono" style="font-size:34px;font-weight:700">${esc(d.number)}</span>` : k === 'new' ? `<span class="sticker" style="background:${C.lime};font-size:44px;transform:rotate(6deg)">New!</span>` : ''}
      </div>
      <div class="tile-art" style="position:absolute;left:190px;top:150px;width:700px;height:700px;border-radius:84px;border-width:9px;box-shadow:22px 22px 0 ${C.ink};transform:rotate(-2.5deg)"><img src="${art}"></div>
      <div style="position:absolute;left:60px;right:60px;top:900px;text-align:center">
        <div class="display" style="font-size:${d.title.length > 13 ? 96 : 118}px">${mk(d.title)}</div>
        <div style="font-size:38px;font-weight:600;line-height:1.24;color:#4a3d6b;margin:18px auto 0;max-width:900px">${mk(d.line)}</div>
        ${d.chips ? `<div style="display:flex;gap:14px;justify-content:center;margin-top:22px">${d.chips.map((c, i) => chip(c, [C.cyan, C.yellow, C.lime, C.magenta][i % 4])).join('')}</div>` : ''}
      </div>`);
    return;
  }

  if (k === 'cover') {
    // Carousel cover: a stack of game tiles fanned out behind a big title.
    const arts = d.arts.slice(0, 7);
    frame(stage, d, `
      ${arts.map((a, i) => {
        const mid = (arts.length - 1) / 2;
        return `<div class="tile-art" style="position:absolute;left:${70 + (7 - arts.length) * 60 + i * 120}px;top:${170 + Math.abs(i - mid) * 34}px;width:260px;height:260px;border-radius:40px;transform:rotate(${(i - mid) * 7}deg);box-shadow:10px 10px 0 ${C.ink};z-index:${10 - Math.round(Math.abs(i - mid))}"><img src="${a}"></div>`;
      }).join('')}
      <div style="position:absolute;left:60px;right:60px;top:${d.titleTop ?? 700}px;text-align:center">
        ${d.eyebrow ? `<div style="margin-bottom:26px">${chip(d.eyebrow, accent)}</div>` : ''}
        <div class="display" style="font-size:${d.size ?? 112}px">${mk(d.title)}</div>
        ${d.line ? `<div style="font-size:40px;font-weight:600;color:#4a3d6b;margin-top:22px">${mk(d.line)}</div>` : ''}
        ${d.swipe ? `<div style="margin-top:34px"><span class="sticker" style="background:${C.cyan};font-size:40px">Swipe &rarr;</span></div>` : ''}
      </div>`);
    return;
  }

  if (k === 'cta') {
    frame(stage, d, `
      <div style="position:absolute;inset:0 60px 160px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:34px">
        ${markSVG({ size: 280 })}
        <div class="display" style="font-size:${d.size ?? 104}px">${mk(d.title)}</div>
        <div style="font-size:42px;font-weight:600;color:#4a3d6b;max-width:900px;line-height:1.25">${mk(d.line ?? 'Free in your browser. No download, no sign-up.')}</div>
        <span class="btn" style="font-size:54px">${esc(d.cta ?? SITE)}</span>
        ${d.small ? `<div class="mono" style="font-size:26px;font-weight:700;color:#4a3d6b">${mk(d.small)}</div>` : ''}
      </div>`);
    return;
  }

  if (k === 'quote') {
    frame(stage, { ...d, wash: `radial-gradient(circle at 20% 20%, ${accent}66, transparent 45%), radial-gradient(circle at 85% 85%, ${d.accent2 ?? C.magenta}44, transparent 45%)` }, `
      <div style="position:absolute;left:80px;right:80px;top:120px;bottom:180px;display:flex;flex-direction:column;justify-content:center;gap:40px">
        ${d.eyebrow ? `<div>${chip(d.eyebrow, accent)}</div>` : ''}
        <div class="display" style="font-size:${d.size ?? 132}px;line-height:.98;color:${d.dark ? '#fff' : C.ink}">${mk(d.title, d.hi ?? C.yellow)}</div>
        ${d.line ? `<div style="font-size:44px;font-weight:600;color:${d.dark ? '#d8d0f0' : '#4a3d6b'};line-height:1.25">${mk(d.line)}</div>` : ''}
      </div>`);
    return;
  }

  if (k === 'trivia-q' || k === 'trivia-a') {
    const q = d.q;
    const L = 'ABCD';
    const reveal = k === 'trivia-a';
    frame(stage, { ...d, accent: q.catColor }, `
      <div style="position:absolute;left:60px;right:60px;top:56px;display:flex;justify-content:space-between;align-items:center">
        <span class="sticker" style="background:${C.yellow};font-size:42px;transform:rotate(-3deg)">Quizbelief</span>
        ${chip(q.catLabel, '#fff')}
      </div>
      <div style="position:absolute;left:60px;right:60px;top:180px;bottom:150px;display:flex;flex-direction:column;gap:18px">
        <div class="card" style="padding:38px 46px;border-radius:46px;margin-bottom:10px">
          <div style="font-weight:800;font-size:${q.text.length > 80 ? 52 : 60}px;line-height:1.1;letter-spacing:-0.03em">${mk(q.text)}</div>
        </div>
        ${q.answers.map((a, i) => `<div style="display:flex;align-items:center;gap:20px;background:${reveal && i === q.correct ? C.lime : '#fff'};opacity:${reveal && i !== q.correct ? 0.45 : 1};border:6px solid ${C.ink};border-radius:999px;padding:12px 26px;box-shadow:7px 7px 0 ${C.ink};font-weight:800;font-size:40px">
          <span class="mono" style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;border:5px solid ${C.ink};background:${C.paper};font-size:28px;flex:none">${L[i]}</span>${mk(a)}</div>`).join('')}
        <div style="flex:1"></div>
        ${reveal ? `<div class="card" style="padding:26px 36px;border-radius:38px;background:${C.yellow};transform:rotate(-1deg)"><div style="font-weight:800;font-size:38px">Wait, what?</div><div style="font-weight:600;font-size:32px;line-height:1.25;margin-top:6px">${mk(q.fact)}</div></div>`
        : `<div style="text-align:center"><span class="sticker" style="background:${C.cyan};font-size:40px">Answer on the next slide &rarr;</span></div>`}
      </div>`);
    return;
  }

  if (k === 'spot-q' || k === 'spot-a') {
    const p = d.puzzle;
    const reveal = k === 'spot-a';
    const pw = 700, ph = 525;
    const pic = (s, top) => `<div style="position:absolute;left:${(1080 - pw) / 2}px;top:${top}px;width:${pw}px;height:${ph}px;border:7px solid ${C.ink};border-radius:36px;overflow:hidden;box-shadow:14px 14px 0 ${C.ink};background:#fff">
      <img src="/_studio/.cache/content/spot/${p.id}-${s}.png" style="width:100%;height:100%;display:block">
      ${reveal ? `<svg style="position:absolute;inset:0" viewBox="0 0 ${p.W} ${p.H}">${p.diffs.map((df) => df.spots.map((sp) => `<circle cx="${sp.x}" cy="${sp.y}" r="${sp.r + 6}" fill="none" stroke="${C.magenta}" stroke-width="6"/>`).join('')).join('')}</svg>` : ''}</div>`;
    frame(stage, { ...d, footer: false }, `
      <div style="position:absolute;left:60px;right:60px;top:40px;display:flex;justify-content:space-between;align-items:center">
        ${chip(`Spot the Glitch · ${p.themeName}`, C.lime)}
        <span class="display" style="font-size:54px">${mk(reveal ? 'Answers' : 'Find *5*')}</span>
      </div>
      ${pic('a', 130)}${pic('b', 130 + ph + 36)}
      <div style="position:absolute;left:0;right:0;bottom:22px;display:flex;justify-content:center;align-items:center;gap:16px">${markSVG({ size: 54 })}${wordmark(38)}<span class="mono" style="font-size:22px;font-weight:700;color:#4a3d6b;margin-left:10px">${reveal ? 'How many did you get?' : 'Answer on the next slide'}</span></div>`);
    return;
  }

  if (k === 'ball-q' || k === 'ball-a') {
    const b = d.level;
    const reveal = k === 'ball-a';
    const fw = 960, fh = 1000;
    const base = fh / b.ch;
    const bx = (b.ball.x / b.W) * b.cw, by = (b.ball.y / b.H) * b.ch;
    const shown = fw / base;
    const left = Math.max(0, Math.min(b.cw - shown, bx - shown * 0.45));
    const z = reveal ? 2 : 1;
    const scale = base * z;
    const cx = reveal ? bx : left + shown / 2, cy = reveal ? by : b.ch / 2;
    const ox = fw / 2 - cx * scale, oy = fh / 2 - cy * scale;
    const rr = (b.ball.r / b.W) * b.cw * scale * 1.9 + 18;
    frame(stage, { ...d, footer: false }, `
      <div style="position:absolute;left:60px;right:60px;top:44px;display:flex;justify-content:space-between;align-items:center">
        ${chip("Where's the Ball?", C.lime)}
        <span class="display" style="font-size:52px">${mk(reveal ? 'Found it!' : 'Find the *ball*')}</span>
      </div>
      <div style="position:absolute;left:60px;top:140px;width:${fw}px;height:${fh}px;border:7px solid ${C.ink};border-radius:40px;overflow:hidden;box-shadow:16px 16px 0 ${C.ink}">
        <img src="/_studio/.cache/content/ball/${b.id}.jpg" style="position:absolute;left:0;top:0;transform-origin:0 0;transform:translate(${ox}px,${oy}px) scale(${scale})">
        ${reveal ? `<div style="position:absolute;left:${ox + bx * scale - rr}px;top:${oy + by * scale - rr}px;width:${rr * 2}px;height:${rr * 2}px;border-radius:50%;border:10px solid ${C.magenta};box-shadow:0 0 0 6px #fff"></div>` : ''}
      </div>
      <div class="mono" style="position:absolute;left:60px;right:60px;top:${140 + fh + 22}px;text-align:center;font-size:20px;text-transform:none;letter-spacing:.02em;color:#4a3d6b">Photo: ${esc(b.creator)} (${esc(b.license.toUpperCase())}), Wikimedia Commons</div>
      <div style="position:absolute;left:0;right:0;bottom:28px;display:flex;justify-content:center;align-items:center;gap:16px">${markSVG({ size: 54 })}${wordmark(38)}<span class="mono" style="font-size:22px;font-weight:700;color:#4a3d6b;margin-left:10px">${reveal ? 'Did you spot it?' : 'Answer on the next slide'}</span></div>`);
    return;
  }

  if (k === 'blank') {
    frame(stage, d, '');
  }
}
