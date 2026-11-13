// What a piece of music does over time, for someone who can't listen to it: loudness every 2 s, the tempo and
// where the beats fall.  node audio/analyze.mjs "<file>" [--beats]
import { execFileSync } from 'node:child_process';
import { FFMPEG } from '../lib.mjs';

export function decode(file, rate = 11025) {
  const buf = execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength >> 2);
}

/** Onset strength (rise in energy, 512-sample windows hopping 256), the tempo it repeats at, and the beat times. */
export function beats(file, { lo = 70, hi = 180 } = {}) {
  const rate = 11025;
  const x = decode(file, rate);
  const hop = 256;
  const n = Math.floor((x.length - 512) / hop);
  const env = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = 0; j < 512; j++) { const v = x[i * hop + j]; e += v * v; }
    e = Math.log(1 + 1000 * e / 512);
    env[i] = Math.max(0, e - prev);
    prev = e;
  }
  const fps = rate / hop;
  let best = { score: -1, lag: 0 };
  for (let bpm = lo; bpm <= hi; bpm += 0.25) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (let i = 0; i + lag * 4 < n; i += 2) {
      const a = env[i];
      if (a > 0) s += a * (env[Math.round(i + lag)] + 0.5 * env[Math.round(i + lag * 2)] + 0.25 * env[Math.round(i + lag * 4)]);
    }
    if (s > best.score) best = { score: s, lag, bpm };
  }
  // phase: the offset whose comb catches the most onset
  let phase = 0;
  let top = -1;
  for (let p = 0; p < best.lag; p += 0.5) {
    let s = 0;
    for (let k = 0; p + k * best.lag < n; k++) s += env[Math.round(p + k * best.lag)];
    if (s > top) { top = s; phase = p; }
  }
  const times = [];
  for (let k = 0; phase + k * best.lag < n; k++) times.push(+((phase + k * best.lag) / fps).toFixed(3));
  return { bpm: best.bpm, first: +(phase / fps).toFixed(3), beat: 60 / best.bpm, times, seconds: x.length / rate };
}

/** Loudness (dB RMS) of each `step` seconds. */
export function loudness(file, step = 2) {
  const rate = 11025;
  const x = decode(file, rate);
  const out = [];
  for (let i = 0; i + rate * step <= x.length; i += rate * step) {
    let e = 0;
    for (let j = 0; j < rate * step; j++) e += x[i + j] * x[i + j];
    out.push(+(10 * Math.log10(e / (rate * step) + 1e-9)).toFixed(1));
  }
  return out;
}

if (process.argv[1].endsWith('analyze.mjs')) {
  const file = process.argv[2];
  const l = loudness(file, 4);
  const b = beats(file);
  console.log(file.split('/').pop(), `${b.seconds.toFixed(0)}s`, `${b.bpm} bpm, first beat ${b.first}s`);
  console.log(l.map((v) => Math.round(v)).join(' '));
}
