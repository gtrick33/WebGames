/**
 * Synthesised sounds (no audio files): a wooden click on placing, a rising sweep per line cleared,
 * a buzz when a piece does not fit and a falling tune at the end. The AudioContext is created on the
 * first sound (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  pick(): void;
  place(): void;
  clear(lines: number, streak: number): void;
  nope(): void;
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
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  return {
    pick: () => tone(520, 600, 0, 0.05, 0.03, 'triangle'),
    place: () => {
      tone(220, 160, 0, 0.07, 0.09, 'triangle');
      tone(900, 700, 0, 0.03, 0.03, 'square');
    },
    clear: (lines, streak) => {
      const base = 523 * 2 ** (Math.min(streak, 8) / 12);
      for (let i = 0; i < Math.min(lines + 2, 7); i++) tone(base * 2 ** ((i * 4) / 12), base * 2 ** ((i * 4 + 2) / 12), i * 0.05, 0.14, 0.05, 'square');
    },
    nope: () => tone(160, 120, 0, 0.12, 0.06, 'sawtooth'),
    over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, i * 0.13, 0.22, 0.06, 'triangle')),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
