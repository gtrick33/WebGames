/**
 * Synthesised sounds (no audio files): a question blip, a bright "yep" and a low "nope", a cross-out tick,
 * and a fanfare (or a deflated slide) at the reveal. The AudioContext starts on the first sound (always
 * after a tap) and closes in `dispose()`.
 */
export interface Sfx {
  ask(): void;
  yep(): void;
  nope(): void;
  tick(): void;
  win(): void;
  lose(): void;
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
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  return {
    ask: () => tone(520, 760, 0, 0.08, 0.04, 'triangle'),
    yep: () => {
      tone(660, 660, 0.12, 0.14, 0.06, 'triangle');
      tone(990, 990, 0.24, 0.22, 0.06, 'triangle');
    },
    nope: () => {
      tone(330, 330, 0.12, 0.14, 0.06, 'square');
      tone(220, 200, 0.24, 0.26, 0.06, 'square');
    },
    tick: () => tone(1200, 900, 0, 0.04, 0.03, 'triangle'),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, i * 0.08, 0.24, 0.05, 'square')),
    lose: () => tone(392, 196, 0, 0.5, 0.06, 'triangle'),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
