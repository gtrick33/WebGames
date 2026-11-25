#!/usr/bin/env node
/**
 * How loud Sigilfall's recordings are, measured, so the mix can be set by numbers as well as by ear.
 *
 *   node scripts/sigilfall-loudness.mjs            (prints the tables and writes docs/review/sf9-sound-mix/loudness.json)
 *
 * Needs ffmpeg on the PATH (nothing is changed: it only reads). For each piece of music: its loudness over the whole
 * piece (EBU R128, in LUFS) and its true peak. For each effect and ambience: its peak and its mean level (an effect is
 * too short for R128 to say anything about). Then each sound of audio/samples.ts as it is played: the loudest of its
 * files and the mean of them, with its `gain` laid over.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = join(ROOT, 'public/games/sigilfall/audio');
const MUSIC = join(ROOT, 'public/games/sigilfall/music');
const OUT = join(ROOT, 'docs/review/sf9-sound-mix');

// (ffmpeg writes what it measures to stderr)
const err = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args, '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';

const num = (text, re) => {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
};

const music = {};
for (const f of readdirSync(MUSIC).filter((x) => x.endsWith('.mp3')).sort()) {
  const out = err(['-i', join(MUSIC, f), '-af', 'ebur128=peak=true']);
  const tail = out.slice(out.lastIndexOf('Summary:'));
  music[f.replace('.mp3', '')] = { lufs: num(tail, /I:\s+(-?[\d.]+) LUFS/), range: num(tail, /LRA:\s+(-?[\d.]+) LU/), peak: num(tail, /Peak:\s+(-?[\d.]+) dBFS/) };
}

const files = {};
for (const f of readdirSync(AUDIO).filter((x) => x.endsWith('.mp3')).sort()) {
  const out = err(['-i', join(AUDIO, f), '-af', 'volumedetect']);
  files[f.replace('.mp3', '')] = { mean: num(out, /mean_volume:\s+(-?[\d.]+) dB/), peak: num(out, /max_volume:\s+(-?[\d.]+) dB/) };
}

// each sound as it is played: read from the table itself (a plain read of its lines: names, files, gain)
const src = readFileSync(join(ROOT, 'src/games/sigilfall/audio/samples.ts'), 'utf8');
const lists = {};
for (const m of src.matchAll(/^const (\w+) = \[([^\]]+)\];/gm)) lists[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
const played = {};
for (const m of src.matchAll(/^\s+'?([\w:-]+)'?: \{ files: (\[[^\]]*\]|\w+), gain: ([\d.]+)/gm)) {
  const names = m[2].startsWith('[') ? [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]) : (lists[m[2]] ?? []);
  const got = names.map((n) => files[n]).filter(Boolean);
  if (!got.length) continue;
  const gain = Number(m[3]);
  const db = 20 * Math.log10(gain);
  played[m[1]] = { gain, files: names.length, peak: +(Math.max(...got.map((g) => g.peak)) + db).toFixed(1), mean: +(got.reduce((a, g) => a + g.mean, 0) / got.length + db).toFixed(1) };
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'loudness.json'), JSON.stringify({ music, files, played }, null, 1));

const col = (s, n) => String(s).padEnd(n);
console.log('Music (whole piece): LUFS, range, true peak');
for (const [id, m] of Object.entries(music)) console.log(`  ${col(id, 14)} ${col(m.lufs, 7)} ${col(m.range, 6)} ${m.peak}`);
const lufs = Object.values(music).map((m) => m.lufs).filter((x) => x !== null).sort((a, b) => a - b);
console.log(`  quietest ${lufs[0]}, loudest ${lufs[lufs.length - 1]}, middle ${lufs[Math.floor(lufs.length / 2)]}`);
console.log('\nSounds as played (gain laid over): peak dB, mean dB');
for (const [id, p] of Object.entries(played).sort((a, b) => b[1].peak - a[1].peak)) console.log(`  ${col(id, 18)} gain ${col(p.gain, 5)} peak ${col(p.peak, 7)} mean ${p.mean}`);
