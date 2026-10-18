/**
 * Synthesised sounds (no audio files): a ratchet tick while resizing, a lock-in clunk, and a reveal
 * chime that rises with the score. The AudioContext is created on the first sound and closed by `dispose()`.
 */
export interface Sfx {
  tick(): void;
  lock(): void;
  reveal(points: number): void;
  over(): void;
  dispose(): void;
}

export function createSfx(isMuted: () => boolean): Sfx {
  let ctx: AudioContext | null = null;
  let lastTick = 0;
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
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  return {
    tick: () => {
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
      tone(1800, 1500, 0, 0.025, 0.02, 'square');
    },
    lock: () => {
      tone(220, 110, 0, 0.12, 0.09, 'triangle');
      tone(660, 660, 0.02, 0.05, 0.03, 'square');
    },
    reveal: (points) => {
      const notes = points >= 900 ? [784, 988, 1175, 1568] : points >= 700 ? [659, 784, 988] : points >= 450 ? [587, 698] : points >= 250 ? [523] : [330, 247];
      notes.forEach((f, i) => tone(f, f, i * 0.08, 0.16, 0.05, points >= 250 ? 'triangle' : 'sawtooth'));
    },
    over: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, i * 0.1, 0.22, 0.05, 'triangle')),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
