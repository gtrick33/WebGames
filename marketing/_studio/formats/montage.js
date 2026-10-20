// Trailer / montage: punchy word cards on the beat, then a run of real gameplay shots cut to the
// music (each with the game's name), a wall of every game's art, and the end card. Works vertical
// (full-screen shots) and horizontal (a phone on brand paper with the title beside it).
import { C, clamp, css, ease, el, hash, lerp, markSVG, pop, prog, wordmark } from '../kit/kit.js';
import { Clip, Screen, flash, markup, outro, paperBG } from '../kit/video.js';

export function timeline(d) {
  const beat = 60 / d.bpm;
  let at = 0;
  const cards = (d.cards ?? []).map((c) => {
    const x = { ...c, at, dur: (c.beats ?? 2) * beat };
    at += x.dur;
    return x;
  });
  const shots = d.shots.map((s, i) => {
    const dur = (s.beats ?? 3) * beat;
    const x = { ...s, key: `s${i}`, at, dur, i };
    at += dur;
    return x;
  });
  const wallAt = at;
  const wallDur = d.wall === false ? 0 : (d.wallBeats ?? 8) * beat;
  at += wallDur;
  return { beat, cards, shots, wallAt, wallDur, outroAt: at, duration: at + (d.outroDur ?? 3.6) };
}

export function plan(spec) {
  const d = spec.data;
  const T = timeline(d);
  const clips = {};
  for (const s of T.shots) clips[s.key] = { slug: s.slug, take: s.take ?? 'a', from: s.from, to: s.from + s.dur * (s.speed ?? 1) + 0.1, speed: s.speed ?? 1, ...(spec.w > spec.h ? { w: 720 } : {}) };
  const sfx = [];
  for (const c of T.cards) sfx.push({ id: 'pop', t: c.at, gain: 0.5 });
  for (const s of T.shots) if (s.i % 4 === 0) sfx.push({ id: 'whoosh', t: Math.max(0, s.at - 0.15), gain: 0.25 });
  if (T.wallDur) sfx.push({ id: 'sparkle', t: T.wallAt, gain: 0.5 });
  sfx.push({ id: 'impact', t: T.outroAt, gain: 0.5 });
  return { duration: T.duration, clips, sfx };
}

export async function mount(stage, spec, P) {
  const d = spec.data;
  const W = spec.w, H = spec.h;
  const vertical = H > W;
  const T = timeline(d);
  const bg = paperBG(stage, { w: W, h: H, seed: 5, shapes: vertical ? 16 : 22 });

  // Shots.
  const fh = vertical ? H : 900;
  const fw = vertical ? W : Math.round(fh * 9 / 16);
  const screen = new Screen(stage, vertical ? { w: W, h: H, z: 5 } : { x: 220, y: (H - fh) / 2, w: fw, h: fh, radius: 58, border: 8, shadow: `20px 20px 0 ${C.ink}`, z: 5 });
  const clips = Object.fromEntries(T.shots.map((s) => [s.key, new Clip(P.clips[s.key].key, P.clips[s.key].frames)]));
  const label = el('div', { class: 'abs' });
  css(label, vertical ? { left: '60px', top: '1370px', zIndex: 12 } : { left: `${220 + fw + 120}px`, top: '300px', width: `${W - fw - 220 - 200}px`, zIndex: 12 });
  stage.appendChild(label);
  const counter = el('div', { class: 'abs mono' });
  css(counter, vertical ? { right: '60px', top: '200px', zIndex: 12, fontSize: '40px', fontWeight: 700, background: '#fff', border: `5px solid ${C.ink}`, borderRadius: '999px', padding: '8px 22px', boxShadow: `6px 6px 0 ${C.ink}` } : { left: `${220 + fw + 120}px`, top: '200px', zIndex: 12, fontSize: '34px', fontWeight: 700 });
  stage.appendChild(counter);
  const fl = flash(stage, { z: 30 });

  // Word cards.
  const card = el('div', { class: 'abs center' });
  css(card, { inset: '0', zIndex: 20, flexDirection: 'column', gap: '30px' });
  stage.appendChild(card);
  const cardColors = [C.cyan, C.magenta, C.yellow, C.lime, C.coral, C.violet];

  // The wall: every game's art popping into a grid.
  const wall = el('div', { class: 'abs' });
  css(wall, { inset: '0', zIndex: 22, display: 'none' });
  const arts = d.wallArt ?? [];
  const cols = vertical ? 4 : 7;
  const size = vertical ? 220 : 210;
  const gap = vertical ? 30 : 26;
  const rows = Math.ceil(arts.length / cols);
  const gx = (W - (cols * size + (cols - 1) * gap)) / 2;
  const gy = vertical ? 520 : (H - (rows * size + (rows - 1) * gap)) / 2 + 60;
  wall.innerHTML = `<div class="abs" style="inset:0;background:${C.paper}"><div class="abs dots" style="inset:0"></div></div>` +
    arts.map((a, i) => `<div class="tile-art abs wt" style="left:${gx + (i % cols) * (size + gap)}px;top:${gy + Math.floor(i / cols) * (size + gap)}px;width:${size}px;height:${size}px;border-radius:40px;box-shadow:10px 10px 0 ${C.ink}"><img src="${a}"></div>`).join('') +
    `<div class="abs display wtitle" style="left:0;right:0;top:${vertical ? 230 : 70}px;text-align:center;font-size:${vertical ? 104 : 92}px">${markup(d.wallTitle ?? '*19 games.* All free.')}</div>`;
  stage.appendChild(wall);
  const tiles = [...wall.querySelectorAll('.wt')];
  const wtitle = wall.querySelector('.wtitle');
  const o = outro(stage, { at: T.outroAt, w: W, h: H, ...(d.outro ?? {}) });

  return async (t) => {
    bg(t);
    // Cards
    const c = T.cards.find((x) => t >= x.at && t < x.at + x.dur);
    if (c) {
      const k = pop(t, c.at, 0.3);
      const i = T.cards.indexOf(c);
      card.style.display = 'flex';
      card.style.background = c.bg ?? cardColors[i % cardColors.length];
      card.innerHTML = `${c.logo ? markSVG({ size: vertical ? 420 : 360, glitch: 1.6 + Math.sin(t * 40) * 1.2 * (1 - k), jitter: Math.sin(t * 57) * 0.6 * (1 - k) }) : ''}
        <div class="display" style="font-size:${c.size ?? (vertical ? 150 : 170)}px;text-align:center;color:${c.color ?? C.ink};padding:0 60px;transform:scale(${lerp(1.4, 1, ease.out(k))}) rotate(${(i % 2 ? 2 : -2)}deg)">${markup(c.text ?? '', '#fff')}</div>
        ${c.sub ? `<div style="font-size:${vertical ? 54 : 48}px;font-weight:700;opacity:${clamp(k * 2)}">${markup(c.sub)}</div>` : ''}`;
    } else card.style.display = 'none';
    // Shots
    const s = T.shots.find((x) => t >= x.at && t < x.at + x.dur) ?? (t >= T.wallAt ? T.shots[T.shots.length - 1] : T.shots[0]);
    const lt = clamp(t - s.at, 0, s.dur);
    const img = await clips[s.key].at(lt * (s.speed ?? 1));
    const punch = 1 + 0.08 * (1 - ease.out(clamp(lt / 0.35)));
    screen.draw(img, { s: punch * (s.zoom ?? 1), fx: s.fx ?? 0.5, fy: s.fy ?? 0.5 });
    if (!vertical) screen.wrap.style.transform = `rotate(${Math.sin(s.i * 1.7) * 2}deg) scale(${lerp(0.94, 1, ease.out(clamp(lt / 0.3)))})`;
    fl(t >= T.shots[0].at ? 0.6 * (1 - clamp(lt / 0.12)) : 0);
    const lk = pop(lt, 0.05, 0.35);
    label.innerHTML = vertical
      ? `<div class="sticker" style="font-size:64px;background:${s.color ?? C.yellow};transform:rotate(-3deg) scale(${lerp(0.4, 1, lk)})">${markup(s.title)}</div>`
      : `<div class="display" style="font-size:110px;transform:scale(${lerp(0.6, 1, lk)});transform-origin:0 50%">${markup(s.title)}</div>
         <div style="font-size:44px;font-weight:600;color:#4a3d6b;margin-top:26px;line-height:1.25;opacity:${clamp(lk * 1.5)}">${markup(s.line ?? '')}</div>`;
    counter.textContent = `${String(s.i + 1).padStart(2, '0')} / ${T.shots.length}`;
    // Wall
    wall.style.display = t >= T.wallAt && T.wallDur ? '' : 'none';
    if (t >= T.wallAt) {
      tiles.forEach((tile, i) => {
        const k = pop(t, T.wallAt + 0.04 * i, 0.4);
        tile.style.transform = `scale(${lerp(0, 1, k)}) rotate(${(hash(i) - 0.5) * 10 * (1 - k * 0.6)}deg)`;
      });
      wtitle.style.transform = `scale(${lerp(0.5, 1, pop(t, T.wallAt + 0.5, 0.45))})`;
    }
    o(t);
  };
}
