// "Where's the Ball?" challenge short: a real photo with the ball painted in by the game, a
// countdown, then a zoom straight onto the ball with a ring, and a CTA card.
import { C, clamp, css, el, ease, lerp, pop, prog } from '../kit/kit.js';
import { countdown, markup, outro, paperBG, sticker, watermark } from '../kit/video.js';

const INTRO = 1.4;

export function plan(spec) {
  const secs = spec.data.seconds ?? 5;
  const reveal = INTRO + secs + 0.3;
  const duration = reveal + 3.4 + 3.2;
  const sfx = [{ id: 'whoosh', t: 0.05, gain: 0.5 }];
  for (let i = 0; i < secs; i++) sfx.push({ id: i >= secs - 3 ? 'beep' : 'tick', t: INTRO + i, gain: 0.55 });
  sfx.push({ id: 'whoosh', t: reveal, gain: 0.5 }, { id: 'ding', t: reveal + 1.0, gain: 0.7 }, { id: 'sparkle', t: reveal + 1.1, gain: 0.45 });
  return { duration, sfx };
}

export async function mount(stage, spec) {
  const d = spec.data;
  const b = d.level;
  const W = spec.w, H = spec.h;
  const secs = d.seconds ?? 5;
  const reveal = INTRO + secs + 0.3;
  const ups = [paperBG(stage, { w: W, h: H, seed: 11, shapes: 10 })];

  const title = el('div', { class: 'abs' });
  css(title, { left: '60px', top: '170px', width: '720px', zIndex: 10 });
  title.innerHTML = `<div class="chip" style="background:${C.lime};font-size:30px;border-width:5px;box-shadow:6px 6px 0 ${C.ink}">Where's the Ball?</div>
    <div class="display" style="font-size:80px;margin-top:22px;line-height:.98">${markup(d.title ?? 'Find the *tennis ball* in 5 seconds')}</div>`;
  stage.appendChild(title);
  const cd = countdown(stage, { x: 900, y: 280, r: 96 });

  // The photo, cropped to a tall window that keeps the ball well inside.
  const fw = 960, fh = 1120, fx = (W - fw) / 2, fy = 470;
  const frame = el('div', { class: 'abs' });
  css(frame, { left: `${fx}px`, top: `${fy}px`, width: `${fw}px`, height: `${fh}px`, border: `8px solid ${C.ink}`, borderRadius: '44px', overflow: 'hidden', boxShadow: `18px 18px 0 ${C.ink}`, zIndex: 8, background: '#222' });
  const img = el('img', { src: `/_studio/.cache/content/ball/${b.id}.jpg` });
  css(img, { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0' });
  frame.appendChild(img);
  const ring = el('div', { class: 'abs' });
  css(ring, { border: `10px solid ${C.magenta}`, borderRadius: '50%', boxShadow: `0 0 0 6px #fff, 0 0 30px rgba(255,79,200,.8)`, opacity: 0 });
  frame.appendChild(ring);
  stage.appendChild(frame);
  const credit = el('div', { class: 'abs mono' });
  css(credit, { left: `${fx}px`, top: `${fy + fh + 26}px`, width: `${fw}px`, textAlign: 'center', fontSize: '20px', color: '#4a3d6b', zIndex: 9, textTransform: 'none', letterSpacing: '0.02em' });
  credit.textContent = `Photo: ${b.creator} (${b.license.toUpperCase()}), Wikimedia Commons`;
  stage.appendChild(credit);

  ups.push(sticker(stage, { text: 'There it is!', at: reveal + 1.0, dur: 2.4, x: 540, y: fy + 120, size: 68, bg: C.yellow, rot: -4 }));
  watermark(stage, { x: 60, y: H - 150, size: 48 });
  const o = outro(stage, { at: reveal + 3.4, w: W, h: H, title: d.outroTitle ?? 'A new ball *hides every day*', line: "Where's the Ball? Free, in your browser.", art: '/games/wheres-the-ball/tile.webp' });

  // Composite pixels -> frame pixels. The composite (cw x ch) covers the scene (W x H units).
  const inner = { w: fw - 16, h: fh - 16 };
  const base = inner.h / b.ch; // fit height
  const bx = (b.ball.x / b.W) * b.cw, by = (b.ball.y / b.H) * b.ch, br = (b.ball.r / b.W) * b.cw;
  // Horizontal crop so the ball sits between 25% and 75% of the window.
  const shown = inner.w / base;
  const left = clamp(bx - shown * (0.35 + ((b.ball.x * 7) % 30) / 100), 0, b.cw - shown);
  return async (t) => {
    title.style.transform = `scale(${lerp(0.7, 1, pop(t, 0.05, 0.5))})`;
    const kin = pop(t, 0.25, 0.55);
    frame.style.transform = `scale(${lerp(0.7, 1, kin)}) rotate(${(1 - kin) * -5}deg)`;
    frame.style.opacity = String(clamp(kin * 2));
    cd(t, INTRO, secs);
    // Zoom onto the ball during the reveal.
    const z = ease.inOut(prog(t, reveal, reveal + 1.0));
    const scale = base * lerp(1, d.zoom ?? 2.3, z);
    const cx = lerp(left + shown / 2, bx, z);
    const cy = lerp(b.ch / 2, by, z);
    const ox = inner.w / 2 - cx * scale, oy = inner.h / 2 - cy * scale;
    img.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
    const rr = br * scale * 1.9 + 20;
    const rk = pop(t, reveal + 0.95, 0.4);
    css(ring, { left: `${ox + bx * scale - rr}px`, top: `${oy + by * scale - rr}px`, width: `${rr * 2}px`, height: `${rr * 2}px`, opacity: String(t > reveal + 0.9 ? 1 : 0), transform: `scale(${lerp(1.8, 1, rk)})` });
    for (const u of ups) u(t);
    o(t);
  };
}
