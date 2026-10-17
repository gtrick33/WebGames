import { useSyncExternalStore } from 'react';

/**
 * GlitchBound lobby music: an original, endlessly varying chill "elevator" loop synthesized with
 * Web Audio (no downloads). Soft Rhodes-like keys, warm pads, a round bass and brushed hats over
 * a jazzy ii-V-I-style progression at 78 bpm.
 *
 * Browsers only allow audio after a user gesture, so it starts on the first click/tap/key if the
 * visitor has it switched on (default on, low volume). It pauses while a game is active, and when
 * the tab is hidden. Settings persist in localStorage.
 */

const KEY = 'glitchbound.music';
const BPM = 78;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// [bass MIDI, chord voicing MIDI[]] per bar.
const PROGRESSIONS: [number, number[]][][] = [
  [
    [41, [57, 60, 64, 67]], // Fmaj9
    [40, [55, 59, 62, 64]], // Em7
    [38, [53, 57, 60, 64]], // Dm9
    [36, [52, 55, 59, 62]], // Cmaj9
  ],
  [
    [38, [53, 57, 60, 65]], // Dm7
    [43, [53, 57, 59, 64]], // G13
    [36, [52, 55, 59, 62]], // Cmaj9
    [45, [55, 60, 64, 67]], // Am9
  ],
];
const MELODY = [72, 74, 76, 79, 81, 84]; // C major pentatonic, upper register

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

interface Settings {
  on: boolean;
  volume: number;
}

function load(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (v && typeof v.on === 'boolean' && typeof v.volume === 'number') return { on: v.on, volume: Math.min(1, Math.max(0, v.volume)) };
  } catch {
    /* ignore */
  }
  return { on: true, volume: 0.35 };
}

export interface MusicState {
  on: boolean;
  volume: number;
  /** Actually producing sound right now. */
  playing: boolean;
  /** Waiting for the first click before the browser allows audio. */
  waiting: boolean;
}

class Music {
  private settings: Settings = { on: true, volume: 0.35 };
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private nextBar = 0;
  private bar = 0;
  private gameActive = false;
  private unlocked = false;
  private listeners = new Set<() => void>();
  state: MusicState = { on: true, volume: 0.35, playing: false, waiting: true };

  init(): void {
    if (typeof window === 'undefined' || this.listenersInstalled) return;
    this.listenersInstalled = true;
    this.settings = load();
    this.publish();
    const unlock = (): void => {
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.sync();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => this.sync());
  }
  private listenersInstalled = false;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = (): MusicState => this.state;

  private publish(): void {
    const playing = !!this.ctx && this.ctx.state === 'running' && this.shouldPlay();
    this.state = { on: this.settings.on, volume: this.settings.volume, playing, waiting: this.settings.on && !this.unlocked };
    this.listeners.forEach((fn) => fn());
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  private shouldPlay(): boolean {
    return this.settings.on && this.unlocked && !this.gameActive && !document.hidden && this.settings.volume > 0;
  }

  toggle(): void {
    this.settings.on = !this.settings.on;
    this.unlocked = true; // the toggle itself is a user gesture
    this.save();
    this.sync();
  }

  setVolume(v: number): void {
    this.settings.volume = Math.min(1, Math.max(0, v));
    if (this.settings.volume > 0) this.settings.on = true;
    this.unlocked = true;
    this.save();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.settings.volume * 0.5, this.ctx.currentTime, 0.1);
    this.sync();
  }

  /** Games bring their own sound: the lobby music steps aside while one is running. */
  setGameActive(active: boolean): void {
    this.gameActive = active;
    this.sync();
  }

  private sync(): void {
    if (this.shouldPlay()) this.start();
    else this.stop();
    this.publish();
  }

  private setup(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    // A soft hall reverb from decaying noise.
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);

    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = n.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = n;
  }

  private start(): void {
    this.setup();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    void ctx.resume();
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.settings.volume * 0.5, ctx.currentTime, 0.6);
    if (this.timer) return;
    this.nextBar = Math.max(this.nextBar, ctx.currentTime + 0.1);
    this.timer = window.setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  private stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    window.setTimeout(() => {
      if (this.shouldPlay() || this.ctx !== ctx) return;
      // While a game runs, free the whole audio graph (reverb buffers included) so low-memory
      // phones have it for the game; it is rebuilt when the player leaves the game.
      if (this.gameActive) this.release();
      else if (ctx.state === 'running') void ctx.suspend().then(() => this.publish());
    }, 1200);
  }

  private release(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.noise = null;
    this.nextBar = 0;
    void ctx?.close().catch(() => undefined);
    this.publish();
  }

  /** Schedules whole bars a little ahead of time (lookahead scheduler). */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextBar < ctx.currentTime + 1.2) {
      this.playBar(this.nextBar, this.bar);
      this.nextBar += BAR;
      this.bar++;
    }
  }

  private out(node: AudioNode, dry: number, wet: number): void {
    const ctx = this.ctx!;
    const d = ctx.createGain();
    d.gain.value = dry;
    node.connect(d).connect(this.master!);
    const w = ctx.createGain();
    w.gain.value = wet;
    node.connect(w).connect(this.reverb!);
  }

  private tone(freq: number, t: number, dur: number, opts: { type?: OscillatorType; gain: number; attack: number; release: number; cutoff?: number; detune?: number; wet?: number }): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = freq;
    if (opts.detune) osc.detune.value = opts.detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + opts.attack);
    g.gain.setTargetAtTime(0, t + dur, opts.release / 3);
    let node: AudioNode = osc.connect(g);
    if (opts.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.cutoff;
      node = g.connect(f);
    }
    this.out(node, 1, opts.wet ?? 0.3);
    osc.start(t);
    osc.stop(t + dur + opts.release + 0.1);
  }

  private hat(t: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp).connect(g);
    this.out(g, 1, 0.1);
    src.start(t, Math.random() * 0.5, 0.12);
  }

  private playBar(t: number, n: number): void {
    const prog = PROGRESSIONS[Math.floor(n / 8) % PROGRESSIONS.length]!;
    const [bass, chord] = prog[n % prog.length]!;
    // Pad: two soft detuned triangles per note.
    for (const m of chord) {
      this.tone(hz(m), t, BAR * 0.95, { type: 'triangle', gain: 0.022, attack: 0.9, release: 1.4, cutoff: 1100, detune: -6, wet: 0.5 });
      this.tone(hz(m), t, BAR * 0.95, { type: 'triangle', gain: 0.018, attack: 1.1, release: 1.4, cutoff: 1100, detune: 7, wet: 0.5 });
    }
    // Bass: beat 1, and a pickup on the "and" of 3 every other bar.
    this.tone(hz(bass), t, BEAT * 1.6, { gain: 0.16, attack: 0.02, release: 0.4, cutoff: 500, wet: 0.05 });
    this.tone(hz(bass + 7), t + BEAT * 2, BEAT * 0.9, { gain: 0.11, attack: 0.02, release: 0.3, cutoff: 500, wet: 0.05 });
    if (n % 2) this.tone(hz(bass + 12), t + BEAT * 3.5, BEAT * 0.4, { gain: 0.08, attack: 0.02, release: 0.2, cutoff: 500, wet: 0.05 });
    // Keys: a lazy swung arpeggio (Rhodes-ish: sine + a quiet octave).
    const swing = BEAT * 0.58;
    const pattern = n % 4 === 3 ? [0, 2, 3, 1] : [0, 1, 2, 3, 2, 1];
    pattern.forEach((idx, i) => {
      const at = t + Math.floor(i / 2) * BEAT + (i % 2 ? swing : 0) + BEAT * 0.5;
      const m = chord[idx % chord.length]! + 12;
      this.tone(hz(m), at, 0.25, { gain: 0.045, attack: 0.008, release: 1.2, wet: 0.45 });
      this.tone(hz(m * 1) * 2, at, 0.1, { gain: 0.008, attack: 0.005, release: 0.4, wet: 0.45 });
    });
    // A sparse melody note now and then.
    if (Math.random() < 0.45) {
      const m = MELODY[Math.floor(Math.random() * MELODY.length)]!;
      this.tone(hz(m), t + BEAT * (2 + Math.floor(Math.random() * 2)), BEAT * 0.8, { gain: 0.03, attack: 0.01, release: 1.6, wet: 0.6 });
    }
    // Brushed hats on swung eighths, accent on 2 and 4.
    for (let b = 0; b < 4; b++) {
      this.hat(t + b * BEAT, b % 2 ? 0.035 : 0.02);
      this.hat(t + b * BEAT + swing, 0.012);
    }
  }
}

export const music = new Music();

export function useMusic(): MusicState {
  return useSyncExternalStore(music.subscribe, music.get, music.get);
}
