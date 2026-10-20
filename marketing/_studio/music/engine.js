// A small offline synth studio for GlitchBound's original music: drums, basses, keys, leads and FX
// built from Web Audio oscillators and noise, sequenced on a bar/step grid and rendered with an
// OfflineAudioContext. Everything here is synthesized from scratch, so every track is ours to use.

export const SR = 48000;

// ---- Notes and harmony ------------------------------------------------------------------------
const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const midi = (name) => {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  return NAMES[m[1]] + (Number(m[2]) + 1) * 12;
};
export const hz = (n) => 440 * 2 ** (((typeof n === 'string' ? midi(n) : n) - 69) / 12);
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  pentaMajor: [0, 2, 4, 7, 9],
  pentaMinor: [0, 3, 5, 7, 10],
};

/** Scale degree (0-based, may exceed 7 or go negative) to MIDI note in a key. */
export function degree(rootMidi, scale, d) {
  const s = SCALES[scale];
  const oct = Math.floor(d / s.length);
  const i = ((d % s.length) + s.length) % s.length;
  return rootMidi + s[i] + 12 * oct;
}

/** A chord on scale degree `d` (0 = I): stacked thirds within the scale, `size` notes. */
export function chord(rootMidi, scale, d, size = 3, inversion = 0) {
  const notes = [];
  for (let k = 0; k < size; k++) notes.push(degree(rootMidi, scale, d + 2 * k));
  for (let k = 0; k < inversion; k++) notes.push(notes.shift() + 12);
  return notes;
}

/** Deterministic random numbers, so a track renders the same every time. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- The studio ---------------------------------------------------------------------------------
export class Studio {
  constructor(seconds, { bpm = 120, swing = 0, seed = 1 } = {}) {
    this.ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
    this.bpm = bpm;
    this.swing = swing;
    this.r = rng(seed);
    const c = this.ctx;
    this.noise = c.createBuffer(1, SR * 2, SR);
    const d = this.noise.getChannelData(0);
    const nr = rng(seed + 99);
    for (let i = 0; i < d.length; i++) d[i] = nr() * 2 - 1;

    // Master: everything -> glue compressor -> limiter-ish compressor -> out.
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.2;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.ratio.value = 20;
    lim.attack.value = 0.002;
    lim.release.value = 0.08;
    // Synth noise is bright: a gentle high shelf keeps the top end from fizzing.
    const shelf = c.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 11000;
    shelf.gain.value = -4;
    this.master.connect(shelf).connect(glue).connect(lim).connect(c.destination);

    // Buses: drums, music (ducked by the kick), reverb and delay sends.
    this.drums = c.createGain();
    this.drums.connect(this.master);
    this.music = c.createGain();
    this.music.connect(this.master);
    this.duck = this.music.gain;
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.2);
    this.verbIn = c.createGain();
    this.verbIn.gain.value = 0.9;
    const verbOut = c.createGain();
    verbOut.gain.value = 0.55;
    this.verbIn.connect(this.reverb).connect(verbOut).connect(this.master);
    this.delayIn = c.createGain();
    const dl = c.createDelay(2);
    dl.delayTime.value = this.beat * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const dlf = c.createBiquadFilter();
    dlf.type = 'lowpass';
    dlf.frequency.value = 3200;
    this.delayIn.connect(dl);
    dl.connect(dlf).connect(fb).connect(dl);
    const dOut = c.createGain();
    dOut.gain.value = 0.42;
    dlf.connect(dOut).connect(this.master);
  }

  get beat() {
    return 60 / this.bpm;
  }
  /** Seconds at bar `b` (4/4), sixteenth step `s` within it (with swing on odd steps). */
  t(b, s = 0) {
    const st = this.beat / 4;
    return b * this.beat * 4 + s * st + (s % 2 === 1 ? this.swing * st : 0);
  }

  impulse(seconds, decay) {
    const c = this.ctx;
    const len = Math.floor(SR * seconds);
    const b = c.createBuffer(2, len, SR);
    const r = rng(7);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * (1 - i / len) ** decay;
    }
    return b;
  }

  /** Connects a voice to a bus with optional pan, reverb and delay sends. */
  out(node, { bus = this.music, pan = 0, verb = 0, delay = 0, gain = 1 } = {}) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    node.connect(g);
    let last = g;
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      last.connect(p);
      last = p;
    }
    last.connect(bus);
    if (verb) {
      const s = this.ctx.createGain();
      s.gain.value = verb;
      last.connect(s).connect(this.verbIn);
    }
    if (delay) {
      const s = this.ctx.createGain();
      s.gain.value = delay;
      last.connect(s).connect(this.delayIn);
    }
    return g;
  }

  /** Attack to `peak`, decay toward `s * peak`; with `len`, release from wherever it is at t + len. */
  env(param, t, { a = 0.005, d = 0.1, s = 0, r = 0.05, peak = 1, len = 0 }) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (len > 0) {
      param.setTargetAtTime(Math.max(0.0001, peak * s), t + a, d / 3);
      param.setTargetAtTime(0.0001, Math.max(t + a + 0.001, t + len), r / 3);
    } else param.setTargetAtTime(0.0001, t + a, d / 3);
  }

  osc(type, f, t, end) {
    const o = this.ctx.createOscillator();
    if (type instanceof PeriodicWave) o.setPeriodicWave(type);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(end);
    return o;
  }

  noiseSrc(t, end) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    n.start(t, this.r() * 1.5);
    n.stop(end);
    return n;
  }

  pulse(duty) {
    const n = 64;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return this.ctx.createPeriodicWave(re, im);
  }

  /** Sidechain feel: the music bus dips under each kick. */
  pump(t, depth = 0.55, release = 0.22) {
    this.duck.setValueAtTime(1, t - 0.001);
    this.duck.linearRampToValueAtTime(1 - depth, t + 0.01);
    this.duck.setTargetAtTime(1, t + 0.03, release / 3);
  }

  // ---- Drums ----
  kick(t, v = 1, { tone = 52, punch = 3, decay = 0.42, pump = 0 } = {}) {
    const c = this.ctx;
    const o = this.osc('sine', tone * punch, t, t + decay + 0.1);
    o.frequency.exponentialRampToValueAtTime(tone, t + 0.07);
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.002, d: decay, peak: v });
    o.connect(g);
    this.out(g, { bus: this.drums, gain: 1.1 });
    // Click
    const n = this.noiseSrc(t, t + 0.02);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const ng = c.createGain();
    this.env(ng.gain, t, { a: 0.001, d: 0.012, peak: v * 0.35 });
    n.connect(hp).connect(ng);
    this.out(ng, { bus: this.drums });
    if (pump) this.pump(t, pump);
  }
  snare(t, v = 1, { tone = 190, verb = 0.18, decay = 0.18 } = {}) {
    const c = this.ctx;
    const n = this.noiseSrc(t, t + decay + 0.1);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.001, d: decay, peak: v * 0.8 });
    n.connect(bp).connect(g);
    this.out(g, { bus: this.drums, verb });
    const o = this.osc('triangle', tone, t, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(tone * 0.7, t + 0.08);
    const og = c.createGain();
    this.env(og.gain, t, { a: 0.001, d: 0.08, peak: v * 0.6 });
    o.connect(og);
    this.out(og, { bus: this.drums });
  }
  clap(t, v = 1, { verb = 0.25 } = {}) {
    const c = this.ctx;
    for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.011;
      const n = this.noiseSrc(tt, tt + 0.25);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1300;
      bp.Q.value = 1.1;
      const g = c.createGain();
      this.env(g.gain, tt, { a: 0.001, d: k === 2 ? 0.16 : 0.03, peak: v * 0.7 });
      n.connect(bp).connect(g);
      this.out(g, { bus: this.drums, verb, pan: (k - 1) * 0.1 });
    }
  }
  hat(t, v = 1, { open = false, pan = 0.15, tone = 8000 } = {}) {
    const c = this.ctx;
    const len = open ? 0.28 : 0.045;
    const n = this.noiseSrc(t, t + len + 0.05);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = tone;
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.001, d: len, peak: v * 0.24 });
    n.connect(hp).connect(g);
    this.out(g, { bus: this.drums, pan });
  }
  shaker(t, v = 1) {
    const c = this.ctx;
    const n = this.noiseSrc(t, t + 0.1);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6500;
    bp.Q.value = 1.5;
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.015, d: 0.05, peak: v * 0.18 });
    n.connect(bp).connect(g);
    this.out(g, { bus: this.drums, pan: -0.25 });
  }
  tom(t, f = 120, v = 1) {
    const o = this.osc('sine', f * 1.6, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = this.ctx.createGain();
    this.env(g.gain, t, { a: 0.002, d: 0.3, peak: v * 0.7 });
    o.connect(g);
    this.out(g, { bus: this.drums, verb: 0.15 });
  }
  /** Woodblock / tick (clock sounds for quiz beds). */
  tick(t, v = 1, f = 1800) {
    const o = this.osc('sine', f, t, t + 0.06);
    const g = this.ctx.createGain();
    this.env(g.gain, t, { a: 0.001, d: 0.035, peak: v * 0.5 });
    o.connect(g);
    this.out(g, { bus: this.drums, pan: 0.2 });
  }
  crash(t, v = 1) {
    const c = this.ctx;
    const n = this.noiseSrc(t, t + 2.2);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.002, d: 1.8, peak: v * 0.28 });
    n.connect(hp).connect(g);
    this.out(g, { bus: this.drums, verb: 0.3 });
  }
  /** White-noise riser over `len` seconds. */
  riser(t, len, v = 1) {
    const c = this.ctx;
    const n = this.noiseSrc(t, t + len + 0.05);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.35, t + len);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.04);
    n.connect(bp).connect(g);
    this.out(g, { bus: this.master, verb: 0.3 });
  }
  /** Downward boom for drops. */
  impact(t, v = 1) {
    const o = this.osc('sine', 110, t, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(32, t + 1.2);
    const g = this.ctx.createGain();
    this.env(g.gain, t, { a: 0.002, d: 1.1, peak: v * 0.9 });
    o.connect(g);
    this.out(g, { bus: this.master, verb: 0.2 });
  }

  // ---- Tonal voices ----
  /** Bass: saw/square through a plucky lowpass, plus a sine sub. */
  bass(t, note, len, v = 1, { type = 'sawtooth', cutoff = 900, env = 1800, sub = 0.6, glideFrom = null, q = 4 } = {}) {
    const c = this.ctx;
    const f = hz(note);
    const end = t + len + 0.15;
    const o = this.osc(type, glideFrom ? hz(glideFrom) : f, t, end);
    if (glideFrom) o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.setValueAtTime(cutoff + env, t);
    lp.frequency.setTargetAtTime(cutoff, t, 0.06);
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.004, d: 0.3, s: 0.75, r: 0.06, peak: v * 0.42, len });
    o.connect(lp).connect(g);
    this.out(g);
    if (sub) {
      const s = this.osc('sine', f / (f > 90 ? 2 : 1), t, end);
      const sg = c.createGain();
      this.env(sg.gain, t, { a: 0.004, d: 0.3, s: 0.9, r: 0.05, peak: v * sub * 0.5, len });
      s.connect(sg);
      this.out(sg);
    }
  }
  /** Warm pad: detuned saws through a soft lowpass, slow attack. */
  pad(t, notes, len, v = 1, { cutoff = 1600, attack = 0.35, verb = 0.35, type = 'sawtooth', pan = 0 } = {}) {
    const c = this.ctx;
    for (const [i, n] of notes.entries()) {
      for (const det of [-9, 8]) {
        const o = this.osc(type, hz(n), t, t + len + 1);
        o.detune.value = det;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = cutoff;
        const g = c.createGain();
        this.env(g.gain, t, { a: attack, d: 0.5, s: 0.85, r: 0.5, peak: (v * 0.07) / Math.sqrt(notes.length), len });
        o.connect(lp).connect(g);
        this.out(g, { verb, pan: pan + (det < 0 ? -0.3 : 0.3) * (i % 2 ? 1 : 0.6) });
      }
    }
  }
  /** Electric-piano chord: sine tines with a little FM bark and a slow tremolo. */
  keys(t, notes, len, v = 1, { verb = 0.3, bright = 1 } = {}) {
    const c = this.ctx;
    for (const n of notes) {
      const f = hz(n);
      const car = this.osc('sine', f, t, t + len + 1.2);
      const mod = this.osc('sine', f * 2, t, t + len + 1.2);
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * 1.6 * bright, t);
      mg.gain.setTargetAtTime(f * 0.15, t, 0.12);
      mod.connect(mg).connect(car.frequency);
      const g = c.createGain();
      this.env(g.gain, t, { a: 0.004, d: 1.2, s: 0.5, r: 0.4, peak: (v * 0.16) / Math.sqrt(notes.length), len });
      car.connect(g);
      this.out(g, { verb, pan: (n % 5) * 0.08 - 0.16 });
    }
  }
  /** Plucked synth / chip note. */
  pluck(t, note, len, v = 1, { type = 'square', cutoff = 2600, decay = 0.25, verb = 0.2, delay = 0, pan = 0, glide = 0, detune = 0 } = {}) {
    const c = this.ctx;
    const f = hz(note);
    const o = this.osc(type, glide ? f * 2 ** (-glide / 12) : f, t, t + len + decay + 0.2);
    if (detune) o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff * 1.6, t);
    lp.frequency.setTargetAtTime(cutoff * 0.5, t, decay / 2);
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.003, d: decay, s: 0.25, r: 0.08, peak: v * 0.2, len });
    o.connect(lp).connect(g);
    this.out(g, { verb, delay, pan });
  }
  /** Singing lead with vibrato (saw + square, filtered). */
  lead(t, note, len, v = 1, { cutoff = 3200, verb = 0.25, delay = 0.25, vib = 0.25, slideFrom = null, type2 = 'square' } = {}) {
    const c = this.ctx;
    const f = hz(note);
    const end = t + len + 0.4;
    const lfo = this.osc('sine', 5.5, t, end);
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.012 * vib * 2, t + Math.min(0.35, len));
    lfo.connect(lg);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.01, d: 0.3, s: 0.8, r: 0.12, peak: v * 0.12, len });
    for (const [type, det] of [['sawtooth', -6], [type2, 6]]) {
      const o = this.osc(type, slideFrom ? hz(slideFrom) : f, t, end);
      if (slideFrom) o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      o.detune.value = det;
      lg.connect(o.frequency);
      o.connect(lp);
    }
    lp.connect(g);
    this.out(g, { verb, delay });
  }
  /** Bell / glock: FM sine with a long ring. */
  bell(t, note, v = 1, { ratio = 3.5, ring = 1.6, verb = 0.35, delay = 0.15, pan = 0 } = {}) {
    const c = this.ctx;
    const f = hz(note);
    const car = this.osc('sine', f, t, t + ring + 0.5);
    const mod = this.osc('sine', f * ratio, t, t + ring + 0.5);
    const mg = c.createGain();
    mg.gain.setValueAtTime(f * 2.2, t);
    mg.gain.setTargetAtTime(0, t, ring / 4);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.002, d: ring, peak: v * 0.14 });
    car.connect(g);
    this.out(g, { verb, delay, pan });
  }
  /** Marimba: sine body + a quick 4x partial. */
  marimba(t, note, v = 1, { verb = 0.18, pan = 0 } = {}) {
    const c = this.ctx;
    const f = hz(note);
    for (const [mult, amp, dec] of [[1, 1, 0.45], [4, 0.35, 0.08], [10, 0.08, 0.03]]) {
      const o = this.osc('sine', f * mult, t, t + 0.6);
      const g = c.createGain();
      this.env(g.gain, t, { a: 0.001, d: dec, peak: v * 0.24 * amp });
      o.connect(g);
      this.out(g, { verb, pan });
    }
  }
  /** Pizzicato string-ish: short filtered saw with a pitchy attack. */
  pizz(t, note, v = 1, { verb = 0.25, pan = 0 } = {}) {
    const c = this.ctx;
    const f = hz(note);
    const o = this.osc('sawtooth', f * 1.01, t, t + 0.5);
    o.frequency.setTargetAtTime(f, t, 0.01);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.setTargetAtTime(f * 1.5, t, 0.05);
    const g = c.createGain();
    this.env(g.gain, t, { a: 0.002, d: 0.22, peak: v * 0.3 });
    o.connect(lp).connect(g);
    this.out(g, { verb, pan });
  }
  /** Vinyl crackle bed (lo-fi). */
  crackle(t, len, v = 1) {
    const c = this.ctx;
    const n = this.noiseSrc(t, t + len);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    bp.Q.value = 0.4;
    const g = c.createGain();
    g.gain.value = v * 0.012;
    n.connect(bp).connect(g);
    this.out(g, { bus: this.master });
    const r = this.r;
    for (let x = t; x < t + len; x += 0.03 + r() * 0.25) {
      const p = this.noiseSrc(x, x + 0.01);
      const pg = c.createGain();
      this.env(pg.gain, x, { a: 0.0005, d: 0.004, peak: v * (0.05 + r() * 0.12) });
      p.connect(pg);
      this.out(pg, { bus: this.master, pan: r() - 0.5 });
    }
  }

  async render() {
    const buf = await this.ctx.startRendering();
    return [buf.getChannelData(0), buf.getChannelData(1)];
  }
}

/** 16-step pattern helper: 'x' full, 'o' soft, '.' rest. Calls fn(step, velocity). */
export function steps(pattern, fn) {
  const p = pattern.replace(/\s+/g, '');
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === 'x') fn(i, 1);
    else if (ch === 'o') fn(i, 0.55);
    else if (ch === '-') fn(i, 0.3);
  }
}

/** Float32 stereo -> 16-bit WAV bytes. */
export function wav([l, r]) {
  const n = l.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, l[i])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, r[i])) * 32767, true);
    o += 4;
  }
  return new Uint8Array(buf);
}
