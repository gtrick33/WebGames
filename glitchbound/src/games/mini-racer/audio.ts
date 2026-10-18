/**
 * Tiny synthesized sound: an engine hum that follows speed, a tyre squeal while sliding and a few
 * blips. Created on the first Play press (a user gesture) and closed when the game unmounts.
 */
export class RaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private squeal: GainNode | null = null;
  private muted = false;

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
      filter.frequency.value = 500;
      const eng = ctx.createGain();
      eng.gain.value = 0;
      filter.connect(eng).connect(master);
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 50;
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 25;
      const g2 = ctx.createGain();
      g2.gain.value = 0.4;
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
    const f = 48 + speed01 * 120;
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.filter.frequency.setTargetAtTime(380 + speed01 * 1100, t, 0.08);
    this.engGain.gain.setTargetAtTime(running ? 0.09 + speed01 * 0.06 : 0, t, 0.1);
    this.squeal.gain.setTargetAtTime(running ? slide01 * 0.07 : 0, t, 0.05);
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
      g.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur!);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + dur! + 0.02);
      at += dur! * 0.8;
    }
  }

  pause(): void {
    void this.ctx?.suspend();
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
