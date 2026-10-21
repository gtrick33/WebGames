/**
 * Synthesised sounds (no files): an engine note that follows the revs, the tree's beeps, shifts,
 * a perfect-shift chime, tyre squeal, the cash register and a breakdown. The AudioContext is
 * created on the first sound (always after a tap) and closed by dispose().
 */
export interface Sfx {
  /** Engine note on and tuned every few frames: rpm fraction of the redline, 0 = off. */
  engine(frac: number, load: number): void;
  amber(): void;
  green(): void;
  shift(): void;
  perfect(): void;
  limiter(): void;
  squeal(): void;
  /** The crowd roars (0..1 loudness): the launch, a close finish, a win. */
  cheer(level: number): void;
  /** Tyres lit up in the burnout box. */
  burnout(): void;
  /** An exhaust pop on a shift. */
  pop(): void;
  cash(): void;
  fail(): void;
  red(): void;
  finish(win: boolean): void;
  click(): void;
  /** The needle entered the perfect zone. */
  cue(): void;
  /** A tap too early to count. */
  nope(): void;
  quiet(): void;
  dispose(): void;
}

export function createSfx(isMuted: () => boolean): Sfx {
  let ctx: AudioContext | null = null;
  let eng: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;
  const audio = (): AudioContext | null => {
    if (isMuted()) return null;
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };
  const tone = (from: number, to: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine'): void => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const noise = (at: number, dur: number, gain: number, hz: number): void => {
    const c = audio();
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = hz;
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(f).connect(g).connect(c.destination);
    s.start(c.currentTime + at);
  };
  const engineOn = (): typeof eng => {
    const c = audio();
    if (!c) return null;
    if (eng) return eng;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o1.type = 'sawtooth';
    o2.type = 'square';
    g.gain.value = 0.0001;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(c.destination);
    o1.start();
    o2.start();
    eng = { o1, o2, g };
    return eng;
  };
  return {
    engine(frac, load) {
      if (frac <= 0 || isMuted()) {
        if (eng && ctx) eng.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        return;
      }
      const e = engineOn();
      if (!e || !ctx) return;
      const t = ctx.currentTime;
      const hz = 40 + frac * 180;
      e.o1.frequency.setTargetAtTime(hz, t, 0.03);
      e.o2.frequency.setTargetAtTime(hz * 0.5 + 1, t, 0.03);
      e.g.gain.setTargetAtTime(0.025 + load * 0.04, t, 0.05);
    },
    amber: () => tone(520, 520, 0, 0.12, 0.08, 'square'),
    green: () => tone(880, 880, 0, 0.35, 0.1, 'square'),
    shift: () => {
      noise(0, 0.06, 0.25, 2500);
      tone(200, 120, 0, 0.08, 0.06, 'square');
    },
    perfect: () => [1047, 1319, 1568].forEach((f, i) => tone(f, f, i * 0.05, 0.14, 0.06, 'triangle')),
    limiter: () => tone(300, 300, 0, 0.05, 0.05, 'sawtooth'),
    squeal: () => noise(0, 0.5, 0.18, 3200),
    cheer: (level) => {
      // a wash of voices: several overlapping noise bands, rising and falling
      for (let k = 0; k < 4; k++) noise(k * 0.12, 1.4 + level, 0.05 + level * 0.07, 600 + k * 380);
    },
    burnout: () => {
      noise(0, 1.4, 0.16, 2400);
      noise(0.1, 1.2, 0.1, 900);
    },
    pop: () => {
      noise(0, 0.07, 0.22, 180);
      tone(90, 50, 0, 0.08, 0.08, 'square');
    },
    cash: () => {
      tone(1200, 1200, 0, 0.06, 0.05, 'square');
      tone(1600, 1600, 0.07, 0.1, 0.05, 'square');
      tone(2000, 2000, 0.16, 0.16, 0.05, 'square');
    },
    fail: () => {
      noise(0, 0.6, 0.35, 400);
      tone(220, 40, 0, 0.6, 0.12, 'sawtooth');
    },
    red: () => {
      tone(200, 150, 0, 0.3, 0.1, 'square');
      tone(150, 100, 0.3, 0.4, 0.1, 'square');
    },
    finish: (win) => {
      if (win) [660, 880, 1100, 1320].forEach((f, i) => tone(f, f, i * 0.09, 0.18, 0.07, 'triangle'));
      else [440, 330].forEach((f, i) => tone(f, f * 0.9, i * 0.18, 0.25, 0.06, 'triangle'));
    },
    click: () => tone(700, 500, 0, 0.04, 0.03, 'square'),
    cue: () => tone(1760, 1760, 0, 0.07, 0.05, 'square'),
    nope: () => tone(220, 180, 0, 0.12, 0.05, 'triangle'),
    quiet() {
      if (eng && ctx) eng.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    },
    dispose() {
      try {
        eng?.o1.stop();
        eng?.o2.stop();
      } catch {
        /* already stopped */
      }
      eng = null;
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
