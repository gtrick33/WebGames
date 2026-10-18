/**
 * Lobby music for the holiday looks (see platform/seasons.ts): one short loop per holiday, played
 * by the synth in platform/music.ts. Melodies are original, except two public-domain tunes: "Jingle
 * Bells" (1857) for the winter holidays and Grieg's "In the Hall of the Mountain King" (1875) for
 * Halloween. Notes are MIDI numbers (60 = middle C); each bar is eight eighth notes, null = rest.
 */
import type { HolidayId } from './seasons';

export type SongId = 'default' | HolidayId;

/** One bar: bass root, chord tones, and the lead's eight eighth notes. */
export type Bar = [bass: number, chord: number[], lead: (number | null)[]];

export interface Song {
  bpm: number;
  bars: Bar[];
  lead: 'pluck' | 'bell' | 'soft' | 'marimba' | 'sitar' | 'steel';
  bass: 'pulse' | 'oompah' | 'root' | 'drone' | 'reggae' | 'octaves';
  backing: 'musicbox' | 'stabs' | 'pad' | 'skank' | 'none';
  drums: 'spooky' | 'sleigh' | 'soft' | 'wood' | 'tabla' | 'onedrop' | 'pop';
}

const _ = null;
const C: [number, number[]] = [36, [60, 64, 67]];
const F: [number, number[]] = [41, [60, 65, 69]];
const G: [number, number[]] = [43, [59, 62, 67]];
const Am: [number, number[]] = [45, [57, 60, 64]];
const Em: [number, number[]] = [40, [59, 64, 67]];
const E: [number, number[]] = [40, [56, 59, 64]];
const Dm: [number, number[]] = [38, [57, 62, 65]];
const bar = (chord: [number, number[]], lead: (number | null)[]): Bar => [chord[0], chord[1], lead];

/** The holiday loops (the everyday tune is built into music.ts). */
export const SONGS: Record<HolidayId, Song> = {
  // A minor, pizzicato: the Mountain King theme, then a creeping answer over a music box.
  halloween: {
    bpm: 104,
    lead: 'pluck',
    bass: 'pulse',
    backing: 'musicbox',
    drums: 'spooky',
    bars: [
      bar(Am, [69, 71, 72, 74, 76, 72, 76, _]),
      bar(E, [75, 71, 75, _, 74, 70, 74, _]),
      bar(Am, [69, 71, 72, 74, 76, 72, 76, 81]),
      bar(C, [79, 76, 72, 76, 79, _, _, _]),
      bar(F, [_, _, _, _, _, _, _, _]),
      bar(Dm, [77, _, 76, _, 74, _, 72, _]),
      bar(E, [71, _, 68, _, 71, _, 74, _]),
      bar(Am, [69, _, _, _, _, _, _, _]),
    ],
  },
  // C major with sleigh bells: the "Jingle Bells" chorus on a celesta.
  winter: {
    bpm: 132,
    lead: 'bell',
    bass: 'oompah',
    backing: 'stabs',
    drums: 'sleigh',
    bars: [
      bar(C, [76, _, 76, _, 76, _, _, _]),
      bar(C, [76, _, 76, _, 76, _, _, _]),
      bar(C, [76, _, 79, _, 72, _, _, 74]),
      bar(C, [76, _, _, _, _, _, _, _]),
      bar(F, [77, _, 77, _, 77, _, 77, _]),
      bar(C, [77, _, 76, _, 76, _, 76, 76]),
      bar(G, [76, _, 74, _, 74, _, 76, _]),
      bar(G, [74, _, _, _, 79, _, _, _]),
    ],
  },
  // Slow and warm: soft electric piano over a I-iii-vi-IV.
  valentine: {
    bpm: 88,
    lead: 'soft',
    bass: 'root',
    backing: 'pad',
    drums: 'soft',
    bars: [
      bar(C, [76, _, 74, 72, 74, _, 76, _]),
      bar(Em, [79, _, 77, 76, 74, _, _, _]),
      bar(Am, [72, 74, 76, _, 77, 76, 74, _]),
      bar(F, [72, _, _, _, 69, _, 72, _]),
      bar(C, [76, _, 74, 72, 74, _, 79, _]),
      bar(Em, [79, _, 81, 79, 76, _, _, _]),
      bar(F, [77, 76, 74, _, 72, _, 74, _]),
      bar(G, [74, _, _, _, _, _, _, _]),
    ],
  },
  // Pentatonic plucked strings with wood blocks and a big drum.
  lunar: {
    bpm: 112,
    lead: 'pluck',
    bass: 'root',
    backing: 'none',
    drums: 'wood',
    bars: [
      bar(C, [76, 79, 81, _, 79, 76, 74, _]),
      bar(Am, [72, 74, 76, 79, 76, _, 74, 72]),
      bar([43, [55, 62, 67]], [74, _, 72, 74, 76, _, 79, _]),
      bar(C, [72, _, _, _, 67, _, 69, 72]),
      bar(Am, [81, _, 79, 76, 79, _, 81, 84]),
      bar([38, [62, 64, 69]], [81, _, 79, _, 76, _, 74, _]),
      bar([43, [55, 62, 67]], [74, 76, 79, _, 76, 74, 72, _]),
      bar(C, [72, _, _, _, _, _, _, _]),
    ],
  },
  // Bouncy marimba hops.
  easter: {
    bpm: 124,
    lead: 'marimba',
    bass: 'octaves',
    backing: 'stabs',
    drums: 'pop',
    bars: [
      bar(C, [72, 76, 79, 76, 72, _, 79, _]),
      bar(F, [77, 81, 84, 81, 77, _, 81, _]),
      bar(G, [79, 77, 76, 74, 72, _, 74, _]),
      bar(C, [76, _, 72, _, 72, _, _, _]),
      bar(Am, [69, 72, 76, 72, 69, _, 76, _]),
      bar(F, [77, 76, 74, 72, 74, _, 77, _]),
      bar(G, [79, _, 77, _, 76, _, 74, _]),
      bar(C, [72, _, _, _, _, _, _, _]),
    ],
  },
  // A drone, a sliding sitar-like lead and tabla-style drums.
  diwali: {
    bpm: 100,
    lead: 'sitar',
    bass: 'drone',
    backing: 'none',
    drums: 'tabla',
    bars: [
      bar(Am, [69, 72, 74, 76, 74, 72, 69, _]),
      bar([43, [55, 59, 62]], [67, _, 69, 72, 74, _, 72, _]),
      bar(Am, [76, _, 79, 76, 74, _, 72, 74]),
      bar([40, [55, 59, 64]], [76, _, _, _, 74, 72, 71, _]),
      bar(Am, [81, 79, 76, 74, 76, _, _, _]),
      bar(Dm, [77, 76, 74, 72, 74, _, 77, _]),
      bar([43, [55, 59, 62]], [74, _, 72, _, 71, _, 67, _]),
      bar(Am, [69, _, _, _, _, _, _, _]),
    ],
  },
  // Steel drums on a laid-back offbeat groove.
  summer: {
    bpm: 100,
    lead: 'steel',
    bass: 'reggae',
    backing: 'skank',
    drums: 'onedrop',
    bars: [
      bar(C, [79, _, 76, 79, 81, _, 79, _]),
      bar(G, [79, _, 74, 76, 74, _, _, _]),
      bar(Am, [72, 74, 76, 79, 81, 79, 76, _]),
      bar(F, [77, _, 76, _, 72, _, _, _]),
      bar(C, [79, _, 76, 79, 84, _, 81, _]),
      bar(G, [79, _, 74, 76, 79, _, _, _]),
      bar(Am, [81, 79, 76, _, 79, 76, 72, _]),
      bar(F, [74, _, 72, _, 72, _, _, _]),
    ],
  },
};

/** The synth voices a loop plays with (provided by platform/music.ts). */
export interface SongSynth {
  tone(freq: number, t: number, dur: number, opts: { type?: OscillatorType; gain: number; attack: number; release: number; cutoff?: number; detune?: number; wet?: number; glide?: number }): void;
  drum(t: number, from: number, to: number, gain: number, len: number, wet?: number): void;
  noiseHit(t: number, freq: number, gain: number, len: number, type?: BiquadFilterType, wet?: number): void;
  hat(t: number, gain: number): void;
  kick(t: number): void;
  snare(t: number): void;
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

function leadNote(s: SongSynth, voice: Song['lead'], f: number, t: number, len: number): void {
  switch (voice) {
    case 'pluck':
      s.tone(f, t, len * 0.35, { type: 'triangle', gain: 0.065, attack: 0.002, release: 0.18, cutoff: 2800, wet: 0.3, glide: 0.985 });
      s.tone(f * 2, t, len * 0.2, { type: 'sine', gain: 0.012, attack: 0.002, release: 0.08, wet: 0.2 });
      break;
    case 'bell':
      s.tone(f, t, len * 0.5, { type: 'sine', gain: 0.05, attack: 0.002, release: 0.6, wet: 0.35 });
      s.tone(f * 2, t, len * 0.3, { type: 'sine', gain: 0.014, attack: 0.002, release: 0.35, wet: 0.3 });
      s.tone(f * 3.01, t, len * 0.2, { type: 'sine', gain: 0.006, attack: 0.002, release: 0.2, wet: 0.3 });
      break;
    case 'soft':
      s.tone(f, t, len * 0.95, { type: 'sine', gain: 0.055, attack: 0.03, release: 0.35, wet: 0.45 });
      s.tone(f, t, len * 0.6, { type: 'triangle', gain: 0.012, attack: 0.02, release: 0.2, wet: 0.4, detune: 6 });
      break;
    case 'marimba':
      s.tone(f, t, len * 0.25, { type: 'sine', gain: 0.07, attack: 0.002, release: 0.16, wet: 0.2 });
      s.tone(f * 4, t, len * 0.1, { type: 'sine', gain: 0.01, attack: 0.001, release: 0.05, wet: 0.1 });
      break;
    case 'sitar':
      s.tone(f, t, len * 0.9, { type: 'sawtooth', gain: 0.022, attack: 0.004, release: 0.25, cutoff: 2200, wet: 0.3, glide: 0.95 });
      s.tone(f * 2, t, len * 0.4, { type: 'sine', gain: 0.01, attack: 0.004, release: 0.15, wet: 0.3 });
      break;
    case 'steel':
      s.tone(f, t, len * 0.45, { type: 'sine', gain: 0.06, attack: 0.003, release: 0.3, wet: 0.25 });
      s.tone(f * 2.76, t, len * 0.15, { type: 'sine', gain: 0.012, attack: 0.002, release: 0.08, wet: 0.2 });
      break;
  }
}

/** One bar of a holiday loop: bass, backing, lead and drums in the song's own style. */
export function playSongBar(s: SongSynth, t: number, n: number, song: Song): void {
  const beat = 60 / song.bpm;
  const e = beat / 2;
  const [root, chord, lead] = song.bars[n % song.bars.length]!;
  switch (song.bass) {
    case 'pulse':
      for (let i = 0; i < 4; i++) s.tone(hz(root + (i === 3 ? 12 : 0)), t + i * beat, beat * 0.8, { type: 'sawtooth', gain: 0.03, attack: 0.01, release: 0.1, cutoff: 520, wet: 0.1 });
      break;
    case 'oompah':
      for (let i = 0; i < 4; i++) s.tone(hz(root + (i % 2 ? 7 : 0)), t + i * beat, beat * 0.55, { type: 'triangle', gain: 0.07, attack: 0.005, release: 0.08, wet: 0.05 });
      break;
    case 'root':
      for (let i = 0; i < 2; i++) s.tone(hz(root + 12), t + i * beat * 2, beat * 1.8, { type: 'sine', gain: 0.08, attack: 0.02, release: 0.25, wet: 0.1 });
      break;
    case 'drone':
      s.tone(hz(root), t, beat * 4, { type: 'sawtooth', gain: 0.016, attack: 0.3, release: 0.4, cutoff: 420, wet: 0.2 });
      s.tone(hz(root + 7), t, beat * 4, { type: 'sawtooth', gain: 0.012, attack: 0.3, release: 0.4, cutoff: 420, wet: 0.2 });
      break;
    case 'reggae':
      s.tone(hz(root + 12), t, beat * 1.4, { type: 'triangle', gain: 0.08, attack: 0.01, release: 0.12, wet: 0.05 });
      s.tone(hz(root + 19), t + beat * 2.5, e, { type: 'triangle', gain: 0.06, attack: 0.01, release: 0.1, wet: 0.05 });
      s.tone(hz(root + 12), t + beat * 3, beat * 0.9, { type: 'triangle', gain: 0.07, attack: 0.01, release: 0.12, wet: 0.05 });
      break;
    case 'octaves':
      for (let i = 0; i < 8; i++) s.tone(hz(root + (i % 2 ? 12 : 0)), t + i * e, e * 0.7, { type: 'square', gain: 0.03, attack: 0.005, release: 0.05, cutoff: 900, wet: 0 });
      break;
  }
  switch (song.backing) {
    case 'musicbox': {
      const box = [...chord].reverse().map((m) => m + 24);
      for (let i = 0; i < 8; i++) s.tone(hz(box[i % box.length]!), t + i * e, e * 0.3, { type: 'sine', gain: 0.012, attack: 0.002, release: 0.35, wet: 0.5 });
      break;
    }
    case 'stabs':
      for (const at of [1, 3]) for (const m of chord) s.tone(hz(m + 12), t + at * beat, e * 0.6, { type: 'triangle', gain: 0.01, attack: 0.004, release: 0.08, wet: 0.2 });
      break;
    case 'pad':
      for (const m of chord) s.tone(hz(m), t, beat * 3.8, { type: 'triangle', gain: 0.012, attack: 0.25, release: 0.5, wet: 0.5 });
      break;
    case 'skank':
      for (let i = 1; i < 8; i += 2) for (const m of chord) s.tone(hz(m + 12), t + i * e, e * 0.35, { type: 'square', gain: 0.006, attack: 0.002, release: 0.04, cutoff: 1900, wet: 0.15 });
      break;
    case 'none':
      break;
  }
  lead.forEach((m, i) => {
    if (m !== null) leadNote(s, song.lead, hz(m), t + i * e, e);
  });
  switch (song.drums) {
    case 'spooky':
      s.drum(t, 110, 42, 0.28, 0.35);
      s.drum(t + beat * 2, 110, 42, 0.2, 0.35);
      s.noiseHit(t + beat * 3, 1400, 0.05, 0.25, 'bandpass', 0.6);
      // A church bell every four bars.
      if (n % 4 === 0) {
        s.tone(hz(43 + 12), t, beat * 2, { type: 'sine', gain: 0.05, attack: 0.002, release: 2.4, wet: 0.7 });
        s.tone(hz(43 + 12) * 2.41, t, beat, { type: 'sine', gain: 0.015, attack: 0.002, release: 1.4, wet: 0.7 });
      }
      break;
    case 'sleigh':
      s.kick(t);
      s.kick(t + beat * 2);
      s.noiseHit(t + beat, 1900, 0.06, 0.12);
      s.noiseHit(t + beat * 3, 1900, 0.06, 0.12);
      for (let i = 0; i < 8; i++) s.noiseHit(t + i * e, 9000, i % 2 ? 0.02 : 0.035, 0.07, 'bandpass', 0.15);
      break;
    case 'soft':
      s.drum(t, 120, 50, 0.16, 0.2, 0);
      s.noiseHit(t + beat, 3200, 0.02, 0.03, 'highpass', 0.3);
      s.noiseHit(t + beat * 3, 3200, 0.02, 0.03, 'highpass', 0.3);
      break;
    case 'wood':
      s.drum(t, 90, 55, 0.3, 0.45, 0.2);
      for (let i = 0; i < 4; i++) s.drum(t + i * beat + (i % 2 ? e : 0), i % 2 ? 820 : 1050, i % 2 ? 790 : 1000, 0.05, 0.05, 0.1);
      s.noiseHit(t + beat * 3, 7000, 0.015, 0.4, 'highpass', 0.3);
      break;
    case 'tabla': {
      const pattern = ['dha', 'na', 'na', 'tin', 'dha', 'na', 'tin', 'na'];
      pattern.forEach((p, i) => {
        if (p === 'dha') s.drum(t + i * e, 170, 95, 0.22, 0.28, 0.1);
        if (p !== 'dha') s.drum(t + i * e, p === 'tin' ? 520 : 380, p === 'tin' ? 500 : 340, 0.06, 0.09, 0.1);
      });
      break;
    }
    case 'onedrop':
      s.kick(t + beat * 2);
      s.noiseHit(t + beat * 2, 2600, 0.05, 0.06, 'bandpass', 0.3);
      for (let i = 0; i < 8; i++) s.hat(t + i * e, i % 2 ? 0.01 : 0.016);
      break;
    case 'pop':
      s.kick(t);
      s.kick(t + beat * 2);
      s.snare(t + beat);
      s.snare(t + beat * 3);
      for (let i = 0; i < 8; i++) s.hat(t + i * e, i % 2 ? 0.012 : 0.02);
      break;
  }
}
