/**
 * Synthesised sounds (no audio files): a soft tick for a ✕, a twinkle for a star, a clunk when a
 * star breaks a rule and a sparkly run for a solved grid. The AudioContext is created on the first
 * sound (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  mark(): void;
  star(): void;
  clash(): void;
  solved(): void;
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
    mark: () => tone(700, 600, 0, 0.04, 0.03, 'triangle'),
    star: () => {
      tone(1319, 1319, 0, 0.08, 0.04, 'sine');
      tone(1760, 1760, 0.05, 0.12, 0.035, 'sine');
    },
    clash: () => tone(180, 120, 0, 0.15, 0.08, 'square'),
    solved: () => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, f, i * 0.06, 0.2, 0.045, 'triangle')),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
