/**
 * Synthesised sounds (no audio files): a hop, a soft landing, a gem chime, a spring boing, a lever clunk, a
 * gate slide, a pop for a lost pal, a switch blip and a little fanfare for a cleared level. The AudioContext
 * is created on the first sound (always after a key press or a tap) and closed by `dispose()`.
 */
export interface Sfx {
  jump(): void;
  land(): void;
  gem(): void;
  spring(): void;
  lever(): void;
  gate(open: boolean): void;
  pop(): void;
  swap(): void;
  clear(): void;
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
    jump: () => tone(380, 720, 0, 0.11, 0.045, 'triangle'),
    land: () => tone(160, 90, 0, 0.07, 0.04, 'sine'),
    gem: () => [1319, 1760, 2349].forEach((f, i) => tone(f, f * 1.01, i * 0.05, 0.14, 0.04, 'triangle')),
    spring: () => {
      tone(220, 880, 0, 0.18, 0.06, 'sine');
      tone(330, 1100, 0.02, 0.16, 0.03, 'triangle');
    },
    lever: () => {
      tone(180, 120, 0, 0.06, 0.07, 'square');
      tone(520, 520, 0.05, 0.05, 0.03, 'square');
    },
    gate: (open) => tone(open ? 300 : 500, open ? 600 : 250, 0, 0.12, 0.03, 'sawtooth'),
    pop: () => {
      tone(700, 140, 0, 0.25, 0.08, 'triangle');
      tone(300, 60, 0.04, 0.3, 0.05, 'sine');
    },
    swap: () => tone(660, 990, 0, 0.06, 0.035, 'sine'),
    clear: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, i * 0.09, 0.22, 0.05, 'triangle')),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
