/**
 * Synthesised sounds (no audio files): a soft flap, a point chime, a feather sparkle and a bonk.
 * The AudioContext is created on the first sound (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  flap(): void;
  point(): void;
  feather(): void;
  crash(): void;
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
    flap: () => tone(420, 640, 0, 0.08, 0.05, 'triangle'),
    point: () => {
      tone(880, 880, 0, 0.07, 0.05, 'square');
      tone(1320, 1320, 0.06, 0.1, 0.04, 'square');
    },
    feather: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, f, i * 0.05, 0.12, 0.04, 'triangle')),
    crash: () => {
      tone(300, 60, 0, 0.35, 0.12, 'sawtooth');
      tone(160, 50, 0.05, 0.4, 0.08, 'square');
    },
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
