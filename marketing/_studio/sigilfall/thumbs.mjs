// Thumbnails (1920 x 1080 JPEG) from the game's own frames: a moment of a take, come closer, with the logo and
// the trailer's name.   node thumbs.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, FFMPEG, FOOTAGE, HERE } from './lib.mjs';
import { renderGfx } from './gfx/render.mjs';

const OUT = join(HERE, '../../videos/sigilfall/thumbnails');
mkdirSync(OUT, { recursive: true });
const THUMBS = [
  { name: 'Sigilfall-Story-Trailer-Thumbnail', src: 'ashkar', at: 42.4, zoom: 1.25, focus: [0.2, 0.45], title: 'The Crown of Ash', sub: 'Official story trailer' },
  { name: 'Sigilfall-Launch-Trailer-Thumbnail', src: 'sunking', at: 12.6, zoom: 1.2, focus: [0.25, 0.3], title: 'Choose Your Calling', sub: 'Play free in your browser' },
  { name: 'Sigilfall-Gameplay-Trailer-Thumbnail', src: 'crypt-run', at: 55.0, zoom: 1.35, focus: [0.35, 0.55], title: 'Gameplay Trailer', sub: 'This is Sigilfall' },
];
for (const t of THUMBS) {
  const png = await renderGfx([{ kind: 'thumb', at: 0, dur: 9, in: 0, out: 0, title: t.title, sub: t.sub }], null, { stillAt: 1 });
  const over = join(CACHE, 'thumb-over.png');
  writeFileSync(over, png);
  const w = 2 * Math.round(960 * t.zoom);
  const h = 2 * Math.round(540 * t.zoom);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(t.at), '-i', join(FOOTAGE, `${t.src}.mp4`), '-i', over,
    '-filter_complex', `[0:v]scale=${w}:${h}:flags=lanczos,crop=1920:1080:${Math.round((w - 1920) * t.focus[0])}:${Math.round((h - 1080) * t.focus[1])},eq=saturation=1.12:contrast=1.04[b];[b][1:v]overlay`,
    '-frames:v', '1', '-q:v', '2', '-update', '1', join(OUT, `${t.name}.jpg`)]);
  console.log(t.name);
}
