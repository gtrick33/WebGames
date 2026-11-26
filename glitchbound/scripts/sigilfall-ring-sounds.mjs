#!/usr/bin/env node
/*
 * The Ring's own sound effects, made here from nothing (no pack, no license: the game's own work).
 *
 * The owner, 2026-11-19, on the cartoony set before this one: "the current sounds are awful, its like jungle bells
 * ... make them similar to wow pls, frost mage feels like santa claus with bells". So no bells, marimbas or kalimbas:
 * the weight of a fantasy fight instead. Frost is a cold hiss and the crunch of ice, fire a roar with embers cracking
 * in it, holy and healing a choir's swell, shadow a low growl drawn in, blows a thud with a crunch in it, steel a short
 * scrape, a win a brass call over drums. Made in the manner of the genre, not copied from any game.
 *
 * Deterministic: the same files every run (a seeded random). Run by hand when a sound is changed:
 *   node scripts/sigilfall-ring-sounds.mjs [name ...]
 * It writes public/games/sigilfall/audio/ring-*.mp3 (mono, 64 kbps, as the other effects); the Ring plays them by
 * src/games/sigilfall/audio/samples.ts `ring-*` and render/ring.ts `ringSound`. The few of the campaign's own made the
 * same way (CAMPAIGN below) are written under their own names.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 44100;
const OUT = 'public/games/sigilfall/audio';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
/**
 * How loud each sound is (dB, its loudest tenth of a second) before the table's gain: about where the set before sat,
 * so the mix in a match stays as it was. Blows that come all the time a little under, a click well under.
 */
const LOUD = -10.5;
const LOUD_OF = { hit: -12.5, clash: -12, swing: -12, hurt: -11.5, critBlade: -11, talent: -14, spear: -12, 'sigil-won': -12 };

/* ------------------------------------------------------------------ the instruments */

let seed = 0x5eed;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const between = (a, b) => a + (b - a) * rand();
const buf = (sec) => new Float64Array(Math.ceil(sec * SR));
const note = (n) => 440 * 2 ** ((n - 69) / 12);
/** Adds `src` into `dst` from `at` seconds, `g` loud. */
const mix = (dst, src, at = 0, g = 1) => {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * g;
  return dst;
};
/** Sounds laid together, each [buffer, at, gain], in one buffer long enough for all. */
const layer = (...parts) => {
  const len = Math.max(...parts.map(([b, at = 0]) => b.length + Math.round(at * SR)));
  const out = new Float64Array(len);
  for (const [b, at = 0, g = 1] of parts) mix(out, b, at, g);
  return out;
};
/** An attack and an exponential decay. */
const env = (i, att, dec) => {
  const t = i / SR;
  return (t < att ? t / att : 1) * Math.exp(-Math.max(0, t - att) / dec);
};
/** A swell: rises over `peak` of the length (a curve), then dies away. */
const swell = (u, peak) => (u < peak ? Math.sin((Math.PI / 2) * (u / peak)) ** 2 : Math.max(0, 1 - (u - peak) / (1 - peak)) ** 1.6);

/** A biquad (RBJ) run over `b`; `f` may be a function of where it is (0..1). */
function biquad(b, type, f, q = 0.707) {
  const out = new Float64Array(b.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let c = null;
  const coef = (fr) => {
    const w = (2 * Math.PI * Math.min(fr, SR * 0.45)) / SR;
    const al = Math.sin(w) / (2 * q);
    const cw = Math.cos(w);
    const [b0, b1, b2] = type === 'lp' ? [(1 - cw) / 2, 1 - cw, (1 - cw) / 2] : type === 'hp' ? [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2] : [al, 0, -al];
    const a0 = 1 + al;
    return [b0 / a0, b1 / a0, b2 / a0, (-2 * cw) / a0, (1 - al) / a0];
  };
  const fixed = typeof f === 'number';
  if (fixed) c = coef(f);
  for (let i = 0; i < b.length; i++) {
    if (!fixed && i % 32 === 0) c = coef(f(i / b.length));
    const x = b[i];
    const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}
const white = (sec) => buf(sec).map(() => rand() * 2 - 1);
const shape = (b, fn) => b.map((v, i) => v * fn(i / b.length, i));
/** Soft saturation: weight and grit. */
const drive = (b, k = 2) => b.map((v) => Math.tanh(v * k) / Math.tanh(k));

/** Coloured noise: band-passed (or low/high) with a moving centre, under an envelope `fn(u)`. */
function air(sec, type, f, q, fn) {
  return shape(biquad(white(sec), type, f, q), fn);
}

/**
 * Grains: many tiny bursts of noise, each rung through a narrow band at its own pitch and gone in a few ms. Dense and
 * high, the crunch of ice; sparse and low, embers cracking; low and heavy, falling rubble. `rate`: per second.
 */
function grains(sec, rate, { lo = 2000, hi = 7000, dec = [0.003, 0.012], q = 6, fade = (u) => 1 - u, g = [0.4, 1] } = {}) {
  const b = buf(sec + 0.05);
  const n = Math.round(rate * sec);
  for (let k = 0; k < n; k++) {
    const at = rand() * sec;
    const d = between(dec[0], dec[1]);
    const len = Math.ceil(d * 6 * SR);
    const burst = new Float64Array(len);
    for (let i = 0; i < len; i++) burst[i] = (rand() * 2 - 1) * Math.exp(-i / (d * SR));
    const f = lo * (hi / lo) ** rand();
    const rung = biquad(burst, 'bp', f, q);
    mix(b, rung, at, between(g[0], g[1]) * fade(at / sec) * Math.sqrt(q));
  }
  return b;
}

/** A boom: a falling sine (the weight), a body of low noise, and a little grit. */
function boom(f0 = 120, f1 = 38, sec = 0.6, { body = 0.5, click = 0.25 } = {}) {
  const b = buf(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / (sec * 0.15));
    ph += (2 * Math.PI * f) / SR;
    b[i] = Math.sin(ph) * env(i, 0.002, sec / 3.2);
  }
  const low = air(sec, 'lp', (u) => 900 * (1 - u) + 120, 0.8, (u) => Math.exp(-u * 6));
  const knock = air(0.03, 'bp', 1800, 1.2, (u) => Math.exp(-u * 8));
  return drive(layer([b], [low, 0, body], [knock, 0, click]), 1.8);
}

/** A whoosh: noise through a band that rises and falls, swelling and dying away. */
function whoosh(sec, lo, hi, { peak = 0.4, q = 1.2 } = {}) {
  return air(sec, 'bp', (u) => lo + (hi - lo) * swell(u, peak), q, (u) => swell(u, peak));
}

/** Fire: a roar of low noise that breathes and flutters, with embers cracking in it. */
function fire(sec, { lo = 300, hi = 1400, crackle = 40, peak = 0.3 } = {}) {
  let flutter = 0;
  const roar = shape(biquad(biquad(white(sec), 'lp', (u) => lo + (hi - lo) * swell(u, peak), 0.9), 'hp', 70), (u) => {
    flutter += 0.02 * (rand() - 0.5);
    flutter *= 0.995;
    return swell(u, peak) * (1 + 6 * flutter);
  });
  return layer([roar, 0, 1.4], [grains(sec, crackle, { lo: 900, hi: 4500, dec: [0.0015, 0.005], q: 3, fade: (u) => swell(u, peak), g: [0.2, 1] }), 0, 0.5]);
}

/** Cold: a breath of high, thin hiss. */
const frostHiss = (sec, peak = 0.3) => air(sec, 'bp', (u) => 5200 + 2200 * swell(u, peak), 1.4, (u) => swell(u, peak));

/** Ice crunching and cracking: dense high grains over a low crack. */
const crunch = (sec, rate, { lo = 1800, hi = 8000, fade = (u) => (1 - u) ** 2 } = {}) => grains(sec, rate, { lo, hi, dec: [0.0015, 0.006], q: 4, fade });

/** Detuned sawtooths: the stuff of brass, choirs and growls. */
function saws(sec, freqs, { detune = 0.006, vib = 0.004, glide = 1 } = {}) {
  const b = buf(sec);
  const voices = freqs.flatMap((f) => [-1, 0, 1].map((d) => ({ f: f * (1 + d * detune), ph: rand() })));
  for (let i = 0; i < b.length; i++) {
    const u = i / b.length;
    const v = 1 + vib * Math.sin((2 * Math.PI * 5.2 * i) / SR);
    let s = 0;
    for (const o of voices) {
      o.ph = (o.ph + (o.f * v * glide ** u) / SR) % 1;
      s += 2 * o.ph - 1;
    }
    b[i] = s / voices.length;
  }
  return b;
}

/** A choir on "ah": sawtooths through a voice's formants, swelling in and dying away. Holy and healing. */
function choir(sec, notes, { peak = 0.35, bright = 1 } = {}) {
  const src = saws(sec, notes.map(note), { detune: 0.008, vib: 0.006 });
  const vowel = [
    [760, 1, 7],
    [1150, 0.6 * bright, 8],
    [2600, 0.25 * bright, 10],
  ];
  const voiced = layer(...vowel.map(([f, g, q]) => [biquad(src, 'bp', f, q), 0, g]));
  return shape(voiced, (u) => swell(u, peak));
}

/** A shimmer: high, airy noise that rises like light gathering (no pitch, no bell). */
const shimmer = (sec, { lo = 3000, hi = 9000, peak = 0.5 } = {}) => air(sec, 'bp', (u) => lo + (hi - lo) * u, 2.5, (u) => swell(u, peak));

/** Brass: sawtooths through a lowpass that opens on the attack: horns. */
function horn(sec, notes, { att = 0.05, open = 2400, closed = 700 } = {}) {
  const src = saws(sec, notes.map(note), { detune: 0.004, vib: 0.005 });
  const f = biquad(biquad(src, 'lp', (u) => closed + (open - closed) * Math.exp(-u * 3) * Math.min(1, (u * sec) / att), 0.9), 'lp', 3500, 0.7);
  return shape(f, (u) => Math.min(1, (u * sec) / att) * (u > 0.8 ? (1 - u) / 0.2 : 1));
}

/** A growl: a low sawtooth, warbling, driven, and dark. Shadow and beasts. */
function growl(sec, f0, f1, { peak = 0.5, cut = 900 } = {}) {
  const src = saws(sec, [f0], { detune: 0.02, vib: 0.05, glide: f1 / f0 });
  return shape(biquad(drive(src, 3), 'lp', cut, 1.4), (u) => swell(u, peak));
}

/** Steel on steel: a quick scrape and a short ring of a blade's few clangorous partials (gone in a blink: no bell). */
function steel(sec = 0.22, base = 1700) {
  const b = buf(sec);
  const parts = [1, 1.47, 2.09, 2.83, 3.71].map((m) => ({ f: base * m * between(0.97, 1.03), g: between(0.3, 0.7), d: between(0.008, 0.025) }));
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const p of parts) v += p.g * Math.sin(2 * Math.PI * p.f * t) * Math.exp(-t / p.d);
    b[i] = v / parts.length;
  }
  return layer([b, 0, 0.6], [air(sec, 'bp', (u) => 5000 - 2500 * u, 1.2, (u) => Math.exp(-u * 12)), 0, 0.8]);
}

/** A body struck: a thud, and the crunch of the blow in it. */
const thud = (f0 = 150, sec = 0.25, crunchy = 0.5) =>
  layer([boom(f0, 45, sec, { body: 0.7, click: 0.15 })], [grains(0.06, 900, { lo: 500, hi: 2600, dec: [0.002, 0.006], q: 2 }), 0.002, crunchy]);

/* ------------------------------------------------------------------ the finishing */

/**
 * A hall around it: a smooth reverb (eight damped feedback delays and four all-passes, the classic way), dark, so a
 * sound blooms instead of echoing. `wet`: how much of it; `size`: roughly how long it rings, in seconds.
 */
function hall(b, wet = 0.2, size = 0.8) {
  const out = new Float64Array(b.length + Math.round(size * 1.2 * SR));
  out.set(b);
  const input = biquad(biquad(out, 'lp', 4200, 0.7), 'hp', 150, 0.7);
  const fb = Math.min(0.9, 0.62 + 0.2 * size);
  const damp = 0.35;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => ({ line: new Float64Array(n), p: 0, lp: 0 }));
  const passes = [556, 441, 341, 225].map((n) => ({ line: new Float64Array(n), p: 0 }));
  const wetBuf = new Float64Array(out.length);
  for (let i = 0; i < out.length; i++) {
    let acc = 0;
    for (const c of combs) {
      const y = c.line[c.p];
      c.lp = y * (1 - damp) + c.lp * damp;
      c.line[c.p] = input[i] * 0.03 + c.lp * fb;
      c.p = (c.p + 1) % c.line.length;
      acc += y;
    }
    for (const a of passes) {
      const y = a.line[a.p];
      a.line[a.p] = acc + y * 0.5;
      a.p = (a.p + 1) % a.line.length;
      acc = y - acc;
    }
    wetBuf[i] = acc;
  }
  return mix(out, wetBuf, 0, wet * 4);
}

const peakOf = (b) => b.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** The loudness of its loudest tenth of a second, in dB. */
function loudness(b) {
  const w = Math.round(0.1 * SR);
  let best = 0;
  for (let i = 0; i + w <= Math.max(w, b.length); i += Math.round(w / 10)) {
    let e = 0;
    for (let k = i; k < Math.min(b.length, i + w); k++) e += b[k] * b[k];
    best = Math.max(best, e / w);
  }
  return 10 * Math.log10(best || 1e-12);
}

/** Takes any offset and the dull rumble under hearing out, eases the ends, and brings it to its loudness. */
function finish(b, loud = LOUD) {
  const out = biquad(biquad(b, 'hp', 32, 0.7), 'lp', 12000, 0.7);
  let end = out.length;
  const floor = 0.0008 * peakOf(out);
  while (end > SR * 0.05 && Math.abs(out[end - 1]) < floor) end--;
  const cut = out.slice(0, end);
  const fade = Math.min(cut.length, Math.round(0.03 * SR));
  for (let i = 0; i < fade; i++) cut[cut.length - 1 - i] *= i / fade;
  for (let i = 0; i < Math.min(cut.length, 32); i++) cut[i] *= i / 32;
  // (brought to its loudness; a peak that would go over is rounded off, not clipped)
  const g = 10 ** ((loud - loudness(cut)) / 20);
  return cut.map((v) => 0.98 * Math.tanh((v * g) / 0.98));
}

/* ------------------------------------------------------------------ the sounds */

const SOUNDS = {
  // blades and blows: the blade's rush through the air, a thud with a crunch where it lands, steel on steel
  swing: () => hall(whoosh(0.22, 500, 3200, { peak: 0.45, q: 1.6 }), 0.1, 0.4),
  swingBig: () => hall(layer([whoosh(0.36, 250, 1800, { peak: 0.5, q: 1.3 })], [whoosh(0.3, 900, 4200, { peak: 0.55, q: 2 }), 0.03, 0.35]), 0.14, 0.5),
  spear: () => hall(layer([whoosh(0.32, 700, 3600, { peak: 0.65, q: 2.4 })], [frostHiss(0.32, 0.6), 0, 0.5], [crunch(0.2, 120), 0.12, 0.25]), 0.16, 0.6),
  hit: () => hall(thud(160, 0.22, 0.6), 0.1, 0.4),
  clash: () => hall(layer([steel(0.2, between(1500, 1900))], [thud(190, 0.12, 0.3), 0, 0.5]), 0.12, 0.5),
  critBlade: () => hall(layer([thud(130, 0.35, 0.9)], [steel(0.22, 1300), 0.004, 0.6], [whoosh(0.18, 600, 2600, { peak: 0.2 }), 0, 0.4]), 0.16, 0.6),
  hurt: () => hall(layer([thud(120, 0.3, 0.7)], [air(0.12, 'bp', 400, 1.5, (u) => Math.exp(-u * 5)), 0.01, 0.4]), 0.1, 0.4),
  // (no bow or arrow made here since the owner, 2026-11-26: "fix the ring's ranger sounds, theyre real shit, use the ones
  // from the campaign": the Ring's ranger plays the campaign's recordings, render/ring.ts rangerSounds)
  // shields and moving
  shield: () => hall(layer([shape(biquad(saws(0.6, [note(45), note(52)], { detune: 0.01 }), 'lp', (u) => 300 + 900 * swell(u, 0.25), 2), (u) => swell(u, 0.25))], [shimmer(0.5, { lo: 2500, hi: 6000, peak: 0.25 }), 0, 0.4]), 0.25, 0.8),
  shieldBreak: () => hall(layer([crunch(0.35, 700, { lo: 1500, hi: 9000 })], [boom(160, 50, 0.3), 0, 0.6], [air(0.4, 'bp', (u) => 4000 - 3000 * u, 1.5, (u) => (1 - u) ** 2), 0, 0.4]), 0.2, 0.7),
  blink: () => hall(layer([air(0.2, 'bp', (u) => 600 + 5000 * u ** 2, 2, (u) => u ** 1.5 * (u > 0.9 ? (1 - u) * 10 : 1))], [boom(220, 90, 0.12, { body: 0.2 }), 0.18, 0.4]), 0.22, 0.7),
  buff: () => hall(layer([shimmer(0.6, { lo: 1500, hi: 6000, peak: 0.5 })], [choir(0.7, [67, 74, 79], { peak: 0.4, bright: 0.6 }), 0, 0.5]), 0.25, 0.9),
  // spells, by what they are made of
  bolt: () => hall(layer([shape(biquad(saws(0.35, [note(50), note(57)], { detune: 0.02, glide: 1.5 }), 'bp', (u) => 400 + 2400 * u, 3), (u) => swell(u, 0.4))], [grains(0.3, 60, { lo: 3000, hi: 8000, dec: [0.001, 0.003], q: 3 }), 0, 0.3], [whoosh(0.3, 400, 2000, { peak: 0.6 }), 0, 0.5]), 0.2, 0.7),
  zap: () => hall(layer([grains(0.18, 400, { lo: 2500, hi: 9000, dec: [0.0008, 0.003], q: 2 })], [shape(biquad(saws(0.15, [note(38)], { detune: 0.03 }), 'bp', 1800, 2), (u) => (1 - u) ** 2), 0, 0.5]), 0.16, 0.5),
  fireball: () => hall(layer([fire(0.5, { lo: 250, hi: 1600, crackle: 50, peak: 0.25 })], [whoosh(0.45, 200, 1200, { peak: 0.3 }), 0, 0.6]), 0.18, 0.6),
  explode: () => hall(layer([boom(110, 32, 0.8)], [fire(0.9, { lo: 300, hi: 2200, crackle: 90, peak: 0.06 }), 0, 0.8], [grains(0.6, 120, { lo: 300, hi: 2000, dec: [0.003, 0.01], q: 2 }), 0.04, 0.4]), 0.22, 1),
  freeze: () => hall(layer([frostHiss(0.5, 0.25), 0, 0.7], [crunch(0.4, 650), 0.02, 0.9], [air(0.35, 'lp', 500, 0.7, (u) => swell(u, 0.15)), 0, 0.5]), 0.22, 0.8),
  shatter: () => hall(layer([crunch(0.55, 1800, { lo: 1200, hi: 9500 })], [boom(140, 40, 0.45), 0, 0.8], [frostHiss(0.8, 0.05), 0.03, 0.5], [grains(0.5, 160, { lo: 2000, hi: 6000, dec: [0.004, 0.012], q: 8, fade: (u) => 1 - u }), 0.05, 0.4]), 0.24, 1),
  shard: () => hall(layer([crunch(0.15, 500)], [frostHiss(0.2, 0.1), 0, 0.4]), 0.18, 0.5),
  thunder: () => hall(layer([air(0.12, 'hp', 800, 0.7, (u) => Math.exp(-u * 8)), 0, 1], [boom(90, 30, 1.2, { body: 0.9 }), 0.02], [air(1.4, 'lp', (u) => 600 - 400 * u, 0.7, (u) => swell(u, 0.08)), 0.05, 0.9]), 0.24, 1.2),
  holy: () => hall(layer([choir(1.1, [60, 64, 67, 72], { peak: 0.3 })], [shimmer(1, { lo: 3500, hi: 8000, peak: 0.3 }), 0, 0.15]), 0.3, 1.2),
  shadow: () => hall(layer([growl(0.6, 55, 40, { peak: 0.55 })], [air(0.6, 'bp', (u) => 300 + 900 * swell(u, 0.7), 1.2, (u) => swell(u, 0.7)), 0, 0.7], [air(0.5, 'bp', 2500, 3, (u) => swell(u, 0.6)), 0, 0.2]), 0.26, 1),
  nature: () => hall(layer([grains(0.5, 260, { lo: 600, hi: 3500, dec: [0.002, 0.008], q: 1.5, fade: (u) => swell(u, 0.4) }), 0, 0.6], [air(0.6, 'bp', (u) => 500 + 1200 * swell(u, 0.4), 0.8, (u) => swell(u, 0.4)), 0, 0.6], [choir(0.6, [62, 69], { peak: 0.4, bright: 0.4 }), 0, 0.25]), 0.22, 0.8),
  heal: () => hall(layer([choir(0.9, [67, 71, 74, 79], { peak: 0.35, bright: 0.8 })], [shimmer(0.8, { lo: 2000, hi: 8000, peak: 0.6 }), 0, 0.2]), 0.3, 1.1),
  rift: () => hall(layer([air(0.7, 'bp', (u) => 200 + 900 * swell(u, 0.75), 1.4, (u) => swell(u, 0.75))], [growl(0.7, 45, 30, { peak: 0.7, cut: 600 }), 0, 0.8], [boom(80, 28, 0.6), 0.5, 0.7]), 0.28, 1.2),
  // the big ones: supers
  quake: () => hall(layer([boom(90, 28, 0.9, { body: 1 })], [boom(80, 26, 0.9, { body: 1 }), 0.15, 0.8], [grains(1, 200, { lo: 150, hi: 1200, dec: [0.004, 0.015], q: 1.5 }), 0, 0.7], [air(1.2, 'lp', 300, 0.7, (u) => swell(u, 0.1)), 0, 0.8]), 0.24, 1.3),
  meteor: () => hall(layer([fire(0.55, { lo: 400, hi: 2600, crackle: 70, peak: 0.95 }), 0, 0.9], [whoosh(0.55, 300, 2500, { peak: 0.95 }), 0, 0.6], [boom(100, 28, 1, { body: 1 }), 0.52], [fire(0.9, { lo: 250, hi: 1600, crackle: 100, peak: 0.05 }), 0.52, 0.8]), 0.24, 1.3),
  nova: () => hall(layer([choir(1.4, [55, 62, 67, 71, 74], { peak: 0.2 })], [shimmer(1.2, { lo: 3000, hi: 9500, peak: 0.15 }), 0, 0.5], [boom(120, 40, 0.6, { body: 0.4 }), 0.05, 0.5]), 0.3, 1.4),
  // falling, and the moments
  die: () => hall(layer([thud(110, 0.4, 0.8)], [grains(0.3, 90, { lo: 1500, hi: 5000, dec: [0.004, 0.02], q: 10 }), 0.06, 0.3], [air(0.5, 'bp', 350, 2, (u) => swell(u, 0.2)), 0, 0.3]), 0.2, 0.8),
  slam: () => hall(layer([boom(100, 32, 0.6, { body: 0.9 })], [grains(0.4, 120, { lo: 200, hi: 1500, dec: [0.003, 0.012], q: 1.5 }), 0.01, 0.5]), 0.22, 1),
  roar: () => hall(layer([growl(0.8, 70, 95, { peak: 0.3, cut: 1300 })], [air(0.8, 'bp', 700, 1.2, (u) => swell(u, 0.3)), 0, 0.5]), 0.24, 1),
  epic: () => hall(layer([shimmer(0.7, { lo: 2000, hi: 9000, peak: 0.5 })], [choir(0.8, [72, 79], { peak: 0.4, bright: 0.7 }), 0, 0.4]), 0.26, 1),
  pickupBig: () => hall(shimmer(0.5, { lo: 2500, hi: 9000, peak: 0.4 }), 0.22, 0.8),
  orb: () => hall(layer([air(0.16, 'bp', (u) => 500 + 2500 * u, 2, (u) => swell(u, 0.5))], [boom(200, 120, 0.1, { body: 0.1 }), 0.1, 0.3]), 0.16, 0.5),
  talent: () => hall(air(0.05, 'bp', 1400, 1.5, (u) => Math.exp(-u * 9)), 0.08, 0.3),
  checkpoint: () => hall(layer([horn(0.7, [55, 62])], [shimmer(0.6, { peak: 0.3 }), 0, 0.3]), 0.26, 1),
  victory: () => {
    const b = buf(3);
    mix(b, horn(0.28, [55, 62]), 0, 0.8);
    mix(b, horn(0.28, [55, 62]), 0.3, 0.8);
    mix(b, horn(1.9, [60, 64, 67, 72]), 0.6, 1);
    mix(b, boom(90, 40, 0.5, { body: 0.6, click: 0.4 }), 0, 0.6);
    mix(b, boom(90, 40, 0.5, { body: 0.6, click: 0.4 }), 0.3, 0.6);
    mix(b, boom(80, 34, 1.2, { body: 0.8, click: 0.4 }), 0.6, 0.9);
    mix(b, choir(2, [48, 60, 64, 67], { peak: 0.25, bright: 0.7 }), 0.6, 0.45);
    return hall(b, 0.28, 1.6);
  },
  playerDie: () => {
    const b = buf(2.6);
    mix(b, boom(70, 26, 1.4, { body: 1, click: 0.2 }), 0, 0.9);
    mix(b, horn(2.2, [45, 48, 52], { att: 0.4, open: 1300, closed: 400 }), 0.05, 0.8);
    mix(b, choir(2.2, [57, 60, 64], { peak: 0.3, bright: 0.4 }), 0.1, 0.35);
    return hall(b, 0.3, 1.8);
  },
  levelup: () => {
    const b = buf(2.4);
    mix(b, horn(0.25, [60, 67]), 0, 0.7);
    mix(b, horn(1.6, [65, 69, 72, 77]), 0.25, 0.9);
    mix(b, shimmer(1.6, { lo: 2500, hi: 9500, peak: 0.25 }), 0.2, 0.5);
    mix(b, choir(1.6, [53, 65, 69, 72], { peak: 0.25 }), 0.25, 0.4);
    mix(b, boom(100, 40, 0.6, { body: 0.5, click: 0.3 }), 0.25, 0.6);
    return hall(b, 0.28, 1.5);
  },
};

/**
 * The campaign's own, made the same way and written under their own names (not `ring-`).
 *
 * A sigil of the Crown won (the Sigil Rite, ui/StoryPages.tsx). It was a bell slowed down with a gem's chime over it,
 * nearly all of it above 3 kHz and the loudest thing in the game (the owner, 2026-11-20: "the sound when getting a
 * sigil is piercing ... improve it"). Now a warm swell as the sigil rises: a soft drum as it lands, a low horn bed
 * opening slowly, a choir on a major chord with two voices above it coming in after, and nothing bright: it is kept
 * under 2.8 kHz, and in the middle a phone's speaker plays (a sound all low was lost on one).
 */
const CAMPAIGN = {
  'sigil-won': () => {
    const b = buf(3);
    mix(b, boom(120, 50, 0.6, { body: 0.4, click: 0.04 }), 0, 0.12);
    mix(b, horn(2.6, [60, 65], { att: 0.5, open: 1300, closed: 450 }), 0.02, 0.22);
    mix(b, choir(2.6, [65, 69, 72, 77], { peak: 0.26, bright: 0.65 }), 0.04, 1);
    mix(b, choir(2, [81, 84], { peak: 0.35, bright: 0.35 }), 0.5, 0.35);
    return hall(biquad(biquad(b, 'hp', 200, 0.7), 'lp', 2800, 0.7), 0.3, 1.5);
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
// (the Ring's as ring-<name>.mp3, the campaign's under their own names)
const ALL = [...Object.entries(SOUNDS).map(([name, make]) => [name, make, `ring-${name}`]), ...Object.entries(CAMPAIGN).map(([name, make]) => [name, make, name])];
let made = 0;
for (const [name, make, file] of ALL) {
  if (only.length && !only.includes(name)) continue;
  seed = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0x5eed);
  const src = join(tmp, `${name}.wav`);
  writeFileSync(src, wav(finish(make(), LOUD_OF[name] ?? LOUD)));
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', join(OUT, `${file}.mp3`)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  made++;
}
console.log(`${made} sounds in ${OUT}`);
