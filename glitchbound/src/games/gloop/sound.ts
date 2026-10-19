/**
 * Synthesised sounds (no audio files): a soft plop on dropping, a bubbly pop per merge that rises
 * with the blob's size, a fanfare for the biggest pair and a sad slide at the end. The AudioContext
 * is created on the first sound (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  drop(): void;
  merge(tier: number): void;
  top(): void;
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
    drop: () => tone(260, 180, 0, 0.09, 0.07, 'sine'),
    merge: (tier) => {
      const f = 330 * 2 ** (tier / 6);
      tone(f * 0.6, f * 1.4, 0, 0.12, 0.09, 'sine');
      tone(f * 1.5, f * 2, 0.05, 0.1, 0.04, 'triangle');
    },
    top: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, i * 0.08, 0.2, 0.06, 'square')),
    over: () => tone(440, 110, 0, 0.9, 0.08, 'triangle'),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
