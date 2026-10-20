// Records footage with Noto Color Emoji (Google, SIL OFL 1.1; files in kit/fonts/noto-emoji) instead of
// the Mac's Apple Color Emoji, so no Apple emoji artwork ends up in the videos. The games ask for
// system emoji by font name ("Apple Color Emoji", "Segoe UI Emoji"...) or fall back to them from the
// site's text fonts; author @font-face rules with those family names shadow the system fonts.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STUDIO } from './site.mjs';

/** Copies the font files where the site servers will serve them (/__studio-emoji/). */
export function installEmojiFonts() {
  const src = join(STUDIO, 'kit/fonts/noto-emoji');
  for (const d of ['.cache/site/glitchbound/public', '.cache/site/glitchbound/dist', '.cache/site/neon-rush/public']) {
    const dir = join(STUDIO, d, '__studio-emoji');
    if (!existsSync(join(STUDIO, d))) continue;
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(src)) copyFileSync(join(src, f), join(dir, f));
  }
}

const EMOJI_FAMILIES = ['Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Twemoji Mozilla', 'Android Emoji', 'EmojiOne Color'];
// Text families get the emoji only for pictographs: digits, #, *, (c), (R), TM stay in the text font.
const TEXT_FAMILIES = ['Bricolage', 'Space Mono', 'Avenir Next', 'Segoe UI', 'Inter', 'Orbitron', 'Rajdhani', 'Exo 2', 'system-ui-emoji'];

const parseRanges = (s) => s.split(',').map((r) => r.trim().replace(/^U\+/i, '')).map((r) => {
  const [a, b] = r.split('-');
  return [parseInt(a, 16), parseInt(b ?? a, 16)];
});
const fmt = ([a, b]) => (a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`);

let cached = null;
export function emojiCSS() {
  if (cached) return cached;
  const css = readFileSync(join(STUDIO, '.cache/noto-emoji.css'), 'utf8');
  const blocks = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m, i) => ({ i, range: /unicode-range:\s*([^;]+);/.exec(m[1])[1] }));
  const out = [];
  for (const b of blocks) {
    // Served same-origin by every studio server (copied into the site's public/ and dist/).
    const src = `url(/__studio-emoji/${b.i}.woff2) format('woff2')`;
    const all = parseRanges(b.range);
    const pict = all.filter(([a]) => a > 0x2122 && !(a >= 0x2190 && a <= 0x21ff) && a !== 0x2139);
    for (const f of EMOJI_FAMILIES) out.push(`@font-face{font-family:'${f}';font-display:block;src:${src};unicode-range:${all.map(fmt).join(',')}}`);
    if (pict.length) for (const f of TEXT_FAMILIES) out.push(`@font-face{font-family:'${f}';font-display:block;src:${src};unicode-range:${pict.map(fmt).join(',')}}`);
  }
  cached = out.join('\n');
  return cached;
}

/** Init script: inject the faces as early as possible and start loading every subset. */
export const emojiInit = (css) => {
  const put = () => {
    if (document.getElementById('__gb-emoji')) return;
    const s = document.createElement('style');
    s.id = '__gb-emoji';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
    window.__gbEmojiReady = Promise.all([...document.fonts].filter((f) => /Apple Color Emoji/.test(f.family)).map((f) => f.load().catch(() => null)));
  };
  if (document.documentElement) put();
  else document.addEventListener('readystatechange', put, { once: true });
};
