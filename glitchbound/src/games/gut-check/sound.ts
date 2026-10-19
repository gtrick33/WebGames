/**
 * Synthesised sounds (no audio files): a rising ding for a right call (higher as the streak grows)
 * and a low buzz for the miss. The AudioContext is created on the first sound (always after a tap)
 * and closed by `dispose()`.
 */
export interface Sfx {
  right(streak: number): void;
  wrong(): void;
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
    right: (streak) => {
      const f = 523 * 2 ** (Math.min(streak, 24) / 24);
      tone(f, f, 0.45, 0.1, 0.06, 'square');
      tone(f * 1.5, f * 1.5, 0.53, 0.16, 0.05, 'square');
    },
    wrong: () => {
      tone(220, 110, 0.45, 0.45, 0.1, 'sawtooth');
      tone(165, 82, 0.5, 0.45, 0.06, 'square');
    },
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
