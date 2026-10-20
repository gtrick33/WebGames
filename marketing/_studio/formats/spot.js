// "Spot the Glitch" challenge short: two of the game's own pictures (drawn by its renderer), a
// ticking countdown, then the five differences circled one by one, and a CTA card.
import { C, clamp, css, el, ease, lerp, pop, prog } from '../kit/kit.js';
import { countdown, hook, markup, outro, paperBG, sticker, watermark } from '../kit/video.js';

const INTRO = 1.8;

export function plan(spec) {
  const d = spec.data;
  const secs = d.seconds ?? 10;
  const reveal = INTRO + secs + 0.6;
  const duration = reveal + 5 * 0.7 + 1.6 + 3.2;
  const sfx = [{ id: 'whoosh', t: 0.05, gain: 0.5 }, { id: 'pop', t: 0.35 }, { id: 'pop', t: 0.6 }];
  for (let i = 0; i < secs; i++) sfx.push({ id: i >= secs - 3 ? 'beep' : 'tick', t: INTRO + i, gain: i >= secs - 3 ? 0.45 : 0.7 });
  sfx.push({ id: 'buzz', t: INTRO + secs, gain: 0.45 });
  for (let i = 0; i < 5; i++) sfx.push({ id: 'ding', t: reveal + i * 0.7, gain: 0.55 });
  sfx.push({ id: 'sparkle', t: reveal + 3.6, gain: 0.5 });
  return { duration, sfx, music: spec.music };
}

export async function mount(stage, spec) {
  const d = spec.data;
  const p = d.puzzle;
  const W = spec.w, H = spec.h;
  const secs = d.seconds ?? 10;
  const reveal = INTRO + secs + 0.6;
  const ups = [paperBG(stage, { w: W, h: H, seed: 7, shapes: 12 })];

  const title = el('div', { class: 'abs' });
  css(title, { left: '60px', top: '170px', width: '700px', zIndex: 10 });
  title.innerHTML = `<div class="chip" style="background:${C.lime};font-size:30px;border-width:5px;box-shadow:6px 6px 0 ${C.ink}">Spot the Glitch · ${p.themeName}</div>
    <div class="display" style="font-size:78px;margin-top:22px;line-height:.98">${markup(d.title ?? 'Find all *5* differences')}</div>`;
  stage.appendChild(title);
  const cd = countdown(stage, { x: 900, y: 270, r: 96 });

  const pw = 820, ph = 615, px = (W - pw) / 2;
  const ys = [420, 420 + ph + 30];
  const pics = ['a', 'b'].map((s, i) => {
    const box = el('div', { class: 'abs' });
    css(box, { left: `${px}px`, top: `${ys[i]}px`, width: `${pw}px`, height: `${ph}px`, border: `8px solid ${C.ink}`, borderRadius: '40px', overflow: 'hidden', boxShadow: `16px 16px 0 ${C.ink}`, zIndex: 8, background: '#fff' });
    const k = (pw - 16) / p.W;
    box.innerHTML = `<img src="/_studio/.cache/content/spot/${p.id}-${s}.png" style="width:100%;height:100%;display:block">
      <svg class="abs" style="inset:0" viewBox="0 0 ${p.W} ${p.H}">${p.diffs.map((df, j) => df.spots.map((sp) => `<circle class="ring r${j}" cx="${sp.x}" cy="${sp.y}" r="${sp.r + 6}" fill="none" stroke="${C.magenta}" stroke-width="${5 / k * 2.4}" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>`).join('')).join('')}</svg>`;
    stage.appendChild(box);
    return box;
  });
  const label = (i, text, bg) => {
    const s = el('div', { class: 'abs chip' });
    css(s, { left: `${px + 26}px`, top: `${ys[i] + 22}px`, zIndex: 9, background: bg, fontSize: '26px', borderWidth: '5px' });
    s.textContent = text;
    stage.appendChild(s);
  };
  label(0, 'Original', '#fff');
  label(1, 'Glitched', C.yellow);

  const timeUp = sticker(stage, { text: "Time's up!", at: INTRO + secs, dur: 1.4, x: 540, y: ys[1] - 17, size: 72, bg: C.coral, rot: -5 });
  const howMany = sticker(stage, { text: d.ask ?? 'How many did you get?', at: reveal + 3.6, dur: 1.8, x: 540, y: ys[1] - 17, size: 58, bg: C.cyan, rot: 3 });
  ups.push(timeUp, howMany);
  if (d.hook) ups.push(hook(stage, { text: d.hook, at: 0, dur: INTRO, y: 860, size: 92 }));
  watermark(stage, { x: 60, y: H - 150, size: 48 });
  const o = outro(stage, { at: reveal + 5 * 0.7 + 1.6, w: W, h: H, title: d.outroTitle ?? 'New pictures|*every day*', line: 'Spot the Glitch: free, in your browser.', art: '/games/spot-the-glitch/tile.webp' });

  const rings = pics.map((b) => [...b.querySelectorAll('.ring')]);
  return async (t) => {
    pics.forEach((b, i) => {
      const k = pop(t, 0.3 + i * 0.25, 0.5);
      b.style.transform = `scale(${lerp(0.6, 1, k)}) rotate(${(i ? 1 : -1) * (1 - k) * 6}deg)`;
      b.style.opacity = String(clamp(k * 2));
    });
    title.style.transform = `scale(${lerp(0.7, 1, pop(t, 0.05, 0.5))})`;
    cd(t, INTRO, secs);
    for (const rs of rings) {
      for (const r of rs) {
        const j = Number([...r.classList].find((c) => /^r\d/.test(c)).slice(1));
        const k = ease.out(prog(t, reveal + j * 0.7, reveal + j * 0.7 + 0.45));
        r.setAttribute('stroke-dashoffset', String(100 * (1 - k)));
      }
    }
    for (const u of ups) u(t);
    o(t);
  };
}
