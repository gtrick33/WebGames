/**
 * Sigilfall's wordmark: letters drawn here as plain polygons (no font, so nothing to license or download), chiseled and
 * gilded. The I's are swords, the A's bar is a sigil. Writes public/games/sigilfall/logo.svg.
 *
 *   node scripts/sigilfall-logo.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Each letter: its outline (and any holes) on a 100-tall grid, y down, and how far it advances. */
const GLYPHS = {
  S: {
    w: 74,
    paths: [[[18, 0], [60, 0], [74, -9], [69, 27], [58, 15], [29, 15], [25, 19], [25, 35], [29, 39], [55, 39], [74, 56], [74, 84], [56, 100], [16, 100], [1, 110], [6, 73], [17, 85], [45, 85], [49, 81], [49, 63], [45, 59], [18, 59], [0, 42], [0, 18]]],
  },
  // a sword, its point down
  I: {
    w: 36,
    paths: [[[0, -2], [36, -2], [30, 11], [26, 14], [26, 82], [18, 112], [10, 82], [10, 14], [6, 11]]],
  },
  G: {
    w: 76,
    paths: [[[18, 0], [60, 0], [74, -9], [69, 27], [58, 15], [30, 15], [25, 20], [25, 80], [30, 85], [47, 85], [47, 64], [37, 55], [76, 55], [69, 64], [69, 100], [18, 100], [0, 82], [0, 18]]],
  },
  L: {
    w: 66,
    paths: [[[0, 0], [38, 0], [31, 12], [31, 84], [52, 84], [64, 68], [62, 100], [0, 100], [7, 88], [7, 12]]],
  },
  F: {
    w: 72,
    paths: [[[0, 0], [60, 0], [74, -9], [69, 27], [58, 15], [31, 15], [31, 41], [47, 41], [56, 32], [56, 64], [47, 55], [31, 55], [31, 88], [38, 100], [0, 100], [7, 88], [7, 12]]],
  },
  // its point high, and for a bar a sigil set between its legs
  A: {
    w: 80,
    paths: [[[38, -16], [70, 88], [80, 100], [46, 100], [54, 88], [50, 74], [26, 74], [22, 88], [30, 100], [-4, 100], [6, 88]], [[38, 24], [47.5, 44], [38, 66], [28.5, 44]]],
    gem: [38, 44, 9],
  },
};

const WORD = [
  { c: 'S', k: 1.2, dy: -8 },
  { c: 'I' },
  { c: 'G' },
  { c: 'I' },
  { c: 'L' },
  { c: 'F' },
  { c: 'A' },
  { c: 'L' },
  { c: 'L', k: 1.2, dy: -10 },
];
const GAP = 7;

const n = (v) => Math.round(v * 10) / 10;
let x = 8;
let body = '';
const gems = [];
for (const l of WORD) {
  const g = GLYPHS[l.c];
  const k = l.k ?? 1;
  const dy = l.dy ?? 0;
  for (const poly of g.paths) body += `M${poly.map(([px, py]) => `${n(x + px * k)} ${n(26 + dy + py * k)}`).join('L')}Z`;
  if (g.gem) gems.push([x + g.gem[0] * k, 26 + dy + g.gem[1] * k, g.gem[2] * k]);
  x += g.w * k + GAP;
}
const W = Math.ceil(x + 2);
const H = 168;

// the wings under the name, and a sigil between them
const mid = W / 2;
const flourish = `M${n(mid - 34)} 150L${n(mid - 236)} 150L${n(mid - 268)} 146L${n(mid - 236)} 143L${n(mid - 42)} 143L${n(mid - 22)} 136L${n(mid - 22)} 157ZM${n(mid + 34)} 150L${n(mid + 236)} 150L${n(mid + 268)} 146L${n(mid + 236)} 143L${n(mid + 42)} 143L${n(mid + 22)} 136L${n(mid + 22)} 157Z`;
const star = (cx, cy, r) => `M${n(cx)} ${n(cy - r * 1.5)}L${n(cx + r * 0.62)} ${n(cy)}L${n(cx)} ${n(cy + r * 1.5)}L${n(cx - r * 0.62)} ${n(cy)}Z`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sigilfall">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".3" stop-color="#ffe391"/><stop offset=".5" stop-color="#f4b93f"/><stop offset=".52" stop-color="#fff0b5"/><stop offset=".58" stop-color="#e09a2c"/><stop offset="1" stop-color="#7c3f12"/></linearGradient>
<linearGradient id="e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffd777"/><stop offset="1" stop-color="#a65f1c"/></linearGradient>
<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f6ff"/><stop offset="1" stop-color="#3f9cff"/></linearGradient>
</defs>
<path d="${body}" fill="#0d0617" fill-rule="evenodd" stroke="#0d0617" stroke-width="11" stroke-linejoin="miter" transform="translate(0 5)"/>
<path d="${body}" fill="#0d0617" fill-rule="evenodd" stroke="#2a1405" stroke-width="7" stroke-linejoin="miter"/>
<path d="${body}" fill="url(#g)" fill-rule="evenodd" stroke="url(#e)" stroke-width="1.6" stroke-linejoin="miter"/>
${gems.map(([cx, cy, r]) => `<path d="${star(cx, cy, r)}" fill="url(#c)" stroke="#0d0617" stroke-width="2"/>`).join('')}
<path d="${flourish}" fill="url(#g)" stroke="#0d0617" stroke-width="3" stroke-linejoin="miter"/>
<path d="${star(mid, 148, 11)}" fill="url(#c)" stroke="#0d0617" stroke-width="3"/>
</svg>
`;
writeFileSync(join(ROOT, 'public/games/sigilfall/logo.svg'), svg);
console.log(`logo.svg ${W}x${H}, ${svg.length} bytes`);
