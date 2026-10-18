/**
 * Tiny synthesised sound effects (no audio files). The AudioContext is created on the first sound,
 * which always follows a tap, and closed by `dispose()` when the game unmounts.
 */
export interface Sfx {
  reveal(points: number): void;
  tick(): void;
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

  const note = (freq: number, at: number, dur: number, gain = 0.12, type: OscillatorType = 'triangle'): void => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  return {
    tick: () => note(880, 0, 0.06, 0.05, 'sine'),
    reveal(points) {
      // Better colours climb higher: a happy arpeggio for great guesses, a soft two-note shrug otherwise.
      const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const steps = points >= 980 ? 5 : points >= 900 ? 4 : points >= 750 ? 3 : points >= 550 ? 2 : 1;
      if (steps === 1) {
        note(392, 0, 0.18);
        note(330, 0.14, 0.26);
        return;
      }
      for (let i = 0; i < steps; i++) note(scale[i]!, i * 0.08, 0.22);
    },
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
