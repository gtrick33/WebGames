// The trailers' sound, put together in plain arithmetic at 48 kHz stereo: the music (cut, faded, ridden under
// the action), the game's own effects placed where the footage's log says the game played them, and a few
// chosen hits. Writes a 32-bit float WAV; the final loudness pass is ffmpeg's (render.mjs).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FFMPEG, HERE } from '../lib.mjs';

export const RATE = 48000;
export const GAME_AUDIO = join(HERE, '../../../glitchbound/public/games/sigilfall/audio');
const { SAMPLES } = await import(join(HERE, '../../../glitchbound/src/games/sigilfall/audio/samples.ts'));
export { SAMPLES };

const cache = new Map();
/** A file as interleaved stereo floats (the part from `from` for `dur` seconds, if given). */
export function pcm(file, from = 0, dur = 0) {
  const key = `${file}@${from}+${dur}`;
  if (!cache.has(key)) {
    const args = ['-v', 'error'];
    if (from) args.push('-ss', String(from));
    if (dur) args.push('-t', String(dur));
    args.push('-i', file, '-ac', '2', '-ar', String(RATE), '-f', 'f32le', '-');
    const buf = execFileSync(FFMPEG, args, { maxBuffer: 1.5e9 });
    cache.set(key, new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return cache.get(key);
}

/** A small seeded dice, so a rebuilt trailer sounds the same. */
export function dice(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Mix {
  constructor(seconds, seed = 1) {
    this.n = Math.ceil(seconds * RATE);
    this.out = new Float32Array(this.n * 2);
    this.rand = dice(seed);
    this.lastFile = new Map();
  }

  /** Lays `src` down at `at` seconds. `rate` is the playback speed (pitch); `pan` -1 to 1; `fadeIn`/`fadeOut` seconds. */
  add(src, at, { gain = 1, rate = 1, pan = 0, fadeIn = 0, fadeOut = 0, env = null, max = 0 } = {}) {
    const frames = Math.floor(src.length / 2 / rate);
    const len = max ? Math.min(frames, Math.floor(max * RATE)) : frames;
    const start = Math.round(at * RATE);
    const gl = gain * Math.min(1, 1 - pan);
    const gr = gain * Math.min(1, 1 + pan);
    const fi = fadeIn * RATE;
    const fo = fadeOut * RATE;
    for (let i = 0; i < len; i++) {
      const o = start + i;
      if (o < 0) continue;
      if (o >= this.n) break;
      const p = i * rate;
      const i0 = Math.floor(p);
      const fr = p - i0;
      const i1 = Math.min(i0 + 1, src.length / 2 - 1);
      let k = 1;
      if (fi && i < fi) k *= i / fi;
      if (fo && i > len - fo) k *= Math.max(0, (len - i) / fo);
      if (env) k *= env(o / RATE);
      this.out[o * 2] += (src[i0 * 2] * (1 - fr) + src[i1 * 2] * fr) * gl * k;
      this.out[o * 2 + 1] += (src[i0 * 2 + 1] * (1 - fr) + src[i1 * 2 + 1] * fr) * gr * k;
    }
  }

  /** One of the game's sounds by its id (audio/samples.ts): the same files, gain and wander of pitch as in play. */
  game(id, at, vol = 1, bus = 1, opts = {}) {
    const def = SAMPLES[id];
    if (!def) return false;
    const fresh = def.files.length > 1 ? def.files.filter((f) => f !== this.lastFile.get(id)) : def.files;
    const file = fresh[Math.floor(this.rand() * fresh.length)];
    this.lastFile.set(id, file);
    const rate = def.rate[0] + this.rand() * (def.rate[1] - def.rate[0]);
    this.add(pcm(join(GAME_AUDIO, `${file}.mp3`)), at, { gain: def.gain * vol * bus, rate, ...opts });
    return true;
  }

  /** A loop (a land's air) from `at` for `dur` seconds, starting `from` seconds into the file and wrapping. */
  loop(file, at, dur, { gain = 1, fade = 0.4, from = 0 } = {}) {
    const src = pcm(file);
    const total = src.length / 2;
    const start = Math.round(at * RATE);
    const len = Math.round(dur * RATE);
    const f = fade * RATE;
    const off = Math.floor(from * RATE);
    for (let i = 0; i < len; i++) {
      const o = start + i;
      if (o < 0 || o >= this.n) continue;
      const s = (off + i) % total;
      const k = gain * Math.min(1, i / f, (len - i) / f);
      this.out[o * 2] += src[s * 2] * k;
      this.out[o * 2 + 1] += src[s * 2 + 1] * k;
    }
  }

  peak() {
    let m = 0;
    for (let i = 0; i < this.out.length; i++) m = Math.max(m, Math.abs(this.out[i]));
    return m;
  }

  /** Adds another mix (a bus) at a gain. */
  sum(other, gain = 1) {
    for (let i = 0; i < this.out.length; i++) this.out[i] += other.out[i] * gain;
  }

  wav(file) {
    const data = Buffer.from(this.out.buffer, this.out.byteOffset, this.out.byteLength);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + data.length, 4);
    h.write('WAVEfmt ', 8);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(3, 20);
    h.writeUInt16LE(2, 22);
    h.writeUInt32LE(RATE, 24);
    h.writeUInt32LE(RATE * 8, 28);
    h.writeUInt16LE(8, 32);
    h.writeUInt16LE(32, 34);
    h.write('data', 36);
    h.writeUInt32LE(data.length, 40);
    writeFileSync(file, Buffer.concat([h, data]));
    return file;
  }
}

/** A gain that moves in straight lines between points [[t, gain], ...] (riding the music under the action). */
export const ride = (points) => (t) => {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, g0] = points[i - 1];
      const [t1, g1] = points[i];
      return g0 + ((t - t0) / (t1 - t0 || 1)) * (g1 - g0);
    }
  }
  return points[points.length - 1][1];
};
