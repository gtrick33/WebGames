/**
 * Synthesised sounds (no audio files): a picker click, the Fussbox's happy ding and grumpy buzz, an exam
 * tick, and a little fanfare (or a deflated slide) at the reveal. The AudioContext is created on the first
 * sound (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  click(): void;
  ding(): void;
  buzz(): void;
  mark(): void;
  fanfare(): void;
  meh(): void;
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
    click: () => tone(900, 700, 0, 0.04, 0.03, 'triangle'),
    ding: () => {
      tone(1046, 1046, 0, 0.18, 0.06, 'sine');
      tone(1568, 1568, 0.08, 0.3, 0.05, 'sine');
    },
    buzz: () => {
      tone(140, 110, 0, 0.28, 0.08, 'sawtooth');
      tone(147, 116, 0, 0.28, 0.05, 'square');
    },
    mark: () => tone(620, 820, 0, 0.06, 0.04, 'triangle'),
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, i * 0.09, 0.22, 0.05, 'square')),
    meh: () => tone(440, 220, 0, 0.45, 0.06, 'triangle'),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
