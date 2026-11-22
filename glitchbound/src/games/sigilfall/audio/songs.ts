import type { MusicTrack } from '../data/types';

/**
 * The score: a song for every land, written as notes, and how each one is played (audio/score.ts plays them).
 * The owner asked for lands that feel different, some of them frightening, each with music of its own. So a
 * home village is a waltz on a soft flute, the capital a march, a desert a drone under an oud, a fen a held
 * low note with frogs and dripping water under a wavering flute, the haunted wood a music box over owls and
 * wolves, a barrow a funeral drum and a bell. Everything is synthesized, like the rest of Sigilfall's sound.
 *
 * A song is written as:
 * - `chords`: one per bar, as note names ('D3 F#3 A3'); the bass plays its lowest note unless a root is
 *   named first ('C: G3 C4 E4' is C under a G-shaped chord);
 * - `scale` and `melody`: the melody is degrees of the scale, one per eighth note, `-` holding the note
 *   before and `.` a rest, bars split by `|` (six eighths to a bar in three-four, eight in four-four);
 * - how it's played: the lead's sound, the bass and accompaniment patterns, the drums (a letter per
 *   sixteenth: `k` kick, `s` snare, `h` hat, `K` kick and hat, `x` kick and snare, `t` and `T` low and high
 *   toms), a pad (`choir` voices it as slow, detuned voices), a drone under everything, wind, distant bells,
 *   the land's creatures, and how much echo.
 */

export type Env = 'plain' | 'pluck' | 'flute' | 'bow' | 'bell';
export type BassStyle = 'beat' | 'half' | 'oom' | 'walk' | 'pulse' | 'none';
export type ArpStyle = 'up' | 'broken' | 'harp' | 'strum' | 'pah' | 'pulse' | 'none';
export type Call = 'owl' | 'crow' | 'frog' | 'wolf' | 'drip' | 'gull' | 'bird' | 'cricket';

/** The Ring's arenas, each with a piece of its own (audio/tracks.ts RING_MUSIC). */
export type RingSong = 'ring-sands' | 'ring-frost' | 'ring-forge';
export type SongId = MusicTrack | 'boss' | 'title' | RingSong;

interface SongDef {
  bpm: number;
  meter?: 3 | 4;
  chords: string[];
  scale: string;
  melody: string;
  lead: { wave: OscillatorType; env: Env; detune?: number };
  bass?: BassStyle;
  arp?: ArpStyle;
  drums?: string;
  pad?: number;
  choir?: boolean;
  drone?: string;
  wind?: number;
  /** Chance a bar has a distant bell in it. */
  bells?: number;
  calls?: Call[];
  /** Chance a bar has one of the land's creatures in it. */
  callRate?: number;
  echo?: number;
  /** The melody sounds every nth time round (the rest is the bed alone: the darkest songs breathe). */
  every?: number;
  /** Loudness against the others (measured, so the lands sit at one level). */
  level?: number;
}

/** A melody note: its pitch and how many eighths it lasts. */
export interface MelodyNote {
  n: number;
  len: number;
}

export interface Song {
  bpm: number;
  meter: 3 | 4;
  chords: number[][];
  bass: number[];
  scale: number[];
  /** Per eighth note: the note that starts there, or null. */
  melody: (MelodyNote | null)[];
  lead: { wave: OscillatorType; env: Env; detune: number };
  bassStyle: BassStyle;
  arp: ArpStyle;
  drums: string | null;
  pad: number;
  choir: boolean;
  drone: number | null;
  wind: number;
  bells: number;
  calls: Call[];
  callRate: number;
  echo: number;
  every: number;
  level: number;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'F#3' → 54 (MIDI). */
export function note(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const notes = (s: string): number[] => s.trim().split(/\s+/).map(note);

export function parseSong(d: SongDef): Song {
  const meter = d.meter ?? 4;
  const bass: number[] = [];
  const chords = d.chords.map((c) => {
    const [root, body] = c.includes(':') ? (c.split(':') as [string, string]) : [null, c];
    const ns = notes(body);
    // the bass in its second octave (C2 to B2)
    const pc = root ? PC[root.trim()[0]!]! + (root.includes('#') ? 1 : root.includes('b') ? -1 : 0) : Math.min(...ns) % 12;
    bass.push(36 + ((pc + 12) % 12));
    return ns;
  });
  const scale = notes(d.scale);
  const tokens = d.melody.split('|').flatMap((bar) => bar.trim().split(/\s+/));
  const melody: (MelodyNote | null)[] = tokens.map(() => null);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === '.' || t === '-') continue;
    let len = 1;
    while (tokens[i + len] === '-') len++;
    melody[i] = { n: scale[Number(t)]!, len };
  }
  return {
    bpm: d.bpm,
    meter,
    chords,
    bass,
    scale,
    melody,
    lead: { wave: d.lead.wave, env: d.lead.env, detune: d.lead.detune ?? 0 },
    bassStyle: d.bass ?? 'beat',
    arp: d.arp ?? 'up',
    drums: d.drums ?? null,
    pad: d.pad ?? 0,
    choir: !!d.choir,
    drone: d.drone ? note(d.drone) : null,
    wind: d.wind ?? 0,
    bells: d.bells ?? 0,
    calls: d.calls ?? [],
    callRate: d.callRate ?? 0.25,
    echo: d.echo ?? 0.12,
    every: d.every ?? 1,
    level: d.level ?? 1,
  };
}

export const SONG_DEFS: Record<Exclude<SongId, RingSong>, SongDef> = {
  /* ------------------------------------------------------------ the menus and the fights */
  title: {
    bpm: 84,
    chords: ['A3 C4 E4', 'F3 A3 C4', 'G3 B3 D4', 'E3 G3 B3'],
    scale: 'A4 B4 C5 D5 E5 G5 A5',
    melody: '4 - 3 - 2 - 0 - | 1 - 2 3 2 - - -',
    lead: { wave: 'triangle', env: 'flute' },
    bass: 'half',
    pad: 0.6,
    echo: 0.25,
  },
  boss: {
    bpm: 148,
    chords: ['E3 G3 B3', 'E3 G3 B3', 'G3 A#3 D4', 'D3 F3 A3'],
    scale: 'E4 F#4 G4 A4 B4 C5 D5',
    melody: '0 0 3 0 4 3 0 . | 0 0 5 4 3 - 2 - | 0 0 3 0 4 3 5 - | 6 5 4 3 2 - 1 -',
    lead: { wave: 'sawtooth', env: 'plain' },
    bass: 'pulse',
    drums: 'K.h.x.h.K.K.x.hh',
    pad: 0.25,
    level: 1.14,
  },
  // the night a place is raided or burns: a driving minor march
  siege: {
    bpm: 132,
    chords: ['D3 F3 A3', 'D3 F3 A3', 'Bb2 D3 F3', 'C3 E3 G3', 'D3 F3 A3', 'D3 F3 A3', 'Bb2 D3 F3', 'A2 C#3 E3'],
    scale: 'A4 C5 D5 E5 F5 G5 A5',
    melody: '2 - 2 2 3 - 4 - | 4 - 3 - 2 - - - | 4 - 4 4 5 - 6 - | 5 - 3 - 1 - - - | 6 - 6 5 4 - 2 - | 4 - 3 - 2 - - - | 4 - 5 - 6 - 5 4 | 3 - - - 0 - - -',
    lead: { wave: 'sawtooth', env: 'plain' },
    bass: 'pulse',
    arp: 'none',
    drums: 'K.s.K.s.KKs.K.ss',
    pad: 0.25,
    level: 1.19,
  },

  /* ------------------------------------------------------------ the towns, and indoors */
  // Emberwick, the Crown City: a proud march in D
  emberwick: {
    bpm: 96,
    chords: ['D3 F#3 A3', 'A3 C#4 E4', 'B3 D4 F#4', 'G3 B3 D4', 'D3 F#3 A3', 'G3 B3 D4', 'A3 C#4 E4', 'D3 F#3 A3'],
    scale: 'D5 E5 F#5 G5 A5 B5 C#6 D6',
    melody: '0 - 2 - 4 - 4 3 | 4 - 1 - 2 - . . | 5 - 4 3 2 - 3 4 | 3 - 2 1 3 - . . | 4 - 5 4 7 - 6 5 | 3 - 5 - 4 3 2 1 | 1 2 3 4 4 - 6 - | 7 - - - . . . .',
    lead: { wave: 'square', env: 'plain' },
    bass: 'half',
    arp: 'strum',
    drums: 'K...x...K.K.x..x',
    pad: 0.35,
    echo: 0.15,
  },
  // Briarhollow, home: a waltz in G on a soft flute, birds in the hedges
  briarhollow: {
    bpm: 92,
    meter: 3,
    chords: ['G3 B3 D4', 'D3 F#3 A3', 'E3 G3 B3', 'C3 E3 G3', 'G3 B3 D4', 'A3 C4 E4', 'D3 F#3 A3', 'G3 B3 D4'],
    scale: 'G4 A4 B4 C5 D5 E5 F#5 G5 A5 B5',
    melody: '4 - 2 - 4 5 | 6 - 4 - 1 - | 5 - 4 - 2 - | 3 - - - . . | 2 - 4 - 7 - | 8 - 7 - 5 - | 6 - 4 5 6 - | 7 - - - . .',
    lead: { wave: 'triangle', env: 'flute' },
    bass: 'oom',
    arp: 'pah',
    pad: 0.25,
    calls: ['bird'],
    callRate: 0.2,
    level: 1.12,
  },
  // the old village tune (Vaelmoor remembered)
  village: {
    bpm: 100,
    chords: ['C4 E4 G4', 'G: B3 D4 G4', 'A3 C4 E4', 'F: A3 C4 F4'],
    scale: 'C5 D5 E5 F5 G5 A5 C6',
    melody: '0 2 4 . 5 4 2 . | 3 . 2 0 1 - - - | 4 . 5 4 2 . 0 1 | 2 - 1 - 0 - - -',
    lead: { wave: 'square', env: 'plain' },
    drums: 'K...s...K...s...',
    pad: 0.3,
    level: 1.27,
  },
  // an inn or a forge: a jig
  tavern: {
    bpm: 132,
    meter: 3,
    chords: ['D3 F#3 A3', 'G3 B3 D4', 'D3 F#3 A3', 'A3 C#4 E4', 'D3 F#3 A3', 'G3 B3 D4', 'A3 C#4 E4', 'D3 F#3 A3'],
    scale: 'A4 B4 C#5 D5 E5 F#5 G5 A5 B5',
    melody: '3 4 5 3 5 7 | 8 7 6 5 6 8 | 7 5 3 5 7 5 | 4 - 2 0 2 4 | 3 5 7 8 7 5 | 6 5 6 8 - 6 | 4 6 4 2 4 6 | 3 - - 3 - -',
    lead: { wave: 'square', env: 'pluck' },
    bass: 'oom',
    arp: 'pah',
    drums: 'K.h.h.k.h.h.',
    echo: 0.08,
    level: 1.26,
  },
  // the Chapel of the Bell: a slow hymn under a choir
  chapel: {
    bpm: 60,
    chords: ['F3 A3 C4', 'C3 E3 G3', 'D3 F3 A3', 'Bb2 D3 F3', 'F3 A3 C4', 'Bb2 D3 F3', 'C3 E3 G3', 'F3 A3 C4'],
    scale: 'C5 D5 E5 F5 G5 A5 Bb5 C6',
    melody: '5 - - - 3 - - - | 4 - - - 2 - - - | 3 - - - 5 - - - | 6 - - - 3 - - - | 5 - - - 7 - - - | 6 - - - 3 - - - | 4 - - - 2 - - - | 3 - - - - - - -',
    lead: { wave: 'triangle', env: 'bow' },
    bass: 'half',
    arp: 'none',
    pad: 0.9,
    choir: true,
    bells: 0.05,
    echo: 0.4,
    level: 0.72,
  },
  // the Great Hall: a stately pavane
  court: {
    bpm: 80,
    chords: ['G3 B3 D4', 'C3 E3 G3', 'D3 F#3 A3', 'G3 B3 D4', 'E3 G3 B3', 'C3 E3 G3', 'D3 F#3 A3', 'G3 B3 D4'],
    scale: 'D5 E5 F#5 G5 A5 B5 C6 D6',
    melody: '3 - - - 5 - 4 3 | 4 - 1 - 3 - - - | 2 - 4 - 7 - 6 - | 5 - - - 3 - - - | 5 - 6 - 7 - 5 - | 6 - 5 - 4 - 3 - | 4 - 2 - 0 - 2 - | 3 - - - - - - -',
    lead: { wave: 'square', env: 'bow' },
    bass: 'half',
    arp: 'strum',
    drums: 'k.......k...k...',
    pad: 0.4,
    echo: 0.2,
    level: 0.72,
  },

  /* ------------------------------------------------------------ the bright lands */
  // the Whisperwood: light and curious, a harp under a flute
  whisperwood: {
    bpm: 104,
    chords: ['A3 C4 E4', 'D3 F#3 A3', 'A3 C4 E4', 'G3 B3 D4', 'C3 E3 G3', 'G3 B3 D4', 'A3 C4 E4', 'E3 G#3 B3'],
    scale: 'A4 B4 C5 D5 E5 F#5 G5 A5 B5',
    melody: '0 - 2 4 4 - 2 0 | 5 - 4 3 2 - . . | 4 - 2 - 0 2 4 7 | 6 - 4 - 3 - . . | 2 - 4 - 6 - 4 2 | 3 - 1 - 6 - 3 - | 2 1 0 1 2 - 4 - | 1 - - - . . . .',
    lead: { wave: 'triangle', env: 'flute' },
    bass: 'half',
    arp: 'harp',
    drums: 'k.......k...h...',
    pad: 0.3,
    echo: 0.2,
    calls: ['bird'],
    callRate: 0.35,
  },
  // Thornvale's fields: a walking tune in G
  thornvale: {
    bpm: 104,
    chords: ['G3 B3 D4', 'C: G3 C4 E4', 'D: A3 D4 F#4', 'G3 B3 D4'],
    scale: 'G4 A4 B4 C5 D5 E5 F#5 G5',
    melody: '2 - 4 5 4 - 2 . | 1 2 4 - 2 - . . | 4 - 5 7 5 4 2 - | 1 - 0 1 2 - . .',
    lead: { wave: 'triangle', env: 'pluck' },
    bass: 'walk',
    arp: 'broken',
    drums: 'K...s...K.k.s...',
    pad: 0.3,
    calls: ['bird'],
    callRate: 0.3,
    level: 1.24,
  },
  // the Saltmarsh: a shanty in D dorian, rolling like the swell
  saltmarsh: {
    bpm: 118,
    chords: ['D3 F3 A3', 'A3 C4 E4', 'C3 E3 G3', 'G3 B3 D4'],
    scale: 'D5 E5 F5 G5 A5 B5 C6',
    melody: '0 - 2 3 4 - 3 2 | 1 - 2 - 0 - . . | 4 - 5 4 3 - 2 1 | 0 - 1 2 0 - . .',
    lead: { wave: 'square', env: 'pluck' },
    arp: 'broken',
    drums: 'k.....x.k.....x.',
    pad: 0.3,
    wind: 0.025,
    calls: ['gull'],
    callRate: 0.3,
    echo: 0.15,
  },
  // Brackenridge's autumn hills: a jig in E minor
  brackenridge: {
    bpm: 132,
    meter: 3,
    chords: ['E3 G3 B3', 'D3 F#3 A3', 'E3 G3 B3', 'B2 D#3 F#3', 'E3 G3 B3', 'D3 F#3 A3', 'C3 E3 G3', 'B2 D#3 F#3'],
    scale: 'E5 F#5 G5 A5 B5 C6 D6 E6',
    melody: '0 1 2 4 2 0 | 6 - 3 1 - 3 | 2 1 0 2 4 7 | 4 - 1 4 - . | 7 6 4 2 4 6 | 6 - 5 3 1 3 | 5 - 4 2 - 0 | 1 - - 4 - .',
    lead: { wave: 'square', env: 'pluck' },
    bass: 'oom',
    arp: 'pah',
    drums: 'K.h.h.k.h.h.',
    pad: 0.2,
    calls: ['bird'],
    level: 1.23,
  },
  // the Amberfield Steppes: open fifths and a gallop
  amberfield: {
    bpm: 120,
    chords: ['A3 C#4 E4', 'G3 B3 D4', 'D3 F#3 A3', 'A3 C#4 E4', 'A3 C#4 E4', 'G3 B3 D4', 'E3 G#3 B3', 'A3 C#4 E4'],
    scale: 'A4 B4 C#5 D5 E5 F#5 G5 A5 B5',
    melody: '0 - 2 - 4 - 7 - | 6 - 3 - 1 - 3 - | 5 - 7 - 5 3 2 - | 4 - - - . . 2 3 | 4 - 7 - 8 - 7 4 | 6 - 3 - 6 - 8 - | 4 - 1 - 4 - 8 - | 7 - - - . . . .',
    lead: { wave: 'square', env: 'plain' },
    bass: 'walk',
    arp: 'broken',
    drums: 'k.kk..s.k.kk..s.',
    pad: 0.25,
    wind: 0.015,
    calls: ['bird'],
  },
  // the Glimmerwood: lydian and dreaming, a bell over a harp
  glimmerwood: {
    bpm: 96,
    meter: 3,
    chords: ['F3 A3 C4', 'G3 B3 D4', 'F3 A3 C4', 'G3 B3 D4', 'D3 F3 A3', 'C3 E3 G3', 'G3 B3 D4', 'F3 A3 C4'],
    scale: 'C5 D5 E5 F5 G5 A5 B5 C6 D6 E6',
    melody: '5 - 7 - 9 - | 8 - 6 - 4 - | 5 - 7 6 5 3 | 6 - - - . . | 3 - 5 - 8 - | 7 - 4 - 2 - | 6 - 8 - 6 4 | 5 - - - . .',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'oom',
    arp: 'harp',
    pad: 0.4,
    bells: 0.15,
    echo: 0.35,
    calls: ['bird'],
    callRate: 0.15,
    level: 1.3,
  },
  // Vinecoil: a marimba in the pentatonic over toms, frogs and birds
  vinecoil: {
    bpm: 116,
    chords: ['A3 C4 E4', 'A3 C4 E4', 'G3 B3 D4', 'G3 B3 D4', 'F3 A3 C4', 'F3 A3 C4', 'G3 B3 D4', 'A3 C4 E4'],
    scale: 'A4 C5 D5 E5 G5 A5 C6',
    melody: '0 . 2 . 3 2 . 0 | . 3 . 4 5 . 3 . | 4 . 3 . 2 3 . 4 | . 2 . 1 2 . . . | 5 . 4 . 3 4 . 5 | . 6 . 5 4 . 3 . | 4 . 3 2 . 1 2 . | 0 . . . . . . .',
    lead: { wave: 'sine', env: 'pluck' },
    bass: 'walk',
    arp: 'broken',
    drums: 't.T.k.T.t.Tkk.T.',
    pad: 0.25,
    echo: 0.15,
    calls: ['bird', 'frog'],
    callRate: 0.4,
    level: 0.88,
  },

  /* ------------------------------------------------------------ the hard lands */
  // the Ironpeak Highlands: a horn over toms, echoing off the rock
  ironpeak: {
    bpm: 100,
    chords: ['D3 F3 A3', 'Bb2 D3 F3', 'C3 E3 G3', 'D3 F3 A3', 'D3 F3 A3', 'Bb2 D3 F3', 'C3 E3 G3', 'A2 C#3 E3'],
    scale: 'A4 C5 D5 E5 F5 G5 A5 C6 D6',
    melody: '2 - - - 4 - 6 - | 5 - 4 - 2 - - - | 3 - 4 5 6 - 5 4 | 2 - - - . . . . | 6 - 8 - 7 6 5 4 | 5 - - - 2 - 4 5 | 3 - 5 - 7 - 6 5 | 6 - - - . . . .',
    lead: { wave: 'square', env: 'bow' },
    bass: 'half',
    arp: 'pulse',
    drums: 't.....t.k.k...T.',
    pad: 0.3,
    wind: 0.025,
    echo: 0.35,
    level: 0.69,
  },
  // Stormwatch Cliffs: restless, a gale and the gulls
  stormwatch: {
    bpm: 112,
    chords: ['F#3 A3 C#4', 'D3 F#3 A3', 'A3 C#4 E4', 'E3 G#3 B3', 'F#3 A3 C#4', 'D3 F#3 A3', 'E3 G#3 B3', 'C#3 F3 G#3'],
    scale: 'C#5 D5 E5 F#5 G#5 A5 B5 C#6',
    melody: '3 - - 5 4 - 3 2 | 1 - 3 - 5 - - - | 7 - 6 5 4 - 2 - | 4 - - - . . 2 3 | 3 - 5 - 7 - 6 5 | 6 - 5 3 1 - - - | 2 - 4 - 6 - 5 4 | 4 - - - 0 - - -',
    lead: { wave: 'square', env: 'bow' },
    bass: 'pulse',
    arp: 'none',
    drums: 'K.h.x.h.K.k.x.hh',
    pad: 0.3,
    wind: 0.06,
    calls: ['gull'],
    echo: 0.25,
    level: 0.71,
  },
  // the Sunscorch Expanse: an oud over a drone and hand drums
  sunscorch: {
    bpm: 100,
    chords: ['E3 G#3 B3', 'F3 A3 C4', 'E3 G#3 B3', 'D3 F3 A3', 'E3 G#3 B3', 'F3 A3 C4', 'G3 B3 D4', 'F3 A3 C4'],
    scale: 'E4 F4 G#4 A4 B4 C5 D5 E5 F5',
    melody: '0 1 2 1 0 - - - | 3 - 2 1 3 - 5 - | 4 - 5 4 2 - 4 - | 3 - - - 1 - . . | 7 - 8 7 6 5 4 - | 5 - 3 - 1 - 3 - | 6 - 4 - 6 5 4 - | 2 1 0 - - - . .',
    lead: { wave: 'triangle', env: 'pluck' },
    bass: 'none',
    arp: 'none',
    drums: 't..T..t.k.t.T...',
    pad: 0.2,
    drone: 'E2',
    wind: 0.02,
    echo: 0.15,
    level: 0.71,
  },
  // Sablewind Canyon: faster, the drums thrown back off the canyon walls
  sablewind: {
    bpm: 112,
    chords: ['A2 C#3 E3', 'Bb2 D3 F3', 'A2 C#3 E3', 'G2 Bb2 D3', 'A2 C#3 E3', 'Bb2 D3 F3', 'C3 E3 G3', 'Bb2 D3 F3'],
    scale: 'A4 Bb4 C#5 D5 E5 F5 G5 A5',
    melody: '0 - 1 2 4 - 2 1 | 1 - 3 - 5 - 3 - | 4 - 5 4 2 - 4 - | 3 - 1 - 6 - 5 - | 7 - 6 5 4 - 2 - | 5 - 3 - 1 - 3 - | 6 - 4 - 6 5 4 - | 3 - 1 - 0 - - -',
    lead: { wave: 'square', env: 'pluck' },
    bass: 'walk',
    arp: 'none',
    drums: 'k.tk.tT.k.tk.Tt.',
    pad: 0.2,
    drone: 'A1',
    wind: 0.03,
    echo: 0.25,
    level: 0.58,
  },
  // Highwall March: a war march, snare rolls
  highwall: {
    bpm: 108,
    chords: ['C3 Eb3 G3', 'C3 Eb3 G3', 'Ab2 C3 Eb3', 'Bb2 D3 F3', 'C3 Eb3 G3', 'Ab2 C3 Eb3', 'F2 Ab2 C3', 'G2 B2 D3'],
    scale: 'G4 C5 D5 Eb5 F5 G5 Ab5 Bb5 C6',
    melody: '1 - - 1 1 - 3 - | 5 - - - 3 - 1 - | 6 - 5 - 3 - 1 - | 2 - 4 - 7 - - - | 8 - 7 - 5 - 3 - | 6 - - 5 6 - 8 - | 4 - - 3 4 - 6 - | 5 - - - 0 - - -',
    lead: { wave: 'square', env: 'bow' },
    bass: 'pulse',
    arp: 'none',
    drums: 'k.s.s.s.k.k.ssss',
    pad: 0.3,
    wind: 0.02,
    echo: 0.15,
    level: 0.78,
  },
  // Rimeheld Tundra: crystalline bells in the wind, a wolf far off
  rimeheld: {
    bpm: 72,
    meter: 3,
    chords: ['B2 D3 F#3', 'G2 B2 D3', 'D3 F#3 A3', 'A2 C#3 E3', 'B2 D3 F#3', 'G2 B2 D3', 'E3 G3 B3', 'F#2 A#2 C#3'],
    scale: 'F#5 A5 B5 C#6 D6 E6 F#6',
    melody: '2 - - - 4 - | 5 - 4 - 2 - | 1 - - - 4 - | 3 - - - - - | 6 - 5 - 4 - | 2 - 4 - 2 - | 1 - 2 - 5 - | 3 - - - 0 -',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'half',
    arp: 'harp',
    pad: 0.4,
    choir: true,
    wind: 0.05,
    echo: 0.45,
    calls: ['wolf'],
    callRate: 0.12,
  },
  // the Shattered Vale: a whole-tone scale, nothing resolves
  'shattered-vale': {
    bpm: 92,
    chords: ['C3 E3 G#3', 'D3 F#3 A#3', 'E3 G#3 C4', 'D3 F#3 A#3'],
    scale: 'C5 D5 E5 F#5 G#5 A#5 C6 D6',
    melody: '0 - 2 - 4 - 3 - | 5 - - - 4 3 . . | 6 - 4 - 2 - 4 - | 1 - - - . . . . | 7 - 6 5 4 - 3 - | 2 - 4 - 6 - - - | 5 4 3 2 1 - - - | 0 - - - . . . .',
    lead: { wave: 'sine', env: 'flute', detune: 25 },
    bass: 'pulse',
    arp: 'harp',
    drums: 'k.......k..k....',
    pad: 0.35,
    choir: true,
    wind: 0.03,
    echo: 0.45,
    level: 0.77,
  },
  // Emberdeep Caldera: heavy, phrygian, the ground rumbling
  emberdeep: {
    bpm: 96,
    chords: ['E3 G3 B3', 'F3 A3 C4', 'E3 G3 B3', 'D3 F3 A3', 'E3 G3 B3', 'F3 A3 C4', 'G3 B3 D4', 'F3 A3 C4'],
    scale: 'E4 F4 G4 A4 B4 C5 D5 E5',
    melody: '0 - 0 1 0 - . . | 5 - 4 - 3 - 1 - | 4 - - 3 4 - 7 - | 6 - 5 - 3 - - - | 7 - 6 5 4 - 2 - | 1 - 3 - 5 - - - | 6 - 4 - 6 - 7 - | 1 - - - 0 - - -',
    lead: { wave: 'sawtooth', env: 'bow' },
    bass: 'pulse',
    arp: 'none',
    drums: 'k.t.k.T.kkt.k.TT',
    pad: 0.3,
    wind: 0.02,
    echo: 0.2,
    level: 0.86,
  },
  // the Riftscar Wastes: an octatonic scale, metallic and wrong
  riftscar: {
    bpm: 100,
    chords: ['C3 Eb3 F#3 A3', 'C#3 E3 G3 Bb3', 'C3 Eb3 F#3 A3', 'D3 F3 Ab3 B3'],
    scale: 'C5 D5 Eb5 F5 F#5 G#5 A5 B5 C6',
    melody: '0 - 2 - 4 - 6 - | 7 - 5 - 3 - - - | 8 - 6 4 2 - 4 - | 1 - - - . . . .',
    lead: { wave: 'square', env: 'bow', detune: 20 },
    bass: 'pulse',
    arp: 'harp',
    drums: 'k...T.T.k.k.T...',
    pad: 0.3,
    choir: true,
    wind: 0.03,
    echo: 0.4,
    level: 0.66,
  },

  // the Riftward: the Riftscar's scale gone still and solemn, a held choir under a slow bell (2026-11-22)
  riftward: {
    bpm: 72,
    chords: ['C3 Eb3 F#3 A3', 'Ab2 C3 Eb3', 'C3 Eb3 F#3 A3', 'B2 D3 F3 Ab3'],
    scale: 'C5 D5 Eb5 F5 F#5 G#5 A5 B5 C6',
    melody: '4 - - - 2 - - - | 3 - 1 - - - - - | 5 - - 4 2 - - - | 0 - - - . . . .',
    lead: { wave: 'sine', env: 'bow' },
    bass: 'pulse',
    pad: 0.45,
    choir: true,
    bells: 0.3,
    wind: 0.02,
    echo: 0.5,
    level: 0.7,
  },

  /* ------------------------------------------------------------ the frightening lands */
  // Greyfen Marsh: a held low D, a wavering flute, frogs and dripping water
  greyfen: {
    bpm: 76,
    chords: ['D3 F3 A3', 'Bb2 D3 F3', 'D3 F3 A3', 'A2 C#3 E3', 'D3 F3 A3', 'G3 Bb3 D4', 'Bb2 D3 F3', 'A2 C#3 E3'],
    scale: 'A4 Bb4 C#5 D5 E5 F5 G5 A5',
    melody: '3 - - - 5 - 4 3 | 1 - - - . . . . | 3 - 4 5 7 - 5 4 | 2 - - - . . . . | 7 - - 6 5 - 4 3 | 6 - - - 1 - 3 - | 5 - 4 3 1 - 0 - | 2 - - - . . . .',
    lead: { wave: 'triangle', env: 'flute', detune: 6 },
    bass: 'half',
    arp: 'harp',
    pad: 0.4,
    choir: true,
    drone: 'D2',
    wind: 0.03,
    echo: 0.3,
    calls: ['frog', 'drip'],
    callRate: 0.35,
    level: 0.63,
  },
  // Duskfen: a sick fen in B phrygian, a heartbeat, a flute that won't stay in tune
  duskfen: {
    bpm: 64,
    chords: ['B2 D3 F#3', 'C3 E3 G3', 'B2 D3 F#3', 'C3 E3 G3', 'E3 G3 B3', 'C3 E3 G3', 'B2 D3 F#3', 'F#2 A2 C3'],
    scale: 'B4 C5 D5 E5 F#5 G5 A5 B5',
    melody: '0 - - 1 0 - - - | . . . . 4 - 5 - | 4 - 3 - 2 - - - | 1 - - - . . . . | 3 - - 5 4 - 3 - | 1 - 2 1 0 - - - | . . . . . . 0 1 | 0 - - - . . . .',
    lead: { wave: 'sine', env: 'flute', detune: 22 },
    bass: 'none',
    arp: 'none',
    drums: 'k.k.............',
    pad: 0.5,
    choir: true,
    drone: 'B1',
    wind: 0.035,
    bells: 0.1,
    echo: 0.35,
    calls: ['frog', 'drip', 'crow'],
    callRate: 0.4,
    level: 0.62,
  },
  // the Ashen Barrows: a funeral drum, a knell, a choir under the hill
  'ashen-barrows': {
    bpm: 56,
    chords: ['C3 Eb3 G3', 'Ab2 C3 Eb3', 'F3 Ab3 C4', 'G2 B2 D3', 'C3 Eb3 G3', 'Ab2 C3 Eb3', 'Bb2 D3 F3', 'G2 B2 D3'],
    scale: 'G4 Ab4 B4 C5 D5 Eb5 F5 G5',
    melody: '3 - - - . . . . | 5 - - - 3 - - - | 6 - 5 - 3 - - - | 2 - - - . . . . | 7 - - - 5 - - - | 3 - 5 - 6 - - - | 6 - - - 4 - - - | 2 - - - 0 - - -',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'none',
    arp: 'none',
    drums: 't...............',
    pad: 0.6,
    choir: true,
    drone: 'C2',
    bells: 0.3,
    wind: 0.02,
    echo: 0.4,
    calls: ['crow'],
    callRate: 0.3,
    level: 0.72,
  },
  // the Grimward Moors: mist, a lone flute in three, crows
  grimward: {
    bpm: 84,
    meter: 3,
    chords: ['E3 G3 B3', 'C3 E3 G3', 'D3 F#3 A3', 'E3 G3 B3', 'A3 C4 E4', 'C3 E3 G3', 'D3 F#3 A3', 'B2 D#3 F#3'],
    scale: 'B4 D5 E5 F#5 G5 A5 B5 D6 E6',
    melody: '2 - - 3 4 - | 2 - - - 1 - | 3 - - - 5 - | 2 - - - - - | 5 - 6 - 7 - | 6 - 4 - 2 - | 3 - - 5 3 1 | 0 - - - - -',
    lead: { wave: 'triangle', env: 'flute', detune: 4 },
    bass: 'oom',
    arp: 'none',
    pad: 0.45,
    choir: true,
    drone: 'E2',
    wind: 0.04,
    echo: 0.3,
    calls: ['crow', 'bird'],
    callRate: 0.2,
    level: 0.65,
  },
  // Gloamhollow, the black fen: almost nothing, and then something
  gloamhollow: {
    bpm: 54,
    chords: ['D#3 F#3 A#3', 'B2 D#3 F#3', 'D#3 F#3 A#3', 'D3 F#3 A3'],
    scale: 'A#4 B4 D5 D#5 F#5 A#5',
    melody: '3 - - - - - . . | . . . . 1 - - - | 4 - - - 3 - - - | 2 - - - - - . .',
    lead: { wave: 'sine', env: 'flute', detune: 12 },
    bass: 'none',
    arp: 'none',
    pad: 0.7,
    choir: true,
    drone: 'D#2',
    bells: 0.25,
    wind: 0.04,
    echo: 0.5,
    calls: ['frog', 'owl', 'drip'],
    callRate: 0.45,
    every: 2,
    level: 0.65,
  },
  // the Bonefields: a heartbeat in the dust, crows
  bonefields: {
    bpm: 60,
    chords: ['D3 F3 A3', 'Eb3 G3 Bb3', 'D3 F3 A3', 'C3 Eb3 G3'],
    scale: 'D5 Eb5 F5 G5 A5 Bb5 C6 D6',
    melody: '0 - - - 1 - 0 - | 3 - - - 2 - 1 - | 4 - - - 5 - 4 - | 3 - - - - - . .',
    lead: { wave: 'triangle', env: 'bow' },
    bass: 'none',
    arp: 'none',
    drums: 'k..k............',
    pad: 0.4,
    choir: true,
    drone: 'D2',
    bells: 0.1,
    wind: 0.05,
    echo: 0.3,
    calls: ['crow'],
    callRate: 0.35,
    level: 0.64,
  },
  // the Weeping Woods: a music box waltzing in a dark wood, owls and wolves
  'weeping-woods': {
    bpm: 80,
    meter: 3,
    chords: ['C3 Eb3 G3', 'Ab2 C3 Eb3', 'F3 Ab3 C4', 'G2 B2 D3', 'C3 Eb3 G3', 'Ab2 C3 Eb3', 'D3 F3 Ab3', 'G2 B2 D3'],
    scale: 'G5 Ab5 B5 C6 D6 Eb6 F6 G6',
    melody: '3 - 4 - 5 - | 5 - - 4 3 - | 6 - 5 - 3 - | 2 - - - - - | 3 - 5 - 7 - | 6 - 5 - 3 - | 1 - 3 - 6 - | 2 - - - 0 -',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'oom',
    arp: 'harp',
    pad: 0.35,
    choir: true,
    drone: 'C2',
    wind: 0.035,
    bells: 0.08,
    echo: 0.45,
    calls: ['owl', 'wolf', 'crow'],
    callRate: 0.35,
    level: 0.7,
  },
  // the Sunken Reaches: drowned, slow, everything heard through water
  'sunken-reaches': {
    bpm: 76,
    chords: ['C3 Eb3 G3', 'F3 A3 C4', 'C3 Eb3 G3', 'Bb2 D3 F3', 'Eb3 G3 Bb3', 'F3 A3 C4', 'G2 Bb2 D3', 'C3 Eb3 G3'],
    scale: 'C5 D5 Eb5 F5 G5 A5 Bb5 C6',
    melody: '4 - - - 2 - 0 - | 5 - - - 3 - - - | 4 - 6 - 7 - 6 4 | 3 - - - . . . . | 2 - 4 - 6 - - - | 5 - 4 - 3 - - - | 1 - 3 - 4 - 6 - | 0 - - - . . . .',
    lead: { wave: 'sine', env: 'flute', detune: 8 },
    bass: 'half',
    arp: 'harp',
    pad: 0.4,
    wind: 0.045,
    echo: 0.5,
    calls: ['gull', 'drip'],
    callRate: 0.25,
    level: 0.72,
  },
  // the Blightwood: a rotten forest, a heartbeat, a bowed tune gone sour
  blightwood: {
    bpm: 72,
    chords: ['A2 C3 E3', 'F2 A2 C3', 'D3 F3 G#3', 'E2 G#2 B2', 'A2 C3 E3', 'Bb2 D3 F3', 'D3 F3 G#3', 'E2 G#2 B2'],
    scale: 'E4 F4 G#4 A4 B4 C5 D#5 E5',
    melody: '3 - - 4 5 - 4 3 | 5 - - - 3 - - - | 6 - - 5 4 - - - | 2 - - - 0 - - - | 7 - 6 5 4 - 3 - | 1 - 3 - 5 - - - | 6 - 5 4 2 - - - | 0 - - - . . . .',
    lead: { wave: 'triangle', env: 'bow', detune: 15 },
    bass: 'half',
    arp: 'none',
    drums: 'k..k........t...',
    pad: 0.5,
    choir: true,
    drone: 'A1',
    wind: 0.03,
    echo: 0.35,
    calls: ['crow', 'owl'],
    callRate: 0.3,
    level: 0.61,
  },
  // Hollowmere, the dead lake: stillness, a bell, a drip
  hollowmere: {
    bpm: 52,
    chords: ['F#3 A3 C#4', 'D3 F#3 A3', 'F#3 A3 C#4', 'C#3 F3 G#3'],
    scale: 'C#5 D5 E5 F#5 G#5 A5 C#6',
    melody: '3 - - - - - 2 - | 1 - - - - - . . | 5 - - - 4 - 3 - | 4 - - - - - . .',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'none',
    arp: 'none',
    pad: 0.6,
    choir: true,
    drone: 'F#1',
    bells: 0.3,
    wind: 0.04,
    echo: 0.55,
    calls: ['drip', 'owl'],
    callRate: 0.35,
    every: 2,
    level: 0.75,
  },
  // the Pale Reach: a cold choir, high and far
  'pale-reach': {
    bpm: 58,
    chords: ['D3 F3 A3 E4', 'Bb2 D3 F3 C4', 'G2 Bb2 D3 A3', 'A2 C#3 E3'],
    scale: 'A5 C6 D6 E6 F6 A6',
    melody: '2 - - - 3 - - - | 4 - - - 3 - 2 - | 1 - - - 0 - - - | 2 - - - - - . .',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'half',
    arp: 'none',
    pad: 0.8,
    choir: true,
    drone: 'D2',
    bells: 0.25,
    wind: 0.04,
    echo: 0.55,
    calls: ['wolf'],
    callRate: 0.15,
    every: 2,
    level: 0.65,
  },

  /* ------------------------------------------------------------ underground */
  crypt: {
    bpm: 92,
    chords: ['E3 G3 B3', 'E3 G3 A#3', 'F3 G#3 C4', 'D#3 G3 A#3'],
    scale: 'E4 F4 G4 G#4 B4 C5',
    melody: '0 - - 1 0 - - - | 2 - 1 - 0 - - - | 3 - 2 - 1 - 0 - | 1 - - - - - - -',
    lead: { wave: 'sine', env: 'flute' },
    bass: 'half',
    arp: 'up',
    pad: 0.75,
    choir: true,
    drone: 'E2',
    bells: 0.12,
    echo: 0.4,
    calls: ['drip'],
    callRate: 0.25,
    level: 0.55,
  },
  cave: {
    bpm: 86,
    chords: ['D3 F3 A3', 'D3 F3 G#3', 'F3 G#3 C4', 'C3 D#3 G3'],
    scale: 'D4 D#4 F4 G4 G#4 A#4',
    melody: '0 - - 2 1 - - - | 0 - 3 - 2 - - - | 4 - 3 - 2 - 1 - | 0 - - - - - - -',
    lead: { wave: 'sine', env: 'flute' },
    bass: 'half',
    arp: 'up',
    pad: 0.7,
    drone: 'D2',
    echo: 0.4,
    calls: ['drip'],
    callRate: 0.3,
    level: 0.6,
  },
  // the Rimeheld Vault: a music box frozen in the ice
  'frost-vault': {
    bpm: 66,
    meter: 3,
    chords: ['E3 G3 B3', 'C3 E3 G3', 'A2 C3 E3', 'B2 D#3 F#3'],
    scale: 'B5 C6 D6 E6 F#6 G6 B6',
    melody: '3 - - - 2 - | 1 - - - 0 - | 2 - 3 - 4 - | 0 - - - - -',
    lead: { wave: 'sine', env: 'bell' },
    bass: 'half',
    arp: 'harp',
    pad: 0.5,
    choir: true,
    wind: 0.04,
    echo: 0.5,
    calls: ['drip'],
    callRate: 0.3,
  },
  // the Molten Throne: hammering drums in C# phrygian
  molten: {
    bpm: 92,
    chords: ['C#3 E3 G#3', 'D3 F#3 A3', 'C#3 E3 G#3', 'B2 D3 F#3'],
    scale: 'C#5 D5 E5 F#5 G#5 A5 B5 C#6',
    melody: '0 - 1 0 . . 4 - | 5 - 4 - 2 - 1 - | 0 - - - 7 - 6 - | 5 - 4 - 1 - - -',
    lead: { wave: 'sawtooth', env: 'bow' },
    bass: 'pulse',
    arp: 'none',
    drums: 'k.k.T.t.k.k.TTtt',
    pad: 0.3,
    drone: 'C#2',
    wind: 0.02,
    echo: 0.2,
    level: 0.6,
  },
  // Blightheart, under the rotten tree: a heartbeat in the roots
  rootdeep: {
    bpm: 66,
    chords: ['A2 C3 E3', 'Bb2 D3 F3', 'A2 C3 E3', 'G#2 B2 D3'],
    scale: 'E5 F5 G#5 A5 B5 C6',
    melody: '3 - - - 1 - 0 - | 1 - - - - - . . | 2 - 3 - 4 - 5 - | 2 - - - - - . .',
    lead: { wave: 'triangle', env: 'flute', detune: 18 },
    bass: 'none',
    arp: 'none',
    drums: 'k..k............',
    pad: 0.6,
    choir: true,
    drone: 'A1',
    bells: 0.1,
    wind: 0.03,
    echo: 0.4,
    calls: ['drip'],
    callRate: 0.3,
    level: 0.64,
  },
  // the Tomb of the Sun King: a plucked lament over a drone, hand drums in the dark
  tomb: {
    bpm: 70,
    chords: ['D3 F#3 A3', 'Eb3 G3 Bb3', 'D3 F#3 A3', 'C3 Eb3 G3'],
    scale: 'D5 Eb5 F#5 G5 A5 Bb5 C6 D6',
    melody: '0 - 1 2 1 - 0 - | 3 - 2 1 2 - - - | 4 - 5 4 2 - 1 - | 0 - - - . . . .',
    lead: { wave: 'triangle', env: 'pluck' },
    bass: 'none',
    arp: 'none',
    drums: 't.......T...t...',
    pad: 0.4,
    choir: true,
    drone: 'D2',
    bells: 0.15,
    echo: 0.4,
    calls: ['drip'],
    callRate: 0.25,
    level: 0.74,
  },
  // the Deepforge Halls: a horn over the anvils
  deepforge: {
    bpm: 100,
    chords: ['G2 Bb2 D3', 'Eb3 G3 Bb3', 'F3 A3 C4', 'G2 Bb2 D3'],
    scale: 'D5 F5 G5 A5 Bb5 C6 D6',
    melody: '2 - - 3 4 - 2 - | 4 - 5 4 3 - - - | 3 - 4 5 6 - 5 - | 2 - - - . . . .',
    lead: { wave: 'square', env: 'bow' },
    bass: 'half',
    arp: 'none',
    drums: 'k...T.h.k.k.T.h.',
    pad: 0.3,
    drone: 'G1',
    echo: 0.3,
    level: 0.55,
  },
};

const PARSED = Object.fromEntries(Object.entries(SONG_DEFS).map(([id, d]) => [id, parseSong(d)])) as Record<Exclude<SongId, RingSong>, Song>;
/** (an arena whose recorded piece can't be had plays the siege's score, as the Ring did before it had its own) */
export const SONGS: Record<SongId, Song> = { ...PARSED, 'ring-sands': PARSED.siege, 'ring-frost': PARSED.siege, 'ring-forge': PARSED.siege };
