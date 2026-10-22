/**
 * Backgammon's sound, synthesised with Web Audio (no files): the dice rattling in the cup and
 * tumbling out, wooden clacks for checkers (heavier when stacking), a smack for a hit, a pop for a
 * checker borne off, chimes for the turn and the end. Music: an original warm loop in a lazy 6/8
 * (plucked oud-like lead over a hand-drum pattern and a drone; 96 bpm) that can be switched off.
 */
export interface Sfx {
  rattle(): void;
  dice(): void;
  clack(stack: number): void;
  /** A moving checker touching down on a point it passes. */
  tap(): void;
  hit(): void;
  bearOff(): void;
  turn(): void;
  win(points: number): void;
  lose(): void;
  click(): void;
  nope(): void;
  music(on: boolean): void;
  unlock(): void;
  refresh(): void;
  dispose(): void;
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
// D Phrygian dominant flavour over D and C drones; six eighths per bar.
const BARS: [number, (number | null)[]][] = [
  [50, [74, null, 75, 78, null, 77]],
  [50, [75, null, 74, 72, null, null]],
  [48, [72, null, 74, 75, null, 74]],
  [50, [74, null, null, 69, null, null]],
  [50, [74, null, 78, 79, null, 78]],
  [50, [77, null, 75, 74, null, 75]],
  [48, [72, 74, 75, null, 74, 72]],
  [50, [74, null, null, null, null, null]],
];
const BPM = 96;

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
    const len = Math.floor(ctx.sampleRate * 1.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8;
    }
    verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    verb.connect(wet).connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  };
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
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
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
  const noise = (at: number, dur: number, gain: number, freq: number, type: BiquadFilterType = 'bandpass', q = 1.5): void => {
    const c = audio();
    if (!c || !fx || !noiseBuf) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(fx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  };
  /** A wooden knock: a short resonant body plus a click. */
  const knock = (at: number, pitch: number, gain: number): void => {
    tone(pitch, at, 0.09, gain, 'sine', pitch * 0.7);
    tone(pitch * 2.6, at, 0.03, gain * 0.35, 'triangle');
    noise(at, 0.03, gain * 1.4, 2400, 'bandpass', 2);
  };

  // ---- music
  const note = (f: number, t: number, dur: number, gain: number, type: OscillatorType, cutoff: number, wet = 0.3): void => {
    if (!ctx || !bus) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
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
  const drum = (t: number, f: number, gain: number, len: number): void => {
    if (!ctx || !bus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const playBar = (t: number, n: number): void => {
    const e = 60 / BPM / 2;
    const [root, lead] = BARS[n % BARS.length]!;
    // drone: root and fifth, the whole bar
    note(hz(root), t, e * 6, 0.05, 'sawtooth', 500, 0.2);
    note(hz(root + 7), t, e * 6, 0.025, 'sawtooth', 500, 0.2);
    // hand drum: doum on 1, teks on the rest of the 6/8
    drum(t, 90, 0.35, 0.25);
    drum(t + e * 3, 90, 0.22, 0.2);
    for (const k of [2, 4, 5]) drum(t + e * k, 420, 0.08, 0.06);
    // plucked lead with a little slide down
    lead.forEach((m, k) => {
      if (m === null) return;
      note(hz(m), t + e * k, e * 1.6, 0.05, 'triangle', 2400, 0.35);
      note(hz(m) * 2, t + e * k, e * 0.5, 0.012, 'sine', 3000, 0.3);
    });
  };
  const schedule = (): void => {
    if (!ctx || ctx.state !== 'running' || !playing || isMusicOff()) return;
    const len = (60 / BPM / 2) * 6;
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
    bus.gain.setTargetAtTime(on ? 0.5 : 0.0001, c.currentTime, on ? 0.8 : 0.08);
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
    rattle: () => {
      for (let i = 0; i < 9; i++) knock(i * 0.045 + Math.random() * 0.02, 900 + Math.random() * 500, 0.06);
    },
    dice: () => {
      knock(0, 520, 0.16);
      knock(0.09, 640, 0.12);
      knock(0.2, 580, 0.08);
    },
    clack: (stack) => knock(0, 240 + Math.min(5, stack) * 30, 0.22),
    tap: () => knock(0, 760 + Math.random() * 80, 0.05),
    hit: () => {
      knock(0, 200, 0.3);
      noise(0, 0.25, 0.3, 700, 'bandpass', 1);
      tone(330, 0.05, 0.2, 0.06, 'square', 160);
    },
    bearOff: () => {
      tone(660, 0, 0.08, 0.12, 'triangle', 990);
      knock(0.05, 300, 0.1);
    },
    turn: () => tone(988, 0, 0.12, 0.05, 'sine', undefined, 0.3),
    win: (points) => [62, 66, 69, 74, ...(points > 1 ? [78, 81] : [])].forEach((m, i) => tone(hz(m), i * 0.1, 0.4, 0.12, 'triangle', undefined, 0.4)),
    lose: () => [66, 62, 59].forEach((m, i) => tone(hz(m), i * 0.2, 0.4, 0.1, 'triangle', hz(m) * 0.97, 0.3)),
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
