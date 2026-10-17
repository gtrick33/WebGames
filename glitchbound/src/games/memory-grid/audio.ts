/**
 * Tiny synthesized sound effects (no audio files). The AudioContext is created on the first sound, which is
 * always inside a user gesture, and closed by dispose() when the game unmounts.
 */

// A major pentatonic run, so any sequence of tiles sounds like a little tune.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

export interface Sfx {
  /** Create / resume the AudioContext. Call inside a user gesture (iOS only allows audio after one). */
  unlock(): void;
  tile(index: number): void;
  cleared(): void;
  wrong(): void;
  complete(): void;
  setMuted(m: boolean): void;
  dispose(): void;
}

export function createSfx(initiallyMuted: boolean): Sfx {
  let ctx: AudioContext | null = null;
  let muted = initiallyMuted;

  const audio = (): AudioContext | null => {
    if (muted) return null;
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  };

  const blip = (freq: number, at: number, dur: number, type: OscillatorType = 'triangle', vol = 0.18): void => {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  return {
    unlock: () => void audio(),
    tile: (i) => blip(NOTES[i % NOTES.length]! * (i >= NOTES.length ? 0.5 : 1), 0, 0.22),
    cleared: () => [0, 0.07, 0.14].forEach((d, k) => blip([1046.5, 1318.51, 1567.98][k]!, d, 0.18, 'sine', 0.14)),
    wrong: () => {
      blip(220, 0, 0.28, 'square', 0.08);
      blip(164.81, 0.09, 0.34, 'square', 0.07);
    },
    complete: () => [0, 0.09, 0.18, 0.27, 0.4].forEach((d, k) => blip([783.99, 1046.5, 1318.51, 1567.98, 2093][k]!, d, 0.26, 'sine', 0.14)),
    setMuted: (m) => {
      muted = m;
    },
    dispose: () => {
      const c = ctx;
      ctx = null;
      if (c && c.state !== 'closed') void c.close().catch(() => undefined);
    },
  };
}
