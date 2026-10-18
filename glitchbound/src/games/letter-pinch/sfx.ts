/**
 * Tiny synthesized sound effects (no audio files). The AudioContext is created on the first sound,
 * which always follows a key press, and closed by `close()` when the game unmounts.
 */
export interface Sfx {
  key(): void;
  reveal(i: number, kind: 'up' | 'down' | 'hit'): void;
  bump(): void;
  win(): void;
  lose(): void;
  close(): void;
  setMuted(muted: boolean): void;
}

export function createSfx(muted: boolean): Sfx {
  let ctx: AudioContext | null = null;

  const tone = (freq: number, at: number, dur: number, type: OscillatorType = 'triangle', gain = 0.08): void => {
    if (muted) return;
    try {
      ctx ??= new AudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const t = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      /* audio unavailable */
    }
  };

  const sfx: Sfx = {
    setMuted: (m) => {
      muted = m;
    },
    key: () => tone(720, 0, 0.05, 'sine', 0.04),
    reveal: (i, kind) => {
      const base = kind === 'hit' ? 660 : kind === 'up' ? 520 : 390;
      tone(base * (1 + i * 0.06), i * 0.12, 0.12, kind === 'hit' ? 'triangle' : 'sine', 0.06);
    },
    bump: () => tone(150, 0, 0.14, 'square', 0.04),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.65 + i * 0.09, 0.22)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.65 + i * 0.14, 0.25, 'sine')),
    close: () => {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
  return sfx;
}
