// The workhorse vertical format: real gameplay clips cut back to back (with speed ramps and punch-in
// zooms), a hook that lands in the first second, caption bubbles, stickers and a branded end card.
// Layouts: 'full' (screen recording fills the frame), 'framed' (a phone on brand paper under a title),
// 'meme' (a white caption bar on top, gameplay below).
import { C, clamp, ease, el, css, lerp, pop, prog } from '../kit/kit.js';
import { Screen, caption, flash, hook, outro, paperBG, progressBar, sequence, sticker, watermark, markup } from '../kit/video.js';

const OUTRO = 3.4;

export function plan(spec) {
  const d = spec.data;
  const clips = {};
  d.clips.forEach((c, i) => {
    c.key = `c${i}`;
    clips[c.key] = { slug: c.slug, take: c.take ?? 'a', from: c.from, to: c.to, speed: c.speed ?? 1 };
  });
  const body = d.clips.reduce((s, c) => s + (c.to - c.from) / (c.speed ?? 1), 0);
  const duration = body + (d.outro === false ? 0 : OUTRO - 0.4);
  const sfx = [{ id: 'whoosh', t: 0.02, gain: 0.5 }];
  let at = 0;
  for (const c of d.clips.slice(0, -1)) {
    at += (c.to - c.from) / (c.speed ?? 1);
    sfx.push({ id: 'swoosh-down', t: at - 0.12, gain: 0.35 });
  }
  for (const s of d.stickers ?? []) sfx.push({ id: s.sfx ?? 'pop', t: s.at, gain: 0.6 });
  for (const c of d.captions ?? []) if (c.sfx) sfx.push({ id: c.sfx, t: c.at, gain: 0.55 });
  if (d.outro !== false) sfx.push({ id: 'sparkle', t: body - 0.4 + 0.3, gain: 0.5 });
  return { duration, clips, sfx: [...sfx, ...(d.sfx ?? [])] };
}

export async function mount(stage, spec, P) {
  const d = spec.data;
  const W = spec.w, H = spec.h;
  const layout = d.layout ?? 'full';
  const seq = sequence(d.clips, P);
  const body = seq.total;
  const ups = [];

  let screen;
  let titleEl = null;
  if (layout === 'full') {
    screen = new Screen(stage, { w: W, h: H });
  } else if (layout === 'framed') {
    ups.push(paperBG(stage, { w: W, h: H, seed: d.seed ?? 3 }));
    const fh = d.frameH ?? 1180;
    const fw = Math.round(fh * 9 / 16);
    screen = new Screen(stage, { x: (W - fw) / 2, y: d.frameY ?? 520, w: fw, h: fh, radius: 64, border: 8, shadow: `20px 20px 0 ${C.ink}` });
    titleEl = el('div', { class: 'abs display' });
    css(titleEl, { left: '60px', right: '60px', top: '200px', height: '290px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: `${d.titleSize ?? 96}px`, zIndex: 5 });
    titleEl.innerHTML = markup(d.title ?? '');
    stage.appendChild(titleEl);
  } else if (layout === 'meme') {
    const top = d.memeH ?? 560;
    const bar = el('div', { class: 'abs' });
    css(bar, { left: '0', top: '0', width: `${W}px`, height: `${top}px`, background: '#fff', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '130px 70px 20px', borderBottom: `8px solid ${C.ink}` });
    bar.innerHTML = `<div style="font-weight:700;font-size:${d.memeSize ?? 64}px;line-height:1.16;letter-spacing:-0.02em;text-align:left;width:100%">${markup(d.meme ?? '')}</div>`;
    stage.appendChild(bar);
    screen = new Screen(stage, { x: 0, y: top, w: W, h: H - top });
  }

  const fl = flash(stage);
  const bar = d.progress ? progressBar(stage, {}) : null;
  if (d.watermark !== false && layout === 'full') watermark(stage, { y: layout === 'meme' ? (d.memeH ?? 560) + 30 : 190, size: 50 });
  if (d.hook) ups.push(hook(stage, { ...d.hook, y: d.hook.y ?? (layout === 'framed' ? 980 : 760) }));
  for (const c of d.captions ?? []) ups.push(caption(stage, c));
  for (const s of d.stickers ?? []) ups.push(sticker(stage, s));
  const o = d.outro === false ? null : outro(stage, { at: body - 0.4, w: W, h: H, ...(d.outro ?? {}) });

  return async (t) => {
    const { part, local, src } = seq.at(Math.min(t, body - 0.001));
    const img = await part.clip.at(src);
    // Punch-in zooms: [{at (seconds into this clip), s, x, y, dur}]
    let s = 1, fx = 0.5, fy = 0.5;
    for (const z of part.zoom ?? []) {
      const k = ease.inOut(prog(local, z.at, z.at + (z.dur ?? 0.5)));
      const out = z.hold ? ease.inOut(prog(local, z.at + z.hold, z.at + z.hold + 0.5)) : 0;
      const kk = k * (1 - out);
      s = lerp(s, z.s, kk);
      fx = lerp(fx, z.x ?? 0.5, kk);
      fy = lerp(fy, z.y ?? 0.5, kk);
    }
    // Cut punch: a small zoom settle and a flash at each new clip.
    const sinceCut = local;
    const punch = part.index > 0 ? 1 + 0.06 * (1 - ease.out(clamp(sinceCut / 0.3))) : 1;
    const dimHook = d.hook && layout === 'full' ? 0.42 * (1 - prog(t, (d.hook.dur ?? 2.6) - 0.3, d.hook.dur ?? 2.6)) * (t < (d.hook.dur ?? 2.6) ? 1 : 0) : 0;
    screen.draw(img, { s: s * punch, fx, fy, cropY: d.cropY ?? 0.5, dim: dimHook, contain: d.contain ?? layout === 'meme' });
    fl(part.index > 0 ? 0.55 * (1 - clamp(sinceCut / 0.16)) : 0);
    if (titleEl) titleEl.style.transform = `scale(${lerp(0.7, 1, pop(t, 0.1, 0.5))}) rotate(-1.5deg)`;
    if (bar) bar(t / body);
    for (const u of ups) u(t);
    if (o) o(t);
  };
}
