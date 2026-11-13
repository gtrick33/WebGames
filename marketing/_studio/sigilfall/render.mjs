// Builds a trailer from its edit (edits/<name>.mjs):  node render.mjs <name> [--upright] [--draft] [--sheet]
//   1. each clip is cut from its take (frame-exact) with its own moves (a slow push-in, a fade) into a segment;
//   2. the segments are joined; 3. the graphics are rendered and laid over; 4. the sound is mixed from the
//   music, the takes' own sound logs and the edit's hits; 5. one loudness pass, and the MP4 is written.
// Segments are kept by what made them, so changing one clip re-cuts one clip.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, FFMPEG, FFPROBE, FOOTAGE, HERE, readJson } from './lib.mjs';
import { renderGfx } from './gfx/render.mjs';
import { Mix, pcm, ride, GAME_AUDIO } from './audio/mix.mjs';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const upright = args.includes('--upright');
const draft = args.includes('--draft');
const edit = (await import(join(HERE, 'edits', `${name}.mjs`))).default;
const OUT = join(HERE, '../../videos/sigilfall');
const WORK = join(CACHE, 'render', name + (upright ? '-upright' : ''));
const SEG = join(CACHE, 'segments');
for (const d of [OUT, WORK, SEG]) mkdirSync(d, { recursive: true });
const ff = (a, opts = {}) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28, ...opts });
const FPS = 60;
const W = upright ? 1080 : 1920;
const H = upright ? 1920 : 1080;
const snap = (t) => Math.round(t * FPS) / FPS;

/* ------------------------------------------------------------ the timeline */

// each clip: { src, in, dur, x (seconds of dissolve from the clip before), zoom: [from, to], focus: [x, y] (0..1),
//   fadeIn, fadeOut (from and to black), sfx (how loud the take's own sound is, 0 for none), amb (its air), vx (upright: where to look, 0..1) }
const have = (c) => existsSync(join(FOOTAGE, `${c.src}.mp4`));
for (const c of edit.clips) if (!have(c)) console.warn(`  (no take "${c.src}" yet: clip ${c.id ?? ''} left out)`);
let at = 0;
const clips = edit.clips.filter(have).map((c, i) => {
  const dur = snap(c.dur);
  const x = i ? snap(c.x ?? 0) : 0;
  const start = snap(at - x);
  at = start + dur;
  return { ...c, i, dur, x, at: start, in: snap(c.in ?? 0) };
});
const total = snap(at);

const sizes = new Map();
function sizeOf(src) {
  if (!sizes.has(src)) sizes.set(src, execFileSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', join(FOOTAGE, `${src}.mp4`)]).toString().trim());
  return sizes.get(src);
}

/** The picture of one clip from `off` seconds in, for `len` seconds: its crop, its push-in, its fades. */
function chain(c, off, len) {
  const f = [];
  const [z0, z1] = c.zoom ?? [1, 1];
  const [fx, fy] = c.focus ?? [0.5, 0.5];
  const z = `(${z0}+(${z1 - z0})*((t+${off})/${c.dur}))`;
  if (upright) {
    // the footage's middle band, 4:5, looked at where the action is, over a soft copy of itself
    const vx = c.vx ?? fx;
    const cw = 864;
    const x0 = Math.round(Math.min(1920 - cw, Math.max(0, vx * 1920 - cw / 2)));
    const bg = 'scale=270:152,boxblur=6:2,scale=1080:1920:flags=bicubic,crop=1080:1920,eq=brightness=-0.22:saturation=0.8';
    // (a menu or a wide scene is shown whole, across the middle, rather than cut to its middle third)
    if (c.vfit) f.push(`scale=1920:1080:flags=lanczos,split[m][b];[b]${bg}[bg];[m]scale=1080:608:flags=lanczos[fg];[bg][fg]overlay=0:656`);
    else f.push(`scale=1920:1080:flags=lanczos,split[m][b];[b]${bg}[bg];[m]crop=${cw}:1080:${x0}:0,scale=w='2*trunc(1080*${z}/2)':h='2*trunc(1350*${z}/2)':eval=frame:flags=lanczos,crop=1080:1350:x='(iw-1080)*0.5':y='(ih-1350)*${fy}'[fg];[bg][fg]overlay=0:285`);
  } else if (z0 !== 1 || z1 !== 1 || sizeOf(c.src) !== '1920x1080') {
    f.push(`scale=w='2*trunc(1920*${z}/2)':h='2*trunc(1080*${z}/2)':eval=frame:flags=lanczos,crop=1920:1080:x='(iw-1920)*${fx}':y='(ih-1080)*${fy}'`);
  }
  if (c.grade) f.push(c.grade);
  if (c.fadeIn && off < c.fadeIn) f.push(`fade=t=in:st=${-off}:d=${c.fadeIn}`);
  if (c.fadeOut && off + len > c.dur - c.fadeOut) f.push(`fade=t=out:st=${c.dur - c.fadeOut - off}:d=${c.fadeOut}`);
  f.push(`fps=${FPS},format=yuv420p,setsar=1`);
  return f.join(',');
}
const ENC = ['-c:v', 'libx264', '-preset', draft ? 'ultrafast' : 'fast', '-crf', draft ? '20' : '11', '-g', '30', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an'];
const srcOf = (c) => join(FOOTAGE, `${c.src}.mp4`);
function segment(key, build) {
  const id = createHash('sha1').update(JSON.stringify([key, upright, draft])).digest('hex').slice(0, 16);
  const file = join(SEG, `${id}.mp4`);
  if (!existsSync(file)) build(file);
  return file;
}

const parts = [];
clips.forEach((c, i) => {
  const next = clips[i + 1];
  const head = c.x;
  const tail = next?.x ?? 0;
  // the dissolve into this clip: the clip before's last moments under this one's first
  if (head > 0) {
    const p = clips[i - 1];
    parts.push(segment(['x', p, c, existsSync(srcOf(p)), existsSync(srcOf(c))].map((v) => (typeof v === 'object' ? { ...v, i: 0, at: 0 } : v)), (file) => {
      ff(['-ss', String(p.in + p.dur - head), '-t', String(head), '-i', srcOf(p), '-ss', String(c.in), '-t', String(head), '-i', srcOf(c),
        '-filter_complex', `[0:v]${chain(p, p.dur - head, head)}[a];[1:v]${chain(c, 0, head)}[b];[a][b]xfade=transition=fade:duration=${head}:offset=0,format=yuv420p`, '-t', String(head), ...ENC, file]);
    }));
  }
  const len = snap(c.dur - head - tail);
  if (len > 0) {
    parts.push(segment(['c', { ...c, i: 0, at: 0 }, head, tail], (file) => {
      const fc = chain(c, head, len);
      ff(['-ss', String(c.in + head), '-t', String(len), '-i', srcOf(c), ...(fc.includes('[') ? ['-filter_complex', `[0:v]${fc}`] : ['-vf', fc]), '-t', String(len), ...ENC, file]);
    }));
  }
});
writeFileSync(join(WORK, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
const video = join(WORK, 'video.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', join(WORK, 'list.txt'), '-c', 'copy', video]);
const got = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString());
console.log(`${name}${upright ? ' (upright)' : ''}: ${clips.length} clips, ${total.toFixed(2)}s planned, ${got.toFixed(2)}s cut`);

/* ------------------------------------------------------------ graphics */

const items = (typeof edit.gfx === 'function' ? edit.gfx({ clips, total, upright }) : edit.gfx).filter((g) => !(upright ? g.wideOnly : g.uprightOnly));
if (args.includes('--sheet')) {
  // only a contact sheet of the cut with its graphics, for a quick look
}
const gfxKey = createHash('sha1').update(JSON.stringify([items, total, upright, readFileSync(join(HERE, 'gfx/stage.html'), 'utf8')])).digest('hex').slice(0, 16);
const gfx = join(SEG, `gfx-${gfxKey}.mov`);
if (!existsSync(gfx)) {
  const r = await renderGfx(items, gfx, { seconds: total, w: W, h: H, upright });
  console.log(`graphics: ${r.drawn} of ${r.frames} frames drawn`);
}

/* ------------------------------------------------------------ sound */

const mix = new Mix(total + 0.5, 7);
const music = new Mix(total + 0.5);
for (const m of edit.music ?? []) {
  const src = pcm(m.file, m.from ?? 0, (m.dur ?? total) + 1);
  music.add(src, m.at ?? 0, { gain: m.gain ?? 1, fadeIn: m.fadeIn ?? 0, fadeOut: m.fadeOut ?? 0, max: m.dur ?? total - (m.at ?? 0), env: m.ride ? ride(m.ride) : null });
}
const fx = new Mix(total + 0.5, 11);
for (const c of clips) {
  const level = c.sfx ?? edit.sfx ?? 1;
  const meta = existsSync(join(FOOTAGE, `${c.src}.json`)) ? readJson(join(FOOTAGE, `${c.src}.json`)) : { sounds: [] };
  if (level > 0) {
    for (const s of meta.sounds) {
      if (!s.id) continue;
      const t = s.f / FPS - c.in;
      if (t < -0.02 || t >= c.dur - 0.02) continue;
      // a sound keeps its place in the picture; under a dissolve it comes up with its clip
      const k = c.x && t < c.x ? t / c.x : 1;
      fx.game(s.id, c.at + Math.max(0, t), s.vol, level * k);
    }
  }
  const amb = c.amb === undefined ? edit.amb : c.amb;
  if (amb) {
    const id = typeof amb === 'string' ? amb : [...meta.sounds].reverse().find((s) => s.ambience && s.f / FPS <= c.in + 1)?.ambience ?? meta.sounds.find((s) => s.ambience)?.ambience;
    if (id) fx.loop(join(GAME_AUDIO, `amb-${id}.mp3`), c.at, c.dur, { gain: (edit.ambGain ?? 0.25) * (typeof c.ambGain === 'number' ? c.ambGain : 1), from: c.in % 20 });
  }
}
// the editor's own hits, from the game's sound library: { at, id, gain, rate }
for (const h of edit.hits ?? []) fx.game(h.id, h.at, h.gain ?? 1, 1, h.rate ? { rate: h.rate } : {});
mix.sum(music, 1);
mix.sum(fx, edit.fxGain ?? 1);
const wav = join(WORK, 'mix.wav');
mix.wav(wav);

/* ------------------------------------------------------------ the film */

// loudness: measured once, then one straight gain to -14 LUFS with a limiter under -1 dB true peak
// loudness: measured, one straight gain toward -14 LUFS, a limiter well under full scale (so the true peak stays
// below -1 dB after encoding), then measured again and trimmed once more, since limiting takes a little away
const lufs = (file) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
};
const LIMIT = 'alimiter=limit=0.76:attack=3:release=80:level=disabled';
const probe = lufs(wav);
const first = -14 - Number(probe.input_i);
const leveled = join(WORK, 'leveled.wav');
ff(['-i', wav, '-af', `volume=${first.toFixed(2)}dB,${LIMIT}`, '-c:a', 'pcm_f32le', leveled]);
const after = lufs(leveled);
const trim = Math.max(-3, Math.min(3, -14 - Number(after.input_i)));
const gain = first + trim;
const outName = `${edit.out}${upright ? '-Vertical' : ''}${draft ? '.draft' : ''}.mp4`;
const out = join(OUT, outName);
ff(['-i', video, '-i', gfx, '-i', leveled,
  '-filter_complex', `[0:v][1:v]overlay=format=auto:shortest=0,format=yuv420p[v];[2:a]volume=${trim.toFixed(2)}dB,${LIMIT},afade=t=out:st=${(total - 0.35).toFixed(2)}:d=0.35[a]`,
  '-map', '[v]', '-map', '[a]', '-t', String(total),
  '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '23' : '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '30', '-bf', '2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out]);
writeFileSync(join(WORK, 'timeline.json'), JSON.stringify({ name, total, loudness: probe, gain, clips: clips.map(({ i, src, at, dur, x }) => ({ i, src, at, dur, in: clips[i].in, x })), gfx: items.map(({ el, ...g }) => g) }, null, 1));
console.log(`wrote ${out} (${total.toFixed(2)}s, in ${Number(probe.input_i).toFixed(1)} LUFS, gain ${gain.toFixed(1)} dB)`);
rmSync(wav, { force: true });
rmSync(leveled, { force: true });
