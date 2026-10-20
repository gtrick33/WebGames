// Browser-side runtime for the video formats: frame-accurate footage layers, brand backgrounds,
// captions, stickers, hooks and end cards. A format builds its DOM once (mount) and then every frame
// is drawn by seek(t), so renders are deterministic and can take as long as they need per frame.
import { C, SITE, clamp, css, ease, el, esc, hash, lerp, markSVG, pop, prog, wordmark } from './kit.js';

export const FRAMES_URL = '/_studio/.cache/frames';

/** A decoded-frame cache for one extracted clip (frames/<key>/00001.jpg ...). */
export class Clip {
  constructor(key, frames, fps = 30) {
    this.key = key;
    this.frames = frames;
    this.fps = fps;
    this.cache = new Map();
  }
  url(i) {
    return `${FRAMES_URL}/${this.key}/${String(i + 1).padStart(5, '0')}.jpg`;
  }
  load(i) {
    i = Math.max(0, Math.min(this.frames - 1, i));
    if (!this.cache.has(i)) {
      const img = new Image();
      img.src = this.url(i);
      this.cache.set(i, img.decode().then(() => img, () => img));
      if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
    }
    return this.cache.get(i);
  }
  /** The frame at clip-local time `t` (seconds), prefetching the next few. */
  async at(t) {
    const i = Math.max(0, Math.min(this.frames - 1, Math.round(t * this.fps)));
    for (let k = 1; k <= 6; k++) if (i + k < this.frames) this.load(i + k);
    return this.load(i);
  }
}

/**
 * A canvas that shows clips. `rect` is where it sits on the stage; draw() takes an image plus an
 * optional zoom { s, x, y } (scale around a focus point in 0..1 image coords) and a crop focus.
 */
export class Screen {
  constructor(stage, { x = 0, y = 0, w, h, radius = 0, border = 0, shadow = null, z = 1, cls = '' } = {}) {
    this.wrap = el('div', { class: `abs ${cls}` });
    css(this.wrap, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderRadius: `${radius}px`, overflow: 'hidden', zIndex: z, background: '#000', ...(border ? { border: `${border}px solid ${C.ink}` } : {}), ...(shadow ? { boxShadow: shadow } : {}) });
    this.canvas = el('canvas', { width: w - border * 2, height: h - border * 2 });
    css(this.canvas, { display: 'block', width: '100%', height: '100%' });
    this.wrap.appendChild(this.canvas);
    stage.appendChild(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.w = w - border * 2;
    this.h = h - border * 2;
  }
  draw(img, { s = 1, fx = 0.5, fy = 0.5, cropY = 0.5, cropX = 0.5, dim = 0, contain = false } = {}) {
    const { ctx, w, h } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (img?.naturalWidth && contain) {
      // Whole frame visible: a blurred, dimmed cover copy behind a fitted copy.
      const kc = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.1;
      ctx.filter = 'blur(28px) saturate(1.2)';
      ctx.drawImage(img, (w - img.naturalWidth * kc) / 2, (h - img.naturalHeight * kc) / 2, img.naturalWidth * kc, img.naturalHeight * kc);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(13,5,34,.28)';
      ctx.fillRect(0, 0, w, h);
      const k = Math.min(w / img.naturalWidth, h / img.naturalHeight) * s;
      const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      const x = (w - dw) / 2, y = (h - dh) / 2;
      ctx.drawImage(img, x, y, dw, dh);
      ctx.strokeStyle = '#1d1238';
      ctx.lineWidth = 8;
      ctx.strokeRect(x - 4, y - 4, dw + 8, dh + 8);
    } else if (img?.naturalWidth) {
      // Cover-fit, then zoom around the focus point.
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight) * s;
      const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      const cx = (w - img.naturalWidth * Math.max(w / img.naturalWidth, h / img.naturalHeight)) * cropX;
      const cy = (h - img.naturalHeight * Math.max(w / img.naturalWidth, h / img.naturalHeight)) * cropY;
      const baseW = img.naturalWidth * Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const baseH = img.naturalHeight * Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const px = cx + fx * baseW, py = cy + fy * baseH;
      ctx.drawImage(img, px - fx * dw, py - fy * dh, dw, dh);
    }
    if (dim) {
      ctx.fillStyle = `rgba(13,5,34,${dim})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  show(on) {
    this.wrap.style.display = on ? '' : 'none';
  }
}

/**
 * A timeline of clips played back to back (each with its own speed), returning which clip and
 * clip-local time to show at global time t, plus how far t is into that clip.
 */
export function sequence(clips, plan) {
  let at = 0;
  const parts = clips.map((c, i) => {
    const dur = (c.to - c.from) / (c.speed ?? 1);
    const p = { ...c, start: at, dur, index: i, clip: new Clip(plan.clips[c.key].key, plan.clips[c.key].frames) };
    at += dur;
    return p;
  });
  return {
    parts,
    total: at,
    at(t) {
      const p = parts.find((x) => t < x.start + x.dur) ?? parts[parts.length - 1];
      const local = clamp(t - p.start, 0, p.dur);
      return { part: p, local, src: local * (p.speed ?? 1) };
    },
  };
}

// ---- Backgrounds ---------------------------------------------------------------------------------
/** Brand paper with dots, colour washes and slowly drifting confetti shapes. Returns update(t). */
export function paperBG(stage, { w, h, dark = false, seed = 1, shapes = 16, wash = true } = {}) {
  const bg = el('div', { class: 'abs' });
  css(bg, { inset: '0', background: dark ? `radial-gradient(circle at 50% 35%, #2a1a52, ${C.night} 75%)` : C.paper, zIndex: 0 });
  bg.innerHTML = `<div class="abs ${dark ? '' : 'dots'}" style="inset:0;opacity:.9"></div>
    ${wash ? `<div class="abs" style="inset:0;background:radial-gradient(circle at 15% 12%, rgba(42,209,240,.30), transparent 34%),radial-gradient(circle at 90% 30%, rgba(255,201,40,.32), transparent 30%),radial-gradient(circle at 85% 88%, rgba(255,79,200,.26), transparent 36%),radial-gradient(circle at 10% 85%, rgba(182,230,44,.28), transparent 32%)"></div>` : ''}`;
  stage.appendChild(bg);
  const items = [];
  const colors = [C.cyan, C.magenta, C.lime, C.yellow, C.coral, C.teal, C.violet];
  for (let i = 0; i < shapes; i++) {
    const kind = i % 4;
    const size = 26 + hash(seed + i * 3) * 46;
    const color = colors[i % colors.length];
    const d = el('div', { class: 'abs' });
    const svg = kind === 0
      ? `<svg viewBox="0 0 40 40" width="${size}" height="${size}"><circle cx="20" cy="20" r="16" fill="${color}" stroke="${C.ink}" stroke-width="4"/></svg>`
      : kind === 1
        ? `<svg viewBox="0 0 40 40" width="${size}" height="${size}"><path d="M20 4 L36 34 L4 34 Z" fill="${color}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/></svg>`
        : kind === 2
          ? `<svg viewBox="0 0 40 40" width="${size}" height="${size}"><path d="M20 3 L24.5 15.5 L37 16 L27 24 L30.5 36.5 L20 29 L9.5 36.5 L13 24 L3 16 L15.5 15.5 Z" fill="${color}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/></svg>`
          : `<svg viewBox="0 0 60 20" width="${size * 1.5}" height="${size / 2}"><path d="M4 10 Q12 0 20 10 T36 10 T52 10" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/></svg>`;
    d.innerHTML = svg;
    d.style.zIndex = '1';
    stage.appendChild(d);
    items.push({ d, x: hash(seed + i * 7) * w, y: hash(seed + i * 13) * h, vx: (hash(seed + i * 17) - 0.5) * 30, vy: -10 - hash(seed + i * 19) * 25, rot: hash(seed + i * 23) * 360, vr: (hash(seed + i * 29) - 0.5) * 50 });
  }
  return (t) => {
    for (const it of items) {
      const y = ((((it.y + it.vy * t) % (h + 120)) + h + 120) % (h + 120)) - 60;
      const x = it.x + it.vx * t + Math.sin(t * 0.8 + it.rot) * 12;
      it.d.style.transform = `translate(${x}px, ${y}px) rotate(${it.rot + it.vr * t}deg)`;
    }
  };
}

// ---- Text pieces -----------------------------------------------------------------------------------
/** "*word*" marks a highlighted word; "|" forces a line break. Emoji are dropped (no emoji art baked into graphics). */
export const markup = (s, hi = C.yellow) => esc(String(s).replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').replace(/\s{2,}/g, ' ').trim()).replace(/\|/g, '<br>').replace(/\*([^*]+)\*/g, `<span style="background:${hi};padding:0 .14em;border-radius:.18em;box-decoration-break:clone;-webkit-box-decoration-break:clone">$1</span>`);

/** A caption bubble (white card, ink border, hard shadow) that pops in at `at` and out after `dur`. */
export function caption(stage, { text, at, dur = 2.2, x = 540, y = 300, size = 66, maxW = 900, bg = '#fff', color = C.ink, hi = C.yellow, rot = -1.5, z = 20, anchor = 'center' }) {
  const d = el('div', { class: 'abs' });
  css(d, { left: '0', top: '0', zIndex: z, maxWidth: `${maxW}px`, padding: `${size * 0.32}px ${size * 0.5}px`, background: bg, color, border: `6px solid ${C.ink}`, borderRadius: `${size * 0.45}px`, boxShadow: `10px 10px 0 ${C.ink}`, fontWeight: 800, fontSize: `${size}px`, letterSpacing: '-0.03em', lineHeight: 1.08, textAlign: 'center', transformOrigin: '50% 50%', opacity: 0, width: 'max-content' });
  d.innerHTML = markup(text, hi);
  stage.appendChild(d);
  let measured = null;
  return (t) => {
    if (!measured) measured = { w: d.offsetWidth, h: d.offsetHeight };
    const k = pop(t, at, 0.42);
    const out = prog(t, at + dur - 0.22, at + dur);
    const vis = t >= at && t < at + dur;
    d.style.opacity = vis ? String(1 - out) : '0';
    const s = vis ? lerp(0.55, 1, k) * (1 - out * 0.15) : 0.5;
    const left = anchor === 'center' ? x - measured.w / 2 : anchor === 'left' ? x : x - measured.w;
    d.style.transform = `translate(${left}px, ${y - measured.h / 2}px) rotate(${rot}deg) scale(${s})`;
  };
}

/** A pill sticker (e.g. "SCORE 95", "NEW!") with a wobble. */
export function sticker(stage, { text, at, dur = 99, x, y, size = 48, bg = C.yellow, color = C.ink, rot = 4, z = 21, mono = false }) {
  const d = el('div', { class: 'abs' });
  css(d, { left: '0', top: '0', zIndex: z, padding: `${size * 0.28}px ${size * 0.62}px`, background: bg, color, border: `6px solid ${C.ink}`, borderRadius: '999px', boxShadow: `8px 8px 0 ${C.ink}`, fontWeight: 800, fontSize: `${size}px`, whiteSpace: 'nowrap', letterSpacing: mono ? '0.06em' : '-0.02em', fontFamily: mono ? 'var(--mono)' : 'var(--font)', textTransform: mono ? 'uppercase' : 'none', opacity: 0 });
  d.innerHTML = markup(text);
  stage.appendChild(d);
  let m = null;
  return (t) => {
    if (!m) m = { w: d.offsetWidth, h: d.offsetHeight };
    const vis = t >= at && t < at + dur;
    const k = pop(t, at, 0.5);
    const out = prog(t, at + dur - 0.2, at + dur);
    d.style.opacity = vis ? String(1 - out) : '0';
    d.style.transform = `translate(${x - m.w / 2}px, ${y - m.h / 2}px) rotate(${rot + Math.sin(t * 3) * 1.5}deg) scale(${vis ? lerp(0.3, 1, k) : 0.3})`;
  };
}

/**
 * The opening hook: an optional eyebrow chip and a big card whose words land one by one.
 * Over footage it dims the picture behind it.
 */
export function hook(stage, { text, eyebrow, eyeColor = C.cyan, at = 0, dur = 2.6, y = 520, size = 104, maxW = 940, card = true, z = 30 }) {
  const wrap = el('div', { class: 'abs' });
  css(wrap, { left: '0', top: '0', width: '100%', zIndex: z, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' });
  const chip = eyebrow ? `<div class="chip" style="background:${eyeColor};font-size:34px;border-width:6px;box-shadow:7px 7px 0 ${C.ink}">${esc(eyebrow)}</div>` : '';
  // Split into words, carrying *highlight* groups and "|" breaks across the split.
  let inHi = false;
  const words = text.split(' ').map((w) => {
    const open = inHi || w.startsWith('*');
    if (w.startsWith('*')) inHi = true;
    if (w.endsWith('*') || w.endsWith('*|')) inHi = false;
    const brk = w.endsWith('|');
    const bare = w.replace(/[*|]/g, '');
    return `<span class="hw" style="display:inline-block;opacity:0">${markup(open ? `*${bare}*` : bare)}</span>${brk ? '<br>' : ''}`;
  }).join(' ');
  wrap.innerHTML = `${chip}<div class="hk display" style="max-width:${maxW}px;text-align:center;font-size:${size}px;line-height:1.02;${card ? `background:#fff;border:7px solid ${C.ink};border-radius:44px;box-shadow:16px 16px 0 ${C.ink};padding:34px 44px;` : 'color:#fff;text-shadow:0 6px 0 #1d1238, 0 0 30px rgba(0,0,0,.4);'}">${words}</div>`;
  stage.appendChild(wrap);
  const ws = [...wrap.querySelectorAll('.hw')];
  const box = wrap.querySelector('.hk');
  const ch = wrap.firstElementChild !== box ? wrap.firstElementChild : null;
  return (t) => {
    const vis = t >= at && t < at + dur;
    const out = prog(t, at + dur - 0.25, at + dur);
    wrap.style.opacity = vis ? String(1 - out) : '0';
    wrap.style.transform = `translateY(${y - 140 + out * -40}px)`;
    const kb = pop(t, at, 0.4);
    box.style.transform = `rotate(-2deg) scale(${lerp(0.7, 1, kb)})`;
    if (ch) ch.style.transform = `rotate(3deg) scale(${lerp(0.4, 1, pop(t, at + 0.05, 0.4))})`;
    ws.forEach((w, i) => {
      const k = pop(t, at + 0.12 + i * 0.09, 0.32);
      w.style.opacity = String(clamp(k * 1.4));
      w.style.transform = `translateY(${(1 - k) * 30}px) scale(${lerp(0.6, 1, k)})`;
    });
  };
}

/** Full-screen end card: game art (optional), title, CTA, URL and the logo, sliding up at `at`. */
export function outro(stage, { at, w, h, title = 'Play it free', line = 'In your browser. No download, no sign-up.', art = null, artLabel = '', cta = SITE, z = 50, dark = false }) {
  const card = el('div', { class: 'abs' });
  css(card, { left: '0', top: '0', width: `${w}px`, height: `${h}px`, zIndex: z, background: dark ? C.night : C.paper, overflow: 'hidden' });
  const vertical = h > w;
  const artSize = vertical ? 520 : 440;
  card.innerHTML = `
    <div class="abs ${dark ? '' : 'dots'}" style="inset:0"></div>
    <div class="abs" style="inset:0;background:radial-gradient(circle at 20% 15%, rgba(42,209,240,.35), transparent 35%),radial-gradient(circle at 85% 80%, rgba(255,79,200,.3), transparent 35%),radial-gradient(circle at 85% 15%, rgba(255,201,40,.35), transparent 30%)"></div>
    <div class="oc abs" style="inset:0;display:flex;flex-direction:${vertical ? 'column' : 'row'};align-items:center;justify-content:center;gap:${vertical ? 46 : 90}px;padding:${vertical ? '0 70px 260px' : '0 120px'}">
      ${art ? `<div class="o-art tile-art" style="width:${artSize}px;height:${artSize}px;border-radius:70px;border-width:8px;box-shadow:20px 20px 0 ${C.ink}"><img src="${art}"></div>` : `<div class="o-art">${markSVG({ size: vertical ? 360 : 340 })}</div>`}
      <div style="display:flex;flex-direction:column;align-items:center;gap:30px;text-align:center">
        <div class="o-title display" style="font-size:${vertical ? 104 : 96}px;color:${dark ? '#fff' : C.ink}">${markup(title)}</div>
        <div class="o-line" style="font-size:${vertical ? 46 : 42}px;font-weight:600;color:${dark ? '#d8d0f0' : '#4a3d6b'};max-width:860px;line-height:1.2">${esc(line)}</div>
        <div class="o-cta btn" style="font-size:${vertical ? 56 : 52}px;margin-top:10px">${esc(cta)}</div>
        <div class="o-logo ${dark ? 'on-dark' : ''}" style="display:flex;align-items:center;gap:22px;margin-top:22px">${markSVG({ size: 92 })}${wordmark(66)}</div>
      </div>
    </div>`;
  stage.appendChild(card);
  const parts = ['.o-art', '.o-title', '.o-line', '.o-cta', '.o-logo'].map((s) => card.querySelector(s));
  return (t) => {
    const k = ease.out(prog(t, at, at + 0.45));
    card.style.display = t < at ? 'none' : '';
    card.style.transform = `translateY(${(1 - k) * h}px)`;
    parts.forEach((p, i) => {
      if (!p) return;
      const kk = pop(t, at + 0.25 + i * 0.12, 0.45);
      p.style.transform = `scale(${lerp(0.5, 1, kk)}) rotate(${i === 0 ? -4 + Math.sin(t * 2) * 1.5 : i === 3 ? Math.sin(t * 4) * 1.2 : 0}deg)`;
      p.style.opacity = String(clamp(kk * 1.5));
    });
  };
}

/** A white flash for cuts. */
export function flash(stage, { z = 40 } = {}) {
  const f = el('div', { class: 'abs' });
  css(f, { inset: '0', background: '#fff', zIndex: z, opacity: 0, pointerEvents: 'none' });
  stage.appendChild(f);
  return (amount) => (f.style.opacity = String(clamp(amount)));
}

/** Small brand tag for a corner. */
export function watermark(stage, { x = 48, y = 200, size = 54, z = 25, dark = false } = {}) {
  const d = el('div', { class: `abs ${dark ? 'on-dark' : ''}` });
  css(d, { left: `${x}px`, top: `${y}px`, zIndex: z, display: 'flex', alignItems: 'center', gap: `${size * 0.25}px`, padding: `${size * 0.16}px ${size * 0.36}px ${size * 0.16}px ${size * 0.18}px`, background: 'rgba(255,246,234,.92)', border: `5px solid ${C.ink}`, borderRadius: '999px', boxShadow: `6px 6px 0 ${C.ink}` });
  d.innerHTML = `${markSVG({ size })}${wordmark(size * 0.62)}`;
  stage.appendChild(d);
  return d;
}

/** A thin progress bar along the top. */
export function progressBar(stage, { y = 0, h = 12, color = C.magenta, z = 60 } = {}) {
  const b = el('div', { class: 'abs' });
  css(b, { left: '0', top: `${y}px`, height: `${h}px`, width: '0', background: color, zIndex: z, borderRight: `4px solid ${C.ink}` });
  stage.appendChild(b);
  return (k) => (b.style.width = `${clamp(k) * 100}%`);
}

/** A countdown ring with the seconds left in the middle (quiz formats). */
export function countdown(stage, { x, y, r = 92, z = 30 }) {
  const d = el('div', { class: 'abs' });
  css(d, { left: `${x - r}px`, top: `${y - r}px`, width: `${r * 2}px`, height: `${r * 2}px`, zIndex: z });
  const R = r - 14;
  const L = 2 * Math.PI * R;
  d.innerHTML = `<svg viewBox="0 0 ${r * 2} ${r * 2}" width="${r * 2}" height="${r * 2}">
    <circle cx="${r}" cy="${r}" r="${r - 4}" fill="#fff" stroke="${C.ink}" stroke-width="7"/>
    <circle class="ring" cx="${r}" cy="${r}" r="${R}" fill="none" stroke="${C.magenta}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${L}" transform="rotate(-90 ${r} ${r})"/>
    <text class="num" x="${r}" y="${r + r * 0.24}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="${r * 0.78}" fill="${C.ink}">5</text></svg>`;
  stage.appendChild(d);
  const ring = d.querySelector('.ring');
  const num = d.querySelector('.num');
  return (t, start, secs) => {
    const vis = t >= start - 0.3 && t < start + secs + 0.4;
    d.style.opacity = vis ? '1' : '0';
    const left = clamp(start + secs - t, 0, secs);
    ring.setAttribute('stroke-dashoffset', String(L * (1 - left / secs)));
    ring.setAttribute('stroke', left < secs * 0.35 ? C.coral : C.magenta);
    num.textContent = String(Math.ceil(left));
    const beat = 1 - ((start + secs - t) % 1);
    d.style.transform = `scale(${vis ? lerp(0.6, 1, pop(t, start - 0.3, 0.35)) * (1 + (left > 0 ? ease.out(clamp(1 - beat * 4)) * 0.06 : 0)) : 0.6})`;
  };
}
