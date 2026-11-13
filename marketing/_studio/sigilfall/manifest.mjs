// Writes the shot manifest (marketing/videos/sigilfall/SHOT-MANIFEST.md) from what was really cut: each trailer's
// timeline as render.mjs left it, and each take's own description in shots.mjs.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, HERE, FOOTAGE, readJson } from './lib.mjs';
import { SHOTS } from './shots.mjs';

const HUD = new Set(['begin', 'first-fights', 'crypt-run', 'equip', 'talents', 'rift', 'vigil', 'ring', 'hall-1', 'hall-60', 'hall-mage']);
const about = (src) => SHOTS[src]?.about ?? (src.startsWith('hall') ? SHOTS.hall.about : src);
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
let md = '# Sigilfall trailers: shot manifest\n\nEvery clip in the three trailers, in order. All footage is the game itself (build of `origin/pre-release` at 09a19bb1), played by the studio\'s pilot with keyboard and mouse events and filmed one frame per 1/60 s of game time. "HUD" is the game\'s interface as a player has it; "clean" is the HUD stepped aside (as the game does for its own scenes) with the camera at its nearest setting.\n';
for (const [name, title] of [['story', 'The Crown of Ash (story trailer)'], ['launch', 'Choose Your Calling (launch trailer)'], ['gameplay', 'Official Gameplay Trailer']]) {
  const f = join(CACHE, 'render', name, 'timeline.json');
  if (!existsSync(f)) continue;
  const tl = readJson(f);
  md += `\n## ${title}\n\n${tl.total.toFixed(1)} s, ${tl.clips.length} clips. Measured loudness before the final gain: ${Number(tl.loudness.input_i).toFixed(1)} LUFS (brought to -14).\n\n| # | At | Length | Take | From | What it is | UI | Words on screen |\n|---|---|---|---|---|---|---|---|\n`;
  for (const c of tl.clips) {
    const words = tl.gfx.filter((g) => ['line', 'plate', 'big', 'chip', 'end'].includes(g.kind) && g.at < c.at + c.dur - 0.2 && g.at + g.dur > c.at + 0.2).map((g) => (g.text ?? g.title ?? (g.kind === 'end' ? 'end card' : '')).replace(/\*/g, '') + (g.sub ? ` / ${g.sub}` : '')).join('; ');
    md += `| ${c.i + 1} | ${fmt(c.at)} | ${c.dur.toFixed(2)} s | \`${c.src}\` | ${c.in.toFixed(1)} s | ${about(c.src)} | ${HUD.has(c.src) ? 'HUD' : 'clean'} | ${words} |\n`;
  }
}
md += '\n## Takes filmed\n\n| Take | Length | What it is | Sounds logged |\n|---|---|---|---|\n';
for (const id of Object.keys(SHOTS).flatMap((k) => (k === 'hall' ? ['hall-1', 'hall-60', 'hall-mage'] : [k]))) {
  const f = join(FOOTAGE, `${id}.json`);
  if (!existsSync(f)) continue;
  const m = readJson(f);
  md += `| \`${id}\` | ${m.seconds.toFixed(1)} s | ${about(id)} | ${m.sounds.filter((s) => s.id).length} |\n`;
}
writeFileSync(join(HERE, '../../videos/sigilfall/SHOT-MANIFEST.md'), md);
console.log('manifest written');
