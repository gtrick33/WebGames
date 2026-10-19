/**
 * Synthesised sounds (no audio files): a whoosh when an arrow leaves, a thud when it is blocked, a
 * chime per cleared level and a falling tune at the end. The AudioContext is created on the first
 * sound (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  whoosh(combo: number): void;
  bump(): void;
  level(): void;
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
  const tone = (from: number, to: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine'): void => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  return {
    whoosh: (combo) => {
      const up = 2 ** (Math.min(combo, 12) / 12);
      tone(300 * up, 1200 * up, 0, 0.16, 0.05, 'triangle');
    },
    bump: () => {
      tone(140, 70, 0, 0.18, 0.12, 'square');
      tone(90, 50, 0.02, 0.2, 0.08, 'sine');
    },
    level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, i * 0.07, 0.16, 0.05, 'square')),
    over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, i * 0.13, 0.22, 0.06, 'triangle')),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
