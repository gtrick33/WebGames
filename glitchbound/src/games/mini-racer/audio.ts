/**
 * Synthesized sound, no files: a soft engine hum under a laid-back lo-fi race loop, a tire squeal
 * while sliding and a few blips. Created on the first Race press (a user gesture) and closed, with
 * the music scheduler stopped, when the game unmounts.
 */

/** Music: 88 BPM, 4 bars of 16th notes, Fmaj7 - Em7 - Dm7 - Cmaj7 (MIDI notes). */
const BPM = 88;
const STEP = 60 / BPM / 4;
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const BASS = [41, 40, 38, 36];
/** Arpeggio pattern per bar (index into the chord, -1 = rest), 16 steps. */
const ARP = [0, -1, 2, -1, 3, -1, 2, 1, -1, 3, -1, 2, 0, -1, 1, -1];
const KICK = [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export class RaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private squeal: GainNode | null = null;
  private muted = false;
  private noiseBuf: AudioBuffer | null = null;
  private musicBus: GainNode | null = null;
  private musicOn = false;
  private musicTimer = 0;
  private nextStep = 0;
  private step = 0;

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.5;
      master.connect(ctx.destination);
      this.master = master;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      const eng = ctx.createGain();
      eng.gain.value = 0;
      filter.connect(eng).connect(master);
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 50;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 25;
      const g2 = ctx.createGain();
      g2.gain.value = 0.7;
      o1.connect(filter);
      o2.connect(g2).connect(filter);
      o1.start();
      o2.start();
      this.osc1 = o1;
      this.osc2 = o2;
      this.filter = filter;
      this.engGain = eng;

      // Squeal: looping noise through a band-pass.
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 6;
      const sq = ctx.createGain();
      sq.gain.value = 0;
      noise.connect(bp).connect(sq).connect(master);
      noise.start();
      this.squeal = sq;
      this.noiseBuf = buf;

      // Music bus with a gentle low-pass for the lo-fi warmth.
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 3200;
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(warm).connect(master);
      this.musicBus = bus;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  /** speed01: 0..1+, slide01: 0..1, running: engine audible. */
  update(speed01: number, slide01: number, running: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.osc1 || !this.osc2 || !this.engGain || !this.filter || !this.squeal) return;
    const t = ctx.currentTime;
    // A soft, low hum that sits under the music: low pitch range, dark filter, quiet.
    const f = 42 + speed01 * 55;
    this.osc1.frequency.setTargetAtTime(f, t, 0.08);
    this.osc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.filter.frequency.setTargetAtTime(200 + speed01 * 320, t, 0.12);
    this.engGain.gain.setTargetAtTime(running ? 0.022 + speed01 * 0.018 : 0, t, 0.15);
    this.squeal.gain.setTargetAtTime(running ? slide01 * 0.028 : 0, t, 0.06);
  }

  blip(kind: 'count' | 'go' | 'lap' | 'best' | 'bump' | 'boost' | 'miss'): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const spec = {
      count: [[520, 0.12]],
      go: [[880, 0.25]],
      lap: [
        [660, 0.1],
        [990, 0.16],
      ],
      best: [
        [660, 0.09],
        [880, 0.09],
        [1320, 0.2],
      ],
      bump: [[110, 0.12]],
      boost: [
        [440, 0.06],
        [740, 0.12],
      ],
      miss: [
        [300, 0.12],
        [220, 0.18],
      ],
    }[kind];
    let at = ctx.currentTime;
    for (const [freq, dur] of spec) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'bump' ? 'triangle' : 'square';
      o.frequency.value = freq!;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.08, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur!);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + dur! + 0.02);
      at += dur! * 0.8;
    }
  }

  /** Fades the race music in or out. The loop keeps its place while the context is suspended (pause). */
  music(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    if (on === this.musicOn) return;
    this.musicOn = on;
    const t = ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(on ? 0.34 : 0, t, on ? 0.4 : 0.25);
    if (on && !this.musicTimer) {
      this.nextStep = ctx.currentTime + 0.1;
      this.step = 0;
      // Look-ahead scheduler: queue notes ~0.2 s ahead on the audio clock.
      this.musicTimer = window.setInterval(() => this.schedule(), 50);
    }
    if (!on && this.musicTimer) {
      const id = this.musicTimer;
      this.musicTimer = 0;
      window.setTimeout(() => window.clearInterval(id), 900);
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    while (this.nextStep < ctx.currentTime + 0.2) {
      if (!this.muted) this.playStep(ctx, bus, this.step, this.nextStep);
      this.step = (this.step + 1) % 64;
      // A touch of swing on the off-beat 16ths.
      this.nextStep += STEP * (this.step % 2 ? 1.12 : 0.88);
    }
  }

  private playStep(ctx: AudioContext, bus: GainNode, step: number, at: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[bar]!;
    const note = (freq: number, dur: number, type: OscillatorType, vol: number, attack = 0.01, cutoff = 2400): void => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      o.type = type;
      o.frequency.value = freq;
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(lp).connect(g).connect(bus);
      o.start(at);
      o.stop(at + dur + 0.05);
    };
    // Pad: the chord, soft and long, once per bar (with a slight detune for width).
    if (s === 0) {
      for (const m of chord) {
        note(hz(m), STEP * 15, 'triangle', 0.045, 0.35, 1400);
        note(hz(m) * 1.004, STEP * 15, 'sine', 0.03, 0.4, 1400);
      }
    }
    // Bass on the beat pattern.
    if (s === 0 || s === 7 || s === 10) note(hz(BASS[bar]!), STEP * 2.6, 'sine', 0.16, 0.01, 600);
    // Plucky arpeggio an octave up.
    const k = ARP[s]!;
    if (k >= 0) note(hz(chord[k]! + 12), STEP * 1.6, 'square', 0.022, 0.005, 1800);
    // Drums: kick, snare (noise) and a soft closed hat on the 8ths.
    if (KICK[s]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(130, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      g.gain.setValueAtTime(0.32, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g).connect(bus);
      o.start(at);
      o.stop(at + 0.25);
    }
    if (this.noiseBuf && (SNARE[s] || s % 2 === 0)) {
      const snare = SNARE[s] === 1;
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = snare ? 'bandpass' : 'highpass';
      f.frequency.value = snare ? 1800 : 7000;
      const g = ctx.createGain();
      const vol = snare ? 0.09 : s % 4 === 2 ? 0.03 : 0.018;
      const dur = snare ? 0.16 : 0.04;
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      n.connect(f).connect(g).connect(bus);
      n.start(at, Math.random() * 0.5);
      n.stop(at + dur + 0.02);
    }
  }

  pause(): void {
    void this.ctx?.suspend();
  }

  dispose(): void {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
