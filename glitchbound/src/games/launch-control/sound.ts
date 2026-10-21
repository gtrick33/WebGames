/**
 * Launch Control's sound: everything synthesised with Web Audio (no files), on one AudioContext.
 *
 * - Sound effects and an engine note that follows the revs, voiced by the car's layout (an inline
 *   four rasps, a V8 rumbles, a V12 screams, an electric car whines). The engine's pitch is the real
 *   firing frequency, so it sits where phone speakers can play it.
 * - Music: an original synthwave menu theme ("Strip Lights", 112 bpm, A minor) and a tension loop for
 *   the staging lanes that cuts dead at lights out, so the launch is all engine.
 *
 * Both run through a compressor so the mix is loud without clipping. The context is created on the
 * first sound and can only start after a tap: `unlock()` is called from the game's first pointer or
 * key press. Sound effects and music switch off separately (the game's sound menu). Hidden tabs
 * suspend the context; dispose() closes it.
 */
import type { CarDef } from './cars';

export type MusicMode = 'menu' | 'race' | 'off';

export interface Sfx {
  /** Engine note on and tuned every few frames: rpm fraction of the redline, 0 = off. */
  engine(frac: number, load: number): void;
  /** Which engine the note voices (call when the player's car changes). */
  voice(def: CarDef | undefined): void;
  /** One of the five red start lights came on. */
  amber(): void;
  /** Lights out. */
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
  /** A turbo's blow-off valve between gears. */
  blowoff(): void;
  /** The nitrous valve opens: a purge hiss and a deep roar. */
  nitro(): void;
  /** An electric's overdrive surge (0..1: how clean the tap was). */
  surge(level: number): void;
  /** A police car's siren, one whoop. */
  siren(): void;
  /** Crossing the line at speed. */
  whoosh(): void;
  cash(): void;
  /** A new car: the register, then the engine fires up. */
  buy(def: CarDef): void;
  /** A part bolted on: an air wrench. */
  upgrade(): void;
  /** A short throttle blip (choosing a car on the turntable). */
  rev(def: CarDef): void;
  fail(): void;
  red(): void;
  finish(win: boolean): void;
  click(): void;
  /** The needle entered the perfect zone. */
  cue(): void;
  /** A tap too early to count. */
  nope(): void;
  /** Engine off (leaving a race). */
  quiet(): void;
  music(mode: MusicMode): void;
  /** Resumes audio inside a tap (browsers only start sound after one). */
  unlock(): void;
  /** Re-reads the switches (sound effects off mutes the engine at once, music off fades the music). */
  refresh(): void;
  dispose(): void;
}

type Voice = 'i4' | 'v8' | 'v12' | 'ev';

/**
 * The engine a car's note uses (from its kind, trait and gears; nothing in the sim depends on it): big
 * torque and police cars burble like V8s, exotics scream, small cars rasp, and a turbo whistles over
 * whatever it is bolted to.
 */
export function voiceOf(def: CarDef | undefined): { kind: Voice; redline: number; turbo: boolean } {
  if (!def) return { kind: 'v8', redline: 6500, turbo: false };
  const k = def.kind.toLowerCase();
  const kind: Voice =
    def.gears === 1 || def.trait === 'electric'
      ? 'ev'
      : def.trait === 'torque' || def.trait === 'pursuit'
        ? 'v8'
        : k.includes('supercar') || k.includes('hypercar') || def.redline >= 8600
          ? 'v12'
          : /city|compact|hatch|sports sedan|taxi|classic sedan|track|rally|boxy|off-roader/.test(k) && def.hp < 520
            ? 'i4'
            : 'v8';
  return { kind, redline: def.redline + (def.trait === 'revs' ? 700 : 0), turbo: def.trait === 'turbo' };
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

// ---------------------------------------------------------------- music: "Strip Lights"
// Bars of [bass root, chord tones]; MIDI numbers (A2 = 45). Sixteen bars: A section, then B with the lead.
type Chord = [number, number[]];
const Am: Chord = [45, [57, 60, 64]];
const F: Chord = [41, [57, 60, 65]];
const C: Chord = [48, [55, 60, 64]];
const G: Chord = [43, [55, 59, 62]];
const Em: Chord = [40, [55, 59, 64]];
const Dm: Chord = [50, [57, 62, 65]];
const E: Chord = [40, [56, 59, 64]];
const MENU_BARS: Chord[] = [Am, F, C, G, Am, F, Em, G, F, G, Am, Am, Dm, F, E, E];
const _ = null;
/** The B section's lead, eight eighth notes a bar (null = rest). */
const MENU_LEAD: (number | null)[][] = [
  [72, _, 74, 76, _, 77, 76, 74],
  [74, _, 71, _, 74, 76, 79, _],
  [81, _, 79, 76, _, 74, 76, _],
  [72, _, _, _, 69, _, 72, 74],
  [77, _, 76, 74, _, 72, 74, _],
  [77, _, 79, 81, _, 79, 77, _],
  [76, _, 75, 76, _, 80, 83, _],
  [88, _, _, _, 83, _, 80, _],
];
const MENU_BPM = 112;
const RACE_BPM = 132;

export function createSfx(isMuted: () => boolean, isMusicOff: () => boolean = () => false): Sfx {
  let ctx: AudioContext | null = null;
  let fx: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let verb: ConvolverNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let disposed = false;
  let voice = voiceOf(undefined);
  let eng: { osc: OscillatorNode[]; shape: WaveShaperNode; band: BiquadFilterNode; low: BiquadFilterNode; rumble: AudioBufferSourceNode; rumbleGain: GainNode; g: GainNode; kind: Voice; whistle: { o: OscillatorNode; g: GainNode } | null } | null = null;
  let mode: MusicMode = 'off';
  /** The piece playing now: its own gain and reverb, so a switch can silence it, tails and all. */
  let deck: { out: GainNode; verb: ConvolverNode } | null = null;
  let timer = 0;
  let nextBar = 0;
  let barN = 0;

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
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 0.95;
    comp.connect(master).connect(ctx.destination);
    fx = ctx.createGain();
    fx.gain.value = 1;
    fx.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(comp);
    // a short plate for the music and the crowd
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    verb.connect(wet).connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  };
  /** The context for a sound effect, or null when effects are off. */
  const audio = (): AudioContext | null => {
    if (isMuted()) return null;
    const c = make();
    if (c && c.state === 'suspended' && !document.hidden) void c.resume().catch(() => undefined);
    return c;
  };

  // ---- building blocks
  const tone = (from: number, to: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', dest?: AudioNode, cutoff?: number): void => {
    const c = audio();
    if (!c || !fx) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = o;
    if (cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      out = f;
    }
    out.connect(g).connect(dest ?? fx);
    o.start(t);
    o.stop(t + dur + 0.03);
  };
  const noise = (at: number, dur: number, gain: number, freq: number, opts: { type?: BiquadFilterType; q?: number; to?: number; attack?: number; wet?: boolean } = {}): void => {
    const c = audio();
    if (!c || !fx || !noiseBuf) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = dur > 1.9;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q ?? 1.2;
    const g = c.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(fx);
    if (opts.wet && verb) g.connect(verb);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  };

  // ---- the engine
  const curve = (amount: number): Float32Array<ArrayBuffer> => {
    const n = 1024;
    const out = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      out[i] = Math.tanh(x * amount);
    }
    return out;
  };
  const engineNodes = (): typeof eng => {
    const c = audio();
    if (!c || !fx || !noiseBuf) return null;
    if (eng && eng.kind === voice.kind && !!eng.whistle === voice.turbo) return eng;
    stopEngine();
    const ev = voice.kind === 'ev';
    const g = c.createGain();
    g.gain.value = 0.0001;
    const shape = c.createWaveShaper();
    shape.curve = curve(ev ? 1 : voice.kind === 'i4' ? 3.2 : 2.4);
    shape.oversample = '2x';
    const band = c.createBiquadFilter();
    band.type = 'peaking';
    band.Q.value = 1.4;
    band.gain.value = ev ? 4 : 9;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.Q.value = 0.7;
    const types: OscillatorType[] = ev ? ['sine', 'triangle', 'sine'] : voice.kind === 'i4' ? ['sawtooth', 'square', 'sawtooth'] : ['sawtooth', 'sawtooth', 'square'];
    const osc = types.map((type) => {
      const o = c.createOscillator();
      o.type = type;
      o.connect(shape);
      o.start();
      return o;
    });
    shape.connect(band).connect(low).connect(g).connect(fx);
    // intake and exhaust rush, louder under load
    const rumble = c.createBufferSource();
    rumble.buffer = noiseBuf;
    rumble.loop = true;
    const rf = c.createBiquadFilter();
    rf.type = 'bandpass';
    rf.frequency.value = ev ? 2400 : 420;
    rf.Q.value = 0.8;
    const rumbleGain = c.createGain();
    rumbleGain.gain.value = 0.0001;
    rumble.connect(rf).connect(rumbleGain).connect(g);
    rumble.start();
    // a turbo's whistle: a thin sine that climbs with the boost, outside the distortion
    let whistle: { o: OscillatorNode; g: GainNode } | null = null;
    if (voice.turbo) {
      const o = c.createOscillator();
      o.type = 'sine';
      const wg = c.createGain();
      wg.gain.value = 0.0001;
      o.connect(wg).connect(fx);
      o.start();
      whistle = { o, g: wg };
    }
    eng = { osc, shape, band, low, rumble, rumbleGain, g, kind: voice.kind, whistle };
    return eng;
  };
  function stopEngine(): void {
    if (!eng || !ctx) return;
    const e = eng;
    eng = null;
    e.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
    window.setTimeout(() => {
      try {
        e.osc.forEach((o) => o.stop());
        e.rumble.stop();
        e.whistle?.o.stop();
      } catch {
        /* already stopped */
      }
    }, 300);
  }

  // ---- music
  const musicOn = (): boolean => !isMusicOff() && mode !== 'off';
  /**
   * A fresh deck for a new piece. The old one fades out in a few hundredths of a second and is
   * unplugged: notes it already scheduled (a menu chord lasts a whole bar) and its reverb tail stop
   * with it instead of ringing over the next piece.
   */
  const newDeck = (): void => {
    if (!ctx || !musicBus) return;
    const old = deck;
    if (old) {
      old.out.gain.cancelScheduledValues(ctx.currentTime);
      old.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.025);
      window.setTimeout(() => old.out.disconnect(), 350);
    }
    const out = ctx.createGain();
    out.connect(musicBus);
    const v = ctx.createConvolver();
    v.buffer = verb?.buffer ?? null;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    v.connect(wet).connect(out);
    deck = { out, verb: v };
  };
  const deckOut = (): AudioNode | null => deck?.out ?? musicBus;
  const note = (f: number, t: number, dur: number, gain: number, type: OscillatorType, cutoff: number, opts: { attack?: number; release?: number; detune?: number; wet?: number } = {}): void => {
    if (!ctx || !musicBus) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    if (opts.detune) o.detune.value = opts.detune;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.005;
    const r = opts.release ?? 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.setValueAtTime(gain, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(deckOut()!);
    if (opts.wet && deck) {
      const w = ctx.createGain();
      w.gain.value = opts.wet;
      g.connect(w).connect(deck.verb);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const kick = (t: number, gain = 0.5): void => {
    if (!ctx || !musicBus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(deckOut()!);
    o.start(t);
    o.stop(t + 0.32);
  };
  const hit = (t: number, freq: number, gain: number, len: number, type: BiquadFilterType = 'highpass', wet = 0): void => {
    if (!ctx || !musicBus || !noiseBuf) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(deckOut()!);
    if (wet && deck) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(deck.verb);
    }
    s.start(t, Math.random());
    s.stop(t + len + 0.02);
  };
  const menuBar = (t: number, n: number): void => {
    const beat = 60 / MENU_BPM;
    const e = beat / 2;
    const s16 = beat / 4;
    const i = n % MENU_BARS.length;
    const [root, chord] = MENU_BARS[i]!;
    const lap = Math.floor(n / MENU_BARS.length);
    // drums: four on the floor, a clap on 2 and 4, offbeat hats; the very first bars are bass and pad only
    const drums = n >= 2;
    for (let b = 0; b < 4; b++) {
      if (drums) kick(t + b * beat, 0.42);
      if (drums && b % 2 === 1) hit(t + b * beat, 1500, 0.16, 0.18, 'bandpass', 0.25);
      if (drums) hit(t + b * beat + e, 7000, 0.05, 0.05);
    }
    // the bar before the B section: a snare roll
    if (i === 7) for (let k = 8; k < 16; k++) hit(t + k * s16, 1800, 0.05 + k * 0.008, 0.08, 'bandpass', 0.2);
    // bass: octave pulse in eighths
    for (let k = 0; k < 8; k++) note(hz(root + (k % 2 ? 12 : 0)), t + k * e, e * 0.85, 0.09, 'sawtooth', 620, { release: 0.05 });
    // pad: the chord, two detuned saws, the whole bar
    for (const m of chord) {
      note(hz(m), t, beat * 4, 0.022, 'sawtooth', 1600, { attack: 0.25, release: 0.5, detune: -7, wet: 0.4 });
      note(hz(m), t, beat * 4, 0.022, 'sawtooth', 1600, { attack: 0.25, release: 0.5, detune: 7, wet: 0.4 });
    }
    // arpeggio: sixteenths up and down the chord an octave up (from the second lap on in the A section, always in B)
    if (i >= 8 || lap > 0 || n >= 4) {
      const arp = [...chord, chord[0]! + 12, ...[...chord].reverse()].map((m) => m + 12);
      for (let k = 0; k < 16; k++) note(hz(arp[k % arp.length]!), t + k * s16, s16 * 0.8, 0.026, 'square', 2600, { release: 0.04, wet: 0.2 });
    }
    // lead in the B section
    if (i >= 8) {
      MENU_LEAD[i - 8]!.forEach((m, k) => {
        if (m === null) return;
        note(hz(m), t + k * e, e * 1.6, 0.05, 'sawtooth', 3200, { attack: 0.01, release: 0.15, detune: -5, wet: 0.35 });
        note(hz(m), t + k * e, e * 1.6, 0.035, 'square', 2400, { attack: 0.01, release: 0.15, detune: 6, wet: 0.35 });
      });
    }
  };
  /** The staging lanes: a pulsing low E that winds up the filter, hats and a kick, no tune. */
  const raceBar = (t: number, n: number): void => {
    const beat = 60 / RACE_BPM;
    const s16 = beat / 4;
    const open = 380 + Math.min(4, n) * 260;
    for (let k = 0; k < 16; k++) {
      note(hz(k % 4 === 3 ? 40 : 28), t + k * s16, s16 * 0.8, 0.11, 'sawtooth', open + (k / 16) * 200, { release: 0.04 });
      hit(t + k * s16, 8000, k % 2 ? 0.03 : 0.05, 0.04);
    }
    for (let b = 0; b < 4; b++) kick(t + b * beat, 0.5);
    if (n % 2 === 1) hit(t + beat * 2, 600, 0.12, beat * 2, 'bandpass', 0.4);
    // a stab on the off-beat of beat four, the minor third, for menace
    note(hz(55), t + beat * 3.5, s16 * 2, 0.03, 'square', 1400, { wet: 0.3 });
  };
  const schedule = (): void => {
    if (!ctx || !musicOn() || ctx.state !== 'running') return;
    const beat = 60 / (mode === 'race' ? RACE_BPM : MENU_BPM);
    while (nextBar < ctx.currentTime + 0.5) {
      if (mode === 'race') raceBar(nextBar, barN);
      else menuBar(nextBar, barN);
      nextBar += beat * 4;
      barN++;
    }
  };
  const applyMusic = (fadeS = 0.4): void => {
    const c = isMusicOff() || mode === 'off' ? ctx : make();
    if (!c || !musicBus) return;
    const on = musicOn();
    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setTargetAtTime(on ? (mode === 'race' ? 0.6 : 0.5) : 0.0001, c.currentTime, on ? fadeS : Math.min(fadeS, 0.06));
    if (on && !timer) {
      if (c.state === 'suspended' && !document.hidden) void c.resume().catch(() => undefined);
      if (!deck) newDeck();
      nextBar = Math.max(nextBar, c.currentTime + 0.12);
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

  const blowoff = (): void => noise(0, 0.35, 0.2, 5200, { to: 2400, q: 2.5, attack: 0.01 });

  return {
    engine(frac, load) {
      if (frac <= 0 || isMuted()) {
        if (eng && ctx) eng.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        return;
      }
      const e = engineNodes();
      if (!e || !ctx) return;
      const t = ctx.currentTime;
      const rpm = Math.max(700, frac * voice.redline);
      const fire = e.kind === 'ev' ? 260 + frac * 1900 : (rpm / 60) * (e.kind === 'i4' ? 2 : e.kind === 'v8' ? 4 : 6);
      const mults = e.kind === 'ev' ? [1, 2.01, 3.02] : [1, 0.5, 2.003];
      e.osc.forEach((o, i) => o.frequency.setTargetAtTime(fire * mults[i]!, t, 0.025));
      e.band.frequency.setTargetAtTime(Math.min(6000, fire * 2.5), t, 0.03);
      e.low.frequency.setTargetAtTime(e.kind === 'ev' ? 5200 : 700 + frac * 3800 + load * 800, t, 0.04);
      e.rumbleGain.gain.setTargetAtTime(0.02 + load * 0.09, t, 0.05);
      e.g.gain.setTargetAtTime((e.kind === 'ev' ? 0.06 : 0.11) + load * (e.kind === 'ev' ? 0.06 : 0.12) + frac * 0.05, t, 0.04);
      if (e.whistle) {
        e.whistle.o.frequency.setTargetAtTime(1900 + frac * 4600, t, 0.05);
        e.whistle.g.gain.setTargetAtTime(0.0001 + load * frac * frac * 0.03, t, 0.08);
      }
    },
    voice(def) {
      const v = voiceOf(def);
      if (v.kind !== voice.kind || v.turbo !== voice.turbo) stopEngine();
      voice = v;
    },
    amber: () => {
      tone(523, 523, 0, 0.16, 0.22, 'square', undefined, 2400);
      tone(1046, 1046, 0, 0.08, 0.05, 'sine');
    },
    green: () => {
      tone(1046, 1046, 0, 0.42, 0.24, 'square', undefined, 3000);
      tone(1568, 1568, 0, 0.3, 0.08, 'sine');
      noise(0, 0.6, 0.12, 300, { type: 'lowpass', attack: 0.01 });
    },
    shift: () => {
      noise(0, 0.07, 0.35, 2600);
      tone(240, 110, 0, 0.09, 0.18, 'square', undefined, 1600);
      if (voice.turbo) blowoff();
    },
    perfect: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, f, i * 0.05, 0.18, 0.12, 'triangle')),
    limiter: () => tone(320, 300, 0, 0.06, 0.12, 'sawtooth', undefined, 2200),
    squeal: () => noise(0, 0.55, 0.22, 3400, { q: 6, to: 2600 }),
    cheer: (level) => {
      for (let k = 0; k < 4; k++) noise(k * 0.12, 1.4 + level, 0.06 + level * 0.1, 600 + k * 380, { attack: 0.25, wet: true });
    },
    burnout: () => {
      noise(0, 1.6, 0.26, 2600, { q: 3, attack: 0.08 });
      noise(0.05, 1.5, 0.18, 900, { attack: 0.1 });
    },
    pop: () => {
      if (voice.kind === 'ev') return;
      noise(0, 0.08, 0.4, 160, { type: 'lowpass' });
      tone(110, 45, 0, 0.1, 0.22, 'square', undefined, 700);
    },
    blowoff,
    nitro: () => {
      noise(0, 0.5, 0.3, 6500, { type: 'highpass', attack: 0.01 });
      noise(0.05, 2.2, 0.32, 160, { type: 'lowpass', attack: 0.15 });
      noise(0.05, 2.0, 0.12, 900, { to: 2400, attack: 0.2 });
      tone(55, 90, 0.05, 1.6, 0.16, 'sawtooth', undefined, 500);
    },
    surge: (level) => {
      tone(600, 2400, 0, 0.28, 0.08 + level * 0.1, 'sine');
      tone(300, 1200, 0, 0.32, 0.05 + level * 0.06, 'triangle');
      noise(0, 0.22, 0.06 + level * 0.08, 5200, { q: 4, to: 8000 });
    },
    siren: () => {
      tone(700, 1500, 0, 0.32, 0.09, 'square', undefined, 2600);
      tone(1500, 700, 0.32, 0.36, 0.09, 'square', undefined, 2600);
    },
    whoosh: () => noise(0, 0.9, 0.3, 400, { to: 3600, q: 1.5, attack: 0.3 }),
    cash: () => {
      tone(1319, 1319, 0, 0.07, 0.12, 'square', undefined, 4000);
      tone(1760, 1760, 0.07, 0.1, 0.12, 'square', undefined, 4000);
      tone(2637, 2637, 0.16, 0.25, 0.1, 'sine');
      noise(0.16, 0.12, 0.08, 6000, { type: 'highpass' });
    },
    buy(def) {
      this.cash();
      const v = voiceOf(def);
      // starter whirr, then the engine catches and revs once
      noise(0.35, 0.45, 0.12, 900, { q: 4 });
      const f0 = v.kind === 'ev' ? 400 : v.kind === 'i4' ? 60 : 40;
      tone(f0, f0 * 3.2, 0.8, 0.45, 0.2, v.kind === 'ev' ? 'sine' : 'sawtooth', undefined, 1800);
      tone(f0 * 3.2, f0 * 1.4, 1.25, 0.6, 0.16, v.kind === 'ev' ? 'sine' : 'sawtooth', undefined, 1400);
    },
    upgrade: () => {
      for (let k = 0; k < 5; k++) noise(k * 0.055, 0.045, 0.22, 3200, { q: 3 });
      tone(880, 1320, 0.3, 0.16, 0.1, 'triangle');
    },
    rev(def) {
      const v = voiceOf(def);
      const f0 = v.kind === 'ev' ? 500 : v.kind === 'i4' ? 70 : v.kind === 'v8' ? 50 : 110;
      const type: OscillatorType = v.kind === 'ev' ? 'sine' : 'sawtooth';
      tone(f0, f0 * 2.6, 0, 0.22, 0.16, type, undefined, 2000);
      tone(f0 * 2.6, f0 * 1.1, 0.22, 0.5, 0.12, type, undefined, 1500);
      if (v.kind !== 'ev') noise(0.05, 0.4, 0.08, 400, { attack: 0.05 });
    },
    fail: () => {
      noise(0, 0.7, 0.45, 380, { type: 'lowpass' });
      tone(220, 40, 0, 0.7, 0.22, 'sawtooth', undefined, 900);
      noise(0.2, 1.2, 0.1, 2400, { attack: 0.2 });
    },
    red: () => {
      tone(220, 160, 0, 0.3, 0.2, 'square', undefined, 1800);
      tone(160, 110, 0.3, 0.45, 0.2, 'square', undefined, 1500);
    },
    finish: (win) => {
      noise(0, 0.9, 0.22, 400, { to: 3600, q: 1.5, attack: 0.25 });
      if (win) [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, f, 0.15 + i * 0.09, 0.22, 0.13, 'triangle'));
      else [440, 330, 262].forEach((f, i) => tone(f, f * 0.94, 0.15 + i * 0.2, 0.3, 0.1, 'triangle'));
    },
    click: () => tone(900, 600, 0, 0.045, 0.08, 'square', undefined, 3200),
    cue: () => tone(1760, 1760, 0, 0.08, 0.12, 'square', undefined, 5000),
    nope: () => tone(240, 190, 0, 0.14, 0.12, 'triangle'),
    quiet() {
      if (eng && ctx) eng.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    },
    music(next) {
      if (next === mode) return;
      const from = mode;
      mode = next;
      // A new piece gets a new deck and starts on a fresh bar: whatever the old one had queued is cut
      // (the race loop dies at lights out, the menu never rings over the staging loop).
      if (ctx) {
        newDeck();
        if (next !== 'off') {
          nextBar = ctx.currentTime + (from === 'menu' && next === 'race' ? 0.45 : 0.1);
          barN = 0;
          // into the staging loop: a short rising sweep where the menu stops
          if (from === 'menu' && next === 'race' && musicOn() && noiseBuf && deck) {
            const t = ctx.currentTime;
            const src = ctx.createBufferSource();
            src.buffer = noiseBuf;
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.Q.value = 1.6;
            f.frequency.setValueAtTime(260, t);
            f.frequency.exponentialRampToValueAtTime(3800, t + 0.45);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.16, t + 0.38);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            src.connect(f).connect(g).connect(deck.out);
            src.start(t);
            src.stop(t + 0.55);
          }
        }
      }
      applyMusic(next === 'off' ? 0.03 : next === 'race' ? 0.3 : 0.8);
    },
    unlock() {
      const c = make();
      if (c && c.state !== 'running' && !document.hidden) void c.resume().then(() => applyMusic(), () => undefined);
      else applyMusic();
    },
    refresh() {
      if (isMuted()) this.quiet();
      applyMusic(0.3);
    },
    dispose() {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
      timer = 0;
      try {
        eng?.osc.forEach((o) => o.stop());
        eng?.rumble.stop();
        eng?.whistle?.o.stop();
      } catch {
        /* already stopped */
      }
      eng = null;
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
