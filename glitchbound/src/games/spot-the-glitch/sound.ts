/**
 * Synthesised sounds (no audio files). The AudioContext is created on the first sound (always after
 * a tap) and closed by `dispose()`.
 */
export interface Sfx {
  found(n: number): void;
  miss(): void;
  lock(): void;
  hint(): void;
  clear(): void;
  over(): void;
  dispose(): void;
}

export function createSfx(isMuted: () => boolean): Sfx {
  let ctx: AudioContext | null = null;
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
  const tone = (from: number, to: number, at: number, dur: number, gain: number, type: OscillatorType = 'square'): void => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  return {
    // A bright 8-bit blip that climbs with each glitch found.
    found: (n) => {
      const f = 440 * 2 ** ((n * 2) / 12);
      tone(f, f * 1.5, 0, 0.09, 0.05);
      tone(f * 1.5, f * 2, 0.07, 0.12, 0.05);
    },
    miss: () => tone(160, 110, 0, 0.16, 0.05, 'sawtooth'),
    lock: () => tone(300, 80, 0.12, 0.4, 0.05, 'sawtooth'),
    hint: () => tone(660, 990, 0, 0.2, 0.04, 'triangle'),
    clear: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.15 + i * 0.07, 0.14, 0.05)),
    over: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, i * 0.14, 0.2, 0.05, 'triangle')),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
