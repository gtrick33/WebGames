#!/usr/bin/env node
/*
 * The Ring's own sound effects, made here from nothing (no pack, no license: the game's own work). The owner,
 * 2026-11-18: "the sounds ... theyre currently kinda annoying, can we use more cartoony cool and warm sounding
 * effects". So: wooden bonks and marimba plinks for blows, airy whooshes, bouncy thumps, puffy booms, glassy
 * tinkles for frost, a kalimba for healing, slide whistles and a sad trombone for falling, a marimba fanfare for a
 * win. Everything is rounded off (no hard digital edges), a little room is put round it, and the top is rolled off
 * so it sits warm under the music.
 *
 * Deterministic: the same files every run (a seeded random). Run by hand when a sound is changed:
 *   node scripts/sigilfall-ring-sounds.mjs
 * It writes public/games/sigilfall/audio/ring-*.mp3 (mono, 64 kbps, as the other effects); the Ring plays them by
 * src/games/sigilfall/audio/samples.ts `ring-*` and render/ring.ts `ringSound`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 44100;
const OUT = 'public/games/sigilfall/audio';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
/** How loud each sound is at its peak before the table's gain (dBFS). */
const PEAK = -3;

/* ------------------------------------------------------------------ the instruments */

let seed = 0x5eed;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const buf = (sec) => new Float64Array(Math.ceil(sec * SR));
const note = (n) => 440 * 2 ** ((n - 69) / 12);
/** Adds `src` into `dst` from `at` seconds, `g` loud. */
const mix = (dst, src, at = 0, g = 1) => {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * g;
  return dst;
};
/** An attack and an exponential decay. */
const env = (i, att, dec) => {
  const t = i / SR;
  return (t < att ? t / att : 1) * Math.exp(-Math.max(0, t - att) / dec);
};

/** A sine whose pitch glides from f0 to f1 (exponentially), with an optional wobble. */
function glide(sec, f0, f1, { att = 0.004, dec = sec / 3, vib = 0, vibRate = 7, harm = 0 } = {}) {
  const b = buf(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const u = i / b.length;
    const f = f0 * (f1 / f0) ** u * (1 + vib * Math.sin((2 * Math.PI * vibRate * i) / SR));
    ph += (2 * Math.PI * f) / SR;
    b[i] = (Math.sin(ph) + harm * Math.sin(2 * ph) + harm * 0.4 * Math.sin(3 * ph)) * env(i, att, dec);
  }
  return b;
}

/** A marimba: a fundamental and its bar's bright overtones, which die first. Warm and woody. */
function marimba(f, sec = 0.6, bright = 1) {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] =
      Math.sin(2 * Math.PI * f * t) * env(i, 0.002, sec / 3.2) +
      0.35 * bright * Math.sin(2 * Math.PI * f * 3.99 * t) * env(i, 0.001, sec / 14) +
      0.12 * bright * Math.sin(2 * Math.PI * f * 9.2 * t) * env(i, 0.001, sec / 40);
  }
  return b;
}

/** A kalimba: a plucked metal tine, round and gentle. */
function kalimba(f, sec = 0.8) {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = Math.sin(2 * Math.PI * f * t) * env(i, 0.002, sec / 3) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * t) * env(i, 0.001, 0.03) + 0.08 * Math.sin(2 * Math.PI * f * 2 * t) * env(i, 0.002, sec / 5);
  }
  return b;
}

/** A soft bell: inharmonic partials, long and round. */
function bell(f, sec = 1.4) {
  const parts = [
    [1, 1, 1],
    [2.0, 0.5, 0.7],
    [2.76, 0.35, 0.5],
    [5.4, 0.15, 0.25],
  ];
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [m, g, d] of parts) v += g * Math.sin(2 * Math.PI * f * m * t) * env(i, 0.003, (sec / 3) * d);
    b[i] = v;
  }
  return b;
}

/** A plucked string (Karplus-Strong), warm: the loop's filter rolls it off fast. `bend`: how far it sags. */
function pluck(f, sec = 0.6, { damp = 0.5, bend = 0 } = {}) {
  const b = buf(sec);
  let n = Math.round(SR / f);
  const line = Array.from({ length: n }, () => rand() * 2 - 1);
  let p = 0;
  for (let i = 0; i < b.length; i++) {
    const a = line[p % n];
    const c = line[(p + 1) % n];
    const v = (a * (1 - damp) + c * damp) * 0.996;
    line[p % n] = v;
    b[i] = a;
    p++;
    // (sagging: the loop grows a little longer, the new places filled from the old)
    if (bend && i % 64 === 0) {
      const m = Math.max(2, Math.round((SR / f) * (1 + bend * (i / b.length))));
      while (line.length < m) line.push(line[line.length - 1]);
      n = m;
    }
  }
  return b;
}

/** Noise, shaped: a one-pole low-pass that glides from c0 to c1 (Hz), and a high-pass at `hp`. */
function noise(sec, c0, c1, { att = 0.01, dec = sec / 3, hp = 80 } = {}) {
  const b = buf(sec);
  let lp = 0;
  let lp2 = 0;
  let hpState = 0;
  let prev = 0;
  const hpA = 1 / (1 + (2 * Math.PI * hp) / SR);
  for (let i = 0; i < b.length; i++) {
    const u = i / b.length;
    const c = c0 * (c1 / c0) ** u;
    const a = 1 - Math.exp((-2 * Math.PI * c) / SR);
    lp += a * (rand() * 2 - 1 - lp);
    lp2 += a * (lp - lp2);
    hpState = hpA * (hpState + lp2 - prev);
    prev = lp2;
    b[i] = hpState * env(i, att, dec) * 3;
  }
  return b;
}

/** A whoosh: noise whose colour rises and falls, swelling and dying away. */
function whoosh(sec, lo, hi, { peak = 0.4 } = {}) {
  const b = buf(sec);
  let lp = 0;
  let lp2 = 0;
  let s3 = 0;
  let s4 = 0;
  let s5 = 0;
  for (let i = 0; i < b.length; i++) {
    const u = i / b.length;
    const shape = u < peak ? u / peak : (1 - u) / (1 - peak);
    const c = lo + (hi - lo) * shape;
    const a = 1 - Math.exp((-2 * Math.PI * c) / SR);
    const a2 = 1 - Math.exp((-2 * Math.PI * c * 1.6) / SR);
    lp += a * (rand() * 2 - 1 - lp);
    lp2 += a * 0.25 * (lp - lp2);
    // (the band's top rolled off steeply: air, not hiss)
    s3 += a2 * (lp - lp2 - s3);
    s4 += a2 * (s3 - s4);
    s5 += a2 * (s4 - s5);
    b[i] = s5 * Math.sin(Math.PI * Math.min(1, u)) ** 1.5 * 4;
  }
  return b;
}

/** A thump: a kick drum's sine, falling in pitch, with a soft knock on top. Bouncy, not harsh. */
function thump(f0 = 160, f1 = 48, sec = 0.35) {
  return mix(glide(sec, f0, f1, { att: 0.002, dec: sec / 3.5 }), noise(0.03, 2500, 800, { att: 0.001, dec: 0.008 }), 0, 0.25);
}

/** A woodblock "tok". */
const tok = (f = 900, sec = 0.12) => mix(marimba(f, sec, 1.4), noise(0.02, 3000, 1200, { att: 0.0005, dec: 0.004 }), 0, 0.3);

/** A sawtooth through a softening filter, with its pitch bending: brass, a cartoon trombone. */
function brass(f0, f1, sec, { wah = 0, vib = 0.012 } = {}) {
  const b = buf(sec);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < b.length; i++) {
    const u = i / b.length;
    const f = f0 * (f1 / f0) ** u * (1 + vib * Math.sin((2 * Math.PI * 5.5 * i) / SR) * Math.min(1, u * 4));
    ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1;
    const cut = 500 + 1600 * (wah ? 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.2)) : 1) * (1 - 0.5 * u);
    lp += (1 - Math.exp((-2 * Math.PI * cut) / SR)) * (saw - lp);
    b[i] = lp * env(i, 0.03, sec / 1.5) * (u > 0.85 ? (1 - u) / 0.15 : 1);
  }
  return b;
}

/* ------------------------------------------------------------------ the finishing */

/** A small warm room: a few soft echoes, a little diffused. `wet`: how much of it. */
function room(b, wet = 0.18, size = 1) {
  const out = new Float64Array(b.length + Math.round(0.35 * size * SR));
  out.set(b);
  const taps = [0.031, 0.043, 0.059, 0.071, 0.097, 0.13, 0.17, 0.23].map((t) => t * size);
  taps.forEach((t, k) => {
    const g = wet * 0.8 ** k * (k % 2 ? -1 : 1);
    mix(out, b, t, g);
  });
  // (smeared: a one-pole low-pass over the tail)
  let lp = 0;
  for (let i = b.length; i < out.length; i++) out[i] = lp += 0.35 * (out[i] - lp);
  return out;
}

/** Rolls the top off (warmth), takes any offset out, and eases the ends so nothing clicks. */
function finish(b, { warm = 5200 } = {}) {
  const a = 1 - Math.exp((-2 * Math.PI * warm) / SR);
  let lp = 0;
  let lp2 = 0;
  let mean = 0;
  for (let i = 0; i < b.length; i++) mean += b[i] / b.length;
  const out = new Float64Array(b.length);
  for (let i = 0; i < b.length; i++) {
    lp += a * (b[i] - mean - lp);
    out[i] = lp2 += a * (lp - lp2);
  }
  // (silence trimmed off the end, then a short fade)
  let end = out.length;
  const floor = 0.0008 * Math.max(...out.map(Math.abs));
  while (end > SR * 0.05 && Math.abs(out[end - 1]) < floor) end--;
  const cut = out.slice(0, end);
  const fade = Math.min(cut.length, Math.round(0.02 * SR));
  for (let i = 0; i < fade; i++) cut[cut.length - 1 - i] *= i / fade;
  for (let i = 0; i < Math.min(cut.length, 32); i++) cut[i] *= i / 32;
  const peak = Math.max(...cut.map(Math.abs)) || 1;
  const g = 10 ** (PEAK / 20) / peak;
  return cut.map((v) => Math.tanh(v * g * 1.1) / Math.tanh(1.1));
}

/* ------------------------------------------------------------------ the sounds */

const C = (n) => note(n);
/** A run of marimba notes, `gap` apart. */
const run = (notes, gap, sec = 0.5, bright = 1) => {
  const b = buf(gap * notes.length + sec);
  notes.forEach((n, k) => mix(b, marimba(C(n), sec, bright), k * gap, 0.8));
  return b;
};
const kal = (notes, gap, sec = 0.7) => {
  const b = buf(gap * notes.length + sec);
  notes.forEach((n, k) => mix(b, kalimba(C(n), sec), k * gap, 0.8));
  return b;
};
const chord = (notes, sec, fn = bell) => {
  const b = buf(sec);
  notes.forEach((n) => mix(b, fn(C(n), sec), 0, 0.5));
  return b;
};
const tinkle = (count, lo, hi, span, sec = 0.5) => {
  const b = buf(span + sec);
  for (let k = 0; k < count; k++) mix(b, bell(C(lo + Math.floor(rand() * (hi - lo))), sec), rand() * span, 0.4);
  return b;
};

const SOUNDS = {
  // blades and blows: airy swishes, and a cartoon bonk where they land
  swing: () => room(whoosh(0.2, 300, 1600, { peak: 0.35 }), 0.12),
  swingBig: () => room(mix(whoosh(0.32, 200, 1100, { peak: 0.4 }), glide(0.2, 220, 120, { dec: 0.06 }), 0.05, 0.25), 0.14),
  spear: () => room(mix(whoosh(0.3, 500, 2200, { peak: 0.6 }), glide(0.28, 1300, 2300, { dec: 0.12, vib: 0.01 }), 0.02, 0.18), 0.14),
  hit: () => room(mix(thump(220, 90, 0.18), tok(760, 0.1), 0, 0.6), 0.1),
  clash: () => room(mix(tok(1100, 0.12), tok(1480, 0.1), 0.012, 0.6), 0.12),
  critBlade: () => room(mix(mix(thump(260, 70, 0.3), tok(980, 0.14), 0, 0.8), run([88, 95], 0.04, 0.3, 1.2), 0.04, 0.5), 0.16),
  hurt: () => room(mix(thump(180, 60, 0.26), glide(0.22, 330, 190, { dec: 0.08, harm: 0.4 }), 0.01, 0.35), 0.1),
  bow: () => room(mix(pluck(C(50), 0.4, { damp: 0.35, bend: 0.25 }), whoosh(0.18, 700, 2200, { peak: 0.2 }), 0.03, 0.5), 0.12),
  // shields and moving
  shield: () => room(mix(glide(0.4, 300, 290, { dec: 0.14, vib: 0.03, vibRate: 11, harm: 0.5 }), tok(600, 0.1), 0, 0.5), 0.2),
  shieldBreak: () => room(mix(glide(0.06, 900, 400, { dec: 0.02 }), glide(0.45, 520, 160, { dec: 0.15, vib: 0.05, vibRate: 13 }), 0.03, 0.8), 0.16),
  blink: () => room(glide(0.16, 380, 1500, { dec: 0.06, harm: 0.3 }), 0.2),
  buff: () => room(kal([79, 86], 0.08, 0.6), 0.22),
  // spells, by what they are made of
  bolt: () => room(glide(0.22, 600, 1700, { dec: 0.08, vib: 0.02, vibRate: 30 }), 0.16),
  zap: () => room(mix(glide(0.16, 1500, 500, { dec: 0.06, harm: 0.6 }), noise(0.1, 4000, 1500, { dec: 0.03 }), 0, 0.3), 0.14),
  fireball: () => room(mix(mix(whoosh(0.4, 200, 1000, { peak: 0.3 }), noise(0.35, 1200, 400, { dec: 0.12 }), 0.02, 0.5), glide(0.3, 140, 80, { dec: 0.1 }), 0, 0.4), 0.16),
  explode: () => room(mix(thump(140, 38, 0.6), noise(0.6, 1600, 200, { att: 0.004, dec: 0.15 }), 0, 0.75), 0.22, 1.2),
  freeze: () => room(mix(tinkle(6, 88, 100, 0.12, 0.45), noise(0.16, 6000, 3000, { dec: 0.04, hp: 2000 }), 0, 0.3), 0.25),
  shatter: () => room(mix(mix(tinkle(14, 84, 103, 0.28, 0.5), noise(0.22, 5000, 1500, { att: 0.001, dec: 0.05, hp: 900 }), 0, 0.6), thump(200, 70, 0.2), 0, 0.5), 0.26),
  shard: () => room(bell(C(96), 0.5), 0.22),
  thunder: () => room(mix(thump(110, 34, 0.9), noise(1.1, 700, 90, { att: 0.01, dec: 0.35 }), 0.02, 0.9), 0.24, 1.4),
  holy: () => room(chord([72, 76, 79, 84], 1.1), 0.3, 1.3),
  shadow: () => room(glide(0.55, 260, 70, { att: 0.03, dec: 0.2, vib: 0.06, vibRate: 6, harm: 0.5 }), 0.24),
  nature: () => room(kal([67, 71, 74], 0.05, 0.7), 0.22),
  heal: () => room(kal([72, 76, 79, 84], 0.07, 0.8), 0.28, 1.2),
  rift: () => room(mix(whoosh(0.6, 150, 600, { peak: 0.5 }), glide(0.6, 300, 90, { att: 0.05, dec: 0.25, vib: 0.08, vibRate: 5 }), 0, 0.6), 0.26),
  // the big ones: supers
  quake: () => room(mix(mix(thump(120, 36, 0.6), thump(110, 34, 0.6), 0.16, 0.9), noise(0.9, 400, 80, { dec: 0.3 }), 0, 0.7), 0.24, 1.4),
  meteor: () => room(mix(glide(0.5, 1800, 400, { dec: 0.4, vib: 0.01 }), mix(thump(130, 34, 0.7), noise(0.7, 1400, 150, { dec: 0.2 }), 0, 0.8), 0.45, 1), 0.24, 1.3),
  nova: () => room(mix(chord([60, 67, 72, 76, 79], 1.4), tinkle(8, 91, 103, 0.4, 0.5), 0.05, 0.4), 0.3, 1.4),
  // falling, and the moments
  die: () => room(mix(glide(0.55, 1200, 220, { att: 0.01, dec: 0.4, vib: 0.02, vibRate: 7 }), thump(150, 50, 0.3), 0.5, 0.9), 0.18),
  slam: () => room(thump(130, 40, 0.5), 0.2, 1.2),
  roar: () => room(mix(glide(0.6, 180, 520, { att: 0.12, dec: 0.4, harm: 0.6, vib: 0.02 }), whoosh(0.6, 200, 1000, { peak: 0.85 }), 0, 0.4), 0.2),
  epic: () => room(run([79, 83, 86, 91, 95], 0.035, 0.45, 1.1), 0.24),
  pickupBig: () => room(run([88, 95], 0.07, 0.4, 1.2), 0.18),
  orb: () => room(glide(0.14, 400, 900, { dec: 0.05 }), 0.15),
  talent: () => room(tok(1200, 0.08), 0.1),
  checkpoint: () => room(mix(marimba(C(84), 0.7), marimba(C(91), 0.8), 0.12, 0.9), 0.25),
  victory: () => {
    const b = run([72, 76, 79], 0.11, 0.5, 1.1);
    const end = buf(2);
    mix(end, b);
    mix(end, chord([60, 72, 76, 79, 84], 1.3, (f, s) => marimba(f, s, 0.8)), 0.36, 1);
    mix(end, glide(1.2, C(48), C(48), { att: 0.01, dec: 0.5 }), 0.36, 0.5);
    return room(end, 0.28, 1.3);
  },
  playerDie: () => {
    const b = buf(2.2);
    [63, 62, 61].forEach((n, k) => mix(b, brass(C(n), C(n), 0.34, { wah: 1 }), k * 0.38, 0.8));
    mix(b, brass(C(60), C(56), 0.9, { wah: 1, vib: 0.03 }), 1.14, 0.9);
    return room(b, 0.2);
  },
  levelup: () => {
    const b = run([72, 76, 79, 84, 88], 0.06, 0.5, 1.1);
    return room(mix(buf(1.6), mix(b, chord([72, 79, 84], 1.1), 0.3, 0.8)), 0.28, 1.3);
  },
};

/* ------------------------------------------------------------------ out */

function wav(samples) {
  const n = samples.length;
  const out = Buffer.alloc(44 + n * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + n * 2, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return out;
}

const tmp = join(tmpdir(), 'sigilfall-ring-sounds');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const [name, make] of Object.entries(SOUNDS)) {
  if (only.length && !only.includes(name)) continue;
  seed = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0x5eed);
  const src = join(tmp, `${name}.wav`);
  writeFileSync(src, wav(finish(make())));
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', join(OUT, `ring-${name}.mp3`)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
}
console.log(`${only.length || Object.keys(SOUNDS).length} Ring sounds in ${OUT}`);
