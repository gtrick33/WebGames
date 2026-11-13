// What the three edits share: where the music is, a beat grid to cut on, the callings' plates, the end card.
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Kevin MacLeod's pieces at full quality (the game ships 80 kbps cuts of the same ones): see CREDITS in the report. */
export const MUSIC = process.env.SIGIL_MUSIC ?? join(homedir(), 'Downloads/sigilfall-audio/music');
export const track = (name) => join(MUSIC, `${name}.mp3`);

/** Seconds of `n` beats at a tempo. */
export const beats = (bpm) => (n) => (60 / bpm) * n;

export const URL = 'glitchboundstudio.com/sigilfall';
export const credit = (piece) => `Music: “${piece}” by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0`;

/** The seven callings anyone can play, in the order the game lists them, with the game's own words for each. */
export const CALLINGS = {
  warrior: { title: 'Warrior', sub: 'Melee · tough · crowd breaker', accent: '#e0574a' },
  mage: { title: 'Mage', sub: 'Ranged magic · area damage', accent: '#8f7bff' },
  ranger: { title: 'Ranger', sub: 'Precision · mobility · traps', accent: '#6cc46a' },
  paladin: { title: 'Paladin', sub: 'Holy melee · protection', accent: '#f0c95a' },
  priest: { title: 'Priest', sub: 'Holy and shadow · healing', accent: '#f3ead8' },
  warlock: { title: 'Warlock', sub: 'Curses · demons · life drain', accent: '#b06cff' },
  druid: { title: 'Druid', sub: 'Shapeshifter · cat and bear', accent: '#7bd65a' },
};

/** Builds a clip list with running times, so graphics and hits can be pinned to clips by name. */
export function timeline(clips) {
  let at = 0;
  const marks = {};
  const out = clips.map((c) => {
    const start = at - (c.x ?? 0);
    at = start + c.dur;
    if (c.id) marks[c.id] = start;
    return { ...c, at: start };
  });
  return { clips: out, marks, total: at, T: (id, plus = 0) => marks[id] + plus };
}

export const endCard = (at, dur, { tag, piece, kick = 'A Glitchbound adventure' }) => ({ kind: 'end', at, dur, in: 0.5, out: 0, kick, tag, cta: 'Play free in your browser', url: URL, note: 'No download required', credit: credit(piece) });
