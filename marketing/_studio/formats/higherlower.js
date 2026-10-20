// "Gut Check" higher-or-lower short: real pairs from the game's bank, a beat to guess each one,
// the number counting up, and a CTA card.
import { C, clamp, css, el, ease, lerp, pop, prog } from '../kit/kit.js';
import { countdown, hook, markup, outro, paperBG, sticker, watermark } from '../kit/video.js';

const INTRO = 1.4;
const ASK = 3;
const SHOW = 2.2;

export function plan(spec) {
  const n = spec.data.pairs.length;
  const sfx = [{ id: 'whoosh', t: 0.05, gain: 0.5 }];
  for (let k = 0; k < n; k++) {
    const at = INTRO + k * (ASK + SHOW);
    sfx.push({ id: 'pop', t: at, gain: 0.5 });
    for (let i = 0; i < ASK; i++) sfx.push({ id: 'tick', t: at + i, gain: 0.5 });
    sfx.push({ id: 'coin', t: at + ASK + 0.7, gain: 0.55 });
  }
  return { duration: INTRO + n * (ASK + SHOW) + 3.2, sfx };
}

export async function mount(stage, spec) {
  const d = spec.data;
  const W = spec.w, H = spec.h;
  const ups = [paperBG(stage, { w: W, h: H, seed: 31, shapes: 12 })];
  const bg = el('div', { class: 'abs' });
  css(bg, { inset: '0', background: 'linear-gradient(180deg, rgba(255,79,200,.0), rgba(255,79,200,.18))', zIndex: 1 });
  stage.appendChild(bg);
  const head = el('div', { class: 'abs' });
  css(head, { left: '60px', top: '170px', right: '220px', zIndex: 10 });
  head.innerHTML = `<div class="sticker" style="background:${C.magenta};color:#fff;font-size:44px;transform:rotate(-3deg)">Gut Check</div>
    <div class="display q" style="font-size:72px;margin-top:26px">${markup(d.question)}</div>`;
  stage.appendChild(head);
  const cd = countdown(stage, { x: 920, y: 260, r: 84 });
  const streak = sticker(stage, { text: '0', at: INTRO, dur: 99, x: 920, y: 420, size: 40, bg: C.yellow, rot: 0, mono: true });
  const streakEl = stage.lastElementChild;

  const card = (y) => {
    const c = el('div', { class: 'abs card' });
    css(c, { left: '90px', right: '90px', top: `${y}px`, height: '420px', zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', textAlign: 'center', padding: '30px 50px' });
    c.innerHTML = `<div class="nm" style="font-weight:800;font-size:76px;letter-spacing:-0.035em;line-height:1.02"></div><div class="vl mono" style="font-size:46px;font-weight:700;text-transform:none;letter-spacing:0.02em;color:#4a3d6b"></div>`;
    stage.appendChild(c);
    return { c, nm: c.querySelector('.nm'), vl: c.querySelector('.vl') };
  };
  const A = card(560), B = card(1060);
  const vs = el('div', { class: 'abs center display' });
  css(vs, { left: '480px', top: '952px', width: '120px', height: '120px', borderRadius: '50%', background: '#fff', border: `7px solid ${C.ink}`, fontSize: '52px', zIndex: 14, boxShadow: `7px 7px 0 ${C.ink}` });
  vs.textContent = 'vs';
  stage.appendChild(vs);
  const verdict = el('div', { class: 'abs sticker' });
  css(verdict, { left: '0', top: '0', zIndex: 16, fontSize: '58px', opacity: 0 });
  stage.appendChild(verdict);
  watermark(stage, { x: 60, y: H - 150, size: 48 });
  const end = INTRO + d.pairs.length * (ASK + SHOW);
  if (d.hook !== false) ups.push(hook(stage, { text: d.hook ?? 'Higher or lower? *Trust your gut.*', at: 0, dur: INTRO, y: 900, size: 92 }));
  ups.push(sticker(stage, { text: d.ask ?? 'How many did you get?', at: end - 1.6, dur: 1.6, x: 540, y: 980, size: 54, bg: C.cyan, rot: -3 }));
  const o = outro(stage, { at: end, w: W, h: H, title: d.outroTitle ?? 'Trust your *gut*', line: 'Gut Check: free, in your browser. How long can your streak go?', art: '/games/gut-check/tile.webp' });

  const fmtCount = (p, k) => {
    if (k >= 1) return p.b.shown;
    const m = /([\d,.]+)/.exec(p.b.shown);
    if (!m) return p.b.shown;
    const num = parseFloat(m[1].replace(/,/g, ''));
    const decimals = (m[1].split('.')[1] ?? '').length;
    const v = (num * ease.out(k)).toFixed(decimals);
    return p.b.shown.replace(m[1], Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  };
  return async (t) => {
    head.style.transform = `scale(${lerp(0.7, 1, pop(t, 0.05, 0.5))})`;
    const i = clamp(Math.floor((t - INTRO) / (ASK + SHOW)), 0, d.pairs.length - 1);
    const p = d.pairs[i];
    const lt = t - INTRO - i * (ASK + SHOW);
    A.nm.innerHTML = markup(p.a.name);
    A.vl.textContent = p.a.shown;
    B.nm.innerHTML = markup(p.b.name);
    const rk = prog(lt, ASK, ASK + 0.7);
    B.vl.textContent = lt < ASK ? '?' : fmtCount(p, rk);
    B.vl.style.fontSize = lt < ASK ? '90px' : '46px';
    const k = pop(lt, 0, 0.4);
    A.c.style.transform = `translateX(${(1 - k) * -60}px) rotate(-1.5deg)`;
    B.c.style.transform = `translateX(${(1 - k) * 60}px) rotate(1.5deg)`;
    B.c.style.background = lt > ASK + 0.7 ? C.lime : '#fff';
    cd(t, INTRO + i * (ASK + SHOW), ASK);
    const vk = pop(lt, ASK + 0.7, 0.4);
    verdict.style.opacity = lt > ASK + 0.7 ? '1' : '0';
    verdict.innerHTML = markup(p.more ? `${p.moreWord} ↑` : `${p.lessWord} ↓`);
    verdict.style.background = p.more ? C.cyan : C.coral;
    verdict.style.transform = `translate(${540 - verdict.offsetWidth / 2}px, ${1500 - verdict.offsetHeight / 2}px) rotate(-4deg) scale(${lerp(0.3, 1, vk)})`;
    streakEl.innerHTML = `Streak ${t < INTRO ? 0 : i + (lt > ASK + 0.7 ? 1 : 0)}`;
    for (const u of ups) u(t);
    o(t);
  };
}
