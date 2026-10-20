// YouTube 16:9 gameplay: the real game in a phone on brand paper, the game's title, pitch and URL
// beside it, chapter cards between games (for compilations), and an end card.
import { C, clamp, css, ease, el, lerp, markSVG, pop, prog, settle, wordmark } from '../kit/kit.js';
import { Clip, Screen, markup, outro, paperBG, progressBar } from '../kit/video.js';

const CARD = 1.6;

export function timeline(d) {
  let at = d.intro === false ? 0 : 2.6;
  const segs = d.segments.map((s, i) => {
    const card = d.segments.length > 1 ? CARD : 0;
    const dur = (s.to - s.from) / (s.speed ?? 1);
    const x = { ...s, key: `g${i}`, i, cardAt: at, at: at + card, dur };
    at += card + dur;
    return x;
  });
  return { segs, outroAt: at, duration: at + 4.2 };
}

export function plan(spec) {
  const T = timeline(spec.data);
  const clips = {};
  for (const s of T.segs) clips[s.key] = { slug: s.slug, take: s.take ?? 'a', from: s.from, to: s.to, speed: s.speed ?? 1, w: 720 };
  const sfx = [];
  if (spec.data.intro !== false) sfx.push({ id: 'glitch', t: 0.2, gain: 0.5 }, { id: 'impact', t: 0.9, gain: 0.4 });
  for (const s of T.segs) if (T.segs.length > 1) sfx.push({ id: 'whoosh', t: s.cardAt, gain: 0.35 });
  sfx.push({ id: 'sparkle', t: T.outroAt + 0.3, gain: 0.5 });
  return { duration: T.duration, clips, sfx };
}

export async function mount(stage, spec, P) {
  const d = spec.data;
  const W = spec.w, H = spec.h;
  const T = timeline(d);
  const bg = paperBG(stage, { w: W, h: H, seed: 9, shapes: 20 });
  const fh = 940, fw = Math.round(fh * 9 / 16);
  const screen = new Screen(stage, { x: 200, y: (H - fh) / 2, w: fw, h: fh, radius: 56, border: 8, shadow: `20px 20px 0 ${C.ink}`, z: 5 });
  const clips = Object.fromEntries(T.segs.map((s) => [s.key, new Clip(P.clips[s.key].key, P.clips[s.key].frames)]));
  const side = el('div', { class: 'abs' });
  css(side, { left: `${200 + fw + 130}px`, right: '120px', top: '0', bottom: '0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '30px', zIndex: 6 });
  stage.appendChild(side);
  const logo = el('div', { class: 'abs' });
  css(logo, { right: '60px', top: '50px', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 7 });
  logo.innerHTML = `${markSVG({ size: 64 })}${wordmark(44)}`;
  stage.appendChild(logo);
  const bar = progressBar(stage, { y: H - 14, h: 14, color: C.cyan });

  // Intro: the logo glitches in with the video's title.
  const intro = el('div', { class: 'abs center' });
  css(intro, { inset: '0', zIndex: 20, background: C.paper, flexDirection: 'column', gap: '40px' });
  intro.innerHTML = `<div class="im"></div><div class="display it" style="font-size:96px;text-align:center;max-width:1500px">${markup(d.title ?? '')}</div>`;
  stage.appendChild(intro);
  const im = intro.querySelector('.im');
  const it = intro.querySelector('.it');
  // Chapter card between games.
  const chap = el('div', { class: 'abs center' });
  css(chap, { inset: '0', zIndex: 18, flexDirection: 'row', gap: '70px', display: 'none' });
  stage.appendChild(chap);
  const o = outro(stage, { at: T.outroAt, w: W, h: H, ...(d.outro ?? {}) });
  let built = -1;

  return async (t) => {
    bg(t);
    const ik = d.intro === false ? 1 : prog(t, 2.2, 2.6);
    intro.style.display = ik >= 1 ? 'none' : 'flex';
    if (ik < 1) {
      const k = pop(t, 0.1, 0.6);
      im.innerHTML = markSVG({ size: 300, glitch: 1.6 + (t < 0.9 ? Math.sin(t * 60) * 2.2 : 0), jitter: t < 0.9 ? Math.sin(t * 47) * 0.8 : 0, corners: ease.out(prog(t, 0.3, 1.0)) });
      im.style.transform = `scale(${lerp(0.5, 1, k)})`;
      it.style.transform = `scale(${lerp(0.7, 1, pop(t, 0.7, 0.5))})`;
      it.style.opacity = String(clamp((t - 0.7) * 3));
      intro.style.transform = `translateY(${-ease.in(ik) * H}px)`;
    }
    const s = T.segs.find((x) => t < x.at + x.dur) ?? T.segs[T.segs.length - 1];
    const lt = clamp(t - s.at, 0, s.dur);
    const img = await clips[s.key].at(lt * (s.speed ?? 1));
    screen.draw(img, {});
    // Chapter card.
    const inCard = T.segs.length > 1 && t >= s.cardAt && t < s.at;
    chap.style.display = inCard ? 'flex' : 'none';
    if (built !== s.i) {
      // Build this game's chapter card and side panel once, and wait for their art to decode.
      built = s.i;
      chap.innerHTML = `<div class="tile-art ca" style="width:360px;height:360px;border-radius:60px"><img src="${s.art}"></div>
        <div><div class="mono" style="font-size:40px;font-weight:700">Game ${s.i + 1} of ${T.segs.length}</div><div class="display" style="font-size:150px">${markup(s.title)}</div></div>`;
      side.innerHTML = `
      <div class="sh" style="display:flex;align-items:center;gap:34px;transform-origin:0 50%">
        <div class="tile-art" style="width:190px;height:190px;border-radius:44px;flex:none"><img src="${s.art}"></div>
        <div class="display" style="font-size:${s.title.length > 12 ? 104 : 124}px">${markup(s.title)}</div>
      </div>
      <div style="font-size:46px;font-weight:600;line-height:1.25;color:#4a3d6b;max-width:880px">${markup(s.tagline ?? '')}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">${(s.chips ?? []).map((c, i) => `<span class="chip" style="background:${[C.cyan, C.yellow, C.lime, C.magenta][i % 4]}">${markup(c)}</span>`).join('')}</div>
      <div style="margin-top:20px"><span class="btn" style="font-size:46px;padding:22px 44px">Play free · ${markup(d.url ?? 'glitchboundstudio.com')}</span></div>
      ${s.note ? `<div class="mono" style="font-size:24px;color:#4a3d6b;text-transform:none;letter-spacing:.02em">${markup(s.note)}</div>` : ''}`;
      await settle(stage);
    }
    if (inCard) {
      const k = pop(t, s.cardAt, 0.45);
      const out = prog(t, s.at - 0.25, s.at);
      chap.style.background = [C.cyan, C.yellow, C.magenta, C.lime, C.coral, C.teal][s.i % 6];
      chap.style.transform = `translateX(${(1 - ease.out(prog(t, s.cardAt, s.cardAt + 0.3))) * W - out * W}px)`;
      chap.querySelector('.ca').style.transform = `rotate(-5deg) scale(${lerp(0.5, 1, k)})`;
    }
    const sk = pop(lt, 0.1, 0.5);
    side.querySelector('.sh').style.transform = `scale(${lerp(0.7, 1, sk)})`;
    bar(t / T.duration);
    o(t);
  };
}
