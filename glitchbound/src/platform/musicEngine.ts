import type { Song, SongSynth } from './songs';

/**
 * The lobby music synth (see music.ts): the Web Audio graph, the lookahead scheduler and the everyday
 * tune. A separate chunk, loaded the first time music should play (after the first click), so it is
 * not part of the startup download.
 */

const BPM = 116;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

// [bass MIDI, chord tones MIDI[]] per bar.
const PROGRESSIONS: [number, number[]][][] = [
  [
    [36, [60, 64, 67]], // C
    [43, [59, 62, 67]], // G
    [45, [60, 64, 69]], // Am
    [41, [60, 65, 69]], // F
  ],
  [
    [41, [60, 65, 69]], // F
    [43, [59, 62, 67]], // G
    [40, [59, 64, 67]], // Em
    [45, [60, 64, 69]], // Am
  ],
];

// Lead phrases: eighth-note offsets into the bar's chord tones an octave up (null = rest, +n = scale step above).
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88]; // C major pentatonic, two octaves
const PHRASES: (number | null)[][] = [
  [2, null, 3, 4, 3, null, 2, 0],
  [4, 4, null, 3, 2, 3, null, null],
  [0, 2, 3, null, 5, null, 4, 3],
  [5, null, 4, 3, 2, null, 1, null],
];

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private nextBar = 0;
  private bar = 0;
  /** A holiday loop, or null for the everyday tune. */
  private song: Song | null = null;
  private player: ((synth: SongSynth, t: number, n: number, song: Song) => void) | null = null;
  /** What a holiday loop plays with (see songs.ts). */
  private readonly synth: SongSynth = {
    tone: (f, t, dur, opts) => this.tone(f, t, dur, opts),
    drum: (t, from, to, gain, len, wet) => this.drum(t, from, to, gain, len, wet),
    noiseHit: (t, f, gain, len, type, wet) => this.noiseHit(t, f, gain, len, type, wet),
    hat: (t, gain) => this.hat(t, gain),
    kick: (t) => this.kick(t),
    snare: (t) => this.snare(t),
  };

  /**
   * `shouldPlay` and `gameActive` come from the controller; `changed` tells it the audio state moved
   * (suspended, released) so it can publish.
   */
  constructor(
    private readonly shouldPlay: () => boolean,
    private readonly gameActive: () => boolean,
    private readonly changed: () => void,
    /** Made by the controller inside the click that unlocked audio; used for the first graph. */
    private initial: AudioContext | null = null,
  ) {}

  running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Switches the loop from the next bar on (null = the everyday tune). */
  setSong(song: Song | null, player: ((synth: SongSynth, t: number, n: number, song: Song) => void) | null): void {
    this.song = song;
    this.player = player;
    this.bar = 0;
  }

  setVolume(volume: number): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume * 0.5, this.ctx.currentTime, 0.1);
  }

  private setup(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = this.initial ?? (AC ? new AC() : null);
    this.initial = null;
    if (!ctx) return;
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
    wet.gain.value = 0.18;
    this.reverb.connect(wet).connect(this.master);

    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = n.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = n;
  }

  start(volume: number): void {
    this.setup();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    void ctx.resume();
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(volume * 0.5, ctx.currentTime, 0.6);
    if (this.timer) return;
    this.nextBar = Math.max(this.nextBar, ctx.currentTime + 0.1);
    this.timer = window.setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    window.setTimeout(() => {
      if (this.shouldPlay() || this.ctx !== ctx) return;
      // While a game runs, free the whole audio graph (reverb buffers included) so low-memory
      // phones have it for the game; it is rebuilt when the player leaves the game.
      if (this.gameActive()) this.release();
      else if (ctx.state === 'running') void ctx.suspend().then(() => this.changed());
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
    this.changed();
  }

  /** Schedules whole bars a little ahead of time (lookahead scheduler). */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextBar < ctx.currentTime + 1.2) {
      const song = this.song;
      if (song && this.player) this.player(this.synth, this.nextBar, this.bar, song);
      else this.playBar(this.nextBar, this.bar);
      this.nextBar += song && this.player ? (60 / song.bpm) * 4 : BAR;
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

  private tone(freq: number, t: number, dur: number, opts: { type?: OscillatorType; gain: number; attack: number; release: number; cutoff?: number; detune?: number; wet?: number; glide?: number }): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = freq;
    // A short slide into the note (sitar, plucked strings).
    if (opts.glide) {
      osc.frequency.setValueAtTime(freq * opts.glide, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
    }
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

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    this.out(g, 1, 0);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private snare(t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(bp).connect(g);
    this.out(g, 1, 0.15);
    src.start(t, Math.random() * 0.5, 0.16);
  }

  private playBar(t: number, n: number): void {
    const prog = PROGRESSIONS[Math.floor(n / 8) % PROGRESSIONS.length]!;
    const [bass, chord] = prog[n % prog.length]!;
    // Bass: bouncing octaves on eighths (classic arcade drive).
    for (let i = 0; i < 8; i++) {
      const m = bass + (i % 2 ? 12 : 0);
      this.tone(hz(m), t + i * EIGHTH, EIGHTH * 0.7, { type: 'square', gain: 0.035, attack: 0.005, release: 0.05, cutoff: 900, wet: 0 });
    }
    // Arpeggio: quick 16ths up and down the chord, an octave up, very soft.
    const arp = [...chord, chord[0]! + 12, ...chord.slice().reverse()].map((m) => m + 12);
    for (let i = 0; i < 16; i++) {
      const m = arp[i % arp.length]!;
      this.tone(hz(m), t + i * SIXTEENTH, SIXTEENTH * 0.6, { type: 'square', gain: 0.009, attack: 0.003, release: 0.04, cutoff: 3200, wet: 0.2 });
    }
    // Lead: a phrase every other bar, alternating so it doesn't loop too obviously.
    if (n % 2 === 0 || n % 8 === 7) {
      const phrase = PHRASES[(Math.floor(n / 2) + Math.floor(n / 8)) % PHRASES.length]!;
      phrase.forEach((step, i) => {
        if (step === null) return;
        const m = SCALE[step]!;
        this.tone(hz(m), t + i * EIGHTH, EIGHTH * 0.85, { type: 'triangle', gain: 0.05, attack: 0.008, release: 0.12, wet: 0.25 });
        this.tone(hz(m), t + i * EIGHTH, EIGHTH * 0.5, { type: 'square', gain: 0.008, attack: 0.005, release: 0.08, cutoff: 2600, wet: 0.2 });
      });
    }
    // Drums: kick on 1 and 3 (plus a pickup), snare on 2 and 4, hats on eighths.
    this.kick(t);
    this.kick(t + BEAT * 2);
    if (n % 4 === 3) this.kick(t + BEAT * 3.5);
    this.snare(t + BEAT);
    this.snare(t + BEAT * 3);
    for (let i = 0; i < 8; i++) this.hat(t + i * EIGHTH, i % 2 ? 0.012 : 0.022);
  }

  /** A pitched drum hit that drops in pitch (kick, toms, tabla). */
  private drum(t: number, from: number, to: number, gain: number, len: number, wet = 0.05): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + len * 0.7);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g);
    this.out(g, 1, wet);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  /** A burst of filtered noise (shakers, sleigh bells, rim clicks). */
  private noiseHit(t: number, freq: number, gain: number, len: number, type: BiquadFilterType = 'bandpass', wet = 0.1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === 'bandpass' ? 3 : 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g);
    this.out(g, 1, wet);
    src.start(t, Math.random() * 0.5, len + 0.05);
  }

}
