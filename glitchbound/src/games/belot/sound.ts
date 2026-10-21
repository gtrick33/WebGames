/**
 * Belot's sound, synthesised with Web Audio (no files): card flicks and slides, the shuffle and the
 * deal, a sweep when a trick is taken, a short call blip pitched per seat, a stab for contra, chimes
 * for declarations, a little fanfare for belote and a bigger one for valat, and the score sheet's
 * tally. Music: an original, unhurried café loop (jazz sevenths, a walking bass, brushes; 88 bpm)
 * that can be switched off on its own. Everything runs through one compressor.
 */

export interface Sfx {
  flick(): void;
  deal(n: number): void;
  shuffle(): void;
  sweep(mine: boolean): void;
  call(seat: number): void;
  pass(): void;
  contra(level: 2 | 4): void;
  declare(): void;
  belote(): void;
  valat(): void;
  turn(): void;
  tally(n: number): void;
  win(): void;
  lose(): void;
  click(): void;
  nope(): void;
  music(on: boolean): void;
  unlock(): void;
  refresh(): void;
  dispose(): void;
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
// Dm9 – G13 – Cmaj9 – A7♭9, twice; then Fmaj7 – E7 – Am9 – A7. [bass root, chord tones]
const BARS: [number, number[]][] = [
  [38, [53, 57, 60, 64]],
  [43, [53, 59, 64, 69]],
  [36, [52, 55, 59, 62]],
  [45, [55, 58, 61, 64]],
  [38, [53, 57, 60, 64]],
  [43, [53, 59, 64, 69]],
  [36, [52, 55, 59, 62]],
  [45, [55, 58, 61, 64]],
  [41, [52, 57, 60, 64]],
  [40, [50, 56, 59, 62]],
  [45, [55, 59, 60, 64]],
  [45, [55, 58, 61, 64]],
];
/** A few lazy vibraphone phrases over bars 9-12 (eighth notes, null = rest). */
const _ = null;
const MELODY: (number | null)[][] = [
  [72, _, 76, _, 79, _, 77, 76],
  [74, _, _, 71, 74, _, 76, _],
  [72, _, 71, 69, _, 67, 69, _],
  [70, _, _, _, 73, _, 76, _],
];
const BPM = 88;

export function createSfx(isMuted: () => boolean, isMusicOff: () => boolean): Sfx {
  let ctx: AudioContext | null = null;
  let fx: GainNode | null = null;
  let bus: GainNode | null = null;
  let verb: ConvolverNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let disposed = false;
  let playing = false;
  let timer = 0;
  let nextBar = 0;
  let bar = 0;

  const make = (): AudioContext | null => {
    if (disposed) return null;
    if (ctx) return ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3.5;
    comp.connect(ctx.destination);
    fx = ctx.createGain();
    fx.gain.value = 0.9;
    fx.connect(comp);
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(comp);
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    verb.connect(wet).connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  };
  /** The context for an effect: only when effects are on and audio is already running (no queued bursts). */
  const audio = (): AudioContext | null => {
    if (isMuted()) return null;
    const c = make();
    if (!c) return null;
    if (c.state !== 'running') {
      if (!document.hidden) void c.resume().catch(() => undefined);
      return null;
    }
    return c;
  };
  const tone = (f: number, at: number, dur: number, gain: number, type: OscillatorType = 'triangle', to?: number, wet = 0): void => {
    const c = audio();
    if (!c || !fx) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(fx);
    if (wet && verb) {
      const w = c.createGain();
      w.gain.value = wet;
      g.connect(w).connect(verb);
    }
    o.start(t);
    o.stop(t + dur + 0.03);
  };
  const noise = (at: number, dur: number, gain: number, freq: number, type: BiquadFilterType = 'highpass', to?: number, q = 0.8): void => {
    const c = audio();
    if (!c || !fx || !noiseBuf) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(fx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  };

  // ---- music
  const note = (f: number, t: number, dur: number, gain: number, type: OscillatorType, cutoff: number, wet = 0.3, attack = 0.01): void => {
    if (!ctx || !bus) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(bus);
    if (wet && verb) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(verb);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const brush = (t: number, gain: number, len: number): void => {
    if (!ctx || !bus || !noiseBuf) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 5200;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + len + 0.02);
  };
  const playBar = (t: number, n: number): void => {
    const beat = 60 / BPM;
    // a lazy swing: the off-beat eighth lands two thirds through the beat
    const sw = (i: number): number => Math.floor(i / 2) * beat + (i % 2 ? beat * 0.66 : 0);
    const i = n % BARS.length;
    const [root, chord] = BARS[i]!;
    // walking bass: root, third-ish, fifth, a step toward the next root
    const nextRoot = BARS[(i + 1) % BARS.length]![0];
    const walk = [root, root + 4, root + 7, nextRoot + (nextRoot > root ? -1 : 1)];
    walk.forEach((m, k) => note(hz(m), t + k * beat, beat * 0.9, 0.11, 'triangle', 700, 0.05));
    // Rhodes-like chords on 2 and the "and" of 3
    for (const at of [beat, sw(5)]) for (const m of chord) {
      note(hz(m), t + at, beat * 1.2, 0.022, 'sine', 2200, 0.35);
      note(hz(m) * 2, t + at, beat * 0.5, 0.006, 'sine', 3000, 0.3);
    }
    // brushes: a swish on every beat, a tap on the swung eighths
    for (let k = 0; k < 4; k++) {
      brush(t + k * beat, k % 2 ? 0.05 : 0.03, beat * 0.8);
      brush(t + sw(k * 2 + 1), 0.02, 0.08);
    }
    // the vibraphone on the last four bars
    if (i >= 8)
      MELODY[i - 8]!.forEach((m, k) => {
        if (m !== null) {
          note(hz(m), t + sw(k), beat * 1.1, 0.045, 'sine', 4000, 0.45, 0.005);
          note(hz(m) * 4, t + sw(k), beat * 0.25, 0.006, 'sine', 6000, 0.3, 0.003);
        }
      });
  };
  const schedule = (): void => {
    if (!ctx || ctx.state !== 'running' || !playing || isMusicOff()) return;
    const len = (60 / BPM) * 4;
    while (nextBar < ctx.currentTime + 0.5) {
      playBar(nextBar, bar++);
      nextBar += len;
    }
  };
  const apply = (): void => {
    const on = playing && !isMusicOff();
    const c = on ? make() : ctx;
    if (!c || !bus) return;
    bus.gain.cancelScheduledValues(c.currentTime);
    bus.gain.setTargetAtTime(on ? 0.55 : 0.0001, c.currentTime, on ? 0.8 : 0.08);
    if (on && !timer) {
      if (c.state !== 'running' && !document.hidden) void c.resume().catch(() => undefined);
      nextBar = Math.max(nextBar, c.currentTime + 0.15);
      timer = window.setInterval(schedule, 150);
      schedule();
    } else if (!on && timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };
  const onVisibility = (): void => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else void ctx.resume().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    flick: () => {
      noise(0, 0.05, 0.5, 2600 + Math.random() * 1400, 'highpass');
      tone(320 + Math.random() * 60, 0, 0.05, 0.05, 'triangle', 180);
    },
    deal(n) {
      for (let i = 0; i < n; i++) noise(i * 0.07, 0.04, 0.35, 3000 + (i % 4) * 300, 'highpass');
    },
    shuffle: () => {
      for (let i = 0; i < 22; i++) noise(i * 0.022 + Math.random() * 0.01, 0.025, 0.22, 3600, 'highpass');
      noise(0.5, 0.12, 0.3, 900, 'bandpass', 400);
    },
    sweep: (mine) => {
      noise(0, 0.32, 0.35, 900, 'bandpass', 3800, 1.2);
      if (mine) tone(880, 0.12, 0.18, 0.06, 'sine', undefined, 0.3);
    },
    call: (seat) => {
      const base = [523, 440, 587, 392][seat % 4]!;
      tone(base, 0, 0.12, 0.13, 'triangle');
      tone(base * 1.5, 0.08, 0.16, 0.1, 'triangle', undefined, 0.2);
    },
    pass: () => tone(330, 0, 0.14, 0.08, 'sine', 260),
    contra: (level) => {
      noise(0, 0.25, 0.4, 600, 'lowpass');
      for (const m of level === 4 ? [50, 53, 57, 62] : [50, 53, 57]) tone(hz(m), 0, 0.5, 0.06, 'sawtooth', undefined, 0.25);
      tone(hz(level === 4 ? 74 : 69), 0.12, 0.4, 0.09, 'square');
    },
    declare: () => [76, 79, 84].forEach((m, i) => tone(hz(m), i * 0.07, 0.3, 0.1, 'sine', undefined, 0.4)),
    belote: () =>
      [67, 72, 76, 79].forEach((m, i) => {
        tone(hz(m), i * 0.09, 0.26, 0.11, 'sawtooth', undefined, 0.3);
        tone(hz(m) / 2, i * 0.09, 0.26, 0.05, 'square');
      }),
    valat: () =>
      [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => {
        tone(hz(m), i * 0.08, 0.35, 0.12, 'sawtooth', undefined, 0.35);
        tone(hz(m + 12), i * 0.08, 0.2, 0.04, 'sine');
      }),
    turn: () => tone(1046, 0, 0.12, 0.05, 'sine', undefined, 0.3),
    tally: (n) => {
      for (let i = 0; i < Math.min(12, n); i++) tone(1200 + i * 60, i * 0.05, 0.04, 0.05, 'square');
    },
    win: () => [72, 76, 79, 84, 88].forEach((m, i) => tone(hz(m), i * 0.1, 0.4, 0.12, 'triangle', undefined, 0.4)),
    lose: () => [67, 63, 60].forEach((m, i) => tone(hz(m), i * 0.2, 0.4, 0.1, 'triangle', hz(m) * 0.97, 0.3)),
    click: () => tone(900, 0, 0.04, 0.06, 'square', 600),
    nope: () => tone(220, 0, 0.12, 0.08, 'triangle', 180),
    music(on) {
      playing = on;
      apply();
    },
    unlock() {
      const c = make();
      if (c && c.state !== 'running' && !document.hidden) void c.resume().then(apply, () => undefined);
      else apply();
    },
    refresh() {
      apply();
    },
    dispose() {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
