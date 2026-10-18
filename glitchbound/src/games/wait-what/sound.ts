/**
 * The quiz's sound questions: a tiny chiptune synth for "Name that tune" and a Morse code beeper.
 * Everything is generated with Web Audio, so there are no sound files to download.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const NOTE = /^([A-G])(#|b)?(-?\d)$/;
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a note name like "C#4" (A4 = 440 Hz), or null for a rest / unknown. */
export function freq(name: string): number | null {
  const m = NOTE.exec(name);
  if (!m) return null;
  const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

/** "E4:1.5 R:0.5 D4" → [[note, beats], …] (beats default to 1). */
export function parseNotes(notes: string): [string, number][] {
  return notes
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [n, b] = tok.split(':');
      return [n!, b ? Number(b) : 1];
    });
}

/** Seconds a melody lasts. */
export const melodyLength = (notes: string, bpm: number): number => (parseNotes(notes).reduce((s, [, b]) => s + b, 0) * 60) / bpm;

type Beep = { at: number; dur: number; hz: number };

/** Plays beeps with a soft attack and release; returns a function that stops them. */
function play(beeps: Beep[], wave: OscillatorType, volume: number): () => void {
  const ac = audio();
  if (!ac) return () => undefined;
  const t0 = ac.currentTime + 0.06;
  const out = ac.createGain();
  out.gain.value = volume;
  out.connect(ac.destination);
  for (const b of beeps) {
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = wave;
    osc.frequency.value = b.hz;
    const start = t0 + b.at;
    const end = start + Math.max(0.05, b.dur);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(1, start + 0.012);
    env.gain.setValueAtTime(1, Math.max(start + 0.012, end - 0.04));
    env.gain.linearRampToValueAtTime(0, end);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
  }
  return () => {
    try {
      out.gain.cancelScheduledValues(ac.currentTime);
      out.gain.setValueAtTime(0, ac.currentTime);
      out.disconnect();
    } catch {
      /* already stopped */
    }
  };
}

/** Plays a melody in the tune's tempo (notes slightly detached, like a music box). */
export function playTune(notes: string, bpm: number, spooky = false): () => void {
  const beat = 60 / bpm;
  let at = 0;
  const beeps: Beep[] = [];
  for (const [n, b] of parseNotes(notes)) {
    const hz = freq(n);
    if (hz) beeps.push({ at, dur: b * beat * 0.88, hz });
    at += b * beat;
  }
  return play(beeps, spooky ? 'sawtooth' : 'square', spooky ? 0.07 : 0.08);
}

export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

/** A word in Morse, letters separated by spaces: "SOS" → "··· −−− ···". */
export const morseText = (word: string): string =>
  [...word.toUpperCase()]
    .map((ch) => MORSE[ch] ?? '')
    .join(' ')
    .replace(/\./g, '·')
    .replace(/-/g, '−');

/** Plays a word in Morse code at a gentle speed (dot = 0.11 s). */
export function playMorse(word: string): () => void {
  const dot = 0.11;
  let at = 0;
  const beeps: Beep[] = [];
  for (const ch of word.toUpperCase()) {
    for (const s of MORSE[ch] ?? '') {
      const dur = s === '.' ? dot : dot * 3;
      beeps.push({ at, dur, hz: 660 });
      at += dur + dot;
    }
    at += dot * 2;
  }
  return play(beeps, 'sine', 0.18);
}
