// GlitchBound's original soundtrack: ten tracks plus a sonic logo, each composed here as patterns and
// hand-written melodies over the synth voices in engine.js. Bars are 4/4 with 16 steps.
import { chord, degree, midi, steps } from './engine.js';

/** Keeps chord notes inside one octave starting at `lo` (a closed, smooth voicing). */
const spread = (notes, lo) => notes.map((n) => lo + ((((n - lo) % 12) + 12) % 12)).sort((a, b) => a - b);

/** Plays a hand-written phrase: [step, lengthInSteps, scaleDegree, velocity?] from `root`. */
function phrase(S, bar, root, scale, notes, play) {
  for (const [st, len, d, v = 1] of notes) play(S.t(bar, st), degree(root, scale, d), (len * S.beat) / 4, v);
}

/** Four-on-the-floor kick with optional sidechain pump. */
const fourFloor = (S, bar, v = 1, pump = 0.45, opts = {}) => steps('x...x...x...x...', (i, vel) => S.kick(S.t(bar, i), v * vel, { pump, ...opts }));

/** Snare/clap roll building over one bar (8ths then 16ths), with a riser. */
function build(S, bar, { voice = 'snare', riser = true } = {}) {
  for (let i = 0; i < 16; i += i < 8 ? 2 : 1) {
    const v = 0.3 + (i / 16) * 0.7;
    if (voice === 'snare') S.snare(S.t(bar, i), v, { verb: 0.25 });
    else S.clap(S.t(bar, i), v);
  }
  if (riser) S.riser(S.t(bar), S.beat * 4, 1);
}

export const TRACKS = [
  // ---------------------------------------------------------------------------------------------
  {
    id: 'small-games',
    title: 'Small Games',
    mood: 'Bright, bouncy synth-pop. The brand theme: trailers, launches, lobby tours.',
    bpm: 116,
    bars: 33,
    tail: 3,
    seed: 11,
    build(S) {
      const key = midi('D3');
      const prog = [0, 4, 5, 3];
      const lead = [
        [[0, 3, 4], [3, 3, 4], [6, 2, 5], [8, 4, 4], [12, 4, 2]],
        [[0, 3, 1], [3, 3, 1], [6, 2, 2], [8, 4, 1], [12, 4, -1]],
        [[0, 2, 0], [2, 2, 2], [4, 4, 5], [8, 4, 4], [12, 4, 2]],
        [[0, 3, 3], [3, 3, 2], [6, 2, 1], [8, 6, 0], [14, 2, 1]],
        [[0, 3, 4], [3, 3, 4], [6, 2, 5], [8, 4, 4], [12, 4, 7]],
        [[0, 3, 6], [3, 3, 5], [6, 2, 4], [8, 4, 1], [12, 4, 2]],
        [[0, 2, 5], [2, 2, 7], [4, 4, 6], [8, 4, 5], [12, 4, 4]],
        [[0, 4, 3], [4, 4, 2], [8, 8, 0]],
      ];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'major', d), 57);
        const root = degree(midi('D2'), 'major', d);
        const intro = b < 4, verse = b >= 4 && b < 12, chorus = (b >= 12 && b < 20) || (b >= 24 && b < 32), brk = b >= 20 && b < 24;
        // Arpeggio throughout (softer in choruses).
        steps('x.o.x.o.x.o.x.o.', (i, v) => S.pluck(S.t(b, i), tri[(i / 2) % 3] + 12 * (i % 8 === 6 ? 1 : 0), 0.12, (intro || brk ? 0.9 : 0.55) * v, { type: 'square', cutoff: 2400, delay: 0.25, pan: 0.25 }));
        if (intro || brk) S.pad(S.t(b), tri, S.beat * 4, intro ? 0.7 : 1, { cutoff: 1400 });
        if (b >= 2 && intro) steps('..o...o...o...o.', (i, v) => S.hat(S.t(b, i), v));
        if (b === 3 || b === 23) S.riser(S.t(b), S.beat * 4);
        if (b === 23) build(S, b);
        if (verse || chorus) {
          fourFloor(S, b, 1, chorus ? 0.5 : 0.3);
          steps('....x.......x...', (i) => S.clap(S.t(b, i), 0.9));
          if (chorus) {
            steps('..x...x...x...x.', (i) => S.hat(S.t(b, i), 0.8, { open: true }));
            steps('o-o-o-o-o-o-o-o-', (i, v) => S.hat(S.t(b, i), v * 0.6, { pan: -0.2 }));
            steps('..x...x...x...x.', (i) => S.bass(S.t(b, i), root + 12 * (i % 4 === 2 ? 1 : 0), S.beat * 0.4, 1, { cutoff: 700 }));
            S.pad(S.t(b), tri.map((n) => n + 12), S.beat * 4, 0.8, { cutoff: 2600, attack: 0.05 });
            phrase(S, b, midi('D5'), 'major', lead[(b - (b >= 24 ? 24 : 12)) % 8], (t, n, len, v) => S.lead(t, n, len * 0.92, v));
            if (b >= 24) phrase(S, b, midi('D6'), 'major', lead[(b - 24) % 8], (t, n, len, v) => S.bell(t, n, v * 0.55, { ring: 0.6 }));
          } else {
            steps('..x...x...x...x.', (i) => S.hat(S.t(b, i), 0.7));
            steps('x.x.x.x.x.x.x.x.', (i) => S.bass(S.t(b, i), root + (i % 4 === 2 ? 12 : 0), S.beat * 0.35, 0.9, { cutoff: 600 }));
            steps('x..x..x...x..x..', (i) => S.keys(S.t(b, i), tri, S.beat * 0.5, 0.8));
          }
        }
        if (b === 12 || b === 24) S.crash(S.t(b));
      }
      S.kick(S.t(32), 1);
      S.crash(S.t(32));
      S.pad(S.t(32), spread(chord(key, 'major', 0), 57), S.beat * 6, 1.1, { attack: 0.02 });
      S.bell(S.t(32), midi('D6'), 1, { ring: 2.5 });
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'big-obsessions',
    title: 'Big Obsessions',
    mood: 'High-energy EDM drop. Fast-cut compilations, "every game" montages, hype edits.',
    bpm: 128,
    bars: 40,
    tail: 2.5,
    seed: 23,
    build(S) {
      const key = midi('G3');
      const prog = [5, 3, 0, 4];
      const hook = [
        [[0, 2, 9], [2, 2, 7], [4, 2, 5], [6, 2, 7], [8, 3, 9], [11, 3, 8], [14, 2, 7]],
        [[0, 2, 7], [2, 2, 5], [4, 2, 3], [6, 2, 5], [8, 3, 7], [11, 3, 6], [14, 2, 5]],
        [[0, 2, 4], [2, 2, 7], [4, 2, 9], [6, 2, 7], [8, 4, 11], [12, 4, 9]],
        [[0, 2, 8], [2, 2, 6], [4, 4, 4], [8, 2, 6], [10, 2, 8], [12, 4, 11]],
      ];
      for (let b = 0; b < 40; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'major', d, 4), 55);
        const root = degree(midi('G1'), 'major', d) + (d >= 4 ? 0 : 12);
        const intro = b < 4, buildup = b >= 4 && b < 12, drop = (b >= 12 && b < 20) || (b >= 28 && b < 36), brk = b >= 20 && b < 28, outro = b >= 36;
        if (intro || brk) S.pad(S.t(b), tri, S.beat * 4, 0.9, { cutoff: intro ? 900 + b * 250 : 1400 });
        if (intro) steps('x.......x.......', (i) => S.kick(S.t(b, i), 0.7));
        if (buildup) {
          steps(b < 10 ? 'x...x...x...x...' : 'x...x...x...x...', (i) => S.kick(S.t(b, i), 0.9, { pump: 0.3 }));
          steps('..x...x...x...x.', (i) => S.hat(S.t(b, i), 0.7));
          steps('x..x..x...x..x..', (i) => S.pluck(S.t(b, i), tri[i % 4] + 12, 0.1, 0.7, { type: 'sawtooth', cutoff: 1800 + (b - 4) * 200, delay: 0.3 }));
          steps('x.......x.......', (i) => S.bass(S.t(b, i), root, S.beat * 1.6, 0.8, { cutoff: 400 }));
          if (b < 10) steps('....x.......x...', (i) => S.clap(S.t(b, i), 0.8));
          if (b >= 10) build(S, b, { voice: b === 10 ? 'clap' : 'snare', riser: b === 11 });
        }
        if (drop) {
          fourFloor(S, b, 1.05, 0.65, { punch: 3.5 });
          steps('....x.......x...', (i) => S.clap(S.t(b, i), 1));
          steps('..x...x...x...x.', (i) => S.hat(S.t(b, i), 0.9, { open: true }));
          steps('xoxoxoxoxoxoxoxo', (i, v) => S.hat(S.t(b, i), v * 0.5, { pan: -0.25 }));
          // Supersaw stabs, future-bass style.
          steps('x..x..x...x.x.x.', (i) => tri.forEach((n) => [-14, 14].forEach((dt) => S.pluck(S.t(b, i), n + 12, 0.16, 0.42, { type: 'sawtooth', cutoff: 3800, decay: 0.18, detune: dt, verb: 0.15 }))));
          steps('x..x..x...x.x.x.', (i) => S.bass(S.t(b, i), root, S.beat * 0.6, 1, { cutoff: 500, env: 1200 }));
          phrase(S, b, midi('G4'), 'major', hook[b % 4], (t, n, len, v) => S.pluck(t, n, len * 0.8, 0.9 * v, { type: 'square', cutoff: 3600, decay: 0.3, delay: 0.3, verb: 0.2 }));
          if (b >= 28) phrase(S, b, midi('G5'), 'major', hook[b % 4], (t, n, len, v) => S.bell(t, n, 0.45 * v, { ring: 0.5 }));
        }
        if (brk) {
          phrase(S, b, midi('G5'), 'major', hook[b % 4], (t, n, len, v) => S.bell(t, n, 0.6 * v, { ring: 1 }));
          if (b >= 24) steps('x...x...x...x...', (i) => S.kick(S.t(b, i), 0.6));
          if (b === 26) build(S, b, { voice: 'clap', riser: false });
          if (b === 27) build(S, b);
        }
        if (outro) {
          S.pad(S.t(b), tri, S.beat * 4, 1 - (b - 36) * 0.2, { cutoff: 1800 - (b - 36) * 300 });
          if (b < 38) fourFloor(S, b, 0.8, 0.4);
          steps('x..x..x...x.x.x.', (i) => S.pluck(S.t(b, i), tri[i % 4] + 12, 0.12, 0.6 - (b - 36) * 0.12, { type: 'sawtooth', cutoff: 2000, delay: 0.3 }));
        }
        if (b === 12 || b === 28) {
          S.crash(S.t(b));
          S.impact(S.t(b), 0.8);
        }
      }
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'brain-snack',
    title: 'Brain Snack',
    mood: 'Quirky pizzicato and marimba. Puzzles, "how to play", satisfying solves.',
    bpm: 104,
    bars: 33,
    tail: 2,
    seed: 37,
    build(S) {
      const key = midi('C3');
      const prog = [0, 5, 1, 4];
      const tune = [
        [[0, 1, 4], [2, 1, 7], [4, 1, 4], [6, 1, 2], [8, 2, 0], [12, 1, 4], [14, 1, 5]],
        [[0, 1, 7], [2, 1, 9], [4, 1, 7], [6, 1, 5], [8, 2, 4], [12, 2, 2]],
        [[0, 1, 1], [2, 1, 3], [4, 1, 5], [6, 1, 8], [8, 2, 7], [11, 1, 5], [12, 2, 3]],
        [[0, 1, 4], [2, 1, 6], [4, 1, 8], [6, 1, 6], [8, 4, 4], [14, 1, -1]],
      ];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'major', d), 60);
        const r = degree(midi('C2'), 'major', d);
        const sec = Math.floor(b / 8);
        // Walking pizzicato bass on the beats: root, fifth, octave, approach.
        [r, r + 7, r + 12, r + (b % 4 === 3 ? 11 : 4)].forEach((n, i) => S.pizz(S.t(b, i * 4), n, 0.95, { pan: -0.1 }));
        // Off-beat chord plucks.
        steps('..x...x...x...x.', (i) => tri.forEach((n) => S.pizz(S.t(b, i), n, 0.32, { pan: 0.3 })));
        if (b >= 2) {
          steps('x.......x.......', (i) => S.kick(S.t(b, i), 0.55, { tone: 60, decay: 0.25 }));
          steps('....x.......x...', (i) => S.clap(S.t(b, i), 0.45, { verb: 0.1 }));
          steps('x.o.x.o.x.o.x.o.', (i, v) => S.shaker(S.t(b, i), v));
        }
        const line = tune[b % 4];
        if (sec === 0 || sec === 3) phrase(S, b, midi('C5'), 'major', line, (t, n, len, v) => S.marimba(t, n, v));
        if (sec === 1) {
          phrase(S, b, midi('C5'), 'major', line, (t, n, len, v) => S.pizz(t, n, v * 0.9, { pan: 0.15 }));
          phrase(S, b, midi('C5'), 'major', line.map(([s, l, dd]) => [s, l, dd - 2]), (t, n, len, v) => S.marimba(t, n, v * 0.6, { pan: -0.2 }));
        }
        if (sec === 2) {
          phrase(S, b, midi('C6'), 'major', line.filter((_, i) => i % 2 === 0), (t, n) => S.bell(t, n, 0.55, { ring: 0.9 }));
          phrase(S, b, midi('C5'), 'major', line.filter((_, i) => i % 2 === 1), (t, n, len, v) => S.marimba(t, n, v));
        }
        if (sec === 3) steps('o.o.o.o.o.o.o.o.', (i, v) => S.hat(S.t(b, i), v * 0.6));
      }
      S.marimba(S.t(32), midi('C5'), 1);
      S.marimba(S.t(32, 1), midi('G5'), 1);
      S.marimba(S.t(32, 2), midi('C6'), 1);
      S.pizz(S.t(32, 2), midi('C2'), 1);
      S.bell(S.t(32, 2), midi('E6'), 0.8);
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'lofi-lobby',
    title: 'Lo-Fi Lobby',
    mood: 'Warm lo-fi hip-hop with vinyl crackle. Chill puzzles, "relax and play", late-night posts.',
    bpm: 80,
    bars: 24,
    tail: 3,
    swing: 0.22,
    seed: 41,
    build(S) {
      // Dusty top end: the music bus goes through a gentle lowpass.
      const lp = S.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      S.music.disconnect();
      S.music.connect(lp).connect(S.master);
      const key = midi('F3');
      const prog = [1, 4, 0, 5];
      const sax = [
        [[2, 2, 4], [4, 3, 6], [8, 2, 5], [10, 4, 4]],
        [[0, 4, 3], [6, 2, 1], [8, 6, 2]],
        [[4, 2, 4], [6, 2, 5], [8, 3, 7], [12, 4, 6]],
        [[0, 6, 4], [8, 2, 2], [10, 2, 1], [12, 4, 0]],
      ];
      S.crackle(0, S.t(24) + 2, 1);
      for (let b = 0; b < 24; b++) {
        const d = prog[b % 4];
        const sev = spread(chord(key, 'major', d, 4), 53);
        const r = degree(midi('F2'), 'major', d);
        // Lazy strum.
        sev.forEach((n, i) => S.keys(S.t(b) + i * 0.018, [n], S.beat * 3.6, 0.9, { bright: 0.6, verb: 0.35 }));
        if (b % 2 === 1) sev.slice(1).forEach((n, i) => S.keys(S.t(b, 14) + i * 0.015, [n + 12], S.beat * 0.4, 0.45, { bright: 0.5 }));
        if (b >= 2) {
          S.bass(S.t(b), r, S.beat * 1.6, 0.9, { type: 'triangle', cutoff: 500, env: 300, q: 1 });
          S.bass(S.t(b, 10), r + (b % 2 ? 7 : 12), S.beat * 0.4, 0.7, { type: 'triangle', cutoff: 500, env: 300, q: 1 });
          steps(b % 4 === 3 ? 'x.....x..x......' : 'x.....x...x.....', (i) => S.kick(S.t(b, i), 0.85, { tone: 50, decay: 0.35 }));
          steps('....x.......x...', (i) => S.snare(S.t(b, i), 0.6, { tone: 170, verb: 0.2, decay: 0.24 }));
          steps('xoxoxoxoxoxoxoxo', (i, v) => S.hat(S.t(b, i), v * 0.55, { tone: 7000 }));
        }
        if (b >= 8 && b < 20) phrase(S, b, midi('F4'), 'major', sax[b % 4], (t, n, len, v) => S.pluck(t, n, len, 0.75 * v, { type: 'sine', cutoff: 2000, decay: 0.6, delay: 0.35, verb: 0.3 }));
        if (b >= 16) phrase(S, b, midi('F5'), 'major', sax[(b + 2) % 4].slice(0, 2), (t, n) => S.bell(t, n, 0.3, { ring: 1.4, delay: 0.3 }));
      }
      S.keys(S.t(24), spread(chord(key, 'major', 0, 4), 53), S.beat * 6, 1, { bright: 0.5, verb: 0.5 });
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'pixel-dash',
    title: 'Pixel Dash',
    mood: 'Fast chiptune. Arcade action: Wing It, Gloop, Square Deal, speedruns.',
    bpm: 150,
    bars: 40,
    tail: 1.5,
    seed: 53,
    build(S) {
      const p25 = S.pulse(0.25);
      const p12 = S.pulse(0.125);
      const prog = [0, 5, 2, 6];
      const run = [
        [[0, 2, 4], [2, 2, 7], [4, 2, 9], [6, 2, 7], [8, 2, 4], [10, 2, 7], [12, 2, 9], [14, 2, 11]],
        [[0, 2, 5], [2, 2, 7], [4, 2, 9], [6, 2, 7], [8, 4, 12], [12, 4, 11]],
        [[0, 2, 9], [2, 2, 7], [4, 2, 4], [6, 2, 2], [8, 2, 4], [10, 2, 7], [12, 4, 9]],
        [[0, 2, 8], [2, 2, 6], [4, 2, 3], [6, 2, 1], [8, 4, 6], [12, 2, 8], [14, 2, 10]],
      ];
      for (let b = 0; b < 40; b++) {
        const up = b >= 32 ? 2 : 0;
        const key = midi('A3') + up;
        const d = prog[b % 4];
        const tri = chord(key, 'minor', d);
        const r = degree(midi('A2') + up, 'minor', d);
        const sec = b < 4 ? 'intro' : b < 12 ? 'A' : b < 20 ? 'B' : b < 24 ? 'C' : 'A2';
        steps('xxxxxxxxxxxxxxxx', (i) => S.pluck(S.t(b, i), tri[i % 3] + 12 * (Math.floor(i / 3) % 2), 0.05, sec === 'intro' || sec === 'C' ? 0.6 : 0.35, { type: p12, cutoff: 5000, decay: 0.06, pan: 0.3, verb: 0.05 }));
        if (sec !== 'intro') {
          steps('x.x.x.x.x.x.x.x.', (i) => S.pluck(S.t(b, i), r + (i % 4 === 2 ? 12 : 0), 0.1, 1.1, { type: 'triangle', cutoff: 3000, decay: 0.12, verb: 0 }));
        }
        if (b >= 2) {
          steps(sec === 'C' ? 'x.......x.......' : 'x...x...x...x...', (i) => S.kick(S.t(b, i), 0.8, { tone: 60, punch: 4, decay: 0.15 }));
          if (sec !== 'C') steps('....x.......x...', (i) => S.snare(S.t(b, i), 0.7, { tone: 240, verb: 0.05, decay: 0.12 }));
          steps('o.o.o.o.o.o.o.o.', (i, v) => S.hat(S.t(b, i), v * 0.8, { tone: 9000, pan: -0.2 }));
        }
        if (sec === 'A' || sec === 'A2' || sec === 'B') {
          const oct = sec === 'B' ? 12 : 0;
          phrase(S, b, midi('A4') + up + oct, 'minor', run[b % 4], (t, n, len, v) => S.pluck(t, n, len * 0.85, 0.85 * v, { type: p25, cutoff: 6000, decay: 0.4, verb: 0.1, delay: 0.12 }));
          if (sec === 'B') phrase(S, b, midi('A4') + up, 'minor', run[b % 4].map(([s, l, dd]) => [s, l, dd - 2]), (t, n, len, v) => S.pluck(t, n, len * 0.85, 0.5 * v, { type: p12, cutoff: 5000, decay: 0.3, pan: -0.3 }));
        }
        if (b === 31) build(S, b, { riser: true });
        if (b === 4 || b === 12 || b === 24 || b === 32) S.crash(S.t(b), 0.7);
      }
      S.pluck(S.t(40), midi('B5'), 0.6, 1, { type: p25, decay: 0.6 });
      S.pluck(S.t(40), midi('B3'), 0.6, 1, { type: 'triangle', decay: 0.6 });
      S.crash(S.t(40));
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'neon-nights',
    title: 'Neon Nights',
    mood: 'Synthwave drive. NEON RUSH, Mini Racer, night-time edits.',
    bpm: 100,
    bars: 33,
    tail: 3,
    seed: 61,
    build(S) {
      const key = midi('E3');
      const prog = [0, 5, 2, 6];
      const hook = [
        [[0, 6, 7], [6, 2, 6], [8, 4, 4], [12, 4, 2]],
        [[0, 6, 5], [6, 2, 4], [8, 8, 2]],
        [[0, 6, 4], [6, 2, 6], [8, 4, 9], [12, 4, 8]],
        [[0, 8, 8], [8, 4, 6], [12, 4, 4]],
      ];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'minor', d), 52);
        const r = degree(midi('E2'), 'minor', d);
        const intro = b < 4, verse = b >= 4 && b < 12, chorus = (b >= 12 && b < 20) || (b >= 24 && b < 32), bridge = b >= 20 && b < 24;
        S.pad(S.t(b), tri.map((n) => n + 12), S.beat * 4, intro ? 0.8 : 1.1, { cutoff: chorus ? 2800 : 1600, attack: 0.5, verb: 0.45 });
        steps('xxxxxxxxxxxxxxxx', (i) => S.pluck(S.t(b, i), tri[i % 3] + 24, 0.08, intro ? 0.5 : 0.32, { type: 'sawtooth', cutoff: 2200, decay: 0.12, delay: 0.35, pan: (i % 2 ? 0.35 : -0.35) }));
        if (!intro) steps('x.x.x.x.x.x.x.x.', (i) => S.bass(S.t(b, i), r + (i % 4 === 2 ? 12 : 0), S.beat * 0.42, bridge ? 0.6 : 1, { cutoff: 520, env: 900 }));
        if (verse || chorus) {
          steps(chorus ? 'x...x...x...x...' : 'x.......x.......', (i) => S.kick(S.t(b, i), 1, { pump: chorus ? 0.4 : 0.25 }));
          steps('....x.......x...', (i) => S.snare(S.t(b, i), 1, { tone: 170, verb: 0.55, decay: 0.3 }));
          steps('xoxoxoxoxoxoxoxo', (i, v) => S.hat(S.t(b, i), v * 0.6));
        }
        if (chorus) phrase(S, b, midi('E4'), 'minor', hook[b % 4], (t, n, len) => S.lead(t, n, len * 0.95, 1, { vib: 0.4, delay: 0.35, verb: 0.35 }));
        if (bridge) phrase(S, b, midi('E5'), 'minor', hook[b % 4].slice(0, 2), (t, n) => S.bell(t, n, 0.6, { ring: 1.6, delay: 0.3 }));
        if (b === 11 || b === 23) S.riser(S.t(b), S.beat * 4);
        if (b === 12 || b === 24) S.crash(S.t(b));
      }
      S.pad(S.t(32), spread(chord(key, 'minor', 0), 52).map((n) => n + 12), S.beat * 6, 1.2, { cutoff: 2000, attack: 0.05 });
      S.kick(S.t(32), 1);
      S.crash(S.t(32));
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'tick-tock',
    title: 'Tick Tock',
    mood: 'Quiz-show tension bed with a ticking clock. Countdown challenges, trivia, "can you find it?".',
    bpm: 120,
    bars: 32,
    tail: 2,
    seed: 71,
    build(S) {
      const key = midi('D3');
      const prog = [0, 5, 3, 4];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'harmonicMinor', d), 57);
        const r = degree(midi('D2'), 'harmonicMinor', d);
        const layer = Math.floor(b / 8);
        steps('x.x.x.x.x.x.x.x.', (i) => S.tick(S.t(b, i), i % 4 === 0 ? 1 : 0.6, i % 4 === 0 ? 1900 : 1500));
        steps('x.x.x.x.x.x.x.x.', (i) => S.pizz(S.t(b, i), tri[(i / 2) % 3] + (i >= 8 ? 12 : 0), 0.6, { pan: 0.2 }));
        if (layer >= 1) {
          steps('x..x....x..x....', (i) => S.kick(S.t(b, i), 0.7, { tone: 48, decay: 0.3 }));
          S.bass(S.t(b), r, S.beat * 3.5, 0.8, { type: 'triangle', cutoff: 400, env: 200, q: 1 });
        }
        if (layer >= 2) {
          S.pad(S.t(b), tri, S.beat * 4, 0.9, { cutoff: 1200, attack: 0.6 });
          steps('..o...o...o...o.', (i, v) => S.hat(S.t(b, i), v));
          if (b % 2 === 1) S.bell(S.t(b, 12), tri[2] + 24, 0.4, { ring: 1.2 });
        }
        if (layer >= 3) {
          steps('....x.......x...', (i) => S.snare(S.t(b, i), 0.6, { verb: 0.3 }));
          steps('x.x.x.x.x.x.x.x.', (i) => S.pizz(S.t(b, i), tri[2 - ((i / 2) % 3)] + 24, 0.35, { pan: -0.3 }));
        }
        if (b % 4 === 3) {
          S.tom(S.t(b, 12), 110, 0.7);
          S.tom(S.t(b, 14), 90, 0.8);
        }
      }
      S.impact(S.t(32), 1);
      S.pizz(S.t(32), midi('D2'), 1);
      S.bell(S.t(32), midi('D6'), 0.8, { ring: 2 });
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'spooky-glitch',
    title: 'Spooky Glitch',
    mood: 'Playful Halloween: creepy organ, theremin and bells. October posts.',
    bpm: 112,
    bars: 33,
    tail: 3,
    seed: 83,
    build(S) {
      const key = midi('A2');
      const prog = [0, 5, 3, 4];
      const tune = [
        [[0, 2, 0], [2, 2, 2], [4, 2, 4], [6, 2, 2], [8, 4, 7], [12, 4, 6]],
        [[0, 2, 5], [2, 2, 4], [4, 2, 2], [6, 2, 4], [8, 8, 5]],
        [[0, 2, 3], [2, 2, 5], [4, 2, 7], [6, 2, 5], [8, 4, 3], [12, 4, 1]],
        [[0, 4, 4], [4, 2, 6], [6, 2, 8], [8, 4, 6], [12, 4, 4]],
      ];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'harmonicMinor', d), 57);
        const r = degree(midi('A1'), 'harmonicMinor', d);
        const sec = Math.floor(b / 8);
        S.pad(S.t(b), tri, S.beat * 4, 0.9, { type: 'square', cutoff: 1100, attack: 0.08, verb: 0.5 });
        steps('x..x..x.x..x..x.', (i) => S.pizz(S.t(b, i), r + (i % 8 === 6 ? 12 : 0) + 12, 0.9));
        if (b >= 2) {
          steps('x.......x.x.....', (i) => S.kick(S.t(b, i), 0.8, { tone: 50, decay: 0.3 }));
          steps('....x.......x...', (i) => S.clap(S.t(b, i), 0.7, { verb: 0.35 }));
          steps('..x...x...x...x.', (i) => S.hat(S.t(b, i), 0.5));
        }
        const line = tune[b % 4];
        if (sec === 1 || sec === 3) phrase(S, b, midi('A4'), 'harmonicMinor', line, (t, n, len) => S.lead(t, n, len * 0.95, 0.9, { vib: 1.2, type2: 'sine', cutoff: 2400, delay: 0.3, verb: 0.4 }));
        if (sec === 2 || sec === 3) phrase(S, b, midi('A5'), 'harmonicMinor', line, (t, n) => S.bell(t, n, 0.5, { ratio: 2.76, ring: 1.2 }));
        if (sec === 0) phrase(S, b, midi('A4'), 'harmonicMinor', line.filter((_, i) => i % 2 === 0), (t, n) => S.bell(t, n, 0.6, { ratio: 2.76, ring: 1.6 }));
        if (b % 4 === 3) [12, 13, 14, 15].forEach((s, i) => S.tom(S.t(b, s), 140 - i * 18, 0.6));
        if (b === 15 || b === 23) S.riser(S.t(b), S.beat * 4, 0.7);
      }
      S.pad(S.t(32), spread(chord(key, 'harmonicMinor', 0), 57), S.beat * 6, 1.1, { type: 'square', cutoff: 1400, attack: 0.02, verb: 0.6 });
      S.impact(S.t(32), 0.8);
      S.bell(S.t(32), midi('A5'), 0.8, { ratio: 2.76, ring: 2.5 });
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'snow-day',
    title: 'Snow Day',
    mood: 'Cozy winter bells and sleigh shakers (an original tune). December and holiday posts.',
    bpm: 112,
    bars: 33,
    tail: 3,
    seed: 97,
    build(S) {
      const key = midi('G3');
      const prog = [0, 5, 3, 4];
      const tune = [
        [[0, 3, 2], [3, 1, 4], [4, 4, 7], [8, 2, 6], [10, 2, 4], [12, 4, 2]],
        [[0, 3, 1], [3, 1, 2], [4, 4, 4], [8, 2, 5], [10, 2, 4], [12, 4, 2]],
        [[0, 2, 3], [2, 2, 5], [4, 2, 7], [6, 2, 5], [8, 4, 4], [12, 4, 3]],
        [[0, 3, 1], [3, 1, 2], [4, 2, 1], [6, 2, -1], [8, 8, 1]],
      ];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 4];
        const tri = spread(chord(key, 'major', d), 55);
        const r = degree(midi('G2'), 'major', d);
        const sec = Math.floor(b / 8);
        S.pad(S.t(b), tri, S.beat * 4, 0.7, { cutoff: 1500, attack: 0.4, verb: 0.5 });
        [r, r + 7, r + 12, r + 7].forEach((n, i) => S.pizz(S.t(b, i * 4), n, 0.85));
        // Sleigh-bell shimmer.
        if (b >= 2) steps('x.o.x.o.x.o.x.o.', (i, v) => S.hat(S.t(b, i), v * 0.55, { tone: 9500, pan: 0.3 }));
        if (b >= 4) {
          steps('x.......x.......', (i) => S.kick(S.t(b, i), 0.6, { tone: 55, decay: 0.3 }));
          steps('....x.......x...', (i) => S.snare(S.t(b, i), 0.45, { verb: 0.35 }));
        }
        const line = tune[b % 4];
        phrase(S, b, midi('G5'), 'major', line, (t, n, len, v) => S.bell(t, n, 0.75 * v, { ratio: 3.5, ring: 1.1, delay: 0.2 }));
        if (sec >= 1) phrase(S, b, midi('G4'), 'major', line, (t, n, len, v) => S.pluck(t, n, len * 0.9, 0.6 * v, { type: 'triangle', cutoff: 3000, decay: 0.5, verb: 0.3 }));
        if (sec === 2) steps('..x...x...x...x.', (i) => tri.forEach((n) => S.pizz(S.t(b, i), n + 12, 0.3, { pan: -0.3 })));
        if (sec === 3) steps('x...x...x...x...', (i) => S.keys(S.t(b, i), tri.map((n) => n + 12), S.beat * 0.8, 0.5, { bright: 0.4 }));
        if (b === 15) S.riser(S.t(b), S.beat * 4, 0.6);
      }
      S.pad(S.t(32), spread(chord(key, 'major', 0), 55), S.beat * 6, 1, { attack: 0.05, verb: 0.6 });
      [0, 2, 4, 7].forEach((dd, i) => S.bell(S.t(32, i), degree(midi('G5'), 'major', dd), 0.7, { ring: 2 }));
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'party-mode',
    title: 'Party Mode',
    mood: 'Funky house groove. Party games, game-night edits, friends challenges.',
    bpm: 122,
    bars: 32,
    tail: 2,
    seed: 101,
    build(S) {
      const key = midi('A3');
      const prog = [0, 0, 3, 3, 0, 0, 4, 6];
      const riff = [
        [[0, 1, 4], [3, 1, 4], [6, 2, 6], [10, 1, 4], [12, 2, 3], [14, 2, 2]],
        [[0, 2, 0], [3, 1, 2], [4, 2, 4], [8, 1, 7], [11, 1, 6], [12, 4, 4]],
      ];
      for (let b = 0; b < 32; b++) {
        const d = prog[b % 8];
        const sev = spread(chord(key, 'dorian', d, 4), 57);
        const r = degree(midi('A1'), 'dorian', d) + 12;
        const sec = Math.floor(b / 8);
        if (b >= 1) fourFloor(S, b, 1, sec >= 1 ? 0.5 : 0.3);
        if (b >= 2) {
          steps('....x.......x...', (i) => S.clap(S.t(b, i), 0.9));
          steps('..x...x...x...x.', (i) => S.hat(S.t(b, i), 0.8, { open: true }));
          steps('xoxoxoxoxoxoxoxo', (i, v) => S.shaker(S.t(b, i), v));
        }
        steps('..x..x....x..x..', (i) => S.keys(S.t(b, i), sev, S.beat * 0.35, 0.9, { bright: 1.2, verb: 0.2 }));
        if (b >= 4) steps('x..x..x.x.x..x..', (i) => S.bass(S.t(b, i), r + (i === 8 ? 12 : i === 13 ? 10 : 0), S.beat * 0.22, 1, { type: 'square', cutoff: 650, env: 1400, q: 6 }));
        if (sec === 1 || sec === 3) phrase(S, b, midi('A4'), 'dorian', riff[b % 2], (t, n, len, v) => S.pluck(t, n, len * 0.7, 0.9 * v, { type: 'sawtooth', cutoff: 2800, decay: 0.2, glide: 2, delay: 0.25 }));
        if (sec === 2) phrase(S, b, midi('A5'), 'dorian', riff[b % 2], (t, n) => S.bell(t, n, 0.5, { ring: 0.5 }));
        if (b === 7 || b === 23) build(S, b, { voice: 'clap' });
        if (b === 8 || b === 24) S.crash(S.t(b));
      }
      S.keys(S.t(32), spread(chord(key, 'dorian', 0, 4), 57), S.beat * 4, 1, { bright: 1, verb: 0.4 });
      S.kick(S.t(32), 1);
      S.crash(S.t(32));
    },
  },
  // ---------------------------------------------------------------------------------------------
  {
    id: 'logo-sting',
    title: 'Logo Sting',
    mood: 'Three-second sonic logo: a glitchy stutter that snaps into a bright chord. Intros and end cards.',
    bpm: 120,
    bars: 2,
    tail: 1,
    seed: 3,
    build(S) {
      const r = S.r;
      // Glitch stutter: chopped notes and noise bits accelerating into the hit.
      for (let i = 0; i < 12; i++) {
        const t = 0.05 + (1 - (1 - i / 12) ** 1.6) * 1.1;
        S.pluck(t, midi('D5') + [0, 12, 7, 19, -5][Math.floor(r() * 5)], 0.03, 0.5 + i * 0.03, { type: 'square', cutoff: 6000, decay: 0.04, pan: r() - 0.5 });
        if (i % 3 === 1) S.hat(t + 0.02, 0.8, { tone: 4000 + r() * 4000, pan: r() - 0.5 });
      }
      S.riser(0.05, 1.15, 0.6);
      const hit = 1.25;
      S.kick(hit, 1.1);
      S.crash(hit, 0.8);
      S.pad(hit, [midi('D4'), midi('F#4'), midi('A4'), midi('D5')], 1.6, 1.4, { attack: 0.01, cutoff: 3200, verb: 0.5 });
      S.bell(hit, midi('A5'), 0.9, { ring: 1.8 });
      S.bell(hit + 0.12, midi('D6'), 0.8, { ring: 1.8 });
      S.bass(hit, midi('D2'), 1.2, 1, { cutoff: 600 });
    },
  },
];

/** Short sound effects for edits (each rendered on its own). */
export const SFX = [
  { id: 'whoosh', seconds: 0.8, build: (S) => S.riser(0.02, 0.35, 1.4) },
  {
    id: 'pop',
    seconds: 0.4,
    build(S) {
      const o = S.osc('sine', 900, 0.01, 0.2);
      o.frequency.exponentialRampToValueAtTime(260, 0.09);
      const g = S.ctx.createGain();
      S.env(g.gain, 0.01, { a: 0.002, d: 0.08, peak: 1 });
      o.connect(g);
      S.out(g, { bus: S.master });
    },
  },
  { id: 'ding', seconds: 1.6, build: (S) => [['E6', 0.02], ['B6', 0.1]].forEach(([n, t]) => S.bell(t, midi(n), 1.4, { ring: 1.2, delay: 0 })) },
  {
    id: 'buzz',
    seconds: 0.7,
    build(S) {
      for (const f of [110, 116]) {
        const o = S.osc('sawtooth', f, 0.01, 0.45);
        const lp = S.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const g = S.ctx.createGain();
        S.env(g.gain, 0.01, { a: 0.005, d: 0.4, s: 0.8, r: 0.05, peak: 0.5, len: 0.38 });
        o.connect(lp).connect(g);
        S.out(g, { bus: S.master });
      }
    },
  },
  { id: 'tick', seconds: 0.2, build: (S) => S.tick(0.01, 1.6, 1900) },
  { id: 'tock', seconds: 0.2, build: (S) => S.tick(0.01, 1.6, 1300) },
  { id: 'beep', seconds: 0.4, build: (S) => S.pluck(0.01, midi('A5'), 0.18, 2.2, { type: 'square', cutoff: 5000, decay: 0.2 }) },
  { id: 'beep-go', seconds: 0.7, build: (S) => S.pluck(0.01, midi('A6'), 0.4, 2.2, { type: 'square', cutoff: 7000, decay: 0.4 }) },
  { id: 'impact', seconds: 1.6, build: (S) => { S.impact(0.01, 1.3); S.crash(0.01, 0.6); } },
  { id: 'sparkle', seconds: 1.4, build: (S) => [0, 2, 4, 7, 9, 11, 14].forEach((dd, i) => S.bell(0.01 + i * 0.045, degree(midi('C6'), 'major', dd), 0.7, { ring: 0.6, delay: 0 })) },
  { id: 'riser', seconds: 2.3, build: (S) => S.riser(0.01, 2, 1.6) },
  {
    id: 'glitch',
    seconds: 0.7,
    build(S) {
      const r = S.r;
      for (let i = 0; i < 9; i++) {
        const t = 0.01 + i * 0.05 + r() * 0.02;
        S.pluck(t, midi('C5') + Math.floor(r() * 24), 0.025, 1.2, { type: 'square', cutoff: 8000, decay: 0.03, pan: r() - 0.5 });
        S.hat(t, 1.2, { tone: 2000 + r() * 6000 });
      }
    },
  },
  { id: 'coin', seconds: 0.6, build: (S) => { S.pluck(0.01, midi('B5'), 0.07, 1.6, { type: 'square', decay: 0.08 }); S.pluck(0.08, midi('E6'), 0.3, 1.6, { type: 'square', decay: 0.3 }); } },
  { id: 'drumroll', seconds: 2.4, build: (S) => { for (let i = 0; i < 28; i++) S.snare(0.01 + i * 0.055, 0.4 + (i / 28) * 0.6, { verb: 0.2 }); S.crash(1.6, 1); S.kick(1.6, 1); } },
  { id: 'tada', seconds: 2, build: (S) => { S.pad(0.01, [midi('C4'), midi('E4'), midi('G4'), midi('C5')], 0.8, 2, { attack: 0.01, cutoff: 4000 }); S.crash(0.01, 0.8); S.kick(0.01, 1); S.bell(0.01, midi('G6'), 1); } },
  { id: 'notify', seconds: 0.9, build: (S) => { S.marimba(0.01, midi('E5'), 1.6); S.marimba(0.12, midi('A5'), 1.6); } },
  { id: 'swoosh-down', seconds: 0.7, build(S) {
    const n = S.noiseSrc(0.01, 0.5);
    const bp = S.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(8000, 0.01);
    bp.frequency.exponentialRampToValueAtTime(300, 0.45);
    const g = S.ctx.createGain();
    S.env(g.gain, 0.01, { a: 0.08, d: 0.35, peak: 0.6 });
    n.connect(bp).connect(g);
    S.out(g, { bus: S.master });
  } },
];
