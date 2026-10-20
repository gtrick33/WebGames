// Shared building blocks for stills and video templates: the logo, brand helpers, DOM helpers and
// animation maths. Everything is plain DOM so the same pieces render to PNG or to video frames.

export const C = {
  paper: '#fff6ea', paper2: '#fbecd6', ink: '#1d1238', night: '#0d0522', cyan: '#2ad1f0', magenta: '#ff4fc8', violet: '#7b4dff',
  lime: '#b6e62c', yellow: '#ffc928', orange: '#ff6a1a', coral: '#ff5a6c', teal: '#12c6b3', blue: '#3d5bff', logoBlue: '#2c45ff', cyanText: '#0a74a0',
};
export const ACCENTS = [C.cyan, C.magenta, C.lime, C.yellow, C.coral, C.teal, C.violet, C.orange, C.blue];

export const SITE = 'glitchboundstudio.com';
export const HANDLE = '@glitchboundstudio';
export const MOTTO = ['Small games.', 'Big obsessions.'];

/**
 * The GlitchBound mark: a bold G in a blue rounded square, a misregistered coral/teal print offset
 * (the glitch) and lime bounding-box corners. `glitch` widens the offset (animation), `corners`
 * 0..1 draws the corners in, `square` false drops the blue tile (G alone on any background).
 */
export function markSVG({ size = 400, glitch = 1.6, corners = 1, square = true, jitter = 0, stroke = '#170f30' } = {}) {
  const g = 'M26.4 13.6A9 9 0 1 0 29 20h-7.5';
  const cornerPath = 'M7 11.5V7h4.5M28.5 7H33v4.5M33 28.5V33h-4.5M11.5 33H7v-4.5';
  const dash = 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" style="overflow:visible;display:block">
  ${square ? `<rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#2c45ff" stroke="${stroke}" stroke-width="2.5"/>` : ''}
  <g fill="none" stroke-width="5" stroke-linecap="square">
    <path d="${g}" stroke="#ff5a6c" transform="translate(${-glitch} ${jitter})"/>
    <path d="${g}" stroke="#12c6b3" transform="translate(${glitch} ${-jitter})"/>
    <path d="${g}" stroke="#fff"/>
  </g>
  <path d="${cornerPath}" fill="none" stroke="#c4f034" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" pathLength="${dash}" stroke-dasharray="${dash}" stroke-dashoffset="${(1 - corners) * dash}"/>
</svg>`;
}

/** The wordmark as HTML: "Glitch" in ink, "Bound" in the site's cyan. */
export const wordmark = (px, extra = '') => `<span class="wordmark" style="font-size:${px}px;${extra}">Glitch<b>Bound</b></span>`;

/** Horizontal lockup: mark + wordmark. */
export const lockup = (h, { dark = false } = {}) =>
  `<div class="${dark ? 'on-dark' : ''}" style="display:inline-flex;align-items:center;gap:${h * 0.28}px">${markSVG({ size: h })}${wordmark(h * 0.62)}</div>`;

// ---- DOM helpers ----------------------------------------------------------------------------------
export function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
}
export const css = (e, s) => Object.assign(e.style, s);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Waits for fonts and every <img> under `root` to be ready. */
export async function settle(root = document) {
  await document.fonts.ready;
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = () => r(); }))));
}

/** Shrinks an element's font size until its text fits `maxW` x `maxH`. */
export function fit(e, maxW, maxH, min = 20) {
  let size = parseFloat(getComputedStyle(e).fontSize);
  while (size > min && (e.scrollWidth > maxW + 1 || e.scrollHeight > maxH + 1)) {
    size -= 2;
    e.style.fontSize = `${size}px`;
  }
  return size;
}

// ---- Animation maths ------------------------------------------------------------------------------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
/** 0..1 progress of t through [a, b]. */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  out: (k) => 1 - (1 - k) ** 3,
  in: (k) => k ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2,
  elastic: (k) => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
/** Pop-in scale for something appearing at `at` (overshoots, settles). */
export const pop = (t, at, dur = 0.45) => ease.back(prog(t, at, at + dur));
/** Deterministic pseudo-random from a number. */
export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
