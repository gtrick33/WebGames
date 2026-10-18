/**
 * Synthesised sounds (no audio files): glass clinks, a glugging pour, and short jingles for a solved
 * or failed puzzle. The AudioContext is created on the first sound (always after a tap) and closed
 * by `dispose()`.
 */
export interface Sfx {
  lift(): void;
  nope(): void;
  pour(units: number): void;
  undo(): void;
  win(): void;
  fail(): void;
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
    lift: () => tone(1800, 1750, 0, 0.12, 0.04),
    nope: () => tone(220, 180, 0, 0.14, 0.06, 'square'),
    pour(units) {
      // One rising "bloop" per layer poured: liquid filling glass.
      const base = 240 + Math.random() * 40;
      for (let i = 0; i < Math.min(6, units) + 1; i++) tone(base * (1 + i * 0.16), base * (1.5 + i * 0.18), i * 0.06, 0.09, 0.07);
    },
    undo: () => tone(520, 300, 0, 0.12, 0.05, 'triangle'),
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f * 1.01, i * 0.09, 0.26, 0.1, 'triangle'));
    },
    fail() {
      tone(392, 380, 0, 0.2, 0.09, 'triangle');
      tone(311, 300, 0.16, 0.3, 0.09, 'triangle');
    },
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
