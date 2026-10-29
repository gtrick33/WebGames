/**
 * Synthesised sounds (no audio files): booms from filtered noise, a whoosh for every launch, bounces,
 * boings, splashes, the Zapper's sweep, a cartoon bonk, the power charge, turn chimes and the last
 * seconds' ticks. The AudioContext is created on the first sound (always after a tap) and closed by
 * `dispose()`.
 */
export interface Sfx {
  boom(size: number): void;
  launch(kind: string): void;
  bounce(): void;
  jump(): void;
  land(hard: boolean): void;
  splash(big: boolean): void;
  zap(): void;
  bonk(hit: boolean): void;
  hurt(): void;
  turn(mine: boolean): void;
  tick(): void;
  charge(power: number): void;
  chargeStop(): void;
  select(): void;
  win(): void;
  lose(): void;
  dispose(): void;
}

export function createSfx(isMuted: () => boolean): Sfx {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let charger: { o: OscillatorNode; g: GainNode } | null = null;
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
  const noiseBuf = (c: AudioContext): AudioBuffer => {
    if (noise) return noise;
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noise = b);
  };
  const tone = (from: number, to: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine'): void => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  /** Filtered noise: type, frequency sweep, length, loudness. */
  const hiss = (type: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, at = 0): void => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuf(c);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  };
  return {
    boom(size) {
      const k = Math.min(1.6, size / 40);
      hiss('lowpass', 1800 * k, 60, 0.5 + k * 0.4, 0.5 * Math.min(1, k + 0.3));
      tone(110, 35, 0, 0.45 + k * 0.3, 0.35 * k, 'sine');
      hiss('bandpass', 3000, 300, 0.18, 0.12);
    },
    launch(kind) {
      if (kind === 'grenade' || kind === 'dynamite') {
        tone(500, 260, 0, 0.12, 0.06, 'triangle');
        return;
      }
      hiss('bandpass', 600, 2400, 0.35, 0.18);
      tone(180, 90, 0, 0.2, 0.08, 'sawtooth');
    },
    bounce: () => tone(320, 180, 0, 0.07, 0.07, 'triangle'),
    jump: () => tone(300, 620, 0, 0.14, 0.06, 'square'),
    land: (hard) => (hard ? hiss('lowpass', 500, 80, 0.25, 0.3) : hiss('lowpass', 300, 100, 0.08, 0.08)),
    splash(big) {
      hiss('highpass', 900, 3000, big ? 0.6 : 0.35, big ? 0.28 : 0.14);
      tone(260, 120, 0.02, 0.2, 0.05, 'sine');
    },
    zap() {
      tone(1800, 120, 0, 0.3, 0.1, 'sawtooth');
      tone(2400, 300, 0.02, 0.25, 0.05, 'square');
    },
    bonk(hit) {
      if (!hit) return hiss('bandpass', 900, 300, 0.2, 0.12);
      tone(420, 150, 0, 0.18, 0.18, 'square');
      tone(900, 1300, 0.12, 0.25, 0.06, 'sine');
    },
    hurt: () => tone(520, 260, 0, 0.16, 0.06, 'triangle'),
    turn(mine) {
      if (mine) [523, 659, 784].forEach((f, i) => tone(f, f, i * 0.08, 0.16, 0.06, 'triangle'));
      else tone(440, 440, 0, 0.12, 0.04, 'triangle');
    },
    tick: () => tone(1200, 1200, 0, 0.04, 0.04, 'square'),
    charge(power) {
      const c = audio();
      if (!c) return;
      if (!charger) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        g.gain.value = 0.035;
        o.connect(g).connect(c.destination);
        o.start();
        charger = { o, g };
      }
      charger.o.frequency.setTargetAtTime(160 + power * 7, c.currentTime, 0.02);
    },
    chargeStop() {
      if (!charger || !ctx) return;
      const { o, g } = charger;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
      o.stop(ctx.currentTime + 0.1);
      charger = null;
    },
    select: () => tone(700, 900, 0, 0.06, 0.04, 'triangle'),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, i * 0.11, 0.2, 0.06, 'triangle')),
    lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, f * 0.98, i * 0.16, 0.24, 0.06, 'triangle')),
    dispose() {
      charger = null;
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
