import type { ArpStyle, Call, Env, Song } from './songs';

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

/** Something held for the whole song (its drone, its wind), let go when it ends. */
interface Held {
  stop(t: number): void;
}

/**
 * Plays one song (audio/songs.ts) into an audio graph: its bars scheduled a little ahead of time, a drone
 * and wind held under them, an echo, and now and then a bell or one of the land's creatures. One Score
 * per song: a new land fades the old one out (its last notes ring on through its own echo) as it fades in.
 * It runs on any audio context, so a song can be rendered offline as well as played.
 */
export class Score {
  /** The song's output, faded in and out as a whole. */
  readonly out: GainNode;
  private readonly input: GainNode;
  private readonly held: Held[] = [];
  private bar = 0;
  private next: number;
  private readonly beat: number;
  private readonly steps: number;
  private readonly phrase: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    dest: AudioNode,
    private readonly noise: AudioBuffer,
    readonly song: Song,
    at: number,
    fade = 1.5,
  ) {
    this.beat = 60 / song.bpm;
    this.steps = song.meter * 2;
    this.phrase = Math.max(1, Math.ceil(song.melody.length / this.steps));
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, at);
    this.out.gain.exponentialRampToValueAtTime(song.level, at + fade);
    this.out.connect(dest);
    this.input = ctx.createGain();
    this.input.connect(this.out);
    // the echo: a dotted eighth, a little darker each time round
    if (song.echo > 0) {
      const delay = ctx.createDelay(2);
      delay.delayTime.value = this.beat * 0.75;
      const back = ctx.createGain();
      back.gain.value = 0.38;
      const dark = ctx.createBiquadFilter();
      dark.type = 'lowpass';
      dark.frequency.value = 2400;
      const wet = ctx.createGain();
      wet.gain.value = song.echo;
      this.input.connect(delay);
      delay.connect(dark);
      dark.connect(back);
      back.connect(delay);
      dark.connect(wet);
      wet.connect(this.out);
    }
    this.next = at + 0.05;
    if (song.drone !== null) this.drone(song.drone, at);
    if (song.wind > 0) this.wind(song.wind, at);
  }

  /** Schedules every bar that starts before `until` (seconds, the context's clock). */
  schedule(until: number): void {
    const len = this.beat * this.song.meter;
    // bars whose time went by unplayed (a hidden tab's timers sleep while its clock runs) are skipped, not all
    // played at once when it wakes
    while (this.next + len < this.ctx.currentTime) {
      this.next += len;
      this.bar++;
    }
    while (this.next < until) {
      this.playBar(this.next);
      this.next += len;
      this.bar++;
    }
  }

  /** Fades the song out from `at`; what is held lets go after. */
  stop(at: number, fade = 1.5): void {
    const g = this.out.gain;
    if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(at);
    else g.cancelScheduledValues(at);
    g.setTargetAtTime(0.0001, at, fade / 4);
    for (const h of this.held) h.stop(at + fade * 1.5);
  }

  /* --------------------------------------------------------------- a bar */

  private playBar(t: number): void {
    const s = this.song;
    const i = this.bar % s.chords.length;
    const chord = s.chords[i]!;
    const root = s.bass[i]!;
    const beat = this.beat;
    const bar = beat * s.meter;
    this.bassLine(s.bassStyle, root, t);
    if (s.pad > 0) {
      for (const n of chord) {
        if (s.choir) {
          // two voices a little apart, swelling in slowly
          for (const cents of [-7, 7]) this.tone(hz(n), t, bar * 1.02, 0.008 * s.pad, 'triangle', 'bow', cents, bar * 0.35);
        } else this.tone(hz(n), t, bar * 0.98, 0.012 * s.pad, 'sine', 'plain');
      }
    }
    this.arpeggio(s.arp, chord, t);
    // the melody, every nth time round its phrase
    const round = Math.floor(this.bar / this.phrase);
    if (round % s.every === 0) {
      const start = (this.bar % this.phrase) * this.steps;
      for (let e = 0; e < this.steps; e++) {
        const m = s.melody[start + e];
        if (!m) continue;
        this.tone(hz(m.n), t + e * beat * 0.5, m.len * beat * 0.5 - 0.02, 0.022, s.lead.wave, s.lead.env, s.lead.detune);
      }
    }
    if (s.drums) this.drums(s.drums, t);
    // now and then a bell far off, or the land's creatures
    if (s.bells > 0 && Math.random() < s.bells) this.tone(hz(pick(s.scale) - 12), t + Math.floor(Math.random() * s.meter) * beat, 3.2, 0.014, 'sine', 'bell');
    if (s.calls.length && Math.random() < s.callRate) this.call(pick(s.calls), t + Math.random() * bar);
  }

  private bassLine(style: Song['bassStyle'], r: number, t: number): void {
    const beat = this.beat;
    const meter = this.song.meter;
    const b = (n: number, at: number, dur: number, gain = 0.05): void => this.tone(hz(n), t + at * beat, dur * beat, gain, 'triangle', 'plain');
    switch (style) {
      case 'beat':
        for (let k = 0; k < meter; k++) b(r, k, 0.9);
        break;
      case 'half':
        b(r, 0, meter === 4 ? 1.8 : 2.7);
        if (meter === 4) b(r + 7, 2, 1.8, 0.04);
        break;
      case 'oom':
        b(r, 0, 0.9);
        break;
      case 'walk':
        [r, r + 7, r + 12, r + 7].slice(0, meter).forEach((n, k) => b(n, k, 0.9));
        break;
      case 'pulse':
        for (let k = 0; k < meter * 2; k++) b(r, k * 0.5, 0.42, 0.038);
        break;
      case 'none':
        break;
    }
  }

  private arpeggio(style: ArpStyle, chord: number[], t: number): void {
    const beat = this.beat;
    const meter = this.song.meter;
    const n = chord.length;
    switch (style) {
      case 'up':
        for (let e = 0; e < meter * 2; e++) this.tone(hz(chord[e % n]! + (e >= meter ? 12 : 0)), t + e * beat * 0.5, beat * 0.45, 0.014, 'square', 'plain');
        break;
      case 'broken': {
        const order = [0, 2, 1, 2];
        for (let e = 0; e < meter * 2; e++) this.tone(hz(chord[order[e % 4]! % n]! + 12), t + e * beat * 0.5, beat * 0.45, 0.013, 'triangle', 'pluck');
        break;
      }
      case 'harp': {
        // rolling sixteenths up two octaves and back, soft
        const up = [...chord.map((x) => x + 12), ...chord.map((x) => x + 24)];
        const round = [...up, ...up.slice(1, -1).reverse()];
        for (let e = 0; e < meter * 4; e++) this.tone(hz(round[e % round.length]!), t + e * beat * 0.25, beat * 0.6, 0.009, 'sine', 'pluck');
        break;
      }
      case 'strum':
        for (const k of meter === 4 ? [0, 2] : [0]) chord.forEach((x, j) => this.tone(hz(x + 12), t + k * beat + j * 0.012, beat * 1.4, 0.011, 'triangle', 'pluck'));
        break;
      case 'pah':
        for (let k = 1; k < meter; k++) chord.forEach((x) => this.tone(hz(x + 12), t + k * beat, beat * 0.5, 0.009, 'square', 'pluck'));
        break;
      case 'pulse':
        for (let e = 0; e < meter * 2; e++) this.tone(hz(chord[e % 2 ? Math.min(2, n - 1) : 0]! + 12), t + e * beat * 0.5, beat * 0.3, 0.01, 'square', 'pluck');
        break;
      case 'none':
        break;
    }
  }

  private drums(pattern: string, t: number): void {
    const step = this.beat / 4;
    for (let k = 0; k < pattern.length; k++) {
      const c = pattern[k]!;
      const at = t + k * step;
      if (c === 'k' || c === 'K' || c === 'x') this.kick(at, 0.08);
      if (c === 's' || c === 'x') this.snare(at);
      if (c === 'h' || c === 'K') this.hat(at);
      if (c === 't') this.tom(at, 120, 70, 0.07);
      if (c === 'T') this.tom(at, 190, 120, 0.06);
    }
  }

  /* --------------------------------------------------------------- voices */

  /**
   * One note: a plain tone, a plucked string, a breathy flute (with vibrato), a bowed note swelling in, or
   * a bell (a struck tone and its out-of-tune partial, ringing long).
   */
  private tone(f: number, t: number, dur: number, gain: number, wave: OscillatorType, env: Env, detune = 0, attack = 0): void {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f, t);
    if (detune) {
      // a voice that won't quite stay in tune
      o.detune.setValueAtTime((Math.random() * 2 - 1) * detune, t);
      o.detune.linearRampToValueAtTime((Math.random() * 2 - 1) * detune, t + Math.max(0.1, dur));
    }
    let end = t + dur;
    switch (env) {
      case 'plain':
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        break;
      case 'pluck':
        end = t + Math.max(0.25, dur * 1.3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain * 1.2, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        break;
      case 'flute':
      case 'bow': {
        const a = attack || (env === 'flute' ? 0.07 : 0.18);
        const r = env === 'flute' ? 0.1 : 0.25;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + Math.min(a, dur * 0.6));
        g.gain.setValueAtTime(gain, t + Math.max(Math.min(a, dur * 0.6), dur - r * 0.5));
        g.gain.linearRampToValueAtTime(0, t + dur + r);
        end = t + dur + r;
        if (env === 'flute' && dur > 0.25) {
          const lfo = c.createOscillator();
          const depth = c.createGain();
          lfo.frequency.value = 5.2;
          depth.gain.setValueAtTime(0, t);
          depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
          lfo.connect(depth).connect(o.frequency);
          lfo.start(t);
          lfo.stop(end + 0.05);
        }
        break;
      }
      case 'bell': {
        end = t + Math.max(1.6, dur * 2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        const p = c.createOscillator();
        const pg = c.createGain();
        p.type = 'sine';
        p.frequency.value = f * 2.76;
        pg.gain.setValueAtTime(0.0001, t);
        pg.gain.exponentialRampToValueAtTime(gain * 0.3, t + 0.004);
        pg.gain.exponentialRampToValueAtTime(0.0001, t + (end - t) * 0.4);
        p.connect(pg).connect(this.input);
        p.start(t);
        p.stop(end + 0.05);
        break;
      }
    }
    o.connect(g).connect(this.input);
    o.start(t);
    o.stop(end + 0.05);
  }

  private kick(t: number, gain: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(this.input);
    o.start(t);
    o.stop(t + 0.16);
  }

  private tom(t: number, from: number, to: number, gain: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + 0.2);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.input);
    o.start(t);
    o.stop(t + 0.3);
  }

  private snare(t: number): void {
    this.hiss(t, 0.12, 0.03, 1800, 'bandpass');
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    g.gain.setValueAtTime(0.02, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(this.input);
    o.start(t);
    o.stop(t + 0.08);
  }

  private hat(t: number): void {
    this.hiss(t, 0.04, 0.012, 7000, 'highpass');
  }

  private hiss(t: number, dur: number, gain: number, freq: number, type: BiquadFilterType, dest: AudioNode = this.input): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /* --------------------------------------------------------------- held under the song */

  /** A low note and its fifth, breathing slowly. */
  private drone(n: number, at: number): void {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(1, at + 4);
    // the breath: a slow swell on its own stage, so the fade in is never pushed below silence
    const swell = c.createGain();
    swell.gain.value = 0.75;
    const breath = c.createOscillator();
    const depth = c.createGain();
    breath.frequency.value = 0.09;
    depth.gain.value = 0.25;
    breath.connect(depth).connect(swell.gain);
    swell.connect(g).connect(this.out);
    const voices = [
      { f: hz(n), wave: 'sine' as OscillatorType, gain: 0.03 },
      { f: hz(n + 7), wave: 'triangle' as OscillatorType, gain: 0.01 },
      { f: hz(n + 12) * 1.003, wave: 'sine' as OscillatorType, gain: 0.008 },
    ];
    const oscs = voices.map((v) => {
      const o = c.createOscillator();
      const vg = c.createGain();
      o.type = v.wave;
      o.frequency.value = v.f;
      vg.gain.value = v.gain;
      o.connect(vg).connect(swell);
      o.start(at);
      return o;
    });
    breath.start(at);
    this.held.push({
      stop: (t) => {
        for (const o of [...oscs, breath]) o.stop(t);
      },
    });
  }

  /** Wind: noise through a slowly wandering band, rising and falling in gusts. */
  private wind(level: number, at: number): void {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.value = 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 3);
    // gusts: the band and the level wander on their own slow cycles
    const sweep = c.createOscillator();
    const sweepDepth = c.createGain();
    sweep.frequency.value = 0.07;
    sweepDepth.gain.value = 320;
    sweep.connect(sweepDepth).connect(band.frequency);
    const gusts = c.createGain();
    gusts.gain.value = 0.65;
    const gust = c.createOscillator();
    const gustDepth = c.createGain();
    gust.frequency.value = 0.13;
    gustDepth.gain.value = 0.35;
    gust.connect(gustDepth).connect(gusts.gain);
    src.connect(band).connect(gusts).connect(g).connect(this.out);
    src.start(at);
    sweep.start(at);
    gust.start(at);
    this.held.push({
      stop: (t) => {
        src.stop(t);
        sweep.stop(t);
        gust.stop(t);
      },
    });
  }

  /* --------------------------------------------------------------- the land's creatures */

  /** One of the land's creatures, somewhere off to one side. */
  private call(kind: Call, t: number): void {
    const c = this.ctx;
    const pan = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() * 2 - 1) * 0.8;
    const dest: AudioNode = pan ?? this.input;
    if (pan) pan.connect(this.input);
    const glide = (pts: [number, number][], wave: OscillatorType, gain: number, at: number, vib = 0): void => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(pts[0]![1], at);
      for (const [dt, f] of pts.slice(1)) o.frequency.linearRampToValueAtTime(f, at + dt);
      const dur = pts[pts.length - 1]![0];
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.05, dur * 0.3));
      g.gain.setValueAtTime(gain, at + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      if (vib) {
        const l = c.createOscillator();
        const d = c.createGain();
        l.frequency.value = vib;
        d.gain.value = pts[0]![1] * 0.02;
        l.connect(d).connect(o.frequency);
        l.start(at);
        l.stop(at + dur);
      }
      o.connect(g).connect(dest);
      o.start(at);
      o.stop(at + dur + 0.02);
    };
    switch (kind) {
      case 'owl':
        // hoo, hoo-hoooo
        glide([[0, 380], [0.3, 360]], 'sine', 0.02, t);
        glide([[0, 400], [0.2, 380]], 'sine', 0.016, t + 0.55);
        glide([[0, 390], [0.6, 340]], 'sine', 0.018, t + 0.8, 4);
        break;
      case 'crow':
        for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
          const at = t + k * 0.32;
          glide([[0, 620], [0.16, 430]], 'sawtooth', 0.008, at);
          this.hiss(at, 0.16, 0.012, 1300, 'bandpass', dest);
        }
        break;
      case 'frog':
        for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) glide([[0, 120], [0.18, 95]], 'square', 0.01, t + k * 0.28, 28);
        break;
      case 'wolf':
        glide([[0, 330], [0.6, 520], [2, 480], [2.7, 300]], 'sine', 0.014, t, 5);
        break;
      case 'drip':
        glide([[0, 1800], [0.07, 700]], 'sine', 0.018, t);
        break;
      case 'gull':
        for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) glide([[0, 1400], [0.1, 1900], [0.24, 1250]], 'triangle', 0.008, t + k * 0.3);
        break;
      case 'bird':
        for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) {
          const f = 2800 + Math.random() * 1200;
          glide([[0, f], [0.06, f * 1.3]], 'sine', 0.007, t + k * 0.11);
        }
        break;
      case 'cricket':
        for (let k = 0; k < 3; k++) glide([[0, 4800], [0.12, 4800]], 'sine', 0.004, t + k * 0.2, 50);
        break;
    }
  }
}
