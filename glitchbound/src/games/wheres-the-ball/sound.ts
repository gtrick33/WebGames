/**
 * Synthesised sounds (no audio files): a soft aim click, a racquet "pock" with a little crowd cheer
 * for a find, and short cues for wrong guesses. The AudioContext is created on the first sound
 * (always after a tap) and closed by `dispose()`.
 */
export interface Sfx {
  aim(): void;
  found(): void;
  wrong(heat: 'hot' | 'warm' | 'cold'): void;
  missed(): void;
  hint(): void;
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
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  /** A burst of filtered noise (crowd "ahh" / racquet thud). */
  const noise = (at: number, dur: number, gain: number, freq: number): void => {
    const c = audio();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + at);
  };
  return {
    aim: () => tone(1400, 1300, 0, 0.05, 0.03),
    found() {
      tone(900, 300, 0, 0.08, 0.14, 'triangle');
      noise(0, 0.06, 0.4, 1800);
      noise(0.12, 0.9, 0.12, 900);
      [659, 784, 1047].forEach((f, i) => tone(f, f, 0.15 + i * 0.08, 0.2, 0.06, 'triangle'));
    },
    wrong(heat) {
      const f = heat === 'hot' ? 520 : heat === 'warm' ? 380 : 240;
      tone(f, f * 0.8, 0, 0.18, 0.07, 'triangle');
    },
    missed: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, i * 0.14, 0.22, 0.07, 'triangle')),
    hint: () => tone(660, 990, 0, 0.2, 0.05, 'triangle'),
    dispose() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
