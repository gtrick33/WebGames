/**
 * Procedural audio: every sound effect and the music loop are synthesized with Web Audio,
 * so there are no audio files to download. This module is lazy-loaded on first user input.
 */

export type Sfx = 'coin' | 'nearMiss' | 'crash' | 'powerup' | 'shield' | 'lane' | 'click' | 'buy' | 'levelUp' | 'go' | 'error';

const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

// A minor synthwave progression: Am - F - C - G (MIDI roots).
const CHORDS: number[][] = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];

export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private sfxBus: GainNode;
  private musicBus: GainNode;
  private noise: AudioBuffer;
  private musicTimer: number | null = null;
  private nextStep = 0;
  private step = 0;
  private intensity = 0; // 0 = menu (no drums), 1 = gameplay
  private lastCoin = 0;
  private coinPitch = 0;

  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxBus.gain.value = sfx * 0.9;
    this.musicBus.gain.value = music * 0.45;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => undefined);
  }

  async suspend(): Promise<void> {
    if (this.ctx.state === 'running') await this.ctx.suspend().catch(() => undefined);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, bus: AudioNode = this.sfxBus): void {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = 'lowpass', when = 0, bus: AudioNode = this.sfxBus): void {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(s: Sfx): void {
    if (this.ctx.state !== 'running') return;
    switch (s) {
      case 'coin': {
        // Rising pitch for quick coin streaks.
        const now = this.ctx.currentTime;
        this.coinPitch = now - this.lastCoin < 0.35 ? Math.min(this.coinPitch + 1, 10) : 0;
        this.lastCoin = now;
        const base = NOTE(84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][this.coinPitch]!);
        this.tone(base, 0.09, 'square', 0.07);
        this.tone(base * 1.5, 0.12, 'triangle', 0.06, 0.04);
        break;
      }
      case 'nearMiss':
        this.noiseBurst(0.28, 0.25, 2400, 'bandpass');
        this.tone(NOTE(76), 0.18, 'sawtooth', 0.05, 0, NOTE(88));
        break;
      case 'crash':
        this.noiseBurst(0.9, 0.7, 900);
        this.tone(110, 0.6, 'sawtooth', 0.25, 0, 30);
        this.tone(70, 0.8, 'sine', 0.4, 0, 25);
        break;
      case 'powerup':
        [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.14, 'square', 0.06, i * 0.05));
        break;
      case 'shield':
        this.noiseBurst(0.4, 0.4, 3000, 'highpass');
        this.tone(NOTE(60), 0.4, 'triangle', 0.2, 0, NOTE(84));
        break;
      case 'lane':
        this.noiseBurst(0.07, 0.06, 1800, 'bandpass');
        break;
      case 'click':
        this.tone(NOTE(79), 0.05, 'triangle', 0.08);
        break;
      case 'buy':
        [76, 79, 83, 88].forEach((n, i) => this.tone(NOTE(n), 0.16, 'triangle', 0.1, i * 0.06));
        break;
      case 'levelUp':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.22, 'square', 0.06, i * 0.08));
        break;
      case 'go':
        this.tone(NOTE(72), 0.25, 'square', 0.08, 0, NOTE(84));
        break;
      case 'error':
        this.tone(NOTE(50), 0.18, 'square', 0.07);
        break;
    }
  }

  /** 0 = calm menu loop, 1 = full gameplay groove. */
  setIntensity(v: number): void {
    this.intensity = v;
  }

  startMusic(): void {
    if (this.musicTimer !== null) return;
    this.nextStep = this.ctx.currentTime + 0.05;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule(): void {
    if (this.ctx.state !== 'running') return;
    const stepDur = 60 / 112 / 4; // 16th notes at 112 BPM
    while (this.nextStep < this.ctx.currentTime + 0.12) {
      this.musicStep(this.step, this.nextStep - this.ctx.currentTime);
      this.nextStep += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private musicStep(step: number, when: number): void {
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length]!;
    const bus = this.musicBus;
    // Bass: driving 8ths.
    if (step % 2 === 0) this.tone(NOTE(chord[0]! - 24), 0.2, 'sawtooth', 0.11, when, undefined, bus);
    // Arp: 16ths across the chord, an octave up.
    const arpNote = chord[step % 3]! + 12 + (step % 8 >= 4 ? 12 : 0);
    this.tone(NOTE(arpNote), 0.1, 'square', 0.022, when, undefined, bus);
    // Pad on the bar.
    if (step % 16 === 0) for (const n of chord) this.tone(NOTE(n), 1.9, 'triangle', 0.035, when, undefined, bus);
    if (this.intensity > 0) {
      if (step % 4 === 0) this.tone(150, 0.18, 'sine', 0.5, when, 40, bus); // kick
      if (step % 8 === 4) this.noiseBurst(0.16, 0.22, 1800, 'bandpass', when, bus); // snare
      if (step % 2 === 1) this.noiseBurst(0.04, 0.07, 8000, 'highpass', when, bus); // hat
    }
  }
}
