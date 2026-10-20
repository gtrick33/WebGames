// "Quizbelief" trivia short: questions from the game's own bank, a countdown per question, the
// reveal and the game's "Wait, what?" fact, then a CTA card.
import { C, clamp, css, el, ease, lerp, pop, prog } from '../kit/kit.js';
import { countdown, hook, markup, outro, paperBG, sticker, watermark } from '../kit/video.js';

const INTRO = 1.6;
const ASK = 5;
const SHOW = 4.6;
const per = (q) => 0.6 + ASK + 0.4 + SHOW + Math.min(1.8, q.fact.length / 90);

export function plan(spec) {
  const qs = spec.data.questions;
  let at = INTRO;
  const sfx = [{ id: 'whoosh', t: 0.05, gain: 0.5 }, { id: 'notify', t: 0.4, gain: 0.5 }];
  for (const q of qs) {
    sfx.push({ id: 'pop', t: at + 0.1, gain: 0.5 });
    for (let i = 0; i < ASK; i++) sfx.push({ id: i >= ASK - 3 ? 'beep' : 'tick', t: at + 0.6 + i, gain: 0.5 });
    sfx.push({ id: 'ding', t: at + 0.6 + ASK + 0.1, gain: 0.6 });
    at += per(q);
  }
  return { duration: at + 3.2, sfx };
}

export async function mount(stage, spec) {
  const d = spec.data;
  const W = spec.w, H = spec.h;
  const ups = [paperBG(stage, { w: W, h: H, seed: 21, shapes: 12 })];
  const head = el('div', { class: 'abs' });
  css(head, { left: '60px', top: '170px', right: '220px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '20px' });
  head.innerHTML = `<div class="sticker" style="background:${C.yellow};font-size:46px;transform:rotate(-3deg)">Quizbelief</div>
    <div class="mono" style="font-size:26px;font-weight:700;color:#4a3d6b;line-height:1.3">${markup(d.kicker ?? 'Trivia that sounds|made up but isn\'t')}</div>`;
  stage.appendChild(head);
  const cd = countdown(stage, { x: 940, y: 210, r: 80 });
  const counter = el('div', { class: 'abs mono' });
  css(counter, { left: '60px', top: '330px', fontSize: '30px', fontWeight: 700, zIndex: 10 });
  stage.appendChild(counter);

  // One card per question, stacked; only the current one shows.
  let at = INTRO;
  const cards = d.questions.map((q, n) => {
    const start = at;
    at += per(q);
    const box = el('div', { class: 'abs' });
    css(box, { left: '60px', right: '60px', top: '470px', zIndex: 12, display: 'flex', flexDirection: 'column', gap: '26px' });
    const letters = 'ABCD';
    box.innerHTML = `
      <div class="card qcard" style="padding:44px 50px;border-radius:48px">
        <div class="chip" style="background:${q.catColor};color:#fff;border-color:${C.ink};font-size:26px;margin-bottom:22px">${markup(q.catLabel)}</div>
        <div class="qtext" style="font-weight:800;font-size:${q.text.length > 80 ? 58 : 66}px;line-height:1.08;letter-spacing:-0.03em">${markup(q.text)}</div>
      </div>
      ${q.answers.map((a, i) => `<div class="ans" data-i="${i}" style="display:flex;align-items:center;gap:24px;background:#fff;border:6px solid ${C.ink};border-radius:999px;padding:22px 34px;box-shadow:9px 9px 0 ${C.ink};font-weight:800;font-size:50px;letter-spacing:-0.02em">
        ${q.answers.length > 2 ? `<span class="mono" style="display:inline-flex;align-items:center;justify-content:center;width:68px;height:68px;border-radius:50%;border:5px solid ${C.ink};background:${C.paper};font-size:32px">${letters[i]}</span>` : ''}<span>${markup(a)}</span></div>`).join('')}
      <div class="fact card" style="padding:34px 44px;border-radius:40px;background:${C.lime};opacity:0">
        <div style="font-weight:800;font-size:44px;letter-spacing:-0.02em;margin-bottom:8px">Wait, what?</div>
        <div style="font-weight:600;font-size:38px;line-height:1.22">${markup(q.fact)}</div>
      </div>`;
    stage.appendChild(box);
    return { box, q, start, n, ans: [...box.querySelectorAll('.ans')], fact: box.querySelector('.fact'), qcard: box.querySelector('.qcard') };
  });
  const end = at;
  if (d.hook !== false) ups.push(hook(stage, { text: d.hook ?? `${d.questions.length} weird questions. *5 seconds* each.`, at: 0, dur: INTRO, y: 900, size: 92 }));
  watermark(stage, { x: 60, y: H - 150, size: 48 });
  ups.push(sticker(stage, { text: d.ask ?? 'Comment your score!', at: end - 1.8, dur: 1.8, x: 540, y: 400, size: 54, bg: C.cyan, rot: 3 }));
  const o = outro(stage, { at: end, w: W, h: H, title: d.outroTitle ?? '*10 new questions* every day', line: 'Quizbelief Free trivia in your browser.', art: '/games/wait-what/tile.webp' });

  return async (t) => {
    head.style.transform = `scale(${lerp(0.7, 1, pop(t, 0.05, 0.5))})`;
    const cur = cards.find((c) => t >= c.start && t < c.start + per(c.q)) ?? cards[cards.length - 1];
    counter.textContent = `Question ${cur.n + 1} of ${cards.length}`;
    counter.style.opacity = t < INTRO ? '0' : '1';
    cd(t, cur.start + 0.6, ASK);
    for (const c of cards) {
      const vis = c === cur && t >= c.start;
      c.box.style.display = vis ? 'flex' : 'none';
      if (!vis) continue;
      const lt = t - c.start;
      c.qcard.style.transform = `scale(${lerp(0.6, 1, pop(lt, 0, 0.45))}) rotate(-1deg)`;
      const revealAt = 0.6 + ASK + 0.1;
      c.ans.forEach((a, i) => {
        const k = pop(lt, 0.25 + i * 0.09, 0.4);
        const right = i === c.q.correct;
        const rk = prog(lt, revealAt, revealAt + 0.2);
        a.style.transform = `translateX(${(1 - k) * (i % 2 ? 80 : -80)}px) scale(${lerp(0.8, 1, k) * (right ? 1 + 0.06 * Math.sin(clamp(rk) * Math.PI) : 1)})`;
        a.style.opacity = String(clamp(k * 1.5) * (lt > revealAt && !right ? 0.4 : 1));
        a.style.background = lt > revealAt && right ? C.lime : '#fff';
      });
      const fk = pop(lt, revealAt + 0.5, 0.5);
      c.fact.style.opacity = String(clamp(fk * 1.5));
      c.fact.style.transform = `translateY(${(1 - fk) * 60}px) rotate(1deg)`;
    }
    for (const u of ups) u(t);
    o(t);
  };
}
